'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AuthProvider } from '@/components/AuthProvider';
import ProtectedLayout from '@/components/ProtectedLayout';
import { kycApi, sheetsApi } from '@/lib/api-client';

const STAT_CONFIG = [
  { key: 'Pending', label: 'Pending', color: '#f59e0b' },
  { key: 'Submitted', label: 'Submitted', color: '#2563eb' },
  { key: 'Under Review', label: 'Under Review', color: '#6366f1' },
  { key: 'Approved', label: 'Approved', color: '#16a34a' },
  { key: 'Rejected', label: 'Rejected', color: '#dc2626' },
];

function statusBadge(status) {
  const map = {
    Pending: 'badge-pending', Submitted: 'badge-submitted',
    'Under Review': 'badge-review', Approved: 'badge-approved', Rejected: 'badge-rejected',
  };
  return <span className={`badge ${map[status] || ''}`}>{status}</span>;
}

function DashboardContent() {
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  useEffect(() => {
    Promise.all([kycApi.stats(), kycApi.list()])
      .then(([s, r]) => {
        setStats(s);
        setRows(r);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSyncSheets() {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await sheetsApi.syncAll();
      const s = res.synced;
      setSyncMsg(`Synced: ${s.kyc} KYC records, ${s.forms} forms, ${s.compliance} compliance, ${s.docs} documents`);
    } catch (e) {
      setSyncMsg(`Sync failed: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  }

  const filteredRows = filter ? rows.filter((r) => r.status === filter) : rows;
  const total = rows.length;

  return (
    <ProtectedLayout roles={['Admin', 'KYC Team']}>
      <div style={{ padding: '32px 32px 48px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--navy)' }}>KYC Dashboard</h1>
            <p style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 2 }}>{total} total requests</p>
          </div>
          <button onClick={handleSyncSheets} disabled={syncing} style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 600,
            border: '1px solid var(--gray-200)', borderRadius: 8, cursor: syncing ? 'not-allowed' : 'pointer',
            background: syncing ? 'var(--gray-100)' : 'white', color: 'var(--navy)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 16 }}>📊</span>
            {syncing ? 'Syncing...' : 'Sync to Google Sheets'}
          </button>
        </div>
        {syncMsg && <p style={{ fontSize: 13, color: syncMsg.includes('failed') ? 'var(--red)' : 'var(--green)', marginBottom: 12 }}>{syncMsg}</p>}
        {error && <p className="error-msg">{error}</p>}

        {/* Stat Cards */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
            {STAT_CONFIG.map((s) => {
              const count = stats[s.key] ?? 0;
              const isActive = filter === s.key;
              return (
                <div
                  key={s.key}
                  onClick={() => setFilter(isActive ? null : s.key)}
                  className="card"
                  style={{
                    textAlign: 'center',
                    borderTop: `3px solid ${s.color}`,
                    cursor: 'pointer',
                    outline: isActive ? `2px solid ${s.color}` : 'none',
                    outlineOffset: -1,
                    transition: 'all 0.15s ease',
                    opacity: filter && !isActive ? 0.5 : 1,
                  }}
                >
                  <div style={{ fontSize: 32, fontWeight: 700, color: s.color }}>{count}</div>
                  <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>{s.label}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Filter indicator */}
        {filter && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
            fontSize: 14, color: 'var(--gray-600)',
          }}>
            <span>Showing <strong>{filteredRows.length}</strong> {filter} requests</span>
            <button
              onClick={() => setFilter(null)}
              style={{
                background: 'var(--gray-100)', border: '1px solid var(--gray-200)',
                borderRadius: 4, padding: '2px 8px', fontSize: 12, cursor: 'pointer',
                color: 'var(--gray-500)',
              }}
            >
              Clear filter
            </button>
          </div>
        )}

        {/* KYC Table */}
        {loading ? (
          <p style={{ color: 'var(--gray-400)' }}>Loading...</p>
        ) : filteredRows.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 48 }}>
            {filter ? `No ${filter} requests.` : 'No KYC requests yet.'}
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Client</th><th>Company</th><th>Email</th><th>Status</th><th>Created</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{r.clientName}</td>
                    <td>{r.companyName}</td>
                    <td style={{ color: 'var(--gray-500)', fontSize: 13 }}>{r.email}</td>
                    <td>{statusBadge(r.status)}</td>
                    <td style={{ color: 'var(--gray-500)', fontSize: 13 }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td>
                      <Link href={`/kyc/review/${r.id}`} className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: 13 }}>
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}

export default function DashboardPage() {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
}
