import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth } from '@/lib/google-auth';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

// Tab definitions: name → header row
const TABS = {
  Users: ['email', 'passwordHash', 'role', 'createdAt'],
  KYC: ['id', 'clientName', 'companyName', 'email', 'tokenHash', 'tokenExpiry', 'status', 'remarks', 'createdBy', 'createdAt', 'updatedAt'],
  KYC_Docs: ['kycId', 'docType', 'driveFileId', 'fileName', 'uploadedAt'],
  Audit: ['timestamp', 'action', 'actor', 'kycId', 'details'],
};

export async function POST() {
  if (!SHEET_ID) {
    return NextResponse.json({ error: 'GOOGLE_SHEET_ID not set' }, { status: 400 });
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });

    // Get existing sheet tabs
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const existingTabs = spreadsheet.data.sheets.map((s) => s.properties.title);

    const created = [];
    const skipped = [];

    for (const [tabName, headers] of Object.entries(TABS)) {
      if (existingTabs.includes(tabName)) {
        skipped.push(tabName);
        continue;
      }

      // Add the sheet tab
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: tabName } } }],
        },
      });

      // Add headers
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${tabName}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [headers] },
      });

      created.push(tabName);
    }

    return NextResponse.json({
      message: 'Setup complete',
      created,
      skipped,
    });
  } catch (err) {
    console.error('Setup error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
