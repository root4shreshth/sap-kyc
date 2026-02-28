import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAuth } from '@/lib/auth';
import { getUserById, updateUser, getUserActivity, createAuditEntry } from '@/lib/db';

export async function GET(request, { params }) {
  const { user, error } = requireAuth(request, ['Admin']);
  if (error) return error;

  try {
    const { id } = await params;
    const member = await getUserById(id);
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    const activity = await getUserActivity(member.email, 30);

    return NextResponse.json({ ...member, activity });
  } catch (err) {
    console.error('Get team member error:', err);
    return NextResponse.json({ error: 'Failed to fetch member' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const { user, error } = requireAuth(request, ['Admin']);
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const updates = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.role !== undefined) {
      if (!['Admin', 'KYC Team'].includes(body.role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      updates.role = body.role;
    }
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    if (body.canSendKyc !== undefined) updates.canSendKyc = body.canSendKyc;
    if (body.password) {
      if (body.password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      }
      updates.passwordHash = await bcrypt.hash(body.password, 10);
    }

    await updateUser(id, updates);

    await createAuditEntry({
      action: 'TEAM_MEMBER_UPDATED',
      actor: user.email,
      details: `Updated member #${id}: ${Object.keys(updates).join(', ')}`,
    });

    return NextResponse.json({ message: 'Member updated' });
  } catch (err) {
    console.error('Update team member error:', err);
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }
}
