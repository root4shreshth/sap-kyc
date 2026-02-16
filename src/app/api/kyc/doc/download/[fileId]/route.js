import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getFileStream, getFileMetadata } from '@/lib/drive';

export async function GET(request, { params }) {
  const { error } = requireAuth(request, ['Admin', 'KYC Team']);
  if (error) return error;

  try {
    const { fileId } = await params;
    const meta = await getFileMetadata(fileId);
    const stream = await getFileStream(fileId);

    // Collect stream into buffer for Next.js Response
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

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
