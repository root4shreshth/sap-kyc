import { google } from 'googleapis';
import { Readable } from 'stream';
import { getAuth } from './google-auth';
import { isDemoMode } from './demo-store';
import fs from 'fs/promises';
import path from 'path';

// In-memory file store for demo mode
const demoFiles = new Map();

// Local uploads directory (fallback when Google Drive quota fails)
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

async function ensureUploadsDir() {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  } catch { /* dir exists */ }
}

function getDrive() {
  return google.drive({ version: 'v3', auth: getAuth() });
}

export async function uploadFile(buffer, fileName, mimeType) {
  if (isDemoMode()) {
    const fileId = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    demoFiles.set(fileId, { buffer, fileName, mimeType });
    console.log(`[DEMO] File stored in memory: ${fileName} (${fileId})`);
    return { fileId, fileName };
  }

  // Try Google Drive first
  try {
    const drive = getDrive();
    const res = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [process.env.KYC_DRIVE_FOLDER_ID],
      },
      media: {
        mimeType,
        body: Readable.from(buffer),
      },
      fields: 'id, name',
      supportsAllDrives: true,
    });
    return { fileId: res.data.id, fileName: res.data.name };
  } catch (driveErr) {
    // If quota error, fall back to local storage
    if (driveErr.message && driveErr.message.includes('storage quota')) {
      console.log('[DRIVE] Quota exceeded — falling back to local file storage');
      return uploadFileLocal(buffer, fileName, mimeType);
    }
    throw driveErr;
  }
}

async function uploadFileLocal(buffer, fileName, mimeType) {
  await ensureUploadsDir();
  const fileId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = path.join(UPLOADS_DIR, `${fileId}_${safeName}`);

  // Save file
  await fs.writeFile(filePath, buffer);

  // Save metadata alongside
  await fs.writeFile(`${filePath}.meta.json`, JSON.stringify({
    id: fileId,
    originalName: fileName,
    mimeType,
    size: buffer.length,
    savedAt: new Date().toISOString(),
  }));

  console.log(`[LOCAL] File saved: ${filePath}`);
  return { fileId, fileName };
}

export async function getFileStream(fileId) {
  if (isDemoMode()) {
    const file = demoFiles.get(fileId);
    if (!file) throw new Error('File not found in demo store');
    return Readable.from(file.buffer);
  }

  // Check if it's a local file
  if (fileId.startsWith('local-')) {
    const buffer = await getLocalFileBuffer(fileId);
    return Readable.from(buffer);
  }

  const drive = getDrive();
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  );
  return res.data;
}

export async function getFileMetadata(fileId) {
  if (isDemoMode()) {
    const file = demoFiles.get(fileId);
    if (!file) throw new Error('File not found in demo store');
    return { id: fileId, name: file.fileName, mimeType: file.mimeType, size: file.buffer.length };
  }

  // Check if it's a local file
  if (fileId.startsWith('local-')) {
    return getLocalFileMeta(fileId);
  }

  const drive = getDrive();
  const res = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size',
    supportsAllDrives: true,
  });
  return res.data;
}

// --- Local file helpers ---

async function findLocalFile(fileId) {
  await ensureUploadsDir();
  const files = await fs.readdir(UPLOADS_DIR);
  const match = files.find((f) => f.startsWith(fileId) && !f.endsWith('.meta.json'));
  if (!match) throw new Error(`File not found: ${fileId}`);
  return path.join(UPLOADS_DIR, match);
}

async function getLocalFileBuffer(fileId) {
  const filePath = await findLocalFile(fileId);
  return fs.readFile(filePath);
}

async function getLocalFileMeta(fileId) {
  const filePath = await findLocalFile(fileId);
  try {
    const metaRaw = await fs.readFile(`${filePath}.meta.json`, 'utf-8');
    const meta = JSON.parse(metaRaw);
    return { id: fileId, name: meta.originalName, mimeType: meta.mimeType, size: meta.size };
  } catch {
    // Fallback if meta file missing
    const stat = await fs.stat(filePath);
    return { id: fileId, name: path.basename(filePath), mimeType: 'application/octet-stream', size: stat.size };
  }
}
