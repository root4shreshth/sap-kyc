'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { kycApi } from '@/lib/api-client';
import { getDefaultFormData, getMockFormData } from './formSchema';
import { validateFormData, getSectionCompletion } from './validation';
import {
  BusinessInfoSection, ProprietorsSection, CompanyDetailsSection,
  OwnershipSection, BankingSection, ReferencesSection,
  SocialMediaSection, IndianBuyerSection, DeclarationSection,
} from './FormSections';

function KycPortalContent({ token }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState(getDefaultFormData());
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const sectionRefs = useRef([]);

  useEffect(() => {
    kycApi.portalValidate(token)
      .then((data) => {
        setInfo(data);
        kycApi.portalGetForm(token).then(({ formData: saved }) => {
          if (saved && Object.keys(saved).length > 0) {
            setFormData((prev) => mergeDeep(prev, saved));
            if (saved.lastSaved) setLastSaved(saved.lastSaved);
          }
        }).catch(() => {});
      })
      .catch((e) => setError(e.message));
  }, [token]);

  const update = useCallback((section, field, value) => {
    setFormData((prev) => {
      const parts = section.split('.');
      const next = JSON.parse(JSON.stringify(prev));
      let obj = next;
      for (const part of parts) {
        if (!obj[part]) obj[part] = {};
        obj = obj[part];
      }
      obj[field] = value;
      return next;
    });
    // Clear error for this field when user types
    setValidationErrors((prev) => {
      const key = `${section}.${field}`;
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return prev;
    });
  }, []);

  const updateArray = useCallback((arrayKey, index, field, value) => {
    setFormData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (next[arrayKey] && next[arrayKey][index]) {
        next[arrayKey][index][field] = value;
      }
      return next;
    });
    // Clear error for this array field
    setValidationErrors((prev) => {
      const key = `${arrayKey}.${index}.${field}`;
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return prev;
    });
  }, []);

  const addRow = useCallback((arrayKey, defaultRow) => {
    setFormData((prev) => ({
      ...prev,
      [arrayKey]: [...(prev[arrayKey] || []), { ...defaultRow }],
    }));
  }, []);

  const removeRow = useCallback((arrayKey, index) => {
    setFormData((prev) => ({
      ...prev,
      [arrayKey]: prev[arrayKey].filter((_, i) => i !== index),
    }));
  }, []);

  async function handleSaveDraft() {
    setSaving(true);
    setError('');
    try {
      await kycApi.portalSaveForm(token, formData);
      setLastSaved(new Date().toISOString());
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    setError('');

    // Validate before submitting
    const result = validateFormData(formData);
    if (!result.valid) {
      setValidationErrors(result.errors);
      // Scroll to the first section that has errors
      const errorKeys = Object.keys(result.errors);
      if (errorKeys.length > 0) {
        const firstErrorSection = errorKeys[0].split('.')[0];
        const sectionIndex = SECTION_KEYS.findIndex(key => {
          if (key === 'proprietors' && (firstErrorSection === 'proprietors' || firstErrorSection === 'managerInfo')) return true;
          if (key === 'business' && firstErrorSection === 'businessInfo') return true;
          if (key === 'company' && firstErrorSection === 'companyDetails') return true;
          if (key === 'ownership' && firstErrorSection === 'ownershipManagement') return true;
          if (key === 'banking' && firstErrorSection === 'bankReference') return true;
          if (key === 'declaration' && firstErrorSection === 'declaration') return true;
          return false;
        });
        if (sectionIndex >= 0 && sectionRefs.current[sectionIndex]) {
          sectionRefs.current[sectionIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
      setError('Please fill in all required fields before submitting.');
      return;
    }

    setValidationErrors({});
    setSubmitting(true);
    try {
      const multipart = new FormData();
      multipart.append('formData', JSON.stringify(formData));
      const docTypes = [];
      files.forEach((f) => {
        if (f.file) {
          multipart.append('documents', f.file);
          docTypes.push(f.docType);
        }
      });
      if (docTypes.length > 0) {
        multipart.append('docTypes', JSON.stringify(docTypes));
      }
      await kycApi.portalUpload(token, multipart);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

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

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ maxWidth: 500, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12, color: 'var(--green)' }}>&#10003;</div>
          <h2 style={{ color: 'var(--green)', marginBottom: 8 }}>Application Submitted</h2>
          <p style={{ color: 'var(--gray-500)' }}>
            Thank you. Your KYC/KYS application and documents have been submitted for review.
            You will receive an email with the outcome.
          </p>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--gray-400)' }}>Validating link...</p>
      </div>
    );
  }

  async function toggleDemoData() {
    if (!demoMode) {
      const mock = getMockFormData();
      setFormData(mock);
      setDemoMode(true);
      setValidationErrors({});
      setSaving(true);
      try {
        await kycApi.portalSaveForm(token, mock);
        setLastSaved(new Date().toISOString());
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    } else {
      const blank = getDefaultFormData();
      setFormData(blank);
      setDemoMode(false);
      setValidationErrors({});
      setSaving(true);
      try {
        await kycApi.portalSaveForm(token, blank);
        setLastSaved(new Date().toISOString());
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    }
  }

  const sectionProps = { data: formData, update, updateArray, addRow, removeRow, errors: validationErrors };

  const SECTION_KEYS = ['business', 'proprietors', 'company', 'ownership', 'banking', 'references', 'social', 'indian', 'declaration'];

  const SECTIONS = [
    { key: 'business', label: 'Business Info', component: <BusinessInfoSection {...sectionProps} /> },
    { key: 'proprietors', label: 'Proprietors', component: <ProprietorsSection {...sectionProps} /> },
    { key: 'company', label: 'Company (UAE)', component: <CompanyDetailsSection {...sectionProps} /> },
    { key: 'ownership', label: 'Ownership', component: <OwnershipSection {...sectionProps} /> },
    { key: 'banking', label: 'Banking', component: <BankingSection {...sectionProps} /> },
    { key: 'references', label: 'References', component: <ReferencesSection {...sectionProps} /> },
    { key: 'social', label: 'Social Media', component: <SocialMediaSection {...sectionProps} /> },
    { key: 'indian', label: 'Indian Buyer', component: <IndianBuyerSection {...sectionProps} /> },
    { key: 'declaration', label: 'Declaration & Docs', component: <DeclarationSection {...sectionProps} files={files} setFiles={setFiles} /> },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-100)', padding: '32px 16px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src={info.companyProfile?.logoUrl || '/logo.png'} alt="Company" style={{ height: 60, marginBottom: 8 }} onError={(e) => { e.target.src = '/logo.png'; }} />
          <h1 style={{ fontSize: 22, color: 'var(--navy)' }}>KYC / KYS Application Form</h1>
          <p style={{ color: 'var(--gray-500)', marginTop: 4, fontSize: 14 }}>
            {info.companyProfile?.name || 'AL AMIR GROUP HOLDING COMPANY.'}
          </p>
        </div>

        {/* Demo toggle */}
        <div style={{ textAlign: 'right', marginBottom: 12 }}>
          <button
            onClick={toggleDemoData}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              border: demoMode ? '2px solid var(--red)' : '2px solid var(--green)',
              borderRadius: 20,
              background: demoMode ? '#fee2e2' : '#dcfce7',
              color: demoMode ? '#991b1b' : '#166534',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {saving ? 'Saving...' : demoMode ? 'Clear Demo Data' : 'Fill Demo Data'}
          </button>
        </div>

        <div className="card" style={{ marginBottom: 16, padding: '12px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <span style={{ color: 'var(--gray-500)' }}>Client: </span>
              <strong>{info.clientName}</strong>
              <span style={{ color: 'var(--gray-300)', margin: '0 8px' }}>|</span>
              <span style={{ color: 'var(--gray-500)' }}>Company: </span>
              <strong>{info.companyName}</strong>
            </div>
            {lastSaved && (
              <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                Last saved: {new Date(lastSaved).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* All sections on single page */}
        {SECTIONS.map((s, i) => {
          const completion = getSectionCompletion(formData, s.key);
          return (
            <div
              key={i}
              ref={(el) => { sectionRefs.current[i] = el; }}
              className="card"
              style={{ marginBottom: 16, scrollMarginTop: 16 }}
            >
              <h3 style={{
                fontSize: 15, fontWeight: 700, color: 'var(--navy)',
                marginBottom: 16, paddingBottom: 8,
                borderBottom: '2px solid var(--gray-200)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>{i + 1}. {s.label}</span>
                {completion !== null && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 12,
                    background: completion === 100 ? '#dcfce7' : '#fef3c7',
                    color: completion === 100 ? '#16a34a' : '#d97706',
                  }}>
                    {completion === 100 ? 'Complete' : `${completion}%`}
                  </span>
                )}
              </h3>
              {s.component}
            </div>
          );
        })}

        {error && <p className="error-msg" style={{ marginBottom: 12 }}>{error}</p>}

        {/* Bottom action bar */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12,
          flexWrap: 'wrap', marginBottom: 32,
        }}>
          <button className="btn btn-secondary" onClick={handleSaveDraft} disabled={saving}>
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Application'}
          </button>
        </div>
      </div>
    </div>
  );
}

function mergeDeep(target, source) {
  const result = JSON.parse(JSON.stringify(target));
  for (const key of Object.keys(source)) {
    if (key === 'version' || key === 'lastSaved') continue;
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = mergeDeep(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export default function KycPortalPage() {
  const { token } = useParams();
  return <KycPortalContent token={token} />;
}
