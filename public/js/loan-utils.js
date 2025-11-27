/**
 * Unified Loan Calculation Utilities
 * SINGLE SOURCE OF TRUTH for all loan calculations across PayFriends
 *
 * This file provides consistent calculations for:
 * - Total interest
 * - Total to repay
 * - Daily interest (simple interest only)
 * - Countdown days
 * - Next payment amounts
 * - Repayment schedules
 *
 * Used by: Wizard Summary, Agreements List, Dashboard, Manage Page, Review Pages
 */

// Import shared schedule calculation (uses buildRepaymentSchedule)
// This ensures we use the same calculation engine everywhere

/**
 * Calculate loan totals for any agreement
 * This is the SINGLE SOURCE OF TRUTH for total interest and total to repay
 *
 * @param {Object} agreement - Agreement object with loan details
 * @returns {Object} Object with totalInterestCents, totalToRepayCents, schedule
 */
function computeLoanTotals(agreement) {
  // Extract agreement details
  const principalCents = agreement.amount_cents || 0;
  const aprPercent = agreement.interest_rate || 0;
  const repaymentType = agreement.repayment_type || 'one_time';

  // If no interest, simple calculation
  if (aprPercent === 0) {
    return {
      totalInterestCents: 0,
      totalToRepayCents: principalCents,
      schedule: null
    };
  }

  // Determine count
  const count = repaymentType === 'one_time' ? 1 : (agreement.installment_count || 1);

  // Build payment dates
  const paymentDates = buildPaymentDatesFromAgreement(agreement, count);

  // Determine start date for interest calculation
  let startDate = new Date();
  if (agreement.money_sent_date && agreement.money_sent_date !== 'on-acceptance' && agreement.money_sent_date !== 'upon agreement acceptance') {
    startDate = new Date(agreement.money_sent_date);
  } else if (agreement.money_transfer_date && agreement.money_transfer_date !== 'on-acceptance') {
    startDate = new Date(agreement.money_transfer_date);
  }
  startDate.setHours(0, 0, 0, 0);

  // Use buildRepaymentSchedule from schedule.js (single source of truth)
  const schedule = buildRepaymentSchedule({
    principalCents: principalCents,
    aprPercent: aprPercent,
    count: count,
    paymentDates: paymentDates,
    startDate: startDate
  });

  return {
    totalInterestCents: schedule.totalInterestCents,
    totalToRepayCents: schedule.totalToRepayCents,
    schedule: schedule
  };
}

/**
 * Build payment dates array from agreement object
 * @param {Object} agreement - Agreement object
 * @param {number} count - Number of payments
 * @returns {Array<Date>} Array of payment dates
 */
function buildPaymentDatesFromAgreement(agreement, count) {
  const paymentDates = [];

  if (agreement.repayment_type === 'one_time') {
    // One-time loan: use due_date
    if (agreement.due_date) {
      const dueDate = new Date(agreement.due_date);
      dueDate.setHours(0, 0, 0, 0);
      paymentDates.push(dueDate);
    }
  } else {
    // Installments: generate dates based on frequency
    if (agreement.first_payment_date) {
      const frequency = agreement.payment_frequency || 'monthly';
      const firstDueDate = new Date(agreement.first_payment_date);
      firstDueDate.setHours(0, 0, 0, 0);

      // Determine start date
      let startDate = new Date();
      if (agreement.money_sent_date && agreement.money_sent_date !== 'on-acceptance') {
        startDate = new Date(agreement.money_sent_date);
      } else if (agreement.money_transfer_date && agreement.money_transfer_date !== 'on-acceptance') {
        startDate = new Date(agreement.money_transfer_date);
      }
      startDate.setHours(0, 0, 0, 0);

      // Use generatePaymentDates from schedule.js
      const dateResult = generatePaymentDates({
        transferDate: startDate,
        firstDueDate: firstDueDate,
        frequency: frequency,
        count: count
      });

      return dateResult.paymentDates;
    }
  }

  return paymentDates;
}

/**
 * Get days left until due date
 * Consistent calculation used everywhere
 *
 * @param {string|Date} dueDate - Due date
 * @param {Date} today - Optional today date (defaults to now)
 * @returns {number} Days left (negative if overdue)
 */
function getDaysLeft(dueDate, today = null) {
  if (!dueDate) return null;

  const due = typeof dueDate === 'string' ? new Date(dueDate) : new Date(dueDate);
  const now = today || new Date();

  // Set both to midnight for accurate day comparison
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diffMs = due - now;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Calculate next payment amount for an agreement
 * For one-time loans, returns the full total to repay
 * For installments, returns the next installment amount
 *
 * @param {Object} agreement - Agreement object
 * @returns {Object|null} Object with { amountCents, dueDate, daysLeft } or null
 */
function getNextPayment(agreement) {
  if (!agreement || agreement.status !== 'active') {
    return null;
  }

  const totalPaidCents = agreement.total_paid_cents || 0;

  if (agreement.repayment_type === 'one_time') {
    // For one-time loans, next payment is the full amount to repay
    const totals = computeLoanTotals(agreement);
    const totalToRepayCents = totals.totalToRepayCents;
    const outstanding = totalToRepayCents - totalPaidCents;

    if (outstanding <= 0) {
      return null;
    }

    const daysLeft = getDaysLeft(agreement.due_date);

    return {
      amountCents: outstanding,
      dueDate: agreement.due_date,
      daysLeft: daysLeft
    };
  } else {
    // For installments, calculate which payment is next
    const totals = computeLoanTotals(agreement);
    const schedule = totals.schedule;

    if (!schedule || !schedule.rows || schedule.rows.length === 0) {
      return null;
    }

    // Find the next unpaid row
    let cumulativePaid = 0;
    for (let i = 0; i < schedule.rows.length; i++) {
      const row = schedule.rows[i];
      cumulativePaid += row.principalCents;

      if (totalPaidCents < cumulativePaid) {
        // This is the next payment
        const daysLeft = getDaysLeft(row.dateISO);

        return {
          amountCents: row.paymentCents,
          dueDate: row.dateISO,
          daysLeft: daysLeft
        };
      }
    }

    return null;
  }
}

/**
 * Calculate outstanding (remaining principal) vs total to repay
 * Used for "Outstanding / Total" display in agreements list and dashboard
 *
 * @param {Object} agreement - Agreement object
 * @returns {Object} Object with { outstandingCents, totalToRepayCents }
 */
function getOutstandingAndTotal(agreement) {
  const totalPaidCents = agreement.total_paid_cents || 0;
  const principalCents = agreement.amount_cents || 0;

  // Calculate total to repay using unified calculation
  const totals = computeLoanTotals(agreement);
  const totalToRepayCents = totals.totalToRepayCents;

  // Outstanding is remaining principal (not including unpaid interest)
  const outstandingCents = Math.max(0, principalCents - totalPaidCents);

  return {
    outstandingCents: outstandingCents,
    totalToRepayCents: totalToRepayCents
  };
}

/**
 * Get loan start date label for display
 * Handles "upon acceptance" and explicit dates
 *
 * @param {Object} agreement - Agreement object
 * @returns {string} Loan start label
 */
function getLoanStartLabel(agreement) {
  const moneySentDate = agreement.money_sent_date || agreement.money_transfer_date;

  if (!moneySentDate || moneySentDate === 'on-acceptance' || moneySentDate === 'upon agreement acceptance') {
    return 'When agreement is accepted';
  }

  // Format the date
  return formatFinancialDate(moneySentDate);
}

/**
 * Get relative due date label for "when accepted" pending loans
 * @param {Object} agreement - Agreement object
 * @returns {string|null} Relative label like "1 year after agreement is accepted", or null if not applicable
 */
function getRelativeDueDateLabel(agreement) {
  const moneySentDate = agreement.money_sent_date || agreement.money_transfer_date;
  const isWhenAccepted = !moneySentDate || moneySentDate === 'on-acceptance' || moneySentDate === 'upon agreement acceptance';

  if (!isWhenAccepted || agreement.status !== 'pending') {
    return null;
  }

  // Check if we have a relative due date option
  if (agreement.one_time_due_option) {
    const mapping = {
      'in_1_week': '1 week after agreement is accepted',
      'in_1_month': '1 month after agreement is accepted',
      'in_3_months': '3 months after agreement is accepted',
      'in_6_months': '6 months after agreement is accepted',
      'in_1_year': '1 year after agreement is accepted',
      'in_1_years': '1 year after agreement is accepted'
    };
    return mapping[agreement.one_time_due_option] || null;
  }

  return null;
}

/**
 * Get loan duration label for display
 * @param {Object} agreement - Agreement object
 * @returns {string|null} Duration label like "1 year after agreement is accepted" or null
 */
function getLoanDurationLabel(agreement) {
  const moneySentDate = agreement.money_sent_date || agreement.money_transfer_date;
  const isWhenAccepted = !moneySentDate || moneySentDate === 'on-acceptance' || moneySentDate === 'upon agreement acceptance';

  if (isWhenAccepted && agreement.status === 'pending') {
    // For pending "when accepted" loans, return relative duration
    return getRelativeDueDateLabel(agreement);
  }

  // For active loans with real dates, we can calculate actual duration if needed
  // For now, return null and let the calling code handle it
  return null;
}

// Export for browser use
if (typeof window !== 'undefined') {
  window.computeLoanTotals = computeLoanTotals;
  window.getDaysLeft = getDaysLeft;
  window.getNextPayment = getNextPayment;
  window.getOutstandingAndTotal = getOutstandingAndTotal;
  window.getLoanStartLabel = getLoanStartLabel;
  window.getRelativeDueDateLabel = getRelativeDueDateLabel;
  window.getLoanDurationLabel = getLoanDurationLabel;
}
