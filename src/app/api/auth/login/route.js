import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { SHEETS, getRows } from '@/lib/sheets';
import { getJwtSecret } from '@/lib/auth';

// Demo accounts always available for quick testing
const DEMO_ACCOUNTS = {
  'admin@demo.com': { password: 'admin123', role: 'Admin' },
  'kyc@demo.com': { password: 'kyc123', role: 'KYC Team' },
};

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Check demo accounts first
    const demo = DEMO_ACCOUNTS[email];
    if (demo && password === demo.password) {
      const token = jwt.sign(
        { email, role: demo.role },
        getJwtSecret(),
        { expiresIn: '8h' }
      );
      return NextResponse.json({ token, role: demo.role, email });
    }

    // Then check Google Sheets users
    const users = await getRows(SHEETS.USERS);
    const user = users.find((u) => u.email === email);
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = jwt.sign(
      { email: user.email, role: user.role },
      getJwtSecret(),
      { expiresIn: '8h' }
    );

    return NextResponse.json({ token, role: user.role, email: user.email });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
