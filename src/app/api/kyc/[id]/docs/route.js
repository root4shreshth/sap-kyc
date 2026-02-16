import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { SHEETS, getRows } from '@/lib/sheets';

export async function GET(request, { params }) {
  const { error } = requireAuth(request, ['Admin', 'KYC Team']);
  if (error) return error;

  try {
    const { id } = await params;
    const docs = await getRows(SHEETS.KYC_DOCS);
    const filtered = docs.filter((d) => d.kycId === id);
    return NextResponse.json(filtered);
  } catch (err) {
    console.error('Get docs error:', err);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}
