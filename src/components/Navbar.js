'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Navbar({ user, onLogout }) {
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem('token');
    if (onLogout) onLogout();
    router.push('/');
  }

  return (
    <nav style={{
      background: 'var(--navy)',
      color: 'white',
      padding: '0 24px',
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <Link href="/dashboard" style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>
        Al Amir Ops
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 14 }}>
        <Link href="/dashboard" style={{ color: '#cbd5e1' }}>Dashboard</Link>
        <Link href="/kyc" style={{ color: '#cbd5e1' }}>KYC Requests</Link>
        {user?.role === 'Admin' && (
          <Link href="/kyc/new" style={{ color: '#cbd5e1' }}>New KYC</Link>
        )}
        <span style={{ color: '#94a3b8' }}>{user?.email} ({user?.role})</span>
        <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: 13 }}>
          Logout
        </button>
      </div>
    </nav>
  );
}
