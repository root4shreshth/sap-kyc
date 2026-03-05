import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { sapLogin, sapLogout, isSapConfigured } from '@/lib/sap-client';

export async function POST(request) {
  const { error } = requireAuth(request, ['Admin']);
  if (error) return error;

  if (!isSapConfigured()) {
    return NextResponse.json({
      success: false,
      error: 'SAP is not configured. Add SAP_BASE_URL, SAP_COMPANY_DB, SAP_USERNAME, SAP_PASSWORD to environment variables.',
    });
  }

  const startTime = Date.now();

  try {
    const session = await sapLogin();
    const loginTime = Date.now() - startTime;

    // Test logout too (pass agent so it gets cleaned up)
    await sapLogout(session.cookies, session.agent);
    const totalTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      sessionId: session.sessionId,
      sessionTimeout: session.timeout,
      loginTimeMs: loginTime,
      totalTimeMs: totalTime,
      sapBaseUrl: (process.env.SAP_BASE_URL || '').replace(/\/+$/, ''),
      companyDb: process.env.SAP_COMPANY_DB || '',
      message: `Connected successfully in ${loginTime}ms. Session timeout: ${session.timeout} min.`,
    });
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.error('SAP connection test failed:', err.message);

    // Classify the error
    let errorType = 'unknown';
    const msg = err.message || '';
    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT')) {
      errorType = 'network';
    } else if (msg.includes('401') || msg.includes('Invalid') || msg.includes('authentication')) {
      errorType = 'auth';
    } else if (msg.includes('certificate') || msg.includes('SSL') || msg.includes('self-signed') || msg.includes('CERT')) {
      errorType = 'ssl';
    }

    return NextResponse.json({
      success: false,
      error: msg,
      errorType,
      elapsedMs: elapsed,
      sapBaseUrl: (process.env.SAP_BASE_URL || '').replace(/\/+$/, ''),
      suggestions: errorType === 'network'
        ? 'SAP server is unreachable. Check if the SAP server is running and the URL is correct. If SAP is on a private network, this app cannot reach it from a public host.'
        : errorType === 'auth'
          ? 'Authentication failed. Check SAP_USERNAME, SAP_PASSWORD, and SAP_COMPANY_DB values.'
          : errorType === 'ssl'
            ? 'SSL/TLS certificate issue. The SAP server may be using a self-signed certificate.'
            : 'An unexpected error occurred connecting to SAP.',
    });
  }
}
