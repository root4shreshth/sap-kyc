import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getKycById, getKycFormData } from '@/lib/db';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const NAVY = [15, 23, 42];
const BLUE = [37, 99, 235];
const GRAY = [100, 116, 139];

export async function GET(request, { params }) {
  const { error } = requireAuth(request, ['Admin', 'KYC Team']);
  if (error) return error;

  try {
    const { id } = await params;
    const kyc = await getKycById(id);
    if (!kyc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const formData = await getKycFormData(id);
    if (!formData || Object.keys(formData).length === 0) {
      return NextResponse.json({ error: 'No form data to export' }, { status: 400 });
    }

    const doc = new jsPDF();
    let y = 15;

    // Header
    doc.setFontSize(18);
    doc.setTextColor(...NAVY);
    doc.text('ALAMIR INTERNATIONAL TRADING L.L.C', 105, y, { align: 'center' });
    y += 8;
    doc.setFontSize(12);
    doc.setTextColor(...BLUE);
    doc.text('KYC / KYS Application Form', 105, y, { align: 'center' });
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(`Generated: ${new Date().toLocaleDateString()} | Client: ${kyc.clientName} | Company: ${kyc.companyName}`, 105, y, { align: 'center' });
    y += 4;
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.5);
    doc.line(15, y, 195, y);
    y += 8;

    // Helper functions
    function sectionHeader(title) {
      if (y > 270) { doc.addPage(); y = 15; }
      doc.setFontSize(12);
      doc.setTextColor(...NAVY);
      doc.text(title, 15, y);
      y += 2;
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(15, y, 195, y);
      y += 6;
    }

    function addRow(label, value) {
      if (!value) return;
      if (y > 280) { doc.addPage(); y = 15; }
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      doc.text(label + ':', 15, y);
      doc.setTextColor(...NAVY);
      doc.text(String(value), 70, y);
      y += 5;
    }

    function addTable(headers, rows) {
      if (y > 250) { doc.addPage(); y = 15; }
      doc.autoTable({
        startY: y,
        head: [headers],
        body: rows,
        margin: { left: 15, right: 15 },
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 7 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // ===== SECTION 1: Business Information =====
    const bi = formData.businessInfo || {};
    sectionHeader('1. Business Information');
    addRow('Business Name', bi.businessName);
    addRow('Tax Registration No.', bi.taxRegistrationNo);
    addRow('Address', bi.address);
    addRow('City', bi.city);
    addRow('Province / State', bi.provinceState);
    addRow('Postal / Zip Code', bi.postalZipCode);
    addRow('Country', bi.country);
    addRow('Phone', bi.phone);
    addRow('Website', bi.website);

    const bt = bi.businessType || {};
    const types = [];
    if (bt.corporation) types.push('Corporation');
    if (bt.incorporated) types.push('Incorporated');
    if (bt.partnership) types.push('Partnership');
    if (bt.soleProprietorship) types.push('Sole Proprietorship');
    if (types.length) addRow('Business Type', types.join(', '));

    addRow('Date of Incorporation', bi.dateOfIncorporation);
    addRow('Years in Business', bi.yearsInBusiness);
    addRow('Nature of Business', bi.natureOfBusiness);
    addRow('Monthly Credit Required', bi.monthlyCreditRequired);
    addRow('Annual Sales', bi.annualSales);
    addRow('Number of Employees', bi.numberOfEmployees);

    // ===== SECTION 2: Proprietors =====
    sectionHeader('2. Proprietors & Management');
    const props = formData.proprietors || [];
    props.forEach((p, i) => {
      if (p.name) {
        addRow(`Proprietor ${i + 1}`, `${p.name} (${p.title || 'N/A'})`);
        addRow('  Address', p.address);
        addRow('  Email / Phone', `${p.email || ''} / ${p.phone || ''}`);
      }
    });
    const mgr = formData.managerInfo || {};
    addRow('Manager', mgr.managerName);
    addRow('Manager Email', mgr.managerEmail);
    addRow('AP Contact', mgr.apContactName);

    // ===== SECTION 3: Company Details =====
    const cd = formData.companyDetails || {};
    sectionHeader('3. Company Details (UAE)');
    addRow('Company Name', cd.companyName);
    addRow('Trade License No.', cd.tradeLicenseNo);
    addRow('License Expiry', cd.tradeLicenseExpiry);
    addRow('MQA Reg No.', cd.mqaRegistrationNo);
    addRow('VAT Reg No.', cd.vatRegistrationNo);
    addRow('Address', cd.companyAddress);
    addRow('Phone', cd.officePhone);
    addRow('Email', cd.email);
    addRow('Website / Social Media', cd.websiteSocialMedia);

    // ===== SECTION 4: Ownership =====
    const om = formData.ownershipManagement || [];
    if (om.length > 0 && om.some(r => r.name)) {
      sectionHeader('4. Ownership & Management Details');
      addTable(
        ['Name', 'Designation', 'Nationality', 'UAE ID', 'Passport', 'Share %', 'Contact', 'Email'],
        om.filter(r => r.name).map(r => [r.name, r.designation, r.nationality, r.uaeId, r.passportNo, r.shareholdingPercent, r.contactNo, r.email])
      );
    }

    // ===== SECTION 5: Banking =====
    const br = formData.bankReference || {};
    sectionHeader('5. Banking & Financial');
    addRow('Principal Bank', br.bankName);
    addRow('Bank Address', `${br.address || ''}, ${br.city || ''}`);
    addRow('Contact', br.contactName);
    addRow('Email', br.email);
    addRow('Years Relationship', br.yearsRelationship);

    const bc = formData.bankingChecks || [];
    if (bc.length > 0 && bc.some(r => r.bankName)) {
      addTable(
        ['Bank', 'Branch', 'Account', 'IBAN', 'SWIFT', 'Contact', 'Reputation'],
        bc.filter(r => r.bankName).map(r => [r.bankName, r.branch, r.accountNo, r.iban, r.swift, r.bankContact, r.reputationCheck])
      );
    }

    // ===== SECTION 6: References =====
    const sr = formData.supplierReferences || [];
    if (sr.some(r => r.name)) {
      sectionHeader('6. Supplier & Trade References');
      addTable(
        ['Name', 'Contact', 'City', 'Country', 'Phone', 'Highest Credit', 'Terms'],
        sr.filter(r => r.name).map(r => [r.name, r.contact, r.city, r.country, r.phone, r.highestCredit, r.paymentTerms])
      );
    }

    const tr = formData.tradeReferences || [];
    if (tr.some(r => r.customerSupplier)) {
      addTable(
        ['Customer/Supplier', 'Contact', 'Phone/Email', 'Business', 'Years', 'Notes'],
        tr.filter(r => r.customerSupplier).map(r => [r.customerSupplier, r.contact, r.phoneEmail, r.typeOfBusiness, r.yearsRelationship, r.notes])
      );
    }

    // ===== SECTION 7: Compliance =====
    const rc = formData.regulatoryCompliance || [];
    if (rc.some(r => r.status)) {
      sectionHeader('7. Regulatory & Compliance');
      addTable(
        ['Compliance Area', 'Status', 'Docs', 'Remarks', 'Score'],
        rc.filter(r => r.status).map(r => [r.area, r.status, r.docsProvided, r.remarks, r.reputationScore])
      );
    }

    const cl = formData.complianceChecklist || {};
    const checks = [
      ['Social media check', cl.negSocialMediaConductCheck],
      ['Banking credibility check', cl.bankingCredibilityCheck],
      ['Regulatory approvals', cl.regulatoryApprovalCheck],
      ['Background check', cl.additionalBackgroundCheck],
      ['Labor/safety licenses', cl.laborSafetyLicenseCheck],
      ['Licensing/permits', cl.licensingPermitCheck],
    ];
    checks.forEach(([label, val]) => {
      addRow(val ? '[X] ' + label : '[ ] ' + label, '');
    });

    // ===== SECTION 8: Declaration =====
    const decl = formData.declaration || {};
    sectionHeader('8. Declaration & Authorization');
    addRow(decl.infoAccurate ? '[X]' : '[ ]', 'All information is true and accurate');
    addRow(decl.authorizeVerification ? '[X]' : '[ ]', 'Authorize verification of references');
    addRow('Signed By', decl.signatureName);
    addRow('Position', decl.signaturePosition);
    addRow('Date', decl.signatureDate);

    // Footer on all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Alamir International Trading L.L.C — Confidential`, 15, 290);
      doc.text(`Page ${i} of ${pageCount}`, 195, 290, { align: 'right' });
    }

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    const safeName = (kyc.companyName || 'KYC').replace(/[^a-zA-Z0-9]/g, '-');

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="KYC-${safeName}-${id.slice(0, 8)}.pdf"`,
      },
    });
  } catch (err) {
    console.error('PDF export error:', err);
    return NextResponse.json({ error: `PDF export failed: ${err.message}` }, { status: 500 });
  }
}
