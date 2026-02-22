'use client';
import { useState } from 'react';

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="collapsible-header" onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div style={{ padding: '12px 0' }}>{children}</div>}
    </div>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 14, marginBottom: 6 }}>
      <span style={{ color: 'var(--gray-500)', minWidth: 180, flexShrink: 0 }}>{label}:</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function BoolRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 14, marginBottom: 4 }}>
      <span style={{ color: value ? 'var(--green)' : 'var(--gray-400)' }}>{value ? '[X]' : '[ ]'}</span>
      <span>{label}</span>
    </div>
  );
}

function ArrayTable({ headers, rows, renderRow }) {
  if (!rows || rows.length === 0) return <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>No entries.</p>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>{headers.map((h, i) => <th key={i} style={{ fontSize: 12 }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => <tr key={i}>{renderRow(row)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

export default function FormDataView({ data }) {
  if (!data || Object.keys(data).length === 0) return null;

  const bi = data.businessInfo || {};
  const bt = bi.businessType || {};
  const props = data.proprietors || [];
  const mgr = data.managerInfo || {};
  const cd = data.companyDetails || {};
  const ba = cd.borderAgent || {};
  const wh = data.warehouseAddresses || [];
  const om = data.ownershipManagement || [];
  const br = data.bankReference || {};
  const bc = data.bankingChecks || [];
  const sr = data.supplierReferences || [];
  const tr = data.tradeReferences || [];
  const sm = data.socialMedia || {};
  const ib = data.indianBuyerInfo || {};
  const decl = data.declaration || {};

  return (
    <div>
      <Section title="1. Business Information" defaultOpen={true}>
        <Row label="Business Name" value={bi.businessName} />
        <Row label="Tax Registration No." value={bi.taxRegistrationNo} />
        <Row label="Address" value={bi.address} />
        <Row label="City" value={bi.city} />
        <Row label="Province / State" value={bi.provinceState} />
        <Row label="Postal / Zip Code" value={bi.postalZipCode} />
        <Row label="Country" value={bi.country} />
        <Row label="Phone" value={bi.phone} />
        <Row label="Website" value={bi.website} />
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>Type of Business:</span>
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            {bt.corporation && <span className="badge badge-submitted">Corporation</span>}
            {bt.incorporated && <span className="badge badge-submitted">Incorporated</span>}
            {bt.partnership && <span className="badge badge-submitted">Partnership</span>}
            {bt.soleProprietorship && <span className="badge badge-submitted">Sole Proprietorship</span>}
          </div>
        </div>
        <Row label="Date of Incorporation" value={bi.dateOfIncorporation} />
        <Row label="Years in Business" value={bi.yearsInBusiness} />
        <Row label="Nature of Business" value={bi.natureOfBusiness} />
        <Row label="Monthly Credit Required" value={bi.monthlyCreditRequired} />
        <Row label="Annual Sales" value={bi.annualSales} />
        <Row label="Number of Employees" value={bi.numberOfEmployees} />
      </Section>

      <Section title="2. Proprietors & Management">
        {props.map((p, i) => (
          <div key={i} style={{ marginBottom: 12, padding: 12, background: 'var(--gray-50)', borderRadius: 'var(--radius)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginBottom: 6 }}>Proprietor {i + 1}</div>
            <Row label="Name" value={p.name} />
            <Row label="Title" value={p.title} />
            <Row label="Address" value={p.address} />
            <Row label="Email" value={p.email} />
            <Row label="Phone" value={p.phone} />
            <Row label="Mobile" value={p.mobile} />
          </div>
        ))}
        <Row label="Manager Name" value={mgr.managerName} />
        <Row label="Manager Email" value={mgr.managerEmail} />
        <Row label="Manager Phone" value={mgr.managerPhone} />
        <Row label="AP Contact" value={mgr.apContactName} />
        <Row label="AP Email" value={mgr.apContactEmail} />
      </Section>

      <Section title="3. Company Details (UAE)">
        <Row label="Company Name" value={cd.companyName} />
        <Row label="Trade License No." value={cd.tradeLicenseNo} />
        <Row label="Trade License Expiry" value={cd.tradeLicenseExpiry} />
        <Row label="MQA / Registration No." value={cd.mqaRegistrationNo} />
        <Row label="VAT Registration No." value={cd.vatRegistrationNo} />
        <Row label="Company Address" value={cd.companyAddress} />
        <Row label="Registered Office" value={cd.registeredOfficeAddress} />
        <Row label="Office Phone" value={cd.officePhone} />
        <Row label="Email" value={cd.email} />
        <Row label="Website / Social Media" value={cd.websiteSocialMedia} />

        {wh.length > 0 && wh.some(w => w.address) && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginBottom: 6 }}>Warehouse Addresses</div>
            {wh.filter(w => w.address).map((w, i) => (
              <Row key={i} label={`Warehouse ${i + 1}`} value={w.address} />
            ))}
          </div>
        )}

        {(ba.agentName || ba.agentContact || ba.agentAddress) && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginBottom: 6 }}>Border / Clearing Agent</div>
            <Row label="Agent Name" value={ba.agentName} />
            <Row label="Agent Contact" value={ba.agentContact} />
            <Row label="Agent Address" value={ba.agentAddress} />
          </div>
        )}
      </Section>

      <Section title="4. Ownership & Management Details">
        <ArrayTable
          headers={['Name', 'Designation', 'Nationality', 'UAE ID', 'Passport', 'Shareholding %', 'Contact', 'Email']}
          rows={om}
          renderRow={(r) => <>
            <td>{r.name}</td><td>{r.designation}</td><td>{r.nationality}</td><td>{r.uaeId}</td>
            <td>{r.passportNo}</td><td>{r.shareholdingPercent}</td><td>{r.contactNo}</td><td>{r.email}</td>
          </>}
        />
      </Section>

      <Section title="5. Banking & Financial">
        <Row label="Principal Bank" value={br.bankName} />
        <Row label="Bank Address" value={br.address} />
        <Row label="City" value={br.city} />
        <Row label="Contact" value={br.contactName} />
        <Row label="Email" value={br.email} />
        <Row label="Years Relationship" value={br.yearsRelationship} />
        <Row label="Phone" value={br.phone} />
        {bc.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginTop: 12, marginBottom: 8 }}>Financial Checks</div>
            <ArrayTable
              headers={['Bank', 'Branch', 'Account', 'IBAN', 'SWIFT', 'Contact', 'Reputation']}
              rows={bc}
              renderRow={(r) => <>
                <td>{r.bankName}</td><td>{r.branch}</td><td>{r.accountNo}</td><td>{r.iban}</td>
                <td>{r.swift}</td><td>{r.bankContact}</td><td>{r.reputationCheck}</td>
              </>}
            />
          </>
        )}
      </Section>

      <Section title="6. Trade & Supplier References">
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginBottom: 8 }}>Supplier References</div>
        <ArrayTable
          headers={['Name', 'Contact', 'City', 'Country', 'Phone', 'Highest Credit', 'Terms']}
          rows={sr}
          renderRow={(r) => <>
            <td>{r.name}</td><td>{r.contact}</td><td>{r.city}</td><td>{r.country}</td>
            <td>{r.phone}</td><td>{r.highestCredit}</td><td>{r.paymentTerms}</td>
          </>}
        />
        {tr.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginTop: 12, marginBottom: 8 }}>Trade References</div>
            <ArrayTable
              headers={['Customer/Supplier', 'Contact', 'Phone/Email', 'Business Type', 'Years', 'Notes']}
              rows={tr}
              renderRow={(r) => <>
                <td>{r.customerSupplier}</td><td>{r.contact}</td><td>{r.phoneEmail}</td>
                <td>{r.typeOfBusiness}</td><td>{r.yearsRelationship}</td><td>{r.notes}</td>
              </>}
            />
          </>
        )}
      </Section>

      <Section title="7. Social Media Handles">
        <Row label="Facebook" value={sm.facebook} />
        <Row label="Instagram" value={sm.instagram} />
        <Row label="Twitter / X" value={sm.twitter} />
        <Row label="LinkedIn" value={sm.linkedin} />
        <Row label="Others" value={sm.others} />
      </Section>

      {(ib.fssaiNumber || ib.panNumber || ib.iecNumber) && (
        <Section title="8. Indian Buyer Information">
          <Row label="FSSAI Number" value={ib.fssaiNumber} />
          <Row label="PAN Number" value={ib.panNumber} />
          <Row label="IEC Number" value={ib.iecNumber} />
        </Section>
      )}

      <Section title="9. Declaration & Authorization">
        <BoolRow label="All information provided is true and accurate" value={decl.infoAccurate} />
        <BoolRow label="Authorize verification of social media, bank references, and compliance" value={decl.authorizeVerification} />
        <BoolRow label="Not involved in any money laundering activities" value={decl.notMoneyLaundering} />
        <BoolRow label="Not involved in any terrorist funding activities" value={decl.notTerroristFunding} />
        <BoolRow label="Not dealing with any UN/US/EU/GCC sanctioned country" value={decl.notSanctionedCountry} />
        <BoolRow label="Not related to any political party" value={decl.notPoliticalParty} />
        <Row label="Signature (Name)" value={decl.signatureName} />
        <Row label="Position / Title" value={decl.signaturePosition} />
        <Row label="Date" value={decl.signatureDate} />
      </Section>
    </div>
  );
}
