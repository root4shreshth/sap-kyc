'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider } from '@/components/AuthProvider';
import ProtectedLayout from '@/components/ProtectedLayout';
import { kycApi, companyApi } from '@/lib/api-client';
import PhoneInput from '@/components/PhoneInput';

function KycNewContent() {
  const router = useRouter();
  const [form, setForm] = useState({ clientName: '', companyName: '', email: '', ccEmail: '', companyProfileId: '', phone: '', phoneCountryCode: '+971' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [companyProfiles, setCompanyProfiles] = useState([]);

  useEffect(() => {
    companyApi.list().then((profiles) => {
      setCompanyProfiles(profiles);
      // Pre-select default profile
      const defaultProfile = profiles.find(p => p.isDefault);
      if (defaultProfile) {
        setForm(f => ({ ...f, companyProfileId: defaultProfile.id }));
      }
    }).catch(() => {});
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await kycApi.create(form);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Success screen after creating
  if (result) {
    return (
      <ProtectedLayout roles={['Admin']}>
        <div style={{ padding: '32px 32px 48px', maxWidth: 600 }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, color: 'var(--green)', marginBottom: 8 }}>&#10003;</div>
            <h2 style={{ marginBottom: 8 }}>KYC Request Created</h2>
            <p style={{ color: 'var(--gray-500)', marginBottom: 16 }}>{result.message}</p>

            {result.portalLink && (
              <div style={{
                background: 'var(--gray-50)', border: '1px solid var(--gray-200)',
                borderRadius: 'var(--radius)', padding: 16, marginBottom: 20, textAlign: 'left',
              }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', display: 'block', marginBottom: 6 }}>
                  Client Portal Link
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    readOnly
                    value={result.portalLink}
                    style={{
                      flex: 1, padding: '8px 12px', border: '1px solid var(--gray-200)',
                      borderRadius: 'var(--radius)', fontSize: 13, background: 'white',
                    }}
                    onClick={(e) => e.target.select()}
                  />
                  <button
                    className="btn btn-primary"
                    style={{ padding: '8px 16px', fontSize: 13 }}
                    onClick={() => {
                      navigator.clipboard.writeText(result.portalLink);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 8 }}>
                  Send this link to the client. It expires in 7 days.
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => { setResult(null); setForm({ clientName: '', companyName: '', email: '', ccEmail: '', companyProfileId: companyProfiles.find(p => p.isDefault)?.id || '', phone: '', phoneCountryCode: '+971' }); }}>
                Create Another
              </button>
              <button className="btn btn-secondary" onClick={() => router.push('/kyc')}>
                View All Requests
              </button>
            </div>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout roles={['Admin']}>
      <div className="container" style={{ paddingTop: 32, maxWidth: 600 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>Create KYC Request</h1>
        <div className="card">
          <form onSubmit={handleSubmit}>
            {companyProfiles.length > 0 && (
              <div className="form-group">
                <label>Company Profile</label>
                <select value={form.companyProfileId} onChange={(e) => update('companyProfileId', e.target.value)}>
                  <option value="">-- No profile --</option>
                  {companyProfiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.isDefault ? ' (Default)' : ''}</option>
                  ))}
                </select>
                <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                  Selects branding for emails and the client portal.
                </p>
              </div>
            )}
            <div className="form-group">
              <label>Client Name</label>
              <input value={form.clientName} onChange={(e) => update('clientName', e.target.value)} required placeholder="John Doe" />
            </div>
            <div className="form-group">
              <label>Company Name</label>
              <input value={form.companyName} onChange={(e) => update('companyName', e.target.value)} required placeholder="Acme Trading L.L.C" />
            </div>
            <div className="form-group">
              <label>Client Email</label>
              <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required placeholder="client@company.com" />
            </div>
            <div className="form-group">
              <label>Client Phone <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(optional — for WhatsApp)</span></label>
              <PhoneInput
                countryCode={form.phoneCountryCode}
                phone={form.phone}
                onCountryCodeChange={(code) => update('phoneCountryCode', code)}
                onPhoneChange={(val) => update('phone', val)}
              />
            </div>
            <div className="form-group">
              <label>CC Email <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(optional)</span></label>
              <input type="email" value={form.ccEmail} onChange={(e) => update('ccEmail', e.target.value)} placeholder="colleague@company.com" />
              <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                A copy of the invite email will be sent to this address.
              </p>
            </div>
            {error && <p className="error-msg">{error}</p>}
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Creating...' : 'Create & Send Invite'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => router.push('/kyc')}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </ProtectedLayout>
  );
}

export default function KycNewPage() {
  return <AuthProvider><KycNewContent /></AuthProvider>;
}
