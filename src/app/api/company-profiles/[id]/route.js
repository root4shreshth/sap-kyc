import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getCompanyProfileById, updateCompanyProfile } from '@/lib/db';

export async function GET(request, { params }) {
  const { user, error } = requireAuth(request);
  if (error) return error;

  try {
    const { id } = await params;
    const profile = await getCompanyProfileById(id);
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    return NextResponse.json(profile);
  } catch (err) {
    console.error('Get company profile error:', err);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const { user, error } = requireAuth(request, ['Admin']);
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    await updateCompanyProfile(id, body);
    const updated = await getCompanyProfileById(id);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('Update company profile error:', err);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
