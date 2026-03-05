import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getKycById, getKycFormData, getDocsByKycId, updateKycSapStatus, createAuditEntry, createSapSyncLog, updateSapSyncLog } from '@/lib/db';
import { withSapSession, createBusinessPartner, uploadAttachments, isSapConfigured } from '@/lib/sap-client';
import { mapKycToBusinessPartner, mapKycToMinimalBusinessPartner, validateForSapPush } from '@/lib/sap-mapping';
import { downloadFile } from '@/lib/storage';

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
    const bpPayload = minimal
      ? mapKycToMinimalBusinessPartner(formData, kyc, bpType)
      : mapKycToBusinessPartner(formData, kyc, bpType);

    console.log('[SAP Push] Creating BP for KYC:', id, 'Type:', bpType, 'Minimal:', !!minimal, 'CardCode:', bpPayload.CardCode);
    console.log('[SAP Push] Payload:', JSON.stringify(bpPayload, null, 2));

    // Get KYC documents for attachment
    let docs = [];
    let docsWarning = null;
    try {
      docs = await getDocsByKycId(id);
      console.log(`[SAP Push] Found ${docs.length} documents for KYC:`, id);
    } catch (docErr) {
      console.warn('[SAP Push] Could not fetch documents:', docErr.message);
      docsWarning = 'Could not fetch documents from database';
    }

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
    let attachmentEntry = null;
    let attachmentWarnings = [];

    try {
      sapResult = await withSapSession(async (cookies, agent) => {
        // Step 1: Upload documents as SAP attachments (if any exist)
        if (docs.length > 0 && !minimal) {
          console.log(`[SAP Push] Downloading ${docs.length} files from Supabase for SAP attachment...`);
          const filesToUpload = [];

          for (const doc of docs) {
            try {
              const { buffer, mimeType } = await downloadFile(doc.driveFileId);
              filesToUpload.push({
                buffer,
                fileName: doc.fileName || 'document.pdf',
                mimeType: mimeType || 'application/pdf',
              });
              console.log(`[SAP Push] Downloaded: ${doc.fileName} (${buffer.length} bytes)`);
            } catch (dlErr) {
              console.warn(`[SAP Push] Failed to download ${doc.fileName}:`, dlErr.message);
              attachmentWarnings.push(`Could not download: ${doc.fileName}`);
            }
          }

          if (filesToUpload.length > 0) {
            try {
              const attachResult = await uploadAttachments(filesToUpload, cookies, agent);
              attachmentEntry = attachResult?.AbsoluteEntry;
              console.log('[SAP Push] Attachments uploaded, entry:', attachmentEntry);
            } catch (attErr) {
              console.warn('[SAP Push] Attachment upload failed:', attErr.message);
              attachmentWarnings.push(`Attachment upload failed: ${attErr.message}`);
              // Continue without attachments — will try BP creation anyway
            }
          }
        }

        // Step 2: Add attachment entry to BP payload if we have one
        const finalPayload = { ...bpPayload };
        if (attachmentEntry) {
          finalPayload.AttachmentEntry = attachmentEntry;
        }

        // Step 3: Create the Business Partner
        return await createBusinessPartner(finalPayload, cookies, agent);
      });
    } catch (sapErr) {
      const duration = Date.now() - startTime;
      console.error('[SAP Push] SAP error:', sapErr.message);

      // If it failed because of missing attachment and we have no docs, provide a clear message
      const isAttachmentError = sapErr.message?.includes('Attachment') || sapErr.message?.includes('101');
      const hint = isAttachmentError && docs.length === 0
        ? 'SAP requires document attachments but no documents were uploaded for this KYC. Please upload documents through the client portal first.'
        : isAttachmentError && docs.length > 0 && !attachmentEntry
          ? 'Documents exist but failed to upload to SAP. Check the server logs for details.'
          : sapErr.message?.includes('socket hang up')
            ? 'SAP dropped the connection. Try the Test (Minimal) button first.'
            : undefined;

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
        docsFound: docs.length,
        attachmentUploaded: !!attachmentEntry,
        attachmentWarnings,
        hint,
        durationMs: duration,
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
      details: `Business Partner ${cardCode} created as ${bpType}${attachmentEntry ? ` with attachment #${attachmentEntry}` : ''}`,
    });

    console.log('[SAP Push] Success! CardCode:', cardCode, 'Attachment:', attachmentEntry || 'none');

    return NextResponse.json({
      success: true,
      cardCode,
      bpType,
      attachmentEntry,
      attachmentWarnings: attachmentWarnings.length > 0 ? attachmentWarnings : undefined,
      docsAttached: docs.length,
      durationMs: duration,
      message: `Business Partner ${cardCode} created in SAP as ${bpType === 'customer' ? 'Customer' : 'Vendor'}${attachmentEntry ? ` with ${docs.length} document(s) attached` : ''}`,
    });
  } catch (err) {
    console.error('[SAP Push] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Failed to push to SAP' }, { status: 500 });
  }
}
