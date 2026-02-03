'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { cn, getInitials } from '@/lib/utils';

interface UserProfile {
  id: number;
  email: string;
  fullName: string | null;
  phoneNumber: string | null;
  profilePicturePath: string | null;
}

function getAvatarColorClass(name: string | null): string {
  if (!name) return 'bg-indigo-500';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'bg-indigo-500',
    'bg-violet-500',
    'bg-pink-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-blue-500',
    'bg-teal-500',
  ];
  return colors[Math.abs(hash) % colors.length];
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | '' }>({ message: '', type: '' });
  const [pictureStatus, setPictureStatus] = useState<{ message: string; type: 'success' | 'error' | '' }>({ message: '', type: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const res = await fetch('/api/profile');
      if (!res.ok) {
        window.location.href = '/login';
        return;
      }
      const data = await res.json();
      setUser(data.user);
      setFullName(data.user.fullName || '');
      setPhoneNumber(data.user.phoneNumber || '');
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ message: '', type: '' });

    if (!fullName.trim()) {
      setStatus({ message: 'Full name is required', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullName.trim(), phoneNumber: phoneNumber.trim() || null }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update profile');
      }

      const data = await res.json();
      setUser(data.user);
      setStatus({ message: '✓ Profile updated successfully', type: 'success' });
      setTimeout(() => setStatus({ message: '', type: '' }), 3000);
    } catch (err) {
      setStatus({ message: err instanceof Error ? err.message : 'Failed to update profile', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handlePictureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPictureStatus({ message: 'Uploading...', type: '' });

    try {
      const formData = new FormData();
      formData.append('picture', file);

      const res = await fetch('/api/profile/picture', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setPictureStatus({ message: data.error || 'Failed to upload picture', type: 'error' });
        return;
      }

      // Reload profile to get updated picture
      await loadProfile();
      setPictureStatus({ message: '✓ Profile picture updated', type: 'success' });
      setTimeout(() => setPictureStatus({ message: '', type: '' }), 3000);
    } catch (err) {
      setPictureStatus({ message: 'Failed to upload picture', type: 'error' });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleRemovePicture() {
    if (!confirm('Remove profile picture?')) return;

    setPictureStatus({ message: 'Removing...', type: '' });

    try {
      const res = await fetch('/api/profile/picture', {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove picture');
      }

      await loadProfile();
      setPictureStatus({ message: '✓ Profile picture removed', type: 'success' });
      setTimeout(() => setPictureStatus({ message: '', type: '' }), 3000);
    } catch (err) {
      setPictureStatus({ message: err instanceof Error ? err.message : 'Failed to remove picture', type: 'error' });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="loading-spinner" />
      </div>
    );
  }

  const initials = getInitials(user?.fullName ?? null);
  const colorClass = getAvatarColorClass(user?.fullName ?? null);

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-[28px] font-semibold m-0">My Profile</h1>
        <Link href="/dashboard" className="text-pf-accent text-sm hover:underline">
          ← Back to dashboard
        </Link>
      </div>

      {/* Profile card */}
      <div className="bg-pf-card border border-pf-card-border rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-6">Profile Information</h2>

        {/* Avatar section */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <div
            className="cursor-pointer transition-opacity hover:opacity-85"
            onClick={() => fileInputRef.current?.click()}
            onContextMenu={(e) => {
              if (user?.profilePicturePath) {
                e.preventDefault();
                handleRemovePicture();
              }
            }}
          >
            {user?.profilePicturePath ? (
              <div className="w-[120px] h-[120px] rounded-full overflow-hidden">
                <img
                  src={`/api/profile/picture/${user.id}`}
                  alt={user.fullName || 'Profile'}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div
                className={cn(
                  'w-[120px] h-[120px] rounded-full flex items-center justify-center text-white text-4xl font-semibold',
                  colorClass
                )}
              >
                {initials}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-pf-muted text-sm underline hover:text-pf-text cursor-pointer bg-transparent border-0"
          >
            Change photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handlePictureUpload}
          />
          {pictureStatus.message && (
            <p className={cn(
              'text-sm text-center',
              pictureStatus.type === 'success' && 'text-pf-accent',
              pictureStatus.type === 'error' && 'text-red-400'
            )}>
              {pictureStatus.message}
            </p>
          )}
        </div>

        {/* Profile form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block text-pf-muted text-sm font-medium mb-2">
              Full legal name (as on passport)
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              className="input"
              required
            />
          </div>

          <div className="mb-5">
            <label className="block text-pf-muted text-sm font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="input opacity-60 cursor-not-allowed"
            />
          </div>

          <div className="mb-5">
            <label className="block text-pf-muted text-sm font-medium mb-2">
              Phone number
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+31 6 12345678"
              className="input"
            />
            <p className="text-pf-muted text-xs mt-1.5">
              Include country code (e.g., +31 for Netherlands)
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full mt-2"
          >
            {saving ? 'Saving...' : 'Save Changes'}
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
        </form>
      </div>
    </div>
  );
}
