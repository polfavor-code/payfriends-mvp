import Link from 'next/link';

export default function LegalPage() {
  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-[28px] font-semibold m-0">Legal &amp; About</h1>
        <Link href="/dashboard" className="text-pf-accent text-sm hover:underline">
          ← Back to dashboard
        </Link>
      </div>

      {/* About section */}
      <div className="bg-pf-card border border-pf-card-border rounded-2xl p-6 mb-4">
        <h2 className="text-lg font-semibold mb-4 text-pf-text">About PayFriends</h2>
        <p className="text-pf-muted text-sm leading-relaxed mb-5">
          PayFriends is a simple, private tool that helps you set up and track personal loans between friends and family.
          It helps users create clear agreements, repayment schedules and friendly reminders so everyone knows where they stand.
        </p>
        <p className="text-pf-muted text-sm leading-relaxed">
          PayFriends is not a bank, lender or financial institution. We do not hold money, process payments, extend credit
          or give financial, legal or tax advice. All loans and repayments happen directly between users, outside our platform.
          The app only supports record keeping, transparency and communication.
        </p>
      </div>

      {/* Legal documents section */}
      <div className="bg-pf-card border border-pf-card-border rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4 text-pf-text">Legal Documents</h2>
        <p className="text-pf-muted text-sm leading-relaxed mb-5">
          Please review our legal documents to understand how PayFriends works and how we protect your information.
        </p>

        <div className="text-pf-muted text-sm leading-8">
          <div>
            <Link href="/legal/terms" className="text-pf-accent no-underline hover:underline">
              Terms of Service
            </Link>
            {' — Learn what PayFriends does and your responsibilities'}
          </div>
          <div>
            <Link href="/legal/privacy" className="text-pf-accent no-underline hover:underline">
              Privacy Policy
            </Link>
            {' — Understand how we collect, use, and protect your data'}
          </div>
          <div>
            <Link href="/legal/cookies" className="text-pf-accent no-underline hover:underline">
              Cookie Notice
            </Link>
            {' — See what cookies we use and why'}
          </div>
        </div>
      </div>
    </div>
  );
}
