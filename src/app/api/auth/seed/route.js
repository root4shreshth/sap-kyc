import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { SHEETS, getRows, appendRow } from '@/lib/sheets';
import { isValidEmail } from '@/lib/auth';

export async function POST(request) {
  try {
    const { email, password, role, seedSecret } = await request.json();

    if (seedSecret !== process.env.JWT_SECRET) {
      return NextResponse.json({ error: 'Invalid seed secret' }, { status: 403 });
    }
    if (!email || !password || !role) {
      return NextResponse.json({ error: 'email, password, role required' }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }
    if (!['Admin', 'KYC Team'].includes(role)) {
      return NextResponse.json({ error: 'Role must be Admin or KYC Team' }, { status: 400 });
    }

    const users = await getRows(SHEETS.USERS);
    if (users.find((u) => u.email === email)) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 12);
    await appendRow(SHEETS.USERS, [email, hash, role, new Date().toISOString()]);

    return NextResponse.json({ message: 'User created' });
  } catch (err) {
    console.error('Seed error:', err);
    return NextResponse.json({ error: 'Seed failed' }, { status: 500 });
  }
}
