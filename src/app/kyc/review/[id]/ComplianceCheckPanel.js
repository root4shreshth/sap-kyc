'use client';
import { useState, useEffect } from 'react';
import { kycApi } from '@/lib/api-client';

const STATUS_CONFIG = {
  pass: { label: 'Pass', color: '#16a34a', bg: '#dcfce7', icon: '✓' },
  fail: { label: 'Fail', color: '#dc2626', bg: '#fee2e2', icon: '✗' },
  warning: { label: 'Warning', color: '#d97706', bg: '#fef3c7', icon: '⚠' },
  not_applicable: { label: 'N/A', color: '#6b7280', bg: '#f3f4f6', icon: '—' },
  pending: { label: 'Pending', color: '#94a3b8', bg: '#f1f5f9', icon: '○' },
};

function StatusBadge({ status, small = false }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: small ? '2px 8px' : '3px 10px',
      borderRadius: 12, fontSize: small ? 11 : 12, fontWeight: 600,
      color: config.color, background: config.bg,
    }}>
      <span>{config.icon}</span> {config.label}
    </span>
  );
}

function ComplianceCheckRow({ check, onOverride }) {
  const [editing, setEditing] = useState(false);
  const [override, setOverride] = useState(check.adminOverride || '');
  const [notes, setNotes] = useState(check.adminNotes || '');
  const [saving, setSaving] = useState(false);

  const effectiveStatus = check.adminOverride || check.aiStatus;

  async function handleSave() {
    setSaving(true);
    try {
      await onOverride(check.checkKey, override || null, notes);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      padding: '12px 16px',
      borderBottom: '1px solid var(--gray-100)',
      background: editing ? 'var(--gray-50)' : 'transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <StatusBadge status={effectiveStatus} />
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--navy)' }}>{check.label}</span>
          </div>
          {check.aiRemarks && (
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginLeft: 4, marginTop: 2 }}>
              <span style={{ fontWeight: 600, color: 'var(--gray-400)' }}>AI: </span>
              {check.aiRemarks}
            </div>
          )}
          {check.adminOverride && (
            <div style={{ fontSize: 12, color: '#7c3aed', marginLeft: 4, marginTop: 2 }}>
              <span style={{ fontWeight: 600 }}>Override: </span>
              {check.adminNotes || 'No notes'}
              {check.updatedBy && <span style={{ color: 'var(--gray-400)' }}> — by {check.updatedBy}</span>}
            </div>
          )}
        </div>
        <button
          onClick={() => setEditing(!editing)}
          style={{
            padding: '4px 10px', fontSize: 11, fontWeight: 600,
            border: '1px solid var(--gray-200)', borderRadius: 6,
            background: 'white', color: 'var(--gray-600)', cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {editing ? 'Cancel' : 'Override'}
        </button>
      </div>

      {editing && (
        <div style={{ marginTop: 10, padding: '10px 12px', background: 'white', borderRadius: 8, border: '1px solid var(--gray-200)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            {['pass', 'fail', 'warning', 'not_applicable'].map(s => (
              <button key={s} onClick={() => setOverride(s)} style={{
                padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
                border: override === s ? `2px solid ${STATUS_CONFIG[s].color}` : '1px solid var(--gray-200)',
                background: override === s ? STATUS_CONFIG[s].bg : 'white',
                color: override === s ? STATUS_CONFIG[s].color : 'var(--gray-500)',
              }}>
                {STATUS_CONFIG[s].icon} {STATUS_CONFIG[s].label}
              </button>
            ))}
            {override && (
              <button onClick={() => setOverride('')} style={{
                padding: '4px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                border: '1px solid var(--gray-200)', background: 'white', color: 'var(--red)',
              }}>
                Clear
              </button>
            )}
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Admin notes (optional)..."
            rows={2}
            style={{ width: '100%', padding: 8, border: '1px solid var(--gray-200)', borderRadius: 6, fontSize: 13, resize: 'vertical' }}
          />
          <button onClick={handleSave} disabled={saving} style={{
            marginTop: 6, padding: '6px 16px', fontSize: 12, fontWeight: 600,
            border: 'none', borderRadius: 6, cursor: 'pointer',
            background: 'var(--navy)', color: 'white',
          }}>
            {saving ? 'Saving...' : 'Save Override'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ComplianceCheckPanel({ kycId, onResultsReady }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadResults();
  }, [kycId]);

  async function loadResults() {
    try {
      const data = await kycApi.getComplianceResults(kycId);
      setResults(data.results || []);
    } catch {
      // No results yet — that's fine
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function runAiCheck() {
    setRunning(true);
    setError('');
    try {
      const data = await kycApi.runComplianceCheck(kycId);
      const r = data.results || [];
      setResults(r);
      if (onResultsReady) onResultsReady(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  async function handleOverride(checkKey, adminOverride, adminNotes) {
    try {
      await kycApi.overrideCompliance(kycId, checkKey, adminOverride, adminNotes);
      // Refresh results
      await loadResults();
    } catch (err) {
      setError(err.message);
    }
  }

  // Group results by category
  const grouped = {};
  results.forEach(r => {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  });

  // Summary counts
  const summary = { pass: 0, fail: 0, warning: 0, pending: 0, not_applicable: 0 };
  results.forEach(r => {
    const effective = r.adminOverride || r.aiStatus;
    summary[effective] = (summary[effective] || 0) + 1;
  });

  return (
    <div>
      {/* Header with Run AI Check button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ fontSize: 16, margin: 0, color: 'var(--navy)' }}>
          AI Compliance Check
          <span style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 400, marginLeft: 8 }}>Powered by Gemini</span>
        </h3>
        <button
          onClick={runAiCheck}
          disabled={running}
          style={{
            padding: '8px 20px', fontSize: 13, fontWeight: 600,
            border: 'none', borderRadius: 8, cursor: running ? 'not-allowed' : 'pointer',
            background: running ? 'var(--gray-300)' : 'linear-gradient(135deg, #4285f4, #34a853)',
            color: 'white', display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          {running ? (
            <>
              <span className="spinner" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Analyzing with AI...
            </>
          ) : (
            <>
              <span style={{ fontSize: 16 }}>✦</span>
              {results.length > 0 ? 'Re-run AI Check' : 'Run AI Compliance Check'}
            </>
          )}
        </button>
      </div>

      {error && <p className="error-msg" style={{ marginBottom: 12 }}>{error}</p>}

      {loading && <p style={{ color: 'var(--gray-400)', fontSize: 14 }}>Loading compliance data...</p>}

      {/* Summary bar */}
      {results.length > 0 && (
        <div style={{
          display: 'flex', gap: 12, marginBottom: 16, padding: '10px 16px',
          background: 'var(--gray-50)', borderRadius: 8, flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 13, color: 'var(--gray-500)', fontWeight: 500, marginRight: 4 }}>Summary:</div>
          {summary.pass > 0 && <StatusBadge status="pass" small />}
          {summary.pass > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>{summary.pass}</span>}
          {summary.warning > 0 && <StatusBadge status="warning" small />}
          {summary.warning > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: '#d97706' }}>{summary.warning}</span>}
          {summary.fail > 0 && <StatusBadge status="fail" small />}
          {summary.fail > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>{summary.fail}</span>}
          {summary.pending > 0 && <StatusBadge status="pending" small />}
          {summary.pending > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>{summary.pending}</span>}
          {summary.not_applicable > 0 && <StatusBadge status="not_applicable" small />}
          {summary.not_applicable > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>{summary.not_applicable}</span>}
        </div>
      )}

      {/* No results yet */}
      {!loading && results.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '32px 16px',
          background: 'var(--gray-50)', borderRadius: 8,
          border: '2px dashed var(--gray-200)',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          <p style={{ fontSize: 14, color: 'var(--gray-500)', marginBottom: 4 }}>
            No compliance check has been run yet.
          </p>
          <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>
            Click &quot;Run AI Compliance Check&quot; to analyze the submitted KYC data using Gemini AI.
          </p>
        </div>
      )}

      {/* Grouped results */}
      {Object.entries(grouped).map(([category, checks]) => (
        <div key={category} style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
            color: 'var(--gray-400)', padding: '8px 16px',
            background: 'var(--gray-50)', borderRadius: '8px 8px 0 0',
            borderBottom: '1px solid var(--gray-100)',
          }}>
            {category}
          </div>
          <div style={{ border: '1px solid var(--gray-100)', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
            {checks.map(check => (
              <ComplianceCheckRow key={check.checkKey} check={check} onOverride={handleOverride} />
            ))}
          </div>
        </div>
      ))}

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
