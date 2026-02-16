import Link from 'next/link';

export default function Landing() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: 'var(--navy)',
        color: 'white',
        padding: '0 24px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 700, fontSize: 18 }}>Alamir International Trading</span>
        <Link href="/login" className="btn btn-primary" style={{ fontSize: 13 }}>
          Internal Login
        </Link>
      </header>

      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 40,
      }}>
        <div style={{ maxWidth: 600 }}>
          <h1 style={{ fontSize: 40, fontWeight: 700, color: 'var(--navy)', marginBottom: 16 }}>
            Operations Platform
          </h1>
          <p style={{ fontSize: 18, color: 'var(--gray-500)', marginBottom: 32, lineHeight: 1.7 }}>
            Internal operations management for Alamir International Trading L.L.C.
            KYC verification, compliance, and client onboarding.
          </p>
          <Link href="/login" className="btn btn-primary" style={{ padding: '14px 32px', fontSize: 16 }}>
            Internal Login
          </Link>
        </div>
      </main>

      <footer style={{
        textAlign: 'center',
        padding: 24,
        color: 'var(--gray-400)',
        fontSize: 13,
        borderTop: '1px solid var(--gray-200)',
      }}>
        Alamir International Trading L.L.C. — Internal Use Only
      </footer>
    </div>
  );
}
