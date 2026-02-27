'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/kyc', label: 'KYC Requests', icon: '📋' },
  { href: '/kyc/new', label: 'New KYC', icon: '➕', adminOnly: true },
];

const COMING_SOON = [
  { label: 'Vendor Management', icon: '🏢' },
  { label: 'Document Vault', icon: '🗂️' },
  { label: 'Reports & Analytics', icon: '📈' },
  { label: 'Settings', icon: '⚙️' },
];

export default function Sidebar({ user, onLogout }) {
  const pathname = usePathname();

  return (
    <aside style={{
      width: 240,
      minHeight: '100vh',
      background: 'var(--navy)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Brand */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Link href="/dashboard" style={{ color: 'white', fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo.png" alt="Alamir" style={{ height: 28, borderRadius: 4 }} onError={(e) => { e.target.style.display = 'none'; }} />
          Alamir Ops
        </Link>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 8px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.4)', padding: '8px 12px', textTransform: 'uppercase', letterSpacing: 1 }}>
          Main
        </div>
        {NAV_ITEMS.map((item) => {
          if (item.adminOnly && user?.role !== 'Admin') return null;
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: active ? 600 : 400,
                color: active ? 'white' : 'rgba(255,255,255,0.65)',
                background: active ? 'rgba(37, 99, 235, 0.3)' : 'transparent',
                marginBottom: 2,
                transition: 'all 0.15s ease',
                textDecoration: 'none',
              }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}

        <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.4)', padding: '16px 12px 8px', textTransform: 'uppercase', letterSpacing: 1 }}>
          Coming Soon
        </div>
        {COMING_SOON.map((item) => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 6,
              fontSize: 14,
              color: 'rgba(255,255,255,0.3)',
              marginBottom: 2,
              cursor: 'default',
            }}
          >
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            {item.label}
          </div>
        ))}
      </nav>

      {/* User info + logout */}
      <div style={{
        padding: '16px 12px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4, padding: '0 4px' }}>
          {user?.email}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 10, padding: '0 4px' }}>
          {user?.role}
        </div>
        <button
          onClick={onLogout}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6,
            background: 'transparent',
            color: 'rgba(255,255,255,0.6)',
            fontSize: 13,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
