import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getKycById, getKycFormData, updateKycSapStatus, createAuditEntry, createSapSyncLog, updateSapSyncLog } from '@/lib/db';
import { withSapSession, createBusinessPartner, isSapConfigured } from '@/lib/sap-client';
import { mapKycToBusinessPartner, mapKycToMinimalBusinessPartner, validateForSapPush } from '@/lib/sap-mapping';

export async function POST(request, { params }) {
  const { user, error } = requireAuth(request, ['Admin']);
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { bpType, minimal } = body;

    if (!bpType || !['customer', 'vendor'].includes(bpType)) {
      return NextResponse.json({ error: 'bpType must be "customer" or "vendor"' }, { status: 400 });
    }

    if (!isSapConfigured()) {
      return NextResponse.json({ error: 'SAP integration is not configured. Add SAP_BASE_URL, SAP_COMPANY_DB, SAP_USERNAME, SAP_PASSWORD to environment.' }, { status: 500 });
    }

    // Get KYC record
    const kyc = await getKycById(id);
    if (!kyc) {
      return NextResponse.json({ error: 'KYC request not found' }, { status: 404 });
    }

    if (kyc.status !== 'Approved') {
      return NextResponse.json({ error: 'KYC must be Approved before pushing to SAP' }, { status: 400 });
    }

    if (kyc.sapCardCode) {
      return NextResponse.json({ error: `Already pushed to SAP as ${kyc.sapCardCode}. Use a different endpoint to update.` }, { status: 409 });
    }

    // Get form data — fall back to KYC record basics if portal form was never submitted
    let formData = await getKycFormData(id);
    if (!formData || Object.keys(formData).length === 0) {
      // Build minimal form data from the KYC record itself
      console.log('[SAP Push] No kyc_form data found, using KYC record basics for:', id);
      formData = {
        businessInfo: {
          businessName: kyc.companyName || kyc.clientName || '',
          phone: kyc.phone || '',
        },
        companyDetails: {
          companyName: kyc.companyName || '',
          email: kyc.email || '',
        },
      };
    }

    // Validate minimum required fields
    const validation = validateForSapPush(formData);
    if (!validation.valid) {
      return NextResponse.json({ error: `Missing required fields: ${validation.errors.join(', ')}` }, { status: 400 });
    }

    // Map KYC data to SAP Business Partner structure
    // Use minimal mode for testing — only sends CardCode, CardName, CardType
    const bpPayload = minimal
      ? mapKycToMinimalBusinessPartner(formData, kyc, bpType)
      : mapKycToBusinessPartner(formData, kyc, bpType);

    console.log('[SAP Push] Creating BP for KYC:', id, 'Type:', bpType, 'Minimal:', !!minimal, 'CardCode:', bpPayload.CardCode);
    console.log('[SAP Push] Payload:', JSON.stringify(bpPayload, null, 2));

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

    // Execute SAP push with auto session management
    let sapResult;
    try {
      sapResult = await withSapSession(async (cookies) => {
        return await createBusinessPartner(bpPayload, cookies);
      });
    } catch (sapErr) {
      const duration = Date.now() - startTime;
      console.error('[SAP Push] SAP error:', sapErr.message);

      // Store the error in DB for visibility
      await updateKycSapStatus(id, {
        sapCardCode: '',
        sapBpType: bpType,
        sapSyncedAt: null,
        sapSyncError: sapErr.message,
      });

      // Update sync log
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
        payloadSent: bpPayload,
        durationMs: duration,
        hint: sapErr.message?.includes('socket hang up')
          ? 'SAP dropped the connection. Try pushing with minimal mode first. If that works, the issue is in the data fields.'
          : undefined,
      }, { status: 502 });
    }

    // Success — store SAP details
    const duration = Date.now() - startTime;
    const cardCode = sapResult?.CardCode || bpPayload.CardCode;
    const now = new Date().toISOString();

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

    // Audit log
    await createAuditEntry({
      action: 'SAP_BP_CREATED',
      actor: user.email,
      kycId: id,
      details: `Business Partner ${cardCode} created as ${bpType}`,
    });

    console.log('[SAP Push] Success! CardCode:', cardCode);

    return NextResponse.json({
      success: true,
      cardCode,
      bpType,
      durationMs: duration,
      message: `Business Partner ${cardCode} created in SAP as ${bpType === 'customer' ? 'Customer' : 'Vendor'}`,
    });
  } catch (err) {
    console.error('[SAP Push] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Failed to push to SAP' }, { status: 500 });
  }
}
