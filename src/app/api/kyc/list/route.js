import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { SHEETS, getRows } from '@/lib/sheets';

export async function GET(request) {
  const { error } = requireAuth(request, ['Admin', 'KYC Team']);
  if (error) return error;

  try {
    const rows = await getRows(SHEETS.KYC);
    const safe = rows.map(({ tokenHash, tokenExpiry, ...rest }) => rest);
    return NextResponse.json(safe);
  } catch (err) {
    console.error('List error:', err);
    return NextResponse.json({ error: 'Failed to fetch list' }, { status: 500 });
  }
}
