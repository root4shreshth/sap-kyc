'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { kycApi } from '@/lib/api-client';

const DOC_TYPES = ['Trade License', 'Passport', 'Emirates ID', 'Other'];

function KycPortalContent({ token }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    kycApi.portalValidate(token).then(setInfo).catch((e) => setError(e.message));
  }, [token]);

  function addFile() {
    setFiles((f) => [...f, { file: null, docType: 'Trade License' }]);
  }

  function updateFile(index, field, value) {
    setFiles((f) => f.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function removeFile(index) {
    setFiles((f) => f.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (files.length === 0 || files.some((f) => !f.file)) {
      setError('Please add at least one document');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      const docTypes = [];
      files.forEach((f) => {
        formData.append('documents', f.file);
        docTypes.push(f.docType);
      });
      formData.append('docTypes', JSON.stringify(docTypes));
      await kycApi.portalUpload(token, formData);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  // Error state (invalid/expired link)
  if (error && !info) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ maxWidth: 500, textAlign: 'center' }}>
          <h2 style={{ color: 'var(--red)', marginBottom: 8 }}>Access Error</h2>
          <p style={{ color: 'var(--gray-500)' }}>{error}</p>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ maxWidth: 500, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12, color: 'var(--green)' }}>&#10003;</div>
          <h2 style={{ color: 'var(--green)', marginBottom: 8 }}>Documents Submitted</h2>
          <p style={{ color: 'var(--gray-500)' }}>
            Thank you. Your KYC documents have been submitted for review.
            You will receive an email with the outcome.
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (!info) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--gray-400)' }}>Validating link...</p>
      </div>
    );
  }

  // Upload form
  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-100)', padding: '40px 24px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, color: 'var(--navy)' }}>KYC Document Submission</h1>
          <p style={{ color: 'var(--gray-500)', marginTop: 4 }}>Alamir International Trading L.L.C</p>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 14 }}>
            <div>
              <span style={{ color: 'var(--gray-500)' }}>Client:</span>
              <div style={{ fontWeight: 500 }}>{info.clientName}</div>
            </div>
            <div>
              <span style={{ color: 'var(--gray-500)' }}>Company:</span>
              <div style={{ fontWeight: 500 }}>{info.companyName}</div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="card">
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>Upload Documents</h3>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>
              Accepted formats: PDF, JPEG, PNG, WebP. Max 10MB per file.
            </p>

            {files.map((f, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, alignItems: 'flex-end', padding: 12,
                background: 'var(--gray-50)', borderRadius: 'var(--radius)', marginBottom: 12,
              }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--gray-500)', marginBottom: 4 }}>Type</label>
                  <select value={f.docType} onChange={(e) => updateFile(i, 'docType', e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', fontSize: 14 }}>
                    {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ flex: 2 }}>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--gray-500)', marginBottom: 4 }}>File</label>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => updateFile(i, 'file', e.target.files[0])} style={{ fontSize: 14 }} />
                </div>
                <button type="button" onClick={() => removeFile(i)}
                  style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 18, padding: '4px 8px', cursor: 'pointer' }}>
                  &times;
                </button>
              </div>
            ))}

            <button type="button" className="btn btn-secondary" onClick={addFile} style={{ marginTop: 4 }}>
              + Add Document
            </button>

            {error && <p className="error-msg" style={{ marginTop: 12 }}>{error}</p>}

            <div style={{ marginTop: 24 }}>
              <button type="submit" className="btn btn-primary" disabled={uploading || files.length === 0}
                style={{ width: '100%', padding: '12px 24px' }}>
                {uploading ? 'Uploading...' : 'Submit Documents'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function KycPortalPage() {
  const { token } = useParams();
  return <KycPortalContent token={token} />;
}
