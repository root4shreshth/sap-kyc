import './globals.css';

export const metadata = {
  title: 'Al Amir Operations',
  description: 'Internal Operations Platform - AL AMIR GROUP HOLDING COMPANY.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
