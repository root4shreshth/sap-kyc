/**
 * SAP B1 Service Layer Client
 * Handles authentication, session management, and API calls to SAP Business One.
 * Uses cookie-based session auth (B1SESSION + ROUTEID).
 * Uses native https module (not fetch) to support self-signed SSL certs on on-prem SAP.
 *
 * KEY FIX: POST /BusinessPartners uses a FRESH HTTPS agent (separate TCP connection)
 * to avoid 502 Proxy Error caused by SAP's Apache mod_proxy rejecting reused sockets.
 * n8n works because it creates independent connections per request — we now do the same.
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

// Configurable delay after login before first API call (ms).
// Gives SAP SL session time to stabilize. Default 500ms.
const SAP_POST_LOGIN_DELAY_MS = parseInt(process.env.SAP_POST_LOGIN_DELAY_MS || '500', 10);

function getSapConfig() {
  return {
    baseUrl: process.env.SAP_BASE_URL || '',
    companyDb: process.env.SAP_COMPANY_DB || '',
    username: process.env.SAP_USERNAME || '',
    password: process.env.SAP_PASSWORD || '',
  };
}

/**
 * Create an HTTPS agent for SAP connections.
 * @param {Object} opts - Options to override defaults
 * @param {boolean} opts.keepAlive - Whether to keep connections alive (default: true)
 * @param {number} opts.maxSockets - Max concurrent sockets (default: 3)
 */
export function createSapAgent(opts = {}) {
  return new https.Agent({
    rejectUnauthorized: false,   // Allow self-signed certs (on-prem SAP)
    keepAlive: opts.keepAlive !== undefined ? opts.keepAlive : true,
    keepAliveMsecs: 10000,
    maxSockets: opts.maxSockets || 3,
    // Allow ALL TLS versions for on-prem SAP servers
    minVersion: 'TLSv1',
    secureOptions: cryptoConstants?.SSL_OP_LEGACY_SERVER_CONNECT || 0,
  });
}

/**
 * Create a fresh HTTPS agent specifically for POST requests.
 * Uses keepAlive:false to force a new TCP connection per request.
 * This avoids the 502 Proxy Error caused by SAP's Apache mod_proxy
 * rejecting POST requests that reuse the login socket.
 */
export function createPostAgent() {
  return new https.Agent({
    rejectUnauthorized: false,
    keepAlive: false,    // Force fresh TCP connection per request
    maxSockets: 1,       // Single socket, no pooling
    minVersion: 'TLSv1',
    secureOptions: cryptoConstants?.SSL_OP_LEGACY_SERVER_CONNECT || 0,
  });
}

/**
 * Make an HTTPS request to SAP Service Layer using native https module.
 * @param {string} method - HTTP method
 * @param {string} path - API path (e.g., /b1s/v1/BusinessPartners)
 * @param {Object|null} body - Request body (will be JSON.stringify'd)
 * @param {string} cookies - Session cookies
 * @param {https.Agent|null} agent - HTTPS agent (default: creates new one)
 * @param {Object} extraHeaders - Additional headers to merge
 * @param {string|null} portOverride - Override port number (for alternate port strategy)
 */
function sapRequest(method, path, body = null, cookies = '', agent = null, extraHeaders = {}, portOverride = null) {
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
      ...extraHeaders,
    };

    // Only add B1S-ReplaceCollectionsOnPatch for PATCH requests (where it's needed)
    if (method === 'PATCH') {
      headers['B1S-ReplaceCollectionsOnPatch'] = 'true';
    }

    const options = {
      hostname: parsed.hostname,
      port: portOverride || parsed.port || (isHttps ? 443 : 80),
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
 * Raw single-request function for diagnostic purposes.
 * No retry, no agent management — caller controls everything.
 */
export async function sapRequestRaw(method, path, body, cookies, agent, extraHeaders = {}, portOverride = null) {
  return sapRequest(method, path, body, cookies, agent, extraHeaders, portOverride);
}

/**
 * Retry wrapper for transient errors like "socket hang up", "ECONNRESET", 502 Proxy.
 * On 502/proxy errors, creates a fresh agent for each retry to avoid stale sockets.
 */
async function sapRequestWithRetry(method, path, body = null, cookies = '', retries = 3, agent = null, extraHeaders = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await sapRequest(method, path, body, cookies, agent, extraHeaders);
    } catch (err) {
      const isTransient = err.message?.includes('socket hang up') ||
        err.message?.includes('ECONNRESET') ||
        err.message?.includes('EPIPE') ||
        err.message?.includes('ECONNREFUSED') ||
        err.message?.includes('timed out') ||
        err.isProxy;  // 502/503 are also transient — retry with fresh connection
      if (isTransient && attempt < retries) {
        const delay = attempt * 2000; // 2s, 4s, 6s...
        console.warn(`[SAP] Transient error on attempt ${attempt}/${retries}: ${err.message}. Retrying in ${delay}ms with fresh connection...`);
        // Create a fresh agent for the retry to avoid reusing broken sockets
        if (agent && err.isProxy) {
          try { agent.destroy(); } catch { /* ignore */ }
          agent = createPostAgent(); // Fresh TCP connection
        }
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
  // Create a fresh agent for login
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
    agent: sessionAgent, // Pass agent for GET/PATCH reuse within session
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
 * Create a placeholder attachment in SAP.
 * SAP B1 may require an AttachmentEntry on every Business Partner.
 * When no real documents exist, this uploads a tiny text file to satisfy the requirement.
 * @param {string} cookies - Session cookies
 * @param {https.Agent|null} agent - HTTPS agent (a fresh postAgent is recommended)
 * @returns {number} AbsoluteEntry of the created attachment
 */
export async function createPlaceholderAttachment(cookies, agent = null) {
  const timestamp = new Date().toISOString();
  const content = `KYC Business Partner placeholder attachment.\nCreated: ${timestamp}\nThis file was auto-generated to satisfy SAP attachment requirements.`;
  const buffer = Buffer.from(content, 'utf-8');

  const result = await _doUploadAttachments(
    [{ buffer, fileName: 'kyc-placeholder.txt', mimeType: 'text/plain' }],
    cookies,
    agent
  );

  if (!result?.AbsoluteEntry) {
    throw new Error('Placeholder attachment created but no AbsoluteEntry returned');
  }
  return result.AbsoluteEntry;
}

/**
 * Create a Business Partner in SAP B1.
 *
 * CRITICAL FIX: Uses a FRESH HTTPS agent (new TCP connection) instead of the
 * login session agent. SAP's Apache proxy returns 502 when POST /BusinessPartners
 * reuses the login socket. n8n avoids this by using independent connections per call.
 *
 * Falls back through multiple strategies if the first attempt fails with 502:
 * 1. Fresh agent + Connection: close (3 retries)
 * 2. Fresh agent + ?$select=CardCode (lighter response)
 * 3. Fresh agent + alternate port (50001/50000)
 *
 * @param {Object} bpData - SAP Business Partner payload
 * @param {string} cookies - Session cookies from sapLogin
 * @param {https.Agent} agent - Session agent (NOT used for POST — uses fresh agent instead)
 * @returns {Object} Created BP data including CardCode
 */
export async function createBusinessPartner(bpData, cookies, agent = null) {
  console.log('[SAP] Creating BP, payload size:', JSON.stringify(bpData).length, 'bytes');
  console.log('[SAP] Creating BP, payload keys:', Object.keys(bpData).join(', '));

  // ====== ATTEMPT 1: Fresh agent + Connection: close (primary fix) ======
  const postAgent1 = createPostAgent();
  try {
    const { data } = await sapRequestWithRetry(
      'POST', '/b1s/v1/BusinessPartners', bpData, cookies, 3, postAgent1,
      { 'Connection': 'close' }
    );
    console.log('[SAP] Business Partner created (fresh agent):', data?.CardCode);
    return data;
  } catch (err1) {
    console.warn('[SAP] Attempt 1 (fresh agent) failed:', err1.message);
    try { postAgent1.destroy(); } catch { /* ignore */ }

    // Only try fallbacks for proxy/transport errors, not business logic errors
    if (!err1.isProxy && !err1.message?.includes('socket') && !err1.message?.includes('timed out')) {
      throw err1; // Business logic error (e.g., duplicate CardCode) — don't retry
    }

    // ====== ATTEMPT 2: Fresh agent + $select=CardCode (lighter response) ======
    console.log('[SAP] Trying fallback: POST with ?$select=CardCode');
    const postAgent2 = createPostAgent();
    try {
      const { data } = await sapRequest(
        'POST', '/b1s/v1/BusinessPartners?$select=CardCode', bpData, cookies, postAgent2,
        { 'Connection': 'close' }
      );
      console.log('[SAP] Business Partner created ($select fallback):', data?.CardCode);
      return data;
    } catch (err2) {
      console.warn('[SAP] Attempt 2 ($select) failed:', err2.message);
      try { postAgent2.destroy(); } catch { /* ignore */ }

      if (!err2.isProxy && !err2.message?.includes('socket') && !err2.message?.includes('timed out')) {
        throw err2;
      }
    }

    // ====== ATTEMPT 3: Fresh agent + alternate port ======
    const config = getSapConfig();
    const currentPort = new URL(config.baseUrl).port || '50000';
    const altPort = currentPort === '50000' ? '50001' : '50000';
    console.log(`[SAP] Trying fallback: alternate port ${altPort}`);
    const postAgent3 = createPostAgent();
    try {
      const { data } = await sapRequest(
        'POST', '/b1s/v1/BusinessPartners', bpData, cookies, postAgent3,
        { 'Connection': 'close' }, altPort
      );
      console.log(`[SAP] Business Partner created (alt port ${altPort}):`, data?.CardCode);
      return data;
    } catch (err3) {
      console.warn(`[SAP] Attempt 3 (alt port ${altPort}) failed:`, err3.message);
      try { postAgent3.destroy(); } catch { /* ignore */ }
    }

    // All strategies exhausted — throw the original error with context
    err1.message = `All BP creation strategies failed. Last error: ${err1.message}. Tried: fresh agent, $select, alt port ${altPort}.`;
    throw err1;
  }
}

/**
 * Update (PATCH) a Business Partner in SAP B1.
 * Used for staged updates — first create minimal BP, then patch in addresses/contacts.
 * PATCH uses the session agent (not a fresh one) since it works fine on reused sockets.
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
 * Adds a brief post-login delay for SAP SL session stabilization.
 */
export async function withSapSession(operation) {
  const session = await sapLogin();
  try {
    // Brief delay after login for SAP SL session to stabilize
    if (SAP_POST_LOGIN_DELAY_MS > 0) {
      console.log(`[SAP] Post-login delay: ${SAP_POST_LOGIN_DELAY_MS}ms`);
      await new Promise(r => setTimeout(r, SAP_POST_LOGIN_DELAY_MS));
    }
    const result = await operation(session.cookies, session.agent);
    return result;
  } finally {
    await sapLogout(session.cookies, session.agent);
  }
}
