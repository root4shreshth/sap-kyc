import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDocsByKycId } from '@/lib/db';

export async function GET(request, { params }) {
  const { error } = requireAuth(request, ['Admin', 'KYC Team']);
  if (error) return error;

  try {
    const { id } = await params;
    const docs = await getDocsByKycId(id);
    return NextResponse.json(docs);
  } catch (err) {
    console.error('Get docs error:', err);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}
