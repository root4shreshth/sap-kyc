'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AuthProvider } from '@/components/AuthProvider';
import ProtectedLayout from '@/components/ProtectedLayout';
import { teamApi } from '@/lib/api-client';

function TeamContent() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'KYC Team', canSendKyc: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadMembers(); }, []);

  async function loadMembers() {
    setLoading(true);
    try {
      const data = await teamApi.list();
      setMembers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await teamApi.create(form);
      setForm({ name: '', email: '', password: '', role: 'KYC Team', canSendKyc: false });
      setShowCreate(false);
      await loadMembers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleField(member, field) {
    try {
      await teamApi.update(member.id, { [field]: !member[field] });
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, [field]: !m[field] } : m));
    } catch (err) {
      setError(err.message);
    }
  }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  return (
    <ProtectedLayout roles={['Admin']}>
      <div className="container" style={{ paddingTop: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>Team Management</h1>
          <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Cancel' : '+ Add Member'}
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>New Team Member</h3>
            <form onSubmit={handleCreate}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Full Name</label>
                  <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="John Doe" />
                </div>
                <div className="form-group">
                  <label>Email <span style={{ color: 'var(--red)' }}>*</span></label>
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required placeholder="john@company.com" />
                </div>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Temporary Password <span style={{ color: 'var(--red)' }}>*</span></label>
                  <input type="password" value={form.password} onChange={e => set('password', e.target.value)} required minLength={6} placeholder="Min 6 characters" />
                </div>
                <div className="form-group">
                  <label>Role <span style={{ color: 'var(--red)' }}>*</span></label>
                  <select value={form.role} onChange={e => set('role', e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', fontSize: 14 }}>
                    <option value="KYC Team">KYC Team</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 16 }}>
                <input type="checkbox" checked={form.canSendKyc} onChange={e => set('canSendKyc', e.target.checked)} style={{ width: 16, height: 16 }} />
                Can send KYC requests
              </label>
              {error && <p className="error-msg">{error}</p>}
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Creating...' : 'Create Member'}
              </button>
            </form>
          </div>
        )}

        {/* Team table */}
        {loading ? (
          <p style={{ color: 'var(--gray-400)' }}>Loading...</p>
        ) : members.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>
            <p>No team members yet.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 20 }}>Member</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Can Send KYC</th>
                  <th>KYC Stats</th>
                  <th>Last Login</th>
                  <th style={{ paddingRight: 20 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id}>
                    <td style={{ paddingLeft: 20 }}>
                      <div style={{ fontWeight: 500 }}>{m.name || m.email}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                        {m.name ? m.email : ''}
                        {m.designation && <span>{m.name ? ' · ' : ''}{m.designation}</span>}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${m.role === 'Admin' ? 'badge-approved' : 'badge-pending'}`}>
                        {m.role}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => toggleField(m, 'isActive')}
                        style={{
                          padding: '4px 10px', fontSize: 12, borderRadius: 20, border: 'none', cursor: 'pointer',
                          background: m.isActive ? '#dcfce7' : '#fee2e2',
                          color: m.isActive ? '#16a34a' : '#dc2626',
                          fontWeight: 500,
                        }}
                      >
                        {m.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td>
                      <button
                        onClick={() => toggleField(m, 'canSendKyc')}
                        style={{
                          padding: '4px 10px', fontSize: 12, borderRadius: 20, border: 'none', cursor: 'pointer',
                          background: m.canSendKyc ? '#dbeafe' : '#f3f4f6',
                          color: m.canSendKyc ? '#2563eb' : '#9ca3af',
                          fontWeight: 500,
                        }}
                      >
                        {m.canSendKyc ? 'Yes' : 'No'}
                      </button>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>
                        <span style={{ color: 'var(--blue)' }}>{m.kycCreated || 0} created</span>
                        {' / '}
                        <span style={{ color: 'var(--green)' }}>{m.kycApproved || 0} approved</span>
                        {' / '}
                        <span style={{ color: 'var(--red)' }}>{m.kycRejected || 0} rejected</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 13, color: 'var(--gray-400)' }}>
                        {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleDateString() : 'Never'}
                      </span>
                    </td>
                    <td style={{ paddingRight: 20 }}>
                      <Link href={`/team/${m.id}`} className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: 12 }}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!showCreate && error && <p className="error-msg" style={{ marginTop: 12 }}>{error}</p>}
      </div>
    </ProtectedLayout>
  );
}

export default function TeamPage() {
  return <AuthProvider><TeamContent /></AuthProvider>;
}
