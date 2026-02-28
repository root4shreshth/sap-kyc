'use client';
import { useState, useRef, useEffect } from 'react';
import COUNTRY_CODES from '@/lib/country-codes';

export default function PhoneInput({ countryCode, phone, onCountryCodeChange, onPhoneChange, style }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  const selected = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0];

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = COUNTRY_CODES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.includes(search) ||
    c.country.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} style={{ display: 'flex', gap: 0, position: 'relative', ...style }}>
      {/* Country code selector */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '10px 8px 10px 12px', border: '1px solid var(--gray-200)',
          borderRight: 'none', borderRadius: 'var(--radius) 0 0 var(--radius)',
          background: 'var(--gray-50)', cursor: 'pointer', fontSize: 14,
          whiteSpace: 'nowrap', minWidth: 90,
        }}
      >
        <span>{selected.flag}</span>
        <span style={{ fontSize: 13 }}>{selected.code}</span>
        <span style={{ fontSize: 10, marginLeft: 2 }}>&#x25BC;</span>
      </button>

      {/* Phone input */}
      <input
        type="tel"
        value={phone}
        onChange={e => onPhoneChange(e.target.value.replace(/[^0-9\s\-]/g, ''))}
        placeholder="Phone number"
        style={{
          flex: 1, padding: '10px 12px', border: '1px solid var(--gray-200)',
          borderRadius: '0 var(--radius) var(--radius) 0', fontSize: 14,
          outline: 'none', minWidth: 0,
        }}
      />

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 100,
          background: 'white', border: '1px solid var(--gray-200)',
          borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          width: 280, maxHeight: 300, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search country..."
            style={{
              padding: '10px 12px', border: 'none', borderBottom: '1px solid var(--gray-200)',
              fontSize: 13, outline: 'none',
            }}
          />
          <div style={{ overflow: 'auto', flex: 1 }}>
            {filtered.map(c => (
              <button
                key={c.country}
                type="button"
                onClick={() => { onCountryCodeChange(c.code); setOpen(false); setSearch(''); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '8px 12px', border: 'none',
                  background: c.code === countryCode ? '#eff6ff' : 'transparent',
                  cursor: 'pointer', fontSize: 13, textAlign: 'left',
                }}
              >
                <span>{c.flag}</span>
                <span style={{ flex: 1 }}>{c.name}</span>
                <span style={{ color: 'var(--gray-400)' }}>{c.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
