/**
 * Utility functions for Admin CMS
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format cents to currency string
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

/**
 * Format date to display string
 */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format date with time
 */
export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
}

/**
 * Get status badge class
 */
export function getStatusBadgeClass(status: string): string {
  const statusLower = status?.toLowerCase() || '';
  if (statusLower === 'active' || statusLower === 'accepted') return 'badge badge-active';
  if (statusLower === 'pending') return 'badge badge-pending';
  if (statusLower === 'settled' || statusLower === 'completed') return 'badge badge-settled';
  if (statusLower === 'disabled' || statusLower === 'rejected' || statusLower === 'cancelled') return 'badge badge-disabled';
  return 'badge bg-gray-700 text-gray-300';
}
