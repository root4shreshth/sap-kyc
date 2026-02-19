import { getSupabase } from './supabase';

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

export async function createUser({ email, passwordHash, role }) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('users')
    .insert({ email, password_hash: passwordHash, role })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ==================== KYC ====================

export async function createKyc({ id, clientName, companyName, email, tokenHash, tokenExpiry, status, remarks, createdBy }) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('kyc')
    .insert({
      id,
      client_name: clientName,
      company_name: companyName,
      email,
      token_hash: tokenHash,
      token_expiry: tokenExpiry,
      status: status || 'Pending',
      remarks: remarks || '',
      created_by: createdBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getAllKyc() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('kyc')
    .select('id, client_name, company_name, email, status, remarks, created_by, created_at, updated_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    clientName: row.client_name,
    companyName: row.company_name,
    email: row.email,
    status: row.status,
    remarks: row.remarks,
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
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updateKycStatus(id, { status, remarks }) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('kyc')
    .update({
      status,
      remarks: remarks !== undefined ? remarks : '',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
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

// ==================== KYC FORM DATA ====================

export async function getKycFormData(kycId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('kyc')
    .select('form_data')
    .eq('id', kycId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data?.form_data || null;
}

export async function saveKycFormData(kycId, formData) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('kyc')
    .update({
      form_data: formData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', kycId);
  if (error) throw error;
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
}
