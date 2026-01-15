'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserActionsProps {
  userId: string | number;
  hasFinancialHistory: boolean;
}

export function UserActions({ userId, hasFinancialHistory }: UserActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}/delete`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete user');
      }
      router.push('/users');
    } catch (err: any) {
      setError(err.message);
      setShowDeleteConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-2 rounded text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        {/* Delete */}
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={loading}
            className="admin-btn admin-btn-danger"
          >
            Delete User
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-yellow-400">
              {hasFinancialHistory 
                ? 'User will be anonymized (has financial history)' 
                : 'User will be permanently deleted'}
            </span>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="admin-btn admin-btn-danger"
            >
              {loading ? 'Deleting...' : 'Confirm Delete'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              disabled={loading}
              className="admin-btn admin-btn-secondary"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500">
        {hasFinancialHistory
          ? 'This user has financial history. Deleting will anonymize their data but preserve financial records.'
          : 'This user has no financial history. Deleting will permanently remove their account.'}
      </p>
    </div>
  );
}
