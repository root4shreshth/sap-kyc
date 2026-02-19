import { NextResponse } from 'next/server';
import { getKycByTokenHash, getKycFormData, saveKycFormData } from '@/lib/db';
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

    const formData = await getKycFormData(kyc.id);
    return NextResponse.json({ formData: formData || {} });
  } catch (err) {
    console.error('Portal form GET error:', err);
    return NextResponse.json({ error: 'Failed to load form data' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
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
      return NextResponse.json({ error: 'Already submitted' }, { status: 400 });
    }

    const { formData } = await request.json();
    formData.lastSaved = new Date().toISOString();
    formData.version = 1;
    await saveKycFormData(kyc.id, formData);

    return NextResponse.json({ message: 'Form saved' });
  } catch (err) {
    console.error('Portal form PUT error:', err);
    return NextResponse.json({ error: 'Failed to save form data' }, { status: 500 });
  }
}
