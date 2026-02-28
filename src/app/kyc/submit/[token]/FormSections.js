'use client';

// Reusable field components
function Field({ label, value, onChange, type = 'text', placeholder = '', style = {}, required = false, error = '' }) {
  return (
    <div className="form-group" style={{ marginBottom: 12, ...style }}>
      <label style={{ fontSize: 13, color: 'var(--gray-600)' }}>
        {label}
        {required && <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>}
      </label>
      <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          fontSize: 14,
          ...(error ? { borderColor: 'var(--red)', boxShadow: '0 0 0 3px rgba(220, 38, 38, 0.1)' } : {}),
        }} />
      {error && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{error}</p>}
    </div>
  );
}

function TextArea({ label, value, onChange, rows = 2, required = false, error = '' }) {
  return (
    <div className="form-group" style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 13, color: 'var(--gray-600)' }}>
        {label}
        {required && <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>}
      </label>
      <textarea value={value || ''} onChange={(e) => onChange(e.target.value)}
        rows={rows}
        style={{
          fontSize: 14, resize: 'vertical',
          ...(error ? { borderColor: 'var(--red)', boxShadow: '0 0 0 3px rgba(220, 38, 38, 0.1)' } : {}),
        }} />
      {error && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{error}</p>}
    </div>
  );
}

function Checkbox({ label, checked, onChange, required = false, error = '' }) {
  return (
    <div>
      <label className="checkbox-item" style={error ? { color: 'var(--red)' } : {}}>
        <input type="checkbox" checked={checked || false} onChange={(e) => onChange(e.target.checked)}
          style={error ? { accentColor: 'var(--red)' } : {}} />
        <span>
          {label}
          {required && <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>}
        </span>
      </label>
      {error && <p style={{ color: 'var(--red)', fontSize: 11, marginTop: 2, marginLeft: 24 }}>{error}</p>}
    </div>
  );
}

function SectionTitle({ children }) {
  return <div className="form-section-title">{children}</div>;
}

// ==================== SECTION 1: Business Information ====================
export function BusinessInfoSection({ data, update, errors = {} }) {
  const d = data.businessInfo || {};
  const bt = d.businessType || {};
  const set = (field, val) => update('businessInfo', field, val);
  const setBt = (field, val) => update('businessInfo.businessType', field, val);
  const e = (field) => errors[`businessInfo.${field}`] || '';

  return (
    <div>
      <SectionTitle>Business Information</SectionTitle>
      <div className="form-grid-2">
        <Field label="Business Name" value={d.businessName} onChange={(v) => set('businessName', v)} required error={e('businessName')} />
        <Field label="Tax Registration No." value={d.taxRegistrationNo} onChange={(v) => set('taxRegistrationNo', v)} />
      </div>
      <Field label="Address" value={d.address} onChange={(v) => set('address', v)} required error={e('address')} />
      <div className="form-grid-3">
        <Field label="City" value={d.city} onChange={(v) => set('city', v)} required error={e('city')} />
        <Field label="Province / State" value={d.provinceState} onChange={(v) => set('provinceState', v)} />
        <Field label="Postal / Zip Code" value={d.postalZipCode} onChange={(v) => set('postalZipCode', v)} />
      </div>
      <div className="form-grid-3">
        <Field label="Country" value={d.country} onChange={(v) => set('country', v)} required error={e('country')} />
        <Field label="Phone" value={d.phone} onChange={(v) => set('phone', v)} type="tel" required error={e('phone')} />
        <Field label="Website" value={d.website} onChange={(v) => set('website', v)} />
      </div>

      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <label style={{ fontSize: 13, color: 'var(--gray-600)', display: 'block', marginBottom: 8 }}>Type of Business</label>
        <div className="checkbox-group">
          <Checkbox label="Corporation" checked={bt.corporation} onChange={(v) => setBt('corporation', v)} />
          <Checkbox label="Incorporated" checked={bt.incorporated} onChange={(v) => setBt('incorporated', v)} />
          <Checkbox label="Partnership" checked={bt.partnership} onChange={(v) => setBt('partnership', v)} />
          <Checkbox label="Sole Proprietorship" checked={bt.soleProprietorship} onChange={(v) => setBt('soleProprietorship', v)} />
        </div>
      </div>

      <div className="form-grid-2">
        <Field label="Date of Incorporation" value={d.dateOfIncorporation} onChange={(v) => set('dateOfIncorporation', v)} type="date" />
        <Field label="Years in Business" value={d.yearsInBusiness} onChange={(v) => set('yearsInBusiness', v)} />
      </div>
      <div className="form-grid-2">
        <Field label="Nature of Business" value={d.natureOfBusiness} onChange={(v) => set('natureOfBusiness', v)} />
        <Field label="Monthly Credit Required" value={d.monthlyCreditRequired} onChange={(v) => set('monthlyCreditRequired', v)} />
      </div>
      <div className="form-grid-2">
        <Field label="Annual Sales" value={d.annualSales} onChange={(v) => set('annualSales', v)} />
        <Field label="Number of Employees" value={d.numberOfEmployees} onChange={(v) => set('numberOfEmployees', v)} />
      </div>
    </div>
  );
}

// ==================== SECTION 2: Proprietors & Management ====================
export function ProprietorsSection({ data, update, updateArray, errors = {} }) {
  const props = data.proprietors || [];
  const mgr = data.managerInfo || {};
  const setMgr = (field, val) => update('managerInfo', field, val);
  const em = (field) => errors[`managerInfo.${field}`] || '';

  return (
    <div>
      <SectionTitle>Proprietor(s) / Owner(s)</SectionTitle>
      {errors['proprietors._min'] && (
        <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{errors['proprietors._min']}</p>
      )}
      {props.map((p, i) => (
        <div key={i} className="dynamic-row">
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginBottom: 8 }}>Proprietor {i + 1}</div>
          <div className="form-grid-2">
            <Field label="Name" value={p.name} onChange={(v) => updateArray('proprietors', i, 'name', v)} required error={errors[`proprietors.${i}.name`] || ''} />
            <Field label="Title / Position" value={p.title} onChange={(v) => updateArray('proprietors', i, 'title', v)} />
          </div>
          <Field label="Address" value={p.address} onChange={(v) => updateArray('proprietors', i, 'address', v)} />
          <div className="form-grid-3">
            <Field label="Email" value={p.email} onChange={(v) => updateArray('proprietors', i, 'email', v)} type="email" required error={errors[`proprietors.${i}.email`] || ''} />
            <Field label="Phone" value={p.phone} onChange={(v) => updateArray('proprietors', i, 'phone', v)} type="tel" />
            <Field label="Mobile" value={p.mobile} onChange={(v) => updateArray('proprietors', i, 'mobile', v)} type="tel" />
          </div>
        </div>
      ))}

      <SectionTitle>Manager & Accounts Payable Contact</SectionTitle>
      <div className="form-grid-2">
        <Field label="Manager Name" value={mgr.managerName} onChange={(v) => setMgr('managerName', v)} required error={em('managerName')} />
        <Field label="Manager Email" value={mgr.managerEmail} onChange={(v) => setMgr('managerEmail', v)} type="email" required error={em('managerEmail')} />
      </div>
      <div className="form-grid-2">
        <Field label="Manager Phone" value={mgr.managerPhone} onChange={(v) => setMgr('managerPhone', v)} type="tel" required error={em('managerPhone')} />
        <Field label="Manager Mobile" value={mgr.managerMobile} onChange={(v) => setMgr('managerMobile', v)} type="tel" />
      </div>
      <div className="form-grid-2">
        <Field label="AP Contact Name" value={mgr.apContactName} onChange={(v) => setMgr('apContactName', v)} />
        <Field label="AP Contact Email" value={mgr.apContactEmail} onChange={(v) => setMgr('apContactEmail', v)} type="email" />
      </div>
      <div className="form-grid-2">
        <Field label="AP Contact Phone" value={mgr.apContactPhone} onChange={(v) => setMgr('apContactPhone', v)} type="tel" />
        <Field label="AP Contact Mobile" value={mgr.apContactMobile} onChange={(v) => setMgr('apContactMobile', v)} type="tel" />
      </div>
    </div>
  );
}

// ==================== SECTION 3: Company Details (UAE) ====================
export function CompanyDetailsSection({ data, update, updateArray, addRow, removeRow, errors = {} }) {
  const d = data.companyDetails || {};
  const set = (field, val) => update('companyDetails', field, val);
  const warehouses = data.warehouseAddresses || [];
  const agent = d.borderAgent || {};
  const setAgent = (field, val) => update('companyDetails.borderAgent', field, val);
  const e = (field) => errors[`companyDetails.${field}`] || '';

  return (
    <div>
      <SectionTitle>Company Information (UAE)</SectionTitle>
      <Field label="Company Name (as per Trade License)" value={d.companyName} onChange={(v) => set('companyName', v)} required error={e('companyName')} />
      <div className="form-grid-2">
        <Field label="Trade License No." value={d.tradeLicenseNo} onChange={(v) => set('tradeLicenseNo', v)} required error={e('tradeLicenseNo')} />
        <Field label="Trade License Expiry Date" value={d.tradeLicenseExpiry} onChange={(v) => set('tradeLicenseExpiry', v)} type="date" />
      </div>
      <div className="form-grid-2">
        <Field label="MQA / Registration No." value={d.mqaRegistrationNo} onChange={(v) => set('mqaRegistrationNo', v)} />
        <Field label="VAT Registration No." value={d.vatRegistrationNo} onChange={(v) => set('vatRegistrationNo', v)} />
      </div>
      <Field label="Company Address" value={d.companyAddress} onChange={(v) => set('companyAddress', v)} required error={e('companyAddress')} />
      <div className="form-grid-3">
        <Field label="Office Phone" value={d.officePhone} onChange={(v) => set('officePhone', v)} type="tel" />
        <Field label="Email" value={d.email} onChange={(v) => set('email', v)} type="email" />
        <Field label="Website / Social Media" value={d.websiteSocialMedia} onChange={(v) => set('websiteSocialMedia', v)} />
      </div>

      <SectionTitle>Registered Office & Warehouse Details</SectionTitle>
      <Field label="Registered Office Address" value={d.registeredOfficeAddress} onChange={(v) => set('registeredOfficeAddress', v)} />

      {warehouses.map((w, i) => (
        <div key={i} className="dynamic-row">
          {warehouses.length > 1 && (
            <button type="button" className="dynamic-row-remove" onClick={() => removeRow('warehouseAddresses', i)}>&times;</button>
          )}
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginBottom: 8 }}>Warehouse {i + 1}</div>
          <Field label="Warehouse Address" value={w.address} onChange={(v) => updateArray('warehouseAddresses', i, 'address', v)} />
        </div>
      ))}
      <button type="button" className="btn btn-secondary" style={{ marginTop: 4 }}
        onClick={() => addRow('warehouseAddresses', { address: '' })}>
        + Add Warehouse
      </button>

      <SectionTitle>Border / Clearing Agent</SectionTitle>
      <div className="form-grid-3">
        <Field label="Agent Name" value={agent.agentName} onChange={(v) => setAgent('agentName', v)} />
        <Field label="Agent Contact" value={agent.agentContact} onChange={(v) => setAgent('agentContact', v)} />
        <Field label="Agent Address" value={agent.agentAddress} onChange={(v) => setAgent('agentAddress', v)} />
      </div>
    </div>
  );
}

// ==================== SECTION 4: Ownership & Management ====================
export function OwnershipSection({ data, addRow, removeRow, updateArray, errors = {} }) {
  const rows = data.ownershipManagement || [];

  return (
    <div>
      <SectionTitle>Ownership & Management Details</SectionTitle>
      {errors['ownershipManagement._min'] && (
        <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{errors['ownershipManagement._min']}</p>
      )}
      {rows.map((r, i) => (
        <div key={i} className="dynamic-row">
          {rows.length > 1 && (
            <button type="button" className="dynamic-row-remove" onClick={() => removeRow('ownershipManagement', i)}>&times;</button>
          )}
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginBottom: 8 }}>Owner / Manager {i + 1}</div>
          <div className="form-grid-3">
            <Field label="Name" value={r.name} onChange={(v) => updateArray('ownershipManagement', i, 'name', v)} required error={errors[`ownershipManagement.${i}.name`] || ''} />
            <Field label="Designation" value={r.designation} onChange={(v) => updateArray('ownershipManagement', i, 'designation', v)} required error={errors[`ownershipManagement.${i}.designation`] || ''} />
            <Field label="Nationality" value={r.nationality} onChange={(v) => updateArray('ownershipManagement', i, 'nationality', v)} required error={errors[`ownershipManagement.${i}.nationality`] || ''} />
          </div>
          <div className="form-grid-3">
            <Field label="UAE ID" value={r.uaeId} onChange={(v) => updateArray('ownershipManagement', i, 'uaeId', v)} />
            <Field label="UAE / Passport No." value={r.passportNo} onChange={(v) => updateArray('ownershipManagement', i, 'passportNo', v)} />
            <Field label="Shareholding %" value={r.shareholdingPercent} onChange={(v) => updateArray('ownershipManagement', i, 'shareholdingPercent', v)} />
          </div>
          <div className="form-grid-3">
            <Field label="Contact No." value={r.contactNo} onChange={(v) => updateArray('ownershipManagement', i, 'contactNo', v)} type="tel" />
            <Field label="Email" value={r.email} onChange={(v) => updateArray('ownershipManagement', i, 'email', v)} type="email" />
            <Field label="Social Media Profile" value={r.socialMedia} onChange={(v) => updateArray('ownershipManagement', i, 'socialMedia', v)} />
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-secondary" style={{ marginTop: 4 }}
        onClick={() => addRow('ownershipManagement', { name: '', designation: '', nationality: '', uaeId: '', passportNo: '', shareholdingPercent: '', contactNo: '', email: '', socialMedia: '' })}>
        + Add Owner / Manager
      </button>
    </div>
  );
}

// ==================== SECTION 5: Banking & Financial ====================
export function BankingSection({ data, update, addRow, removeRow, updateArray, errors = {} }) {
  const br = data.bankReference || {};
  const checks = data.bankingChecks || [];
  const setBr = (field, val) => update('bankReference', field, val);
  const e = (field) => errors[`bankReference.${field}`] || '';

  return (
    <div>
      <SectionTitle>Bank Reference</SectionTitle>
      <div className="form-grid-2">
        <Field label="Principal Bank Name" value={br.bankName} onChange={(v) => setBr('bankName', v)} required error={e('bankName')} />
        <Field label="Contact Name" value={br.contactName} onChange={(v) => setBr('contactName', v)} required error={e('contactName')} />
      </div>
      <Field label="Bank Address" value={br.address} onChange={(v) => setBr('address', v)} required error={e('address')} />
      <div className="form-grid-3">
        <Field label="City" value={br.city} onChange={(v) => setBr('city', v)} />
        <Field label="Province / State" value={br.provinceState} onChange={(v) => setBr('provinceState', v)} />
        <Field label="Postal / Zip Code" value={br.postalZipCode} onChange={(v) => setBr('postalZipCode', v)} />
      </div>
      <div className="form-grid-3">
        <Field label="Email" value={br.email} onChange={(v) => setBr('email', v)} type="email" />
        <Field label="Years of Relationship" value={br.yearsRelationship} onChange={(v) => setBr('yearsRelationship', v)} />
        <Field label="Phone" value={br.phone} onChange={(v) => setBr('phone', v)} type="tel" />
      </div>

      <SectionTitle>Banking Credibility & Financial Checks</SectionTitle>
      {checks.map((c, i) => (
        <div key={i} className="dynamic-row">
          {checks.length > 1 && (
            <button type="button" className="dynamic-row-remove" onClick={() => removeRow('bankingChecks', i)}>&times;</button>
          )}
          <div className="form-grid-2">
            <Field label="Bank Name" value={c.bankName} onChange={(v) => updateArray('bankingChecks', i, 'bankName', v)} />
            <Field label="Branch" value={c.branch} onChange={(v) => updateArray('bankingChecks', i, 'branch', v)} />
          </div>
          <div className="form-grid-3">
            <Field label="Account No." value={c.accountNo} onChange={(v) => updateArray('bankingChecks', i, 'accountNo', v)} />
            <Field label="IBAN" value={c.iban} onChange={(v) => updateArray('bankingChecks', i, 'iban', v)} />
            <Field label="SWIFT" value={c.swift} onChange={(v) => updateArray('bankingChecks', i, 'swift', v)} />
          </div>
          <div className="form-grid-2">
            <Field label="Bank Contact" value={c.bankContact} onChange={(v) => updateArray('bankingChecks', i, 'bankContact', v)} />
            <Field label="Reputation / Credibility Check" value={c.reputationCheck} onChange={(v) => updateArray('bankingChecks', i, 'reputationCheck', v)} />
          </div>
          <Field label="Notes / Comments" value={c.notes} onChange={(v) => updateArray('bankingChecks', i, 'notes', v)} />
        </div>
      ))}
      <button type="button" className="btn btn-secondary" style={{ marginTop: 4 }}
        onClick={() => addRow('bankingChecks', { bankName: '', branch: '', accountNo: '', iban: '', swift: '', bankContact: '', reputationCheck: '', notes: '' })}>
        + Add Bank
      </button>
    </div>
  );
}

// ==================== SECTION 6: Trade & Supplier References ====================
export function ReferencesSection({ data, updateArray, addRow, removeRow }) {
  const suppliers = data.supplierReferences || [];
  const trades = data.tradeReferences || [];

  return (
    <div>
      <SectionTitle>Supplier References</SectionTitle>
      {suppliers.map((s, i) => (
        <div key={i} className="dynamic-row">
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginBottom: 8 }}>Supplier {i + 1}</div>
          <div className="form-grid-2">
            <Field label="Company Name" value={s.name} onChange={(v) => updateArray('supplierReferences', i, 'name', v)} />
            <Field label="Contact Name" value={s.contact} onChange={(v) => updateArray('supplierReferences', i, 'contact', v)} />
          </div>
          <Field label="Address" value={s.address} onChange={(v) => updateArray('supplierReferences', i, 'address', v)} />
          <div className="form-grid-3">
            <Field label="City" value={s.city} onChange={(v) => updateArray('supplierReferences', i, 'city', v)} />
            <Field label="Province / State" value={s.provinceState} onChange={(v) => updateArray('supplierReferences', i, 'provinceState', v)} />
            <Field label="Postal / Zip Code" value={s.postalZipCode} onChange={(v) => updateArray('supplierReferences', i, 'postalZipCode', v)} />
          </div>
          <div className="form-grid-3">
            <Field label="Country" value={s.country} onChange={(v) => updateArray('supplierReferences', i, 'country', v)} />
            <Field label="Phone" value={s.phone} onChange={(v) => updateArray('supplierReferences', i, 'phone', v)} type="tel" />
            <Field label="Highest Recent Credit" value={s.highestCredit} onChange={(v) => updateArray('supplierReferences', i, 'highestCredit', v)} />
          </div>
          <Field label="Payment Terms" value={s.paymentTerms} onChange={(v) => updateArray('supplierReferences', i, 'paymentTerms', v)} />
        </div>
      ))}

      <SectionTitle>Trade References</SectionTitle>
      {trades.map((t, i) => (
        <div key={i} className="dynamic-row">
          {trades.length > 1 && (
            <button type="button" className="dynamic-row-remove" onClick={() => removeRow('tradeReferences', i)}>&times;</button>
          )}
          <div className="form-grid-2">
            <Field label="Customer / Supplier" value={t.customerSupplier} onChange={(v) => updateArray('tradeReferences', i, 'customerSupplier', v)} />
            <Field label="Contact" value={t.contact} onChange={(v) => updateArray('tradeReferences', i, 'contact', v)} />
          </div>
          <div className="form-grid-3">
            <Field label="Phone / Email" value={t.phoneEmail} onChange={(v) => updateArray('tradeReferences', i, 'phoneEmail', v)} />
            <Field label="Type of Business" value={t.typeOfBusiness} onChange={(v) => updateArray('tradeReferences', i, 'typeOfBusiness', v)} />
            <Field label="Years of Relationship" value={t.yearsRelationship} onChange={(v) => updateArray('tradeReferences', i, 'yearsRelationship', v)} />
          </div>
          <Field label="Social / Banking Notes" value={t.notes} onChange={(v) => updateArray('tradeReferences', i, 'notes', v)} />
        </div>
      ))}
      <button type="button" className="btn btn-secondary" style={{ marginTop: 4 }}
        onClick={() => addRow('tradeReferences', { customerSupplier: '', contact: '', phoneEmail: '', typeOfBusiness: '', yearsRelationship: '', notes: '' })}>
        + Add Trade Reference
      </button>
    </div>
  );
}

// ==================== SECTION 6.5: Social Media Handles ====================
export function SocialMediaSection({ data, update }) {
  const sm = data.socialMedia || {};
  const set = (field, val) => update('socialMedia', field, val);
  return (
    <div>
      <SectionTitle>Social Media Handles</SectionTitle>
      <div className="form-grid-2">
        <Field label="Facebook" value={sm.facebook} onChange={(v) => set('facebook', v)} placeholder="https://facebook.com/..." />
        <Field label="Instagram" value={sm.instagram} onChange={(v) => set('instagram', v)} placeholder="https://instagram.com/..." />
      </div>
      <div className="form-grid-2">
        <Field label="Twitter / X" value={sm.twitter} onChange={(v) => set('twitter', v)} placeholder="https://x.com/..." />
        <Field label="LinkedIn" value={sm.linkedin} onChange={(v) => set('linkedin', v)} placeholder="https://linkedin.com/..." />
      </div>
      <Field label="Others" value={sm.others} onChange={(v) => set('others', v)} placeholder="Any other social media links..." />
    </div>
  );
}

// ==================== SECTION 6.6: Indian Buyer Information ====================
export function IndianBuyerSection({ data, update }) {
  const ib = data.indianBuyerInfo || {};
  const set = (field, val) => update('indianBuyerInfo', field, val);
  return (
    <div>
      <SectionTitle>Indian Buyer Information</SectionTitle>
      <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 12 }}>
        Required only if the buyer is based in India.
      </p>
      <div className="form-grid-3">
        <Field label="FSSAI Number" value={ib.fssaiNumber} onChange={(v) => set('fssaiNumber', v)} placeholder="14-digit FSSAI number" />
        <Field label="PAN Number" value={ib.panNumber} onChange={(v) => set('panNumber', v)} placeholder="ABCDE1234F" />
        <Field label="IEC Number" value={ib.iecNumber} onChange={(v) => set('iecNumber', v)} placeholder="Import Export Code" />
      </div>
    </div>
  );
}

// ==================== SECTION 7: Compliance & Reviews ====================
export function ComplianceSection({ data, updateArray, addRow, removeRow, update }) {
  const reg = data.regulatoryCompliance || [];
  const social = data.socialMediaReviews || [];
  const cl = data.complianceChecklist || {};
  const setCl = (field, val) => update('complianceChecklist', field, val);

  return (
    <div>
      <SectionTitle>Regulatory & Compliance Overview</SectionTitle>
      {reg.map((r, i) => (
        <div key={i} className="dynamic-row">
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginBottom: 8 }}>{r.area}</div>
          <div className="form-grid-3">
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: 'var(--gray-600)' }}>Status</label>
              <select value={r.status || ''} onChange={(e) => updateArray('regulatoryCompliance', i, 'status', e.target.value)} style={{ fontSize: 14 }}>
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="N/A">N/A</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: 'var(--gray-600)' }}>Documents Provided</label>
              <select value={r.docsProvided || ''} onChange={(e) => updateArray('regulatoryCompliance', i, 'docsProvided', e.target.value)} style={{ fontSize: 14 }}>
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <Field label="Reputation Score" value={r.reputationScore} onChange={(v) => updateArray('regulatoryCompliance', i, 'reputationScore', v)} />
          </div>
          <Field label="Notes / Remarks" value={r.remarks} onChange={(v) => updateArray('regulatoryCompliance', i, 'remarks', v)} />
        </div>
      ))}

      <SectionTitle>Social Media & Online Reviews</SectionTitle>
      {social.map((s, i) => (
        <div key={i} className="dynamic-row">
          {social.length > 1 && (
            <button type="button" className="dynamic-row-remove" onClick={() => removeRow('socialMediaReviews', i)}>&times;</button>
          )}
          <div className="form-grid-3">
            <Field label="Platform" value={s.platform} onChange={(v) => updateArray('socialMediaReviews', i, 'platform', v)} />
            <Field label="Entity / Person" value={s.entity} onChange={(v) => updateArray('socialMediaReviews', i, 'entity', v)} />
            <Field label="Rating (1-5)" value={s.rating} onChange={(v) => updateArray('socialMediaReviews', i, 'rating', v)} />
          </div>
          <div className="form-grid-2">
            <Field label="Review Summary" value={s.reviewSummary} onChange={(v) => updateArray('socialMediaReviews', i, 'reviewSummary', v)} />
            <Field label="Verified / Source" value={s.verifiedSource} onChange={(v) => updateArray('socialMediaReviews', i, 'verifiedSource', v)} />
          </div>
          <Field label="Action Required / Compliance Check" value={s.actionRequired} onChange={(v) => updateArray('socialMediaReviews', i, 'actionRequired', v)} />
        </div>
      ))}
      <button type="button" className="btn btn-secondary" style={{ marginTop: 4 }}
        onClick={() => addRow('socialMediaReviews', { platform: '', entity: '', reviewSummary: '', rating: '', verifiedSource: '', actionRequired: '' })}>
        + Add Review
      </button>

      <SectionTitle>Compliance Checklist</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Checkbox label="Negative social media / reputation check conducted" checked={cl.negSocialMediaConductCheck} onChange={(v) => setCl('negSocialMediaConductCheck', v)} />
        <Checkbox label="Banking credibility concerns checked" checked={cl.bankingCredibilityCheck} onChange={(v) => setCl('bankingCredibilityCheck', v)} />
        <Checkbox label="Regulatory approvals verified" checked={cl.regulatoryApprovalCheck} onChange={(v) => setCl('regulatoryApprovalCheck', v)} />
        <Checkbox label="Additional background check conducted" checked={cl.additionalBackgroundCheck} onChange={(v) => setCl('additionalBackgroundCheck', v)} />
        <Checkbox label="Labor, safety & operational licenses checked" checked={cl.laborSafetyLicenseCheck} onChange={(v) => setCl('laborSafetyLicenseCheck', v)} />
        <Checkbox label="Licensing and permits verified" checked={cl.licensingPermitCheck} onChange={(v) => setCl('licensingPermitCheck', v)} />
      </div>
    </div>
  );
}

// ==================== SECTION 8: Declaration & Documents ====================
export function DeclarationSection({ data, update, files, setFiles, errors = {} }) {
  const decl = data.declaration || {};
  const setDecl = (field, val) => update('declaration', field, val);
  const e = (field) => errors[`declaration.${field}`] || '';

  const DOC_TYPES = [
    'Certificate of Incorporation / Trade License',
    'Memorandum & Articles of Association',
    'Audited Financial Statements (Last 2 Years)',
    'Copy of Passports for all UBOs and Directors',
    'Proof of Address for Business (Utility Bill < 3 months)',
    'List of Authorized Signatories (Company Letterhead)',
    'Copy of Insurance Policy',
    'Organisation Chart',
    'Other',
  ];

  function addFile() {
    setFiles((f) => [...f, { file: null, docType: DOC_TYPES[0] }]);
  }
  function updateFile(index, field, value) {
    setFiles((f) => f.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }
  function removeFile(index) {
    setFiles((f) => f.filter((_, i) => i !== index));
  }

  return (
    <div>
      <SectionTitle>Declaration & Authorization</SectionTitle>
      <div style={{ background: 'var(--gray-50)', padding: 16, borderRadius: 'var(--radius)', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Checkbox label="I/We declare that all information provided is true and accurate."
            checked={decl.infoAccurate} onChange={(v) => setDecl('infoAccurate', v)} required error={e('infoAccurate')} />
          <Checkbox label="I/We authorize verification of social media, bank references, and regulatory compliance."
            checked={decl.authorizeVerification} onChange={(v) => setDecl('authorizeVerification', v)} required error={e('authorizeVerification')} />
          <Checkbox label="I/We declare that we are not involved in any money laundering activities."
            checked={decl.notMoneyLaundering} onChange={(v) => setDecl('notMoneyLaundering', v)} required error={e('notMoneyLaundering')} />
          <Checkbox label="I/We declare that we are not involved in any terrorist funding activities."
            checked={decl.notTerroristFunding} onChange={(v) => setDecl('notTerroristFunding', v)} required error={e('notTerroristFunding')} />
          <Checkbox label="I/We declare that we are not dealing with any UN/US/EU/GCC sanctioned country."
            checked={decl.notSanctionedCountry} onChange={(v) => setDecl('notSanctionedCountry', v)} required error={e('notSanctionedCountry')} />
          <Checkbox label="I/We declare that we are not related to any Political party."
            checked={decl.notPoliticalParty} onChange={(v) => setDecl('notPoliticalParty', v)} required error={e('notPoliticalParty')} />
        </div>
      </div>
      <div className="form-grid-3">
        <Field label="Signature (Full Name)" value={decl.signatureName} onChange={(v) => setDecl('signatureName', v)} required error={e('signatureName')} />
        <Field label="Position / Title" value={decl.signaturePosition} onChange={(v) => setDecl('signaturePosition', v)} required error={e('signaturePosition')} />
        <Field label="Date" value={decl.signatureDate} onChange={(v) => setDecl('signatureDate', v)} type="date" required error={e('signatureDate')} />
      </div>

      <SectionTitle>Upload Supporting Documents</SectionTitle>

      <div style={{
        background: 'var(--gray-50)', border: '1px solid var(--gray-200)',
        padding: 16, borderRadius: 'var(--radius)', marginBottom: 20,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginBottom: 8 }}>
          Required Documents Checklist
        </div>
        <ul style={{ fontSize: 13, color: 'var(--gray-600)', margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
          <li>Certificate of Incorporation / Trade License</li>
          <li>Memorandum & Articles of Association</li>
          <li>Audited Financial Statements (Last 2 Years)</li>
          <li>Copy of Passports for all UBOs and Directors</li>
          <li>Proof of Address for Business (Utility Bill less than 3 months old)</li>
          <li>List of Authorized Signatories (on Company Letterhead)</li>
          <li>Copy of Insurance Policy</li>
          <li>Organisation Chart</li>
        </ul>
      </div>

      <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>
        Accepted formats: PDF, JPEG, PNG, WebP. Max 10MB per file. Documents are optional.
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
    </div>
  );
}
