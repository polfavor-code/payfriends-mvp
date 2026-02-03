/**
 * Utility functions for the PayFriends app
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a random token for invites, sessions, etc.
 * @param length - Length of the token (default: 32)
 */
export function generateToken(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

/**
 * Sleep for a specified duration
 * @param ms - Duration in milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Escape HTML to prevent XSS
 * @param str - String to escape
 */
export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validate email format
 * @param email - Email to validate
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Truncate a string to a maximum length
 * @param str - String to truncate
 * @param maxLength - Maximum length
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Convert cents to euros
 * @param cents - Amount in cents
 */
export function centsToEuros(cents: number): number {
  return cents / 100;
}

/**
 * Convert euros to cents
 * @param euros - Amount in euros
 */
export function eurosToCents(euros: number): number {
  return Math.round(euros * 100);
}

/**
 * Get initials from a name
 * @param name - Full name
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Format a phone number for display
 * @param phone - Phone number
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  // Basic formatting - you can use libphonenumber-js for more sophisticated formatting
  return phone.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3');
}

/**
 * Calculate session expiry date
 * @param days - Number of days until expiry (default: 30)
 */
export function getSessionExpiryDate(days = 30): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Check if a date is in the past
 * @param date - Date to check
 */
export function isPastDate(date: string | Date): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d < new Date();
}

/**
 * Check if a date is in the future
 * @param date - Date to check
 */
export function isFutureDate(date: string | Date): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d > new Date();
}

/**
 * Get status color class based on agreement status
 * @param status - Agreement status
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'badge-active';
    case 'pending':
      return 'badge-pending';
    case 'settled':
      return 'badge-settled';
    case 'cancelled':
      return 'badge-cancelled';
    default:
      return 'badge-pending';
  }
}

/**
 * Get human-readable status label
 * @param status - Agreement status
 */
export function getStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'pending':
      return 'Pending';
    case 'settled':
      return 'Settled';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}
