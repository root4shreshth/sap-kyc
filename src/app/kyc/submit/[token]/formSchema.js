export const TABS = [
  { key: 'business', label: 'Business Info' },
  { key: 'proprietors', label: 'Proprietors' },
  { key: 'company', label: 'Company (UAE)' },
  { key: 'ownership', label: 'Ownership' },
  { key: 'banking', label: 'Banking' },
  { key: 'references', label: 'References' },
  { key: 'social', label: 'Social Media' },
  { key: 'indian', label: 'Indian Buyer' },
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
      registeredOfficeAddress: '',
      borderAgent: {
        agentName: '',
        agentContact: '',
        agentAddress: '',
      },
    },

    // Warehouse Addresses
    warehouseAddresses: [{ address: '' }],

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

    // Section 7: Social Media
    socialMedia: {
      facebook: '',
      instagram: '',
      twitter: '',
      linkedin: '',
      others: '',
    },

    // Section 8: Indian Buyer Info
    indianBuyerInfo: {
      fssaiNumber: '',
      panNumber: '',
      iecNumber: '',
    },

    // Section 9: Declaration
    declaration: {
      infoAccurate: false,
      authorizeVerification: false,
      notMoneyLaundering: false,
      notTerroristFunding: false,
      notSanctionedCountry: false,
      notPoliticalParty: false,
      signatureName: '',
      signaturePosition: '',
      signatureDate: '',
    },
  };
}

export function getMockFormData() {
  return {
    businessInfo: {
      businessName: 'Golden Spice Trading Co. LLC',
      taxRegistrationNo: '100458723900003',
      address: 'Plot B-14, Ajman Free Zone, Phase 2',
      city: 'Ajman',
      provinceState: 'Ajman',
      postalZipCode: '16243',
      country: 'United Arab Emirates',
      phone: '+971 6 742 8800',
      website: 'www.goldenspicetrading.ae',
      businessType: {
        corporation: true,
        incorporated: false,
        partnership: false,
        soleProprietorship: false,
      },
      dateOfIncorporation: '2017-03-15',
      yearsInBusiness: '8',
      natureOfBusiness: 'Import, export, and wholesale distribution of spices, dried herbs, specialty food ingredients, and gourmet sauces across the GCC region',
      monthlyCreditRequired: 'AED 500,000',
      annualSales: 'AED 18,500,000',
      numberOfEmployees: '47',
    },

    proprietors: [
      {
        name: 'Ahmed Khalid Al Mansouri',
        title: 'Managing Director',
        address: 'Villa 23, Al Rawda 3, Ajman, UAE',
        email: 'ahmed.mansouri@goldenspicetrading.ae',
        phone: '+971 6 742 8801',
        mobile: '+971 50 884 3210',
      },
      {
        name: 'Fatima Hassan Al Shamsi',
        title: 'Director of Operations',
        address: 'Apartment 1402, Corniche Tower, Al Bustan, Ajman, UAE',
        email: 'fatima.shamsi@goldenspicetrading.ae',
        phone: '+971 6 742 8802',
        mobile: '+971 55 267 9184',
      },
    ],
    managerInfo: {
      managerName: 'Rajesh Kumar Nair',
      managerEmail: 'rajesh.nair@goldenspicetrading.ae',
      managerPhone: '+971 6 742 8805',
      managerMobile: '+971 52 431 6677',
      apContactName: 'Priya Suresh',
      apContactEmail: 'accounts@goldenspicetrading.ae',
      apContactPhone: '+971 6 742 8810',
      apContactMobile: '+971 56 112 9034',
    },

    companyDetails: {
      companyName: 'Golden Spice Trading Co. LLC',
      tradeLicenseNo: 'AFZ/2017/08451',
      tradeLicenseExpiry: '2025-12-31',
      mqaRegistrationNo: 'MQA-AJ-004829',
      vatRegistrationNo: '100458723900003',
      companyAddress: 'Warehouse 7, Block B-14, Ajman Free Zone, Ajman, UAE',
      officePhone: '+971 6 742 8800',
      email: 'info@goldenspicetrading.ae',
      websiteSocialMedia: 'www.goldenspicetrading.ae | @goldenspiceuae (Instagram) | linkedin.com/company/goldenspicetrading',
      registeredOfficeAddress: 'Plot B-14, Block 3, Ajman Free Zone, Ajman, UAE',
      borderAgent: {
        agentName: 'Gulf Clearing Services LLC',
        agentContact: '+971 6 731 5500 | clearing@gulfcs.ae',
        agentAddress: 'Office 204, Ajman Port Building, Ajman, UAE',
      },
    },

    warehouseAddresses: [
      { address: 'Warehouse 7, Block B-14, Ajman Free Zone, Ajman, UAE' },
      { address: 'Cold Storage Unit 3, Al Jurf Industrial, Ajman, UAE' },
    ],

    ownershipManagement: [
      {
        name: 'Ahmed Khalid Al Mansouri',
        designation: 'Managing Director & Chairman',
        nationality: 'UAE',
        uaeId: '784-1985-1234567-1',
        passportNo: 'N3847291',
        shareholdingPercent: '60',
        contactNo: '+971 50 884 3210',
        email: 'ahmed.mansouri@goldenspicetrading.ae',
        socialMedia: 'linkedin.com/in/ahmedmansouri',
      },
      {
        name: 'Fatima Hassan Al Shamsi',
        designation: 'Director of Operations',
        nationality: 'UAE',
        uaeId: '784-1990-7654321-2',
        passportNo: 'N5928104',
        shareholdingPercent: '40',
        contactNo: '+971 55 267 9184',
        email: 'fatima.shamsi@goldenspicetrading.ae',
        socialMedia: 'linkedin.com/in/fatimashamsi',
      },
    ],

    bankReference: {
      bankName: 'Emirates NBD',
      address: 'Sheikh Zayed Road Branch, Trade Centre Area',
      city: 'Dubai',
      provinceState: 'Dubai',
      postalZipCode: '50001',
      contactName: 'Mohammad Tariq',
      email: 'corporate.services@emiratesnbd.com',
      yearsRelationship: '7',
      phone: '+971 4 316 0200',
    },
    bankingChecks: [
      {
        bankName: 'Emirates NBD',
        branch: 'Sheikh Zayed Road, Dubai',
        accountNo: '1017483926401',
        iban: 'AE070331234567890123456',
        swift: 'EABORAEADXXX',
        bankContact: 'Mohammad Tariq, +971 4 316 0200',
        reputationCheck: 'Satisfactory - Good standing, no adverse findings',
        notes: 'Primary operating account. Consistent credit history since 2017.',
      },
      {
        bankName: 'Mashreq Bank',
        branch: 'Ajman City Centre Branch, Ajman',
        accountNo: '0192837465012',
        iban: 'AE460460000192837465012',
        swift: 'BOMABORAEADX',
        bankContact: 'Sara Al Hashimi, +971 6 745 3300',
        reputationCheck: 'Satisfactory - Good standing',
        notes: 'Secondary account for supplier payments. Active since 2019.',
      },
    ],

    supplierReferences: [
      {
        name: 'Kerala Spice Exporters Pvt. Ltd.',
        address: '42 Mattancherry Spice Road',
        city: 'Kochi',
        provinceState: 'Kerala',
        postalZipCode: '682002',
        country: 'India',
        phone: '+91 484 221 8800',
        contact: 'Vinod Menon',
        highestCredit: 'AED 350,000',
        paymentTerms: 'Net 45 days',
      },
      {
        name: 'Istanbul Gourmet Ingredients A.S.',
        address: 'Atat\u00FCrk Industrial Zone, No. 78',
        city: 'Istanbul',
        provinceState: 'Istanbul',
        postalZipCode: '34065',
        country: 'Turkey',
        phone: '+90 212 555 3412',
        contact: 'Elif Yilmaz',
        highestCredit: 'AED 280,000',
        paymentTerms: 'Net 30 days',
      },
      {
        name: 'Zanzibar Clove & Herb Company Ltd.',
        address: 'PO Box 3127, Malindi Road',
        city: 'Zanzibar City',
        provinceState: 'Zanzibar',
        postalZipCode: '71101',
        country: 'Tanzania',
        phone: '+255 24 223 4456',
        contact: 'Hassan Omar',
        highestCredit: 'AED 150,000',
        paymentTerms: 'Net 60 days',
      },
    ],
    tradeReferences: [
      {
        customerSupplier: 'Carrefour UAE (MAF Retail)',
        contact: 'Procurement Dept. - Nadia Al Qasimi',
        phoneEmail: '+971 4 294 1212 | procurement@carrefouruae.ae',
        typeOfBusiness: 'Retail / Supermarket Chain',
        yearsRelationship: '5',
        notes: 'Regular supplier of packaged spices and specialty sauces to 12 Carrefour stores across the UAE.',
      },
      {
        customerSupplier: 'Lulu Hypermarket Group',
        contact: 'Vendor Relations - Sunil Mathew',
        phoneEmail: '+971 2 418 1100 | vendors@lulugroup.com',
        typeOfBusiness: 'Retail / Hypermarket Chain',
        yearsRelationship: '4',
        notes: 'Supplies bulk spices and dried herbs for private label and branded product lines.',
      },
    ],

    socialMedia: {
      facebook: 'https://facebook.com/goldenspiceuae',
      instagram: 'https://instagram.com/goldenspiceuae',
      twitter: 'https://x.com/goldenspiceuae',
      linkedin: 'https://linkedin.com/company/goldenspicetrading',
      others: 'https://youtube.com/@goldenspiceuae',
    },

    indianBuyerInfo: {
      fssaiNumber: '',
      panNumber: '',
      iecNumber: '',
    },

    declaration: {
      infoAccurate: true,
      authorizeVerification: true,
      notMoneyLaundering: true,
      notTerroristFunding: true,
      notSanctionedCountry: true,
      notPoliticalParty: true,
      signatureName: 'Ahmed Khalid Al Mansouri',
      signaturePosition: 'Managing Director',
      signatureDate: '2024-11-18',
    },
  };
}
