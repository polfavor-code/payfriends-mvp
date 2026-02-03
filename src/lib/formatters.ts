/**
 * Currency formatting utilities
 * Centralized currency formatting for nl-NL locale
 */

const EUR_LOCALE = 'nl-NL';

/**
 * Format currency with 0 decimal places (for compact displays like tables)
 * @param cents - Amount in cents
 * @param locale - Locale to use (default: nl-NL)
 * @returns Formatted currency string (e.g., "€ 3.000")
 */
export function formatCurrency0(cents: number | null | undefined, locale = EUR_LOCALE): string {
  const euros = Math.round((cents ?? 0) / 100);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(euros);
}

/**
 * Format currency with 2 decimal places (for detailed displays and schedules)
 * @param cents - Amount in cents
 * @param locale - Locale to use (default: nl-NL)
 * @returns Formatted currency string (e.g., "€ 3.000,00")
 */
export function formatCurrency2(cents: number | null | undefined, locale = EUR_LOCALE): string {
  const euros = (cents ?? 0) / 100;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(euros);
}

/**
 * Format euro amount (not cents) with 0 decimal places
 * @param euros - Amount in euros
 * @param locale - Locale to use (default: nl-NL)
 * @returns Formatted currency string (e.g., "€ 3.000")
 */
export function formatEuro0(euros: number | null | undefined, locale = EUR_LOCALE): string {
  return formatCurrency0(Math.round((euros ?? 0) * 100), locale);
}

/**
 * Format euro amount (not cents) with 2 decimal places
 * @param euros - Amount in euros
 * @param locale - Locale to use (default: nl-NL)
 * @returns Formatted currency string (e.g., "€ 3.000,00")
 */
export function formatEuro2(euros: number | null | undefined, locale = EUR_LOCALE): string {
  return formatCurrency2((euros ?? 0) * 100, locale);
}

/**
 * Parse a currency input string to cents
 * @param value - Input string (e.g., "1.234,56" or "1234.56")
 * @returns Amount in cents
 */
export function parseCurrencyToCents(value: string): number {
  // Handle Dutch format (1.234,56) and US format (1,234.56)
  const cleaned = value
    .replace(/[€$\s]/g, '')
    .replace(/\.(?=\d{3})/g, '') // Remove thousands separator dots
    .replace(',', '.'); // Convert decimal comma to dot
  
  const euros = parseFloat(cleaned);
  if (isNaN(euros)) return 0;
  
  return Math.round(euros * 100);
}

/**
 * Format a date in a readable format
 * @param date - Date string or Date object
 * @param locale - Locale to use (default: nl-NL)
 * @returns Formatted date string
 */
export function formatDate(date: string | Date, locale = EUR_LOCALE): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

/**
 * Format a date and time in a readable format
 * @param date - Date string or Date object
 * @param locale - Locale to use (default: nl-NL)
 * @returns Formatted date and time string
 */
export function formatDateTime(date: string | Date, locale = EUR_LOCALE): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Format a relative time (e.g., "2 days ago")
 * @param date - Date string or Date object
 * @param locale - Locale to use (default: en)
 * @returns Relative time string
 */
export function formatRelativeTime(date: string | Date, locale = 'en'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffDays > 30) {
    return formatDate(d, locale);
  } else if (diffDays > 0) {
    return rtf.format(-diffDays, 'day');
  } else if (diffHours > 0) {
    return rtf.format(-diffHours, 'hour');
  } else if (diffMinutes > 0) {
    return rtf.format(-diffMinutes, 'minute');
  } else {
    return rtf.format(0, 'second');
  }
}

/**
 * Format a percentage
 * @param value - Percentage value (e.g., 5.5 for 5.5%)
 * @param decimals - Number of decimal places
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}
