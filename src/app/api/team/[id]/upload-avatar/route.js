import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { updateUser, ensureMigration } from '@/lib/db';
import { getSupabase } from '@/lib/supabase';

const BUCKET = 'kyc-documents';
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request, { params }) {
  const { user, error } = requireAuth(request, ['Admin']);
  if (error) return error;

  try {
    await ensureMigration();
    const { id } = await params;

    const formData = await request.formData();
    const file = formData.get('avatar');

    if (!file || !file.size) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPG, PNG, and WebP images are allowed' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File size must be under 2MB' }, { status: 400 });
    }

    const supabase = getSupabase();
    const ext = file.name?.split('.').pop() || 'jpg';
    const storagePath = `avatars/${id}_${Date.now()}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) throw uploadErr;

    // Get public URL
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const avatarUrl = urlData?.publicUrl || '';

    // Save to user record
    await updateUser(id, { avatarUrl });

    return NextResponse.json({ avatarUrl, message: 'Avatar uploaded successfully' });
  } catch (err) {
    console.error('Upload avatar error:', err);
    return NextResponse.json({ error: `Failed to upload avatar: ${err.message || 'Unknown error'}` }, { status: 500 });
  }
}
