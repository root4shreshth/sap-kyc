import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getKycById, getKycFormData } from '@/lib/db';
import { mapKycToBusinessPartner, validateForSapPush } from '@/lib/sap-mapping';

export async function GET(request, { params }) {
  const { error } = requireAuth(request, ['Admin']);
  if (error) return error;

  try {
    const { id } = await params;

    const kyc = await getKycById(id);
    if (!kyc) {
      return NextResponse.json({ error: 'KYC not found' }, { status: 404 });
    }

    const formData = await getKycFormData(id);
    if (!formData) {
      return NextResponse.json({ error: 'No form data found' }, { status: 404 });
    }

    const validation = validateForSapPush(formData);

    // Generate mappings for both types
    const customerMapping = mapKycToBusinessPartner(formData, kyc, 'customer');
    const vendorMapping = mapKycToBusinessPartner(formData, kyc, 'vendor');

    return NextResponse.json({
      kycId: id,
      companyName: kyc.companyName,
      kycStatus: kyc.status,
      validation,
      customerMapping,
      vendorMapping,
    });
  } catch (err) {
    console.error('Field mapping error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
