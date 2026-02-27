/**
 * SAP B1 Service Layer Client
 * Handles authentication, session management, and API calls to SAP Business One.
 * Uses cookie-based session auth (B1SESSION + ROUTEID).
 * Self-signed SSL certs are allowed (common in on-prem SAP installs).
 */

const https = require('https');

// Allow self-signed certificates for on-prem SAP
const agent = new https.Agent({ rejectUnauthorized: false });

function getSapConfig() {
  return {
    baseUrl: process.env.SAP_BASE_URL || 'https://192.168.1.235:50000',
    companyDb: process.env.SAP_COMPANY_DB || 'TEST_ALAMIR_09052025',
    username: process.env.SAP_USERNAME || 'manager',
    password: process.env.SAP_PASSWORD || '1125',
  };
}

/**
 * Make an HTTP request to SAP Service Layer
 */
async function sapRequest(method, path, body = null, cookies = '') {
  const config = getSapConfig();
  const url = `${config.baseUrl}${path}`;

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (cookies) {
    headers.Cookie = cookies;
  }

  const options = {
    method,
    headers,
    agent,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  // Extract set-cookie headers for session management
  const setCookies = response.headers.getSetCookie?.() || [];
  const cookieString = setCookies.map(c => c.split(';')[0]).join('; ');

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { rawText: text };
    }
  }

  if (!response.ok) {
    const errMsg = data?.error?.message?.value || data?.error?.message || `SAP request failed with status ${response.status}`;
    const error = new Error(errMsg);
    error.status = response.status;
    error.sapError = data?.error || null;
    throw error;
  }

  return { data, cookies: cookieString || cookies, status: response.status };
}

/**
 * Login to SAP Service Layer
 * Returns session cookies for subsequent requests
 */
export async function sapLogin() {
  const config = getSapConfig();
  const { data, cookies } = await sapRequest('POST', '/b1s/v1/Login', {
    CompanyDB: config.companyDb,
    UserName: config.username,
    Password: config.password,
  });

  if (!cookies && !data?.SessionId) {
    throw new Error('SAP login failed: no session returned');
  }

  console.log('[SAP] Login successful, SessionId:', data?.SessionId);

  return {
    sessionId: data?.SessionId,
    cookies,
    timeout: data?.SessionTimeout || 30,
  };
}

/**
 * Logout from SAP Service Layer
 */
export async function sapLogout(cookies) {
  try {
    await sapRequest('POST', '/b1s/v1/Logout', null, cookies);
    console.log('[SAP] Logout successful');
  } catch (err) {
    // Logout errors are non-critical — session will expire anyway
    console.warn('[SAP] Logout warning:', err.message);
  }
}

/**
 * Create a Business Partner in SAP B1
 * @param {Object} bpData - SAP Business Partner payload
 * @param {string} cookies - Session cookies from sapLogin
 * @returns {Object} Created BP data including CardCode
 */
export async function createBusinessPartner(bpData, cookies) {
  const { data } = await sapRequest('POST', '/b1s/v1/BusinessPartners', bpData, cookies);
  console.log('[SAP] Business Partner created:', data?.CardCode);
  return data;
}

/**
 * Get a Business Partner by CardCode
 */
export async function getBusinessPartner(cardCode, cookies) {
  const { data } = await sapRequest('GET', `/b1s/v1/BusinessPartners('${cardCode}')`, null, cookies);
  return data;
}

/**
 * Check if SAP integration is configured
 */
export function isSapConfigured() {
  return !!(process.env.SAP_BASE_URL && process.env.SAP_COMPANY_DB && process.env.SAP_USERNAME && process.env.SAP_PASSWORD);
}

/**
 * Execute a full SAP operation with auto login/logout
 * Handles session lifecycle automatically
 */
export async function withSapSession(operation) {
  const session = await sapLogin();
  try {
    const result = await operation(session.cookies);
    return result;
  } finally {
    await sapLogout(session.cookies);
  }
}
