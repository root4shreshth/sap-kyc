'use client';
import { useState, useEffect, useCallback } from 'react';
import { sapApi } from '@/lib/api-client';

// ===== STATUS HELPERS =====
const STATUS_COLORS = {
  success: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  failed: { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5' },
  processing: { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
  pending: { bg: '#f0f9ff', text: '#1e40af', border: '#93c5fd' },
};

function StatusBadge({ status }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      background: colors.bg,
      color: colors.text,
      border: `1px solid ${colors.border}`,
    }}>
      {status}
    </span>
  );
}

function BpTypeBadge({ type }) {
  const isCustomer = type === 'customer';
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      background: isCustomer ? '#dbeafe' : '#fce7f3',
      color: isCustomer ? '#1d4ed8' : '#be185d',
    }}>
      {isCustomer ? 'Customer' : 'Vendor'}
    </span>
  );
}

// ===== CONNECTION STATUS COMPONENT =====
function ConnectionPanel({ config, onTestConnection }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await sapApi.testConnection();
      setResult(res);
    } catch (err) {
      setResult({ success: false, error: err.message });
    }
    setTesting(false);
    if (onTestConnection) onTestConnection();
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: 16,
      border: '1px solid #e5e7eb',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: config?.configured
          ? 'linear-gradient(135deg, #065f46 0%, #047857 100%)'
          : 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)',
        padding: '20px 24px',
        color: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 4 }}>SAP B1 Service Layer</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {config?.configured ? 'Configured' : 'Not Configured'}
            </div>
          </div>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24,
          }}>
            {config?.configured ? '🟢' : '🔴'}
          </div>
        </div>
      </div>

      {/* Details */}
      <div style={{ padding: '16px 24px' }}>
        {config?.configured && (
          <div style={{ marginBottom: 16 }}>
            <InfoRow label="Base URL" value={config.sapBaseUrl || '—'} />
            <InfoRow label="Company DB" value={config.sapCompanyDb || '—'} />
          </div>
        )}

        {!config?.configured && (
          <div style={{
            padding: 12, background: '#fef2f2', borderRadius: 8, marginBottom: 16,
            color: '#991b1b', fontSize: 13, lineHeight: 1.5,
          }}>
            SAP integration requires these environment variables:<br />
            <code style={{ fontSize: 12 }}>SAP_BASE_URL, SAP_COMPANY_DB, SAP_USERNAME, SAP_PASSWORD</code>
          </div>
        )}

        <button
          onClick={handleTest}
          disabled={testing || !config?.configured}
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: 8,
            border: 'none',
            background: testing ? '#9ca3af' : config?.configured ? '#2563eb' : '#d1d5db',
            color: 'white',
            fontSize: 14,
            fontWeight: 600,
            cursor: testing || !config?.configured ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {testing ? (
            <>
              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
              Testing Connection...
            </>
          ) : (
            <>⚡ Test Connection</>
          )}
        </button>

        {/* Result */}
        {result && (
          <div style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 8,
            background: result.success ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${result.success ? '#86efac' : '#fca5a5'}`,
            fontSize: 13,
          }}>
            <div style={{
              fontWeight: 700,
              color: result.success ? '#166534' : '#991b1b',
              marginBottom: 6,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {result.success ? '✅ Connection Successful' : '❌ Connection Failed'}
            </div>
            {result.success ? (
              <div style={{ color: '#374151', lineHeight: 1.6 }}>
                <div>Session ID: <code style={{ fontSize: 11 }}>{result.sessionId}</code></div>
                <div>Login Time: <strong>{result.loginTimeMs}ms</strong></div>
                <div>Session Timeout: <strong>{result.sessionTimeout} min</strong></div>
              </div>
            ) : (
              <div style={{ color: '#991b1b', lineHeight: 1.6 }}>
                <div>{result.error}</div>
                {result.suggestions && (
                  <div style={{ marginTop: 6, padding: 8, background: '#fff7ed', borderRadius: 4, color: '#92400e', fontSize: 12 }}>
                    💡 {result.suggestions}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== STATS CARDS =====
function StatCard({ label, value, icon, color, subText }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: 12,
      border: '1px solid #e5e7eb',
      padding: '20px',
      flex: 1,
      minWidth: 140,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
        <span style={{
          background: color + '20',
          color: color,
          padding: '2px 8px',
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 700,
        }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: '#1a1a2e', letterSpacing: -1 }}>{value}</div>
      {subText && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{subText}</div>}
    </div>
  );
}

// ===== SYNC QUEUE TABLE =====
function SyncQueueTable({ entries, onRetry, retrying }) {
  if (!entries || entries.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
        <div style={{ fontSize: 15, fontWeight: 500 }}>No SAP sync entries yet</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>Approve KYC requests to push Business Partners to SAP</div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
            {['Company', 'Card Code', 'Type', 'Status', 'Triggered By', 'Duration', 'Time', 'Actions'].map(h => (
              <th key={h} style={{
                padding: '10px 12px',
                textAlign: 'left',
                fontSize: 11,
                fontWeight: 700,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id || entry.kycId} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '10px 12px' }}>
                <div style={{ fontWeight: 600, color: '#1f2937' }}>{entry.companyName || '—'}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>{entry.kycEmail || entry.clientName || ''}</div>
              </td>
              <td style={{ padding: '10px 12px' }}>
                {entry.cardCode ? (
                  <code style={{ fontSize: 12, background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
                    {entry.cardCode}
                  </code>
                ) : '—'}
              </td>
              <td style={{ padding: '10px 12px' }}>
                {entry.bpType ? <BpTypeBadge type={entry.bpType} /> : '—'}
              </td>
              <td style={{ padding: '10px 12px' }}>
                <StatusBadge status={entry.status} />
              </td>
              <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>
                {entry.triggeredBy || '—'}
              </td>
              <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>
                {entry.durationMs ? `${entry.durationMs}ms` : '—'}
              </td>
              <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>
                {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '—'}
              </td>
              <td style={{ padding: '10px 12px' }}>
                {entry.status === 'failed' && entry.kycId && (
                  <button
                    onClick={() => onRetry(entry)}
                    disabled={retrying === entry.kycId}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: '1px solid #f97316',
                      background: retrying === entry.kycId ? '#fed7aa' : '#fff7ed',
                      color: '#ea580c',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: retrying === entry.kycId ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {retrying === entry.kycId ? 'Retrying...' : '🔄 Retry'}
                  </button>
                )}
                {entry.status === 'failed' && entry.errorMessage && (
                  <div style={{
                    marginTop: 4,
                    fontSize: 11,
                    color: '#dc2626',
                    maxWidth: 200,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                    title={entry.errorMessage}
                  >
                    {entry.errorMessage}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ===== FAILED ENTRIES FROM KYC TABLE =====
function FailedEntriesPanel({ entries, onRetry, retrying }) {
  if (!entries || entries.length === 0) return null;

  return (
    <div style={{
      background: 'white',
      borderRadius: 16,
      border: '1px solid #fca5a5',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 24px',
        background: 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)',
        borderBottom: '1px solid #fca5a5',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 20 }}>🚨</span>
        <div>
          <div style={{ fontWeight: 700, color: '#991b1b', fontSize: 15 }}>Failed SAP Syncs</div>
          <div style={{ fontSize: 12, color: '#b91c1c' }}>
            {entries.length} KYC record{entries.length > 1 ? 's' : ''} failed to sync — review and retry below
          </div>
        </div>
      </div>
      <div style={{ padding: 16 }}>
        {entries.map((entry) => (
          <div key={entry.id} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            marginBottom: 8,
            borderRadius: 10,
            background: '#fef2f2',
            border: '1px solid #fecaca',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#1f2937', fontSize: 14 }}>{entry.companyName}</div>
              <div style={{ fontSize: 12, color: '#dc2626', marginTop: 2 }}>{entry.error}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {entry.bpType && <BpTypeBadge type={entry.bpType} />}
              <button
                onClick={() => onRetry({ kycId: entry.id, bpType: entry.bpType || 'customer' })}
                disabled={retrying === entry.id}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: retrying === entry.id ? '#9ca3af' : '#ef4444',
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: retrying === entry.id ? 'not-allowed' : 'pointer',
                }}
              >
                {retrying === entry.id ? 'Retrying...' : '🔄 Retry'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== RECENT SYNCS PANEL =====
function RecentSyncsPanel({ syncs }) {
  if (!syncs || syncs.length === 0) return null;

  return (
    <div style={{
      background: 'white',
      borderRadius: 16,
      border: '1px solid #e5e7eb',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 24px',
        background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
        borderBottom: '1px solid #bbf7d0',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 20 }}>✅</span>
        <div style={{ fontWeight: 700, color: '#166534', fontSize: 15 }}>Recent Successful Syncs</div>
      </div>
      <div style={{ padding: '8px 16px' }}>
        {syncs.map((s, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 8px',
            borderBottom: i < syncs.length - 1 ? '1px solid #f3f4f6' : 'none',
          }}>
            <div>
              <div style={{ fontWeight: 600, color: '#1f2937', fontSize: 13 }}>{s.companyName}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                <code style={{ fontSize: 11, background: '#f0fdf4', padding: '1px 6px', borderRadius: 4, color: '#166534' }}>
                  {s.cardCode}
                </code>
                <BpTypeBadge type={s.bpType} />
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'right' }}>
              {new Date(s.syncedAt).toLocaleDateString()}<br />
              <span style={{ fontSize: 11 }}>{new Date(s.syncedAt).toLocaleTimeString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== FIELD MAPPING PREVIEW =====
function FieldMappingPanel() {
  const [kycId, setKycId] = useState('');
  const [mapping, setMapping] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewType, setViewType] = useState('customer');

  const loadMapping = async () => {
    if (!kycId.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await sapApi.fieldMapping(kycId.trim());
      setMapping(data);
    } catch (err) {
      setError(err.message);
      setMapping(null);
    }
    setLoading(false);
  };

  const currentMapping = mapping ? (viewType === 'customer' ? mapping.customerMapping : mapping.vendorMapping) : null;

  return (
    <div style={{
      background: 'white',
      borderRadius: 16,
      border: '1px solid #e5e7eb',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 24px',
        background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
        borderBottom: '1px solid #93c5fd',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 20 }}>🗺️</span>
        <div style={{ fontWeight: 700, color: '#1e40af', fontSize: 15 }}>Field Mapping Preview</div>
      </div>
      <div style={{ padding: '16px 24px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Enter KYC ID to preview mapping..."
            value={kycId}
            onChange={(e) => setKycId(e.target.value)}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              fontSize: 13,
              outline: 'none',
            }}
            onKeyDown={(e) => e.key === 'Enter' && loadMapping()}
          />
          <button
            onClick={loadMapping}
            disabled={loading || !kycId.trim()}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: loading ? '#9ca3af' : '#2563eb',
              color: 'white',
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Loading...' : 'Preview'}
          </button>
        </div>

        {error && (
          <div style={{ padding: 10, background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {mapping && (
          <>
            {/* Validation status */}
            <div style={{
              padding: 10,
              borderRadius: 8,
              marginBottom: 12,
              background: mapping.validation?.valid ? '#f0fdf4' : '#fef2f2',
              color: mapping.validation?.valid ? '#166534' : '#dc2626',
              fontSize: 13,
            }}>
              {mapping.validation?.valid
                ? `✅ ${mapping.companyName} — Ready for SAP push (KYC: ${mapping.kycStatus})`
                : `❌ Validation failed: ${mapping.validation?.errors?.join(', ')}`}
            </div>

            {/* Type toggle */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              {['customer', 'vendor'].map(t => (
                <button key={t} onClick={() => setViewType(t)} style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1px solid #d1d5db',
                  background: viewType === t ? '#2563eb' : 'white',
                  color: viewType === t ? 'white' : '#4b5563',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}>
                  {t === 'customer' ? 'Customer' : 'Vendor'}
                </button>
              ))}
            </div>

            {/* Mapping table */}
            {currentMapping && (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                <MappingSection title="General" data={{
                  CardCode: currentMapping.CardCode,
                  CardName: currentMapping.CardName,
                  CardType: currentMapping.CardType,
                  Currency: currentMapping.Currency,
                  Country: currentMapping.Country,
                }} />
                <MappingSection title="Contact" data={{
                  Phone1: currentMapping.Phone1,
                  Phone2: currentMapping.Phone2,
                  EmailAddress: currentMapping.EmailAddress,
                  Website: currentMapping.Website,
                }} />
                <MappingSection title="Tax & Registration" data={{
                  FederalTaxID: currentMapping.FederalTaxID,
                  VatRegistrationNumber: currentMapping.VatRegistrationNumber,
                  FreeText: currentMapping.FreeText,
                }} />
                {currentMapping.BPAddresses?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#4b5563', marginBottom: 4 }}>
                      Addresses ({currentMapping.BPAddresses.length})
                    </div>
                    {currentMapping.BPAddresses.map((addr, i) => (
                      <div key={i} style={{ fontSize: 12, padding: '4px 8px', background: '#f9fafb', borderRadius: 4, marginBottom: 2, color: '#374151' }}>
                        <strong>{addr.AddressName}</strong>: {addr.Street}, {addr.City} {addr.ZipCode} ({addr.AddressType})
                      </div>
                    ))}
                  </div>
                )}
                {currentMapping.ContactEmployees?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#4b5563', marginBottom: 4 }}>
                      Contacts ({currentMapping.ContactEmployees.length})
                    </div>
                    {currentMapping.ContactEmployees.map((c, i) => (
                      <div key={i} style={{ fontSize: 12, padding: '4px 8px', background: '#f9fafb', borderRadius: 4, marginBottom: 2, color: '#374151' }}>
                        <strong>{c.Name}</strong> — {c.Title || 'No title'} | {c.E_Mail || 'No email'} | {c.Phone1 || 'No phone'}
                      </div>
                    ))}
                  </div>
                )}
                {currentMapping.BPBankAccounts?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#4b5563', marginBottom: 4 }}>
                      Bank Accounts ({currentMapping.BPBankAccounts.length})
                    </div>
                    {currentMapping.BPBankAccounts.map((b, i) => (
                      <div key={i} style={{ fontSize: 12, padding: '4px 8px', background: '#f9fafb', borderRadius: 4, marginBottom: 2, color: '#374151' }}>
                        <strong>{b.BankCode}</strong> | Acct: {b.AccountNo || '—'} | IBAN: {b.IBAN || '—'} | SWIFT: {b.BICSwiftCode || '—'}
                      </div>
                    ))}
                  </div>
                )}
                <MappingSection title="Notes" data={{ Notes: currentMapping.Notes }} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MappingSection({ title, data }) {
  const entries = Object.entries(data || {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#4b5563', marginBottom: 4 }}>{title}</div>
      {entries.map(([key, val]) => (
        <div key={key} style={{
          display: 'flex', gap: 8, padding: '3px 0', fontSize: 12,
          borderBottom: '1px solid #f3f4f6',
        }}>
          <span style={{ width: 160, flexShrink: 0, color: '#6b7280', fontWeight: 500 }}>{key}</span>
          <span style={{ color: '#1f2937', wordBreak: 'break-all' }}>{String(val)}</span>
        </div>
      ))}
    </div>
  );
}

// ===== INFO ROW HELPER =====
function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ fontSize: 13, color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#1f2937' }}>{value}</span>
    </div>
  );
}

// ===== ARCHITECTURE INFO PANEL =====
function ArchitecturePanel() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      background: 'white',
      borderRadius: 16,
      border: '1px solid #e5e7eb',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          padding: '16px 24px',
          background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
          border: 'none',
          borderBottom: open ? '1px solid #d8b4fe' : 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 20 }}>🏗️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: '#6b21a8', fontSize: 15 }}>Architecture & Setup Guide</div>
          <div style={{ fontSize: 12, color: '#7c3aed' }}>SAP connection, local connector, and deployment info</div>
        </div>
        <span style={{ color: '#7c3aed', fontSize: 18 }}>{open ? '▼' : '▶'}</span>
      </button>

      {open && (
        <div style={{ padding: '16px 24px', fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
          <h4 style={{ color: '#6b21a8', margin: '0 0 8px' }}>SAP B1 Service Layer Authentication</h4>
          <ul style={{ margin: '0 0 16px', paddingLeft: 20 }}>
            <li>Authenticates via <code>POST /b1s/v1/Login</code> with CompanyDB, UserName, Password</li>
            <li>Returns <strong>B1SESSION</strong> + <strong>ROUTEID</strong> cookies</li>
            <li>All subsequent API calls include these cookies</li>
            <li>Sessions auto-expire based on SAP server timeout</li>
          </ul>

          <h4 style={{ color: '#6b21a8', margin: '0 0 8px' }}>Network Architecture</h4>
          <div style={{
            padding: 12,
            background: '#faf5ff',
            borderRadius: 8,
            border: '1px solid #e9d5ff',
            marginBottom: 16,
            fontSize: 12,
            fontFamily: 'monospace',
            whiteSpace: 'pre-line',
          }}>
{`[Public Cloud - Netlify/Vercel]
  └── Alamir KYC Platform (this app)
        └── Stores approved KYC data in Supabase
              ↕ (Supabase is cloud-accessible)

[Private Network - SAP Server]
  └── SAP B1 Service Layer (192.168.x.x:50000)
        └── Accepts Business Partner creation
              ↕

[Local SAP Connector] (runs on SAP network)
  └── Polls Supabase for approved KYC records
  └── Pushes to SAP via Service Layer
  └── Updates sync status back to Supabase`}
          </div>

          <h4 style={{ color: '#6b21a8', margin: '0 0 8px' }}>Direct vs Connector Mode</h4>
          <ul style={{ margin: '0 0 16px', paddingLeft: 20 }}>
            <li><strong>Direct Mode</strong>: App connects directly to SAP (works when app and SAP are on same network)</li>
            <li><strong>Connector Mode</strong>: A lightweight service runs inside SAP network, polls Supabase for unsynced records, and pushes to SAP</li>
            <li>Current setup uses Direct Mode via <code>SAP_BASE_URL</code> environment variable</li>
          </ul>

          <h4 style={{ color: '#6b21a8', margin: '0 0 8px' }}>Environment Variables</h4>
          <div style={{
            padding: 12,
            background: '#f8fafc',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            fontSize: 12,
            fontFamily: 'monospace',
          }}>
            <div><span style={{ color: '#6b7280' }}># SAP B1 Service Layer</span></div>
            <div>SAP_BASE_URL=https://your-sap-host:50000</div>
            <div>SAP_COMPANY_DB=your_company_db</div>
            <div>SAP_USERNAME=your_username</div>
            <div>SAP_PASSWORD=your_password</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== MAIN PAGE =====
export default function SapDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const loadDashboard = useCallback(async () => {
    try {
      const data = await sapApi.dashboard();
      setDashboard(data);
      setError('');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleRetry = async (entry) => {
    const kycId = entry.kycId || entry.id;
    const bpType = entry.bpType || 'customer';
    setRetrying(kycId);
    try {
      await sapApi.retry(kycId, bpType);
      await loadDashboard();
    } catch (err) {
      alert(`Retry failed: ${err.message}`);
    }
    setRetrying(null);
  };

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16, animation: 'pulse 2s ease-in-out infinite' }}>🔗</div>
        <div style={{ fontSize: 16, color: '#6b7280' }}>Loading SAP workspace...</div>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: 20, color: '#991b1b' }}>
          <strong>Error loading SAP dashboard:</strong> {error}
        </div>
      </div>
    );
  }

  const stats = dashboard?.stats || {};
  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'sync-log', label: 'Sync Log', icon: '📋' },
    { id: 'mapping', label: 'Field Mapping', icon: '🗺️' },
    { id: 'setup', label: 'Setup Guide', icon: '🏗️' },
  ];

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        borderRadius: 20,
        padding: '28px 32px',
        marginBottom: 24,
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(37,99,235,0.15)' }} />
        <div style={{ position: 'absolute', bottom: -30, right: 80, width: 80, height: 80, borderRadius: '50%', background: 'rgba(37,99,235,0.1)' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>SAP B1 Integration</div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>
              SAP Workspace
            </h1>
            <div style={{ fontSize: 13, opacity: 0.6, marginTop: 6 }}>
              Monitor sync status, test connections, and manage Business Partner integration
            </div>
          </div>
          <button
            onClick={loadDashboard}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 24,
        background: '#f3f4f6',
        borderRadius: 12,
        padding: 4,
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === tab.id ? 'white' : 'transparent',
              color: activeTab === tab.id ? '#1f2937' : '#6b7280',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 700 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 15 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB: Overview */}
      {activeTab === 'overview' && (
        <>
          {/* Stats Row */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            <StatCard label="Approved" value={stats.totalApproved || 0} icon="📋" color="#2563eb" subText="Total approved KYCs" />
            <StatCard label="Synced" value={stats.totalSynced || 0} icon="✅" color="#16a34a" subText="Pushed to SAP" />
            <StatCard label="Failed" value={stats.totalFailed || 0} icon="❌" color="#dc2626" subText="Sync errors" />
            <StatCard label="Pending" value={stats.totalPending || 0} icon="⏳" color="#f59e0b" subText="Awaiting sync" />
          </div>

          {/* Two Column Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            <ConnectionPanel config={dashboard} onTestConnection={loadDashboard} />
            <RecentSyncsPanel syncs={stats.recentSyncs} />
          </div>

          {/* Failed Entries */}
          <FailedEntriesPanel entries={stats.failedEntries} onRetry={handleRetry} retrying={retrying} />
        </>
      )}

      {/* TAB: Sync Log */}
      {activeTab === 'sync-log' && (
        <div style={{
          background: 'white',
          borderRadius: 16,
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '16px 24px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>📋</span>
              <div style={{ fontWeight: 700, color: '#1f2937', fontSize: 15 }}>SAP Sync Log</div>
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>
              {dashboard?.recentLogs?.length || 0} entries
            </div>
          </div>
          <SyncQueueTable
            entries={dashboard?.recentLogs || []}
            onRetry={handleRetry}
            retrying={retrying}
          />
        </div>
      )}

      {/* TAB: Field Mapping */}
      {activeTab === 'mapping' && <FieldMappingPanel />}

      {/* TAB: Setup Guide */}
      {activeTab === 'setup' && <ArchitecturePanel />}

      {/* Animation styles */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}
