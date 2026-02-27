'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AuthProvider } from '@/components/AuthProvider';
import ProtectedLayout from '@/components/ProtectedLayout';
import { kycApi } from '@/lib/api-client';
import FormDataView from './FormDataView';
import ComplianceCheckPanel from './ComplianceCheckPanel';

function statusBadge(status) {
  const map = {
    Pending: 'badge-pending', Submitted: 'badge-submitted',
    'Under Review': 'badge-review', Approved: 'badge-approved', Rejected: 'badge-rejected',
  };
  return <span className={`badge ${map[status] || ''}`}>{status}</span>;
}

function KycReviewContent({ id }) {
  const router = useRouter();
  const [kycData, setKycData] = useState(null);
  const [docs, setDocs] = useState([]);
  const [formData, setFormData] = useState(null);
  const [status, setStatus] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState('');
  const [exporting, setExporting] = useState(false);
  const [pepStatus, setPepStatus] = useState('');
  const [pepDetails, setPepDetails] = useState('');

  useEffect(() => {
    Promise.all([kycApi.list(), kycApi.getDocs(id), kycApi.getFormData(id)])
      .then(([list, docList, { formData: fd }]) => {
        const found = list.find((r) => r.id === id);
        if (!found) setError('KYC request not found');
        else {
          setKycData(found);
          setRemarks(found.remarks || '');
          setPepStatus(found.pepStatus || '');
          setPepDetails(found.pepDetails || '');
        }
        setDocs(docList);
        if (fd && Object.keys(fd).length > 0) setFormData(fd);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleStatusUpdate() {
    if (!status) return;
    setError('');
    setUpdateMsg('');
    setUpdating(true);
    try {
      const result = await kycApi.updateStatus(id, status, remarks, pepStatus, pepDetails);
      setUpdateMsg(result.message);
      setKycData((prev) => ({ ...prev, status, remarks, pepStatus, pepDetails }));
      setStatus('');
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  }

  async function handleExportPdf() {
    setExporting(true);
    try {
      await kycApi.exportPdf(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <ProtectedLayout roles={['Admin', 'KYC Team']}>
        <div style={{ padding: '32px 32px 48px' }}>
          <p style={{ color: 'var(--gray-400)' }}>Loading...</p>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout roles={['Admin', 'KYC Team']}>
      <div style={{ padding: '32px 32px 48px', maxWidth: 860 }}>
        <button className="btn btn-secondary" onClick={() => router.push('/kyc')} style={{ marginBottom: 16 }}>
          &larr; Back to List
        </button>

        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>KYC Review</h1>

        {error && !kycData && <p className="error-msg">{error}</p>}

        {kycData && (
          <>
            {/* Client Info */}
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>Client Information</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 14 }}>
                <div>
                  <span style={{ color: 'var(--gray-500)' }}>Client Name</span>
                  <div style={{ fontWeight: 500 }}>{kycData.clientName}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--gray-500)' }}>Company</span>
                  <div style={{ fontWeight: 500 }}>{kycData.companyName}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--gray-500)' }}>Email</span>
                  <div style={{ fontWeight: 500 }}>{kycData.email}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--gray-500)' }}>Status</span>
                  <div>{statusBadge(kycData.status)}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--gray-500)' }}>Created By</span>
                  <div style={{ fontWeight: 500 }}>{kycData.createdBy}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--gray-500)' }}>Created At</span>
                  <div style={{ fontWeight: 500 }}>{new Date(kycData.createdAt).toLocaleString()}</div>
                </div>
              </div>
              {kycData.remarks && (
                <div style={{ marginTop: 16, fontSize: 14 }}>
                  <span style={{ color: 'var(--gray-500)' }}>Remarks</span>
                  <div style={{ fontWeight: 500, marginTop: 2 }}>{kycData.remarks}</div>
                </div>
              )}
            </div>

            {/* Form Data */}
            {formData && (
              <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 16 }}>KYC/KYS Application Data</h3>
                  <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: 13 }}
                    onClick={handleExportPdf} disabled={exporting}>
                    {exporting ? 'Exporting...' : 'Export PDF'}
                  </button>
                </div>
                <FormDataView data={formData} />
              </div>
            )}

            {/* Documents */}
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>Uploaded Documents</h3>
              {docs.length === 0 ? (
                <p style={{ color: 'var(--gray-400)', fontSize: 14 }}>No documents uploaded yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {docs.map((d, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 16px', background: 'var(--gray-50)', borderRadius: 'var(--radius)', fontSize: 14,
                    }}>
                      <div>
                        <span className="badge badge-submitted" style={{ marginRight: 8 }}>{d.docType}</span>
                        <span>{d.fileName}</span>
                      </div>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 12px', fontSize: 13 }}
                        onClick={() => kycApi.downloadFile(d.driveFileId, d.fileName)}
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Compliance Check */}
            {formData && (
              <div className="card" style={{ marginBottom: 24 }}>
                <ComplianceCheckPanel kycId={id} />
              </div>
            )}

            {/* Status Update */}
            {!['Approved', 'Rejected'].includes(kycData.status) && (
              <div className="card">
                <h3 style={{ fontSize: 16, marginBottom: 12 }}>Update Status</h3>
                <div className="form-group">
                  <label>New Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="">Select status...</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Remarks</label>
                  <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} placeholder="Optional remarks..." style={{ resize: 'vertical' }} />
                </div>

                <div style={{ marginTop: 12, padding: 16, background: 'var(--gray-50)', borderRadius: 'var(--radius)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)', marginBottom: 8 }}>PEP Status</div>
                  <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 8 }}>
                    Are any UBOs, Directors, or Senior Managers Politically Exposed Persons?
                  </div>
                  <div className="form-group">
                    <select value={pepStatus} onChange={(e) => setPepStatus(e.target.value)}>
                      <option value="">Select...</option>
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                  {pepStatus === 'Yes' && (
                    <div className="form-group">
                      <label>PEP Details</label>
                      <textarea
                        value={pepDetails}
                        onChange={(e) => setPepDetails(e.target.value)}
                        rows={2}
                        placeholder="Provide details about the PEP relationship..."
                        style={{ resize: 'vertical' }}
                      />
                    </div>
                  )}
                </div>

                {error && <p className="error-msg">{error}</p>}
                {updateMsg && <p className="success-msg">{updateMsg}</p>}
                <button className="btn btn-primary" onClick={handleStatusUpdate} disabled={!status || updating} style={{ marginTop: 8 }}>
                  {updating ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            )}

            {/* Show PEP Status if already set */}
            {kycData.pepStatus && (
              <div className="card" style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: 16, marginBottom: 8 }}>PEP Status</h3>
                <div style={{ fontSize: 14 }}>
                  <span style={{ color: 'var(--gray-500)' }}>PEP: </span>
                  <span style={{
                    fontWeight: 600,
                    color: kycData.pepStatus === 'Yes' ? 'var(--red)' : 'var(--green)',
                  }}>
                    {kycData.pepStatus}
                  </span>
                  {kycData.pepDetails && (
                    <div style={{ marginTop: 6, color: 'var(--gray-600)' }}>{kycData.pepDetails}</div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ProtectedLayout>
  );
}

export default function KycReviewPage() {
  const { id } = useParams();
  return <AuthProvider><KycReviewContent id={id} /></AuthProvider>;
}
