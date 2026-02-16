import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getKycStats } from '@/lib/db';

export async function GET(request) {
  const { error } = requireAuth(request, ['Admin', 'KYC Team']);
  if (error) return error;

  try {
    const stats = await getKycStats();
    return NextResponse.json(stats);
  } catch (err) {
    console.error('Stats error:', err);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
