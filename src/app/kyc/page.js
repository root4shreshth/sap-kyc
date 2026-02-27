'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AuthProvider, useAuth } from '@/components/AuthProvider';
import ProtectedLayout from '@/components/ProtectedLayout';
import { kycApi } from '@/lib/api-client';

function statusBadge(status) {
  const map = {
    Pending: 'badge-pending', Submitted: 'badge-submitted',
    'Under Review': 'badge-review', Approved: 'badge-approved', Rejected: 'badge-rejected',
  };
  return <span className={`badge ${map[status] || ''}`}>{status}</span>;
}

function KycListContent() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    kycApi.list().then(setRows).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const filtered = search
    ? rows.filter((r) =>
        r.clientName.toLowerCase().includes(search.toLowerCase()) ||
        r.companyName.toLowerCase().includes(search.toLowerCase()) ||
        r.email.toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  return (
    <ProtectedLayout roles={['Admin', 'KYC Team']}>
      <div style={{ padding: '32px 32px 48px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--navy)' }}>KYC Requests</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client, company, email..."
              style={{
                padding: '8px 12px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)',
                fontSize: 13, width: 240,
              }}
            />
            {user?.role === 'Admin' && (
              <Link href="/kyc/new" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>
                + New Request
              </Link>
            )}
          </div>
        </div>
        {error && <p className="error-msg">{error}</p>}
        {loading ? (
          <p style={{ color: 'var(--gray-400)' }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 48 }}>
            {search ? 'No matching requests.' : 'No KYC requests yet.'}
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Client</th><th>Company</th><th>Email</th><th>Status</th><th>SAP</th><th>Created</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{r.clientName}</td>
                    <td>{r.companyName}</td>
                    <td style={{ color: 'var(--gray-500)', fontSize: 13 }}>{r.email}</td>
                    <td>{statusBadge(r.status)}</td>
                    <td>
                      {r.sapCardCode ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                          background: '#dcfce7', color: '#16a34a',
                        }}>
                          ✓ {r.sapCardCode}
                        </span>
                      ) : r.sapSyncError ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                          background: '#fee2e2', color: '#dc2626',
                        }}>
                          ✗ Failed
                        </span>
                      ) : r.status === 'Approved' ? (
                        <span style={{
                          padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                          background: '#fef3c7', color: '#d97706',
                        }}>
                          Pending
                        </span>
                      ) : (
                        <span style={{ color: 'var(--gray-300)', fontSize: 12 }}>—</span>
                      )}
                    </td>
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

export default function KycListPage() {
  return <AuthProvider><KycListContent /></AuthProvider>;
}
