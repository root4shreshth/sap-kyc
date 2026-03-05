import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getKycById, getKycFormData, getDocsByKycId, updateKycSapStatus, createAuditEntry, createSapSyncLog, updateSapSyncLog } from '@/lib/db';
import { withSapSession, createBusinessPartner, updateBusinessPartner, uploadAttachments, isSapConfigured } from '@/lib/sap-client';
import { mapKycToBusinessPartner, mapKycToMinimalBusinessPartner, mapKycToAddresses, mapKycToContacts, getCardCode, validateForSapPush } from '@/lib/sap-mapping';
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

    // Build payloads for staged approach
    const bpPayload = minimal
      ? mapKycToMinimalBusinessPartner(formData, kyc, bpType)
      : mapKycToBusinessPartner(formData, kyc, bpType);

    const cardCodeGenerated = getCardCode(formData, kyc, bpType);

    console.log('[SAP Push] Creating BP for KYC:', id, 'Type:', bpType, 'Minimal:', !!minimal, 'CardCode:', bpPayload.CardCode);
    console.log('[SAP Push] Stage 1 Payload:', JSON.stringify(bpPayload, null, 2));

    // Get KYC documents for attachment
    let docs = [];
    try {
      docs = await getDocsByKycId(id);
      console.log(`[SAP Push] Found ${docs.length} documents for KYC:`, id);
    } catch (docErr) {
      console.warn('[SAP Push] Could not fetch documents:', docErr.message);
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
    let sapResult;
    let attachmentEntry = null;
    let attachmentWarnings = [];
    let stageResults = { stage1: null, stage2: null, stage3: null, attachments: null };

    try {
      sapResult = await withSapSession(async (cookies, agent) => {
        // ====== STAGE 1: Create BP with core fields only (POST) ======
        // This is the safest payload — no sub-collections.
        // SAP Service Layer handles this without 502 proxy errors.
        console.log('[SAP Push] Stage 1: Creating core BP...');

        // Optionally upload attachments first
        if (docs.length > 0 && !minimal) {
          console.log(`[SAP Push] Downloading ${docs.length} files from Supabase...`);
          const filesToUpload = [];

          for (const doc of docs) {
            try {
              const { buffer, mimeType } = await downloadFile(doc.driveFileId);
              filesToUpload.push({
                buffer,
                fileName: doc.fileName || 'document.pdf',
                mimeType: mimeType || 'application/pdf',
              });
            } catch (dlErr) {
              console.warn(`[SAP Push] Failed to download ${doc.fileName}:`, dlErr.message);
              attachmentWarnings.push(`Could not download: ${doc.fileName}`);
            }
          }

          if (filesToUpload.length > 0) {
            try {
              const attachResult = await uploadAttachments(filesToUpload, cookies, agent);
              attachmentEntry = attachResult?.AbsoluteEntry;
              stageResults.attachments = 'success';
              console.log('[SAP Push] Attachments uploaded, entry:', attachmentEntry);
            } catch (attErr) {
              console.warn('[SAP Push] Attachment upload failed:', attErr.message);
              attachmentWarnings.push(`Attachment upload failed: ${attErr.message}`);
              stageResults.attachments = `failed: ${attErr.message}`;
              // Continue without attachments
            }
          }
        }

        // Create the core BP
        const createPayload = { ...bpPayload };
        if (attachmentEntry) {
          createPayload.AttachmentEntry = attachmentEntry;
        }

        const result = await createBusinessPartner(createPayload, cookies, agent);
        stageResults.stage1 = 'success';
        const createdCardCode = result?.CardCode || cardCodeGenerated;
        console.log('[SAP Push] Stage 1 complete. CardCode:', createdCardCode);

        // ====== STAGE 2: PATCH in addresses (if not minimal) ======
        if (!minimal) {
          const addressPayload = mapKycToAddresses(formData, kyc, bpType);
          if (addressPayload) {
            try {
              console.log('[SAP Push] Stage 2: Adding addresses...');
              await updateBusinessPartner(createdCardCode, addressPayload, cookies, agent);
              stageResults.stage2 = 'success';
              console.log('[SAP Push] Stage 2 complete. Addresses added.');
            } catch (addrErr) {
              console.warn('[SAP Push] Stage 2 (addresses) failed:', addrErr.message);
              stageResults.stage2 = `failed: ${addrErr.message}`;
              // BP was created — address failure is non-fatal
            }
          } else {
            stageResults.stage2 = 'skipped (no addresses)';
          }
        }

        // ====== STAGE 3: PATCH in contacts (if not minimal) ======
        if (!minimal) {
          const contactPayload = mapKycToContacts(formData, kyc, bpType);
          if (contactPayload) {
            try {
              console.log('[SAP Push] Stage 3: Adding contacts...');
              await updateBusinessPartner(createdCardCode, contactPayload, cookies, agent);
              stageResults.stage3 = 'success';
              console.log('[SAP Push] Stage 3 complete. Contacts added.');
            } catch (ctErr) {
              console.warn('[SAP Push] Stage 3 (contacts) failed:', ctErr.message);
              stageResults.stage3 = `failed: ${ctErr.message}`;
              // BP was created — contact failure is non-fatal
            }
          } else {
            stageResults.stage3 = 'skipped (no contacts)';
          }
        }

        return result;
      });
    } catch (sapErr) {
      const duration = Date.now() - startTime;
      console.error('[SAP Push] SAP error:', sapErr.message);

      // Determine helpful hints based on error type
      let hint;
      if (sapErr.isProxy || sapErr.message?.includes('502') || sapErr.message?.includes('Proxy')) {
        hint = 'SAP proxy returned 502. The Service Layer may be overloaded. Wait a minute and try again, or use Test (Minimal) first.';
      } else if (sapErr.message?.includes('Attachment') || sapErr.message?.includes('101')) {
        hint = docs.length === 0
          ? 'SAP requires document attachments. Upload documents through the client portal first.'
          : 'Documents exist but failed to upload to SAP. Check server logs.';
      } else if (sapErr.message?.includes('socket hang up')) {
        hint = 'SAP dropped the connection. Try the Test (Minimal) button first.';
      }

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
        stageResults,
        hint,
        durationMs: duration,
      }, { status: 502 });
    }

    // Success — store SAP details
    const duration = Date.now() - startTime;
    const cardCode = sapResult?.CardCode || bpPayload.CardCode;
    const now = new Date().toISOString();

    // Determine partial success warnings
    const partialWarnings = [];
    if (stageResults.stage2?.startsWith('failed')) partialWarnings.push('Addresses could not be added');
    if (stageResults.stage3?.startsWith('failed')) partialWarnings.push('Contacts could not be added');

    await updateKycSapStatus(id, {
      sapCardCode: cardCode,
      sapBpType: bpType,
      sapSyncedAt: now,
      sapSyncError: partialWarnings.length > 0 ? `Partial: ${partialWarnings.join(', ')}` : '',
    });

    if (syncLog) {
      await updateSapSyncLog(syncLog.id, {
        status: partialWarnings.length > 0 ? 'partial' : 'success',
        cardCode,
        responseData: { sapResult: sapResult || {}, stageResults },
        duration,
      });
    }

    await createAuditEntry({
      action: 'SAP_BP_CREATED',
      actor: user.email,
      kycId: id,
      details: `Business Partner ${cardCode} created as ${bpType}${attachmentEntry ? ` with attachment #${attachmentEntry}` : ''}${partialWarnings.length > 0 ? ` (${partialWarnings.join(', ')})` : ''}`,
    });

    console.log('[SAP Push] Success! CardCode:', cardCode, 'Stages:', JSON.stringify(stageResults));

    return NextResponse.json({
      success: true,
      cardCode,
      bpType,
      attachmentEntry,
      attachmentWarnings: attachmentWarnings.length > 0 ? attachmentWarnings : undefined,
      partialWarnings: partialWarnings.length > 0 ? partialWarnings : undefined,
      stageResults,
      docsAttached: docs.length,
      durationMs: duration,
      message: `Business Partner ${cardCode} created in SAP as ${bpType === 'customer' ? 'Customer' : 'Vendor'}${partialWarnings.length > 0 ? ` (note: ${partialWarnings.join(', ')})` : ''}${attachmentEntry ? ` with ${docs.length} document(s) attached` : ''}`,
    });
  } catch (err) {
    console.error('[SAP Push] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Failed to push to SAP' }, { status: 500 });
  }
}
