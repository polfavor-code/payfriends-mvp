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

  // For one-time loans, try to calculate duration from money_sent_date to due_date
  if (agreement.repayment_type === 'one_time') {
    // Check if money_sent_date is "upon agreement acceptance" or missing
    if (!agreement.money_sent_date || !agreement.due_date ||
        agreement.money_sent_date === 'upon agreement acceptance' ||
        agreement.money_sent_date === 'on-acceptance' ||
        agreement.money_transfer_date === 'upon agreement acceptance') {
      // For one-time loans without calculable duration, return descriptive text
      return 'One-time repayment';
    }

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
      return 'Same day';
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
      return 'One-time repayment'; // Invalid date range
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
 * Calculate next payment information for an agreement using the amortization engine
 * @param {Object} agreement - Agreement object with repayment details and payment totals
 * @returns {Object|null} Object with { amount_cents, due_date, schedule_row } or null if no payment due
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

  // For one-time repayment (no amortization needed)
  if (agreement.repayment_type === 'one_time') {
    // Calculate total owed including interest (if any)
    const totalOwedCents = agreement.total_repay_amount
      ? Math.round(agreement.total_repay_amount * 100)
      : agreement.amount_cents || 0;

    const outstanding = totalOwedCents - totalPaid;

    // If fully paid, no next payment
    if (outstanding <= 0) {
      return null;
    }

    return {
      amount_cents: outstanding,
      due_date: agreement.due_date,
      schedule_row: null
    };
  }

  // For installment repayment - use amortization engine
  if (agreement.repayment_type === 'installments') {
    const totalOwed = agreement.amount_cents || 0;
    const outstanding = totalOwed - totalPaid;

    // If fully paid, no next payment
    if (outstanding <= 0) {
      return null;
    }

    const installmentCount = agreement.installment_count || 0;

    if (installmentCount === 0) {
      return null;
    }

    // Build the full amortization schedule using the engine
    // Check if buildRepaymentSchedule and generatePaymentDates are available
    if (typeof buildRepaymentSchedule !== 'function' || typeof generatePaymentDates !== 'function') {
      // Fallback to simple calculation if engine not available
      return getNextPaymentInfoSimple(agreement);
    }

    // Determine start date
    let startDate;
    if (agreement.money_sent_date && agreement.money_sent_date !== 'on-acceptance') {
      startDate = new Date(agreement.money_sent_date);
    } else {
      startDate = agreement.first_payment_date ? new Date(agreement.first_payment_date) : new Date();
    }

    // Build payment dates
    let paymentDates = [];
    if (agreement.first_payment_date) {
      const frequency = agreement.payment_frequency || 'monthly';
      const dateResult = generatePaymentDates({
        transferDate: startDate,
        firstDueDate: agreement.first_payment_date,
        frequency: frequency,
        count: installmentCount
      });
      paymentDates = dateResult.paymentDates;
    }

    // Build the complete amortization schedule
    const schedule = buildRepaymentSchedule({
      principalCents: agreement.amount_cents,
      aprPercent: agreement.interest_rate || 0,
      count: installmentCount,
      paymentDates: paymentDates,
      startDate: startDate
    });

    // Determine which payment is next based on total paid
    // We compare cumulative principal paid vs total paid
    let cumulativePrincipal = 0;
    let nextRowIndex = 0;

    for (let i = 0; i < schedule.rows.length; i++) {
      const row = schedule.rows[i];
      cumulativePrincipal += row.principalCents;

      // If total paid is less than cumulative principal, this is the next payment
      if (totalPaid < cumulativePrincipal) {
        nextRowIndex = i;
        break;
      }
    }

    // Get the next payment row
    const nextRow = schedule.rows[nextRowIndex];

    if (!nextRow) {
      return null;
    }

    return {
      amount_cents: nextRow.paymentCents,
      due_date: new Date(nextRow.dateISO).toISOString().split('T')[0],
      schedule_row: nextRow,
      row_index: nextRowIndex
    };
  }

  return null;
}

/**
 * Simple fallback calculation when amortization engine is not available
 * @param {Object} agreement - Agreement object
 * @returns {Object|null} Next payment info
 */
function getNextPaymentInfoSimple(agreement) {
  const installmentAmount = agreement.installment_amount;
  const installmentCount = agreement.installment_count || 0;
  const totalPaid = agreement.total_paid_cents || 0;
  const totalOwed = agreement.amount_cents || 0;
  const outstanding = totalOwed - totalPaid;

  if (!installmentAmount || installmentCount === 0) {
    return null;
  }

  const installmentCents = Math.round(installmentAmount * 100);
  const nextAmount = Math.min(installmentCents, outstanding);
  const numPaymentsMade = Math.floor(totalPaid / installmentCents);
  const nextInstallmentNumber = numPaymentsMade + 1;

  if (nextInstallmentNumber > installmentCount) {
    return null;
  }

  const firstPaymentDate = agreement.first_payment_date;
  const frequency = agreement.payment_frequency || 'monthly';

  if (!firstPaymentDate) {
    return {
      amount_cents: nextAmount,
      due_date: agreement.final_due_date || agreement.due_date,
      schedule_row: null
    };
  }

  const baseDate = new Date(firstPaymentDate);
  let nextDate = new Date(baseDate);
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
      nextDate.setMonth(nextDate.getMonth() + periodsToAdd);
  }

  return {
    amount_cents: nextAmount,
    due_date: nextDate.toISOString().split('T')[0],
    schedule_row: null
  };
}

/**
 * Get the comprehensive status of the next installment for an installment loan
 * Uses the fairness engine and repayment schedule logic
 * @param {Object} params - Parameters
 * @param {Object} params.agreement - Agreement object with repayment details
 * @param {Array} params.payments - Array of payment objects (optional, for future use)
 * @param {Date} params.now - Current date/time (optional, defaults to now)
 * @param {string} params.timezone - IANA timezone string (optional)
 * @returns {Object} Status object with:
 *   - status: "upcoming" | "overdue" | "paidOff" | "none"
 *   - amountDue: number (cents) | null
 *   - dueDate: string (ISO date) | null
 *   - daysUntilDue: number (optional, if upcoming)
 *   - daysOverdue: number (optional, if overdue)
 *   - nextPaymentInfo: object | null (full payment info from getNextPaymentInfo)
 */
function getNextInstallmentStatus({ agreement, payments = null, now = null, timezone = null }) {
  if (!agreement) {
    return { status: 'none', amountDue: null, dueDate: null };
  }

  // Only for installment loans
  if (agreement.repayment_type !== 'installments') {
    return { status: 'none', amountDue: null, dueDate: null };
  }

  // Only for active agreements
  if (agreement.status !== 'active') {
    return { status: 'none', amountDue: null, dueDate: null };
  }

  // Get next payment info using existing fairness engine logic
  const nextPaymentInfo = getNextPaymentInfo(agreement);

  // If no next payment, loan is paid off
  if (!nextPaymentInfo) {
    return { status: 'paidOff', amountDue: null, dueDate: null };
  }

  const amountDue = nextPaymentInfo.amount_cents;
  const dueDate = nextPaymentInfo.due_date;

  if (!dueDate) {
    return { status: 'none', amountDue, dueDate: null };
  }

  // Determine if overdue or upcoming using calendar day comparison
  // Parse due date as calendar date (no timezone conversion)
  const dateParts = dueDate.split('T')[0].split('-');
  const dueDateYear = parseInt(dateParts[0], 10);
  const dueDateMonth = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
  const dueDateDay = parseInt(dateParts[2], 10);

  const currentDate = now || new Date();

  // Create both dates at midnight in local time for accurate day comparison
  const currentDateMidnight = new Date(currentDate);
  currentDateMidnight.setHours(0, 0, 0, 0);

  const dueDateMidnight = new Date(dueDateYear, dueDateMonth, dueDateDay, 0, 0, 0, 0);

  const diffMs = dueDateMidnight - currentDateMidnight;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    // Overdue
    return {
      status: 'overdue',
      amountDue,
      dueDate,
      daysOverdue: Math.abs(diffDays),
      nextPaymentInfo
    };
  } else {
    // Upcoming (includes today)
    return {
      status: 'upcoming',
      amountDue,
      dueDate,
      daysUntilDue: diffDays,
      nextPaymentInfo
    };
  }
}

// Export functions for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getLoanDurationLabel,
    formatRepaymentFrequency,
    getNextPaymentInfo,
    getNextInstallmentStatus
  };
}
