'use client';
import { useState, useEffect } from 'react';
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

function DashboardContent() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  useEffect(() => {
    kycApi.stats().then(setStats).catch((e) => setError(e.message));
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

  return (
    <ProtectedLayout roles={['Admin', 'KYC Team']}>
      <div className="container" style={{ paddingTop: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>KYC Dashboard</h1>
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
        {stats ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            {STAT_CONFIG.map((s) => (
              <div key={s.key} className="card" style={{ textAlign: 'center', borderTop: `3px solid ${s.color}` }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: s.color }}>{stats[s.key] ?? 0}</div>
                <div style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        ) : !error ? (
          <p style={{ color: 'var(--gray-400)' }}>Loading statistics...</p>
        ) : null}
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
