'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { sapApi } from '@/lib/api-client';

// ===== HELPERS =====
const SAP_STATUS = {
  synced: { bg: '#dcfce7', text: '#166534', border: '#86efac', label: 'Synced' },
  failed: { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5', label: 'Failed' },
  pending: { bg: '#fff7ed', text: '#9a3412', border: '#fdba74', label: 'Pending Sync' },
};

function SapStatusBadge({ entry }) {
  const status = entry.sapCardCode ? 'synced' : entry.sapSyncError ? 'failed' : 'pending';
  const s = SAP_STATUS[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: 0.5,
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
    }}>
      <span style={{ fontSize: 8 }}>{status === 'synced' ? '●' : status === 'failed' ? '●' : '●'}</span>
      {s.label}
    </span>
  );
}

function BpTypeBadge({ type }) {
  const isC = type === 'customer';
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
      background: isC ? '#dbeafe' : '#fce7f3', color: isC ? '#1d4ed8' : '#be185d',
    }}>
      {isC ? '👤 Customer' : '🏭 Vendor'}
    </span>
  );
}

// ===== DATA ROW =====
function DataRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0', fontSize: 13 }}>
      <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ color: '#6b7280', minWidth: 120, flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#1f2937', fontWeight: 500, wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

// ===== KYC CARD COMPONENT =====
function KycSapCard({ entry, onPush, pushing, onExpand, expanded }) {
  const [bpType, setBpType] = useState(entry.sapBpType || 'customer');
  const isSynced = !!entry.sapCardCode;
  const isFailed = !isSynced && !!entry.sapSyncError;
  const isPending = !isSynced && !isFailed;

  const borderColor = isSynced ? '#86efac' : isFailed ? '#fca5a5' : '#e5e7eb';
  const headerBg = isSynced
    ? 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)'
    : isFailed
      ? 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)'
      : 'white';

  return (
    <div style={{
      background: 'white',
      borderRadius: 16,
      border: `1.5px solid ${borderColor}`,
      overflow: 'hidden',
      transition: 'all 0.2s',
    }}>
      {/* Card Header — always visible */}
      <div
        onClick={() => onExpand(entry.id)}
        style={{
          padding: '16px 20px',
          background: headerBg,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {/* Company Avatar */}
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: isSynced ? '#dcfce7' : isFailed ? '#fef2f2' : 'linear-gradient(135deg, #2563eb, #7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: isSynced || isFailed ? 20 : 18,
          color: 'white', fontWeight: 700, flexShrink: 0,
        }}>
          {isSynced ? '✅' : isFailed ? '❌' : (entry.clientName || entry.companyName || '?')[0].toUpperCase()}
        </div>

        {/* Main Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1f2937' }}>
              {entry.clientName || entry.companyName}
            </div>
            {entry.companyName && entry.clientName && entry.companyName !== entry.clientName && (
              <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 400 }}>({entry.companyName})</span>
            )}
            <SapStatusBadge entry={entry} />
          </div>
          {entry.businessName && entry.businessName !== entry.companyName && (
            <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 500, marginTop: 2 }}>
              🏢 {entry.businessName}
            </div>
          )}
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span>{entry.email}</span>
            {entry.country && <span>📍 {entry.country}</span>}
            {entry.businessPhone && <span>📞 {entry.businessPhone}</span>}
          </div>
          {isSynced && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <code style={{ fontSize: 12, background: '#dcfce7', padding: '2px 8px', borderRadius: 4, color: '#166534', fontWeight: 600 }}>
                {entry.sapCardCode}
              </code>
              <BpTypeBadge type={entry.sapBpType} />
              <span style={{ fontSize: 11, color: '#9ca3af' }}>
                Synced {new Date(entry.sapSyncedAt).toLocaleDateString()}
              </span>
            </div>
          )}
          {isFailed && (
            <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4, maxWidth: 500 }}>
              ⚠️ {entry.sapSyncError}
            </div>
          )}
        </div>

        {/* Expand Arrow */}
        <span style={{ fontSize: 18, color: '#9ca3af', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}>
          ▼
        </span>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div style={{ borderTop: '1px solid #f3f4f6' }}>
          {/* Data Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            {/* Left: Business Info */}
            <div style={{ padding: '16px 20px', borderRight: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                🏢 Business Information
              </div>
              <DataRow icon="🏢" label="Company" value={entry.businessName || entry.companyName} />
              <DataRow icon="📧" label="Email" value={entry.companyEmail || entry.email} />
              <DataRow icon="📞" label="Phone" value={entry.businessPhone} />
              <DataRow icon="📍" label="Address" value={entry.businessAddress} />
              <DataRow icon="🌆" label="City" value={entry.city} />
              <DataRow icon="🌍" label="Country" value={entry.country} />
              <DataRow icon="📊" label="Annual Sales" value={entry.annualSales} />
              <DataRow icon="🗓️" label="Years in Business" value={entry.yearsInBusiness} />
              <DataRow icon="🏭" label="Nature" value={entry.natureOfBusiness} />
              <DataRow icon="👥" label="Employees" value={entry.numberOfEmployees} />
              <DataRow icon="🔗" label="LinkedIn" value={entry.linkedin} />
            </div>

            {/* Right: Registration & Contacts */}
            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                📋 Registration & Contacts
              </div>
              <DataRow icon="📜" label="Trade License" value={entry.tradeLicenseNo} />
              <DataRow icon="💰" label="VAT No" value={entry.vatRegistrationNo} />
              <DataRow icon="🏠" label="Reg. Office" value={entry.registeredOfficeAddress} />

              <div style={{ height: 12 }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0891b2', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                👤 Manager & AP Contact
              </div>
              <DataRow icon="👤" label="Manager" value={entry.managerName} />
              <DataRow icon="📧" label="Manager Email" value={entry.managerEmail} />
              <DataRow icon="📞" label="Manager Phone" value={entry.managerPhone} />
              <DataRow icon="👤" label="AP Contact" value={entry.apContactName} />
              <DataRow icon="📧" label="AP Email" value={entry.apContactEmail} />
            </div>
          </div>

          {/* Owners Section */}
          {entry.owners && entry.owners.length > 0 && (
            <div style={{ padding: '0 20px 12px', borderTop: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: 0.5, padding: '12px 0 8px' }}>
                👥 Owners / Directors ({entry.owners.length})
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {entry.owners.map((o, i) => (
                  <div key={i} style={{
                    flex: '1 1 220px', padding: '10px 14px', background: '#fef9c3', borderRadius: 10,
                    border: '1px solid #fde047', fontSize: 12,
                  }}>
                    <div style={{ fontWeight: 700, color: '#1f2937' }}>{o.name || '—'}</div>
                    <div style={{ color: '#6b7280', marginTop: 2 }}>
                      {o.designation && <span>{o.designation}</span>}
                      {o.nationality && <span> · {o.nationality}</span>}
                      {o.shareholding && <span> · {o.shareholding}%</span>}
                    </div>
                    {o.email && <div style={{ color: '#4b5563', marginTop: 2 }}>📧 {o.email}</div>}
                    {o.phone && <div style={{ color: '#4b5563' }}>📞 {o.phone}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Banks Section */}
          {entry.banks && entry.banks.length > 0 && (
            <div style={{ padding: '0 20px 12px', borderTop: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: 0.5, padding: '12px 0 8px' }}>
                🏦 Bank Accounts ({entry.banks.length})
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {entry.banks.map((b, i) => (
                  <div key={i} style={{
                    flex: '1 1 250px', padding: '10px 14px', background: '#f0fdf4', borderRadius: 10,
                    border: '1px solid #bbf7d0', fontSize: 12,
                  }}>
                    <div style={{ fontWeight: 700, color: '#1f2937' }}>{b.bankName || '—'}</div>
                    {b.branch && <div style={{ color: '#6b7280' }}>Branch: {b.branch}</div>}
                    {b.accountNo && <div style={{ color: '#4b5563' }}>Acct: {b.accountNo}</div>}
                    {b.iban && <div style={{ color: '#4b5563' }}>IBAN: {b.iban}</div>}
                    {b.swift && <div style={{ color: '#4b5563' }}>SWIFT: {b.swift}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warehouses */}
          {entry.warehouses && entry.warehouses.length > 0 && (
            <div style={{ padding: '0 20px 12px', borderTop: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, padding: '12px 0 8px' }}>
                🏭 Warehouse Addresses ({entry.warehouses.length})
              </div>
              {entry.warehouses.map((addr, i) => (
                <div key={i} style={{ fontSize: 13, color: '#374151', padding: '3px 0' }}>📍 {addr}</div>
              ))}
            </div>
          )}

          {/* Push to SAP Action Bar */}
          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid #e5e7eb',
            background: '#f9fafb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            {isSynced ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                <span style={{ fontSize: 20 }}>✅</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#166534', fontSize: 14 }}>
                    Synced to SAP as {entry.sapCardCode}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {entry.sapBpType === 'customer' ? 'Customer' : 'Vendor'} · Synced {new Date(entry.sapSyncedAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                  <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>Push as:</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['customer', 'vendor'].map(t => (
                      <button key={t} onClick={() => setBpType(t)} style={{
                        padding: '6px 16px', borderRadius: 8,
                        border: bpType === t ? '2px solid #2563eb' : '1px solid #d1d5db',
                        background: bpType === t ? '#dbeafe' : 'white',
                        color: bpType === t ? '#1d4ed8' : '#4b5563',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}>
                        {t === 'customer' ? '👤 Customer' : '🏭 Vendor'}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={() => onPush(entry.id, bpType, true)}
                    disabled={pushing === entry.id}
                    title="Send only CardCode, CardName, CardType — for testing SAP connection"
                    style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: '1px solid #d1d5db',
                      background: 'white',
                      color: '#4b5563',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: pushing === entry.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    🧪 Test (Minimal)
                  </button>
                  <button
                    onClick={() => onPush(entry.id, bpType)}
                    disabled={pushing === entry.id}
                    style={{
                      padding: '10px 24px',
                      borderRadius: 10,
                      border: 'none',
                      background: pushing === entry.id
                        ? '#9ca3af'
                        : isFailed
                          ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                          : 'linear-gradient(135deg, #2563eb, #7c3aed)',
                      color: 'white',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: pushing === entry.id ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                      minWidth: 180,
                      justifyContent: 'center',
                      boxShadow: pushing === entry.id ? 'none' : '0 4px 12px rgba(37,99,235,0.3)',
                    }}
                  >
                    {pushing === entry.id ? (
                      <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> Pushing...</>
                    ) : isFailed ? (
                      <>🔄 Retry (Full Data)</>
                    ) : (
                      <>🚀 Push to SAP</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== CONNECTION PANEL (Compact) =====
function ConnectionPanel({ config, onTestConnection }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const handleTest = async () => {
    setTesting(true); setResult(null);
    try { setResult(await sapApi.testConnection()); }
    catch (err) { setResult({ success: false, error: err.message }); }
    setTesting(false);
    if (onTestConnection) onTestConnection();
  };

  return (
    <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
      <div style={{
        background: config?.configured ? 'linear-gradient(135deg, #065f46, #047857)' : 'linear-gradient(135deg, #991b1b, #dc2626)',
        padding: '16px 20px', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>SAP B1 Service Layer</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{config?.configured ? '🟢 Connected' : '🔴 Not Configured'}</div>
        </div>
        {config?.configured && (
          <div style={{ fontSize: 11, opacity: 0.7, textAlign: 'right' }}>
            {config.sapBaseUrl}<br />{config.sapCompanyDb}
          </div>
        )}
      </div>
      <div style={{ padding: '12px 20px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={handleTest} disabled={testing || !config?.configured} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none',
          background: testing ? '#9ca3af' : '#2563eb', color: 'white',
          fontSize: 13, fontWeight: 600, cursor: testing ? 'not-allowed' : 'pointer',
        }}>
          {testing ? '⟳ Testing...' : '⚡ Test Connection'}
        </button>
        {result && (
          <span style={{ fontSize: 13, color: result.success ? '#166534' : '#dc2626', fontWeight: 600 }}>
            {result.success ? `✅ OK (${result.loginTimeMs}ms)` : `❌ ${result.error}`}
          </span>
        )}
      </div>
    </div>
  );
}

// ===== STAT CARD =====
function StatCard({ label, value, icon, color, onClick, active }) {
  return (
    <div onClick={onClick} style={{
      background: active ? color + '10' : 'white',
      borderRadius: 12, border: `1.5px solid ${active ? color : '#e5e7eb'}`,
      padding: '16px 20px', flex: 1, minWidth: 130,
      cursor: onClick ? 'pointer' : 'default', transition: 'all 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <span style={{ background: color + '20', color, padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#1a1a2e', letterSpacing: -1 }}>{value}</div>
    </div>
  );
}

// ===== MAIN PAGE =====
export default function SapDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pushing, setPushing] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState('all'); // all, pending, synced, failed
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [dashData, queueData] = await Promise.all([
        sapApi.dashboard(),
        sapApi.queue(),
      ]);
      setDashboard(dashData);
      setQueue(queueData || []);
      setError('');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handlePush = async (kycId, bpType, minimal = false) => {
    setPushing(kycId);
    try {
      const result = await sapApi.pushToSap(kycId, bpType, minimal);
      alert(`✅ Success! ${result.message || `CardCode: ${result.cardCode}`}`);
      await loadData();
    } catch (err) {
      alert(`SAP Push Error: ${err.message}`);
      await loadData();
    }
    setPushing(null);
  };

  const handleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Filter queue
  const filteredQueue = queue.filter(entry => {
    // Status filter
    if (filter === 'synced' && !entry.sapCardCode) return false;
    if (filter === 'failed' && (!entry.sapSyncError || entry.sapCardCode)) return false;
    if (filter === 'pending' && (entry.sapCardCode || entry.sapSyncError)) return false;
    // Search filter
    if (search) {
      const s = search.toLowerCase();
      const searchable = [entry.companyName, entry.businessName, entry.email, entry.clientName, entry.sapCardCode, entry.country].join(' ').toLowerCase();
      if (!searchable.includes(s)) return false;
    }
    return true;
  });

  const stats = dashboard?.stats || {};

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16, animation: 'pulse 2s ease-in-out infinite' }}>🔗</div>
        <div style={{ fontSize: 16, color: '#6b7280' }}>Loading SAP workspace...</div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: 20, color: '#991b1b' }}>
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#9ca3af', textDecoration: 'none', marginBottom: 16 }}>
        <span style={{ fontSize: 16 }}>←</span> Back to Dashboard
      </Link>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        borderRadius: 20, padding: '28px 32px', marginBottom: 24,
        color: 'white', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(37,99,235,0.15)' }} />
        <div style={{ position: 'absolute', bottom: -30, right: 80, width: 80, height: 80, borderRadius: '50%', background: 'rgba(37,99,235,0.1)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>SAP B1 Integration</div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>SAP Workspace</h1>
            <div style={{ fontSize: 13, opacity: 0.6, marginTop: 6 }}>
              Push approved KYC records to SAP as Business Partners
            </div>
          </div>
          <button onClick={loadData} style={{
            padding: '8px 16px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)',
            color: 'white', fontSize: 13, cursor: 'pointer',
          }}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Connection Panel */}
      <div style={{ marginBottom: 20 }}>
        <ConnectionPanel config={dashboard} onTestConnection={loadData} />
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard label="All" value={stats.totalApproved || 0} icon="📋" color="#2563eb"
          onClick={() => setFilter('all')} active={filter === 'all'} />
        <StatCard label="Synced" value={stats.totalSynced || 0} icon="✅" color="#16a34a"
          onClick={() => setFilter('synced')} active={filter === 'synced'} />
        <StatCard label="Failed" value={stats.totalFailed || 0} icon="❌" color="#dc2626"
          onClick={() => setFilter('failed')} active={filter === 'failed'} />
        <StatCard label="Pending" value={stats.totalPending || 0} icon="⏳" color="#f59e0b"
          onClick={() => setFilter('pending')} active={filter === 'pending'} />
      </div>

      {/* Search + Action Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
        background: 'white', padding: '12px 16px', borderRadius: 12,
        border: '1px solid #e5e7eb',
      }}>
        <span style={{ fontSize: 18 }}>🔍</span>
        <input
          type="text"
          placeholder="Search by company, email, country, card code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 8,
            border: '1px solid #e5e7eb', fontSize: 14, outline: 'none',
          }}
        />
        <span style={{ fontSize: 13, color: '#9ca3af', whiteSpace: 'nowrap' }}>
          {filteredQueue.length} of {queue.length} records
        </span>
      </div>

      {/* Queue Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredQueue.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '48px 20px', color: '#9ca3af',
            background: 'white', borderRadius: 16, border: '1px solid #e5e7eb',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>
              {filter === 'all' ? '📭' : filter === 'synced' ? '✅' : filter === 'failed' ? '❌' : '⏳'}
            </div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>
              {filter === 'all' ? 'No approved KYC records found' :
                filter === 'synced' ? 'No synced records yet' :
                  filter === 'failed' ? 'No failed syncs — all clear!' :
                    'No pending syncs'}
            </div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              {filter === 'all' ? 'Approve KYC requests to see them here' : 'Try changing the filter above'}
            </div>
          </div>
        ) : (
          filteredQueue.map(entry => (
            <KycSapCard
              key={entry.id}
              entry={entry}
              onPush={handlePush}
              pushing={pushing}
              onExpand={handleExpand}
              expanded={expandedId === entry.id}
            />
          ))
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}
