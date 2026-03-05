/**
 * KYC Form Data → SAP Business Partner Field Mapping
 * Maps the normalized KYC form data to SAP B1 Service Layer Business Partner structure.
 *
 * IMPORTANT: All string fields are aggressively truncated to SAP's strictest known limits.
 * SAP B1 drops the connection or returns 502 if ANY field exceeds its column limit.
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
  if (!countryName) return 'AE';
  if (COUNTRY_MAP[countryName]) return COUNTRY_MAP[countryName];
  const upper = countryName.toUpperCase();
  for (const [name, code] of Object.entries(COUNTRY_MAP)) {
    if (upper.includes(name.toUpperCase()) || name.toUpperCase().includes(upper)) {
      return code;
    }
  }
  if (/^[A-Z]{2}$/.test(countryName.trim())) return countryName.trim();
  return 'AE';
}

/**
 * SAP B1 Field Length Limits — STRICTEST known values.
 * These are intentionally conservative to work on ALL SAP B1 instances.
 */
const SAP_LIMITS = {
  // Business Partner (OCRD)
  CardCode: 15,
  CardName: 100,
  Phone: 20,
  Fax: 20,
  Email: 100,
  Website: 100,
  FederalTaxID: 32,
  VatReg: 32,
  FreeText: 200,      // Some instances limit to ~200
  Notes: 50,           // VERY strict on some instances
  Country: 3,
  // Addresses (CRD1)
  AddrName: 50,
  Street: 100,
  Block: 100,
  City: 100,
  ZipCode: 20,
  State: 3,
  County: 100,
  // Contacts (OCPR)
  ContactName: 50,
  FirstName: 40,       // Conservative
  LastName: 40,        // Conservative
  Title: 10,
  Remarks: 100,        // Conservative
  // Bank (OCRB)
  BankCode: 30,
  AccountNo: 50,
  IBAN: 50,
  SWIFT: 20,
  Branch: 50,
  AccountName: 50,     // Conservative
};

/**
 * Truncate a value to max length. Returns '' for null/undefined.
 */
function t(val, max) {
  if (val === null || val === undefined) return '';
  return String(val).substring(0, max);
}

function generateCardCode(kycId, companyName, bpType) {
  const prefix = bpType === 'customer' ? 'C' : 'V';
  const namepart = (companyName || 'UNK').replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase();
  const idPart = kycId.replace(/-/g, '').substring(0, 5).toUpperCase();
  return `${prefix}${namepart}${idPart}`;
}

/**
 * Map KYC form data to SAP Business Partner payload.
 * Every single string field is truncated to SAP's strict limits.
 */
export function mapKycToBusinessPartner(formData, kycRecord, bpType) {
  const bi = formData.businessInfo || {};
  const cd = formData.companyDetails || {};
  const mi = formData.managerInfo || {};
  const owners = formData.ownershipManagement || [];
  const banks = formData.bankingChecks || [];
  const warehouses = formData.warehouseAddresses || [];

  const companyName = cd.companyName || bi.businessName || kycRecord.companyName || '';
  const cardCode = generateCardCode(kycRecord.id, companyName, bpType);
  const L = SAP_LIMITS;

  const bp = {
    CardCode: t(cardCode, L.CardCode),
    CardName: t(companyName, L.CardName),
    CardType: bpType === 'customer' ? 'cCustomer' : 'cSupplier',
    Phone1: t(cd.officePhone || bi.phone, L.Phone),
    Phone2: t(bi.phone && cd.officePhone ? bi.phone : '', L.Phone),
    EmailAddress: t(cd.email || kycRecord.email, L.Email),
    Website: t(cd.websiteSocialMedia || bi.website, L.Website),
    FederalTaxID: t(bi.taxRegistrationNo, L.FederalTaxID),
    VatRegistrationNumber: t(cd.vatRegistrationNo, L.VatReg),
    FreeText: t([
      cd.tradeLicenseNo ? `TL:${cd.tradeLicenseNo}` : '',
      cd.tradeLicenseExpiry ? `Exp:${cd.tradeLicenseExpiry}` : '',
      bi.natureOfBusiness ? `Biz:${bi.natureOfBusiness}` : '',
    ].filter(Boolean).join('|'), L.FreeText),
    Country: t(getCountryCode(bi.country), L.Country),
    // Notes — keep VERY short, just KYC reference
    Notes: t(`KYC:${kycRecord.id.substring(0, 36)}`, L.Notes),
  };

  // ===== ADDRESSES =====
  const addresses = [];
  let addrIdx = 0;
  const countryCode = t(getCountryCode(bi.country), L.Country);
  const stateCode = t(bi.provinceState, L.State);

  const billToAddr = cd.registeredOfficeAddress || cd.companyAddress || bi.address || '';
  if (billToAddr) {
    addresses.push({
      AddressName: t('BILL_TO', L.AddrName),
      Street: t(billToAddr, L.Street),
      Block: t(bi.city || '', L.Block),
      City: t(bi.city, L.City),
      ZipCode: t(bi.postalZipCode, L.ZipCode),
      Country: countryCode,
      State: stateCode,
      AddressType: 'bo_BillTo',
      BPCode: t(cardCode, L.CardCode),
      RowNum: addrIdx++,
    });
  }

  const shipToAddr = cd.companyAddress || bi.address || '';
  if (shipToAddr) {
    addresses.push({
      AddressName: t('SHIP_TO', L.AddrName),
      Street: t(shipToAddr, L.Street),
      Block: t(bi.city || '', L.Block),
      City: t(bi.city, L.City),
      ZipCode: t(bi.postalZipCode, L.ZipCode),
      Country: countryCode,
      State: stateCode,
      AddressType: 'bo_ShipTo',
      BPCode: t(cardCode, L.CardCode),
      RowNum: addrIdx++,
    });
  }

  warehouses.forEach((wh, i) => {
    if (wh.address) {
      addresses.push({
        AddressName: t(`WH_${i + 1}`, L.AddrName),
        Street: t(wh.address, L.Street),
        Country: countryCode,
        AddressType: 'bo_ShipTo',
        BPCode: t(cardCode, L.CardCode),
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

  owners.forEach((o) => {
    if (o.name) {
      const nameParts = o.name.trim().split(/\s+/);
      contacts.push({
        Name: t(o.name, L.ContactName),
        FirstName: t(nameParts[0], L.FirstName),
        LastName: t(nameParts.slice(1).join(' ') || nameParts[0], L.LastName),
        Title: t(o.designation, L.Title),
        Phone1: t(o.contactNo, L.Phone),
        E_Mail: t(o.email, L.Email),
        Remarks1: t(o.nationality ? `${o.nationality} ${o.shareholdingPercent || ''}%` : '', L.Remarks),
        InternalCode: contactIdx++,
      });
    }
  });

  if (mi.managerName) {
    const mParts = mi.managerName.trim().split(/\s+/);
    contacts.push({
      Name: t(mi.managerName, L.ContactName),
      FirstName: t(mParts[0], L.FirstName),
      LastName: t(mParts.slice(1).join(' ') || mParts[0], L.LastName),
      Title: t('Manager', L.Title),
      Phone1: t(mi.managerPhone || mi.managerMobile, L.Phone),
      E_Mail: t(mi.managerEmail, L.Email),
      InternalCode: contactIdx++,
    });
  }

  if (mi.apContactName) {
    const aParts = mi.apContactName.trim().split(/\s+/);
    contacts.push({
      Name: t(mi.apContactName, L.ContactName),
      FirstName: t(aParts[0], L.FirstName),
      LastName: t(aParts.slice(1).join(' ') || aParts[0], L.LastName),
      Title: t('AP', L.Title),
      Phone1: t(mi.apContactPhone || mi.apContactMobile, L.Phone),
      E_Mail: t(mi.apContactEmail, L.Email),
      InternalCode: contactIdx++,
    });
  }

  if (contacts.length > 0) {
    bp.ContactEmployees = contacts;
  }

  // ===== BANK ACCOUNTS =====
  const bankAccounts = [];

  banks.forEach((b) => {
    if (b.bankName || b.accountNo || b.iban) {
      bankAccounts.push({
        BankCode: t((b.bankName || '').replace(/[^A-Za-z0-9 ]/g, ''), L.BankCode),
        AccountNo: t(b.accountNo, L.AccountNo),
        IBAN: t(b.iban, L.IBAN),
        BICSwiftCode: t(b.swift, L.SWIFT),
        Branch: t(b.branch, L.Branch),
        AccountName: t(companyName, L.AccountName),
        Country: countryCode,
      });
    }
  });

  if (bankAccounts.length > 0) {
    bp.BPBankAccounts = bankAccounts;
  }

  return cleanSapPayload(bp);
}

/**
 * Recursively remove empty/null/undefined values from SAP payload.
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
 */
export function mapKycToMinimalBusinessPartner(formData, kycRecord, bpType) {
  const bi = formData.businessInfo || {};
  const cd = formData.companyDetails || {};
  const companyName = cd.companyName || bi.businessName || kycRecord.companyName || '';
  const cardCode = generateCardCode(kycRecord.id, companyName, bpType);

  return {
    CardCode: t(cardCode, SAP_LIMITS.CardCode),
    CardName: t(companyName, SAP_LIMITS.CardName),
    CardType: bpType === 'customer' ? 'cCustomer' : 'cSupplier',
    Phone1: t(cd.officePhone || bi.phone, SAP_LIMITS.Phone) || undefined,
    EmailAddress: t(cd.email || kycRecord.email, SAP_LIMITS.Email) || undefined,
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
