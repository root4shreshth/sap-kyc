'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/components/AuthProvider';
import { authApi } from '@/lib/api-client';

function LoginForm() {
  const { user, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    router.push('/dashboard');
    return null;
  }

  async function doLogin(em, pw) {
    setError('');
    setLoading(true);
    try {
      const data = await authApi.login(em, pw);
      login(data.token, { email: data.email, role: data.role });
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    doLogin(email, password);
  }

  function handleDemoLogin(role) {
    if (role === 'admin') {
      setEmail('admin@demo.com');
      setPassword('admin123');
      doLogin('admin@demo.com', 'admin123');
    } else {
      setEmail('kyc@demo.com');
      setPassword('kyc123');
      doLogin('kyc@demo.com', 'kyc123');
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--gray-100)',
    }}>
      <div className="card" style={{ width: 400, maxWidth: '90%' }}>
        <h2 style={{ marginBottom: 4, color: 'var(--navy)' }}>Internal Login</h2>
        <p style={{ color: 'var(--gray-500)', fontSize: 14, marginBottom: 24 }}>
          Alamir Operations Platform
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--gray-200)' }}>
          <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 12, textAlign: 'center' }}>
            Quick Demo Login
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => handleDemoLogin('admin')}
              disabled={loading}
              className="btn btn-secondary"
              style={{ flex: 1, justifyContent: 'center', fontSize: 13 }}
            >
              Admin Demo
            </button>
            <button
              onClick={() => handleDemoLogin('kyc')}
              disabled={loading}
              className="btn btn-secondary"
              style={{ flex: 1, justifyContent: 'center', fontSize: 13 }}
            >
              KYC Team Demo
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 8, textAlign: 'center' }}>
            admin@demo.com / admin123 &nbsp;&bull;&nbsp; kyc@demo.com / kyc123
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );
}
