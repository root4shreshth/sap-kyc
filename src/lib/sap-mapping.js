/**
 * KYC Form Data → SAP Business Partner Field Mapping
 * Maps the normalized KYC form data to SAP B1 Service Layer Business Partner structure.
 *
 * IMPORTANT: All string fields are aggressively truncated to SAP's strictest known limits.
 * SAP B1 drops the connection or returns 502 if ANY field exceeds its column limit.
 *
 * SEMANTIC RULES:
 * - BankCode must reference SAP's bank master table (ODSC). We skip BPBankAccounts
 *   and store bank info in FreeText instead, since we don't know the user's bank codes.
 * - State must be a 2-3 char ISO code. We only send it if it looks like a code.
 * - ContactPerson.Title must be a salutation (Mr/Mrs/Dr), not a job title.
 * - We do NOT send fields that would be semantically wrong when truncated.
 */

// Country name → ISO 2-letter code
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
  'Germany': 'DE',
  'France': 'FR',
  'Italy': 'IT',
  'Spain': 'ES',
  'Netherlands': 'NL',
  'Singapore': 'SG',
  'Malaysia': 'MY',
  'Thailand': 'TH',
  'Philippines': 'PH',
  'Indonesia': 'ID',
  'Japan': 'JP',
  'South Korea': 'KR',
  'Australia': 'AU',
  'Canada': 'CA',
  'Brazil': 'BR',
  'South Africa': 'ZA',
  'Nigeria': 'NG',
  'Kenya': 'KE',
  'Ethiopia': 'ET',
};

function getCountryCode(countryName) {
  if (!countryName) return 'AE';
  const trimmed = countryName.trim();
  // If already a 2-letter code, return as-is
  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed;
  if (COUNTRY_MAP[trimmed]) return COUNTRY_MAP[trimmed];
  const upper = trimmed.toUpperCase();
  for (const [name, code] of Object.entries(COUNTRY_MAP)) {
    if (upper.includes(name.toUpperCase()) || name.toUpperCase().includes(upper)) {
      return code;
    }
  }
  return 'AE';
}

/**
 * Check if a state/province value looks like a proper code (2-3 chars).
 * SAP State field is max 3 chars and expects ISO state codes.
 * Sending a truncated full name like "Abu" instead of "AZ" causes data corruption.
 */
function getStateCode(stateValue) {
  if (!stateValue) return '';
  const trimmed = stateValue.trim();
  // Only return if it's already a short code (2-3 uppercase letters)
  if (/^[A-Z]{2,3}$/i.test(trimmed)) return trimmed.toUpperCase();
  // Don't send state at all if it's a full name — SAP can't use it
  return '';
}

/**
 * SAP B1 Field Length Limits — STRICTEST known values.
 * These are intentionally conservative to work on ALL SAP B1 instances.
 * Source: SAP B1 10.0 FP2008+ table definitions (OCRD, CRD1, OCPR, OCRB).
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
  BuildingFloorRoom: 100,
  // Contacts (OCPR)
  ContactName: 50,
  FirstName: 40,
  LastName: 40,
  Title: 10,
  Position: 20,        // Job title goes here, not in Title
  Remarks: 100,
};

/**
 * Truncate a value to max length. Returns '' for null/undefined.
 */
function t(val, max) {
  if (val === null || val === undefined) return '';
  return String(val).substring(0, max);
}

/**
 * Generate a unique CardCode for SAP.
 * Format: {C|V}{3-letter-name}{8-hex-from-uuid} = max 12 chars (within 15 limit)
 * Uses 8 UUID hex chars = 4 billion+ combinations, practically collision-free.
 */
function generateCardCode(kycId, companyName, bpType) {
  const prefix = bpType === 'customer' ? 'C' : 'V';
  const namepart = (companyName || 'UNK')
    .replace(/[^A-Za-z]/g, '')
    .substring(0, 3)
    .toUpperCase() || 'UNK';
  // Use 8 hex chars from UUID (remove hyphens first) for uniqueness
  const idPart = kycId.replace(/-/g, '').substring(0, 8).toUpperCase();
  return `${prefix}${namepart}${idPart}`;
}

/**
 * Map KYC form data to SAP Business Partner payload.
 * Every single string field is truncated to SAP's strict limits.
 *
 * NOTE on Bank Accounts:
 * SAP's BPBankAccounts.BankCode must reference a pre-configured bank in SAP's bank
 * master table (ODSC). Since we don't know the user's SAP bank codes, we store bank
 * details in FreeText and skip BPBankAccounts entirely. The admin can add bank accounts
 * manually in SAP after BP creation.
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

  // Build FreeText with trade license + bank details (since we can't use BPBankAccounts)
  const freeTextParts = [
    cd.tradeLicenseNo ? `TL:${cd.tradeLicenseNo}` : '',
    cd.tradeLicenseExpiry ? `Exp:${cd.tradeLicenseExpiry}` : '',
    bi.natureOfBusiness ? `Biz:${bi.natureOfBusiness}` : '',
  ];
  // Append bank info summary to FreeText
  banks.forEach((b, i) => {
    const bankParts = [
      b.bankName ? `Bank${i + 1}:${b.bankName}` : '',
      b.iban ? `IBAN:${b.iban}` : '',
      b.swift ? `SW:${b.swift}` : '',
    ].filter(Boolean);
    if (bankParts.length > 0) {
      freeTextParts.push(bankParts.join('/'));
    }
  });

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
    FreeText: t(freeTextParts.filter(Boolean).join('|'), L.FreeText),
    Country: t(getCountryCode(bi.country), L.Country),
    // Notes — keep VERY short, just KYC reference
    Notes: t(`KYC:${kycRecord.id.substring(0, 36)}`, L.Notes),
  };

  // ===== ADDRESSES =====
  const addresses = [];
  let addrIdx = 0;
  const countryCode = t(getCountryCode(bi.country), L.Country);
  // Only send State if it's already a proper 2-3 char code
  const stateCode = getStateCode(bi.provinceState);

  const billToAddr = cd.registeredOfficeAddress || cd.companyAddress || bi.address || '';
  if (billToAddr) {
    const addr = {
      AddressName: t('BILL_TO', L.AddrName),
      Street: t(billToAddr, L.Street),
      City: t(bi.city, L.City),
      ZipCode: t(bi.postalZipCode, L.ZipCode),
      Country: countryCode,
      AddressType: 'bo_BillTo',
      BPCode: t(cardCode, L.CardCode),
      RowNum: addrIdx++,
    };
    // Only include State if we have a proper code
    if (stateCode) addr.State = stateCode;
    addresses.push(addr);
  }

  const shipToAddr = cd.companyAddress || bi.address || '';
  if (shipToAddr) {
    const addr = {
      AddressName: t('SHIP_TO', L.AddrName),
      Street: t(shipToAddr, L.Street),
      City: t(bi.city, L.City),
      ZipCode: t(bi.postalZipCode, L.ZipCode),
      Country: countryCode,
      AddressType: 'bo_ShipTo',
      BPCode: t(cardCode, L.CardCode),
      RowNum: addrIdx++,
    };
    if (stateCode) addr.State = stateCode;
    addresses.push(addr);
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
      const contact = {
        Name: t(o.name, L.ContactName),
        FirstName: t(nameParts[0], L.FirstName),
        LastName: t(nameParts.slice(1).join(' ') || nameParts[0], L.LastName),
        Phone1: t(o.contactNo, L.Phone),
        E_Mail: t(o.email, L.Email),
        InternalCode: contactIdx++,
      };
      // Position is for job title/designation (up to 20 chars)
      // Title is for salutation (Mr/Mrs/Dr) — don't put designation there
      if (o.designation) {
        contact.Position = t(o.designation, L.Position);
      }
      // Nationality + shareholding in remarks
      if (o.nationality) {
        contact.Remarks1 = t(`${o.nationality} ${o.shareholdingPercent || ''}%`.trim(), L.Remarks);
      }
      contacts.push(contact);
    }
  });

  if (mi.managerName) {
    const mParts = mi.managerName.trim().split(/\s+/);
    contacts.push({
      Name: t(mi.managerName, L.ContactName),
      FirstName: t(mParts[0], L.FirstName),
      LastName: t(mParts.slice(1).join(' ') || mParts[0], L.LastName),
      Position: t('Manager', L.Position),
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
      Position: t('Accounts Payable', L.Position),
      Phone1: t(mi.apContactPhone || mi.apContactMobile, L.Phone),
      E_Mail: t(mi.apContactEmail, L.Email),
      InternalCode: contactIdx++,
    });
  }

  if (contacts.length > 0) {
    bp.ContactEmployees = contacts;
  }

  // NOTE: BPBankAccounts intentionally SKIPPED.
  // SAP requires BankCode to reference pre-configured entries in the bank master table (ODSC).
  // Bank details are stored in FreeText instead. Admin can add bank accounts in SAP manually.

  return cleanSapPayload(bp);
}

/**
 * Recursively remove empty/null/undefined values from SAP payload.
 * SAP B1 Service Layer can choke on empty strings and null values.
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
 * Only the absolute minimum fields: CardCode, CardName, CardType.
 */
export function mapKycToMinimalBusinessPartner(formData, kycRecord, bpType) {
  const bi = formData.businessInfo || {};
  const cd = formData.companyDetails || {};
  const companyName = cd.companyName || bi.businessName || kycRecord.companyName || '';
  const cardCode = generateCardCode(kycRecord.id, companyName, bpType);

  // Minimal payload — only required fields, nothing that can cause validation errors
  const payload = {
    CardCode: t(cardCode, SAP_LIMITS.CardCode),
    CardName: t(companyName, SAP_LIMITS.CardName),
    CardType: bpType === 'customer' ? 'cCustomer' : 'cSupplier',
  };

  // Only add phone/email if they exist (don't send empty)
  const phone = cd.officePhone || bi.phone;
  if (phone) payload.Phone1 = t(phone, SAP_LIMITS.Phone);

  const email = cd.email || kycRecord.email;
  if (email) payload.EmailAddress = t(email, SAP_LIMITS.Email);

  return payload;
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
