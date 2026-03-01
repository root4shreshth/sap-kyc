import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAuth } from '@/lib/auth';
import { getUserById, updateUser, getUserActivity, getTeamStats, createAuditEntry, ensureMigration, isMigrationNeeded, getMigrationSql } from '@/lib/db';

export async function GET(request, { params }) {
  const { user, error } = requireAuth(request, ['Admin']);
  if (error) return error;

  try {
    await ensureMigration();
    const { id } = await params;
    const member = await getUserById(id);
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    // Fetch activity + performance stats in parallel
    const [activity, allStats] = await Promise.all([
      getUserActivity(member.email, 30),
      getTeamStats(),
    ]);

    // Find this member's stats
    const stats = allStats.find(s => s.email === member.email) || {};

    const response = {
      ...member,
      activity,
      kycCreated: stats.kycCreated || 0,
      kycApproved: stats.kycApproved || 0,
      kycRejected: stats.kycRejected || 0,
      lastAction: stats.lastAction || null,
    };

    if (isMigrationNeeded()) {
      response.migrationNeeded = true;
      response.migrationSql = getMigrationSql();
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error('Get team member error:', err);
    return NextResponse.json({ error: `Failed to fetch member: ${err.message || 'Unknown error'}` }, { status: 500 });
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
    // Employee profile fields
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.designation !== undefined) updates.designation = body.designation;
    if (body.department !== undefined) updates.department = body.department;
    if (body.employeeId !== undefined) updates.employeeId = body.employeeId;
    if (body.dateOfJoining !== undefined) updates.dateOfJoining = body.dateOfJoining;
    if (body.address !== undefined) updates.address = body.address;
    if (body.emergencyContactName !== undefined) updates.emergencyContactName = body.emergencyContactName;
    if (body.emergencyContactPhone !== undefined) updates.emergencyContactPhone = body.emergencyContactPhone;
    if (body.notes !== undefined) updates.notes = body.notes;

    await updateUser(id, updates);

    await createAuditEntry({
      action: 'TEAM_MEMBER_UPDATED',
      actor: user.email,
      details: `Updated member #${id}: ${Object.keys(updates).join(', ')}`,
    });

    return NextResponse.json({ message: 'Member updated' });
  } catch (err) {
    console.error('Update team member error:', err);
    return NextResponse.json({ error: `Failed to update member: ${err.message || 'Unknown error'}` }, { status: 500 });
  }
}
