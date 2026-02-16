import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { SHEETS, getRows, findRowIndex, updateRow, appendRow } from '@/lib/sheets';
import { sendStatusUpdate } from '@/lib/email';

export async function PATCH(request, { params }) {
  const { user, error } = requireAuth(request, ['Admin', 'KYC Team']);
  if (error) return error;

  try {
    const { id } = await params;
    const { status, remarks } = await request.json();
    const validStatuses = ['Under Review', 'Approved', 'Rejected'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Status must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    const rowIndex = await findRowIndex(SHEETS.KYC, 0, id);
    if (rowIndex === -1) {
      return NextResponse.json({ error: 'KYC request not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    // Columns: G=status, H=remarks, K=updatedAt
    await updateRow(SHEETS.KYC, rowIndex, { G: status, H: remarks || '', K: now });

    await appendRow(SHEETS.AUDIT, [now, `KYC_STATUS_${status.toUpperCase().replace(' ', '_')}`, user.email, id, remarks || '']);

    if (status === 'Approved' || status === 'Rejected') {
      const rows = await getRows(SHEETS.KYC);
      const kyc = rows.find((r) => r.id === id);
      if (kyc) {
        await sendStatusUpdate({
          to: kyc.email,
          clientName: kyc.clientName,
          companyName: kyc.companyName,
          status,
          remarks: remarks || '',
        });
      }
    }

    return NextResponse.json({ message: `Status updated to ${status}` });
  } catch (err) {
    console.error('Status update error:', err);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
