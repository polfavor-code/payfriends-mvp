'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface MarkReviewedButtonProps {
  reportId: string | number;
}

export function MarkReviewedButton({ reportId }: MarkReviewedButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payments/${reportId}/review`, { method: 'POST' });
      if (!res.ok) {
        throw new Error('Failed to mark as reviewed');
      }
      router.refresh();
    } catch (err) {
      console.error(err);
      alert('Failed to mark as reviewed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-green-400 hover:text-green-300 text-sm disabled:opacity-50"
    >
      {loading ? '...' : 'Mark Reviewed'}
    </button>
  );
}
