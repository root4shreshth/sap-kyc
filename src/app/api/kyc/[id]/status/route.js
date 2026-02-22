import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { updateKycStatus, getKycById, createAuditEntry } from '@/lib/db';
import { sendStatusUpdate } from '@/lib/email';

export async function PATCH(request, { params }) {
  const { user, error } = requireAuth(request, ['Admin', 'KYC Team']);
  if (error) return error;

  try {
    const { id } = await params;
    const { status, remarks, pepStatus, pepDetails } = await request.json();
    const validStatuses = ['Under Review', 'Approved', 'Rejected'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Status must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    const kyc = await getKycById(id);
    if (!kyc) {
      return NextResponse.json({ error: 'KYC request not found' }, { status: 404 });
    }

    await updateKycStatus(id, { status, remarks, pepStatus, pepDetails });

    await createAuditEntry({
      action: `KYC_STATUS_${status.toUpperCase().replace(' ', '_')}`,
      actor: user.email,
      kycId: id,
      details: remarks || '',
    });

    if (status === 'Approved' || status === 'Rejected') {
      await sendStatusUpdate({
        to: kyc.email,
        clientName: kyc.clientName,
        companyName: kyc.companyName,
        status,
        remarks: remarks || '',
      });
    }

    return NextResponse.json({ message: `Status updated to ${status}` });
  } catch (err) {
    console.error('Status update error:', err);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
