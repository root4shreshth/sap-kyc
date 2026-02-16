import { NextResponse } from 'next/server';
import { SHEETS, getRows } from '@/lib/sheets';
import { hashToken } from '@/lib/token';

export async function GET(_request, { params }) {
  try {
    const { token } = await params;
    const tokenH = hashToken(token);
    const rows = await getRows(SHEETS.KYC);
    const kyc = rows.find((r) => r.tokenHash === tokenH);

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
