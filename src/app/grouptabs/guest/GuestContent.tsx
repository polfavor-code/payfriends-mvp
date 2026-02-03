'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { formatCurrency0 } from '@/lib/formatters';

interface TabData {
  id: number;
  name: string;
  description: string | null;
  tabType: string;
  status: string;
  totalAmountCents: number | null;
  splitMode: string;
  peopleCount: number;
  proofRequired: string;
}

interface Participant {
  id: number;
  guestName: string | null;
  amountOwedCents: number | null;
  amountPaidCents: number;
  isOrganizer: boolean;
}

export default function GuestContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [tab, setTab] = useState<TabData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) {
      fetchTab();
    } else {
      setError('No token provided');
      setLoading(false);
    }
  }, [token]);

  const fetchTab = async () => {
    try {
      const response = await fetch(`/api/grouptabs/by-token?token=${token}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Invalid or expired link');
        setLoading(false);
        return;
      }

      setTab(data.tab);
      setParticipants(data.participants || []);
      setLoading(false);
    } catch {
      setError('Failed to load tab');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4" />
          <p className="text-pf-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !tab) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="card p-8 max-w-md text-center">
            <div className="text-5xl mb-4">❌</div>
            <h1 className="text-2xl font-bold mb-4">Invalid Link</h1>
            <p className="text-pf-muted mb-6">
              {error || 'This link is invalid or has expired.'}
            </p>
            <Link href="/" className="btn-primary">
              Go to PayFriends
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const perPersonAmount = tab.totalAmountCents && tab.peopleCount
    ? Math.round(tab.totalAmountCents / tab.peopleCount)
    : null;

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 container-pf max-w-2xl">
        {/* Header */}
        <header className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-pf-accent no-underline">
            PayFriends
          </Link>
        </header>

        {/* Tab card */}
        <div className="card p-8">
          <h1 className="text-2xl font-bold mb-2">{tab.name}</h1>
          {tab.description && (
            <p className="text-pf-muted mb-6">{tab.description}</p>
          )}

          {/* Summary */}
          <div className="bg-pf-card/50 rounded-pf p-4 mb-6">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-pf-muted text-sm">Total</p>
                <p className="text-xl font-bold">
                  {tab.totalAmountCents ? formatCurrency0(tab.totalAmountCents) : '—'}
                </p>
              </div>
              <div>
                <p className="text-pf-muted text-sm">Per Person</p>
                <p className="text-xl font-bold">
                  {perPersonAmount ? formatCurrency0(perPersonAmount) : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Participants */}
          <h2 className="font-semibold mb-4">
            Participants ({participants.length}/{tab.peopleCount})
          </h2>
          
          {participants.length === 0 ? (
            <p className="text-pf-muted text-center py-4">
              No participants yet.
            </p>
          ) : (
            <div className="space-y-3 mb-6">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-3 border-b border-pf-card-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-pf-accent/20 flex items-center justify-center text-sm font-medium">
                      {(p.guestName || '?')[0].toUpperCase()}
                    </div>
                    <span className="font-medium">
                      {p.guestName || 'Guest'}
                      {p.isOrganizer && (
                        <span className="text-xs text-pf-accent ml-2">(Organizer)</span>
                      )}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {formatCurrency0(p.amountPaidCents)} / {formatCurrency0(p.amountOwedCents || perPersonAmount || 0)}
                    </p>
                    <p className={`text-xs ${
                      p.amountPaidCents >= (p.amountOwedCents || perPersonAmount || 0)
                        ? 'text-green-400'
                        : 'text-pf-muted'
                    }`}>
                      {p.amountPaidCents >= (p.amountOwedCents || perPersonAmount || 0)
                        ? '✓ Paid'
                        : 'Pending'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Join / Mark paid button */}
          <div className="space-y-3">
            <button className="btn-primary w-full">
              Join & Mark as Paid
            </button>
            <p className="text-xs text-pf-muted text-center">
              Create an account or login to track your payment
            </p>
          </div>
        </div>

        {/* Powered by */}
        <p className="text-center text-pf-muted text-sm mt-8">
          Powered by{' '}
          <Link href="/" className="text-pf-accent font-medium">
            PayFriends
          </Link>
        </p>
      </main>

      <Footer />
    </div>
  );
}
