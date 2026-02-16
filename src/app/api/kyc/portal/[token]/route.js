import { NextResponse } from 'next/server';
import { getKycByTokenHash } from '@/lib/db';
import { hashToken } from '@/lib/token';

export async function GET(_request, { params }) {
  try {
    const { token } = await params;
    const tokenH = hashToken(token);
    const kyc = await getKycByTokenHash(tokenH);

    if (!kyc) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }
    if (new Date(kyc.tokenExpiry) < new Date()) {
      return NextResponse.json({ error: 'This link has expired' }, { status: 410 });
    }
    if (!['Pending', 'Rejected'].includes(kyc.status)) {
      return NextResponse.json({ error: 'Documents already submitted' }, { status: 400 });
    }

    return NextResponse.json({
      clientName: kyc.clientName,
      companyName: kyc.companyName,
      status: kyc.status,
    });
  } catch (err) {
    console.error('Portal validation error:', err);
    return NextResponse.json({ error: 'Validation failed' }, { status: 500 });
  }
}
