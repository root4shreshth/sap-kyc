import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getKycFormData } from '@/lib/db';

export async function GET(request, { params }) {
  const { error } = requireAuth(request, ['Admin', 'KYC Team']);
  if (error) return error;

  try {
    const { id } = await params;
    const formData = await getKycFormData(id);
    return NextResponse.json({ formData: formData || {} });
  } catch (err) {
    console.error('Admin form GET error:', err);
    return NextResponse.json({ error: 'Failed to load form data' }, { status: 500 });
  }
}
