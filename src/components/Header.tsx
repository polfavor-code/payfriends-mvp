'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { cn, getInitials } from '@/lib/utils';
import { ActivityPanel } from './ActivityPanel';

interface User {
  id: number;
  email: string;
  fullName: string | null;
  publicId: string | null;
  isAdmin: boolean;
  profilePicturePath?: string | null;
}

interface HeaderProps {
  user: User | null;
  unreadCount?: number;
}

// Avatar color classes matching old version
const avatarColors = [
  'bg-[#6366f1]', // color-1
  'bg-[#8b5cf6]', // color-2
  'bg-[#ec4899]', // color-3
  'bg-[#f59e0b]', // color-4
  'bg-[#10b981]', // color-5
  'bg-[#3b82f6]', // color-6
  'bg-[#14b8a6]', // color-7
];

function getAvatarColorClass(name: string | null): string {
  if (!name) return avatarColors[0];
  const charCode = name.charCodeAt(0) || 0;
  return avatarColors[charCode % avatarColors.length];
}

export function Header({ user, unreadCount: initialUnreadCount = 0 }: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const activityRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
        setActivityOpen(false);
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleActivityClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Close user dropdown if open
    setDropdownOpen(false);
    // Toggle activity panel
    setActivityOpen(!activityOpen);
  };

  const handleUnreadCountChange = (count: number) => {
    setUnreadCount(count);
  };

  const initials = getInitials(user?.fullName ?? null);
  const colorClass = getAvatarColorClass(user?.fullName ?? null);

  // Check if menu item is active based on pathname
  const isActive = (path: string) => {
    if (path === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(path);
  };

  return (
    <header className="flex justify-between items-center mb-6 pb-4 border-b border-[rgba(255,255,255,0.08)] relative z-10">
      {/* Left side - Logo and name */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-3 no-underline">
          <Image
            src="/images/payfriends-logov2.png"
            alt="PayFriends logo"
            width={54}
            height={54}
            className="logo-glow"
          />
          <div className="flex flex-col gap-0.5">
            <span className="text-2xl font-semibold leading-tight text-pf-text">PayFriends.app</span>
            <span className="text-sm leading-tight text-pf-muted mt-0.5">Pay friends, stay friends</span>
          </div>
        </Link>
      </div>

      {/* Right side - Activity and user menu */}
      <div className="flex items-center gap-3">
        {/* Activity button with panel */}
        <div className="relative" ref={activityRef}>
          <button
            onClick={handleActivityClick}
            className={cn(
              "inline-flex items-center justify-center h-10 px-4 rounded-lg border text-sm font-medium cursor-pointer transition-all whitespace-nowrap",
              activityOpen
                ? "bg-pf-card border-[rgba(255,255,255,0.06)]"
                : "bg-transparent border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.05)]"
            )}
            style={{ minHeight: '40px' }}
          >
            <span>Activity</span>
            {unreadCount > 0 && (
              <span className="ml-1.5 text-pf-accent">({unreadCount})</span>
            )}
          </button>

          {/* Activity Panel */}
          <ActivityPanel
            isOpen={activityOpen}
            onClose={() => setActivityOpen(false)}
            initialUnreadCount={unreadCount}
            onUnreadCountChange={handleUnreadCountChange}
          />
        </div>

        {/* User avatar dropdown */}
        <div className="relative inline-flex items-center" ref={dropdownRef}>
          <button
            onClick={() => {
              setActivityOpen(false); // Close activity panel
              setDropdownOpen(!dropdownOpen);
            }}
            className={cn(
              "inline-flex items-center justify-center w-[54px] h-[54px] p-0 border-0 rounded-full bg-transparent cursor-pointer transition-all flex-shrink-0",
              "hover:scale-105 hover:shadow-[0_0_0_2px_rgba(255,255,255,0.1)]",
              "focus:outline-none focus:shadow-[0_0_0_2px_rgba(61,220,151,0.5)]",
              dropdownOpen && "shadow-[0_0_0_2px_rgba(61,220,151,0.5)]"
            )}
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
            title="User menu"
          >
            {user?.profilePicturePath ? (
              <div className="w-[54px] h-[54px] rounded-full overflow-hidden">
                <Image
                  src={`/api/profile/picture/${user.id}`}
                  alt={user.fullName || 'User'}
                  width={54}
                  height={54}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className={cn(
                'w-[54px] h-[54px] rounded-full flex items-center justify-center text-white font-semibold text-xl uppercase',
                colorClass
              )}>
                {initials}
              </div>
            )}
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div 
              className="absolute right-0 top-[calc(100%+8px)] min-w-[240px] bg-[#0f1419] rounded-xl border border-[rgba(255,255,255,0.12)] shadow-[0_10px_40px_rgba(0,0,0,0.5)] py-2 z-50"
              style={{ animation: 'dropdownFadeIn 0.15s ease-out' }}
              role="menu"
            >
              <div className="px-2.5">
                {/* User info header */}
                <div className="px-2.5 py-2">
                  <div className="font-semibold text-pf-text text-sm leading-tight mb-0.5">
                    {user?.fullName || 'User'}
                  </div>
                  <div className="text-xs text-pf-muted leading-tight">
                    {user?.email}
                  </div>
                </div>

                <div className="border-t border-[rgba(255,255,255,0.08)] my-1.5" />

                {/* Navigation items */}
                <DropdownItem href="/dashboard" active={isActive('/dashboard')}>Loans</DropdownItem>
                <DropdownItem href="/grouptabs" active={isActive('/grouptabs')}>GroupTabs</DropdownItem>
                <DropdownItem href="/friends" active={isActive('/friends')}>Friends</DropdownItem>

                <div className="border-t border-[rgba(255,255,255,0.08)] my-1.5" />

                <DropdownItem href="/profile" active={isActive('/profile')}>My Profile</DropdownItem>
                <DropdownItem href="/settings" active={isActive('/settings')}>Settings</DropdownItem>
                <DropdownItem href="/security" active={isActive('/security')}>Security</DropdownItem>

                <div className="border-t border-[rgba(255,255,255,0.08)] my-1.5" />

                <DropdownItem href="/features" active={isActive('/features')}>Features</DropdownItem>
                <DropdownItem href="/faq" active={isActive('/faq')}>FAQ</DropdownItem>
                <DropdownItem href="/legal" active={isActive('/legal')}>Legal &amp; About</DropdownItem>

                {/* Admin link for admins */}
                {user?.isAdmin && (
                  <>
                    <div className="border-t border-[rgba(255,255,255,0.08)] my-1.5" />
                    <DropdownItem href="/admin" active={isActive('/admin')}>Admin Panel</DropdownItem>
                  </>
                )}

                <div className="border-t border-[rgba(255,255,255,0.08)] my-1.5" />

                <button
                  onClick={handleLogout}
                  className="w-full text-left bg-transparent border-none px-2.5 py-2 text-sm text-[#ff6b6b] cursor-pointer rounded-md transition-colors hover:bg-[rgba(255,107,107,0.1)] font-medium"
                  role="menuitem"
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function DropdownItem({ href, children, active = false }: { href: string; children: React.ReactNode; active?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "block w-full text-left px-2.5 py-2 text-sm cursor-pointer rounded-md transition-colors font-medium no-underline",
        active 
          ? "bg-[rgba(61,220,151,0.1)] text-pf-accent font-semibold" 
          : "text-pf-text hover:bg-[rgba(255,255,255,0.08)]"
      )}
      role="menuitem"
    >
      {children}
    </Link>
  );
}
