import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { updateCompanyProfile } from '@/lib/db';
import { uploadLogo, getPublicUrl } from '@/lib/storage';

const MAX_LOGO_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

export async function POST(request, { params }) {
  const { user, error } = requireAuth(request, ['Admin']);
  if (error) return error;

  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get('logo');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG, WebP, SVG images allowed' }, { status: 400 });
    }

    if (file.size > MAX_LOGO_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 5MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { storagePath } = await uploadLogo(buffer, file.name, file.type, id);
    const logoUrl = getPublicUrl(storagePath);

    // Update company profile with new logo URL
    await updateCompanyProfile(id, { logoUrl });

    return NextResponse.json({ logoUrl, message: 'Logo uploaded successfully' });
  } catch (err) {
    console.error('Logo upload error:', err);
    return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 });
  }
}
