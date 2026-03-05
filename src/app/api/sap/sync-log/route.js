import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAllSapSyncLogs } from '@/lib/db';

export async function GET(request) {
  const { error } = requireAuth(request, ['Admin']);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const logs = await getAllSapSyncLogs(Math.min(limit, 500));
    return NextResponse.json(logs);
  } catch (err) {
    console.error('SAP sync log error:', err);
    return NextResponse.json({ error: `Failed to fetch sync log: ${err.message}` }, { status: 500 });
  }
}
