import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { SHEETS, getRows } from '@/lib/sheets';

export async function GET(request) {
  const { error } = requireAuth(request, ['Admin', 'KYC Team']);
  if (error) return error;

  try {
    const rows = await getRows(SHEETS.KYC);
    const stats = { Pending: 0, Submitted: 0, 'Under Review': 0, Approved: 0, Rejected: 0 };
    rows.forEach((r) => {
      if (stats[r.status] !== undefined) stats[r.status]++;
    });
    return NextResponse.json(stats);
  } catch (err) {
    console.error('Stats error:', err);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
