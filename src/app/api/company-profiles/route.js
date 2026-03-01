import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAllCompanyProfiles, createCompanyProfile, ensureMigration } from '@/lib/db';

export async function GET(request) {
  const { user, error } = requireAuth(request);
  if (error) return error;

  try {
    await ensureMigration();
    const profiles = await getAllCompanyProfiles();
    return NextResponse.json(profiles);
  } catch (err) {
    console.error('List company profiles error:', err);
    // If table doesn't exist yet, return empty array gracefully
    if (err.message?.includes('does not exist')) {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: `Failed to fetch company profiles: ${err.message || 'Unknown error'}` }, { status: 500 });
  }
}

export async function POST(request) {
  const { user, error } = requireAuth(request, ['Admin']);
  if (error) return error;

  try {
    const body = await request.json();
    const { name, shortName, logoUrl, emailSenderName, address, phone, website, footerText, primaryColor, isDefault } = body;

    if (!name || !shortName || !emailSenderName) {
      return NextResponse.json({ error: 'name, shortName, emailSenderName are required' }, { status: 400 });
    }

    const profile = await createCompanyProfile({
      name, shortName, logoUrl, emailSenderName, address, phone, website, footerText, primaryColor, isDefault,
    });

    return NextResponse.json(profile);
  } catch (err) {
    console.error('Create company profile error:', err);
    const msg = err.message?.includes('does not exist')
      ? 'Company profiles table not found. Please run database setup first (POST /api/setup).'
      : `Failed to create company profile: ${err.message || 'Unknown error'}`;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
