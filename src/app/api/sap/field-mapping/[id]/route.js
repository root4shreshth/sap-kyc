import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getKycById, getKycFormData } from '@/lib/db';
import { mapKycToBusinessPartner, mapKycToMinimalBusinessPartner, mapKycToAddresses, mapKycToContacts, validateForSapPush } from '@/lib/sap-mapping';

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

    // Show exactly what each stage would send to SAP
    // Note: mapKycToAddresses needs a cardCode (from SAP), using placeholder for preview
    const customerPayloads = {
      stage1_create: mapKycToBusinessPartner(formData, kyc, 'customer'),
      stage2_addresses: mapKycToAddresses(formData, kyc, 'PREVIEW_CODE'),
      stage3_contacts: mapKycToContacts(formData, kyc),
      minimal: mapKycToMinimalBusinessPartner(formData, kyc, 'customer'),
    };

    const vendorPayloads = {
      stage1_create: mapKycToBusinessPartner(formData, kyc, 'vendor'),
      stage2_addresses: mapKycToAddresses(formData, kyc, 'PREVIEW_CODE'),
      stage3_contacts: mapKycToContacts(formData, kyc),
      minimal: mapKycToMinimalBusinessPartner(formData, kyc, 'vendor'),
    };

    const leadPayloads = {
      stage1_create: mapKycToBusinessPartner(formData, kyc, 'lead'),
      stage2_addresses: mapKycToAddresses(formData, kyc, 'PREVIEW_CODE'),
      stage3_contacts: mapKycToContacts(formData, kyc),
      minimal: mapKycToMinimalBusinessPartner(formData, kyc, 'lead'),
    };

    return NextResponse.json({
      kycId: id,
      companyName: kyc.companyName,
      kycStatus: kyc.status,
      validation,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Prefer: 'odata.maxpagesize=0',
        'B1S-ReplaceCollectionsOnPatch': 'true',
        Cookie: 'B1SESSION=<from-login>; ROUTEID=<from-login>',
      },
      customer: customerPayloads,
      vendor: vendorPayloads,
      lead: leadPayloads,
      rawFormData: formData,
    });
  } catch (err) {
    console.error('Field mapping error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
