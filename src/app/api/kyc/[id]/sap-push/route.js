import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getKycById, getKycFormData, updateKycSapStatus, createAuditEntry } from '@/lib/db';
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

    // Get form data
    const formData = await getKycFormData(id);
    if (!formData || Object.keys(formData).length === 0) {
      return NextResponse.json({ error: 'No form data found for this KYC' }, { status: 400 });
    }

    // Validate minimum required fields
    const validation = validateForSapPush(formData);
    if (!validation.valid) {
      return NextResponse.json({ error: `Missing required fields: ${validation.errors.join(', ')}` }, { status: 400 });
    }

    // Map KYC data to SAP Business Partner structure
    const bpPayload = mapKycToBusinessPartner(formData, kyc, bpType);

    console.log('[SAP Push] Creating BP for KYC:', id, 'Type:', bpType, 'CardCode:', bpPayload.CardCode);

    // Execute SAP push with auto session management
    let sapResult;
    try {
      sapResult = await withSapSession(async (cookies) => {
        return await createBusinessPartner(bpPayload, cookies);
      });
    } catch (sapErr) {
      console.error('[SAP Push] SAP error:', sapErr.message);

      // Store the error in DB for visibility
      await updateKycSapStatus(id, {
        sapCardCode: '',
        sapBpType: bpType,
        sapSyncedAt: null,
        sapSyncError: sapErr.message,
      });

      return NextResponse.json({
        error: `SAP Error: ${sapErr.message}`,
        sapError: sapErr.sapError || null,
      }, { status: 502 });
    }

    // Success — store SAP details
    const cardCode = sapResult?.CardCode || bpPayload.CardCode;
    const now = new Date().toISOString();

    await updateKycSapStatus(id, {
      sapCardCode: cardCode,
      sapBpType: bpType,
      sapSyncedAt: now,
      sapSyncError: '',
    });

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
      message: `Business Partner ${cardCode} created in SAP as ${bpType === 'customer' ? 'Customer' : 'Vendor'}`,
    });
  } catch (err) {
    console.error('[SAP Push] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Failed to push to SAP' }, { status: 500 });
  }
}
