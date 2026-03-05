'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthProvider } from '@/components/AuthProvider';
import ProtectedLayout from '@/components/ProtectedLayout';
import { kycApi, companyApi } from '@/lib/api-client';

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
    if (values.some(v => v)) {
      const row = {};
      headers.forEach((h, j) => { row[h] = values[j] || ''; });
      rows.push(row);
    }
  }
  return { headers, rows };
}

function findField(row, ...candidates) {
  for (const c of candidates) {
    if (row[c]) return row[c];
  }
  return '';
}

function BulkImportContent() {
  const router = useRouter();
  const fileRef = useRef(null);
  const [csvRows, setCsvRows] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [companyProfiles, setCompanyProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState('');

  useEffect(() => {
    companyApi.list().then(profiles => {
      setCompanyProfiles(profiles);
      const def = profiles.find(p => p.isDefault);
      if (def) setSelectedProfile(def.id);
    }).catch(() => {});
  }, []);

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setErrors([]);
    setResults(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const { headers, rows } = parseCSV(ev.target.result);
      if (rows.length === 0) {
        setErrors(['No data rows found in CSV']);
        return;
      }
      // Validate required columns
      const hasName = headers.some(h => ['client_name', 'clientname', 'name'].includes(h));
      const hasCompany = headers.some(h => ['company_name', 'companyname', 'company'].includes(h));
      const hasEmail = headers.some(h => ['email', 'client_email'].includes(h));
      const missing = [];
      if (!hasName) missing.push('client_name');
      if (!hasCompany) missing.push('company_name');
      if (!hasEmail) missing.push('email');
      if (missing.length > 0) {
        setErrors([`Missing required columns: ${missing.join(', ')}. Found: ${headers.join(', ')}`]);
        return;
      }
      setCsvHeaders(headers);
      setCsvRows(rows);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    setImporting(true);
    setErrors([]);
    const importResults = { success: 0, failed: 0, errors: [] };

    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i];
      const clientName = findField(row, 'client_name', 'clientname', 'name');
      const companyName = findField(row, 'company_name', 'companyname', 'company');
      const email = findField(row, 'email', 'client_email');
      const ccEmail = findField(row, 'cc_email', 'ccemail', 'cc');
      const phone = findField(row, 'phone', 'phone_number', 'mobile');
      const phoneCountryCode = findField(row, 'phone_country_code', 'country_code') || '+971';

      if (!clientName || !companyName || !email) {
        importResults.errors.push(`Row ${i + 1}: Missing required fields`);
        importResults.failed++;
        continue;
      }

      try {
        await kycApi.create({
          clientName, companyName, email, ccEmail,
          phone, phoneCountryCode,
          companyProfileId: selectedProfile || undefined,
        });
        importResults.success++;
      } catch (err) {
        importResults.errors.push(`Row ${i + 1} (${email}): ${err.message}`);
        importResults.failed++;
      }
    }

    setResults(importResults);
    setImporting(false);
  }

  return (
    <ProtectedLayout roles={['Admin']}>
      <div className="container" style={{ paddingTop: 32, maxWidth: 800 }}>
        <Link href="/kyc" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gray-500)', textDecoration: 'none', marginBottom: 16 }}>
          <span style={{ fontSize: 16 }}>←</span> Back to KYC Requests
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Bulk KYC Import</h1>
        <p style={{ color: 'var(--gray-500)', fontSize: 14, marginBottom: 24 }}>
          Upload a CSV file to create multiple KYC requests at once.
        </p>

        {/* CSV Template */}
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>CSV Format</h3>
          <div style={{ background: 'var(--gray-50)', padding: 12, borderRadius: 6, fontSize: 13, fontFamily: 'monospace', overflow: 'auto' }}>
            client_name,company_name,email,cc_email,phone,phone_country_code<br/>
            John Doe,Acme Trading,john@acme.com,cc@acme.com,501234567,+971
          </div>
          <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 8 }}>
            Required: client_name, company_name, email. Optional: cc_email, phone, phone_country_code (defaults to +971).
          </p>
        </div>

        {/* Upload + Profile selection */}
        <div className="card" style={{ marginBottom: 24 }}>
          {companyProfiles.length > 0 && (
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Company Profile (applied to all imports)</label>
              <select value={selectedProfile} onChange={e => setSelectedProfile(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', fontSize: 14 }}>
                <option value="">-- No profile --</option>
                {companyProfiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name}{p.isDefault ? ' (Default)' : ''}</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group">
            <label>Upload CSV File</label>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileUpload}
              style={{ padding: '10px 0', fontSize: 14 }} />
          </div>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            {errors.map((err, i) => <p key={i} className="error-msg">{err}</p>)}
          </div>
        )}

        {/* Preview table */}
        {csvRows.length > 0 && !results && (
          <div className="card" style={{ marginBottom: 24, padding: 0, overflow: 'auto' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>Preview ({csvRows.length} rows)</h3>
              <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
                {importing ? `Importing... (${csvRows.length} rows)` : `Import ${csvRows.length} KYC Requests`}
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 20 }}>#</th>
                  {csvHeaders.slice(0, 5).map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {csvRows.slice(0, 50).map((row, i) => (
                  <tr key={i}>
                    <td style={{ paddingLeft: 20, color: 'var(--gray-400)' }}>{i + 1}</td>
                    {csvHeaders.slice(0, 5).map(h => <td key={h}>{row[h] || '-'}</td>)}
                  </tr>
                ))}
                {csvRows.length > 50 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 12 }}>...and {csvRows.length - 50} more rows</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, color: results.failed === 0 ? 'var(--green)' : '#f59e0b', marginBottom: 8 }}>
              {results.failed === 0 ? '✓' : '⚠'}
            </div>
            <h2 style={{ marginBottom: 8 }}>Import Complete</h2>
            <p style={{ fontSize: 14, color: 'var(--gray-500)', marginBottom: 16 }}>
              <span style={{ color: 'var(--green)', fontWeight: 600 }}>{results.success} succeeded</span>
              {results.failed > 0 && <>, <span style={{ color: 'var(--red)', fontWeight: 600 }}>{results.failed} failed</span></>}
            </p>
            {results.errors.length > 0 && (
              <div style={{ textAlign: 'left', marginBottom: 16 }}>
                {results.errors.map((err, i) => <p key={i} className="error-msg" style={{ fontSize: 13 }}>{err}</p>)}
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => router.push('/kyc')}>View All Requests</button>
              <button className="btn btn-secondary" onClick={() => { setCsvRows([]); setCsvHeaders([]); setResults(null); setErrors([]); if (fileRef.current) fileRef.current.value = ''; }}>Import More</button>
            </div>
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}

export default function BulkImportPage() {
  return <AuthProvider><BulkImportContent /></AuthProvider>;
}
