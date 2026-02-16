import { NextResponse } from 'next/server';
import { getKycByTokenHash, createKycDoc, updateKycStatus, createAuditEntry } from '@/lib/db';
import { uploadFile } from '@/lib/storage';
import { hashToken } from '@/lib/token';
import { isValidFileType, MAX_FILE_SIZE } from '@/lib/auth';

export async function POST(request, { params }) {
  try {
    const { token } = await params;
    const tokenH = hashToken(token);
    const kyc = await getKycByTokenHash(tokenH);

    if (!kyc) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }
    if (new Date(kyc.tokenExpiry) < new Date()) {
      return NextResponse.json({ error: 'This link has expired' }, { status: 410 });
    }
    if (!['Pending', 'Rejected'].includes(kyc.status)) {
      return NextResponse.json({ error: 'Documents already submitted' }, { status: 400 });
    }

    const formData = await request.formData();
    const files = formData.getAll('documents');
    const docTypesRaw = formData.get('docTypes');
    const docTypes = docTypesRaw ? JSON.parse(docTypesRaw) : files.map(() => 'Other');

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    const uploaded = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!isValidFileType(file.type)) {
        return NextResponse.json({ error: `Invalid file type: ${file.type}. Allowed: PDF, JPEG, PNG, WebP` }, { status: 400 });
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `File too large: ${file.name}. Max 10MB.` }, { status: 400 });
      }

      const docType = docTypes[i] || 'Other';
      const buffer = Buffer.from(await file.arrayBuffer());

      // Upload to Supabase Storage
      const { storagePath } = await uploadFile(buffer, file.name, file.type, kyc.id);

      // Record in kyc_docs table
      await createKycDoc({
        kycId: kyc.id,
        docType,
        storagePath,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      });

      uploaded.push({ docType, fileName: file.name });
    }

    // Update KYC status to Submitted
    await updateKycStatus(kyc.id, { status: 'Submitted', remarks: '' });

    await createAuditEntry({
      action: 'KYC_DOCUMENTS_SUBMITTED',
      actor: 'client',
      kycId: kyc.id,
      details: `${uploaded.length} documents uploaded`,
    });

    return NextResponse.json({ message: 'Documents uploaded successfully', files: uploaded });
  } catch (err) {
    console.error('Upload error:', err.message, err.stack);
    return NextResponse.json({ error: `Upload failed: ${err.message}` }, { status: 500 });
  }
}
