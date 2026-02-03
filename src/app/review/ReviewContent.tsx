'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { formatCurrency2, formatDate } from '@/lib/formatters';

interface InviteData {
  id: number;
  email: string;
  accepted: boolean;
  agreement: {
    id: number;
    lenderName: string;
    amountCents: number;
    dueDate: string;
    status: string;
    repaymentType: string;
    interestRate: number | null;
    installmentCount: number | null;
    paymentFrequency: string | null;
    description: string | null;
  } | null;
}

export default function ReviewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No invite token provided');
      setLoading(false);
      return;
    }

    fetchInvite();
  }, [token]);

  const fetchInvite = async () => {
    try {
      const response = await fetch(`/api/agreements/invite?token=${token}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Invalid or expired invite');
        setLoading(false);
        return;
      }

      setInvite(data.invite);
      setLoading(false);
    } catch {
      setError('Failed to load invite details');
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const response = await fetch('/api/agreements/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to accept invite');
        setAccepting(false);
        return;
      }

      // Redirect to dashboard
      router.push('/dashboard?accepted=true');
    } catch {
      setError('Failed to accept invite');
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4" />
          <p className="text-pf-muted">Loading invite details...</p>
        </div>
      </div>
    );
  }

  if (error || !invite?.agreement) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="card p-8 max-w-md text-center">
            <div className="text-5xl mb-4">❌</div>
            <h1 className="text-2xl font-bold mb-4">Invalid Invite</h1>
            <p className="text-pf-muted mb-6">
              {error || 'This invite link is invalid or has expired.'}
            </p>
            <Link href="/login" className="btn-primary">
              Go to Login
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const { agreement } = invite;

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 container-pf max-w-2xl">
        {/* Header */}
        <header className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-pf-accent no-underline">
            PayFriends
          </Link>
        </header>

        {/* Review card */}
        <div className="card p-8">
          <h1 className="text-2xl font-bold mb-2">Loan Agreement Review</h1>
          <p className="text-pf-muted mb-8">
            {agreement.lenderName} has invited you to review this loan agreement
          </p>

          {/* Agreement details */}
          <div className="space-y-4 mb-8">
            <DetailRow label="From" value={agreement.lenderName} />
            <DetailRow label="To" value={invite.email} />
            <DetailRow label="Amount" value={formatCurrency2(agreement.amountCents)} />
            {agreement.interestRate !== null && agreement.interestRate > 0 && (
              <DetailRow label="Interest Rate" value={`${agreement.interestRate}% per year`} />
            )}
            <DetailRow
              label="Repayment Type"
              value={agreement.repaymentType === 'one_time' ? 'One-time payment' : 'Installments'}
            />
            {agreement.repaymentType === 'installments' && (
              <>
                <DetailRow label="Number of Installments" value={`${agreement.installmentCount || '—'}`} />
                <DetailRow label="Payment Frequency" value={formatFrequency(agreement.paymentFrequency)} />
              </>
            )}
            <DetailRow label="Due Date" value={formatDate(agreement.dueDate)} />
            {agreement.description && (
              <DetailRow label="Description" value={agreement.description} />
            )}
          </div>

          {/* Status */}
          {invite.accepted ? (
            <div className="bg-green-900/20 border border-green-900/50 rounded-pf p-4 mb-8">
              <p className="text-green-400 font-medium">
                ✓ This agreement has been accepted
              </p>
            </div>
          ) : agreement.status !== 'pending' ? (
            <div className="bg-pf-warning-bg border border-pf-warning-border rounded-pf p-4 mb-8">
              <p className="text-pf-warning-ink font-medium">
                This agreement is no longer pending
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-pf-muted">
                By accepting, you agree to repay the loan according to the terms above.
                You can track payments in your PayFriends dashboard.
              </p>

              <div className="flex gap-4">
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="btn-primary flex-1"
                >
                  {accepting ? 'Accepting...' : 'Accept Agreement'}
                </button>
                <Link href="/login" className="btn-secondary flex-1 text-center">
                  Login First
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-pf-card-border">
      <span className="text-pf-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function formatFrequency(frequency: string | null): string {
  if (!frequency) return '—';
  const map: Record<string, string> = {
    weekly: 'Weekly',
    biweekly: 'Every 2 weeks',
    monthly: 'Monthly',
    quarterly: 'Every 3 months',
    yearly: 'Yearly',
  };
  return map[frequency] || frequency;
}
