import { getSupabase } from './supabase';
import { syncKycToSheet, syncFormDataToSheet, syncComplianceToSheet, syncDocToSheet, syncAuditToSheet } from './google-sheets';

// ==================== AUTO-MIGRATION ====================
// Attempts to add missing columns/tables on first call. Runs once per server lifecycle.

let _migrationAttempted = false;

const MIGRATION_SQL = [
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT DEFAULT ''",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_send_kyc BOOLEAN DEFAULT FALSE",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by_admin TEXT DEFAULT ''",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ",
  "ALTER TABLE kyc ADD COLUMN IF NOT EXISTS company_profile_id UUID",
  "ALTER TABLE kyc ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT ''",
  "ALTER TABLE kyc ADD COLUMN IF NOT EXISTS phone_country_code TEXT DEFAULT ''",
];

const NEW_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS company_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, short_name TEXT NOT NULL, logo_url TEXT DEFAULT '',
  email_sender_name TEXT NOT NULL, address TEXT DEFAULT '', phone TEXT DEFAULT '',
  website TEXT DEFAULT '', footer_text TEXT DEFAULT '', primary_color TEXT DEFAULT '#2563eb',
  is_default BOOLEAN DEFAULT FALSE, is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_id UUID, channel TEXT NOT NULL, recipient TEXT NOT NULL,
  message_type TEXT NOT NULL, status TEXT DEFAULT 'sent', error_message TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

export async function ensureMigration() {
  if (_migrationAttempted) return;
  _migrationAttempted = true;

  try {
    const supabase = getSupabase();
    // Quick check: try selecting an optional column
    const { error: testErr } = await supabase.from('users').select('name').limit(0);
    if (!testErr) return; // columns exist, no migration needed

    console.log('Auto-migration: detected missing columns, attempting migration via exec_sql...');

    // Try creating new tables first
    await supabase.rpc('exec_sql', { query: NEW_TABLES_SQL }).catch(() => {});

    // Then add columns
    for (const sql of MIGRATION_SQL) {
      await supabase.rpc('exec_sql', { query: sql }).catch(() => {});
    }

    console.log('Auto-migration: done.');
  } catch (err) {
    console.warn('Auto-migration: could not run automatically.', err.message);
  }
}

// ==================== USERS ====================

export async function getUserByEmail(email) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createUser({ email, passwordHash, role, name, canSendKyc, createdByAdmin }) {
  const supabase = getSupabase();
  const insertData = { email, password_hash: passwordHash, role };
  if (name !== undefined) insertData.name = name;
  if (canSendKyc !== undefined) insertData.can_send_kyc = canSendKyc;
  if (createdByAdmin !== undefined) insertData.created_by_admin = createdByAdmin;
  const { data, error } = await supabase
    .from('users')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    // If error is about unknown columns (DB not migrated), retry with core columns only
    const isColumnError = error.message?.includes('column') || error.code === 'PGRST204' || error.code === '42703';
    if (isColumnError) {
      console.warn('createUser: optional columns missing, falling back to core columns only. Run POST /api/setup to migrate.');
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from('users')
        .insert({ email, password_hash: passwordHash, role })
        .select()
        .single();
      if (fallbackErr) throw fallbackErr;
      return fallbackData;
    }
    throw error;
  }
  return data;
}

export async function getAllUsers() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    email: row.email,
    name: row.name || '',
    role: row.role,
    isActive: row.is_active !== false,
    canSendKyc: row.can_send_kyc || false,
    createdByAdmin: row.created_by_admin || '',
    lastLoginAt: row.last_login_at || null,
    createdAt: row.created_at,
  }));
}

export async function getUserById(id) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return null;
  return {
    id: data.id,
    email: data.email,
    name: data.name || '',
    role: data.role,
    isActive: data.is_active !== false,
    canSendKyc: data.can_send_kyc || false,
    createdByAdmin: data.created_by_admin || '',
    lastLoginAt: data.last_login_at || null,
    createdAt: data.created_at,
  };
}

export async function updateUser(id, fields) {
  const supabase = getSupabase();
  const updateData = {};
  if (fields.name !== undefined) updateData.name = fields.name;
  if (fields.role !== undefined) updateData.role = fields.role;
  if (fields.isActive !== undefined) updateData.is_active = fields.isActive;
  if (fields.canSendKyc !== undefined) updateData.can_send_kyc = fields.canSendKyc;
  if (fields.passwordHash !== undefined) updateData.password_hash = fields.passwordHash;
  if (fields.lastLoginAt !== undefined) updateData.last_login_at = fields.lastLoginAt;

  if (Object.keys(updateData).length === 0) return;

  const { error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', id);

  if (error) {
    // If columns don't exist (DB not migrated), retry with only core columns
    const isColumnError = error.message?.includes('column') || error.code === 'PGRST204' || error.code === '42703';
    if (isColumnError) {
      console.warn('updateUser: optional columns missing, falling back to core columns only.');
      const coreData = {};
      if (fields.role !== undefined) coreData.role = fields.role;
      if (fields.passwordHash !== undefined) coreData.password_hash = fields.passwordHash;
      if (Object.keys(coreData).length === 0) return; // nothing to update with core columns
      const { error: fallbackErr } = await supabase.from('users').update(coreData).eq('id', id);
      if (fallbackErr) throw fallbackErr;
      return;
    }
    throw error;
  }
}

export async function getUserActivity(email, limit = 20) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('actor', email)
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(row => ({
    action: row.action,
    kycId: row.kyc_id,
    details: row.details,
    timestamp: row.timestamp,
  }));
}

export async function getTeamStats() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('audit_log')
    .select('actor, action, details, timestamp')
    .order('timestamp', { ascending: false });
  if (error) throw error;

  const statsMap = {};
  (data || []).forEach(row => {
    if (!statsMap[row.actor]) {
      statsMap[row.actor] = { email: row.actor, kycCreated: 0, kycApproved: 0, kycRejected: 0, lastAction: row.timestamp };
    }
    if (row.action === 'KYC_CREATED') statsMap[row.actor].kycCreated++;
    // Match actual audit action names: KYC_STATUS_APPROVED, KYC_STATUS_REJECTED
    if (row.action === 'KYC_STATUS_APPROVED') statsMap[row.actor].kycApproved++;
    if (row.action === 'KYC_STATUS_REJECTED') statsMap[row.actor].kycRejected++;
    // Also match legacy format just in case
    if (row.action === 'STATUS_CHANGED' && row.details?.includes?.('Approved')) statsMap[row.actor].kycApproved++;
    if (row.action === 'STATUS_CHANGED' && row.details?.includes?.('Rejected')) statsMap[row.actor].kycRejected++;
  });

  return Object.values(statsMap);
}

// ==================== COMPANY PROFILES ====================

export async function getAllCompanyProfiles() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('company_profiles')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    logoUrl: row.logo_url || '',
    emailSenderName: row.email_sender_name,
    address: row.address || '',
    phone: row.phone || '',
    website: row.website || '',
    footerText: row.footer_text || '',
    primaryColor: row.primary_color || '#2563eb',
    isDefault: row.is_default || false,
    createdAt: row.created_at,
  }));
}

export async function getCompanyProfileById(id) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('company_profiles')
    .select('*')
    .eq('id', id)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    shortName: data.short_name,
    logoUrl: data.logo_url || '',
    emailSenderName: data.email_sender_name,
    address: data.address || '',
    phone: data.phone || '',
    website: data.website || '',
    footerText: data.footer_text || '',
    primaryColor: data.primary_color || '#2563eb',
    isDefault: data.is_default || false,
    createdAt: data.created_at,
  };
}

export async function createCompanyProfile({ name, shortName, logoUrl, emailSenderName, address, phone, website, footerText, primaryColor, isDefault }) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('company_profiles')
    .insert({
      name,
      short_name: shortName,
      logo_url: logoUrl || '',
      email_sender_name: emailSenderName,
      address: address || '',
      phone: phone || '',
      website: website || '',
      footer_text: footerText || '',
      primary_color: primaryColor || '#2563eb',
      is_default: isDefault || false,
    })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id, name: data.name, shortName: data.short_name };
}

export async function updateCompanyProfile(id, fields) {
  const supabase = getSupabase();
  const updateData = { updated_at: new Date().toISOString() };
  if (fields.name !== undefined) updateData.name = fields.name;
  if (fields.shortName !== undefined) updateData.short_name = fields.shortName;
  if (fields.logoUrl !== undefined) updateData.logo_url = fields.logoUrl;
  if (fields.emailSenderName !== undefined) updateData.email_sender_name = fields.emailSenderName;
  if (fields.address !== undefined) updateData.address = fields.address;
  if (fields.phone !== undefined) updateData.phone = fields.phone;
  if (fields.website !== undefined) updateData.website = fields.website;
  if (fields.footerText !== undefined) updateData.footer_text = fields.footerText;
  if (fields.primaryColor !== undefined) updateData.primary_color = fields.primaryColor;
  if (fields.isDefault !== undefined) updateData.is_default = fields.isDefault;
  if (fields.isActive !== undefined) updateData.is_active = fields.isActive;
  const { error } = await supabase
    .from('company_profiles')
    .update(updateData)
    .eq('id', id);
  if (error) throw error;
}

// ==================== KYC ====================

export async function createKyc({ id, clientName, companyName, email, tokenHash, tokenExpiry, status, remarks, createdBy, companyProfileId, phone, phoneCountryCode }) {
  const supabase = getSupabase();
  const insertData = {
    id,
    client_name: clientName,
    company_name: companyName,
    email,
    token_hash: tokenHash,
    token_expiry: tokenExpiry,
    status: status || 'Pending',
    remarks: remarks || '',
    created_by: createdBy,
  };
  if (companyProfileId) insertData.company_profile_id = companyProfileId;
  if (phone) insertData.phone = phone;
  if (phoneCountryCode) insertData.phone_country_code = phoneCountryCode;
  const { data, error } = await supabase
    .from('kyc')
    .insert(insertData)
    .select()
    .single();
  if (error) throw error;

  // Sync to Google Sheets (fire-and-forget)
  syncKycToSheet({ id, clientName, companyName, email, status: status || 'Pending', remarks: remarks || '', createdBy, createdAt: data.created_at, updatedAt: data.updated_at }).catch(() => {});

  return data;
}

export async function getAllKyc() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('kyc')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    clientName: row.client_name,
    companyName: row.company_name,
    email: row.email,
    status: row.status,
    remarks: row.remarks,
    pepStatus: row.pep_status || '',
    pepDetails: row.pep_details || '',
    sapCardCode: row.sap_card_code || '',
    sapBpType: row.sap_bp_type || '',
    sapSyncedAt: row.sap_synced_at || null,
    sapSyncError: row.sap_sync_error || '',
    companyProfileId: row.company_profile_id || null,
    phone: row.phone || '',
    phoneCountryCode: row.phone_country_code || '',
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getKycByTokenHash(tokenHash) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('kyc')
    .select('*')
    .eq('token_hash', tokenHash)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return null;
  return {
    id: data.id,
    clientName: data.client_name,
    companyName: data.company_name,
    email: data.email,
    tokenHash: data.token_hash,
    tokenExpiry: data.token_expiry,
    status: data.status,
    remarks: data.remarks,
    companyProfileId: data.company_profile_id || null,
    phone: data.phone || '',
    phoneCountryCode: data.phone_country_code || '',
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getKycById(id) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('kyc')
    .select('*')
    .eq('id', id)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return null;
  return {
    id: data.id,
    clientName: data.client_name,
    companyName: data.company_name,
    email: data.email,
    tokenHash: data.token_hash,
    tokenExpiry: data.token_expiry,
    status: data.status,
    remarks: data.remarks,
    pepStatus: data.pep_status || '',
    pepDetails: data.pep_details || '',
    sapCardCode: data.sap_card_code || '',
    sapBpType: data.sap_bp_type || '',
    sapSyncedAt: data.sap_synced_at || null,
    sapSyncError: data.sap_sync_error || '',
    companyProfileId: data.company_profile_id || null,
    phone: data.phone || '',
    phoneCountryCode: data.phone_country_code || '',
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updateKycSapStatus(id, { sapCardCode, sapBpType, sapSyncedAt, sapSyncError }) {
  const supabase = getSupabase();
  const updateData = { updated_at: new Date().toISOString() };
  if (sapCardCode !== undefined) updateData.sap_card_code = sapCardCode;
  if (sapBpType !== undefined) updateData.sap_bp_type = sapBpType;
  if (sapSyncedAt !== undefined) updateData.sap_synced_at = sapSyncedAt;
  if (sapSyncError !== undefined) updateData.sap_sync_error = sapSyncError;
  const { error } = await supabase
    .from('kyc')
    .update(updateData)
    .eq('id', id);
  if (error) throw error;
}

export async function updateKycStatus(id, { status, remarks, pepStatus, pepDetails }) {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const updateData = {
    status,
    remarks: remarks !== undefined ? remarks : '',
    updated_at: now,
  };
  if (pepStatus !== undefined) updateData.pep_status = pepStatus;
  if (pepDetails !== undefined) updateData.pep_details = pepDetails;
  const { error } = await supabase
    .from('kyc')
    .update(updateData)
    .eq('id', id);
  if (error) throw error;

  // Sync updated KYC to sheet (get full record first)
  getKycById(id).then(kyc => {
    if (kyc) syncKycToSheet(kyc).catch(() => {});
  }).catch(() => {});
}

export async function getKycStats() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('kyc')
    .select('status');
  if (error) throw error;
  const stats = { Pending: 0, Submitted: 0, 'Under Review': 0, Approved: 0, Rejected: 0 };
  (data || []).forEach(row => {
    if (stats[row.status] !== undefined) stats[row.status]++;
  });
  return stats;
}

// ==================== KYC FORM DATA (Normalized Tables) ====================

// Scalar mapping: DB column -> { section (dot-path or null), field, type }
const SCALAR_MAP = {
  last_saved:                 { section: null, field: 'lastSaved', type: 'timestamp' },
  version:                    { section: null, field: 'version', type: 'integer' },

  bi_business_name:           { section: 'businessInfo', field: 'businessName' },
  bi_tax_registration_no:     { section: 'businessInfo', field: 'taxRegistrationNo' },
  bi_address:                 { section: 'businessInfo', field: 'address' },
  bi_city:                    { section: 'businessInfo', field: 'city' },
  bi_province_state:          { section: 'businessInfo', field: 'provinceState' },
  bi_postal_zip_code:         { section: 'businessInfo', field: 'postalZipCode' },
  bi_country:                 { section: 'businessInfo', field: 'country' },
  bi_phone:                   { section: 'businessInfo', field: 'phone' },
  bi_website:                 { section: 'businessInfo', field: 'website' },
  bi_date_of_incorporation:   { section: 'businessInfo', field: 'dateOfIncorporation' },
  bi_years_in_business:       { section: 'businessInfo', field: 'yearsInBusiness' },
  bi_nature_of_business:      { section: 'businessInfo', field: 'natureOfBusiness' },
  bi_monthly_credit_required: { section: 'businessInfo', field: 'monthlyCreditRequired' },
  bi_annual_sales:            { section: 'businessInfo', field: 'annualSales' },
  bi_number_of_employees:     { section: 'businessInfo', field: 'numberOfEmployees' },

  bi_type_corporation:        { section: 'businessInfo.businessType', field: 'corporation', type: 'boolean' },
  bi_type_incorporated:       { section: 'businessInfo.businessType', field: 'incorporated', type: 'boolean' },
  bi_type_partnership:        { section: 'businessInfo.businessType', field: 'partnership', type: 'boolean' },
  bi_type_sole_proprietorship:{ section: 'businessInfo.businessType', field: 'soleProprietorship', type: 'boolean' },

  mi_manager_name:            { section: 'managerInfo', field: 'managerName' },
  mi_manager_email:           { section: 'managerInfo', field: 'managerEmail' },
  mi_manager_phone:           { section: 'managerInfo', field: 'managerPhone' },
  mi_manager_mobile:          { section: 'managerInfo', field: 'managerMobile' },
  mi_ap_contact_name:         { section: 'managerInfo', field: 'apContactName' },
  mi_ap_contact_email:        { section: 'managerInfo', field: 'apContactEmail' },
  mi_ap_contact_phone:        { section: 'managerInfo', field: 'apContactPhone' },
  mi_ap_contact_mobile:       { section: 'managerInfo', field: 'apContactMobile' },

  cd_company_name:            { section: 'companyDetails', field: 'companyName' },
  cd_trade_license_no:        { section: 'companyDetails', field: 'tradeLicenseNo' },
  cd_trade_license_expiry:    { section: 'companyDetails', field: 'tradeLicenseExpiry' },
  cd_mqa_registration_no:     { section: 'companyDetails', field: 'mqaRegistrationNo' },
  cd_vat_registration_no:     { section: 'companyDetails', field: 'vatRegistrationNo' },
  cd_company_address:         { section: 'companyDetails', field: 'companyAddress' },
  cd_office_phone:            { section: 'companyDetails', field: 'officePhone' },
  cd_email:                   { section: 'companyDetails', field: 'email' },
  cd_website_social_media:    { section: 'companyDetails', field: 'websiteSocialMedia' },
  cd_registered_office_address: { section: 'companyDetails', field: 'registeredOfficeAddress' },
  cd_agent_name:               { section: 'companyDetails.borderAgent', field: 'agentName' },
  cd_agent_contact:            { section: 'companyDetails.borderAgent', field: 'agentContact' },
  cd_agent_address:            { section: 'companyDetails.borderAgent', field: 'agentAddress' },

  sm_facebook:                 { section: 'socialMedia', field: 'facebook' },
  sm_instagram:                { section: 'socialMedia', field: 'instagram' },
  sm_twitter:                  { section: 'socialMedia', field: 'twitter' },
  sm_linkedin:                 { section: 'socialMedia', field: 'linkedin' },
  sm_others:                   { section: 'socialMedia', field: 'others' },

  ib_fssai_number:             { section: 'indianBuyerInfo', field: 'fssaiNumber' },
  ib_pan_number:               { section: 'indianBuyerInfo', field: 'panNumber' },
  ib_iec_number:               { section: 'indianBuyerInfo', field: 'iecNumber' },

  decl_not_money_laundering:   { section: 'declaration', field: 'notMoneyLaundering', type: 'boolean' },
  decl_not_terrorist_funding:  { section: 'declaration', field: 'notTerroristFunding', type: 'boolean' },
  decl_not_sanctioned_country: { section: 'declaration', field: 'notSanctionedCountry', type: 'boolean' },
  decl_not_political_party:    { section: 'declaration', field: 'notPoliticalParty', type: 'boolean' },

  br_bank_name:               { section: 'bankReference', field: 'bankName' },
  br_address:                 { section: 'bankReference', field: 'address' },
  br_city:                    { section: 'bankReference', field: 'city' },
  br_province_state:          { section: 'bankReference', field: 'provinceState' },
  br_postal_zip_code:         { section: 'bankReference', field: 'postalZipCode' },
  br_contact_name:            { section: 'bankReference', field: 'contactName' },
  br_email:                   { section: 'bankReference', field: 'email' },
  br_years_relationship:      { section: 'bankReference', field: 'yearsRelationship' },
  br_phone:                   { section: 'bankReference', field: 'phone' },

  cc_neg_social_media_check:  { section: 'complianceChecklist', field: 'negSocialMediaConductCheck', type: 'boolean' },
  cc_banking_credibility:     { section: 'complianceChecklist', field: 'bankingCredibilityCheck', type: 'boolean' },
  cc_regulatory_approval:     { section: 'complianceChecklist', field: 'regulatoryApprovalCheck', type: 'boolean' },
  cc_additional_background:   { section: 'complianceChecklist', field: 'additionalBackgroundCheck', type: 'boolean' },
  cc_labor_safety_license:    { section: 'complianceChecklist', field: 'laborSafetyLicenseCheck', type: 'boolean' },
  cc_licensing_permit:        { section: 'complianceChecklist', field: 'licensingPermitCheck', type: 'boolean' },

  decl_info_accurate:         { section: 'declaration', field: 'infoAccurate', type: 'boolean' },
  decl_authorize_verification:{ section: 'declaration', field: 'authorizeVerification', type: 'boolean' },
  decl_signature_name:        { section: 'declaration', field: 'signatureName' },
  decl_signature_position:    { section: 'declaration', field: 'signaturePosition' },
  decl_signature_date:        { section: 'declaration', field: 'signatureDate' },
};

// Array tables: table name, JSON key, { db_column: 'jsonField' }
const ARRAY_TABLES = [
  {
    table: 'kyc_proprietors',
    jsonKey: 'proprietors',
    columns: { name: 'name', title: 'title', address: 'address', email: 'email', phone: 'phone', mobile: 'mobile' },
  },
  {
    table: 'kyc_ownership_management',
    jsonKey: 'ownershipManagement',
    columns: { name: 'name', designation: 'designation', nationality: 'nationality', uae_id: 'uaeId', passport_no: 'passportNo', shareholding_percent: 'shareholdingPercent', contact_no: 'contactNo', email: 'email', social_media: 'socialMedia' },
  },
  {
    table: 'kyc_banking_checks',
    jsonKey: 'bankingChecks',
    columns: { bank_name: 'bankName', branch: 'branch', account_no: 'accountNo', iban: 'iban', swift: 'swift', bank_contact: 'bankContact', reputation_check: 'reputationCheck', notes: 'notes' },
  },
  {
    table: 'kyc_supplier_references',
    jsonKey: 'supplierReferences',
    columns: { name: 'name', address: 'address', city: 'city', province_state: 'provinceState', postal_zip_code: 'postalZipCode', country: 'country', phone: 'phone', contact: 'contact', highest_credit: 'highestCredit', payment_terms: 'paymentTerms' },
  },
  {
    table: 'kyc_trade_references',
    jsonKey: 'tradeReferences',
    columns: { customer_supplier: 'customerSupplier', contact: 'contact', phone_email: 'phoneEmail', type_of_business: 'typeOfBusiness', years_relationship: 'yearsRelationship', notes: 'notes' },
  },
  {
    table: 'kyc_regulatory_compliance',
    jsonKey: 'regulatoryCompliance',
    columns: { area: 'area', status: 'status', docs_provided: 'docsProvided', remarks: 'remarks', reputation_score: 'reputationScore' },
  },
  {
    table: 'kyc_social_media_reviews',
    jsonKey: 'socialMediaReviews',
    columns: { platform: 'platform', entity: 'entity', review_summary: 'reviewSummary', rating: 'rating', verified_source: 'verifiedSource', action_required: 'actionRequired' },
  },
  {
    table: 'kyc_warehouse_addresses',
    jsonKey: 'warehouseAddresses',
    columns: { address: 'address' },
  },
];

// Helper: set nested value by dot-path
function setNested(obj, path, field, value) {
  if (!path) { obj[field] = value; return; }
  const parts = path.split('.');
  let cur = obj;
  for (const part of parts) {
    if (!cur[part]) cur[part] = {};
    cur = cur[part];
  }
  cur[field] = value;
}

// Helper: get nested value by dot-path
function getNested(obj, path, field) {
  if (!path) return obj[field];
  const parts = path.split('.');
  let cur = obj;
  for (const part of parts) {
    if (!cur || !cur[part]) return undefined;
    cur = cur[part];
  }
  return cur[field];
}

export async function getKycFormData(kycId) {
  const supabase = getSupabase();

  // 1. Fetch scalar row
  const { data: formRow, error: formError } = await supabase
    .from('kyc_form')
    .select('*')
    .eq('kyc_id', kycId)
    .single();

  if (formError && formError.code !== 'PGRST116') throw formError;
  if (!formRow) return null;

  // 2. Build JSON from scalar columns
  const result = {};
  for (const [col, mapping] of Object.entries(SCALAR_MAP)) {
    const value = formRow[col];
    if (value !== null && value !== undefined) {
      setNested(result, mapping.section, mapping.field, value);
    }
  }

  // 3. Fetch all array tables in parallel
  await Promise.all(ARRAY_TABLES.map(async ({ table, jsonKey, columns }) => {
    const { data: rows, error } = await supabase
      .from(table)
      .select('*')
      .eq('kyc_id', kycId)
      .order('sort_order', { ascending: true });
    if (error) throw error;

    result[jsonKey] = (rows || []).map(row => {
      const item = {};
      for (const [dbCol, jsonField] of Object.entries(columns)) {
        item[jsonField] = row[dbCol] != null ? row[dbCol] : '';
      }
      return item;
    });
  }));

  return result;
}

export async function saveKycFormData(kycId, formData) {
  const supabase = getSupabase();

  // 1. Build scalar row from JSON (with type coercion)
  const scalarRow = { kyc_id: kycId };
  for (const [col, mapping] of Object.entries(SCALAR_MAP)) {
    let value = getNested(formData, mapping.section, mapping.field);
    if (value === undefined || value === null || value === '') {
      // Use proper defaults per type
      if (mapping.type === 'boolean') { value = false; }
      else if (mapping.type === 'integer') { value = null; }
      else if (mapping.type === 'timestamp') { value = null; }
      else { value = ''; }
    } else if (mapping.type === 'integer') {
      const parsed = parseInt(value, 10);
      value = isNaN(parsed) ? null : parsed;
    }
    scalarRow[col] = value;
  }

  // 2. Upsert scalar row
  const { error: upsertError } = await supabase
    .from('kyc_form')
    .upsert(scalarRow, { onConflict: 'kyc_id' });
  if (upsertError) throw upsertError;

  // 3. Save arrays: delete-then-insert for each
  await Promise.all(ARRAY_TABLES.map(async ({ table, jsonKey, columns }) => {
    const items = formData[jsonKey] || [];

    // Delete existing rows
    const { error: delError } = await supabase.from(table).delete().eq('kyc_id', kycId);
    if (delError) throw delError;

    // Insert new rows
    if (items.length > 0) {
      const rows = items.map((item, index) => {
        const row = { kyc_id: kycId, sort_order: index };
        for (const [dbCol, jsonField] of Object.entries(columns)) {
          row[dbCol] = item[jsonField] !== undefined ? item[jsonField] : '';
        }
        return row;
      });
      const { error: insError } = await supabase.from(table).insert(rows);
      if (insError) throw insError;
    }
  }));

  // 4. Update kyc timestamp
  const { error: tsError } = await supabase
    .from('kyc')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', kycId);
  if (tsError) throw tsError;

  // Sync form data to Google Sheets (fire-and-forget)
  syncFormDataToSheet(kycId, formData).catch(() => {});
}

// ==================== KYC COMPLIANCE RESULTS ====================

export async function getComplianceResults(kycId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('kyc_compliance_results')
    .select('*')
    .eq('kyc_id', kycId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    kycId: row.kyc_id,
    checkKey: row.check_key,
    label: row.label,
    category: row.category,
    aiStatus: row.ai_status,
    aiRemarks: row.ai_remarks,
    adminOverride: row.admin_override,
    adminNotes: row.admin_notes,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function saveComplianceResults(kycId, checks) {
  const supabase = getSupabase();

  // Delete existing AI results (but preserve admin overrides by re-merging)
  const { data: existing } = await supabase
    .from('kyc_compliance_results')
    .select('check_key, admin_override, admin_notes, updated_by')
    .eq('kyc_id', kycId);

  const overrideMap = {};
  (existing || []).forEach(row => {
    if (row.admin_override) {
      overrideMap[row.check_key] = {
        admin_override: row.admin_override,
        admin_notes: row.admin_notes,
        updated_by: row.updated_by,
      };
    }
  });

  // Delete all existing results for this KYC
  const { error: delError } = await supabase
    .from('kyc_compliance_results')
    .delete()
    .eq('kyc_id', kycId);
  if (delError) throw delError;

  // Insert fresh results, preserving any admin overrides
  const now = new Date().toISOString();
  const rows = checks.map(check => {
    const prev = overrideMap[check.checkKey];
    return {
      kyc_id: kycId,
      check_key: check.checkKey,
      label: check.label,
      category: check.category || 'General',
      ai_status: check.aiStatus || 'pending',
      ai_remarks: check.aiRemarks || '',
      admin_override: prev?.admin_override || null,
      admin_notes: prev?.admin_notes || '',
      updated_by: prev?.updated_by || '',
      created_at: now,
      updated_at: now,
    };
  });

  if (rows.length > 0) {
    const { error: insError } = await supabase
      .from('kyc_compliance_results')
      .insert(rows);
    if (insError) throw insError;
  }

  // Sync compliance to sheet (fire-and-forget)
  getComplianceResults(kycId).then(saved => {
    syncComplianceToSheet(kycId, saved).catch(() => {});
  }).catch(() => {});
}

export async function updateComplianceOverride(kycId, checkKey, { adminOverride, adminNotes, updatedBy }) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('kyc_compliance_results')
    .update({
      admin_override: adminOverride,
      admin_notes: adminNotes || '',
      updated_by: updatedBy || '',
      updated_at: new Date().toISOString(),
    })
    .eq('kyc_id', kycId)
    .eq('check_key', checkKey);
  if (error) throw error;

  // Sync compliance to sheet (fire-and-forget)
  getComplianceResults(kycId).then(saved => {
    syncComplianceToSheet(kycId, saved).catch(() => {});
  }).catch(() => {});
}

// ==================== KYC_DOCS ====================

export async function createKycDoc({ kycId, docType, storagePath, fileName, mimeType, fileSize }) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('kyc_docs')
    .insert({
      kyc_id: kycId,
      doc_type: docType,
      storage_path: storagePath,
      file_name: fileName,
      mime_type: mimeType || 'application/octet-stream',
      file_size: fileSize || 0,
    })
    .select()
    .single();
  if (error) throw error;

  // Sync doc to Google Sheets (fire-and-forget)
  syncDocToSheet({ kycId, docType, storagePath, fileName, uploadedAt: data.uploaded_at }).catch(() => {});

  return data;
}

export async function getDocsByKycId(kycId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('kyc_docs')
    .select('*')
    .eq('kyc_id', kycId)
    .order('uploaded_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(row => ({
    kycId: row.kyc_id,
    docType: row.doc_type,
    driveFileId: row.storage_path,
    fileName: row.file_name,
    uploadedAt: row.uploaded_at,
  }));
}

// ==================== KYC EXPIRY ====================

export async function getExpiringKyc(daysBeforeExpiry = 2) {
  const supabase = getSupabase();
  const now = new Date();
  const cutoff = new Date(now.getTime() + daysBeforeExpiry * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('kyc')
    .select('*')
    .eq('status', 'Pending')
    .lte('token_expiry', cutoff)
    .gte('token_expiry', now.toISOString())
    .order('token_expiry', { ascending: true });
  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    clientName: row.client_name,
    companyName: row.company_name,
    email: row.email,
    phone: row.phone || '',
    phoneCountryCode: row.phone_country_code || '',
    tokenExpiry: row.token_expiry,
    companyProfileId: row.company_profile_id || null,
    createdBy: row.created_by,
  }));
}

// ==================== MESSAGE LOG ====================

export async function createMessageLog({ kycId, channel, recipient, messageType, status, errorMessage, metadata }) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('message_log')
    .insert({
      kyc_id: kycId || null,
      channel,
      recipient,
      message_type: messageType,
      status: status || 'sent',
      error_message: errorMessage || '',
      metadata: metadata || {},
    });
  if (error) throw error;
}

// ==================== AUDIT ====================

export async function createAuditEntry({ action, actor, kycId, details }) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('audit_log')
    .insert({
      action,
      actor,
      kyc_id: kycId || null,
      details: details || '',
    });
  if (error) throw error;

  // Sync audit to Google Sheets (fire-and-forget)
  syncAuditToSheet({ action, actor, kycId, details }).catch(() => {});
}
