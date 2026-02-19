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
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  form_data    JSONB DEFAULT '{}'
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

-- KYC Form: All scalar/1:1 fields
CREATE TABLE IF NOT EXISTS kyc_form (
  id                          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kyc_id                      UUID NOT NULL UNIQUE REFERENCES kyc(id) ON DELETE CASCADE,
  last_saved                  TIMESTAMPTZ,
  version                     INTEGER DEFAULT 1,

  bi_business_name            TEXT DEFAULT '',
  bi_tax_registration_no      TEXT DEFAULT '',
  bi_address                  TEXT DEFAULT '',
  bi_city                     TEXT DEFAULT '',
  bi_province_state           TEXT DEFAULT '',
  bi_postal_zip_code          TEXT DEFAULT '',
  bi_country                  TEXT DEFAULT '',
  bi_phone                    TEXT DEFAULT '',
  bi_website                  TEXT DEFAULT '',
  bi_date_of_incorporation    TEXT DEFAULT '',
  bi_years_in_business        TEXT DEFAULT '',
  bi_nature_of_business       TEXT DEFAULT '',
  bi_monthly_credit_required  TEXT DEFAULT '',
  bi_annual_sales             TEXT DEFAULT '',
  bi_number_of_employees      TEXT DEFAULT '',
  bi_type_corporation         BOOLEAN DEFAULT FALSE,
  bi_type_incorporated        BOOLEAN DEFAULT FALSE,
  bi_type_partnership         BOOLEAN DEFAULT FALSE,
  bi_type_sole_proprietorship BOOLEAN DEFAULT FALSE,

  mi_manager_name             TEXT DEFAULT '',
  mi_manager_email            TEXT DEFAULT '',
  mi_manager_phone            TEXT DEFAULT '',
  mi_manager_mobile           TEXT DEFAULT '',
  mi_ap_contact_name          TEXT DEFAULT '',
  mi_ap_contact_email         TEXT DEFAULT '',
  mi_ap_contact_phone         TEXT DEFAULT '',
  mi_ap_contact_mobile        TEXT DEFAULT '',

  cd_company_name             TEXT DEFAULT '',
  cd_trade_license_no         TEXT DEFAULT '',
  cd_trade_license_expiry     TEXT DEFAULT '',
  cd_mqa_registration_no      TEXT DEFAULT '',
  cd_vat_registration_no      TEXT DEFAULT '',
  cd_company_address          TEXT DEFAULT '',
  cd_office_phone             TEXT DEFAULT '',
  cd_email                    TEXT DEFAULT '',
  cd_website_social_media     TEXT DEFAULT '',

  br_bank_name                TEXT DEFAULT '',
  br_address                  TEXT DEFAULT '',
  br_city                     TEXT DEFAULT '',
  br_province_state           TEXT DEFAULT '',
  br_postal_zip_code          TEXT DEFAULT '',
  br_contact_name             TEXT DEFAULT '',
  br_email                    TEXT DEFAULT '',
  br_years_relationship       TEXT DEFAULT '',
  br_phone                    TEXT DEFAULT '',

  cc_neg_social_media_check   BOOLEAN DEFAULT FALSE,
  cc_banking_credibility      BOOLEAN DEFAULT FALSE,
  cc_regulatory_approval      BOOLEAN DEFAULT FALSE,
  cc_additional_background    BOOLEAN DEFAULT FALSE,
  cc_labor_safety_license     BOOLEAN DEFAULT FALSE,
  cc_licensing_permit         BOOLEAN DEFAULT FALSE,

  decl_info_accurate          BOOLEAN DEFAULT FALSE,
  decl_authorize_verification BOOLEAN DEFAULT FALSE,
  decl_signature_name         TEXT DEFAULT '',
  decl_signature_position     TEXT DEFAULT '',
  decl_signature_date         TEXT DEFAULT '',

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kyc_proprietors (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kyc_id      UUID NOT NULL REFERENCES kyc(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  name        TEXT DEFAULT '',
  title       TEXT DEFAULT '',
  address     TEXT DEFAULT '',
  email       TEXT DEFAULT '',
  phone       TEXT DEFAULT '',
  mobile      TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS kyc_ownership_management (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kyc_id                UUID NOT NULL REFERENCES kyc(id) ON DELETE CASCADE,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  name                  TEXT DEFAULT '',
  designation           TEXT DEFAULT '',
  nationality           TEXT DEFAULT '',
  uae_id                TEXT DEFAULT '',
  passport_no           TEXT DEFAULT '',
  shareholding_percent  TEXT DEFAULT '',
  contact_no            TEXT DEFAULT '',
  email                 TEXT DEFAULT '',
  social_media          TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS kyc_banking_checks (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kyc_id            UUID NOT NULL REFERENCES kyc(id) ON DELETE CASCADE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  bank_name         TEXT DEFAULT '',
  branch            TEXT DEFAULT '',
  account_no        TEXT DEFAULT '',
  iban              TEXT DEFAULT '',
  swift             TEXT DEFAULT '',
  bank_contact      TEXT DEFAULT '',
  reputation_check  TEXT DEFAULT '',
  notes             TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS kyc_supplier_references (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kyc_id          UUID NOT NULL REFERENCES kyc(id) ON DELETE CASCADE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  name            TEXT DEFAULT '',
  address         TEXT DEFAULT '',
  city            TEXT DEFAULT '',
  province_state  TEXT DEFAULT '',
  postal_zip_code TEXT DEFAULT '',
  country         TEXT DEFAULT '',
  phone           TEXT DEFAULT '',
  contact         TEXT DEFAULT '',
  highest_credit  TEXT DEFAULT '',
  payment_terms   TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS kyc_trade_references (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kyc_id              UUID NOT NULL REFERENCES kyc(id) ON DELETE CASCADE,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  customer_supplier   TEXT DEFAULT '',
  contact             TEXT DEFAULT '',
  phone_email         TEXT DEFAULT '',
  type_of_business    TEXT DEFAULT '',
  years_relationship  TEXT DEFAULT '',
  notes               TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS kyc_regulatory_compliance (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kyc_id            UUID NOT NULL REFERENCES kyc(id) ON DELETE CASCADE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  area              TEXT DEFAULT '',
  status            TEXT DEFAULT '',
  docs_provided     TEXT DEFAULT '',
  remarks           TEXT DEFAULT '',
  reputation_score  TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS kyc_social_media_reviews (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kyc_id          UUID NOT NULL REFERENCES kyc(id) ON DELETE CASCADE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  platform        TEXT DEFAULT '',
  entity          TEXT DEFAULT '',
  review_summary  TEXT DEFAULT '',
  rating          TEXT DEFAULT '',
  verified_source TEXT DEFAULT '',
  action_required TEXT DEFAULT ''
);
`;

const ALL_TABLES = [
  'users', 'kyc', 'kyc_docs', 'audit_log',
  'kyc_form', 'kyc_proprietors', 'kyc_ownership_management',
  'kyc_banking_checks', 'kyc_supplier_references', 'kyc_trade_references',
  'kyc_regulatory_compliance', 'kyc_social_media_reviews',
];

export async function POST() {
  try {
    const supabase = getSupabase();
    const results = { tables: {}, storage: '' };

    // Create tables via raw SQL using Supabase's rpc
    const { error: sqlError } = await supabase.rpc('exec_sql', { query: SCHEMA_SQL });

    if (sqlError) {
      // RPC not available — check tables individually via REST
      for (const table of ALL_TABLES) {
        const { error } = await supabase.from(table).select('*').limit(0);
        results.tables[table] = error ? 'missing' : 'exists';
      }

      // If any tables missing, return SQL for manual execution
      const missing = Object.entries(results.tables).filter(([, v]) => v === 'missing');
      if (missing.length > 0) {
        try {
          await ensureBucket();
          results.storage = 'kyc-documents bucket ready';
        } catch (e) {
          results.storage = `Bucket error: ${e.message}`;
        }

        return NextResponse.json({
          message: 'Some tables are missing. Please run the SQL below in your Supabase SQL Editor.',
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
    for (const table of ALL_TABLES) {
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
