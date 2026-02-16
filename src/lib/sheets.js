import { google } from 'googleapis';
import { getAuth } from './google-auth';
import { isDemoMode, demoGetRows, demoAppendRow, demoFindRowIndex, demoUpdateRow } from './demo-store';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

export const SHEETS = {
  USERS: 'Users',
  KYC: 'KYC',
  KYC_DOCS: 'KYC_Docs',
  AUDIT: 'Audit',
};

function getSheets() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

export async function getRows(sheetName) {
  if (isDemoMode()) return demoGetRows(sheetName);
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A:Z`,
  });
  const rows = res.data.values || [];
  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] || '';
    });
    return obj;
  });
}

export async function appendRow(sheetName, values) {
  if (isDemoMode()) return demoAppendRow(sheetName, values);
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'RAW',
    requestBody: { values: [values] },
  });
}

export async function findRowIndex(sheetName, columnIndex, value) {
  if (isDemoMode()) return demoFindRowIndex(sheetName, columnIndex, value);
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A:Z`,
  });
  const rows = res.data.values || [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][columnIndex] === value) return i - 1;
  }
  return -1;
}

export async function updateRow(sheetName, rowIndex, updates) {
  if (isDemoMode()) return demoUpdateRow(sheetName, rowIndex, updates);
  const sheets = getSheets();
  const requests = Object.entries(updates).map(([cell, value]) => ({
    range: `${sheetName}!${cell}${rowIndex + 2}`,
    values: [[value]],
  }));
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: requests,
    },
  });
}
