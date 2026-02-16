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

  useEffect(() => {
    kycApi.list().then(setRows).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  return (
    <ProtectedLayout roles={['Admin', 'KYC Team']}>
      <div className="container" style={{ paddingTop: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>KYC Requests</h1>
          {user?.role === 'Admin' && (
            <Link href="/kyc/new" className="btn btn-primary">+ New Request</Link>
          )}
        </div>
        {error && <p className="error-msg">{error}</p>}
        {loading ? (
          <p style={{ color: 'var(--gray-400)' }}>Loading...</p>
        ) : rows.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 48 }}>
            No KYC requests yet.
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
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.clientName}</td>
                    <td>{r.companyName}</td>
                    <td style={{ color: 'var(--gray-500)' }}>{r.email}</td>
                    <td>{statusBadge(r.status)}</td>
                    <td style={{ color: 'var(--gray-500)' }}>{new Date(r.createdAt).toLocaleDateString()}</td>
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
