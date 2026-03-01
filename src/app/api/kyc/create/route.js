import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, isValidEmail } from '@/lib/auth';
import { createKyc, createAuditEntry, getCompanyProfileById, createMessageLog, ensureMigration } from '@/lib/db';
import { generateToken, hashToken } from '@/lib/token';
import { sendKycInvite, isSmtpConfigured } from '@/lib/email';
import { sendWhatsAppMessage, buildKycInviteMessage, isWhatsAppConfigured } from '@/lib/whatsapp';

export async function POST(request) {
  const { user, error } = requireAuth(request, ['Admin']);
  if (error) return error;

  try {
    await ensureMigration();
    const { clientName, companyName, email, ccEmail, companyProfileId, phone, phoneCountryCode } = await request.json();
    if (!clientName || !companyName || !email) {
      return NextResponse.json({ error: 'clientName, companyName, email required' }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const id = uuidv4();
    const rawToken = generateToken();
    const tokenH = hashToken(rawToken);
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await createKyc({
      id, clientName, companyName, email,
      tokenHash: tokenH, tokenExpiry: expiry,
      status: 'Pending', remarks: '', createdBy: user.email,
      companyProfileId: companyProfileId || null,
      phone: phone || '', phoneCountryCode: phoneCountryCode || '',
    });

    await createAuditEntry({
      action: 'KYC_CREATED', actor: user.email, kycId: id,
      details: `Client: ${clientName}, Company: ${companyName}`,
    });

    // Build portal link — detect base URL dynamically from request headers
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const detectedBase = host ? `${proto}://${host}` : null;
    const baseUrl = detectedBase || process.env.APP_BASE_URL || 'http://localhost:3000';
    const link = `${baseUrl.replace(/\/+$/, '')}/kyc/submit/${rawToken}`;
    // Fetch company profile for email branding
    let companyProfile = null;
    if (companyProfileId) {
      try { companyProfile = await getCompanyProfileById(companyProfileId); } catch {}
    }
    await sendKycInvite({ to: email, cc: ccEmail || '', clientName, companyName, link, companyProfile });

    // Log email
    createMessageLog({ kycId: id, channel: 'email', recipient: email, messageType: 'kyc_invite', status: 'sent' }).catch(() => {});

    // Send WhatsApp if phone provided (fire-and-forget)
    const fullPhone = phone ? `${phoneCountryCode || ''}${phone}`.replace(/[^0-9+]/g, '') : '';
    if (fullPhone) {
      const waMsg = buildKycInviteMessage({ clientName, companyName, link });
      sendWhatsAppMessage({ to: fullPhone, message: waMsg }).then(result => {
        createMessageLog({
          kycId: id, channel: 'whatsapp', recipient: fullPhone,
          messageType: 'kyc_invite', status: result.success ? 'sent' : 'failed',
          errorMessage: result.error || '',
        }).catch(() => {});
      }).catch(() => {});
    }

    const response = { id, portalLink: link };
    const channels = [];
    if (isSmtpConfigured()) channels.push('email');
    if (fullPhone && isWhatsAppConfigured()) channels.push('WhatsApp');
    if (channels.length > 0) {
      response.message = `KYC request created and sent via ${channels.join(' + ')}. Portal link also available below.`;
    } else if (isSmtpConfigured()) {
      response.message = 'KYC request created and email sent. Portal link also available below.';
    } else {
      response.message = 'KYC request created. Email not configured — share the portal link manually.';
    }
    return NextResponse.json(response);
  } catch (err) {
    console.error('Create KYC error:', err);
    return NextResponse.json({ error: `Failed to create KYC request: ${err.message || 'Unknown error'}` }, { status: 500 });
  }
}
