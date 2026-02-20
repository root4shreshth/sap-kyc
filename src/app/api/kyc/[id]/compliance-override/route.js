import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { updateComplianceOverride, createAuditEntry } from '@/lib/db';

export async function PATCH(request, { params }) {
  const { error: authError, user } = requireAuth(request, ['Admin', 'KYC Team']);
  if (authError) return authError;

  try {
    const { id } = await params;
    const { checkKey, adminOverride, adminNotes } = await request.json();

    if (!checkKey) {
      return NextResponse.json({ error: 'checkKey is required' }, { status: 400 });
    }

    const validStatuses = ['pass', 'fail', 'warning', 'not_applicable', null];
    if (!validStatuses.includes(adminOverride)) {
      return NextResponse.json({ error: 'Invalid override status' }, { status: 400 });
    }

    await updateComplianceOverride(id, checkKey, {
      adminOverride,
      adminNotes: adminNotes || '',
      updatedBy: user.email,
    });

    await createAuditEntry({
      action: 'COMPLIANCE_OVERRIDE',
      actor: user.email,
      kycId: id,
      details: `${checkKey}: ${adminOverride || 'cleared'} — ${adminNotes || 'no notes'}`,
    });

    return NextResponse.json({ message: 'Override saved' });
  } catch (err) {
    console.error('Compliance override error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
