/**
 * Derived field utilities for agreements
 * Used across Step 5, Review, and Manage pages
 */

/**
 * Get a formatted loan duration label for display
 * @param {Object} agreement - Agreement object with repayment details
 * @returns {string|null} Formatted duration string (e.g., "3 months") or null if not calculable
 */
function getLoanDurationLabel(agreement) {
  if (!agreement) {
    return null;
  }

  // For installment loans, use the stored plan_length and plan_unit if available
  if (agreement.repayment_type === 'installments' && agreement.plan_length && agreement.plan_unit) {
    const length = agreement.plan_length;
    const unit = agreement.plan_unit;

    if (unit === 'days') {
      return length === 1 ? '1 day' : `${length} days`;
    } else if (unit === 'weeks') {
      return length === 1 ? '1 week' : `${length} weeks`;
    } else if (unit === 'months') {
      if (length === 1) {
        return '1 month';
      } else if (length === 12) {
        return '1 year';
      } else if (length % 12 === 0) {
        const years = length / 12;
        return `${years} ${years === 1 ? 'year' : 'years'}`;
      } else {
        return `${length} months`;
      }
    } else if (unit === 'years') {
      return length === 1 ? '1 year' : `${length} years`;
    }
  }

  // For one-time loans, calculate duration from money_sent_date to due_date
  if (agreement.repayment_type === 'one_time' && agreement.money_sent_date && agreement.due_date) {
    // Parse dates and normalize to UTC midnight to avoid timezone/DST issues
    const startDateObj = new Date(agreement.money_sent_date);
    const dueDateObj = new Date(agreement.due_date);

    const startUTC = Date.UTC(
      startDateObj.getFullYear(),
      startDateObj.getMonth(),
      startDateObj.getDate()
    );
    const dueUTC = Date.UTC(
      dueDateObj.getFullYear(),
      dueDateObj.getMonth(),
      dueDateObj.getDate()
    );

    // Calculate day difference using UTC timestamps
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysDiff = Math.round((dueUTC - startUTC) / msPerDay);

    // Same day check
    if (daysDiff === 0) {
      return null;
    }

    // Calculate month difference accounting for partial months
    const startYear = startDateObj.getFullYear();
    const startMonth = startDateObj.getMonth();
    const startDay = startDateObj.getDate();
    const dueYear = dueDateObj.getFullYear();
    const dueMonth = dueDateObj.getMonth();
    const dueDay = dueDateObj.getDate();

    let totalMonths = (dueYear - startYear) * 12 + (dueMonth - startMonth);

    // If due day is before start day, we haven't completed the full month
    if (dueDay < startDay) {
      totalMonths -= 1;
    }

    if (totalMonths < 0) {
      return null; // Invalid date range
    } else if (totalMonths === 0) {
      // Less than a month - use days/weeks
      if (daysDiff === 1) {
        return '1 day';
      } else if (daysDiff < 7) {
        return `${daysDiff} days`;
      } else if (daysDiff < 14) {
        return '1 week';
      } else if (daysDiff < 28) {
        const weeks = Math.round(daysDiff / 7);
        return weeks === 1 ? '1 week' : `${weeks} weeks`;
      } else {
        return '1 month';
      }
    } else if (totalMonths === 1) {
      return '1 month';
    } else if (totalMonths === 12) {
      return '1 year';
    } else if (totalMonths % 12 === 0) {
      const years = totalMonths / 12;
      return years === 1 ? '1 year' : `${years} years`;
    } else {
      return `${totalMonths} months`;
    }
  }

  // If we can't calculate, return null (caller should hide the row)
  return null;
}

/**
 * Format repayment frequency for display
 * @param {string} frequency - Internal frequency value (e.g., "every_4_weeks", "monthly")
 * @returns {string} Formatted frequency string (e.g., "Every 4 weeks", "Monthly")
 */
function formatRepaymentFrequency(frequency) {
  if (!frequency) {
    return '—';
  }

  switch (frequency) {
    case 'weekly':
      return 'Weekly';
    case 'biweekly':
      return 'Every 2 weeks';
    case 'every_4_weeks':
      return 'Every 4 weeks';
    case 'monthly':
      return 'Monthly';
    case 'quarterly':
      return 'Every 3 months';
    case 'yearly':
      return 'Yearly';
    default:
      // Handle generic "every_X_weeks" or "every_X_days" patterns
      if (frequency.startsWith('every_') && frequency.endsWith('_weeks')) {
        const num = frequency.replace('every_', '').replace('_weeks', '');
        return `Every ${num} weeks`;
      } else if (frequency.startsWith('every_') && frequency.endsWith('_days')) {
        const num = frequency.replace('every_', '').replace('_days', '');
        return `Every ${num} days`;
      }
      return frequency;
  }
}

/**
 * Calculate next payment information for an agreement
 * @param {Object} agreement - Agreement object with repayment details and payment totals
 * @returns {Object|null} Object with { amount_cents, due_date } or null if no payment due
 */
function getNextPaymentInfo(agreement) {
  if (!agreement) {
    return null;
  }

  // Only calculate for active agreements
  if (agreement.status !== 'active') {
    return null;
  }

  const totalPaid = agreement.total_paid_cents || 0;
  const totalOwed = agreement.amount_cents || 0;
  const outstanding = totalOwed - totalPaid;

  // If fully paid, no next payment
  if (outstanding <= 0) {
    return null;
  }

  // For one-time repayment
  if (agreement.repayment_type === 'one_time') {
    return {
      amount_cents: outstanding,
      due_date: agreement.due_date
    };
  }

  // For installment repayment
  if (agreement.repayment_type === 'installments') {
    const installmentAmount = agreement.installment_amount;
    const installmentCount = agreement.installment_count || 0;

    if (!installmentAmount || installmentCount === 0) {
      return null;
    }

    // Convert installment amount from euros to cents
    const installmentCents = Math.round(installmentAmount * 100);

    // Next payment amount is the installment amount (or remaining if less)
    const nextAmount = Math.min(installmentCents, outstanding);

    // Calculate which installment number is next (1-based)
    const numPaymentsMade = Math.floor(totalPaid / installmentCents);
    const nextInstallmentNumber = numPaymentsMade + 1;

    // If all installments paid, no next payment
    if (nextInstallmentNumber > installmentCount) {
      return null;
    }

    // Calculate next due date based on first payment date and frequency
    const firstPaymentDate = agreement.first_payment_date;
    const frequency = agreement.payment_frequency || 'monthly';

    if (!firstPaymentDate) {
      // Fallback to final due date if first payment date not set
      return {
        amount_cents: nextAmount,
        due_date: agreement.final_due_date || agreement.due_date
      };
    }

    // Calculate next due date based on installment number and frequency
    const baseDate = new Date(firstPaymentDate);
    let nextDate = new Date(baseDate);

    // Add periods based on installment number (0-indexed for calculation)
    const periodsToAdd = nextInstallmentNumber - 1;

    switch (frequency) {
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + (periodsToAdd * 7));
        break;
      case 'biweekly':
        nextDate.setDate(nextDate.getDate() + (periodsToAdd * 14));
        break;
      case 'every_4_weeks':
        nextDate.setDate(nextDate.getDate() + (periodsToAdd * 28));
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + periodsToAdd);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + (periodsToAdd * 3));
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + periodsToAdd);
        break;
      default:
        // For custom frequencies, default to monthly
        nextDate.setMonth(nextDate.getMonth() + periodsToAdd);
    }

    return {
      amount_cents: nextAmount,
      due_date: nextDate.toISOString().split('T')[0]
    };
  }

  return null;
}

// Export functions for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getLoanDurationLabel,
    formatRepaymentFrequency,
    getNextPaymentInfo
  };
}
