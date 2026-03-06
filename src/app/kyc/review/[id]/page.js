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
  // SAP state
  const [bpType, setBpType] = useState('');
  const [sapPushing, setSapPushing] = useState(false);
  const [sapMsg, setSapMsg] = useState('');
  const [sapError, setSapError] = useState('');
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderMsg, setReminderMsg] = useState('');

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
          if (found.sapBpType) setBpType(found.sapBpType);
        }
        setDocs(docList);
        if (fd && Object.keys(fd).length > 0) setFormData(fd);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleStatusUpdate() {
    if (!status) return;
    // If approving, require BP type selection
    if (status === 'Approved' && !bpType) {
      setError('Please select SAP Business Partner type (Customer/Vendor) before approving');
      return;
    }
    setError('');
    setUpdateMsg('');
    setUpdating(true);
    try {
      const result = await kycApi.updateStatus(id, status, remarks, pepStatus, pepDetails);
      setUpdateMsg(result.message);
      setKycData((prev) => ({ ...prev, status, remarks, pepStatus, pepDetails }));

      // If approved, auto-trigger SAP push
      if (status === 'Approved') {
        await handleSapPush();
      }

      setStatus('');
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  }

  async function handleSapPush() {
    if (!bpType) {
      setSapError('Select a Business Partner type first');
      return;
    }
    setSapPushing(true);
    setSapError('');
    setSapMsg('');
    try {
      const result = await kycApi.sapPush(id, bpType);
      setSapMsg(result.message);
      setKycData((prev) => ({
        ...prev,
        sapCardCode: result.cardCode,
        sapBpType: result.bpType,
        sapSyncedAt: new Date().toISOString(),
        sapSyncError: '',
      }));
    } catch (err) {
      setSapError(err.message);
    } finally {
      setSapPushing(false);
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

  async function handleSendReminder() {
    setSendingReminder(true);
    setReminderMsg('');
    try {
      const result = await kycApi.sendReminder(id);
      setReminderMsg(result.message || 'Reminder sent');
    } catch (err) {
      setReminderMsg('Failed: ' + err.message);
    } finally {
      setSendingReminder(false);
    }
  }

  function generateRemarksFromCompliance(results) {
    if (!results || results.length === 0) return;
    const summary = { pass: 0, fail: 0, warning: 0, not_applicable: 0 };
    const fails = [];
    const warnings = [];
    results.forEach(r => {
      const s = r.adminOverride || r.aiStatus;
      summary[s] = (summary[s] || 0) + 1;
      if (s === 'fail') fails.push(r);
      if (s === 'warning') warnings.push(r);
    });
    const lines = ['--- AI COMPLIANCE SUMMARY ---'];
    lines.push(`Pass: ${summary.pass} | Warning: ${summary.warning} | Fail: ${summary.fail} | N/A: ${summary.not_applicable || 0}`);
    if (fails.length > 0) {
      lines.push('');
      lines.push('FAILURES:');
      fails.forEach(f => {
        lines.push(`- ${f.label}: ${f.aiRemarks || 'No details'}`);
      });
    }
    if (warnings.length > 0) {
      lines.push('');
      lines.push('WARNINGS:');
      warnings.forEach(w => {
        lines.push(`- ${w.label}: ${w.aiRemarks || 'No details'}`);
      });
    }
    if (fails.length === 0 && warnings.length === 0) {
      lines.push('');
      lines.push('All checks passed. No issues detected.');
    }
    lines.push('');
    lines.push('--- End of AI Report ---');
    setRemarks(lines.join('\n'));
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
              {['Pending', 'Submitted'].includes(kycData.status) && (
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '6px 14px', fontSize: 13 }}
                    onClick={handleSendReminder}
                    disabled={sendingReminder}
                  >
                    {sendingReminder ? 'Sending...' : 'Send Reminder'}
                  </button>
                  {reminderMsg && <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>{reminderMsg}</span>}
                </div>
              )}
              {kycData.remarks && (
                <div style={{ marginTop: 16, fontSize: 14 }}>
                  <span style={{ color: 'var(--gray-500)' }}>Remarks</span>
                  <div style={{ fontWeight: 500, marginTop: 2, whiteSpace: 'pre-wrap' }}>{kycData.remarks}</div>
                </div>
              )}
            </div>

            {/* SAP Status Card */}
            {(kycData.sapCardCode || kycData.sapSyncError) && (
              <div className="card" style={{
                marginBottom: 24,
                border: kycData.sapCardCode ? '1px solid #16a34a' : '1px solid #dc2626',
                background: kycData.sapCardCode ? '#f0fdf4' : '#fef2f2',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ fontSize: 16, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{kycData.sapCardCode ? '✅' : '❌'}</span>
                    SAP Integration
                  </h3>
                  {kycData.sapCardCode && (
                    <span style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                      background: '#16a34a', color: 'white',
                    }}>
                      {kycData.sapCardCode}
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
                  {kycData.sapBpType && (
                    <div>
                      <span style={{ color: 'var(--gray-500)' }}>BP Type</span>
                      <div style={{ fontWeight: 500, textTransform: 'capitalize' }}>{kycData.sapBpType}</div>
                    </div>
                  )}
                  {kycData.sapSyncedAt && (
                    <div>
                      <span style={{ color: 'var(--gray-500)' }}>Synced At</span>
                      <div style={{ fontWeight: 500 }}>{new Date(kycData.sapSyncedAt).toLocaleString()}</div>
                    </div>
                  )}
                </div>
                {kycData.sapSyncError && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 500, marginBottom: 8 }}>
                      Error: {kycData.sapSyncError}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <select
                        value={bpType}
                        onChange={(e) => setBpType(e.target.value)}
                        style={{ padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--gray-200)' }}
                      >
                        <option value="">Select BP Type...</option>
                        <option value="customer">Customer</option>
                        <option value="vendor">Vendor</option>
                        <option value="lead">Lead</option>
                      </select>
                      <button
                        onClick={handleSapPush}
                        disabled={sapPushing || !bpType}
                        style={{
                          padding: '6px 16px', fontSize: 13, fontWeight: 600,
                          border: 'none', borderRadius: 6, cursor: 'pointer',
                          background: '#2563eb', color: 'white',
                        }}
                      >
                        {sapPushing ? 'Retrying...' : 'Retry SAP Push'}
                      </button>
                    </div>
                    {sapMsg && <p style={{ color: '#16a34a', fontSize: 13, marginTop: 6 }}>{sapMsg}</p>}
                    {sapError && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 6 }}>{sapError}</p>}
                  </div>
                )}
              </div>
            )}

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
                <ComplianceCheckPanel kycId={id} onResultsReady={generateRemarksFromCompliance} />
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

                {/* SAP BP Type — shown when approving */}
                {status === 'Approved' && (
                  <div style={{
                    marginBottom: 12, padding: 16,
                    background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid #93c5fd',
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1e40af', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 16 }}>🔗</span> SAP Business Partner
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 8 }}>
                      This client will be created as a Business Partner in SAP B1 upon approval.
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: 13 }}>Business Partner Type <span style={{ color: '#dc2626' }}>*</span></label>
                      <select value={bpType} onChange={(e) => setBpType(e.target.value)}>
                        <option value="">Select type...</option>
                        <option value="customer">Customer</option>
                        <option value="vendor">Vendor</option>
                        <option value="lead">Lead</option>
                      </select>
                    </div>
                  </div>
                )}

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
                {sapMsg && <p className="success-msg">{sapMsg}</p>}
                {sapError && <p className="error-msg">SAP: {sapError}</p>}
                <button
                  className="btn btn-primary"
                  onClick={handleStatusUpdate}
                  disabled={!status || updating || sapPushing}
                  style={{ marginTop: 8 }}
                >
                  {updating || sapPushing
                    ? (sapPushing ? 'Pushing to SAP...' : 'Updating...')
                    : status === 'Approved'
                      ? 'Approve & Push to SAP'
                      : 'Update Status'
                  }
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
