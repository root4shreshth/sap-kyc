import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getKycById, getKycFormData, updateKycSapStatus, createAuditEntry, createSapSyncLog, updateSapSyncLog } from '@/lib/db';
import {
  withSapSession, createBusinessPartner, isSapConfigured, createPostAgent,
  createPlaceholderAttachment, getDocumentSeries, findDefaultSeries,
  getPaymentTerms, findAdvancePaymentTerms,
} from '@/lib/sap-client';
import { mapKycToBusinessPartner, validateForSapPush } from '@/lib/sap-mapping';

const BP_TYPE_LABEL = { customer: 'Customer', vendor: 'Vendor', lead: 'Lead' };

export async function POST(request, { params }) {
  const { user, error } = requireAuth(request, ['Admin']);
  if (error) return error;

  try {
    const { id } = await params;
    const { bpType } = await request.json();

    if (!bpType || !['customer', 'vendor', 'lead'].includes(bpType)) {
      return NextResponse.json({ error: 'bpType must be "customer", "vendor", or "lead"' }, { status: 400 });
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

    let formData = await getKycFormData(id);
    if (!formData || Object.keys(formData).length === 0) {
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

    const validation = validateForSapPush(formData);
    if (!validation.valid) {
      return NextResponse.json({ error: `Missing fields: ${validation.errors.join(', ')}` }, { status: 400 });
    }

    // Create sync log entry
    const syncLog = await createSapSyncLog({
      kycId: id,
      cardCode: 'pending',
      bpType,
      status: 'processing',
      requestPayload: { bpType, retry: true },
      triggeredBy: user.email,
    });

    const startTime = Date.now();

    try {
      const sapResult = await withSapSession(async (cookies, agent) => {
        // Query series for auto-numbering
        let seriesNumber = null;
        try {
          const seriesList = await getDocumentSeries(cookies, agent);
          const subType = bpType === 'customer' ? 'C' : bpType === 'vendor' ? 'S' : 'L';
          seriesNumber = findDefaultSeries(seriesList, subType);
          console.log(`[SAP Retry] Series for ${bpType}: ${seriesNumber || 'none'}`);
        } catch (seriesErr) {
          console.warn('[SAP Retry] Series query failed:', seriesErr.message);
        }

        // Query payment terms
        let paymentTermsCode = null;
        try {
          const termsList = await getPaymentTerms(cookies, agent);
          paymentTermsCode = findAdvancePaymentTerms(termsList);
        } catch (ptErr) {
          console.warn('[SAP Retry] Payment terms query failed:', ptErr.message);
        }

        // Build payload with series + payment terms
        const bpPayload = mapKycToBusinessPartner(formData, kyc, bpType, seriesNumber, paymentTermsCode);

        // Create placeholder attachment (SAP requires one)
        let attachmentEntry = null;
        const placeholderAgent = createPostAgent();
        try {
          attachmentEntry = await createPlaceholderAttachment(cookies, placeholderAgent);
          console.log('[SAP Retry] Placeholder attachment:', attachmentEntry);
        } catch (phErr) {
          console.warn('[SAP Retry] Placeholder attachment failed:', phErr.message);
        } finally {
          try { placeholderAgent.destroy(); } catch { /* ignore */ }
        }

        const createPayload = { ...bpPayload };
        if (attachmentEntry) createPayload.AttachmentEntry = attachmentEntry;

        return await createBusinessPartner(createPayload, cookies);
      });

      const duration = Date.now() - startTime;
      const cardCode = sapResult?.CardCode;

      if (!cardCode) {
        throw new Error('SAP did not return a CardCode');
      }

      const now = new Date().toISOString();

      await updateKycSapStatus(id, {
        sapCardCode: cardCode,
        sapBpType: bpType,
        sapSyncedAt: now,
        sapSyncError: '',
      });

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
        details: `Business Partner ${cardCode} created as ${BP_TYPE_LABEL[bpType] || bpType} (retry)`,
      });

      return NextResponse.json({
        success: true,
        cardCode,
        bpType,
        durationMs: duration,
        message: `Business Partner ${cardCode} created in SAP as ${BP_TYPE_LABEL[bpType] || bpType}`,
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
