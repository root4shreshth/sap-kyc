import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

export function getJwtSecret() {
  return process.env.JWT_SECRET || 'demo-secret-not-for-production';
}

export function verifyAuth(request) {
  const header = request.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  try {
    return jwt.verify(header.slice(7), getJwtSecret());
  } catch {
    return null;
  }
}

export function requireAuth(request, roles) {
  const user = verifyAuth(request);
  if (!user) {
    return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };
  }
  if (roles && !roles.includes(user.role)) {
    return { error: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }) };
  }
  return { user };
}

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function isValidFileType(mimeType) {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export { MAX_FILE_SIZE, ALLOWED_MIME_TYPES };
