/**
 * Shared helper for loan start date display labels
 * Replaces inconsistent "To be confirmed" messaging with standardized labels
 */

const { formatScheduleDate } = require('../../public/js/schedule.js');

/**
 * Get display label for loan start date based on mode and date availability
 * @param {'fixed_date' | 'upon_acceptance'} loanStartMode - Loan start mode
 * @param {string|Date} [loanStartDate] - Actual loan start date (when available)
 * @returns {string} Display label for loan start
 */
function getLoanStartLabel(loanStartMode, loanStartDate) {
  if (loanStartMode === 'fixed_date' && loanStartDate) {
    // Format the date nicely
    return formatScheduleDate(loanStartDate);
  }

  if (loanStartMode === 'upon_acceptance') {
    // Always show this for upon_acceptance mode
    return 'When agreement is accepted';
  }

  // Fallback for edge cases (shouldn't normally happen)
  return 'To be confirmed';
}

module.exports = {
  getLoanStartLabel
};
