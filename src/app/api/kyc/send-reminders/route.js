import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getExpiringKyc, getCompanyProfileById, createMessageLog, createAuditEntry } from '@/lib/db';
import { sendKycReminder } from '@/lib/email';
import { sendWhatsAppMessage, buildReminderMessage } from '@/lib/whatsapp';
import { generateToken, hashToken } from '@/lib/token';

export async function POST(request) {
  const { user, error } = requireAuth(request, ['Admin']);
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const days = body.days || 2;

    const expiring = await getExpiringKyc(days);
    if (expiring.length === 0) {
      return NextResponse.json({ message: 'No pending KYCs near expiry', count: 0 });
    }

    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const detectedBase = host ? `${proto}://${host}` : null;
    const baseUrl = detectedBase || process.env.APP_BASE_URL || 'http://localhost:3000';

    let sent = 0;
    for (const kyc of expiring) {
      const daysLeft = Math.max(1, Math.ceil((new Date(kyc.tokenExpiry) - new Date()) / (24 * 60 * 60 * 1000)));

      // We don't have the raw token, so we can't rebuild the exact link.
      // Instead, the admin can trigger single reminders from the review page with the actual link.
      // For bulk, we note that the link was already sent — this is a nudge email without link.
      // Actually, let's generate a new token for the reminder.
      const rawToken = generateToken();
      const tokenH = hashToken(rawToken);

      let companyProfile = null;
      if (kyc.companyProfileId) {
        try { companyProfile = await getCompanyProfileById(kyc.companyProfileId); } catch {}
      }

      const link = `${baseUrl.replace(/\/+$/, '')}/kyc/submit/${rawToken}`;

      try {
        await sendKycReminder({
          to: kyc.email,
          clientName: kyc.clientName,
          companyName: kyc.companyName,
          link,
          daysLeft,
          companyProfile,
        });
        createMessageLog({ kycId: kyc.id, channel: 'email', recipient: kyc.email, messageType: 'kyc_reminder', status: 'sent' }).catch(() => {});
        sent++;
      } catch (err) {
        createMessageLog({ kycId: kyc.id, channel: 'email', recipient: kyc.email, messageType: 'kyc_reminder', status: 'failed', errorMessage: err.message }).catch(() => {});
      }

      // WhatsApp reminder
      const fullPhone = kyc.phone ? `${kyc.phoneCountryCode || ''}${kyc.phone}`.replace(/[^0-9+]/g, '') : '';
      if (fullPhone) {
        const waMsg = buildReminderMessage({ clientName: kyc.clientName, companyName: kyc.companyName, link, daysLeft });
        sendWhatsAppMessage({ to: fullPhone, message: waMsg }).then(result => {
          createMessageLog({ kycId: kyc.id, channel: 'whatsapp', recipient: fullPhone, messageType: 'kyc_reminder', status: result.success ? 'sent' : 'failed', errorMessage: result.error || '' }).catch(() => {});
        }).catch(() => {});
      }
    }

    await createAuditEntry({
      action: 'REMINDERS_SENT',
      actor: user.email,
      details: `Sent ${sent} reminder(s) for KYCs expiring within ${days} days`,
    });

    return NextResponse.json({ message: `Sent ${sent} reminder(s)`, count: sent, total: expiring.length });
  } catch (err) {
    console.error('Send reminders error:', err);
    return NextResponse.json({ error: 'Failed to send reminders' }, { status: 500 });
  }
}
