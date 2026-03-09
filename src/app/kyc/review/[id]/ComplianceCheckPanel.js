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

// Must match the COMPLIANCE_CHECKS in the API route
const ALL_CHECKS = [
  { checkKey: 'trade_license_validity', label: 'Trade License Validity', category: 'Regulatory & Licensing' },
  { checkKey: 'vat_registration', label: 'VAT Registration Verification', category: 'Regulatory & Licensing' },
  { checkKey: 'free_zone_approval', label: 'Free Zone / Local Authority Approval', category: 'Regulatory & Licensing' },
  { checkKey: 'import_export_license', label: 'Import-Export License Status', category: 'Regulatory & Licensing' },
  { checkKey: 'banking_credibility', label: 'Banking Credibility & Reputation', category: 'Financial & Banking' },
  { checkKey: 'bank_reference_completeness', label: 'Bank Reference Completeness', category: 'Financial & Banking' },
  { checkKey: 'financial_standing', label: 'Financial Standing Assessment', category: 'Financial & Banking' },
  { checkKey: 'ownership_verification', label: 'Ownership & Shareholding Verification', category: 'Identity & Ownership' },
  { checkKey: 'identity_documents', label: 'Identity Documents (UAE ID / Passport)', category: 'Identity & Ownership' },
  { checkKey: 'beneficial_ownership', label: 'Beneficial Ownership Transparency', category: 'Identity & Ownership' },
  { checkKey: 'social_media_reputation', label: 'Social Media & Online Reputation', category: 'Business Reputation' },
  { checkKey: 'trade_references', label: 'Trade References Quality', category: 'Business Reputation' },
  { checkKey: 'supplier_references', label: 'Supplier References Verification', category: 'Business Reputation' },
  { checkKey: 'food_safety_haccp', label: 'Food Safety / HACCP / ISO Certification', category: 'Operational Compliance' },
  { checkKey: 'labor_compliance', label: 'Labor & Safety Compliance', category: 'Operational Compliance' },
  { checkKey: 'environmental_health', label: 'Environmental / Health & Safety', category: 'Operational Compliance' },
  { checkKey: 'aml_ctf_policy', label: 'AML/CTF Policy Compliance', category: 'Compliance & Counter-Fraud' },
  { checkKey: 'abc_policy', label: 'Anti-Bribery & Corruption (ABC) Policy', category: 'Compliance & Counter-Fraud' },
  { checkKey: 'adverse_media_search', label: 'Adverse Media Search', category: 'Compliance & Counter-Fraud' },
  { checkKey: 'litigation_history', label: 'Litigation History', category: 'Compliance & Counter-Fraud' },
  { checkKey: 'document_completeness', label: 'Supporting Document Completeness', category: 'Document Completeness' },
  { checkKey: 'declaration_signed', label: 'Declaration Signed & Authorized', category: 'Document Completeness' },
];

// Group checks by category
const CATEGORIES = [];
const catMap = {};
ALL_CHECKS.forEach(c => {
  if (!catMap[c.category]) {
    catMap[c.category] = { name: c.category, checks: [] };
    CATEGORIES.push(catMap[c.category]);
  }
  catMap[c.category].checks.push(c);
});

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
            {check.checkKey?.startsWith('custom_') && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                background: '#ede9fe', color: '#7c3aed',
              }}>CUSTOM</span>
            )}
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

/* ─── Check Selection Panel ─── */
function CheckSelectionPanel({ selectedChecks, setSelectedChecks, customChecks, setCustomChecks }) {
  const [expandedCats, setExpandedCats] = useState(new Set(CATEGORIES.map(c => c.name)));
  const [customInput, setCustomInput] = useState('');

  const allKeys = ALL_CHECKS.map(c => c.checkKey);
  const allSelected = allKeys.every(k => selectedChecks.has(k));
  const noneSelected = allKeys.every(k => !selectedChecks.has(k));

  function toggleAll() {
    if (allSelected) {
      setSelectedChecks(new Set());
    } else {
      setSelectedChecks(new Set(allKeys));
    }
  }

  function toggleCategory(catName) {
    const catKeys = ALL_CHECKS.filter(c => c.category === catName).map(c => c.checkKey);
    const allCatSelected = catKeys.every(k => selectedChecks.has(k));
    const next = new Set(selectedChecks);
    catKeys.forEach(k => {
      if (allCatSelected) next.delete(k);
      else next.add(k);
    });
    setSelectedChecks(next);
  }

  function toggleCheck(key) {
    const next = new Set(selectedChecks);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedChecks(next);
  }

  function toggleCatExpand(catName) {
    const next = new Set(expandedCats);
    if (next.has(catName)) next.delete(catName);
    else next.add(catName);
    setExpandedCats(next);
  }

  function addCustomCheck() {
    const val = customInput.trim();
    if (!val) return;
    if (customChecks.includes(val)) return;
    setCustomChecks([...customChecks, val]);
    setCustomInput('');
  }

  function removeCustomCheck(idx) {
    setCustomChecks(customChecks.filter((_, i) => i !== idx));
  }

  return (
    <div style={{
      border: '1px solid var(--gray-200)', borderRadius: 10,
      marginBottom: 16, overflow: 'hidden',
    }}>
      {/* Select All header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px', background: 'var(--gray-50)',
        borderBottom: '1px solid var(--gray-200)',
      }}>
        <input
          type="checkbox"
          checked={allSelected}
          ref={el => { if (el) el.indeterminate = !allSelected && !noneSelected; }}
          onChange={toggleAll}
          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--navy)' }}
        />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>
          {allSelected ? 'Deselect All' : 'Select All'} ({selectedChecks.size}/{allKeys.length})
        </span>
      </div>

      {/* Categories */}
      {CATEGORIES.map(cat => {
        const catKeys = cat.checks.map(c => c.checkKey);
        const catAllSelected = catKeys.every(k => selectedChecks.has(k));
        const catNoneSelected = catKeys.every(k => !selectedChecks.has(k));
        const expanded = expandedCats.has(cat.name);

        return (
          <div key={cat.name}>
            {/* Category header */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 16px', borderBottom: '1px solid var(--gray-100)',
                cursor: 'pointer', userSelect: 'none',
                background: expanded ? 'white' : 'var(--gray-50)',
              }}
            >
              <input
                type="checkbox"
                checked={catAllSelected}
                ref={el => { if (el) el.indeterminate = !catAllSelected && !catNoneSelected; }}
                onChange={(e) => { e.stopPropagation(); toggleCategory(cat.name); }}
                style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--navy)' }}
              />
              <div onClick={() => toggleCatExpand(cat.name)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--gray-400)', transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>{cat.name}</span>
                <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>({catKeys.filter(k => selectedChecks.has(k)).length}/{catKeys.length})</span>
              </div>
            </div>

            {/* Individual checks */}
            {expanded && cat.checks.map(check => (
              <div
                key={check.checkKey}
                onClick={() => toggleCheck(check.checkKey)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 16px 6px 40px', cursor: 'pointer',
                  borderBottom: '1px solid var(--gray-50)',
                  background: selectedChecks.has(check.checkKey) ? 'white' : '#fafafa',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedChecks.has(check.checkKey)}
                  onChange={() => toggleCheck(check.checkKey)}
                  style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--navy)' }}
                />
                <span style={{
                  fontSize: 13, color: selectedChecks.has(check.checkKey) ? 'var(--gray-700)' : 'var(--gray-400)',
                }}>
                  {check.label}
                </span>
              </div>
            ))}
          </div>
        );
      })}

      {/* Custom / Additional Checks section */}
      <div style={{
        padding: '12px 16px', borderTop: '2px solid var(--gray-200)',
        background: '#faf5ff',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#7c3aed', marginBottom: 8 }}>
          + Additional Custom Checks
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomCheck(); } }}
            placeholder="What else do you want to check? e.g. Verify ISO 9001 certification"
            style={{
              flex: 1, padding: '8px 12px', fontSize: 13,
              border: '1px solid #d8b4fe', borderRadius: 6,
              background: 'white', outline: 'none',
            }}
          />
          <button
            onClick={addCustomCheck}
            disabled={!customInput.trim()}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 600,
              border: 'none', borderRadius: 6, cursor: customInput.trim() ? 'pointer' : 'not-allowed',
              background: customInput.trim() ? '#7c3aed' : 'var(--gray-200)',
              color: 'white',
            }}
          >
            Add
          </button>
        </div>

        {/* Custom check chips */}
        {customChecks.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {customChecks.map((cc, idx) => (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 16,
                background: '#ede9fe', color: '#7c3aed',
                fontSize: 12, fontWeight: 500,
              }}>
                <span>{cc}</span>
                <button
                  onClick={() => removeCustomCheck(idx)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#7c3aed', fontSize: 14, fontWeight: 700,
                    padding: 0, lineHeight: 1,
                  }}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}

        {customChecks.length === 0 && (
          <p style={{ fontSize: 11, color: 'var(--gray-400)', margin: 0 }}>
            Add any extra checks you want AI to evaluate. These are in addition to the standard checks above.
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Main Panel ─── */
export default function ComplianceCheckPanel({ kycId, onResultsReady }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [showSelection, setShowSelection] = useState(true);
  const [selectedChecks, setSelectedChecks] = useState(new Set(ALL_CHECKS.map(c => c.checkKey)));
  const [customChecks, setCustomChecks] = useState([]);

  useEffect(() => {
    loadResults();
  }, [kycId]);

  async function loadResults() {
    try {
      const data = await kycApi.getComplianceResults(kycId);
      const r = data.results || [];
      setResults(r);
      if (r.length > 0) setShowSelection(false);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function runAiCheck() {
    if (selectedChecks.size === 0 && customChecks.length === 0) {
      setError('Please select at least one check to run.');
      return;
    }
    setRunning(true);
    setError('');
    try {
      const data = await kycApi.runComplianceCheck(kycId, {
        selectedChecks: Array.from(selectedChecks),
        customChecks,
      });
      const r = data.results || [];
      setResults(r);
      setShowSelection(false);
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
      await loadResults();
    } catch (err) {
      setError(err.message);
    }
  }

  // Group results by category
  const grouped = {};
  results.forEach(r => {
    const cat = r.category || 'Custom Checks';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(r);
  });

  // Summary counts
  const summary = { pass: 0, fail: 0, warning: 0, pending: 0, not_applicable: 0 };
  results.forEach(r => {
    const effective = r.adminOverride || r.aiStatus;
    summary[effective] = (summary[effective] || 0) + 1;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ fontSize: 16, margin: 0, color: 'var(--navy)' }}>
          AI Compliance Check
          <span style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 400, marginLeft: 8 }}>Powered by Gemini</span>
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {results.length > 0 && !showSelection && (
            <button
              onClick={() => setShowSelection(true)}
              style={{
                padding: '8px 16px', fontSize: 13, fontWeight: 600,
                border: '1px solid var(--gray-200)', borderRadius: 8,
                background: 'white', color: 'var(--gray-600)', cursor: 'pointer',
              }}
            >
              Re-run Checks
            </button>
          )}
        </div>
      </div>

      {error && <p className="error-msg" style={{ marginBottom: 12 }}>{error}</p>}

      {loading && <p style={{ color: 'var(--gray-400)', fontSize: 14 }}>Loading compliance data...</p>}

      {/* Check Selection Panel */}
      {!loading && showSelection && (
        <>
          <CheckSelectionPanel
            selectedChecks={selectedChecks}
            setSelectedChecks={setSelectedChecks}
            customChecks={customChecks}
            setCustomChecks={setCustomChecks}
          />
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <button
              onClick={runAiCheck}
              disabled={running || (selectedChecks.size === 0 && customChecks.length === 0)}
              style={{
                padding: '10px 28px', fontSize: 14, fontWeight: 600,
                border: 'none', borderRadius: 8,
                cursor: running || (selectedChecks.size === 0 && customChecks.length === 0) ? 'not-allowed' : 'pointer',
                background: running ? 'var(--gray-300)' : 'linear-gradient(135deg, #4285f4, #34a853)',
                color: 'white', display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }}
            >
              {running ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Analyzing {selectedChecks.size + customChecks.length} checks with AI...
                </>
              ) : (
                <>
                  <span style={{ fontSize: 18 }}>✦</span>
                  Run AI Compliance Check ({selectedChecks.size + customChecks.length} checks)
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* Summary bar */}
      {results.length > 0 && !showSelection && (
        <div style={{
          display: 'flex', gap: 12, marginBottom: 16, padding: '10px 16px',
          background: 'var(--gray-50)', borderRadius: 8, flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 13, color: 'var(--gray-500)', fontWeight: 500, marginRight: 4 }}>Summary:</div>
          {summary.pass > 0 && <><StatusBadge status="pass" small /><span style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>{summary.pass}</span></>}
          {summary.warning > 0 && <><StatusBadge status="warning" small /><span style={{ fontSize: 13, fontWeight: 600, color: '#d97706' }}>{summary.warning}</span></>}
          {summary.fail > 0 && <><StatusBadge status="fail" small /><span style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>{summary.fail}</span></>}
          {summary.pending > 0 && <><StatusBadge status="pending" small /><span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>{summary.pending}</span></>}
          {summary.not_applicable > 0 && <><StatusBadge status="not_applicable" small /><span style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>{summary.not_applicable}</span></>}
        </div>
      )}

      {/* No results + selection hidden */}
      {!loading && results.length === 0 && !showSelection && (
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
            Click &quot;Re-run Checks&quot; to select which compliance checks to analyze.
          </p>
        </div>
      )}

      {/* Grouped results */}
      {!showSelection && Object.entries(grouped).map(([category, checks]) => (
        <div key={category} style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
            color: 'var(--gray-400)', padding: '8px 16px',
            background: category === 'Custom Checks' ? '#faf5ff' : 'var(--gray-50)',
            borderRadius: '8px 8px 0 0',
            borderBottom: '1px solid var(--gray-100)',
          }}>
            {category}
            {category === 'Custom Checks' && (
              <span style={{ marginLeft: 6, fontSize: 10, color: '#7c3aed', fontWeight: 600 }}>ADDITIONAL</span>
            )}
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
