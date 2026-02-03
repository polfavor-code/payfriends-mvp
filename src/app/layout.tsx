import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PayFriends — Loans Between Friends',
  description: 'Create simple loan agreements between friends and family. Track payments, manage repayment schedules, and keep relationships healthy.',
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-pf-bg text-pf-text min-h-screen">
        {children}
      </body>
    </html>
  );
}
