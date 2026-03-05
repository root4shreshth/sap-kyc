/**
 * SAP B1 Service Layer Client
 * Handles authentication, session management, and API calls to SAP Business One.
 * Uses cookie-based session auth (B1SESSION + ROUTEID).
 * Uses native https module (not fetch) to support self-signed SSL certs on on-prem SAP.
 */

// Required for on-prem SAP with self-signed certs.
// The per-agent rejectUnauthorized:false handles direct connections,
// but Node.js internal TLS verification still checks this env var
// for certain code paths (proxy chains, redirects, etc).
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import https from 'https';
import http from 'http';
import { URL } from 'url';
import { constants as cryptoConstants } from 'crypto';

function getSapConfig() {
  return {
    baseUrl: process.env.SAP_BASE_URL || '',
    companyDb: process.env.SAP_COMPANY_DB || '',
    username: process.env.SAP_USERNAME || '',
    password: process.env.SAP_PASSWORD || '',
  };
}

/**
 * Create a fresh HTTPS agent for SAP connections.
 * Using per-session agents avoids stale connection issues in serverless environments.
 * The agent has SSL verification disabled for self-signed certs on on-prem SAP.
 */
function createSapAgent() {
  return new https.Agent({
    rejectUnauthorized: false,   // Allow self-signed certs (on-prem SAP)
    keepAlive: true,
    keepAliveMsecs: 10000,
    maxSockets: 3,
    // Allow ALL TLS versions for on-prem SAP servers
    minVersion: 'TLSv1',
    secureOptions: cryptoConstants?.SSL_OP_LEGACY_SERVER_CONNECT || 0,
  });
}

/**
 * Make an HTTPS request to SAP Service Layer using native https module.
 * Creates a dedicated agent per call to avoid stale connections.
 * @param {https.Agent} agent - Optional shared agent (for session reuse)
 */
function sapRequest(method, path, body = null, cookies = '', agent = null) {
  return new Promise((resolve, reject) => {
    const config = getSapConfig();
    const fullUrl = `${config.baseUrl}${path}`;
    const parsed = new URL(fullUrl);
    const isHttps = parsed.protocol === 'https:';

    const bodyStr = body ? JSON.stringify(body) : null;

    // Match n8n's minimal header approach — only Content-Type + Cookie
    // Extra headers (Prefer, Accept, B1S-*) can confuse some SAP SL proxies
    const headers = {
      'Content-Type': 'application/json',
    };

    // Only add B1S-ReplaceCollectionsOnPatch for PATCH requests (where it's needed)
    if (method === 'PATCH') {
      headers['B1S-ReplaceCollectionsOnPatch'] = 'true';
    }

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      agent: isHttps ? (agent || createSapAgent()) : new http.Agent({ keepAlive: true }),
      headers,
      rejectUnauthorized: false,
    };

    if (cookies) {
      options.headers.Cookie = cookies;
    }

    if (bodyStr) {
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const transport = isHttps ? https : http;
    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        // Extract Set-Cookie headers for session management
        const setCookies = res.headers['set-cookie'] || [];
        const cookieString = setCookies.map(c => c.split(';')[0]).join('; ');

        let jsonData = null;
        if (data) {
          try {
            jsonData = JSON.parse(data);
          } catch {
            jsonData = { rawText: data };
          }
        }

        if (res.statusCode >= 400) {
          // Log full response for debugging SAP errors
          console.error(`[SAP] HTTP ${res.statusCode} ${method} ${path}:`, data?.substring(0, 500));

          // Extract clean error message — handle HTML responses (502 Proxy Error etc.)
          let errMsg;
          if (jsonData?.error?.message?.value) {
            errMsg = jsonData.error.message.value;
          } else if (jsonData?.error?.message && typeof jsonData.error.message === 'string') {
            errMsg = jsonData.error.message;
          } else if (data?.includes('<html') || data?.includes('<!DOCTYPE')) {
            // SAP proxy returned HTML (502/503) — extract meaningful text
            const titleMatch = data.match(/<title>([^<]+)<\/title>/i);
            errMsg = titleMatch
              ? `SAP Proxy: ${titleMatch[1]} (HTTP ${res.statusCode})`
              : `SAP proxy returned HTTP ${res.statusCode} — Service Layer may be overloaded or crashed`;
          } else {
            errMsg = jsonData?.rawText?.substring(0, 200) || `SAP request failed with status ${res.statusCode}`;
          }

          const error = new Error(errMsg);
          error.status = res.statusCode;
          error.sapError = jsonData?.error || null;
          error.isProxy = res.statusCode === 502 || res.statusCode === 503;
          reject(error);
          return;
        }

        resolve({ data: jsonData, cookies: cookieString || cookies, status: res.statusCode });
      });
    });

    req.on('error', (err) => {
      reject(new Error(`SAP connection error: ${err.message}`));
    });

    // 60 second timeout (BP creation can be slow)
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('SAP request timed out after 60 seconds'));
    });

    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

/**
 * Retry wrapper for transient errors like "socket hang up", "ECONNRESET"
 */
async function sapRequestWithRetry(method, path, body = null, cookies = '', retries = 3, agent = null) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await sapRequest(method, path, body, cookies, agent);
    } catch (err) {
      const isTransient = err.message?.includes('socket hang up') ||
        err.message?.includes('ECONNRESET') ||
        err.message?.includes('EPIPE') ||
        err.message?.includes('ECONNREFUSED') ||
        err.message?.includes('timed out');
      if (isTransient && attempt < retries) {
        const delay = attempt * 1500; // 1.5s, 3s, 4.5s...
        console.warn(`[SAP] Transient error on attempt ${attempt}/${retries}: ${err.message}. Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Login to SAP Service Layer
 * Returns session cookies + a dedicated agent for subsequent requests
 */
export async function sapLogin() {
  const config = getSapConfig();
  // Create a fresh agent for this entire session
  const sessionAgent = createSapAgent();

  const { data, cookies } = await sapRequestWithRetry('POST', '/b1s/v1/Login', {
    CompanyDB: config.companyDb,
    UserName: config.username,
    Password: config.password,
  }, '', 3, sessionAgent);

  if (!cookies && !data?.SessionId) {
    throw new Error('SAP login failed: no session returned');
  }

  console.log('[SAP] Login successful, SessionId:', data?.SessionId);

  return {
    sessionId: data?.SessionId,
    cookies,
    timeout: data?.SessionTimeout || 30,
    agent: sessionAgent, // Pass agent for connection reuse within session
  };
}

/**
 * Logout from SAP Service Layer
 */
export async function sapLogout(cookies, agent = null) {
  try {
    await sapRequest('POST', '/b1s/v1/Logout', null, cookies, agent);
    console.log('[SAP] Logout successful');
  } catch (err) {
    // Logout errors are non-critical — session will expire anyway
    console.warn('[SAP] Logout warning:', err.message);
  }
  // Destroy the session agent to clean up sockets
  if (agent) {
    try { agent.destroy(); } catch { /* ignore */ }
  }
}

/**
 * Upload attachments to SAP B1 via /b1s/v1/Attachments2
 * SAP requires multipart/form-data for file uploads.
 * @param {Array} files - Array of { buffer, fileName, mimeType }
 * @param {string} cookies - Session cookies
 * @param {https.Agent} agent - Session agent for connection reuse
 * @returns {Object} SAP Attachment response with AbsoluteEntry
 */
export async function uploadAttachments(files, cookies, agent = null) {
  if (!files || files.length === 0) {
    throw new Error('No files to upload');
  }

  // Retry up to 2 times for transient errors
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await _doUploadAttachments(files, cookies, agent);
    } catch (err) {
      const isTransient = err.message?.includes('socket hang up') ||
        err.message?.includes('ECONNRESET') ||
        err.message?.includes('EPIPE');
      if (isTransient && attempt < 2) {
        console.warn(`[SAP] Attachment upload transient error on attempt ${attempt}: ${err.message}. Retrying...`);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      throw err;
    }
  }
}

function _doUploadAttachments(files, cookies, agent = null) {
  return new Promise((resolve, reject) => {
    const config = getSapConfig();
    const fullUrl = `${config.baseUrl}/b1s/v1/Attachments2`;
    const parsed = new URL(fullUrl);
    const isHttps = parsed.protocol === 'https:';
    const boundary = `----SAPBoundary${Date.now()}`;

    // Build multipart body
    const parts = [];
    for (const file of files) {
      // Sanitize filename: remove quotes, newlines, non-ASCII
      const safeName = (file.fileName || 'document.pdf')
        .replace(/["\r\n]/g, '')
        .replace(/[^\x20-\x7E]/g, '_');

      const header = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="files"; filename="${safeName}"`,
        `Content-Type: ${file.mimeType || 'application/octet-stream'}`,
        `Content-Transfer-Encoding: binary`,
        '',
        '',
      ].join('\r\n');
      parts.push(Buffer.from(header, 'utf-8'));
      parts.push(file.buffer);
      parts.push(Buffer.from('\r\n', 'utf-8'));
    }
    parts.push(Buffer.from(`--${boundary}--\r\n`, 'utf-8'));

    const bodyBuffer = Buffer.concat(parts);

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname,
      method: 'POST',
      agent: isHttps ? (agent || createSapAgent()) : undefined,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length,
        Accept: 'application/json',
        Cookie: cookies,
      },
      rejectUnauthorized: false,
    };

    const transport = isHttps ? https : http;
    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let jsonData = null;
        if (data) {
          try { jsonData = JSON.parse(data); } catch { jsonData = { rawText: data }; }
        }
        if (res.statusCode >= 400) {
          console.error('[SAP] Attachment upload error response:', data?.substring(0, 500));
          const errMsg = jsonData?.error?.message?.value || jsonData?.error?.message || `Attachment upload failed: ${res.statusCode}`;
          const error = new Error(errMsg);
          error.status = res.statusCode;
          reject(error);
          return;
        }
        console.log('[SAP] Attachment uploaded, AbsoluteEntry:', jsonData?.AbsoluteEntry);
        resolve(jsonData);
      });
    });

    req.on('error', (err) => reject(new Error(`SAP attachment upload error: ${err.message}`)));
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('Attachment upload timed out')); });
    req.write(bodyBuffer);
    req.end();
  });
}

/**
 * Create a Business Partner in SAP B1
 * @param {Object} bpData - SAP Business Partner payload
 * @param {string} cookies - Session cookies from sapLogin
 * @param {https.Agent} agent - Session agent for connection reuse
 * @returns {Object} Created BP data including CardCode
 */
export async function createBusinessPartner(bpData, cookies, agent = null) {
  console.log('[SAP] Creating BP, payload size:', JSON.stringify(bpData).length, 'bytes');
  console.log('[SAP] Creating BP, payload keys:', Object.keys(bpData).join(', '));
  const { data } = await sapRequestWithRetry('POST', '/b1s/v1/BusinessPartners', bpData, cookies, 3, agent);
  console.log('[SAP] Business Partner created:', data?.CardCode);
  return data;
}

/**
 * Update (PATCH) a Business Partner in SAP B1.
 * Used for staged updates — first create minimal BP, then patch in addresses/contacts.
 */
export async function updateBusinessPartner(cardCode, patchData, cookies, agent = null) {
  console.log('[SAP] Patching BP:', cardCode, 'keys:', Object.keys(patchData).join(', '));
  const { data } = await sapRequestWithRetry('PATCH', `/b1s/v1/BusinessPartners('${cardCode}')`, patchData, cookies, 3, agent);
  console.log('[SAP] Business Partner updated:', cardCode);
  return data;
}

/**
 * Get a Business Partner by CardCode
 */
export async function getBusinessPartner(cardCode, cookies, agent = null) {
  const { data } = await sapRequestWithRetry('GET', `/b1s/v1/BusinessPartners('${cardCode}')`, null, cookies, 2, agent);
  return data;
}

/**
 * Check if SAP integration is configured
 */
export function isSapConfigured() {
  return !!(process.env.SAP_BASE_URL && process.env.SAP_COMPANY_DB && process.env.SAP_USERNAME && process.env.SAP_PASSWORD);
}

/**
 * Execute a full SAP operation with auto login/logout.
 * Creates a dedicated HTTPS agent per session for connection isolation.
 * Handles session lifecycle automatically.
 */
export async function withSapSession(operation) {
  const session = await sapLogin();
  try {
    const result = await operation(session.cookies, session.agent);
    return result;
  } finally {
    await sapLogout(session.cookies, session.agent);
  }
}
