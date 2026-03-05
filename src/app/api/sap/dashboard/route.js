import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSapSyncStats, getAllSapSyncLogs } from '@/lib/db';
import { isSapConfigured } from '@/lib/sap-client';

export async function GET(request) {
  const { error } = requireAuth(request, ['Admin']);
  if (error) return error;

  try {
    const configured = isSapConfigured();
    const stats = await getSapSyncStats();
    const recentLogs = await getAllSapSyncLogs(20);

    return NextResponse.json({
      configured,
      sapBaseUrl: configured ? (process.env.SAP_BASE_URL || '').replace(/\/+$/, '') : null,
      sapCompanyDb: configured ? (process.env.SAP_COMPANY_DB || '') : null,
      stats,
      recentLogs,
    });
  } catch (err) {
    console.error('SAP dashboard error:', err);
    return NextResponse.json({ error: `Failed to load SAP dashboard: ${err.message}` }, { status: 500 });
  }
}
