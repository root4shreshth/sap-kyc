/**
 * SAP B1 Service Layer Client
 * Handles authentication, session management, and API calls to SAP Business One.
 * Uses cookie-based session auth (B1SESSION + ROUTEID).
 * Uses native https module (not fetch) to support self-signed SSL certs on on-prem SAP.
 */

import https from 'https';
import { URL } from 'url';

function getSapConfig() {
  return {
    baseUrl: process.env.SAP_BASE_URL || 'https://192.168.1.235:50000',
    companyDb: process.env.SAP_COMPANY_DB || 'TEST_ALAMIR_09052025',
    username: process.env.SAP_USERNAME || 'manager',
    password: process.env.SAP_PASSWORD || '1125',
  };
}

/**
 * Make an HTTPS request to SAP Service Layer using native https module.
 * This properly supports rejectUnauthorized: false for self-signed certs.
 */
function sapRequest(method, path, body = null, cookies = '') {
  return new Promise((resolve, reject) => {
    const config = getSapConfig();
    const fullUrl = `${config.baseUrl}${path}`;
    const parsed = new URL(fullUrl);

    const bodyStr = body ? JSON.stringify(body) : null;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method,
      rejectAuthorized: false,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      // This is the key — allows self-signed certs on on-prem SAP
      rejectUnauthorized: false,
    };

    if (cookies) {
      options.headers.Cookie = cookies;
    }

    if (bodyStr) {
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        // Extract Set-Cookie headers for session management
        const setCookies = res.headers['set-cookie'] || [];
        const cookieString = setCookies.map(c => c.split(';')[0]).join('; ');

        let parsed = null;
        if (data) {
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = { rawText: data };
          }
        }

        if (res.statusCode >= 400) {
          const errMsg = parsed?.error?.message?.value || parsed?.error?.message || `SAP request failed with status ${res.statusCode}`;
          const error = new Error(errMsg);
          error.status = res.statusCode;
          error.sapError = parsed?.error || null;
          reject(error);
          return;
        }

        resolve({ data: parsed, cookies: cookieString || cookies, status: res.statusCode });
      });
    });

    req.on('error', (err) => {
      reject(new Error(`SAP connection error: ${err.message}`));
    });

    // 30 second timeout
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('SAP request timed out after 30 seconds'));
    });

    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
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
