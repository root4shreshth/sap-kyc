import { supabase } from './supabase';

const BUCKET = 'kyc-documents';

/**
 * Upload a file buffer to Supabase Storage.
 * Returns { storagePath, fileName }.
 */
export async function uploadFile(buffer, fileName, mimeType, kycId) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${kycId}/${Date.now()}_${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) throw error;
  return { storagePath, fileName };
}

/**
 * Download a file from Supabase Storage.
 * Returns { buffer, mimeType }.
 */
export async function downloadFile(storagePath) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(storagePath);

  if (error) throw error;

  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return { buffer, mimeType: data.type };
}

/**
 * Get file metadata from the kyc_docs table.
 */
export async function getFileMetadata(storagePath) {
  const { data, error } = await supabase
    .from('kyc_docs')
    .select('file_name, mime_type, file_size')
    .eq('storage_path', storagePath)
    .single();

  if (error) throw error;
  return {
    name: data.file_name,
    mimeType: data.mime_type,
    size: data.file_size,
  };
}

/**
 * Ensure the storage bucket exists. Called from setup route.
 */
export async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some(b => b.name === BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 10485760,
      allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    });
    if (error && !error.message?.includes('already exists')) throw error;
  }
}
