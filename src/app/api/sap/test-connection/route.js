import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  sapLogin, sapLogout, isSapConfigured, withSapSession,
  createBusinessPartner, getBusinessPartner,
  createSapAgent, createPostAgent, sapRequestRaw,
} from '@/lib/sap-client';

export async function POST(request) {
  const { error } = requireAuth(request, ['Admin']);
  if (error) return error;

  if (!isSapConfigured()) {
    return NextResponse.json({
      success: false,
      error: 'SAP is not configured. Add SAP_BASE_URL, SAP_COMPANY_DB, SAP_USERNAME, SAP_PASSWORD to environment variables.',
    });
  }

  // Check if deep test is requested
  const url = new URL(request.url);
  const deepTest = url.searchParams.get('deep') === 'true';

  const startTime = Date.now();

  try {
    if (!deepTest) {
      // ====== STANDARD TEST: Login + Logout only ======
      const session = await sapLogin();
      const loginTime = Date.now() - startTime;
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
    }

    // ====== DEEP TEST: Multi-strategy BP creation diagnostic ======
    // Tests Login → GET BP → 6 POST strategies → report results
    const testCardCode = `ZTEST${Date.now().toString().slice(-6)}`;
    const testPayload = { CardCode: testCardCode, CardName: 'API Deep Test - Delete Me', CardType: 'cCustomer' };
    const testPayloadNoType = { CardCode: testCardCode, CardName: 'API Deep Test - Delete Me' };

    const results = {
      login: null,
      getBP: null,
    };

    // Step 1: Login
    let session;
    try {
      session = await sapLogin();
      results.login = { status: 'success', sessionId: session.sessionId, durationMs: Date.now() - startTime };
    } catch (loginErr) {
      return NextResponse.json({
        success: false,
        deepTest: true,
        results: { login: { status: 'failed', error: loginErr.message } },
        error: `Login failed: ${loginErr.message}`,
        totalTimeMs: Date.now() - startTime,
      });
    }

    const { cookies, agent: loginAgent } = session;

    // Step 2: GET existing BP to verify read access
    const getBPStart = Date.now();
    try {
      const bpData = await getBusinessPartner('V00001', cookies, loginAgent);
      results.getBP = {
        status: 'success',
        cardCode: bpData?.CardCode || 'V00001',
        cardName: bpData?.CardName || '',
        durationMs: Date.now() - getBPStart,
      };
    } catch (getErr) {
      results.getBP = {
        status: 'failed',
        error: getErr.message,
        durationMs: Date.now() - getBPStart,
      };
    }

    // Step 3: Post-login delay
    await new Promise(r => setTimeout(r, 500));

    // Step 4: Test 6 connection strategies for POST /BusinessPartners
    const config = {
      baseUrl: process.env.SAP_BASE_URL || '',
    };
    const currentPort = (() => {
      try { return new URL(config.baseUrl).port || '50000'; } catch { return '50000'; }
    })();
    const altPort = currentPort === '50000' ? '50001' : '50000';

    const strategies = [
      {
        name: 'shared_agent',
        label: 'Reuse login agent (baseline — expected to fail)',
        run: async () => {
          const { data } = await sapRequestRaw('POST', '/b1s/v1/BusinessPartners', testPayload, cookies, loginAgent);
          return data;
        },
      },
      {
        name: 'fresh_agent',
        label: 'Fresh TCP connection (keepAlive: false)',
        run: async () => {
          const freshAgent = createPostAgent();
          try {
            const { data } = await sapRequestRaw('POST', '/b1s/v1/BusinessPartners', testPayload, cookies, freshAgent, { 'Connection': 'close' });
            return data;
          } finally {
            try { freshAgent.destroy(); } catch { /* ignore */ }
          }
        },
      },
      {
        name: 'connection_close',
        label: 'Login agent + Connection: close header',
        run: async () => {
          const { data } = await sapRequestRaw('POST', '/b1s/v1/BusinessPartners', testPayload, cookies, loginAgent, { 'Connection': 'close' });
          return data;
        },
      },
      {
        name: 'post_delay',
        label: '2s delay after login before POST',
        run: async () => {
          await new Promise(r => setTimeout(r, 2000));
          const delayAgent = createPostAgent();
          try {
            const { data } = await sapRequestRaw('POST', '/b1s/v1/BusinessPartners', testPayload, cookies, delayAgent, { 'Connection': 'close' });
            return data;
          } finally {
            try { delayAgent.destroy(); } catch { /* ignore */ }
          }
        },
      },
      {
        name: 'alt_port',
        label: `Alternate port (${altPort})`,
        run: async () => {
          const altAgent = createPostAgent();
          try {
            const { data } = await sapRequestRaw('POST', '/b1s/v1/BusinessPartners', testPayload, cookies, altAgent, { 'Connection': 'close' }, altPort);
            return data;
          } finally {
            try { altAgent.destroy(); } catch { /* ignore */ }
          }
        },
      },
      {
        name: 'no_card_type',
        label: 'Without CardType field',
        run: async () => {
          const noTypeAgent = createPostAgent();
          try {
            const { data } = await sapRequestRaw('POST', '/b1s/v1/BusinessPartners', testPayloadNoType, cookies, noTypeAgent, { 'Connection': 'close' });
            return data;
          } finally {
            try { noTypeAgent.destroy(); } catch { /* ignore */ }
          }
        },
      },
    ];

    const strategyResults = {};
    let workingStrategy = null;
    let createdCardCode = null;

    for (const strategy of strategies) {
      // If a previous strategy succeeded and created a BP, subsequent strategies
      // would fail with "duplicate CardCode" — so we skip them.
      if (workingStrategy) {
        strategyResults[strategy.name] = {
          status: 'skipped',
          reason: `Previous strategy "${workingStrategy}" succeeded`,
        };
        continue;
      }

      const stratStart = Date.now();
      try {
        console.log(`[SAP Deep Test] Trying strategy: ${strategy.name} — ${strategy.label}`);
        const data = await strategy.run();
        const durationMs = Date.now() - stratStart;
        strategyResults[strategy.name] = {
          status: 'success',
          cardCode: data?.CardCode || testCardCode,
          durationMs,
        };
        workingStrategy = strategy.name;
        createdCardCode = data?.CardCode || testCardCode;
        console.log(`[SAP Deep Test] Strategy "${strategy.name}" SUCCEEDED in ${durationMs}ms`);
      } catch (stratErr) {
        const durationMs = Date.now() - stratStart;
        const errMsg = stratErr.message || 'Unknown error';
        strategyResults[strategy.name] = {
          status: 'failed',
          error: errMsg.substring(0, 200),
          isProxy: !!stratErr.isProxy,
          httpStatus: stratErr.status,
          durationMs,
        };
        console.log(`[SAP Deep Test] Strategy "${strategy.name}" FAILED in ${durationMs}ms: ${errMsg.substring(0, 100)}`);

        // If error is NOT a proxy/transport error (e.g., auth error, duplicate key),
        // all strategies will fail the same way — stop early.
        if (!stratErr.isProxy && !errMsg.includes('socket') && !errMsg.includes('timed out') && !errMsg.includes('ECONNR')) {
          // Mark remaining as skipped with reason
          const idx = strategies.indexOf(strategy);
          for (let i = idx + 1; i < strategies.length; i++) {
            strategyResults[strategies[i].name] = {
              status: 'skipped',
              reason: `Business logic error: ${errMsg.substring(0, 100)}`,
            };
          }
          break;
        }
      }
    }

    // Logout
    await sapLogout(cookies, loginAgent);
    const totalTime = Date.now() - startTime;

    // Build recommendation
    let recommendation = '';
    if (workingStrategy === 'shared_agent') {
      recommendation = 'Standard connection works. No changes needed.';
    } else if (workingStrategy === 'fresh_agent') {
      recommendation = 'Use fresh TCP connections for POST requests (keepAlive: false). This is already the default fix applied in the code.';
    } else if (workingStrategy === 'connection_close') {
      recommendation = 'Adding Connection: close header fixes the issue. The code already includes this.';
    } else if (workingStrategy === 'post_delay') {
      recommendation = 'A delay after login fixes the issue. Set SAP_POST_LOGIN_DELAY_MS=2000 in environment.';
    } else if (workingStrategy === 'alt_port') {
      recommendation = `Port ${altPort} works. Update SAP_BASE_URL to use port ${altPort} instead of ${currentPort}.`;
    } else if (workingStrategy === 'no_card_type') {
      recommendation = 'Omitting CardType fixes the issue. The mapping code should be updated.';
    } else {
      recommendation = 'All strategies failed. Check the SAP Server-Side Checklist below.';
    }

    // SAP server-side checklist (included when all strategies fail)
    const sapChecklist = !workingStrategy ? {
      title: 'SAP Server-Side Checklist — Please verify these on the SAP server',
      items: [
        {
          id: 'auth',
          priority: 'HIGH',
          label: "User 'manager' has BP creation authorization",
          how: "In SAP B1 client → Administration → System Initialization → Authorizations → General Authorizations. Check that 'manager' has Full Authorization on Business Partners → Add.",
        },
        {
          id: 'udfs',
          priority: 'HIGH',
          label: 'No mandatory User-Defined Fields on Business Partners',
          how: "In SAP B1 client → Tools → Customization Tools → User-Defined Fields → Business Partners. Check for any fields marked 'Mandatory'. If found, they must be included in the API payload.",
        },
        {
          id: 'series',
          priority: 'HIGH',
          label: 'BP numbering series allows manual CardCode',
          how: "In SAP B1 client → Administration → System Initialization → Document Numbering. Check Business Partners section. If 'Manual' is not allowed, the API must send a valid Series number instead of CardCode.",
        },
        {
          id: 'sl_logs',
          priority: 'HIGH',
          label: 'Check Service Layer log files for crash details',
          how: "On the SAP server → C:\\Program Files\\SAP\\SAP Business One\\ServiceLayer\\logs\\ (or equivalent). Look at the most recent .log files for errors around the time of the failed POST.",
        },
        {
          id: 'sl_restart',
          priority: 'MEDIUM',
          label: 'Restart SAP Service Layer service',
          how: "On the SAP server → Windows Services → SAP Business One Service Layer. Stop and restart. This often resolves 502 errors caused by SL memory leaks or hung threads.",
        },
        {
          id: 'proxy_timeout',
          priority: 'MEDIUM',
          label: 'Apache proxy timeout configuration',
          how: "On the SAP server → Edit httpd.conf (in the SL directory). Look for ProxyTimeout or Timeout directives. Increase to at least 120 seconds. Restart Apache.",
        },
        {
          id: 'firewall',
          priority: 'MEDIUM',
          label: 'No firewall blocking POST requests',
          how: "Some firewalls/WAFs selectively block or timeout POST requests while allowing GET. Check if there is a firewall between this app and SAP at 192.168.1.235.",
        },
        {
          id: 'proxy_buffer',
          priority: 'LOW',
          label: 'Apache proxy buffer size',
          how: "In httpd.conf, add or increase: ProxyIOBufferSize 131072. Prevents large POST bodies from being rejected.",
        },
      ],
    } : null;

    return NextResponse.json({
      success: !!workingStrategy,
      deepTest: true,
      testCardCode,
      createdCardCode,
      results,
      strategies: strategyResults,
      workingStrategy,
      recommendation,
      sapChecklist,
      totalTimeMs: totalTime,
      message: workingStrategy
        ? `Deep test passed! Strategy "${workingStrategy}" works. BP ${createdCardCode || testCardCode} created in ${totalTime}ms.`
        : `Deep test failed — all 6 strategies returned errors. Check SAP server configuration. (${totalTime}ms)`,
    });
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.error('SAP connection test failed:', err.message);

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
