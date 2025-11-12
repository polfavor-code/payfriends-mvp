// lib/formatters.js
// Centralized currency formatting for nl-NL locale (CommonJS for Node.js)

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

module.exports = {
  EUR_LOCALE,
  formatCurrency0,
  formatCurrency2,
  formatEuro0,
  formatEuro2,
};
