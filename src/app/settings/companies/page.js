'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { AuthProvider } from '@/components/AuthProvider';
import ProtectedLayout from '@/components/ProtectedLayout';
import { companyApi } from '@/lib/api-client';

const EMPTY_FORM = {
  name: '', shortName: '', logoUrl: '', emailSenderName: '', address: '',
  phone: '', website: '', footerText: '', primaryColor: '#2563eb', isDefault: false,
};

function CompanyProfilesContent() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // null = list view, 'new' = create, id = edit
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const logoInputRef = useRef(null);

  useEffect(() => { loadProfiles(); }, []);

  async function loadProfiles() {
    setLoading(true);
    try {
      const data = await companyApi.list();
      setProfiles(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function startCreate() {
    setForm({ ...EMPTY_FORM });
    setEditing('new');
    setError('');
  }

  function startEdit(profile) {
    setForm({
      name: profile.name,
      shortName: profile.shortName,
      logoUrl: profile.logoUrl,
      emailSenderName: profile.emailSenderName,
      address: profile.address,
      phone: profile.phone,
      website: profile.website,
      footerText: profile.footerText,
      primaryColor: profile.primaryColor,
      isDefault: profile.isDefault,
    });
    setEditing(profile.id);
    setError('');
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const submitData = { ...form };
      const pendingFile = form._logoFile;
      delete submitData._logoFile;
      // Don't send data URL as logoUrl
      if (submitData.logoUrl?.startsWith('data:')) submitData.logoUrl = '';

      if (editing === 'new') {
        const created = await companyApi.create(submitData);
        // Upload logo after profile is created (need the ID)
        if (pendingFile && created.id) {
          try {
            const uploadResult = await companyApi.uploadLogo(created.id, pendingFile);
            // Update the profile with the logo URL
            await companyApi.update(created.id, { logoUrl: uploadResult.logoUrl });
          } catch {}
        }
      } else {
        await companyApi.update(editing, submitData);
      }
      setEditing(null);
      await loadProfiles();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      setError('Only JPEG, PNG, WebP, or SVG images allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Logo must be under 5MB');
      return;
    }

    // For new profiles, need to create first to get an ID
    if (editing === 'new') {
      // Just preview locally, will upload after save
      const reader = new FileReader();
      reader.onload = (ev) => set('logoUrl', ev.target.result);
      reader.readAsDataURL(file);
      set('_logoFile', file);
      return;
    }

    setUploading(true);
    setError('');
    try {
      const result = await companyApi.uploadLogo(editing, file);
      set('logoUrl', result.logoUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  // Edit / Create form
  if (editing !== null) {
    return (
      <ProtectedLayout roles={['Admin']}>
        <div className="container" style={{ paddingTop: 32, maxWidth: 600 }}>
          <button onClick={() => { setEditing(null); setError(''); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gray-500)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 16 }}>
            <span style={{ fontSize: 16 }}>←</span> Back to Company Profiles
          </button>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>
            {editing === 'new' ? 'Create Company Profile' : 'Edit Company Profile'}
          </h1>
          <div className="card">
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>Company Name <span style={{ color: 'var(--red)' }}>*</span></label>
                <input value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Alamir International Trading L.L.C" />
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Short Name <span style={{ color: 'var(--red)' }}>*</span></label>
                  <input value={form.shortName} onChange={e => set('shortName', e.target.value)} required placeholder="Alamir" />
                </div>
                <div className="form-group">
                  <label>Email Sender Name <span style={{ color: 'var(--red)' }}>*</span></label>
                  <input value={form.emailSenderName} onChange={e => set('emailSenderName', e.target.value)} required placeholder="Alamir Operations" />
                </div>
              </div>
              <div className="form-group">
                <label>Company Logo</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                  {form.logoUrl && (
                    <img
                      src={form.logoUrl}
                      alt="Logo preview"
                      style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 6, border: '1px solid var(--gray-200)', background: 'white' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/svg+xml"
                      onChange={handleLogoUpload}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '6px 14px', fontSize: 13 }}
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? 'Uploading...' : form.logoUrl ? 'Change Logo' : 'Upload Logo'}
                    </button>
                  </div>
                </div>
                <input
                  value={form.logoUrl?.startsWith('data:') ? '' : form.logoUrl || ''}
                  onChange={e => set('logoUrl', e.target.value)}
                  placeholder="Or paste a URL: https://example.com/logo.png"
                  style={{ fontSize: 13 }}
                />
                <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>Upload an image or paste a URL. Used in the client portal header.</p>
              </div>
              <div className="form-group">
                <label>Address</label>
                <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Full company address" />
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Phone</label>
                  <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+971 ..." />
                </div>
                <div className="form-group">
                  <label>Website</label>
                  <input value={form.website} onChange={e => set('website', e.target.value)} placeholder="www.example.com" />
                </div>
              </div>
              <div className="form-group">
                <label>Email Footer Text</label>
                <input value={form.footerText} onChange={e => set('footerText', e.target.value)} placeholder="Alamir International Trading L.L.C" />
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Brand Color</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="color" value={form.primaryColor} onChange={e => set('primaryColor', e.target.value)}
                      style={{ width: 40, height: 36, padding: 2, border: '1px solid var(--gray-200)', borderRadius: 4 }} />
                    <input value={form.primaryColor} onChange={e => set('primaryColor', e.target.value)}
                      style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', fontSize: 14 }} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Default Profile</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 14 }}>
                    <input type="checkbox" checked={form.isDefault} onChange={e => set('isDefault', e.target.checked)}
                      style={{ width: 16, height: 16 }} />
                    Set as default for new KYC requests
                  </label>
                </div>
              </div>
              {error && <p className="error-msg">{error}</p>}
              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editing === 'new' ? 'Create Profile' : 'Save Changes'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  // List view
  return (
    <ProtectedLayout roles={['Admin']}>
      <div className="container" style={{ paddingTop: 32 }}>
        <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gray-500)', textDecoration: 'none', marginBottom: 16 }}>
          <span style={{ fontSize: 16 }}>←</span> Back to Dashboard
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>Company Profiles</h1>
          <button className="btn btn-primary" onClick={startCreate}>+ New Profile</button>
        </div>

        {loading ? (
          <p style={{ color: 'var(--gray-400)' }}>Loading...</p>
        ) : profiles.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>
            <p>No company profiles yet. Create one to customize email branding and client portal.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {profiles.map(p => (
              <div key={p.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, background: p.primaryColor, flexShrink: 0 }} />
                    <strong style={{ fontSize: 15 }}>{p.name}</strong>
                    {p.isDefault && (
                      <span className="badge badge-approved" style={{ fontSize: 11 }}>Default</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                    Sender: {p.emailSenderName} &middot; Short: {p.shortName}
                    {p.phone && <> &middot; {p.phone}</>}
                  </div>
                </div>
                <button className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => startEdit(p)}>
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
        {error && <p className="error-msg" style={{ marginTop: 12 }}>{error}</p>}
      </div>
    </ProtectedLayout>
  );
}

export default function CompanyProfilesPage() {
  return <AuthProvider><CompanyProfilesContent /></AuthProvider>;
}
