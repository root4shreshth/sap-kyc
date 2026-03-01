'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AuthProvider } from '@/components/AuthProvider';
import ProtectedLayout from '@/components/ProtectedLayout';
import { teamApi } from '@/lib/api-client';

/* ─── Small reusable components ─────────────────────────────────── */

function InfoRow({ icon, label, value, mono }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid #f1f5f9' }}>
      {icon && <span style={{ fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0 }}>{icon}</span>}
      <span style={{ fontSize: 13, color: '#64748b', minWidth: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#1e293b', marginLeft: 'auto', textAlign: 'right', fontFamily: mono ? 'monospace' : 'inherit' }}>{value || '—'}</span>
    </div>
  );
}

function SectionHeader({ icon, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>{title}</h3>
    </div>
  );
}

function StatCard({ count, label, color, bgColor, icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '20px 16px', borderRadius: 12, textAlign: 'center',
        background: active ? color : bgColor,
        border: active ? `2px solid ${color}` : '2px solid transparent',
        cursor: count > 0 ? 'pointer' : 'default',
        transition: 'all 0.2s',
        flex: 1, minWidth: 130,
      }}
    >
      <div style={{ fontSize: 14, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: active ? 'white' : color, lineHeight: 1 }}>{count}</div>
      <div style={{ fontSize: 12, color: active ? 'rgba(255,255,255,0.8)' : '#64748b', marginTop: 6, fontWeight: 500 }}>{label}</div>
    </button>
  );
}

function MigrationBanner({ sql }) {
  const [copied, setCopied] = useState(false);
  const [showSql, setShowSql] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setShowSql(true);
    }
  }

  return (
    <div style={{ background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 12, padding: 16, marginBottom: 20 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 20, lineHeight: 1 }}>&#9888;</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, color: '#78350f', marginBottom: 10, lineHeight: 1.5 }}>
            <strong>Database update required.</strong> Profile data (name, designation, etc.) won&apos;t save until you run the migration SQL in Supabase.
            Go to the <a href="/team" style={{ color: '#2563eb', textDecoration: 'underline' }}>Team page</a> for full instructions, or copy the SQL below.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={handleCopy} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', background: copied ? '#16a34a' : '#2563eb', color: 'white' }}>
              {copied ? '✓ Copied!' : 'Copy SQL'}
            </button>
            <button onClick={() => setShowSql(!showSql)} style={{ padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb', cursor: 'pointer', background: 'white', color: '#6b7280' }}>
              {showSql ? 'Hide' : 'Show SQL'}
            </button>
          </div>
          {showSql && (
            <pre style={{ marginTop: 10, padding: 12, background: '#1e293b', color: '#e2e8f0', borderRadius: 8, fontSize: 11, lineHeight: 1.5, overflow: 'auto', maxHeight: 300, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {sql}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── KYC Details Drawer (when clicking stats) ──────────────────── */

function KycDetailsList({ items, type }) {
  if (!items || items.length === 0) {
    return <p style={{ fontSize: 13, color: '#94a3b8', padding: '12px 0' }}>No records found.</p>;
  }

  const typeColors = {
    created: { bg: '#eff6ff', dot: '#3b82f6' },
    approved: { bg: '#f0fdf4', dot: '#22c55e' },
    rejected: { bg: '#fef2f2', dot: '#ef4444' },
  };
  const colors = typeColors[type] || typeColors.created;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      {items.map((item, i) => (
        <Link
          key={i}
          href={item.kycId ? `/kyc/review/${item.kycId}` : '#'}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
            background: colors.bg, borderRadius: 8, textDecoration: 'none', color: 'inherit',
            transition: 'opacity 0.15s',
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors.dot, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.details || 'KYC Request'}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              {item.kycId ? `#${item.kycId.slice(0, 8)}` : ''} {item.timestamp ? ` · ${new Date(item.timestamp).toLocaleDateString()}` : ''}
            </div>
          </div>
          <span style={{ fontSize: 16, color: '#cbd5e1' }}>&rsaquo;</span>
        </Link>
      ))}
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────── */

function MemberDetail({ id }) {
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  const [migrationSql, setMigrationSql] = useState('');
  const [activeStatTab, setActiveStatTab] = useState(null); // 'created' | 'approved' | 'rejected' | null
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef(null);

  useEffect(() => { loadMember(); }, [id]);

  async function loadMember() {
    setLoading(true);
    try {
      const data = await teamApi.getById(id);
      setMember(data);
      setMigrationNeeded(!!data.migrationNeeded);
      setMigrationSql(data.migrationSql || '');
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

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const result = await teamApi.uploadAvatar(id, file);
      setMember(prev => ({ ...prev, avatarUrl: result.avatarUrl }));
      setSuccessMsg('Avatar updated!');
      setTimeout(() => setSuccessMsg(''), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  // Group activity entries by type for the performance drill-down
  function getKycEntriesByType(type) {
    if (!member?.activity) return [];
    const actionMap = {
      created: ['KYC_CREATED'],
      approved: ['KYC_STATUS_APPROVED'],
      rejected: ['KYC_STATUS_REJECTED'],
    };
    const actions = actionMap[type] || [];
    return member.activity.filter(a => actions.includes(a.action));
  }

  const ACTION_LABELS = {
    'KYC_CREATED': { label: 'Created KYC', color: '#3b82f6', icon: '📝' },
    'KYC_STATUS_APPROVED': { label: 'Approved KYC', color: '#22c55e', icon: '✅' },
    'KYC_STATUS_REJECTED': { label: 'Rejected KYC', color: '#ef4444', icon: '❌' },
    'KYC_STATUS_UNDER_REVIEW': { label: 'Set Under Review', color: '#f59e0b', icon: '🔍' },
    'STATUS_CHANGED': { label: 'Status Changed', color: '#f59e0b', icon: '🔄' },
    'TEAM_MEMBER_CREATED': { label: 'Created Member', color: '#22c55e', icon: '👤' },
    'TEAM_MEMBER_UPDATED': { label: 'Updated Member', color: '#8b5cf6', icon: '✏️' },
    'COMPLIANCE_CHECK': { label: 'Compliance Check', color: '#06b6d4', icon: '🛡️' },
    'COMPLIANCE_OVERRIDE': { label: 'Compliance Override', color: '#06b6d4', icon: '⚙️' },
    'SAP_BP_CREATED': { label: 'SAP Push', color: '#ec4899', icon: '📤' },
    'REMINDER_SENT': { label: 'Sent Reminder', color: '#f59e0b', icon: '🔔' },
    'REMINDERS_SENT': { label: 'Bulk Reminders', color: '#f59e0b', icon: '📢' },
  };

  if (loading) return <ProtectedLayout roles={['Admin']}><div className="container" style={{ paddingTop: 32 }}><div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#94a3b8' }}><div style={{ width: 20, height: 20, border: '2px solid #94a3b8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />Loading member...</div></div></ProtectedLayout>;
  if (!member) return <ProtectedLayout roles={['Admin']}><div className="container" style={{ paddingTop: 32 }}><p className="error-msg">{error || 'Member not found'}</p><Link href="/team" className="btn btn-secondary" style={{ marginTop: 12 }}>Back to Team</Link></div></ProtectedLayout>;

  const initials = (member.name || member.email).slice(0, 2).toUpperCase();
  const hasAvatar = !!member.avatarUrl;
  const joinDays = member.dateOfJoining ? Math.floor((Date.now() - new Date(member.dateOfJoining).getTime()) / 86400000) : null;

  return (
    <ProtectedLayout roles={['Admin']}>
      <div className="container" style={{ paddingTop: 24, maxWidth: 960, paddingBottom: 48 }}>
        {/* Back link */}
        <Link href="/team" style={{ fontSize: 13, color: '#3b82f6', marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
          <span>&larr;</span> Back to Team
        </Link>

        {migrationNeeded && <MigrationBanner sql={migrationSql} />}

        {successMsg && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', padding: '10px 16px', borderRadius: 10, marginBottom: 16, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>&#10003;</span> {successMsg}
          </div>
        )}
        {!editing && error && <p className="error-msg" style={{ marginBottom: 16 }}>{error}</p>}

        {/* ── Hero Profile Card ──────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
          borderRadius: 16, padding: '32px 28px', marginBottom: 24, color: 'white', position: 'relative', overflow: 'hidden',
        }}>
          {/* Decorative circles */}
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ position: 'absolute', bottom: -40, right: 60, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20, position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              {/* Avatar with upload */}
              <div style={{ position: 'relative' }}>
                {hasAvatar ? (
                  <img
                    src={member.avatarUrl}
                    alt={member.name || 'Avatar'}
                    style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.3)' }}
                  />
                ) : (
                  <div style={{
                    width: 80, height: 80, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28, fontWeight: 700, border: '3px solid rgba(255,255,255,0.3)',
                  }}>
                    {initials}
                  </div>
                )}
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  title="Change photo"
                  style={{
                    position: 'absolute', bottom: -2, right: -2,
                    width: 28, height: 28, borderRadius: '50%',
                    background: '#3b82f6', border: '2px solid white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 12, color: 'white', padding: 0,
                  }}
                >
                  {uploadingAvatar ? '...' : '📷'}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarUpload}
                  style={{ display: 'none' }}
                />
              </div>

              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 2, letterSpacing: -0.3 }}>
                  {member.name || member.email}
                </h1>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 10 }}>
                  {member.designation || member.email}
                  {member.designation && member.department && <span> · {member.department}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: member.role === 'Admin' ? 'rgba(139,92,246,0.25)' : 'rgba(59,130,246,0.25)',
                    color: member.role === 'Admin' ? '#c4b5fd' : '#93c5fd',
                    border: `1px solid ${member.role === 'Admin' ? 'rgba(139,92,246,0.4)' : 'rgba(59,130,246,0.4)'}`,
                  }}>
                    {member.role}
                  </span>
                  <span style={{
                    padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: member.isActive ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                    color: member.isActive ? '#86efac' : '#fca5a5',
                  }}>
                    {member.isActive ? '● Active' : '● Inactive'}
                  </span>
                  {member.canSendKyc && (
                    <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: 'rgba(59,130,246,0.2)', color: '#93c5fd' }}>
                      Can Send KYC
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button className="btn" onClick={() => setEditing(!editing)} style={{
              padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8,
              background: editing ? 'rgba(255,255,255,0.15)' : 'white',
              color: editing ? 'white' : '#0f172a',
              border: editing ? '1px solid rgba(255,255,255,0.3)' : 'none',
              cursor: 'pointer',
            }}>
              {editing ? 'Cancel Editing' : '✏️ Edit Profile'}
            </button>
          </div>

          {/* Quick info bar */}
          <div style={{
            display: 'flex', gap: 24, marginTop: 24, paddingTop: 20,
            borderTop: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap', position: 'relative', zIndex: 1,
          }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>Email</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2 }}>{member.email}</div>
            </div>
            {member.employeeId && (
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>Employee ID</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2, fontFamily: 'monospace' }}>{member.employeeId}</div>
              </div>
            )}
            {member.dateOfJoining && (
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>Joined</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2 }}>
                  {new Date(member.dateOfJoining).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {joinDays !== null && <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 6 }}>({Math.floor(joinDays / 365)}y {Math.floor((joinDays % 365) / 30)}m)</span>}
                </div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>Last Login</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2 }}>
                {member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}
              </div>
            </div>
          </div>
        </div>

        {/* ── Edit Form ──────────────────────────────────────────── */}
        {editing && (
          <div className="card" style={{ marginBottom: 24, borderRadius: 14, border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>✏️</span> Edit Profile
            </h3>
            <form onSubmit={handleSave}>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Account</h4>
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
                <label>New Password <span style={{ fontSize: 12, color: '#94a3b8' }}>(leave empty to keep current)</span></label>
                <input type="password" value={form.password} onChange={e => set('password', e.target.value)} minLength={6} placeholder="Min 6 characters" />
              </div>
              <div className="form-grid-2" style={{ marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <input type="checkbox" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#22c55e' }} />
                  Active account
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <input type="checkbox" checked={form.canSendKyc} onChange={e => set('canSendKyc', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#3b82f6' }} />
                  Can send KYC requests
                </label>
              </div>

              <div style={{ height: 1, background: '#f1f5f9', margin: '20px 0' }} />
              <h4 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Professional Details</h4>
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

              <div style={{ height: 1, background: '#f1f5f9', margin: '20px 0' }} />
              <h4 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Contact</h4>
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

              <div style={{ height: 1, background: '#f1f5f9', margin: '20px 0' }} />
              <h4 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Emergency Contact</h4>
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
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional notes..." rows={3}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
              </div>

              {error && <p className="error-msg">{error}</p>}
              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '10px 28px' }}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => { setEditing(false); setError(''); }} style={{ padding: '10px 20px' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Profile Details (non-editing view) ─────────────────── */}
        {!editing && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 24 }}>
            {/* Account Info */}
            <div className="card" style={{ borderRadius: 14, border: '1px solid #e2e8f0' }}>
              <SectionHeader icon="👤" title="Account Information" />
              <InfoRow icon="📧" label="Email" value={member.email} />
              <InfoRow icon="🔑" label="Role" value={member.role} />
              <InfoRow icon="🏷️" label="Employee ID" value={member.employeeId} mono />
              <InfoRow icon="👤" label="Added By" value={member.createdByAdmin} />
              <InfoRow icon="📅" label="Created" value={member.createdAt ? new Date(member.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''} />
              <InfoRow icon="🕐" label="Last Login" value={member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleString() : 'Never'} />
            </div>

            {/* Professional */}
            <div className="card" style={{ borderRadius: 14, border: '1px solid #e2e8f0' }}>
              <SectionHeader icon="💼" title="Professional Details" />
              <InfoRow icon="📋" label="Designation" value={member.designation} />
              <InfoRow icon="🏢" label="Department" value={member.department} />
              <InfoRow icon="📅" label="Date of Joining" value={member.dateOfJoining ? new Date(member.dateOfJoining).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''} />
              <InfoRow icon="📞" label="Phone" value={member.phone} />
              <InfoRow icon="📍" label="Address" value={member.address} />
              {member.notes && (
                <div style={{ marginTop: 14, padding: 14, background: '#f8fafc', borderRadius: 10, fontSize: 13, color: '#475569', lineHeight: 1.5, borderLeft: '3px solid #3b82f6' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Notes</div>
                  {member.notes}
                </div>
              )}
            </div>

            {/* Emergency Contact */}
            {(member.emergencyContactName || member.emergencyContactPhone) && (
              <div className="card" style={{ borderRadius: 14, border: '1px solid #e2e8f0' }}>
                <SectionHeader icon="🚨" title="Emergency Contact" />
                <InfoRow icon="👤" label="Name" value={member.emergencyContactName} />
                <InfoRow icon="📞" label="Phone" value={member.emergencyContactPhone} />
              </div>
            )}
          </div>
        )}

        {/* ── Performance Stats (clickable) ──────────────────────── */}
        <div className="card" style={{ marginBottom: 24, borderRadius: 14, border: '1px solid #e2e8f0' }}>
          <SectionHeader icon="📊" title="Performance Overview" />
          <p style={{ fontSize: 13, color: '#94a3b8', marginTop: -8, marginBottom: 16 }}>Click a stat to view individual KYC records</p>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <StatCard
              count={member.kycCreated || 0}
              label="KYC Created"
              color="#3b82f6"
              bgColor="#eff6ff"
              icon="📝"
              active={activeStatTab === 'created'}
              onClick={() => (member.kycCreated || 0) > 0 && setActiveStatTab(activeStatTab === 'created' ? null : 'created')}
            />
            <StatCard
              count={member.kycApproved || 0}
              label="Approved"
              color="#22c55e"
              bgColor="#f0fdf4"
              icon="✅"
              active={activeStatTab === 'approved'}
              onClick={() => (member.kycApproved || 0) > 0 && setActiveStatTab(activeStatTab === 'approved' ? null : 'approved')}
            />
            <StatCard
              count={member.kycRejected || 0}
              label="Rejected"
              color="#ef4444"
              bgColor="#fef2f2"
              icon="❌"
              active={activeStatTab === 'rejected'}
              onClick={() => (member.kycRejected || 0) > 0 && setActiveStatTab(activeStatTab === 'rejected' ? null : 'rejected')}
            />
          </div>

          {/* Expanded KYC list */}
          {activeStatTab && (
            <div style={{ marginTop: 16, padding: 16, background: '#f8fafc', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                  {activeStatTab === 'created' && 'KYC Requests Created'}
                  {activeStatTab === 'approved' && 'KYC Requests Approved'}
                  {activeStatTab === 'rejected' && 'KYC Requests Rejected'}
                </h4>
                <button onClick={() => setActiveStatTab(null)} style={{
                  padding: '4px 10px', fontSize: 12, borderRadius: 6,
                  border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', color: '#64748b',
                }}>Close</button>
              </div>
              <KycDetailsList items={getKycEntriesByType(activeStatTab)} type={activeStatTab} />
            </div>
          )}
        </div>

        {/* ── Activity Timeline ──────────────────────────────────── */}
        <div className="card" style={{ borderRadius: 14, border: '1px solid #e2e8f0' }}>
          <SectionHeader icon="📋" title="Activity Timeline" />
          {(!member.activity || member.activity.length === 0) ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              <p style={{ fontSize: 14 }}>No activity recorded yet.</p>
            </div>
          ) : (
            <div style={{ position: 'relative', paddingLeft: 24 }}>
              {/* Timeline line */}
              <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 2, background: '#e2e8f0', borderRadius: 1 }} />

              {member.activity.map((a, i) => {
                const info = ACTION_LABELS[a.action] || { label: a.action, color: '#94a3b8', icon: '📌' };
                return (
                  <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', paddingBottom: 16, position: 'relative' }}>
                    {/* Timeline dot */}
                    <div style={{
                      position: 'absolute', left: -20, top: 4,
                      width: 16, height: 16, borderRadius: '50%',
                      background: 'white', border: `2px solid ${info.color}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 8,
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: info.color }} />
                    </div>

                    <div style={{ flex: 1, background: '#f8fafc', borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: info.color }}>{info.icon} {info.label}</span>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(a.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {a.details && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{a.details}</div>}
                      {a.kycId && (
                        <Link href={`/kyc/review/${a.kycId}`} style={{ fontSize: 11, color: '#3b82f6', marginTop: 4, display: 'inline-block', textDecoration: 'none' }}>
                          View KYC #{a.kycId.slice(0, 8)} &rarr;
                        </Link>
                      )}
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
