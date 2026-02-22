/**
 * Google Sheets sync — mirrors Supabase data to Google Sheets.
 * Uses Service Account JWT auth with Google Sheets API v4 (no extra packages).
 */

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
let cachedToken = null;
let tokenExpiry = 0;

// Sheet tab names
const SHEET_KYC_LIST = 'KYC List';
const SHEET_FORM_DATA = 'Form Data';
const SHEET_COMPLIANCE = 'Compliance Results';
const SHEET_DOCUMENTS = 'Documents';
const SHEET_AUDIT = 'Audit Log';

function fixPrivateKey(key) {
  if (!key) return null;
  // Remove surrounding quotes if present
  let k = key.replace(/^["']|["']$/g, '');
  // Replace literal \n with real newlines
  k = k.replace(/\\n/g, '\n');
  // If key got completely flattened (no real newlines), reconstruct it
  if (!k.includes('\n')) {
    // Extract the base64 content between header and footer
    const match = k.match(/-----BEGIN PRIVATE KEY-----(.*?)-----END PRIVATE KEY-----/);
    if (match) {
      const b64 = match[1].trim();
      // Split into 64-char lines
      const lines = b64.match(/.{1,64}/g) || [];
      k = `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----\n`;
    }
  }
  return k;
}

function getCredentials() {
  // Try single JSON env var first
  const raw = process.env.GOOGLE_SHEETS_CREDENTIALS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.private_key) parsed.private_key = fixPrivateKey(parsed.private_key);
      return parsed;
    } catch { /* fall through to individual vars */ }
  }

  // Fall back to individual env vars
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!clientEmail || !privateKey) return null;

  return {
    client_email: clientEmail,
    private_key: fixPrivateKey(privateKey),
    token_uri: process.env.GOOGLE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
  };
}

function getSheetId() {
  return process.env.GOOGLE_SHEET_ID || null;
}

// ==================== JWT AUTH ====================

function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function createJwt(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: credentials.client_email,
    scope: SCOPES,
    aud: credentials.token_uri,
    iat: now,
    exp: now + 3600,
  }));

  const signInput = `${header}.${payload}`;

  // Use Node.js crypto to sign with RSA
  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signInput);
  const signature = sign.sign(credentials.private_key, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

  return `${signInput}.${signature}`;
}

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const credentials = getCredentials();
  if (!credentials) {
    console.error('Google Sheets: No credentials found');
    return null;
  }

  let jwt;
  try {
    jwt = await createJwt(credentials);
  } catch (jwtErr) {
    console.error('Google Sheets JWT creation failed:', jwtErr.message);
    console.error('Private key starts with:', credentials.private_key?.substring(0, 40));
    return null;
  }

  const res = await fetch(credentials.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Google OAuth error:', errText);
    return null;
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // refresh 60s early
  return cachedToken;
}

// ==================== SHEETS API HELPERS ====================

async function sheetsApi(path, method = 'GET', body = null) {
  const token = await getAccessToken();
  if (!token) return null;

  const sheetId = getSheetId();
  if (!sheetId) return null;

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}${path}`;
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  if (!res.ok) {
    const errText = await res.text();
    console.error(`Sheets API ${method} ${path} error:`, errText);
    return null;
  }
  return res.json();
}

async function ensureSheetTab(tabName) {
  // Get existing sheets
  const meta = await sheetsApi('?fields=sheets.properties.title');
  if (!meta) return;

  const exists = meta.sheets?.some(s => s.properties.title === tabName);
  if (exists) return;

  // Create the sheet tab
  await sheetsApi(':batchUpdate', 'POST', {
    requests: [{
      addSheet: { properties: { title: tabName } }
    }],
  });
}

async function clearAndWriteSheet(tabName, headers, rows) {
  await ensureSheetTab(tabName);
  const range = `'${tabName}'!A1`;
  const allRows = [headers, ...rows];

  // Clear existing
  await sheetsApi(`/values/'${tabName}'!A:ZZ:clear`, 'POST');

  // Write new data
  await sheetsApi(`/values/${encodeURIComponent(`'${tabName}'!A1`)}?valueInputOption=USER_ENTERED`, 'PUT', {
    range: `'${tabName}'!A1`,
    majorDimension: 'ROWS',
    values: allRows,
  });
}

async function appendToSheet(tabName, headers, row) {
  await ensureSheetTab(tabName);

  // Check if headers exist
  const existing = await sheetsApi(`/values/${encodeURIComponent(`'${tabName}'!A1:1`)}`);
  if (!existing?.values || existing.values.length === 0) {
    // Write headers first
    await sheetsApi(`/values/${encodeURIComponent(`'${tabName}'!A1`)}?valueInputOption=USER_ENTERED`, 'PUT', {
      range: `'${tabName}'!A1`,
      majorDimension: 'ROWS',
      values: [headers],
    });
  }

  // Append row
  await sheetsApi(`/values/${encodeURIComponent(`'${tabName}'!A:A`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, 'POST', {
    values: [row],
  });
}

async function updateRowByKey(tabName, keyColIndex, keyValue, headers, newRow) {
  await ensureSheetTab(tabName);

  // Get all values to find the row
  const data = await sheetsApi(`/values/${encodeURIComponent(`'${tabName}'!A:ZZ`)}`);
  if (!data?.values || data.values.length < 2) {
    // No data yet — write headers + row
    await sheetsApi(`/values/${encodeURIComponent(`'${tabName}'!A1`)}?valueInputOption=USER_ENTERED`, 'PUT', {
      range: `'${tabName}'!A1`,
      majorDimension: 'ROWS',
      values: [headers, newRow],
    });
    return;
  }

  // Find row index (1-based, row 1 = headers)
  let rowIdx = -1;
  for (let i = 1; i < data.values.length; i++) {
    if (data.values[i][keyColIndex] === keyValue) {
      rowIdx = i + 1; // Sheets is 1-based
      break;
    }
  }

  if (rowIdx > 0) {
    // Update existing row
    await sheetsApi(`/values/${encodeURIComponent(`'${tabName}'!A${rowIdx}`)}?valueInputOption=USER_ENTERED`, 'PUT', {
      range: `'${tabName}'!A${rowIdx}`,
      majorDimension: 'ROWS',
      values: [newRow],
    });
  } else {
    // Append new row
    await sheetsApi(`/values/${encodeURIComponent(`'${tabName}'!A:A`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, 'POST', {
      values: [newRow],
    });
  }
}

// ==================== SYNC FUNCTIONS ====================

const KYC_HEADERS = [
  'KYC ID', 'Client Name', 'Company Name', 'Email', 'Status', 'Remarks',
  'Created By', 'Created At', 'Updated At',
];

function kycToRow(kyc) {
  return [
    kyc.id, kyc.clientName, kyc.companyName, kyc.email, kyc.status, kyc.remarks || '',
    kyc.createdBy, kyc.createdAt || '', kyc.updatedAt || '',
  ];
}

export async function syncKycToSheet(kyc) {
  try {
    await updateRowByKey(SHEET_KYC_LIST, 0, kyc.id, KYC_HEADERS, kycToRow(kyc));
  } catch (err) {
    console.error('Sheets sync (KYC) error:', err.message);
  }
}

// Form Data — flatten into sheet columns
const FORM_HEADERS = [
  'KYC ID', 'Last Saved',
  // Business Info
  'Business Name', 'Tax Reg No', 'Address', 'City', 'Province/State', 'Postal/Zip',
  'Country', 'Phone', 'Website', 'Incorporation Date', 'Years in Business',
  'Nature of Business', 'Monthly Credit Required', 'Annual Sales', 'No. of Employees',
  'Type: Corporation', 'Type: Incorporated', 'Type: Partnership', 'Type: Sole Proprietorship',
  // Manager Info
  'Manager Name', 'Manager Email', 'Manager Phone', 'Manager Mobile',
  'AP Contact Name', 'AP Contact Email', 'AP Contact Phone', 'AP Contact Mobile',
  // Company Details
  'Company Name (License)', 'Trade License No', 'Trade License Expiry', 'MQA/Reg No',
  'VAT Reg No', 'Company Address', 'Registered Office', 'Office Phone', 'Company Email', 'Website/Social',
  'Border Agent Name', 'Border Agent Contact', 'Border Agent Address',
  // Bank Reference
  'Bank Name', 'Bank Address', 'Bank City', 'Bank Province', 'Bank Postal',
  'Bank Contact', 'Bank Email', 'Bank Years Relationship', 'Bank Phone',
  // Social Media
  'Facebook', 'Instagram', 'Twitter/X', 'LinkedIn', 'Others (Social)',
  // Indian Buyer
  'FSSAI Number', 'PAN Number', 'IEC Number',
  // Declaration
  'Decl: Info Accurate', 'Decl: Authorize Verification',
  'Decl: Not Money Laundering', 'Decl: Not Terrorist Funding',
  'Decl: Not Sanctioned Country', 'Decl: Not Political Party',
  'Signature Name', 'Signature Position', 'Signature Date',
  // Counts
  'Proprietors Count', 'Owners Count', 'Banking Checks Count',
  'Supplier Refs Count', 'Trade Refs Count', 'Warehouse Count',
];

function formDataToRow(kycId, fd) {
  if (!fd) return [kycId];
  const bi = fd.businessInfo || {};
  const bt = bi.businessType || {};
  const mi = fd.managerInfo || {};
  const cd = fd.companyDetails || {};
  const ba = cd.borderAgent || {};
  const br = fd.bankReference || {};
  const sm = fd.socialMedia || {};
  const ib = fd.indianBuyerInfo || {};
  const decl = fd.declaration || {};

  return [
    kycId, fd.lastSaved || '',
    bi.businessName || '', bi.taxRegistrationNo || '', bi.address || '', bi.city || '',
    bi.provinceState || '', bi.postalZipCode || '', bi.country || '', bi.phone || '',
    bi.website || '', bi.dateOfIncorporation || '', bi.yearsInBusiness || '',
    bi.natureOfBusiness || '', bi.monthlyCreditRequired || '', bi.annualSales || '',
    bi.numberOfEmployees || '',
    bt.corporation ? 'Yes' : 'No', bt.incorporated ? 'Yes' : 'No',
    bt.partnership ? 'Yes' : 'No', bt.soleProprietorship ? 'Yes' : 'No',
    mi.managerName || '', mi.managerEmail || '', mi.managerPhone || '', mi.managerMobile || '',
    mi.apContactName || '', mi.apContactEmail || '', mi.apContactPhone || '', mi.apContactMobile || '',
    cd.companyName || '', cd.tradeLicenseNo || '', cd.tradeLicenseExpiry || '',
    cd.mqaRegistrationNo || '', cd.vatRegistrationNo || '', cd.companyAddress || '',
    cd.registeredOfficeAddress || '', cd.officePhone || '', cd.email || '', cd.websiteSocialMedia || '',
    ba.agentName || '', ba.agentContact || '', ba.agentAddress || '',
    br.bankName || '', br.address || '', br.city || '', br.provinceState || '',
    br.postalZipCode || '', br.contactName || '', br.email || '',
    br.yearsRelationship || '', br.phone || '',
    sm.facebook || '', sm.instagram || '', sm.twitter || '', sm.linkedin || '', sm.others || '',
    ib.fssaiNumber || '', ib.panNumber || '', ib.iecNumber || '',
    decl.infoAccurate ? 'Yes' : 'No', decl.authorizeVerification ? 'Yes' : 'No',
    decl.notMoneyLaundering ? 'Yes' : 'No', decl.notTerroristFunding ? 'Yes' : 'No',
    decl.notSanctionedCountry ? 'Yes' : 'No', decl.notPoliticalParty ? 'Yes' : 'No',
    decl.signatureName || '', decl.signaturePosition || '', decl.signatureDate || '',
    (fd.proprietors || []).length.toString(),
    (fd.ownershipManagement || []).length.toString(),
    (fd.bankingChecks || []).length.toString(),
    (fd.supplierReferences || []).length.toString(),
    (fd.tradeReferences || []).length.toString(),
    (fd.warehouseAddresses || []).length.toString(),
  ];
}

export async function syncFormDataToSheet(kycId, formData) {
  try {
    await updateRowByKey(SHEET_FORM_DATA, 0, kycId, FORM_HEADERS, formDataToRow(kycId, formData));
  } catch (err) {
    console.error('Sheets sync (Form Data) error:', err.message);
  }
}

const COMPLIANCE_HEADERS = [
  'KYC ID', 'Check Key', 'Label', 'Category', 'AI Status', 'AI Remarks',
  'Admin Override', 'Admin Notes', 'Updated By', 'Updated At',
];

export async function syncComplianceToSheet(kycId, results) {
  try {
    await ensureSheetTab(SHEET_COMPLIANCE);

    // Remove existing rows for this KYC ID, then re-add
    const data = await sheetsApi(`/values/${encodeURIComponent(`'${SHEET_COMPLIANCE}'!A:ZZ`)}`);

    // Rebuild: keep header + rows not matching this kycId + new rows
    const headers = COMPLIANCE_HEADERS;
    const existingRows = (data?.values || []).slice(1).filter(r => r[0] !== kycId);
    const newRows = results.map(r => [
      kycId, r.checkKey, r.label, r.category, r.aiStatus, r.aiRemarks || '',
      r.adminOverride || '', r.adminNotes || '', r.updatedBy || '', r.updatedAt || '',
    ]);

    await clearAndWriteSheet(SHEET_COMPLIANCE, headers, [...existingRows, ...newRows]);
  } catch (err) {
    console.error('Sheets sync (Compliance) error:', err.message);
  }
}

const DOC_HEADERS = ['KYC ID', 'Doc Type', 'File Name', 'Storage Path', 'Uploaded At'];

export async function syncDocToSheet(doc) {
  try {
    const row = [doc.kycId, doc.docType, doc.fileName, doc.storagePath || doc.driveFileId || '', doc.uploadedAt || new Date().toISOString()];
    await appendToSheet(SHEET_DOCUMENTS, DOC_HEADERS, row);
  } catch (err) {
    console.error('Sheets sync (Doc) error:', err.message);
  }
}

const AUDIT_HEADERS = ['Timestamp', 'Action', 'Actor', 'KYC ID', 'Details'];

export async function syncAuditToSheet(entry) {
  try {
    const row = [new Date().toISOString(), entry.action, entry.actor, entry.kycId || '', entry.details || ''];
    await appendToSheet(SHEET_AUDIT, AUDIT_HEADERS, row);
  } catch (err) {
    console.error('Sheets sync (Audit) error:', err.message);
  }
}

// ==================== FULL SYNC (all existing data) ====================

export async function syncAllExistingData(getAllKyc, getKycFormData, getComplianceResults, getDocsByKycId) {
  const sheetId = getSheetId();
  const creds = getCredentials();
  if (!sheetId || !creds) {
    return { error: 'Google Sheets not configured' };
  }

  const results = { kyc: 0, forms: 0, compliance: 0, docs: 0 };

  try {
    // 1. Sync all KYC records
    const allKyc = await getAllKyc();
    if (allKyc.length > 0) {
      const rows = allKyc.map(kycToRow);
      await clearAndWriteSheet(SHEET_KYC_LIST, KYC_HEADERS, rows);
      results.kyc = allKyc.length;
    }

    // 2. Sync all form data
    const formRows = [];
    for (const kyc of allKyc) {
      try {
        const fd = await getKycFormData(kyc.id);
        if (fd) {
          formRows.push(formDataToRow(kyc.id, fd));
        }
      } catch { /* no form data for this KYC */ }
    }
    if (formRows.length > 0) {
      await clearAndWriteSheet(SHEET_FORM_DATA, FORM_HEADERS, formRows);
      results.forms = formRows.length;
    }

    // 3. Sync all compliance results
    const compRows = [];
    for (const kyc of allKyc) {
      try {
        const cr = await getComplianceResults(kyc.id);
        cr.forEach(r => {
          compRows.push([
            kyc.id, r.checkKey, r.label, r.category, r.aiStatus, r.aiRemarks || '',
            r.adminOverride || '', r.adminNotes || '', r.updatedBy || '', r.updatedAt || '',
          ]);
        });
      } catch { /* no compliance results */ }
    }
    if (compRows.length > 0) {
      await clearAndWriteSheet(SHEET_COMPLIANCE, COMPLIANCE_HEADERS, compRows);
      results.compliance = compRows.length;
    }

    // 4. Sync all documents
    const docRows = [];
    for (const kyc of allKyc) {
      try {
        const docs = await getDocsByKycId(kyc.id);
        docs.forEach(d => {
          docRows.push([kyc.id, d.docType, d.fileName, d.driveFileId || '', d.uploadedAt || '']);
        });
      } catch { /* no docs */ }
    }
    if (docRows.length > 0) {
      await clearAndWriteSheet(SHEET_DOCUMENTS, DOC_HEADERS, docRows);
      results.docs = docRows.length;
    }

    return { success: true, synced: results };
  } catch (err) {
    console.error('Full sync error:', err);
    return { error: err.message, synced: results };
  }
}
