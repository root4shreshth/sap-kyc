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

  // SAP B1 field length limits — truncate to prevent "Value too long" errors
  const t = (val, max) => val ? String(val).substring(0, max) : '';

  const bp = {
    CardCode: t(cardCode, 15),
    CardName: t(companyName, 100),
    CardType: bpType === 'customer' ? 'cCustomer' : 'cSupplier',
    // Contact details (SAP limits: Phone=20, Email=100, Website=100)
    Phone1: t(cd.officePhone || bi.phone, 20),
    Phone2: t(bi.phone && cd.officePhone ? bi.phone : '', 20),
    EmailAddress: t(cd.email || kycRecord.email, 100),
    Website: t(cd.websiteSocialMedia || bi.website, 100),
    // Tax & Registration (SAP limits: FederalTaxID=32, VatReg=32)
    FederalTaxID: t(bi.taxRegistrationNo, 32),
    VatRegistrationNumber: t(cd.vatRegistrationNo, 32),
    // Free text for trade license (SAP limit: 254)
    FreeText: t([
      cd.tradeLicenseNo ? `Trade License: ${cd.tradeLicenseNo}` : '',
      cd.tradeLicenseExpiry ? `License Expiry: ${cd.tradeLicenseExpiry}` : '',
      cd.mqaRegistrationNo ? `MQA Reg: ${cd.mqaRegistrationNo}` : '',
      bi.natureOfBusiness ? `Nature: ${bi.natureOfBusiness}` : '',
    ].filter(Boolean).join(' | '), 254),
    // Currency — omitted to use SAP default (avoids error if AED not configured)
    // Country (SAP limit: 3 char code)
    Country: t(getCountryCode(bi.country), 3),
    // Notes (SAP limit: 254)
    Notes: t([
      `KYC ID: ${kycRecord.id}`,
      bi.yearsInBusiness ? `Years in Business: ${bi.yearsInBusiness}` : '',
      bi.annualSales ? `Annual Sales: ${bi.annualSales}` : '',
      bi.numberOfEmployees ? `Employees: ${bi.numberOfEmployees}` : '',
      sm.linkedin ? `LinkedIn: ${sm.linkedin}` : '',
    ].filter(Boolean).join('\n'), 254),
  };

  // ===== ADDRESSES =====
  const addresses = [];
  let addrIdx = 0;

  // SAP Address field limits: AddressName=50, Street=100, City=100, ZipCode=20, State=3, Block=100
  const stateCode = t(bi.provinceState, 3); // SAP State is a 3-char code

  // Bill-to address (registered office / company address)
  const billToAddr = cd.registeredOfficeAddress || cd.companyAddress || bi.address || '';
  if (billToAddr) {
    addresses.push({
      AddressName: t('BILL_TO', 50),
      Street: t(billToAddr, 100),
      Block: t(billToAddr.length > 100 ? billToAddr.substring(100) : '', 100),
      City: t(bi.city, 100),
      ZipCode: t(bi.postalZipCode, 20),
      Country: t(getCountryCode(bi.country), 3),
      State: stateCode,
      AddressType: 'bo_BillTo',
      BPCode: cardCode,
      RowNum: addrIdx++,
    });
  }

  // Ship-to address (company/warehouse address)
  const shipToAddr = cd.companyAddress || bi.address || '';
  if (shipToAddr) {
    addresses.push({
      AddressName: t('SHIP_TO', 50),
      Street: t(shipToAddr, 100),
      Block: t(shipToAddr.length > 100 ? shipToAddr.substring(100) : '', 100),
      City: t(bi.city, 100),
      ZipCode: t(bi.postalZipCode, 20),
      Country: t(getCountryCode(bi.country), 3),
      State: stateCode,
      AddressType: 'bo_ShipTo',
      BPCode: cardCode,
      RowNum: addrIdx++,
    });
  }

  // Warehouse addresses as additional ship-to
  warehouses.forEach((wh, i) => {
    if (wh.address) {
      addresses.push({
        AddressName: t(`WAREHOUSE_${i + 1}`, 50),
        Street: t(wh.address, 100),
        Block: t(wh.address.length > 100 ? wh.address.substring(100) : '', 100),
        Country: t(getCountryCode(bi.country), 3),
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

  // SAP Contact limits: Name=50, FirstName=80, LastName=80, Title=10, Phone=20, E_Mail=100, Remarks=254
  owners.forEach((o) => {
    if (o.name) {
      const nameParts = o.name.trim().split(/\s+/);
      contacts.push({
        Name: t(o.name, 50),
        FirstName: t(nameParts[0], 80),
        LastName: t(nameParts.slice(1).join(' ') || nameParts[0], 80),
        Title: t(o.designation, 10),
        Phone1: t(o.contactNo, 20),
        E_Mail: t(o.email, 100),
        Remarks1: t([
          o.nationality ? `Nationality: ${o.nationality}` : '',
          o.shareholdingPercent ? `Shareholding: ${o.shareholdingPercent}%` : '',
        ].filter(Boolean).join(', '), 254),
        InternalCode: contactIdx++,
      });
    }
  });

  // Manager as contact
  if (mi.managerName) {
    const mParts = mi.managerName.trim().split(/\s+/);
    contacts.push({
      Name: t(mi.managerName, 50),
      FirstName: t(mParts[0], 80),
      LastName: t(mParts.slice(1).join(' ') || mParts[0], 80),
      Title: t('Manager', 10),
      Phone1: t(mi.managerPhone || mi.managerMobile, 20),
      E_Mail: t(mi.managerEmail, 100),
      InternalCode: contactIdx++,
    });
  }

  // AP Contact
  if (mi.apContactName) {
    const aParts = mi.apContactName.trim().split(/\s+/);
    contacts.push({
      Name: t(mi.apContactName, 50),
      FirstName: t(aParts[0], 80),
      LastName: t(aParts.slice(1).join(' ') || aParts[0], 80),
      Title: t('AP Contact', 10),
      Phone1: t(mi.apContactPhone || mi.apContactMobile, 20),
      E_Mail: t(mi.apContactEmail, 100),
      InternalCode: contactIdx++,
    });
  }

  if (contacts.length > 0) {
    bp.ContactEmployees = contacts;
  }

  // ===== BANK ACCOUNTS =====
  const bankAccounts = [];

  // SAP Bank limits: BankCode=30, AccountNo=50, IBAN=50, BICSwiftCode=20, Branch=50, AccountName=100
  banks.forEach((b, i) => {
    if (b.bankName || b.accountNo || b.iban) {
      bankAccounts.push({
        BankCode: t((b.bankName || '').replace(/[^A-Za-z0-9 ]/g, ''), 30),
        AccountNo: t(b.accountNo, 50),
        IBAN: t(b.iban, 50),
        BICSwiftCode: t(b.swift, 20),
        Branch: t(b.branch, 50),
        AccountName: t(companyName, 100),
        Country: t(getCountryCode(bi.country), 3),
      });
    }
  });

  if (bankAccounts.length > 0) {
    bp.BPBankAccounts = bankAccounts;
  }

  // Clean the payload — remove all empty string, null, undefined values
  // SAP B1 often drops connection when it receives empty strings for optional fields
  return cleanSapPayload(bp);
}

/**
 * Recursively remove empty/null/undefined values from SAP payload.
 * SAP Service Layer prefers missing fields over empty strings.
 */
function cleanSapPayload(obj) {
  if (Array.isArray(obj)) {
    return obj.map(cleanSapPayload).filter(item => item !== null && item !== undefined);
  }
  if (obj && typeof obj === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined || value === '') continue;
      const cleanedValue = cleanSapPayload(value);
      if (cleanedValue === null || cleanedValue === undefined || cleanedValue === '') continue;
      if (Array.isArray(cleanedValue) && cleanedValue.length === 0) continue;
      cleaned[key] = cleanedValue;
    }
    return Object.keys(cleaned).length > 0 ? cleaned : null;
  }
  return obj;
}

/**
 * Generate a minimal BP payload for testing SAP connection.
 * Only includes the absolute minimum fields required to create a BP.
 */
export function mapKycToMinimalBusinessPartner(formData, kycRecord, bpType) {
  const bi = formData.businessInfo || {};
  const cd = formData.companyDetails || {};
  const companyName = cd.companyName || bi.businessName || kycRecord.companyName || '';
  const cardCode = generateCardCode(kycRecord.id, companyName, bpType);

  return {
    CardCode: cardCode,
    CardName: companyName.substring(0, 100),
    CardType: bpType === 'customer' ? 'cCustomer' : 'cSupplier',
    Phone1: cd.officePhone || bi.phone || undefined,
    EmailAddress: cd.email || kycRecord.email || undefined,
  };
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
