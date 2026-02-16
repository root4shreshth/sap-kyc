import './globals.css';

export const metadata = {
  title: 'Alamir Operations',
  description: 'Internal Operations Platform - Alamir International Trading L.L.C',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
