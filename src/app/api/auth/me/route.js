import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request) {
  const { user, error } = requireAuth(request);
  if (error) return error;
  return NextResponse.json({ email: user.email, role: user.role });
}
