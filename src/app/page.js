import Link from 'next/link';

export default function Landing() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#fafbfc' }}>
      {/* Navigation */}
      <header style={{
        background: 'white',
        borderBottom: '1px solid #e2e8f0',
        padding: '0 32px',
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo.png" alt="Al-Amir" style={{ height: 42 }} />
          <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', lineHeight: 1.2 }}>Alamir International</div>
            <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.2 }}>Trading L.L.C</div>
          </div>
        </div>
        <Link href="/login" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 20px',
          background: '#0f172a',
          color: 'white',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          textDecoration: 'none',
          transition: 'background 0.2s',
        }}>
          Staff Login
        </Link>
      </header>

      {/* Hero */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 24px',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 680 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 16px',
            background: '#dbeafe',
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 500,
            color: '#1e40af',
            marginBottom: 24,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563eb' }}></span>
            Internal Operations Platform
          </div>

          <h1 style={{
            fontSize: 44,
            fontWeight: 800,
            color: '#0f172a',
            lineHeight: 1.15,
            marginBottom: 16,
            letterSpacing: '-0.02em',
          }}>
            Client Onboarding &amp;<br />
            <span style={{ color: '#2563eb' }}>KYC Compliance</span>
          </h1>

          <p style={{
            fontSize: 17,
            color: '#64748b',
            lineHeight: 1.7,
            marginBottom: 40,
            maxWidth: 520,
            margin: '0 auto 40px',
          }}>
            Streamlined KYC verification, document management, and compliance
            tracking for Alamir International Trading L.L.C — Food Import &amp; Export.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '14px 32px',
              background: '#2563eb',
              color: 'white',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
              transition: 'all 0.2s',
            }}>
              Access Dashboard &rarr;
            </Link>
          </div>
        </div>

        {/* Feature Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 20,
          maxWidth: 760,
          width: '100%',
          marginTop: 64,
        }}>
          {[
            {
              icon: '\uD83D\uDCCB',
              title: 'KYC Requests',
              desc: 'Create and track client onboarding with secure portal links',
            },
            {
              icon: '\uD83D\uDCC4',
              title: 'Form Collection',
              desc: '8-section application form with auto-save and draft support',
            },
            {
              icon: '\uD83D\uDD12',
              title: 'Compliance',
              desc: 'Regulatory checks, banking verification, and audit trails',
            },
            {
              icon: '\uD83D\uDCC8',
              title: 'PDF Reports',
              desc: 'Branded PDF export of all KYC/KYS data for records',
            },
          ].map((f, i) => (
            <div key={i} style={{
              background: 'white',
              borderRadius: 12,
              padding: '24px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              border: '1px solid #f1f5f9',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '24px 20px',
        borderTop: '1px solid #e2e8f0',
        background: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          <img src="/logo.png" alt="Al-Amir" style={{ height: 24 }} />
          <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>Alamir International Trading L.L.C</span>
        </div>
        <p style={{ fontSize: 12, color: '#94a3b8' }}>
          Ajman Free Zone, United Arab Emirates &nbsp;|&nbsp; alamir.ae &nbsp;|&nbsp; Internal Use Only
        </p>
      </footer>
    </div>
  );
}
