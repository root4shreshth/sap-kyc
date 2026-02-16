import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAllKyc } from '@/lib/db';

export async function GET(request) {
  const { error } = requireAuth(request, ['Admin', 'KYC Team']);
  if (error) return error;

  try {
    const rows = await getAllKyc();
    return NextResponse.json(rows);
  } catch (err) {
    console.error('List error:', err);
    return NextResponse.json({ error: 'Failed to fetch list' }, { status: 500 });
  }
}
