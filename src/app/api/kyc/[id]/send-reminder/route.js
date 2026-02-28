import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getKycById, getCompanyProfileById, createMessageLog, createAuditEntry } from '@/lib/db';
import { sendKycReminder } from '@/lib/email';
import { sendWhatsAppMessage, buildReminderMessage } from '@/lib/whatsapp';
import { generateToken, hashToken } from '@/lib/token';
import { getSupabase } from '@/lib/supabase';

export async function POST(request, { params }) {
  const { user, error } = requireAuth(request, ['Admin']);
  if (error) return error;

  try {
    const { id } = await params;
    const kyc = await getKycById(id);
    if (!kyc) {
      return NextResponse.json({ error: 'KYC not found' }, { status: 404 });
    }

    if (!['Pending', 'Submitted'].includes(kyc.status)) {
      return NextResponse.json({ error: `Cannot send reminder for ${kyc.status} KYC` }, { status: 400 });
    }

    // Generate a new token and extend expiry (since we can't recover the original raw token)
    const rawToken = generateToken();
    const tokenH = hashToken(rawToken);
    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Update KYC record with new token + extended expiry
    const supabase = getSupabase();
    await supabase
      .from('kyc')
      .update({ token_hash: tokenH, token_expiry: newExpiry, updated_at: new Date().toISOString() })
      .eq('id', id);

    // Build portal link
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const detectedBase = host ? `${proto}://${host}` : null;
    const baseUrl = detectedBase || process.env.APP_BASE_URL || 'http://localhost:3000';
    const link = `${baseUrl.replace(/\/+$/, '')}/kyc/submit/${rawToken}`;

    const daysLeft = 7;

    // Fetch company profile for branding
    let companyProfile = null;
    if (kyc.companyProfileId) {
      try { companyProfile = await getCompanyProfileById(kyc.companyProfileId); } catch {}
    }

    // Send email reminder
    try {
      await sendKycReminder({
        to: kyc.email,
        clientName: kyc.clientName,
        companyName: kyc.companyName,
        link,
        daysLeft,
        companyProfile,
      });
      createMessageLog({ kycId: id, channel: 'email', recipient: kyc.email, messageType: 'kyc_reminder', status: 'sent' }).catch(() => {});
    } catch (err) {
      createMessageLog({ kycId: id, channel: 'email', recipient: kyc.email, messageType: 'kyc_reminder', status: 'failed', errorMessage: err.message }).catch(() => {});
    }

    // Send WhatsApp reminder if phone exists
    const fullPhone = kyc.phone ? `${kyc.phoneCountryCode || ''}${kyc.phone}`.replace(/[^0-9+]/g, '') : '';
    if (fullPhone) {
      const waMsg = buildReminderMessage({ clientName: kyc.clientName, companyName: kyc.companyName, link, daysLeft });
      sendWhatsAppMessage({ to: fullPhone, message: waMsg }).then(result => {
        createMessageLog({ kycId: id, channel: 'whatsapp', recipient: fullPhone, messageType: 'kyc_reminder', status: result.success ? 'sent' : 'failed', errorMessage: result.error || '' }).catch(() => {});
      }).catch(() => {});
    }

    await createAuditEntry({
      action: 'REMINDER_SENT',
      actor: user.email,
      kycId: id,
      details: `Reminder sent to ${kyc.email}${fullPhone ? ` + WhatsApp ${fullPhone}` : ''} (link extended 7 days)`,
    });

    return NextResponse.json({
      message: `Reminder sent to ${kyc.clientName}. Link extended by 7 days.`,
    });
  } catch (err) {
    console.error('Send reminder error:', err);
    return NextResponse.json({ error: 'Failed to send reminder' }, { status: 500 });
  }
}
