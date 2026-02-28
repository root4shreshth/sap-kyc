import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAuth, isValidEmail } from '@/lib/auth';
import { getAllUsers, createUser, createAuditEntry, getTeamStats } from '@/lib/db';

export async function GET(request) {
  const { user, error } = requireAuth(request, ['Admin']);
  if (error) return error;

  try {
    const [users, stats] = await Promise.all([getAllUsers(), getTeamStats()]);

    // Merge stats into user records
    const enriched = users.map(u => {
      const s = stats.find(st => st.email === u.email) || {};
      return {
        ...u,
        kycCreated: s.kycCreated || 0,
        kycApproved: s.kycApproved || 0,
        kycRejected: s.kycRejected || 0,
        lastAction: s.lastAction || null,
      };
    });

    return NextResponse.json(enriched);
  } catch (err) {
    console.error('List team error:', err);
    return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 });
  }
}

export async function POST(request) {
  const { user, error } = requireAuth(request, ['Admin']);
  if (error) return error;

  try {
    const { name, email, password, role, canSendKyc } = await request.json();

    if (!email || !password || !role) {
      return NextResponse.json({ error: 'email, password, role required' }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }
    if (!['Admin', 'KYC Team'].includes(role)) {
      return NextResponse.json({ error: 'Role must be Admin or KYC Team' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await createUser({
      email, passwordHash, role,
      name: name || '',
      canSendKyc: canSendKyc || false,
      createdByAdmin: user.email,
    });

    await createAuditEntry({
      action: 'TEAM_MEMBER_CREATED',
      actor: user.email,
      details: `Created ${role} member: ${email} (${name || 'no name'})`,
    });

    return NextResponse.json({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      message: 'Team member created successfully',
    });
  } catch (err) {
    if (err.code === '23505') {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
    }
    console.error('Create team member error:', err);
    return NextResponse.json({ error: 'Failed to create team member' }, { status: 500 });
  }
}
