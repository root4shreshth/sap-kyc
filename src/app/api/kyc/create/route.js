import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, isValidEmail } from '@/lib/auth';
import { createKyc, createAuditEntry } from '@/lib/db';
import { generateToken, hashToken } from '@/lib/token';
import { sendKycInvite, isSmtpConfigured } from '@/lib/email';

export async function POST(request) {
  const { user, error } = requireAuth(request, ['Admin']);
  if (error) return error;

  try {
    const { clientName, companyName, email } = await request.json();
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
    });

    await createAuditEntry({
      action: 'KYC_CREATED', actor: user.email, kycId: id,
      details: `Client: ${clientName}, Company: ${companyName}`,
    });

    const link = `${process.env.APP_BASE_URL}/kyc/submit/${rawToken}`;
    await sendKycInvite({ to: email, clientName, companyName, link });

    const response = { id, portalLink: link };
    if (isSmtpConfigured()) {
      response.message = 'KYC request created and email sent. Portal link also available below.';
    } else {
      response.message = 'KYC request created. Email not configured — share the portal link manually.';
    }
    return NextResponse.json(response);
  } catch (err) {
    console.error('Create KYC error:', err);
    return NextResponse.json({ error: 'Failed to create KYC request' }, { status: 500 });
  }
}
