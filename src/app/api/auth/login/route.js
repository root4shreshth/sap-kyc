import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getUserByEmail, updateUser } from '@/lib/db';
import { getJwtSecret } from '@/lib/auth';

// Demo accounts always available for quick testing
function getDemoAccounts() {
  const accounts = {
    'admin@demo.com': { password: 'admin123', role: 'Admin' },
    'kyc@demo.com': { password: 'kyc123', role: 'KYC Team' },
  };
  if (process.env.ADMIN_EMAIL) {
    accounts[process.env.ADMIN_EMAIL] = { password: 'admin123', role: 'Admin' };
  }
  return accounts;
}

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Check demo accounts first
    const demo = getDemoAccounts()[email];
    if (demo && password === demo.password) {
      const token = jwt.sign({ email, role: demo.role }, getJwtSecret(), { expiresIn: '8h' });
      return NextResponse.json({ token, role: demo.role, email });
    }

    // Then check database users
    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (user.is_active === false) {
      return NextResponse.json({ error: 'Account deactivated. Contact admin.' }, { status: 403 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Update last login timestamp
    updateUser(user.id, { lastLoginAt: new Date().toISOString() }).catch(() => {});

    const token = jwt.sign({ email: user.email, role: user.role }, getJwtSecret(), { expiresIn: '8h' });
    return NextResponse.json({ token, role: user.role, email: user.email, name: user.name || '' });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
