'use client';

import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto py-6 text-center text-pf-muted text-sm border-t border-pf-card-border">
      <div className="container-pf">
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-4">
          <Link href="/features" className="hover:text-pf-text transition-colors">
            Features
          </Link>
          <Link href="/faq" className="hover:text-pf-text transition-colors">
            FAQ
          </Link>
          <Link href="/legal/terms" className="hover:text-pf-text transition-colors">
            Terms
          </Link>
          <Link href="/legal/privacy" className="hover:text-pf-text transition-colors">
            Privacy
          </Link>
          <Link href="/legal/about" className="hover:text-pf-text transition-colors">
            About
          </Link>
        </div>
        <p className="text-pf-muted/70">
          © {currentYear} PayFriends. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
