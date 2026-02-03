'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UserAvatar } from '@/components/UserAvatar';
import { formatCurrency0 } from '@/lib/formatters';

interface FriendSummary {
  publicId: string | null;
  name: string;
  email: string;
  totalLoans: number;
  totalBorrowed: number;
  activeCount: number;
  pendingCount: number;
  settledCount: number;
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    try {
      const response = await fetch('/api/friends');
      const data = await response.json();
      setFriends(data.friends || []);
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <Link href="/dashboard" className="text-sm text-pf-accent mb-2 block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-semibold">Friends</h1>
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center">
          <div className="loading-spinner mx-auto mb-4" />
          <p className="text-pf-muted">Loading friends...</p>
        </div>
      ) : friends.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">👥</div>
          <h2 className="text-xl font-semibold mb-2">No friends yet</h2>
          <p className="text-pf-muted mb-6">
            Friends are added automatically when you create loan agreements with them.
          </p>
          <Link href="/calculate" className="btn-primary">
            Create First Loan
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {friends.map((friend, index) => (
            <FriendCard key={friend.email || index} friend={friend} />
          ))}
        </div>
      )}
    </div>
  );
}

function FriendCard({ friend }: { friend: FriendSummary }) {
  const totalAgreements = friend.activeCount + friend.pendingCount + friend.settledCount;

  return (
    <Link
      href={friend.publicId ? `/friends/${friend.publicId}` : '#'}
      className="card p-4 hover:border-pf-accent/30 transition-colors block no-underline"
    >
      <div className="flex items-start gap-4">
        <UserAvatar name={friend.name} size="lg" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-pf-text truncate">{friend.name}</h3>
          <p className="text-sm text-pf-muted truncate">{friend.email}</p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-pf-card-border">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-pf-muted">Agreements</span>
          <span className="font-medium">{totalAgreements}</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-pf-muted">You lent</span>
          <span className="font-medium text-green-400">{formatCurrency0(friend.totalLoans)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-pf-muted">You borrowed</span>
          <span className="font-medium text-red-400">{formatCurrency0(friend.totalBorrowed)}</span>
        </div>
      </div>

      {/* Status indicators */}
      <div className="mt-4 flex gap-2 flex-wrap">
        {friend.activeCount > 0 && (
          <span className="badge badge-active">{friend.activeCount} active</span>
        )}
        {friend.pendingCount > 0 && (
          <span className="badge badge-pending">{friend.pendingCount} pending</span>
        )}
        {friend.settledCount > 0 && (
          <span className="badge badge-settled">{friend.settledCount} settled</span>
        )}
      </div>
    </Link>
  );
}
