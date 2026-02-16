'use client';
import { useState, useEffect } from 'react';
import { AuthProvider } from '@/components/AuthProvider';
import ProtectedLayout from '@/components/ProtectedLayout';
import { kycApi } from '@/lib/api-client';

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

  useEffect(() => {
    kycApi.stats().then(setStats).catch((e) => setError(e.message));
  }, []);

  return (
    <ProtectedLayout roles={['Admin', 'KYC Team']}>
      <div className="container" style={{ paddingTop: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>KYC Dashboard</h1>
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
