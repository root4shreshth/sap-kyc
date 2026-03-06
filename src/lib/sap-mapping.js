/**
 * KYC Form Data → SAP Business Partner Field Mapping
 * Maps the normalized KYC form data to SAP B1 Service Layer Business Partner structure.
 *
 * STAGED APPROACH:
 * SAP B1 Service Layer often returns 502 Proxy Error when creating a BP with
 * addresses + contacts + attachments all in one request. The proxy/SL crashes.
 *
 * Solution: Create BP with core fields first (POST), then PATCH in addresses
 * and contacts separately. This is how n8n and other integrations work reliably.
 *
 * NUMBERING:
 * CardCode is NOT manually generated. Instead, we send a `Series` field and
 * let SAP auto-generate the CardCode from the configured numbering series.
 * Series are queried at runtime via SeriesService_GetDocumentSeries.
 *
 * Stage 1 (POST): Series, CardName, CardType, Phone, Email, PaymentTermsGrpCode, etc.
 * Stage 2 (PATCH): BPAddresses (using SAP-returned CardCode)
 * Stage 3 (PATCH): ContactEmployees
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
 * Only send State if it's already a proper 2-3 char code.
 */
function getStateCode(stateValue) {
  if (!stateValue) return '';
  const trimmed = stateValue.trim();
  if (/^[A-Z]{2,3}$/i.test(trimmed)) return trimmed.toUpperCase();
  return '';
}

/**
 * SAP B1 Field Length Limits — STRICTEST known values.
 */
const SAP_LIMITS = {
  CardCode: 15, CardName: 100, Phone: 20, Fax: 20, Email: 100,
  Website: 100, FederalTaxID: 32, VatReg: 32, FreeText: 200,
  Notes: 50, Country: 3,
  AddrName: 50, Street: 100, Block: 100, City: 100, ZipCode: 20,
  State: 3, County: 100,
  ContactName: 50, FirstName: 40, LastName: 40, Title: 10,
  Position: 20, Remarks: 100,
};

/** Truncate a value to max length. Returns '' for null/undefined. */
function t(val, max) {
  if (val === null || val === undefined) return '';
  return String(val).substring(0, max);
}

/**
 * Fallback CardCode generator (used ONLY if SAP series query fails).
 * Format: {C|V|L}{3-letter-name}{8-hex-from-uuid} = max 12 chars (within 15 limit)
 */
function generateFallbackCardCode(kycId, companyName, bpType) {
  const prefix = bpType === 'customer' ? 'C' : bpType === 'vendor' ? 'V' : 'L';
  const namepart = (companyName || 'UNK')
    .replace(/[^A-Za-z]/g, '')
    .substring(0, 3)
    .toUpperCase() || 'UNK';
  const idPart = kycId.replace(/-/g, '').substring(0, 8).toUpperCase();
  return `${prefix}${namepart}${idPart}`;
}

/**
 * Map bpType to SAP CardType value.
 */
function getCardType(bpType) {
  if (bpType === 'customer') return 'cCustomer';
  if (bpType === 'vendor') return 'cSupplier';
  if (bpType === 'lead') return 'cLead';
  return 'cCustomer'; // fallback
}

/** Recursively remove empty/null/undefined values from SAP payload. */
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
 * STAGE 1: Core BP fields only (for POST /BusinessPartners).
 * This is the safest payload — no sub-collections, no arrays.
 *
 * @param {Object} formData - Normalized KYC form data
 * @param {Object} kycRecord - KYC database record
 * @param {string} bpType - 'customer', 'vendor', or 'lead'
 * @param {number|null} seriesNumber - SAP numbering series (if provided, SAP auto-generates CardCode)
 * @param {string|null} cardCode - Pre-generated CardCode (e.g., "CUS0002") to use when series unavailable
 */
export function mapKycToBusinessPartner(formData, kycRecord, bpType, seriesNumber = null, cardCode = null) {
  const bi = formData.businessInfo || {};
  const cd = formData.companyDetails || {};
  const banks = formData.bankingChecks || [];

  const companyName = cd.companyName || bi.businessName || kycRecord.companyName || '';
  const L = SAP_LIMITS;

  // Build FreeText with tax IDs, trade license + bank summary
  // NOTE: VatRegistrationNumber and FederalTaxID are NOT sent as direct BP properties
  // because SAP B1 may reject them as invalid depending on the installation/localization.
  // Instead, we pack them into FreeText to preserve the data safely.
  const freeTextParts = [
    bi.taxRegistrationNo ? `TRN:${bi.taxRegistrationNo}` : '',
    cd.vatRegistrationNo ? `VAT:${cd.vatRegistrationNo}` : '',
    cd.tradeLicenseNo ? `TL:${cd.tradeLicenseNo}` : '',
    cd.tradeLicenseExpiry ? `Exp:${cd.tradeLicenseExpiry}` : '',
    bi.natureOfBusiness ? `Biz:${bi.natureOfBusiness}` : '',
  ];
  banks.forEach((b, i) => {
    const parts = [
      b.bankName ? `Bank${i + 1}:${b.bankName}` : '',
      b.iban ? `IBAN:${b.iban}` : '',
      b.swift ? `SW:${b.swift}` : '',
    ].filter(Boolean);
    if (parts.length > 0) freeTextParts.push(parts.join('/'));
  });

  const bp = {
    CardName: t(companyName, L.CardName),
    CardType: getCardType(bpType),
    Phone1: t(cd.officePhone || bi.phone, L.Phone),
    Phone2: t(bi.phone && cd.officePhone ? bi.phone : '', L.Phone),
    EmailAddress: t(cd.email || kycRecord.email, L.Email),
    Website: t(cd.websiteSocialMedia || bi.website, L.Website),
    FreeText: t(freeTextParts.filter(Boolean).join('|'), L.FreeText),
    Country: t(getCountryCode(bi.country), L.Country),
    Notes: t(`KYC:${kycRecord.id.substring(0, 36)}`, L.Notes),
  };

  // Use SAP auto-numbering via Series, or pre-generated sequential code, or UUID fallback
  if (seriesNumber) {
    bp.Series = seriesNumber;
  } else if (cardCode) {
    bp.CardCode = t(cardCode, L.CardCode);
  } else {
    bp.CardCode = t(generateFallbackCardCode(kycRecord.id, companyName, bpType), L.CardCode);
  }

  // NOTE: PaymentTermsGrpCode is NOT sent — SAP B1 rejects it as invalid
  // on this installation (similar to VatRegistrationNumber). If needed in
  // future, the SAP team must confirm the correct property name.

  return cleanSapPayload(bp);
}

/**
 * STAGE 2: Addresses payload (for PATCH /BusinessPartners('{CardCode}')).
 * Returns { BPAddresses: [...] } or null if no addresses.
 *
 * @param {Object} formData - Normalized KYC form data
 * @param {Object} kycRecord - KYC database record
 * @param {string} cardCode - The SAP-returned CardCode from Stage 1
 */
export function mapKycToAddresses(formData, kycRecord, cardCode) {
  const bi = formData.businessInfo || {};
  const cd = formData.companyDetails || {};
  const warehouses = formData.warehouseAddresses || [];

  const L = SAP_LIMITS;
  const countryCode = t(getCountryCode(bi.country), L.Country);
  const stateCode = getStateCode(bi.provinceState);

  const addresses = [];
  let addrIdx = 0;

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

  if (addresses.length === 0) return null;
  return cleanSapPayload({ BPAddresses: addresses });
}

/**
 * STAGE 3: Contacts payload (for PATCH /BusinessPartners('{CardCode}')).
 * Returns { ContactEmployees: [...] } or null if no contacts.
 */
export function mapKycToContacts(formData, kycRecord) {
  const mi = formData.managerInfo || {};
  const owners = formData.ownershipManagement || [];
  const L = SAP_LIMITS;

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
      if (o.designation) contact.Position = t(o.designation, L.Position);
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

  if (contacts.length === 0) return null;
  return cleanSapPayload({ ContactEmployees: contacts });
}

/**
 * Minimal BP payload for testing SAP connection.
 *
 * @param {Object} formData
 * @param {Object} kycRecord
 * @param {string} bpType - 'customer', 'vendor', or 'lead'
 * @param {number|null} seriesNumber
 * @param {string|null} cardCode - Pre-generated CardCode (e.g., "CUS0002") when series unavailable
 */
export function mapKycToMinimalBusinessPartner(formData, kycRecord, bpType, seriesNumber = null, cardCode = null) {
  const bi = formData.businessInfo || {};
  const cd = formData.companyDetails || {};
  const companyName = cd.companyName || bi.businessName || kycRecord.companyName || '';

  const payload = {
    CardName: t(companyName, SAP_LIMITS.CardName),
    CardType: getCardType(bpType),
  };

  // Use SAP auto-numbering via Series, or pre-generated sequential code, or UUID fallback
  if (seriesNumber) {
    payload.Series = seriesNumber;
  } else if (cardCode) {
    payload.CardCode = t(cardCode, SAP_LIMITS.CardCode);
  } else {
    payload.CardCode = t(generateFallbackCardCode(kycRecord.id, companyName, bpType), SAP_LIMITS.CardCode);
  }

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

  return { valid: errors.length === 0, errors };
}
