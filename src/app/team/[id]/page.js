'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AuthProvider } from '@/components/AuthProvider';
import ProtectedLayout from '@/components/ProtectedLayout';
import { teamApi } from '@/lib/api-client';

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
      <span style={{ fontSize: 13, color: 'var(--gray-500)', minWidth: 160 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, textAlign: 'right' }}>{value || '—'}</span>
    </div>
  );
}

function MemberDetail({ id }) {
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => { loadMember(); }, [id]);

  async function loadMember() {
    setLoading(true);
    try {
      const data = await teamApi.getById(id);
      setMember(data);
      setForm({
        name: data.name || '', role: data.role, isActive: data.isActive, canSendKyc: data.canSendKyc,
        password: '',
        phone: data.phone || '', designation: data.designation || '', department: data.department || '',
        employeeId: data.employeeId || '', dateOfJoining: data.dateOfJoining || '', address: data.address || '',
        emergencyContactName: data.emergencyContactName || '', emergencyContactPhone: data.emergencyContactPhone || '',
        notes: data.notes || '',
      });
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
    setSuccessMsg('');
    try {
      const updates = {
        name: form.name, role: form.role, isActive: form.isActive, canSendKyc: form.canSendKyc,
        phone: form.phone, designation: form.designation, department: form.department,
        employeeId: form.employeeId, dateOfJoining: form.dateOfJoining, address: form.address,
        emergencyContactName: form.emergencyContactName, emergencyContactPhone: form.emergencyContactPhone,
        notes: form.notes,
      };
      if (form.password) updates.password = form.password;
      await teamApi.update(id, updates);
      setEditing(false);
      setSuccessMsg('Profile updated successfully');
      await loadMember();
      setTimeout(() => setSuccessMsg(''), 3000);
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
    'KYC_STATUS_APPROVED': { label: 'Approved KYC', color: 'var(--green)' },
    'KYC_STATUS_REJECTED': { label: 'Rejected KYC', color: 'var(--red)' },
    'KYC_STATUS_UNDER_REVIEW': { label: 'Set Under Review', color: '#f59e0b' },
    'STATUS_CHANGED': { label: 'Status Changed', color: '#f59e0b' },
    'TEAM_MEMBER_CREATED': { label: 'Created Member', color: 'var(--green)' },
    'TEAM_MEMBER_UPDATED': { label: 'Updated Member', color: '#8b5cf6' },
    'COMPLIANCE_CHECK': { label: 'Compliance Check', color: '#06b6d4' },
    'COMPLIANCE_OVERRIDE': { label: 'Compliance Override', color: '#06b6d4' },
    'SAP_BP_CREATED': { label: 'SAP Push', color: '#ec4899' },
    'REMINDER_SENT': { label: 'Sent Reminder', color: '#f59e0b' },
    'REMINDERS_SENT': { label: 'Bulk Reminders', color: '#f59e0b' },
  };

  if (loading) return <ProtectedLayout roles={['Admin']}><div className="container" style={{ paddingTop: 32 }}><p style={{ color: 'var(--gray-400)' }}>Loading...</p></div></ProtectedLayout>;
  if (!member) return <ProtectedLayout roles={['Admin']}><div className="container" style={{ paddingTop: 32 }}><p className="error-msg">{error || 'Member not found'}</p><Link href="/team" className="btn btn-secondary" style={{ marginTop: 12 }}>Back to Team</Link></div></ProtectedLayout>;

  const initials = (member.name || member.email).slice(0, 2).toUpperCase();

  return (
    <ProtectedLayout roles={['Admin']}>
      <div className="container" style={{ paddingTop: 32, maxWidth: 900 }}>
        <Link href="/team" style={{ fontSize: 13, color: 'var(--blue)', marginBottom: 16, display: 'inline-block' }}>
          &larr; Back to Team
        </Link>

        {successMsg && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{successMsg}</div>}
        {!editing && error && <p className="error-msg" style={{ marginBottom: 16 }}>{error}</p>}

        {/* Profile Header */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, var(--blue), var(--navy))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 22, fontWeight: 700, flexShrink: 0,
              }}>
                {initials}
              </div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 2 }}>{member.name || member.email}</h1>
                <div style={{ fontSize: 14, color: 'var(--gray-500)', marginBottom: 6 }}>
                  {member.designation && <span>{member.designation}</span>}
                  {member.designation && member.department && <span> · </span>}
                  {member.department && <span>{member.department}</span>}
                  {!member.designation && !member.department && <span>{member.email}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span className={`badge ${member.role === 'Admin' ? 'badge-approved' : 'badge-pending'}`}>{member.role}</span>
                  <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: member.isActive ? '#dcfce7' : '#fee2e2', color: member.isActive ? '#16a34a' : '#dc2626' }}>
                    {member.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {member.canSendKyc && <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: '#dbeafe', color: '#2563eb' }}>Can Send KYC</span>}
                </div>
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => setEditing(!editing)}>
              {editing ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>
        </div>

        {/* Edit Form */}
        {editing && (
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Edit Profile</h3>
            <form onSubmit={handleSave}>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Account</h4>
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
              <div className="form-grid-2" style={{ marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <input type="checkbox" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} style={{ width: 16, height: 16 }} />
                  Active account
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <input type="checkbox" checked={form.canSendKyc} onChange={e => set('canSendKyc', e.target.checked)} style={{ width: 16, height: 16 }} />
                  Can send KYC requests
                </label>
              </div>

              <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--gray-100)' }}>Professional Details</h4>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Designation / Job Title</label>
                  <input value={form.designation} onChange={e => set('designation', e.target.value)} placeholder="KYC Analyst" />
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <input value={form.department} onChange={e => set('department', e.target.value)} placeholder="Compliance" />
                </div>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Employee ID</label>
                  <input value={form.employeeId} onChange={e => set('employeeId', e.target.value)} placeholder="EMP-001" />
                </div>
                <div className="form-group">
                  <label>Date of Joining</label>
                  <input type="date" value={form.dateOfJoining} onChange={e => set('dateOfJoining', e.target.value)} />
                </div>
              </div>

              <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--gray-100)' }}>Contact Information</h4>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Phone</label>
                  <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+971 50 123 4567" />
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Dubai, UAE" />
                </div>
              </div>

              <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--gray-100)' }}>Emergency Contact</h4>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Contact Name</label>
                  <input value={form.emergencyContactName} onChange={e => set('emergencyContactName', e.target.value)} placeholder="Jane Doe" />
                </div>
                <div className="form-group">
                  <label>Contact Phone</label>
                  <input value={form.emergencyContactPhone} onChange={e => set('emergencyContactPhone', e.target.value)} placeholder="+971 50 987 6543" />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 8 }}>
                <label>Notes</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional notes about this team member..." rows={3}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
              </div>

              {error && <p className="error-msg">{error}</p>}
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => { setEditing(false); setError(''); }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Profile Details (when not editing) */}
        {!editing && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24, marginBottom: 24 }}>
            {/* Personal & Account Info */}
            <div className="card">
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Account Information</h3>
              <InfoRow label="Email" value={member.email} />
              <InfoRow label="Role" value={member.role} />
              <InfoRow label="Employee ID" value={member.employeeId} />
              <InfoRow label="Added By" value={member.createdByAdmin} />
              <InfoRow label="Created" value={member.createdAt ? new Date(member.createdAt).toLocaleDateString() : ''} />
              <InfoRow label="Last Login" value={member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleString() : 'Never'} />
            </div>

            {/* Professional Details */}
            <div className="card">
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Professional Details</h3>
              <InfoRow label="Designation" value={member.designation} />
              <InfoRow label="Department" value={member.department} />
              <InfoRow label="Date of Joining" value={member.dateOfJoining} />
              <InfoRow label="Phone" value={member.phone} />
              <InfoRow label="Address" value={member.address} />
              {member.notes && <div style={{ marginTop: 12, padding: 12, background: 'var(--gray-50)', borderRadius: 8, fontSize: 13, color: 'var(--gray-600)' }}>{member.notes}</div>}
            </div>

            {/* Emergency Contact */}
            {(member.emergencyContactName || member.emergencyContactPhone) && (
              <div className="card">
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Emergency Contact</h3>
                <InfoRow label="Name" value={member.emergencyContactName} />
                <InfoRow label="Phone" value={member.emergencyContactPhone} />
              </div>
            )}
          </div>
        )}

        {/* Performance Stats */}
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Performance</h3>
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
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Recent Activity</h3>
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

function MemberDetailWrapper() {
  const { id } = useParams();
  return <MemberDetail id={id} />;
}

export default function TeamMemberPage() {
  return <AuthProvider><MemberDetailWrapper /></AuthProvider>;
}
