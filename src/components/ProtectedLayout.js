'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import Sidebar from './Sidebar';

export default function ProtectedLayout({ children, roles }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>Loading...</div>;
  }

  if (!user) return null;

  if (roles && !roles.includes(user.role)) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar user={user} onLogout={logout} />
        <main style={{ flex: 1, overflow: 'auto' }}>
          <div className="container" style={{ paddingTop: 40, textAlign: 'center' }}>
            <p className="error-msg">You do not have access to this page.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar user={user} onLogout={logout} />
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--gray-50)' }}>
        {children}
      </main>
    </div>
  );
}
