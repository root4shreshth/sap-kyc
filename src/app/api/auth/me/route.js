import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserByEmail } from '@/lib/db';

export async function GET(request) {
  const { user, error } = requireAuth(request);
  if (error) return error;

  // Look up DB user for extra fields
  let name = '';
  let canSendKyc = false;
  try {
    const dbUser = await getUserByEmail(user.email);
    if (dbUser) {
      name = dbUser.name || '';
      canSendKyc = dbUser.can_send_kyc || false;
    }
  } catch {}

  return NextResponse.json({ email: user.email, role: user.role, name, canSendKyc });
}
