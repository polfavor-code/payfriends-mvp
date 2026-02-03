'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function SecurityPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | '' }>({ message: '', type: '' });
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  function clearErrors() {
    setErrors({});
    setStatus({ message: '', type: '' });
  }

  function handleCancel() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    clearErrors();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearErrors();

    // Client-side validation
    const newErrors: typeof errors = {};
    let hasError = false;

    if (!currentPassword) {
      newErrors.currentPassword = 'Current password is required';
      hasError = true;
    }

    if (!newPassword) {
      newErrors.newPassword = 'New password is required';
      hasError = true;
    } else if (newPassword.length < 8) {
      newErrors.newPassword = 'New password must be at least 8 characters';
      hasError = true;
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
      hasError = true;
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      hasError = true;
    }

    if (hasError) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);

    try {
      const res = await fetch('/api/security/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'Current password is incorrect') {
          setErrors({ currentPassword: data.error });
        } else {
          setStatus({ message: data.error || 'Failed to change password', type: 'error' });
        }
        return;
      }

      // Success
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setStatus({ message: 'Password updated successfully.', type: 'success' });
      setTimeout(() => setStatus({ message: '', type: '' }), 5000);
    } catch (err) {
      setStatus({ message: 'Something went wrong. Please try again.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-[28px] font-semibold m-0">Security</h1>
        <Link href="/dashboard" className="text-pf-accent text-sm hover:underline">
          ← Back to dashboard
        </Link>
      </div>

      {/* Change Password card */}
      <div className="bg-pf-card border border-pf-card-border rounded-2xl p-6 mb-4">
        <h2 className="text-lg font-semibold mb-2">Change password</h2>
        <p className="text-pf-muted text-sm mb-5 leading-relaxed">
          Update the password you use to log in.
        </p>

        {status.message && (
          <div className={cn(
            'p-3 rounded-lg mb-4 text-sm',
            status.type === 'success' && 'bg-pf-accent/10 text-pf-accent border border-pf-accent/20',
            status.type === 'error' && 'bg-red-500/10 text-red-400 border border-red-500/20'
          )}>
            {status.message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block text-pf-muted text-sm font-medium mb-2">
              Current password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setErrors((prev) => ({ ...prev, currentPassword: undefined }));
              }}
              autoComplete="current-password"
              className={cn('input', errors.currentPassword && 'border-red-500')}
              required
            />
            {errors.currentPassword && (
              <p className="text-red-400 text-xs mt-1">{errors.currentPassword}</p>
            )}
          </div>

          <div className="mb-5">
            <label className="block text-pf-muted text-sm font-medium mb-2">
              New password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setErrors((prev) => ({ ...prev, newPassword: undefined }));
              }}
              autoComplete="new-password"
              className={cn('input', errors.newPassword && 'border-red-500')}
              required
            />
            <p className="text-pf-muted text-xs mt-1">Min 8 characters</p>
            {errors.newPassword && (
              <p className="text-red-400 text-xs mt-1">{errors.newPassword}</p>
            )}
          </div>

          <div className="mb-5">
            <label className="block text-pf-muted text-sm font-medium mb-2">
              Confirm new password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }}
              autoComplete="new-password"
              className={cn('input', errors.confirmPassword && 'border-red-500')}
              required
            />
            {errors.confirmPassword && (
              <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>
            )}
          </div>

          <div className="flex items-center gap-3 mt-6">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary px-6"
            >
              {saving ? 'Saving…' : 'Save password'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="text-pf-muted hover:text-pf-text hover:underline bg-transparent border-0 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* Two-factor auth card (disabled) */}
      <div className="bg-pf-card border border-pf-card-border rounded-2xl p-6 opacity-60 relative">
        <div className="absolute inset-0 bg-black/30 rounded-2xl pointer-events-none" />
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
          Two step verification
          <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-500/15 text-yellow-400">
            Coming soon
          </span>
        </h2>
        <p className="text-pf-muted text-sm mb-5 leading-relaxed">
          Add an extra layer of security to your account using an authenticator app or SMS.
        </p>
        <button
          type="button"
          disabled
          className="btn-primary opacity-50 cursor-not-allowed"
        >
          Set up two step verification
        </button>
      </div>
    </div>
  );
}
