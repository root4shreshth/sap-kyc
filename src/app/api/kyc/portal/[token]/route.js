import { NextResponse } from 'next/server';
import { getKycByTokenHash, getCompanyProfileById } from '@/lib/db';
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

    // Fetch company profile for branding
    let companyProfile = null;
    if (kyc.companyProfileId) {
      try { companyProfile = await getCompanyProfileById(kyc.companyProfileId); } catch {}
    }

    return NextResponse.json({
      clientName: kyc.clientName,
      companyName: kyc.companyName,
      status: kyc.status,
      companyProfile: companyProfile ? {
        name: companyProfile.name,
        shortName: companyProfile.shortName,
        logoUrl: companyProfile.logoUrl,
        footerText: companyProfile.footerText,
        primaryColor: companyProfile.primaryColor,
      } : null,
    });
  } catch (err) {
    console.error('Portal validation error:', err);
    return NextResponse.json({ error: 'Validation failed' }, { status: 500 });
  }
}
