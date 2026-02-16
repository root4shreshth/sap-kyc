'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import Navbar from './Navbar';

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
      <>
        <Navbar user={user} onLogout={logout} />
        <div className="container" style={{ paddingTop: 40, textAlign: 'center' }}>
          <p className="error-msg">You do not have access to this page.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar user={user} onLogout={logout} />
      {children}
    </>
  );
}
