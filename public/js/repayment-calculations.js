/**
 * Repayment calculation utilities for borrower repayment flow
 * Handles interest savings, balance recalculation, and payment impact preview
 */

/**
 * Calculate daily interest rate from annual rate
 * @param {number} annualRate - Annual interest rate (e.g., 5 for 5%)
 * @returns {number} Daily interest rate as decimal
 */
function getDailyInterestRate(annualRate) {
  return annualRate / 100 / 365;
}

/**
 * Calculate accrued interest from a start date to today
 * @param {number} principalCents - Principal amount in cents
 * @param {number} interestRate - Annual interest rate (e.g., 5 for 5%)
 * @param {string} startDate - ISO date string when interest started accruing
 * @returns {number} Accrued interest in cents
 */
function calculateAccruedInterest(principalCents, interestRate, startDate) {
  if (!interestRate || interestRate <= 0) return 0;

  const start = new Date(startDate);
  const today = new Date();
  const daysDiff = Math.max(0, Math.floor((today - start) / (1000 * 60 * 60 * 24)));

  const dailyRate = getDailyInterestRate(interestRate);
  const accruedCents = Math.round(principalCents * dailyRate * daysDiff);

  return accruedCents;
}

/**
 * Calculate total remaining interest if loan continues to due date
 * @param {number} remainingPrincipalCents - Remaining principal in cents
 * @param {number} interestRate - Annual interest rate
 * @param {string} dueDate - ISO date string of final due date
 * @returns {number} Future interest in cents
 */
function calculateFutureInterest(remainingPrincipalCents, interestRate, dueDate) {
  if (!interestRate || interestRate <= 0) return 0;

  const today = new Date();
  const due = new Date(dueDate);
  const daysRemaining = Math.max(0, Math.floor((due - today) / (1000 * 60 * 60 * 24)));

  const dailyRate = getDailyInterestRate(interestRate);
  const futureInterestCents = Math.round(remainingPrincipalCents * dailyRate * daysRemaining);

  return futureInterestCents;
}

/**
 * Get next payment due for an agreement
 * @param {Object} agreement - Agreement object
 * @param {number} totalPaidCents - Total amount already paid
 * @returns {Object} { amount: number, dueDate: string, type: 'full'|'installment' } or null
 */
function getNextPaymentDue(agreement, totalPaidCents) {
  if (!agreement || agreement.status === 'settled' || agreement.status === 'closed') {
    return null;
  }

  const remainingCents = agreement.amount_cents - totalPaidCents;
  if (remainingCents <= 0) return null;

  if (agreement.repayment_type === 'one_time') {
    // For one-time loans, next payment is the full remaining amount
    const accruedInterest = calculateAccruedInterest(
      remainingCents,
      agreement.interest_rate || 0,
      agreement.money_sent_date || agreement.created_at
    );

    return {
      amount: remainingCents + accruedInterest,
      dueDate: agreement.due_date,
      type: 'full'
    };
  } else if (agreement.repayment_type === 'installments') {
    // For installment loans, next payment is the next unpaid installment
    const installmentAmountCents = Math.round((agreement.installment_amount || 0) * 100);

    // Calculate which installment is next (simple version - could be enhanced)
    const installmentsPaid = Math.floor(totalPaidCents / installmentAmountCents);
    const nextDueDate = calculateNextInstallmentDate(agreement, installmentsPaid);

    return {
      amount: Math.min(installmentAmountCents, remainingCents),
      dueDate: nextDueDate || agreement.first_payment_date,
      type: 'installment'
    };
  }

  return null;
}

/**
 * Calculate the date of the next installment
 * @param {Object} agreement - Agreement object
 * @param {number} installmentIndex - Index of the installment (0-based)
 * @returns {string} ISO date string
 */
function calculateNextInstallmentDate(agreement, installmentIndex) {
  if (!agreement.first_payment_date) return agreement.due_date;

  const firstDate = new Date(agreement.first_payment_date);
  const frequency = agreement.payment_frequency || 'monthly';

  let nextDate = new Date(firstDate);

  for (let i = 0; i < installmentIndex; i++) {
    if (frequency === 'weekly') {
      nextDate.setDate(nextDate.getDate() + 7);
    } else if (frequency === 'biweekly') {
      nextDate.setDate(nextDate.getDate() + 14);
    } else if (frequency === 'monthly') {
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else {
      // Default to monthly
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
  }

  return nextDate.toISOString().split('T')[0];
}

/**
 * Calculate repayment impact when borrower pays an amount
 * Returns detailed breakdown of interest saved, new balance, etc.
 *
 * @param {Object} params
 * @param {Object} params.agreement - Agreement object
 * @param {number} params.paymentAmountCents - Amount borrower is paying in cents
 * @param {number} params.totalPaidCents - Total already paid in cents
 * @returns {Object} Impact calculation result
 */
function calculateRepaymentImpact(params) {
  const { agreement, paymentAmountCents, totalPaidCents } = params;

  if (!agreement || !paymentAmountCents) {
    return null;
  }

  const originalPrincipal = agreement.amount_cents;
  const remainingBeforePayment = originalPrincipal - totalPaidCents;
  const interestRate = agreement.interest_rate || 0;
  const startDate = agreement.money_sent_date || agreement.created_at;

  // Calculate current state
  const accruedInterestSoFar = calculateAccruedInterest(
    remainingBeforePayment,
    interestRate,
    startDate
  );

  const futureInterestBefore = calculateFutureInterest(
    remainingBeforePayment,
    interestRate,
    agreement.due_date || agreement.final_due_date
  );

  const totalBalanceBefore = remainingBeforePayment + accruedInterestSoFar + futureInterestBefore;

  // Calculate state after payment
  const remainingAfterPayment = Math.max(0, remainingBeforePayment - paymentAmountCents);

  const futureInterestAfter = calculateFutureInterest(
    remainingAfterPayment,
    interestRate,
    agreement.due_date || agreement.final_due_date
  );

  const totalBalanceAfter = remainingAfterPayment + futureInterestAfter;

  // Interest saved is the difference in future interest
  const interestSaved = Math.max(0, futureInterestBefore - futureInterestAfter);

  // Get next payment info
  const nextPaymentBefore = getNextPaymentDue(agreement, totalPaidCents);
  const nextPaymentAfter = getNextPaymentDue(agreement, totalPaidCents + paymentAmountCents);

  const isOverpayment = nextPaymentBefore && paymentAmountCents > nextPaymentBefore.amount;

  // Calculate installment impact if applicable
  let installmentImpact = null;
  if (agreement.repayment_type === 'installments' && isOverpayment) {
    const remainingInstallments = Math.max(
      0,
      (agreement.installment_count || 0) - Math.floor(totalPaidCents / (agreement.amount_cents / (agreement.installment_count || 1)))
    );

    if (remainingInstallments > 1) {
      const oldAvgInstallment = remainingBeforePayment / remainingInstallments;
      const newRemainingInstallments = remainingInstallments; // Could be recalculated if early payment reduces count
      const newAvgInstallment = remainingAfterPayment / newRemainingInstallments;

      installmentImpact = {
        oldAverage: Math.round(oldAvgInstallment),
        newAverage: Math.round(newAvgInstallment),
        reduction: Math.round(oldAvgInstallment - newAvgInstallment)
      };
    }
  }

  return {
    // Before payment
    remainingPrincipalBefore: remainingBeforePayment,
    accruedInterest: accruedInterestSoFar,
    futureInterestBefore: futureInterestBefore,
    totalBalanceBefore: totalBalanceBefore,

    // After payment
    remainingPrincipalAfter: remainingAfterPayment,
    futureInterestAfter: futureInterestAfter,
    totalBalanceAfter: totalBalanceAfter,

    // Impact
    principalReduction: paymentAmountCents,
    interestSaved: interestSaved,
    totalReduction: paymentAmountCents + interestSaved,

    // Flags
    isOverpayment: isOverpayment,
    isFullPayment: remainingAfterPayment === 0,

    // Next payments
    nextPaymentBefore: nextPaymentBefore,
    nextPaymentAfter: nextPaymentAfter,

    // Installment-specific
    installmentImpact: installmentImpact
  };
}

/**
 * Format repayment impact for display
 * @param {Object} impact - Result from calculateRepaymentImpact
 * @returns {Object} Formatted strings for UI display
 */
function formatRepaymentImpact(impact) {
  if (!impact) return null;

  return {
    interestSaved: formatCurrency2(impact.interestSaved),
    totalBalanceBefore: formatCurrency2(impact.totalBalanceBefore),
    totalBalanceAfter: formatCurrency2(impact.totalBalanceAfter),
    balanceReduction: formatCurrency2(impact.totalBalanceBefore - impact.totalBalanceAfter),

    principalReduction: formatCurrency2(impact.principalReduction),

    installmentOldAvg: impact.installmentImpact ? formatCurrency2(impact.installmentImpact.oldAverage) : null,
    installmentNewAvg: impact.installmentImpact ? formatCurrency2(impact.installmentImpact.newAverage) : null,
    installmentReduction: impact.installmentImpact ? formatCurrency2(impact.installmentImpact.reduction) : null
  };
}
