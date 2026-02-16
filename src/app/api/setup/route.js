import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { ensureBucket } from '@/lib/storage';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('Admin', 'KYC Team')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kyc (
  id           UUID PRIMARY KEY,
  client_name  TEXT NOT NULL,
  company_name TEXT NOT NULL,
  email        TEXT NOT NULL,
  token_hash   TEXT,
  token_expiry TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'Pending'
               CHECK (status IN ('Pending', 'Submitted', 'Under Review', 'Approved', 'Rejected')),
  remarks      TEXT DEFAULT '',
  created_by   TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kyc_docs (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kyc_id       UUID NOT NULL REFERENCES kyc(id) ON DELETE CASCADE,
  doc_type     TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_name    TEXT NOT NULL,
  mime_type    TEXT DEFAULT 'application/octet-stream',
  file_size    BIGINT DEFAULT 0,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action     TEXT NOT NULL,
  actor      TEXT NOT NULL,
  kyc_id     UUID,
  details    TEXT DEFAULT ''
);
`;

export async function POST() {
  try {
    const supabase = getSupabase();
    const results = { tables: {}, storage: '' };

    // Create tables via raw SQL using Supabase's rpc
    const { error: sqlError } = await supabase.rpc('exec_sql', { query: SCHEMA_SQL });

    if (sqlError) {
      // RPC not available — check tables individually via REST
      const tables = ['users', 'kyc', 'kyc_docs', 'audit_log'];
      for (const table of tables) {
        const { error } = await supabase.from(table).select('*').limit(0);
        results.tables[table] = error ? 'missing' : 'exists';
      }

      // If any tables missing, return SQL for manual execution
      const missing = Object.entries(results.tables).filter(([, v]) => v === 'missing');
      if (missing.length > 0) {
        // Ensure storage bucket
        try {
          await ensureBucket();
          results.storage = 'kyc-documents bucket ready';
        } catch (e) {
          results.storage = `Bucket error: ${e.message}`;
        }

        return NextResponse.json({
          message: 'Some tables are missing. Please run the SQL below in your Supabase SQL Editor (supabase.com → SQL Editor → New query → paste and run).',
          tables: results.tables,
          storage: results.storage,
          sql: SCHEMA_SQL,
        });
      }
    }

    // Ensure storage bucket exists
    try {
      await ensureBucket();
      results.storage = 'kyc-documents bucket ready';
    } catch (e) {
      results.storage = `Bucket error: ${e.message}`;
    }

    // Verify all tables
    const tables = ['users', 'kyc', 'kyc_docs', 'audit_log'];
    for (const table of tables) {
      const { error } = await supabase.from(table).select('*').limit(0);
      results.tables[table] = error ? 'error' : 'ready';
    }

    return NextResponse.json({
      message: 'Setup complete',
      ...results,
    });
  } catch (err) {
    console.error('Setup error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
