import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getKycById, getKycFormData, getDocsByKycId, updateKycSapStatus, createAuditEntry, createSapSyncLog, updateSapSyncLog } from '@/lib/db';
import {
  withSapSession, createBusinessPartner, updateBusinessPartner,
  uploadAttachments, isSapConfigured, createPostAgent,
  getDocumentSeries, findDefaultSeries,
  writeToAttachmentShare, createAttachmentFromPath, getSapAttachmentPath,
} from '@/lib/sap-client';
import { mapKycToBusinessPartner, mapKycToMinimalBusinessPartner, mapKycToAddresses, mapKycToContacts, validateForSapPush } from '@/lib/sap-mapping';
import { downloadFile } from '@/lib/storage';

const BP_TYPE_LABEL = { customer: 'Customer', vendor: 'Vendor', lead: 'Lead' };

export async function POST(request, { params }) {
  const { user, error } = requireAuth(request, ['Admin']);
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { bpType, minimal, skipAttachments } = body;

    if (!bpType || !['customer', 'vendor', 'lead'].includes(bpType)) {
      return NextResponse.json({ error: 'bpType must be "customer", "vendor", or "lead"' }, { status: 400 });
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

    console.log('[SAP Push] Starting push for KYC:', id, 'Type:', bpType, 'Minimal:', !!minimal, 'SkipAttachments:', !!skipAttachments);

    // Get KYC documents for attachment (unless skipping)
    let docs = [];
    if (!minimal && !skipAttachments) {
      try {
        docs = await getDocsByKycId(id);
        console.log(`[SAP Push] Found ${docs.length} documents for KYC:`, id);
        docs.forEach((d, i) => {
          console.log(`[SAP Push]   Doc ${i + 1}: type="${d.docType}", file="${d.fileName}", storagePath="${d.driveFileId}"`);
        });
      } catch (docErr) {
        console.warn('[SAP Push] Could not fetch documents:', docErr.message);
      }
    } else {
      console.log(`[SAP Push] Skipping attachments (minimal=${!!minimal}, skipAttachments=${!!skipAttachments})`);
    }

    // Create sync log entry (cardCode is pending until SAP returns it)
    const syncLog = await createSapSyncLog({
      kycId: id,
      cardCode: 'pending',
      bpType,
      status: 'processing',
      requestPayload: { bpType, minimal: !!minimal, skipAttachments: !!skipAttachments },
      triggeredBy: user.email,
    });

    const startTime = Date.now();
    let sapResult;
    let attachmentEntry = null;
    let attachmentWarnings = [];
    let filesWrittenToShare = [];
    let stageResults = { series: null, stage1: null, stage2: null, stage3: null, attachments: null };

    try {
      sapResult = await withSapSession(async (cookies, agent) => {
        console.log('[SAP Push] Session established. Starting push...');

        // ====== QUERY SAP SERIES (for auto-numbering) ======
        let seriesNumber = null;
        try {
          const seriesList = await getDocumentSeries(cookies, agent);
          const subType = bpType === 'customer' ? 'C' : bpType === 'vendor' ? 'S' : 'L';
          seriesNumber = findDefaultSeries(seriesList, subType);
          stageResults.series = seriesNumber ? `found (series: ${seriesNumber})` : 'no series found for subtype';
          console.log(`[SAP Push] Series for ${bpType} (subType=${subType}): ${seriesNumber || 'none — will use fallback CardCode'}`);
        } catch (seriesErr) {
          stageResults.series = `query failed: ${seriesErr.message}`;
          console.warn('[SAP Push] Series query failed:', seriesErr.message, '— will use fallback CardCode');
        }

        // ====== BUILD PAYLOAD ======
        // NOTE: PaymentTermsGrpCode removed — SAP rejects it as invalid on this installation
        const bpPayload = minimal
          ? mapKycToMinimalBusinessPartner(formData, kyc, bpType, seriesNumber)
          : mapKycToBusinessPartner(formData, kyc, bpType, seriesNumber);

        console.log('[SAP Push] Stage 1 Payload:', JSON.stringify(bpPayload, null, 2));

        // ====== ATTACHMENT HANDLING (Dual-Path Strategy) ======
        // Method A: Multipart upload to SAP Attachments2 (works once SAP folder configured)
        // Method B: Write to network share + SourcePath JSON (works when on same network)
        // If both fail, proceed without attachment (SAP team has turned off mandatory attachment)
        const attachmentSharePath = getSapAttachmentPath();

        if (docs.length > 0) {
          console.log(`[SAP Push] Downloading ${docs.length} files from Supabase...`);
          const filesToUpload = [];

          for (const doc of docs) {
            try {
              console.log(`[SAP Push] Downloading: "${doc.fileName}" from path: "${doc.driveFileId}"`);
              const { buffer, mimeType } = await downloadFile(doc.driveFileId);
              console.log(`[SAP Push] Downloaded: "${doc.fileName}" (${buffer.length} bytes, type: ${mimeType})`);
              filesToUpload.push({
                buffer,
                fileName: doc.fileName || 'document.pdf',
                mimeType: mimeType || 'application/pdf',
              });
            } catch (dlErr) {
              console.warn(`[SAP Push] Failed to download "${doc.fileName}" (path: "${doc.driveFileId}"):`, dlErr.message);
              attachmentWarnings.push(`Download failed: ${doc.fileName} — ${dlErr.message}`);
            }
          }

          if (filesToUpload.length > 0) {
            // --- Method A: Try multipart upload to SAP Attachments2 ---
            try {
              console.log(`[SAP Push] Method A: Uploading ${filesToUpload.length} files to SAP Attachments2 (multipart)...`);
              const attachAgent = createPostAgent();
              try {
                const attachResult = await uploadAttachments(filesToUpload, cookies, attachAgent);
                attachmentEntry = attachResult?.AbsoluteEntry;
                stageResults.attachments = `multipart success (entry: ${attachmentEntry}, ${filesToUpload.length} file(s))`;
                console.log('[SAP Push] Method A success! AbsoluteEntry:', attachmentEntry);
              } finally {
                try { attachAgent.destroy(); } catch { /* ignore */ }
              }
            } catch (attErr) {
              console.warn('[SAP Push] Method A (multipart upload) failed:', attErr.message);
              attachmentWarnings.push(`Multipart upload failed: ${attErr.message}`);

              // --- Method B: Write to network share + SourcePath ---
              if (attachmentSharePath) {
                console.log(`[SAP Push] Method B: Writing ${filesToUpload.length} files to network share: ${attachmentSharePath}`);

                for (const file of filesToUpload) {
                  try {
                    const writeResult = await writeToAttachmentShare(file.buffer, file.fileName, id);
                    console.log(`[SAP Push] Written to share: ${writeResult.fullPath}`);

                    // Parse filename and extension for SourcePath entry
                    const lastDot = writeResult.fileName.lastIndexOf('.');
                    const nameNoExt = lastDot > 0 ? writeResult.fileName.substring(0, lastDot) : writeResult.fileName;
                    const ext = lastDot > 0 ? writeResult.fileName.substring(lastDot + 1) : '';

                    filesWrittenToShare.push({
                      fileName: nameNoExt,
                      fileExtension: ext,
                      sourcePath: attachmentSharePath,
                      fullPath: writeResult.fullPath,
                    });
                  } catch (writeErr) {
                    console.warn(`[SAP Push] Failed to write "${file.fileName}" to share:`, writeErr.message);
                    attachmentWarnings.push(`Network share write failed: ${file.fileName} — ${writeErr.message}`);
                  }
                }

                // Try creating SAP attachment entry via SourcePath
                if (filesWrittenToShare.length > 0) {
                  try {
                    console.log(`[SAP Push] Method B: Creating SourcePath attachment for ${filesWrittenToShare.length} file(s)...`);
                    const pathAgent = createPostAgent();
                    try {
                      attachmentEntry = await createAttachmentFromPath(filesWrittenToShare, cookies, pathAgent);
                      stageResults.attachments = `sourcepath success (entry: ${attachmentEntry}, ${filesWrittenToShare.length} file(s) on share)`;
                      console.log('[SAP Push] Method B success! AbsoluteEntry:', attachmentEntry);
                    } finally {
                      try { pathAgent.destroy(); } catch { /* ignore */ }
                    }
                  } catch (spErr) {
                    console.warn('[SAP Push] Method B (SourcePath) failed:', spErr.message);
                    attachmentWarnings.push(`SourcePath attachment failed: ${spErr.message}`);
                    stageResults.attachments = `both methods failed (files on share: ${filesWrittenToShare.length}). Multipart: ${attErr.message}. SourcePath: ${spErr.message}`;
                  }
                } else {
                  stageResults.attachments = `multipart failed, all share writes failed`;
                }
              } else {
                stageResults.attachments = `multipart failed: ${attErr.message} (SAP_ATTACHMENT_PATH not set — no fallback)`;
                console.warn('[SAP Push] No SAP_ATTACHMENT_PATH configured — cannot fall back to Method B');
              }
            }
          } else {
            console.warn('[SAP Push] All document downloads failed');
            attachmentWarnings.push(`All ${docs.length} document downloads failed`);
            stageResults.attachments = 'all downloads failed';
          }
        } else if (!minimal && !skipAttachments) {
          stageResults.attachments = 'no documents found';
        } else {
          stageResults.attachments = `skipped (minimal=${!!minimal}, skipAttachments=${!!skipAttachments})`;
        }

        // ====== STAGE 1: Create BP with core fields only (POST) ======
        console.log('[SAP Push] Stage 1: Creating core BP...');
        const createPayload = { ...bpPayload };
        if (attachmentEntry) {
          createPayload.AttachmentEntry = attachmentEntry;
        }

        const result = await createBusinessPartner(createPayload, cookies, agent);
        stageResults.stage1 = 'success';
        const createdCardCode = result?.CardCode;

        if (!createdCardCode) {
          throw new Error('SAP did not return a CardCode after BP creation. Response: ' + JSON.stringify(result));
        }

        console.log('[SAP Push] Stage 1 complete. SAP-generated CardCode:', createdCardCode);

        // ====== STAGE 2: PATCH in addresses (if not minimal) ======
        if (!minimal) {
          const addressPayload = mapKycToAddresses(formData, kyc, createdCardCode);
          if (addressPayload) {
            try {
              console.log('[SAP Push] Stage 2: Adding addresses...');
              await updateBusinessPartner(createdCardCode, addressPayload, cookies, agent);
              stageResults.stage2 = 'success';
              console.log('[SAP Push] Stage 2 complete. Addresses added.');
            } catch (addrErr) {
              console.warn('[SAP Push] Stage 2 (addresses) failed:', addrErr.message);
              stageResults.stage2 = `failed: ${addrErr.message}`;
            }
          } else {
            stageResults.stage2 = 'skipped (no addresses)';
          }
        }

        // ====== STAGE 3: PATCH in contacts (if not minimal) ======
        if (!minimal) {
          const contactPayload = mapKycToContacts(formData, kyc);
          if (contactPayload) {
            try {
              console.log('[SAP Push] Stage 3: Adding contacts...');
              await updateBusinessPartner(createdCardCode, contactPayload, cookies, agent);
              stageResults.stage3 = 'success';
              console.log('[SAP Push] Stage 3 complete. Contacts added.');
            } catch (ctErr) {
              console.warn('[SAP Push] Stage 3 (contacts) failed:', ctErr.message);
              stageResults.stage3 = `failed: ${ctErr.message}`;
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

      let hint;
      if (sapErr.isProxy || sapErr.message?.includes('502') || sapErr.message?.includes('Proxy')) {
        hint = 'SAP proxy returned 502. The Service Layer may be overloaded. Wait a minute and try again, or use Minimal first.';
      } else if (sapErr.message?.includes('Attachment') || sapErr.message?.includes('101')) {
        hint = 'SAP requires an attachment. The placeholder attachment may have failed. Check Attachments2 endpoint.';
      } else if (sapErr.message?.includes('socket hang up')) {
        hint = 'SAP dropped the connection. Try the Minimal button first.';
      } else if (sapErr.message?.includes('All BP creation strategies failed')) {
        hint = 'All connection strategies failed. Run the Deep Test to diagnose which strategy works.';
      } else if (sapErr.message?.includes('Series')) {
        hint = 'Series numbering error. Check SAP Document Numbering settings for Business Partners.';
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
        attachmentEntry,
        filesOnShare: filesWrittenToShare.length > 0 ? filesWrittenToShare.map(f => f.fullPath) : undefined,
        attachmentWarnings,
        stageResults,
        hint,
        durationMs: duration,
      }, { status: 502 });
    }

    // Success — store SAP details
    const duration = Date.now() - startTime;
    const cardCode = sapResult?.CardCode;
    const now = new Date().toISOString();

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
      details: `Business Partner ${cardCode} created as ${BP_TYPE_LABEL[bpType] || bpType}${attachmentEntry ? ` with attachment #${attachmentEntry}` : ''}${filesWrittenToShare.length > 0 ? ` (${filesWrittenToShare.length} file(s) on share)` : ''}${partialWarnings.length > 0 ? ` (${partialWarnings.join(', ')})` : ''}`,
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
      filesOnShare: filesWrittenToShare.length > 0 ? filesWrittenToShare.map(f => f.fullPath) : undefined,
      message: `Business Partner ${cardCode} created in SAP as ${BP_TYPE_LABEL[bpType] || bpType}${partialWarnings.length > 0 ? ` (note: ${partialWarnings.join(', ')})` : ''}${attachmentEntry ? ` with ${docs.length} document(s) attached` : ''}${!attachmentEntry && filesWrittenToShare.length > 0 ? ` (${filesWrittenToShare.length} file(s) saved to network share)` : ''}`,
    });
  } catch (err) {
    console.error('[SAP Push] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Failed to push to SAP' }, { status: 500 });
  }
}
