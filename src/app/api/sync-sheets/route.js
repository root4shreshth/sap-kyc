import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAllKyc, getKycFormData, getComplianceResults, getDocsByKycId } from '@/lib/db';
import { syncAllExistingData } from '@/lib/google-sheets';

export async function POST(request) {
  const { error: authError } = requireAuth(request, ['Admin']);
  if (authError) return authError;

  try {
    const result = await syncAllExistingData(getAllKyc, getKycFormData, getComplianceResults, getDocsByKycId);
    if (result.error) {
      return NextResponse.json({ error: result.error, synced: result.synced }, { status: 500 });
    }
    return NextResponse.json({ message: 'Full sync complete', ...result });
  } catch (err) {
    console.error('Sync sheets error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
