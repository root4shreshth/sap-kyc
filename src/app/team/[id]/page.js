'use client';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { AuthProvider } from '@/components/AuthProvider';
import ProtectedLayout from '@/components/ProtectedLayout';
import { teamApi } from '@/lib/api-client';

function MemberDetail({ id }) {
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadMember(); }, [id]);

  async function loadMember() {
    setLoading(true);
    try {
      const data = await teamApi.getById(id);
      setMember(data);
      setForm({ name: data.name, role: data.role, isActive: data.isActive, canSendKyc: data.canSendKyc, password: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updates = { name: form.name, role: form.role, isActive: form.isActive, canSendKyc: form.canSendKyc };
      if (form.password) updates.password = form.password;
      await teamApi.update(id, updates);
      setEditing(false);
      await loadMember();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  const ACTION_LABELS = {
    'KYC_CREATED': { label: 'Created KYC', color: 'var(--blue)' },
    'STATUS_CHANGED': { label: 'Status Changed', color: '#f59e0b' },
    'TEAM_MEMBER_CREATED': { label: 'Created Member', color: 'var(--green)' },
    'TEAM_MEMBER_UPDATED': { label: 'Updated Member', color: '#8b5cf6' },
    'COMPLIANCE_CHECK': { label: 'Compliance Check', color: '#06b6d4' },
    'SAP_PUSH': { label: 'SAP Push', color: '#ec4899' },
  };

  if (loading) return <ProtectedLayout roles={['Admin']}><div className="container" style={{ paddingTop: 32 }}><p style={{ color: 'var(--gray-400)' }}>Loading...</p></div></ProtectedLayout>;
  if (!member) return <ProtectedLayout roles={['Admin']}><div className="container" style={{ paddingTop: 32 }}><p className="error-msg">{error || 'Member not found'}</p><Link href="/team" className="btn btn-secondary" style={{ marginTop: 12 }}>Back to Team</Link></div></ProtectedLayout>;

  return (
    <ProtectedLayout roles={['Admin']}>
      <div className="container" style={{ paddingTop: 32, maxWidth: 800 }}>
        <Link href="/team" style={{ fontSize: 13, color: 'var(--blue)', marginBottom: 16, display: 'inline-block' }}>
          &larr; Back to Team
        </Link>

        {/* Info Card */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>{member.name || member.email}</h1>
              <div style={{ fontSize: 14, color: 'var(--gray-500)', marginBottom: 8 }}>{member.email}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className={`badge ${member.role === 'Admin' ? 'badge-approved' : 'badge-pending'}`}>{member.role}</span>
                <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: member.isActive ? '#dcfce7' : '#fee2e2', color: member.isActive ? '#16a34a' : '#dc2626' }}>
                  {member.isActive ? 'Active' : 'Inactive'}
                </span>
                {member.canSendKyc && <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: '#dbeafe', color: '#2563eb' }}>Can Send KYC</span>}
              </div>
            </div>
            <button className="btn btn-secondary" onClick={() => setEditing(!editing)}>
              {editing ? 'Cancel' : 'Edit'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginTop: 20, padding: '16px 0', borderTop: '1px solid var(--gray-100)' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Last Login</div>
              <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>{member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleString() : 'Never'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Created</div>
              <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>{new Date(member.createdAt).toLocaleDateString()}</div>
            </div>
            {member.createdByAdmin && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Added By</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>{member.createdByAdmin}</div>
              </div>
            )}
          </div>
        </div>

        {/* Edit Form */}
        {editing && (
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Edit Member</h3>
            <form onSubmit={handleSave}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Full Name</label>
                  <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="John Doe" />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select value={form.role} onChange={e => set('role', e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', fontSize: 14 }}>
                    <option value="KYC Team">KYC Team</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>New Password <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>(leave empty to keep current)</span></label>
                <input type="password" value={form.password} onChange={e => set('password', e.target.value)} minLength={6} placeholder="Min 6 characters" />
              </div>
              <div className="form-grid-2" style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <input type="checkbox" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} style={{ width: 16, height: 16 }} />
                  Active account
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <input type="checkbox" checked={form.canSendKyc} onChange={e => set('canSendKyc', e.target.checked)} style={{ width: 16, height: 16 }} />
                  Can send KYC requests
                </label>
              </div>
              {error && <p className="error-msg">{error}</p>}
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        )}

        {/* Performance Stats */}
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Performance</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
            <div style={{ padding: 16, background: '#eff6ff', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--blue)' }}>{member.kycCreated || 0}</div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>KYC Created</div>
            </div>
            <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--green)' }}>{member.kycApproved || 0}</div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>Approved</div>
            </div>
            <div style={{ padding: 16, background: '#fef2f2', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--red)' }}>{member.kycRejected || 0}</div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>Rejected</div>
            </div>
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Recent Activity</h3>
          {(!member.activity || member.activity.length === 0) ? (
            <p style={{ color: 'var(--gray-400)', fontSize: 14 }}>No activity recorded yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {member.activity.map((a, i) => {
                const info = ACTION_LABELS[a.action] || { label: a.action, color: 'var(--gray-500)' };
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: 12, borderBottom: i < member.activity.length - 1 ? '1px solid var(--gray-100)' : 'none' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: info.color, flexShrink: 0, marginTop: 6 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        <span style={{ color: info.color }}>{info.label}</span>
                        {a.kycId && <span style={{ color: 'var(--gray-400)', marginLeft: 6, fontSize: 12 }}>#{a.kycId.slice(0, 8)}</span>}
                      </div>
                      {a.details && <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{a.details}</div>}
                      <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{new Date(a.timestamp).toLocaleString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ProtectedLayout>
  );
}

function MemberDetailWrapper({ params }) {
  const { id } = use(params);
  return <MemberDetail id={id} />;
}

export default function TeamMemberPage({ params }) {
  return <AuthProvider><MemberDetailWrapper params={params} /></AuthProvider>;
}
