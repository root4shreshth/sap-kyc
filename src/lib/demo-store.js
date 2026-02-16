import bcrypt from 'bcryptjs';

// In-memory store for demo mode (when Google Sheets is not configured)
// Demo credentials:
//   Admin:    admin@demo.com / admin123
//   KYC Team: kyc@demo.com   / kyc123

const adminHash = bcrypt.hashSync('admin123', 10);
const kycHash = bcrypt.hashSync('kyc123', 10);

const store = {
  Users: [
    { email: 'admin@demo.com', passwordHash: adminHash, role: 'Admin', createdAt: new Date().toISOString() },
    { email: 'kyc@demo.com', passwordHash: kycHash, role: 'KYC Team', createdAt: new Date().toISOString() },
  ],
  KYC: [],
  KYC_Docs: [],
  Audit: [],
};

export function isDemoMode() {
  return !process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_CLIENT_EMAIL;
}

export function demoGetRows(sheetName) {
  return store[sheetName] || [];
}

export function demoAppendRow(sheetName, values) {
  const headers = {
    Users: ['email', 'passwordHash', 'role', 'createdAt'],
    KYC: ['id', 'clientName', 'companyName', 'email', 'tokenHash', 'tokenExpiry', 'status', 'remarks', 'createdBy', 'createdAt', 'updatedAt'],
    KYC_Docs: ['kycId', 'docType', 'driveFileId', 'fileName', 'uploadedAt'],
    Audit: ['timestamp', 'action', 'actor', 'kycId', 'details'],
  };
  const cols = headers[sheetName];
  if (!cols) return;
  const obj = {};
  cols.forEach((h, i) => { obj[h] = values[i] || ''; });
  if (!store[sheetName]) store[sheetName] = [];
  store[sheetName].push(obj);
}

export function demoFindRowIndex(sheetName, columnIndex, value) {
  const headers = {
    Users: ['email', 'passwordHash', 'role', 'createdAt'],
    KYC: ['id', 'clientName', 'companyName', 'email', 'tokenHash', 'tokenExpiry', 'status', 'remarks', 'createdBy', 'createdAt', 'updatedAt'],
    KYC_Docs: ['kycId', 'docType', 'driveFileId', 'fileName', 'uploadedAt'],
    Audit: ['timestamp', 'action', 'actor', 'kycId', 'details'],
  };
  const cols = headers[sheetName];
  if (!cols) return -1;
  const key = cols[columnIndex];
  const rows = store[sheetName] || [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][key] === value) return i;
  }
  return -1;
}

export function demoUpdateRow(sheetName, rowIndex, updates) {
  const headers = {
    KYC: ['id', 'clientName', 'companyName', 'email', 'tokenHash', 'tokenExpiry', 'status', 'remarks', 'createdBy', 'createdAt', 'updatedAt'],
  };
  const cols = headers[sheetName];
  if (!cols || !store[sheetName] || !store[sheetName][rowIndex]) return;

  // updates is { columnLetter: value } like { G: 'Submitted', K: '2024-...' }
  Object.entries(updates).forEach(([colLetter, value]) => {
    const colIndex = colLetter.charCodeAt(0) - 65; // A=0, B=1, ...
    const key = cols[colIndex];
    if (key) store[sheetName][rowIndex][key] = value;
  });
}
