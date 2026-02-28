/**
 * Form validation rules and helpers for the KYC portal form.
 * Defines required fields per section, validates on submit, and tracks section completion.
 */

// Required fields for scalar (nested object) sections
const REQUIRED_FIELDS = {
  businessInfo: ['businessName', 'address', 'city', 'country', 'phone'],
  managerInfo: ['managerName', 'managerEmail', 'managerPhone'],
  companyDetails: ['companyName', 'tradeLicenseNo', 'companyAddress'],
  bankReference: ['bankName', 'address', 'contactName'],
};

// Required declaration checkboxes (must all be true) + signature fields
const REQUIRED_DECLARATION_CHECKBOXES = [
  'infoAccurate', 'authorizeVerification', 'notMoneyLaundering',
  'notTerroristFunding', 'notSanctionedCountry', 'notPoliticalParty',
];
const REQUIRED_DECLARATION_FIELDS = ['signatureName', 'signaturePosition', 'signatureDate'];

// Required array sections: minimum rows and required fields per row
const REQUIRED_ARRAY_FIELDS = {
  proprietors: { minRows: 1, fields: ['name', 'email'] },
  ownershipManagement: { minRows: 1, fields: ['name', 'designation', 'nationality'] },
};

// Map section keys (used in SECTIONS array in page.js) to their validation targets
const SECTION_VALIDATION_MAP = {
  business: { type: 'object', key: 'businessInfo' },
  proprietors: [
    { type: 'array', key: 'proprietors' },
    { type: 'object', key: 'managerInfo' },
  ],
  company: { type: 'object', key: 'companyDetails' },
  ownership: { type: 'array', key: 'ownershipManagement' },
  banking: { type: 'object', key: 'bankReference' },
  references: null,    // no required fields
  social: null,        // no required fields
  indian: null,        // no required fields (conditional)
  declaration: { type: 'declaration' },
};

function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'boolean') return false; // booleans handled separately
  return false;
}

/**
 * Validate the full form and return errors object.
 * Keys are dot-path strings like 'businessInfo.businessName' or 'proprietors.0.name'
 */
export function validateFormData(formData) {
  const errors = {};

  // Validate scalar sections
  for (const [section, fields] of Object.entries(REQUIRED_FIELDS)) {
    const sectionData = formData[section] || {};
    for (const field of fields) {
      if (isEmpty(sectionData[field])) {
        errors[`${section}.${field}`] = 'This field is required';
      }
    }
  }

  // Validate array sections
  for (const [arrayKey, rules] of Object.entries(REQUIRED_ARRAY_FIELDS)) {
    const rows = formData[arrayKey] || [];
    if (rows.length < rules.minRows) {
      errors[`${arrayKey}._min`] = `At least ${rules.minRows} entry required`;
    }
    // Validate required fields in each row that has ANY data
    rows.forEach((row, i) => {
      const hasAnyData = Object.values(row).some(v => !isEmpty(v));
      if (hasAnyData || i < rules.minRows) {
        for (const field of rules.fields) {
          if (isEmpty(row[field])) {
            errors[`${arrayKey}.${i}.${field}`] = 'Required';
          }
        }
      }
    });
  }

  // Validate declaration checkboxes
  const decl = formData.declaration || {};
  for (const checkbox of REQUIRED_DECLARATION_CHECKBOXES) {
    if (!decl[checkbox]) {
      errors[`declaration.${checkbox}`] = 'Must be accepted';
    }
  }
  for (const field of REQUIRED_DECLARATION_FIELDS) {
    if (isEmpty(decl[field])) {
      errors[`declaration.${field}`] = 'This field is required';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Check if a specific field path is required.
 */
export function isRequired(fieldPath) {
  // e.g. 'businessInfo.businessName'
  const parts = fieldPath.split('.');

  // Scalar sections
  if (REQUIRED_FIELDS[parts[0]] && REQUIRED_FIELDS[parts[0]].includes(parts[1])) {
    return true;
  }

  // Array sections — check if the field name is required
  if (REQUIRED_ARRAY_FIELDS[parts[0]] && REQUIRED_ARRAY_FIELDS[parts[0]].fields.includes(parts[parts.length - 1])) {
    return true;
  }

  // Declaration checkboxes
  if (parts[0] === 'declaration') {
    if (REQUIRED_DECLARATION_CHECKBOXES.includes(parts[1])) return true;
    if (REQUIRED_DECLARATION_FIELDS.includes(parts[1])) return true;
  }

  return false;
}

/**
 * Get completion percentage for a section (0-100).
 * Returns null for sections with no required fields.
 */
export function getSectionCompletion(formData, sectionKey) {
  const mapping = SECTION_VALIDATION_MAP[sectionKey];
  if (!mapping) return null;

  const targets = Array.isArray(mapping) ? mapping : [mapping];
  let total = 0;
  let filled = 0;

  for (const target of targets) {
    if (target.type === 'object') {
      const fields = REQUIRED_FIELDS[target.key];
      if (!fields) continue;
      const sectionData = formData[target.key] || {};
      total += fields.length;
      filled += fields.filter(f => !isEmpty(sectionData[f])).length;
    } else if (target.type === 'array') {
      const rules = REQUIRED_ARRAY_FIELDS[target.key];
      if (!rules) continue;
      const rows = formData[target.key] || [];
      // Count required fields in first minRows rows
      const rowsToCheck = Math.max(rules.minRows, rows.length);
      for (let i = 0; i < rowsToCheck && i < rows.length; i++) {
        const row = rows[i];
        const hasData = Object.values(row).some(v => !isEmpty(v));
        if (hasData || i < rules.minRows) {
          total += rules.fields.length;
          filled += rules.fields.filter(f => !isEmpty(row[f])).length;
        }
      }
      if (rows.length === 0 && rules.minRows > 0) {
        total += rules.fields.length;
      }
    } else if (target.type === 'declaration') {
      const decl = formData.declaration || {};
      total += REQUIRED_DECLARATION_CHECKBOXES.length + REQUIRED_DECLARATION_FIELDS.length;
      filled += REQUIRED_DECLARATION_CHECKBOXES.filter(c => decl[c] === true).length;
      filled += REQUIRED_DECLARATION_FIELDS.filter(f => !isEmpty(decl[f])).length;
    }
  }

  if (total === 0) return null;
  return Math.round((filled / total) * 100);
}
