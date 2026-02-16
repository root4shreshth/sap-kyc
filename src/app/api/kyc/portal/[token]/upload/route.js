import { NextResponse } from 'next/server';
import { SHEETS, getRows, findRowIndex, updateRow, appendRow } from '@/lib/sheets';
import { uploadFile } from '@/lib/drive';
import { hashToken } from '@/lib/token';
import { isValidFileType, MAX_FILE_SIZE } from '@/lib/auth';

export async function POST(request, { params }) {
  try {
    const { token } = await params;
    const tokenH = hashToken(token);
    const rows = await getRows(SHEETS.KYC);
    const kyc = rows.find((r) => r.tokenHash === tokenH);

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

    const now = new Date().toISOString();
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
      const safeName = `${kyc.id}_${docType}_${Date.now()}_${file.name}`;

      const driveResult = await uploadFile(buffer, safeName, file.type);

      // KYC_Docs columns: kycId | docType | driveFileId | fileName | uploadedAt
      await appendRow(SHEETS.KYC_DOCS, [kyc.id, docType, driveResult.fileId, file.name, now]);
      uploaded.push({ docType, fileName: file.name });
    }

    // Update KYC status to Submitted
    const rowIndex = await findRowIndex(SHEETS.KYC, 0, kyc.id);
    if (rowIndex !== -1) {
      await updateRow(SHEETS.KYC, rowIndex, { G: 'Submitted', K: now });
    }

    await appendRow(SHEETS.AUDIT, [now, 'KYC_DOCUMENTS_SUBMITTED', 'client', kyc.id, `${uploaded.length} documents uploaded`]);

    return NextResponse.json({ message: 'Documents uploaded successfully', files: uploaded });
  } catch (err) {
    console.error('Upload error:', err.message, err.stack);
    return NextResponse.json({ error: `Upload failed: ${err.message}` }, { status: 500 });
  }
}
