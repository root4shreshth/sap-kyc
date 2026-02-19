export const TABS = [
  { key: 'business', label: 'Business Info' },
  { key: 'proprietors', label: 'Proprietors' },
  { key: 'company', label: 'Company (UAE)' },
  { key: 'ownership', label: 'Ownership' },
  { key: 'banking', label: 'Banking' },
  { key: 'references', label: 'References' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'declaration', label: 'Declaration & Docs' },
];

export function getDefaultFormData() {
  return {
    // Section 1: Business Information (from PDF)
    businessInfo: {
      businessName: '',
      taxRegistrationNo: '',
      address: '',
      city: '',
      provinceState: '',
      postalZipCode: '',
      country: '',
      phone: '',
      website: '',
      businessType: {
        corporation: false,
        incorporated: false,
        partnership: false,
        soleProprietorship: false,
      },
      dateOfIncorporation: '',
      yearsInBusiness: '',
      natureOfBusiness: '',
      monthlyCreditRequired: '',
      annualSales: '',
      numberOfEmployees: '',
    },

    // Section 2: Proprietors & Management (from PDF)
    proprietors: [
      { name: '', title: '', address: '', email: '', phone: '', mobile: '' },
      { name: '', title: '', address: '', email: '', phone: '', mobile: '' },
    ],
    managerInfo: {
      managerName: '',
      managerEmail: '',
      managerPhone: '',
      managerMobile: '',
      apContactName: '',
      apContactEmail: '',
      apContactPhone: '',
      apContactMobile: '',
    },

    // Section 3: Company Details UAE (from PNG)
    companyDetails: {
      companyName: '',
      tradeLicenseNo: '',
      tradeLicenseExpiry: '',
      mqaRegistrationNo: '',
      vatRegistrationNo: '',
      companyAddress: '',
      officePhone: '',
      email: '',
      websiteSocialMedia: '',
    },

    // Section 4: Ownership & Management (from PNG)
    ownershipManagement: [
      { name: '', designation: '', nationality: '', uaeId: '', passportNo: '', shareholdingPercent: '', contactNo: '', email: '', socialMedia: '' },
    ],

    // Section 5: Banking & Financial (from PDF + PNG)
    bankReference: {
      bankName: '',
      address: '',
      city: '',
      provinceState: '',
      postalZipCode: '',
      contactName: '',
      email: '',
      yearsRelationship: '',
      phone: '',
    },
    bankingChecks: [
      { bankName: '', branch: '', accountNo: '', iban: '', swift: '', bankContact: '', reputationCheck: '', notes: '' },
    ],

    // Section 6: Trade & Supplier References (from PDF + PNG)
    supplierReferences: [
      { name: '', address: '', city: '', provinceState: '', postalZipCode: '', country: '', phone: '', contact: '', highestCredit: '', paymentTerms: '' },
      { name: '', address: '', city: '', provinceState: '', postalZipCode: '', country: '', phone: '', contact: '', highestCredit: '', paymentTerms: '' },
      { name: '', address: '', city: '', provinceState: '', postalZipCode: '', country: '', phone: '', contact: '', highestCredit: '', paymentTerms: '' },
    ],
    tradeReferences: [
      { customerSupplier: '', contact: '', phoneEmail: '', typeOfBusiness: '', yearsRelationship: '', notes: '' },
    ],

    // Section 7: Compliance & Reviews (from PNG)
    regulatoryCompliance: [
      { area: 'Ajman Free Zone / Local Authority Approvals', status: '', docsProvided: '', remarks: '', reputationScore: '' },
      { area: 'Environmental / Health & Safety Compliance', status: '', docsProvided: '', remarks: '', reputationScore: '' },
      { area: 'HACCP / ISO / Food Safety', status: '', docsProvided: '', remarks: '', reputationScore: '' },
      { area: 'Labor / Social Compliance', status: '', docsProvided: '', remarks: '', reputationScore: '' },
      { area: 'Customs / Import-Export Licensing', status: '', docsProvided: '', remarks: '', reputationScore: '' },
      { area: 'Other Regulatory Requirements', status: '', docsProvided: '', remarks: '', reputationScore: '' },
    ],
    socialMediaReviews: [
      { platform: '', entity: '', reviewSummary: '', rating: '', verifiedSource: '', actionRequired: '' },
    ],
    complianceChecklist: {
      negSocialMediaConductCheck: false,
      bankingCredibilityCheck: false,
      regulatoryApprovalCheck: false,
      additionalBackgroundCheck: false,
      laborSafetyLicenseCheck: false,
      licensingPermitCheck: false,
    },

    // Section 8: Declaration
    declaration: {
      infoAccurate: false,
      authorizeVerification: false,
      signatureName: '',
      signaturePosition: '',
      signatureDate: '',
    },
  };
}
