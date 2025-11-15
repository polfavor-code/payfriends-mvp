/**
 * Centralized currency formatting for nl-NL locale
 * Single source of truth for all currency formatting across the app
 */

const EUR_LOCALE = "nl-NL";

/**
 * Format currency with 0 decimal places (for compact displays like My Agreements table)
 * @param {number} cents - Amount in cents
 * @param {string} locale - Locale to use (default: nl-NL)
 * @returns {string} Formatted currency string (e.g., "€ 3.000")
 */
function formatCurrency0(cents, locale = EUR_LOCALE) {
  const euros = Math.round((cents ?? 0) / 100);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(euros);
}

/**
 * Format currency with 2 decimal places (for detailed displays and schedules)
 * @param {number} cents - Amount in cents
 * @param {string} locale - Locale to use (default: nl-NL)
 * @returns {string} Formatted currency string (e.g., "€ 3.000,00")
 */
function formatCurrency2(cents, locale = EUR_LOCALE) {
  const euros = (cents ?? 0) / 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(euros);
}

/**
 * Format euro amount (not cents) with 0 decimal places
 * @param {number} euros - Amount in euros
 * @param {string} locale - Locale to use (default: nl-NL)
 * @returns {string} Formatted currency string (e.g., "€ 3.000")
 */
function formatEuro0(euros, locale = EUR_LOCALE) {
  return formatCurrency0(Math.round((euros ?? 0) * 100), locale);
}

/**
 * Format euro amount (not cents) with 2 decimal places
 * @param {number} euros - Amount in euros
 * @param {string} locale - Locale to use (default: nl-NL)
 * @returns {string} Formatted currency string (e.g., "€ 3.000,00")
 */
function formatEuro2(euros, locale = EUR_LOCALE) {
  return formatCurrency2((euros ?? 0) * 100, locale);
}

/**
 * Format date for display
 * @param {string|Date} isoDate - ISO date string or Date object
 * @returns {string} Formatted date string (e.g., "Jan 15, 2025")
 */
function formatDate(isoDate) {
  if (!isoDate) return '—';
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  }).format(date);
}

/**
 * Calculate countdown text for a due date
 * @param {string|Date} dueDate - ISO date string or Date object
 * @returns {string} Countdown text (e.g., "(in 35 days)", "(today)", "(5 days overdue)")
 */
function getDueDateCountdown(dueDate) {
  if (!dueDate) return '';
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return '';

  const now = new Date();
  // Set both dates to midnight for accurate day comparison
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diffMs = due - now;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return `(in ${diffDays} day${diffDays === 1 ? '' : 's'})`;
  } else if (diffDays === 0) {
    return '(today)';
  } else {
    const overdueDays = Math.abs(diffDays);
    return `(${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue)`;
  }
}

/**
 * Format date with countdown for one-time loan due dates
 * @param {string|Date} isoDate - ISO date string or Date object
 * @param {string} locale - Locale to use (default: 'en-GB' for "15 Jan 2025" format)
 * @returns {string} Formatted date with countdown (e.g., "15 Jan 2025 (in 35 days)")
 */
function formatDateWithCountdown(isoDate, locale = 'en-GB') {
  if (!isoDate) return '—';
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return '—';

  const formattedDate = date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const countdown = getDueDateCountdown(isoDate);
  return countdown ? `${formattedDate} ${countdown}` : formattedDate;
}

/**
 * Get relative due date text from one-time due option
 * @param {string} oneTimeDueOption - Option value (e.g., "in_1_week", "in_1_month", etc.)
 * @returns {string} Relative text (e.g., "1 week after loan start date")
 */
function getRelativeDueDateText(oneTimeDueOption) {
  const mapping = {
    'in_1_week': '1 week after loan start date',
    'in_1_month': '1 month after loan start date',
    'in_3_months': '3 months after loan start date',
    'in_6_months': '6 months after loan start date',
    'in_1_year': '1 year after loan start date',
    'in_1_years': '1 year after loan start date' // Handle both variants
  };
  return mapping[oneTimeDueOption] || '—';
}
