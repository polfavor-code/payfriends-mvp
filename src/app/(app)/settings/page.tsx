'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const TIMEZONES = [
  'Europe/Amsterdam',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Brussels',
  'Europe/Vienna',
  'Europe/Stockholm',
  'Europe/Copenhagen',
  'Europe/Oslo',
  'Europe/Helsinki',
  'Europe/Dublin',
  'Europe/Lisbon',
  'Europe/Warsaw',
  'Europe/Prague',
  'Europe/Budapest',
  'Europe/Athens',
  'Europe/Bucharest',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'America/Buenos_Aires',
  'America/Lima',
  'America/Bogota',
  'America/Santiago',
  'Asia/Dubai',
  'Asia/Tokyo',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Seoul',
  'Asia/Bangkok',
  'Asia/Jakarta',
  'Asia/Manila',
  'Asia/Kolkata',
  'Asia/Karachi',
  'Asia/Taipei',
  'Asia/Istanbul',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Australia/Perth',
  'Pacific/Auckland',
  'Pacific/Fiji',
  'Pacific/Honolulu',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Nairobi',
  'Africa/Lagos',
  'UTC',
].sort();

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timezone, setTimezone] = useState('Europe/Amsterdam');
  const [detectedTimezone, setDetectedTimezone] = useState<string | null>(null);
  const [savedTimezone, setSavedTimezone] = useState<string | null>(null);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | '' }>({ message: '', type: '' });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    // Detect browser timezone
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setDetectedTimezone(detected);
    } catch (e) {
      console.warn('Could not detect browser timezone:', e);
    }

    // Load user's saved timezone
    try {
      const res = await fetch('/api/user');
      if (!res.ok) {
        window.location.href = '/login';
        return;
      }
      const data = await res.json();
      const userTimezone = data.user?.timezone || null;
      setSavedTimezone(userTimezone);
      setTimezone(userTimezone || detectedTimezone || 'Europe/Amsterdam');
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setStatus({ message: '', type: '' });
    setSaving(true);

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save preferences');
      }

      setSavedTimezone(timezone);
      setStatus({ message: 'Preferences updated successfully', type: 'success' });
      setTimeout(() => setStatus({ message: '', type: '' }), 3000);
    } catch (err) {
      setStatus({ message: err instanceof Error ? err.message : 'Failed to save preferences', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  function useBrowserTimezone() {
    if (detectedTimezone) {
      setTimezone(detectedTimezone);
      // Auto-save when clicking this
      setTimeout(() => handleSave(), 100);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="loading-spinner" />
      </div>
    );
  }

  const showMismatchHint = savedTimezone && detectedTimezone && savedTimezone !== detectedTimezone;

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-[28px] font-semibold m-0">Settings</h1>
        <Link href="/dashboard" className="text-pf-accent text-sm hover:underline">
          ← Back to dashboard
        </Link>
      </div>

      {/* App Preferences card */}
      <div className="bg-pf-card border border-pf-card-border rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-2">App Preferences</h2>
        <p className="text-pf-muted text-sm mb-5 leading-relaxed">
          Customize your app experience and display settings
        </p>

        <div className="mb-5">
          <label className="block text-pf-muted text-sm font-medium mb-2">
            Timezone
          </label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="input appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23a7b0bd%22%20d%3D%22M6%209L1%204h10z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center] cursor-pointer"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <p className="text-pf-muted text-xs mt-2 leading-relaxed">
            This timezone is used to show history and activity timestamps in your local time.<br />
            Financial dates like due dates are calendar days and do not depend on timezone.
          </p>
          {showMismatchHint && (
            <p className="text-pf-muted text-xs mt-2">
              Your current browser timezone is <strong>{detectedTimezone?.replace(/_/g, ' ')}</strong>.{' '}
              <button
                type="button"
                onClick={useBrowserTimezone}
                className="text-pf-accent underline bg-transparent border-0 cursor-pointer font-inherit"
              >
                Use current timezone
              </button>
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full mt-2"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>

        {status.message && (
          <p className={cn(
            'text-sm text-center mt-3',
            status.type === 'success' && 'text-pf-accent',
            status.type === 'error' && 'text-red-400'
          )}>
            {status.message}
          </p>
        )}
      </div>
    </div>
  );
}
