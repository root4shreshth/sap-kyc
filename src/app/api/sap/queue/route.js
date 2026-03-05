import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';

export async function GET(request) {
  const { error } = requireAuth(request, ['Admin']);
  if (error) return error;

  try {
    const supabase = getSupabase();

    // Get all approved KYCs (both synced and unsynced)
    const { data: kycList, error: kycErr } = await supabase
      .from('kyc')
      .select('*')
      .eq('status', 'Approved')
      .order('updated_at', { ascending: false });
    if (kycErr) throw kycErr;

    // Get form data summaries for all KYCs
    const kycIds = (kycList || []).map(k => k.id);
    let formDataMap = {};
    if (kycIds.length > 0) {
      const { data: forms, error: formErr } = await supabase
        .from('kyc_form')
        .select('kyc_id, bi_business_name, bi_country, bi_phone, bi_address, bi_city, bi_annual_sales, bi_years_in_business, bi_nature_of_business, bi_number_of_employees, cd_company_name, cd_trade_license_no, cd_vat_registration_no, cd_office_phone, cd_email, cd_company_address, cd_registered_office_address, mi_manager_name, mi_manager_email, mi_manager_phone, mi_ap_contact_name, mi_ap_contact_email, br_bank_name, br_contact_name, sm_linkedin')
        .in('kyc_id', kycIds);
      if (!formErr && forms) {
        forms.forEach(f => { formDataMap[f.kyc_id] = f; });
      }

      // Get banking checks
      const { data: bankData } = await supabase
        .from('kyc_banking_checks')
        .select('kyc_id, bank_name, branch, account_no, iban, swift')
        .in('kyc_id', kycIds)
        .order('sort_order', { ascending: true });
      if (bankData) {
        bankData.forEach(b => {
          if (!formDataMap[b.kyc_id]) formDataMap[b.kyc_id] = {};
          if (!formDataMap[b.kyc_id]._banks) formDataMap[b.kyc_id]._banks = [];
          formDataMap[b.kyc_id]._banks.push(b);
        });
      }

      // Get ownership
      const { data: ownerData } = await supabase
        .from('kyc_ownership_management')
        .select('kyc_id, name, designation, nationality, shareholding_percent, email, contact_no')
        .in('kyc_id', kycIds)
        .order('sort_order', { ascending: true });
      if (ownerData) {
        ownerData.forEach(o => {
          if (!formDataMap[o.kyc_id]) formDataMap[o.kyc_id] = {};
          if (!formDataMap[o.kyc_id]._owners) formDataMap[o.kyc_id]._owners = [];
          formDataMap[o.kyc_id]._owners.push(o);
        });
      }

      // Get warehouse addresses
      const { data: warehouseData } = await supabase
        .from('kyc_warehouse_addresses')
        .select('kyc_id, address')
        .in('kyc_id', kycIds)
        .order('sort_order', { ascending: true });
      if (warehouseData) {
        warehouseData.forEach(w => {
          if (!formDataMap[w.kyc_id]) formDataMap[w.kyc_id] = {};
          if (!formDataMap[w.kyc_id]._warehouses) formDataMap[w.kyc_id]._warehouses = [];
          formDataMap[w.kyc_id]._warehouses.push(w);
        });
      }
    }

    // Get document counts for each KYC
    let docCountMap = {};
    if (kycIds.length > 0) {
      const { data: docData } = await supabase
        .from('kyc_docs')
        .select('kyc_id, file_name, doc_type')
        .in('kyc_id', kycIds);
      if (docData) {
        docData.forEach(d => {
          if (!docCountMap[d.kyc_id]) docCountMap[d.kyc_id] = [];
          docCountMap[d.kyc_id].push({ fileName: d.file_name, docType: d.doc_type });
        });
      }
    }

    const result = (kycList || []).map(kyc => {
      const form = formDataMap[kyc.id] || {};
      const kycDocs = docCountMap[kyc.id] || [];
      return {
        id: kyc.id,
        clientName: kyc.client_name,
        companyName: kyc.company_name,
        email: kyc.email,
        phone: kyc.phone || '',
        sapCardCode: kyc.sap_card_code || '',
        sapBpType: kyc.sap_bp_type || '',
        sapSyncedAt: kyc.sap_synced_at || null,
        sapSyncError: kyc.sap_sync_error || '',
        approvedAt: kyc.updated_at,
        // Form data summary
        businessName: form.bi_business_name || kyc.company_name || '',
        country: form.bi_country || '',
        businessPhone: form.bi_phone || form.cd_office_phone || '',
        businessAddress: form.bi_address || form.cd_company_address || '',
        city: form.bi_city || '',
        annualSales: form.bi_annual_sales || '',
        yearsInBusiness: form.bi_years_in_business || '',
        natureOfBusiness: form.bi_nature_of_business || '',
        numberOfEmployees: form.bi_number_of_employees || '',
        tradeLicenseNo: form.cd_trade_license_no || '',
        vatRegistrationNo: form.cd_vat_registration_no || '',
        registeredOfficeAddress: form.cd_registered_office_address || '',
        companyEmail: form.cd_email || kyc.email || '',
        managerName: form.mi_manager_name || '',
        managerEmail: form.mi_manager_email || '',
        managerPhone: form.mi_manager_phone || '',
        apContactName: form.mi_ap_contact_name || '',
        apContactEmail: form.mi_ap_contact_email || '',
        bankName: form.br_bank_name || '',
        linkedin: form.sm_linkedin || '',
        // Arrays
        banks: (form._banks || []).map(b => ({
          bankName: b.bank_name, branch: b.branch, accountNo: b.account_no, iban: b.iban, swift: b.swift,
        })),
        owners: (form._owners || []).map(o => ({
          name: o.name, designation: o.designation, nationality: o.nationality,
          shareholding: o.shareholding_percent, email: o.email, phone: o.contact_no,
        })),
        warehouses: (form._warehouses || []).map(w => w.address).filter(Boolean),
        // Documents
        docsCount: kycDocs.length,
        docs: kycDocs,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('SAP queue error:', err);
    return NextResponse.json({ error: `Failed to load SAP queue: ${err.message}` }, { status: 500 });
  }
}
