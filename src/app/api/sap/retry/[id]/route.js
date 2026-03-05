import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getKycById, getKycFormData, updateKycSapStatus, createAuditEntry, createSapSyncLog, updateSapSyncLog } from '@/lib/db';
import { withSapSession, createBusinessPartner, isSapConfigured } from '@/lib/sap-client';
import { mapKycToBusinessPartner, validateForSapPush } from '@/lib/sap-mapping';

export async function POST(request, { params }) {
  const { user, error } = requireAuth(request, ['Admin']);
  if (error) return error;

  try {
    const { id } = await params;
    const { bpType } = await request.json();

    if (!bpType || !['customer', 'vendor'].includes(bpType)) {
      return NextResponse.json({ error: 'bpType must be "customer" or "vendor"' }, { status: 400 });
    }

    if (!isSapConfigured()) {
      return NextResponse.json({ error: 'SAP integration is not configured.' }, { status: 500 });
    }

    const kyc = await getKycById(id);
    if (!kyc) {
      return NextResponse.json({ error: 'KYC request not found' }, { status: 404 });
    }

    if (kyc.status !== 'Approved') {
      return NextResponse.json({ error: 'KYC must be Approved before pushing to SAP' }, { status: 400 });
    }

    if (kyc.sapCardCode) {
      return NextResponse.json({ error: `Already synced as ${kyc.sapCardCode}` }, { status: 409 });
    }

    const formData = await getKycFormData(id);
    if (!formData || Object.keys(formData).length === 0) {
      return NextResponse.json({ error: 'No form data found' }, { status: 400 });
    }

    const validation = validateForSapPush(formData);
    if (!validation.valid) {
      return NextResponse.json({ error: `Missing fields: ${validation.errors.join(', ')}` }, { status: 400 });
    }

    const bpPayload = mapKycToBusinessPartner(formData, kyc, bpType);

    // Create sync log entry
    const syncLog = await createSapSyncLog({
      kycId: id,
      cardCode: bpPayload.CardCode,
      bpType,
      status: 'processing',
      requestPayload: bpPayload,
      triggeredBy: user.email,
    });

    const startTime = Date.now();

    try {
      const sapResult = await withSapSession(async (cookies) => {
        return await createBusinessPartner(bpPayload, cookies);
      });

      const duration = Date.now() - startTime;
      const cardCode = sapResult?.CardCode || bpPayload.CardCode;
      const now = new Date().toISOString();

      // Update KYC record
      await updateKycSapStatus(id, {
        sapCardCode: cardCode,
        sapBpType: bpType,
        sapSyncedAt: now,
        sapSyncError: '',
      });

      // Update sync log
      if (syncLog) {
        await updateSapSyncLog(syncLog.id, {
          status: 'success',
          cardCode,
          responseData: sapResult || {},
          duration,
        });
      }

      await createAuditEntry({
        action: 'SAP_BP_CREATED',
        actor: user.email,
        kycId: id,
        details: `Business Partner ${cardCode} created as ${bpType} (retry)`,
      });

      return NextResponse.json({
        success: true,
        cardCode,
        bpType,
        durationMs: duration,
        message: `Business Partner ${cardCode} created in SAP`,
      });
    } catch (sapErr) {
      const duration = Date.now() - startTime;

      await updateKycSapStatus(id, {
        sapCardCode: '',
        sapBpType: bpType,
        sapSyncedAt: null,
        sapSyncError: sapErr.message,
      });

      if (syncLog) {
        await updateSapSyncLog(syncLog.id, {
          status: 'failed',
          errorMessage: sapErr.message,
          responseData: sapErr.sapError || {},
          duration,
        });
      }

      return NextResponse.json({
        error: `SAP Error: ${sapErr.message}`,
        sapError: sapErr.sapError || null,
        durationMs: duration,
      }, { status: 502 });
    }
  } catch (err) {
    console.error('SAP retry error:', err);
    return NextResponse.json({ error: err.message || 'Failed to retry SAP push' }, { status: 500 });
  }
}
