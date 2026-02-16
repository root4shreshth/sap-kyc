import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { downloadFile, getFileMetadata } from '@/lib/storage';

export async function GET(request, { params }) {
  const { error } = requireAuth(request, ['Admin', 'KYC Team']);
  if (error) return error;

  try {
    const { fileId } = await params;
    // fileId is an array of path segments due to catch-all route
    const storagePath = Array.isArray(fileId) ? fileId.join('/') : fileId;

    const meta = await getFileMetadata(storagePath);
    const { buffer } = await downloadFile(storagePath);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': meta.mimeType,
        'Content-Disposition': `attachment; filename="${meta.name}"`,
      },
    });
  } catch (err) {
    console.error('Download error:', err);
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 });
  }
}
