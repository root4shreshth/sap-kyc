/**
 * KYC Form Data → SAP Business Partner Field Mapping
 * Maps the normalized KYC form data to SAP B1 Service Layer Business Partner structure.
 */

// UAE country code for SAP
const COUNTRY_MAP = {
  'United Arab Emirates': 'AE',
  'UAE': 'AE',
  'India': 'IN',
  'Turkey': 'TR',
  'Tanzania': 'TZ',
  'Saudi Arabia': 'SA',
  'Oman': 'OM',
  'Bahrain': 'BH',
  'Kuwait': 'KW',
  'Qatar': 'QA',
  'United States': 'US',
  'United Kingdom': 'GB',
  'China': 'CN',
  'Pakistan': 'PK',
  'Bangladesh': 'BD',
  'Sri Lanka': 'LK',
  'Egypt': 'EG',
  'Jordan': 'JO',
  'Lebanon': 'LB',
  'Iraq': 'IQ',
  'Iran': 'IR',
};

function getCountryCode(countryName) {
  if (!countryName) return 'AE'; // Default to UAE
  // Check exact match first
  if (COUNTRY_MAP[countryName]) return COUNTRY_MAP[countryName];
  // Check partial match
  const upper = countryName.toUpperCase();
  for (const [name, code] of Object.entries(COUNTRY_MAP)) {
    if (upper.includes(name.toUpperCase()) || name.toUpperCase().includes(upper)) {
      return code;
    }
  }
  // If it looks like a 2-letter code already, return it
  if (/^[A-Z]{2}$/.test(countryName.trim())) return countryName.trim();
  return 'AE';
}

/**
 * Generate a CardCode from KYC data
 * Format: C + first 3 chars of company name (uppercase) + last 4 of KYC ID
 * e.g., "CGOL-a1b2" for customer, "VGOL-a1b2" for vendor
 */
function generateCardCode(kycId, companyName, bpType) {
  const prefix = bpType === 'customer' ? 'C' : 'V';
  const namepart = (companyName || 'UNK').replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase();
  const idPart = kycId.replace(/-/g, '').substring(0, 5).toUpperCase();
  return `${prefix}${namepart}${idPart}`;
}

/**
 * Map KYC form data to SAP Business Partner payload
 * @param {Object} formData - Full KYC form data object
 * @param {Object} kycRecord - KYC record (id, clientName, companyName, email)
 * @param {string} bpType - 'customer' or 'vendor'
 * @returns {Object} SAP Business Partner JSON payload
 */
export function mapKycToBusinessPartner(formData, kycRecord, bpType) {
  const bi = formData.businessInfo || {};
  const cd = formData.companyDetails || {};
  const mi = formData.managerInfo || {};
  const owners = formData.ownershipManagement || [];
  const banks = formData.bankingChecks || [];
  const warehouses = formData.warehouseAddresses || [];
  const sm = formData.socialMedia || {};

  const companyName = cd.companyName || bi.businessName || kycRecord.companyName || '';
  const cardCode = generateCardCode(kycRecord.id, companyName, bpType);

  const bp = {
    CardCode: cardCode,
    CardName: companyName,
    CardType: bpType === 'customer' ? 'cCustomer' : 'cSupplier',
    // Contact details
    Phone1: cd.officePhone || bi.phone || '',
    Phone2: bi.phone && cd.officePhone ? bi.phone : '',
    EmailAddress: cd.email || kycRecord.email || '',
    Website: cd.websiteSocialMedia || bi.website || '',
    // Tax & Registration
    FederalTaxID: bi.taxRegistrationNo || '',
    VatRegistrationNumber: cd.vatRegistrationNo || '',
    // Free text for trade license
    FreeText: [
      cd.tradeLicenseNo ? `Trade License: ${cd.tradeLicenseNo}` : '',
      cd.tradeLicenseExpiry ? `License Expiry: ${cd.tradeLicenseExpiry}` : '',
      cd.mqaRegistrationNo ? `MQA Reg: ${cd.mqaRegistrationNo}` : '',
      bi.natureOfBusiness ? `Nature: ${bi.natureOfBusiness}` : '',
    ].filter(Boolean).join(' | '),
    // Currency
    Currency: 'AED',
    // Country
    Country: getCountryCode(bi.country),
    // Notes
    Notes: [
      `KYC ID: ${kycRecord.id}`,
      bi.yearsInBusiness ? `Years in Business: ${bi.yearsInBusiness}` : '',
      bi.annualSales ? `Annual Sales: ${bi.annualSales}` : '',
      bi.numberOfEmployees ? `Employees: ${bi.numberOfEmployees}` : '',
      sm.linkedin ? `LinkedIn: ${sm.linkedin}` : '',
    ].filter(Boolean).join('\n'),
  };

  // ===== ADDRESSES =====
  const addresses = [];
  let addrIdx = 0;

  // Bill-to address (registered office / company address)
  const billToAddr = cd.registeredOfficeAddress || cd.companyAddress || bi.address || '';
  if (billToAddr) {
    addresses.push({
      AddressName: 'BILL_TO',
      Street: billToAddr,
      City: bi.city || '',
      ZipCode: bi.postalZipCode || '',
      Country: getCountryCode(bi.country),
      State: bi.provinceState || '',
      AddressType: 'bo_BillTo',
      BPCode: cardCode,
      RowNum: addrIdx++,
    });
  }

  // Ship-to address (company/warehouse address)
  const shipToAddr = cd.companyAddress || bi.address || '';
  if (shipToAddr) {
    addresses.push({
      AddressName: 'SHIP_TO',
      Street: shipToAddr,
      City: bi.city || '',
      ZipCode: bi.postalZipCode || '',
      Country: getCountryCode(bi.country),
      State: bi.provinceState || '',
      AddressType: 'bo_ShipTo',
      BPCode: cardCode,
      RowNum: addrIdx++,
    });
  }

  // Warehouse addresses as additional ship-to
  warehouses.forEach((wh, i) => {
    if (wh.address) {
      addresses.push({
        AddressName: `WAREHOUSE_${i + 1}`,
        Street: wh.address,
        Country: getCountryCode(bi.country),
        AddressType: 'bo_ShipTo',
        BPCode: cardCode,
        RowNum: addrIdx++,
      });
    }
  });

  if (addresses.length > 0) {
    bp.BPAddresses = addresses;
  }

  // ===== CONTACT EMPLOYEES =====
  const contacts = [];
  let contactIdx = 0;

  // Owners/Directors as contacts
  owners.forEach((o) => {
    if (o.name) {
      const nameParts = o.name.trim().split(/\s+/);
      contacts.push({
        Name: o.name.substring(0, 50),
        FirstName: nameParts[0] || '',
        LastName: nameParts.slice(1).join(' ') || nameParts[0] || '',
        Title: o.designation || '',
        Phone1: o.contactNo || '',
        E_Mail: o.email || '',
        Remarks1: [
          o.nationality ? `Nationality: ${o.nationality}` : '',
          o.shareholdingPercent ? `Shareholding: ${o.shareholdingPercent}%` : '',
        ].filter(Boolean).join(', '),
        InternalCode: contactIdx++,
      });
    }
  });

  // Manager as contact
  if (mi.managerName) {
    const mParts = mi.managerName.trim().split(/\s+/);
    contacts.push({
      Name: mi.managerName.substring(0, 50),
      FirstName: mParts[0] || '',
      LastName: mParts.slice(1).join(' ') || mParts[0] || '',
      Title: 'Manager',
      Phone1: mi.managerPhone || mi.managerMobile || '',
      E_Mail: mi.managerEmail || '',
      InternalCode: contactIdx++,
    });
  }

  // AP Contact
  if (mi.apContactName) {
    const aParts = mi.apContactName.trim().split(/\s+/);
    contacts.push({
      Name: mi.apContactName.substring(0, 50),
      FirstName: aParts[0] || '',
      LastName: aParts.slice(1).join(' ') || aParts[0] || '',
      Title: 'AP Contact',
      Phone1: mi.apContactPhone || mi.apContactMobile || '',
      E_Mail: mi.apContactEmail || '',
      InternalCode: contactIdx++,
    });
  }

  if (contacts.length > 0) {
    bp.ContactEmployees = contacts;
  }

  // ===== BANK ACCOUNTS =====
  const bankAccounts = [];

  banks.forEach((b, i) => {
    if (b.bankName || b.accountNo || b.iban) {
      bankAccounts.push({
        BankCode: (b.bankName || '').substring(0, 30).replace(/[^A-Za-z0-9 ]/g, ''),
        AccountNo: b.accountNo || '',
        IBAN: b.iban || '',
        BICSwiftCode: b.swift || '',
        Branch: b.branch || '',
        AccountName: companyName,
        CorrespondentAccount: '',
        Country: getCountryCode(bi.country),
      });
    }
  });

  if (bankAccounts.length > 0) {
    bp.BPBankAccounts = bankAccounts;
  }

  return bp;
}

/**
 * Validate that form data has minimum required fields for SAP push
 */
export function validateForSapPush(formData) {
  const errors = [];
  const bi = formData.businessInfo || {};
  const cd = formData.companyDetails || {};

  if (!cd.companyName && !bi.businessName) {
    errors.push('Company/Business name is required');
  }
  if (!cd.email && !bi.phone) {
    errors.push('At least email or phone is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
