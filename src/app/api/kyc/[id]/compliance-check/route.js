import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getKycById, getKycFormData, getDocsByKycId, getComplianceResults, saveComplianceResults } from '@/lib/db';

// Compliance check definitions — what AI should evaluate
const COMPLIANCE_CHECKS = [
  // Regulatory & Licensing
  { checkKey: 'trade_license_validity', label: 'Trade License Validity', category: 'Regulatory & Licensing' },
  { checkKey: 'vat_registration', label: 'VAT Registration Verification', category: 'Regulatory & Licensing' },
  { checkKey: 'free_zone_approval', label: 'Free Zone / Local Authority Approval', category: 'Regulatory & Licensing' },
  { checkKey: 'import_export_license', label: 'Import-Export License Status', category: 'Regulatory & Licensing' },
  // Financial & Banking
  { checkKey: 'banking_credibility', label: 'Banking Credibility & Reputation', category: 'Financial & Banking' },
  { checkKey: 'bank_reference_completeness', label: 'Bank Reference Completeness', category: 'Financial & Banking' },
  { checkKey: 'financial_standing', label: 'Financial Standing Assessment', category: 'Financial & Banking' },
  // Identity & Ownership
  { checkKey: 'ownership_verification', label: 'Ownership & Shareholding Verification', category: 'Identity & Ownership' },
  { checkKey: 'identity_documents', label: 'Identity Documents (UAE ID / Passport)', category: 'Identity & Ownership' },
  { checkKey: 'beneficial_ownership', label: 'Beneficial Ownership Transparency', category: 'Identity & Ownership' },
  // Business Reputation
  { checkKey: 'social_media_reputation', label: 'Social Media & Online Reputation', category: 'Business Reputation' },
  { checkKey: 'trade_references', label: 'Trade References Quality', category: 'Business Reputation' },
  { checkKey: 'supplier_references', label: 'Supplier References Verification', category: 'Business Reputation' },
  // Operational Compliance
  { checkKey: 'food_safety_haccp', label: 'Food Safety / HACCP / ISO Certification', category: 'Operational Compliance' },
  { checkKey: 'labor_compliance', label: 'Labor & Safety Compliance', category: 'Operational Compliance' },
  { checkKey: 'environmental_health', label: 'Environmental / Health & Safety', category: 'Operational Compliance' },
  // Document Completeness
  { checkKey: 'document_completeness', label: 'Supporting Document Completeness', category: 'Document Completeness' },
  { checkKey: 'declaration_signed', label: 'Declaration Signed & Authorized', category: 'Document Completeness' },
];

function buildGeminiPrompt(kyc, formData, docs) {
  const docList = docs.map(d => `- ${d.docType}: ${d.fileName}`).join('\n') || 'No documents uploaded';

  return `You are a KYC/KYS compliance analyst for Alamir International Trading L.L.C, a food import/export company in Ajman Free Zone, UAE.

Analyze the following KYC application and provide a compliance assessment for each check item.

## Client Information
- Client Name: ${kyc.clientName}
- Company Name: ${kyc.companyName}
- Email: ${kyc.email}
- Status: ${kyc.status}

## Application Form Data
${JSON.stringify(formData, null, 2)}

## Uploaded Documents
${docList}

## Compliance Checks Required
For EACH of the following checks, provide:
1. **status**: One of: "pass", "fail", "warning", "not_applicable"
2. **remarks**: Brief explanation (1-2 sentences) of why you gave that status

Checks:
${COMPLIANCE_CHECKS.map((c, i) => `${i + 1}. ${c.checkKey}: ${c.label} (Category: ${c.category})`).join('\n')}

## Rules
- "pass" = Information provided is satisfactory and complete
- "warning" = Information is partially provided or has minor concerns
- "fail" = Critical information is missing or there are red flags
- "not_applicable" = This check doesn't apply to this type of business
- Be strict but fair — if a field is empty, mark it as "fail" or "warning"
- Consider UAE/Ajman Free Zone specific requirements
- For food trading companies, food safety certifications are important

## Response Format
Return ONLY a valid JSON array, no markdown, no explanation outside the array:
[
  { "checkKey": "trade_license_validity", "status": "pass", "remarks": "Trade license AFZ/2017/08451 provided with expiry Dec 2025" },
  ...
]`;
}

export async function POST(request, { params }) {
  const { error: authError } = requireAuth(request, ['Admin', 'KYC Team']);
  if (authError) return authError;

  try {
    const { id } = await params;
    const kyc = await getKycById(id);
    if (!kyc) return NextResponse.json({ error: 'KYC not found' }, { status: 404 });

    const formData = await getKycFormData(id);
    if (!formData) return NextResponse.json({ error: 'No form data available' }, { status: 400 });

    const docs = await getDocsByKycId(id);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured. Add it to environment variables.' }, { status: 500 });
    }

    const prompt = buildGeminiPrompt(kyc, formData, docs);

    // Call Gemini API
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', errText);
      return NextResponse.json({ error: `Gemini API error: ${geminiRes.status}` }, { status: 502 });
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON from response (strip markdown code blocks if present)
    let aiResults;
    try {
      const jsonStr = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      aiResults = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('Failed to parse Gemini response:', rawText);
      return NextResponse.json({ error: 'Failed to parse AI response', raw: rawText }, { status: 502 });
    }

    // Merge AI results with check definitions and save
    const checksToSave = COMPLIANCE_CHECKS.map(check => {
      const aiResult = aiResults.find(r => r.checkKey === check.checkKey);
      return {
        checkKey: check.checkKey,
        label: check.label,
        category: check.category,
        aiStatus: aiResult?.status || 'pending',
        aiRemarks: aiResult?.remarks || '',
      };
    });

    await saveComplianceResults(id, checksToSave);

    // Return saved results
    const saved = await getComplianceResults(id);
    return NextResponse.json({ message: 'Compliance check complete', results: saved });
  } catch (err) {
    console.error('Compliance check error:', err);
    return NextResponse.json({ error: `Compliance check failed: ${err.message}` }, { status: 500 });
  }
}

// GET: Retrieve existing compliance results
export async function GET(request, { params }) {
  const { error: authError } = requireAuth(request, ['Admin', 'KYC Team']);
  if (authError) return authError;

  try {
    const { id } = await params;
    const results = await getComplianceResults(id);
    return NextResponse.json({ results });
  } catch (err) {
    console.error('Compliance results GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
