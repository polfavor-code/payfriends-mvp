/**
 * Repayment calculation utilities for borrower-side repayment flow
 * Handles interest savings, partial payments, and overpayment recalculations
 */

/**
 * Calculate interest accrued from start date to today for a one-time loan
 * @param {number} principalCents - Original loan amount in cents
 * @param {number} aprPercent - Annual interest rate as percentage (e.g., 5 for 5%)
 * @param {Date|string} startDate - Money sent date (start of interest accrual)
 * @param {Date|string} [endDate=today] - End date for calculation (defaults to today)
 * @returns {number} Interest accrued in cents
 */
function calculateAccruedInterest(principalCents, aprPercent, startDate, endDate = new Date()) {
  const principal = principalCents / 100;
  const annualRate = aprPercent / 100;
  const dailyRate = annualRate / 365;

  const start = typeof startDate === 'string' ? new Date(startDate) : new Date(startDate);
  const end = typeof endDate === 'string' ? new Date(endDate) : new Date(endDate);

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const daysBetween = Math.round((end - start) / (1000 * 60 * 60 * 24));
  const interestAccrued = principal * dailyRate * daysBetween;

  return Math.round(interestAccrued * 100);
}

/**
 * Calculate total interest that would accrue if loan runs to full term
 * @param {number} principalCents - Original loan amount in cents
 * @param {number} aprPercent - Annual interest rate as percentage
 * @param {Date|string} startDate - Money sent date
 * @param {Date|string} dueDate - Original due date
 * @returns {number} Total interest in cents
 */
function calculateTotalInterest(principalCents, aprPercent, startDate, dueDate) {
  return calculateAccruedInterest(principalCents, aprPercent, startDate, dueDate);
}

/**
 * Calculate interest saved by paying early for a one-time loan
 * @param {Object} params - Calculation parameters
 * @param {number} params.principalCents - Original loan amount in cents
 * @param {number} params.aprPercent - Annual interest rate as percentage
 * @param {Date|string} params.startDate - Money sent date
 * @param {Date|string} params.dueDate - Original due date
 * @param {number} params.amountPaidCents - Amount being paid in cents
 * @returns {Object} { interestSavedCents, remainingBalanceCents, totalPaidToDateCents }
 */
function calculateOneTimeRepaymentImpact(params) {
  const { principalCents, aprPercent, startDate, dueDate, amountPaidCents, totalPaidSoFarCents = 0 } = params;

  // Calculate interest accrued to today
  const interestToDate = calculateAccruedInterest(principalCents, aprPercent, startDate, new Date());

  // Calculate total interest if loan runs to full term
  const totalInterestFullTerm = calculateTotalInterest(principalCents, aprPercent, startDate, dueDate);

  // Current total owed = principal + interest to date
  const currentTotalOwed = principalCents + interestToDate;

  // New total paid after this payment
  const newTotalPaid = totalPaidSoFarCents + amountPaidCents;

  // Remaining balance
  const remainingBalance = Math.max(0, currentTotalOwed - newTotalPaid);

  // If paying in full or overpaying, calculate interest saved on future days
  let interestSaved = 0;
  if (remainingBalance === 0) {
    // Paying off entire loan today saves all interest from today to due date
    const futureInterest = calculateAccruedInterest(
      Math.max(0, principalCents - totalPaidSoFarCents),
      aprPercent,
      new Date(),
      dueDate
    );
    interestSaved = futureInterest;
  } else {
    // Partial payment - reduces principal, saves proportional future interest
    const principalReduction = Math.min(amountPaidCents, principalCents - totalPaidSoFarCents);
    if (principalReduction > 0) {
      const dailyRate = (aprPercent / 100) / 365;
      const remainingDays = Math.round((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
      interestSaved = Math.round((principalReduction / 100) * dailyRate * remainingDays * 100);
    }
  }

  return {
    interestSavedCents: Math.max(0, interestSaved),
    remainingBalanceCents: remainingBalance,
    totalPaidToDateCents: newTotalPaid,
    currentTotalOwedCents: currentTotalOwed,
    interestAccruedToDateCents: interestToDate
  };
}

/**
 * Calculate impact of overpayment on installment loan
 * @param {Object} params - Calculation parameters
 * @param {Object} params.agreement - Full agreement object
 * @param {Array} params.paymentSchedule - Array of payment schedule rows from buildRepaymentSchedule
 * @param {number} params.amountPaidCents - Amount being paid in cents
 * @param {number} params.totalPaidSoFarCents - Total already paid in cents
 * @returns {Object} Recalculated schedule impact
 */
function calculateInstallmentRepaymentImpact(params) {
  const { agreement, paymentSchedule, amountPaidCents, totalPaidSoFarCents = 0 } = params;

  // Calculate current outstanding principal
  const principalCents = agreement.amount_cents;
  const installmentCount = agreement.installment_count;
  const principalPerInstallment = principalCents / installmentCount;

  // Determine which installments have been paid
  let principalPaidSoFar = 0;
  let installmentsPaid = 0;

  // Simple approximation: assume each payment covers one installment's principal + interest
  for (let i = 0; i < paymentSchedule.rows.length; i++) {
    const installmentTotal = paymentSchedule.rows[i].paymentCents;
    if (totalPaidSoFarCents >= principalPaidSoFar + installmentTotal) {
      principalPaidSoFar += paymentSchedule.rows[i].principalCents;
      installmentsPaid++;
    } else {
      break;
    }
  }

  const remainingPrincipal = principalCents - principalPaidSoFar;
  const remainingInstallments = installmentCount - installmentsPaid;

  // Calculate new totals after this payment
  const newTotalPaid = totalPaidSoFarCents + amountPaidCents;

  // Determine how many additional installments this payment covers
  let additionalInstallmentsPaid = 0;
  let tempTotalPaid = totalPaidSoFarCents;

  for (let i = installmentsPaid; i < paymentSchedule.rows.length; i++) {
    const installmentTotal = paymentSchedule.rows[i].paymentCents;
    if (tempTotalPaid + amountPaidCents >= tempTotalPaid + installmentTotal - tempTotalPaid) {
      additionalInstallmentsPaid++;
      tempTotalPaid += installmentTotal;
      if (tempTotalPaid >= newTotalPaid) break;
    }
  }

  const newRemainingInstallments = Math.max(0, remainingInstallments - additionalInstallmentsPaid);

  // Calculate interest saved
  let interestSaved = 0;
  for (let i = installmentsPaid; i < installmentsPaid + additionalInstallmentsPaid; i++) {
    if (i < paymentSchedule.rows.length) {
      interestSaved += paymentSchedule.rows[i].interestCents;
    }
  }

  // Estimate new installment amount if overpaying
  const extraAmountCents = Math.max(0, newTotalPaid - tempTotalPaid);
  let newInstallmentAmountCents = null;

  if (extraAmountCents > 0 && newRemainingInstallments > 0) {
    // Overpayment reduces future principal
    const newRemainingPrincipal = Math.max(0, remainingPrincipal - extraAmountCents);

    // Recalculate future installments with reduced principal
    const newPrincipalPerInstallment = newRemainingPrincipal / newRemainingInstallments;

    // Estimate average interest per remaining installment (simplified)
    const avgInterestRate = agreement.interest_rate / 100 / 365;
    const avgDaysBetweenPayments = 30; // Approximate
    const avgInterestPerInstallment = (newRemainingPrincipal / 100) * avgInterestRate * avgDaysBetweenPayments / newRemainingInstallments;

    newInstallmentAmountCents = Math.round((newPrincipalPerInstallment + avgInterestPerInstallment) * 100);
  }

  // Calculate remaining balance
  const totalToRepay = paymentSchedule.totalToRepayCents;
  const remainingBalance = Math.max(0, totalToRepay - newTotalPaid);

  return {
    interestSavedCents: interestSaved,
    remainingBalanceCents: remainingBalance,
    newRemainingInstallments: newRemainingInstallments,
    newInstallmentAmountCents: newInstallmentAmountCents,
    additionalInstallmentsPaid: additionalInstallmentsPaid
  };
}

/**
 * Get next payment due for an agreement
 * @param {Object} agreement - Agreement object
 * @param {Array} payments - Array of approved payments
 * @param {Object} [paymentSchedule] - Payment schedule (for installments)
 * @returns {Object|null} { amountCents, dueDate, isOverdue } or null if fully paid
 */
function getNextPaymentDue(agreement, payments = [], paymentSchedule = null) {
  // Calculate total paid (only approved payments)
  const totalPaidCents = payments
    .filter(p => p.status === 'approved')
    .reduce((sum, p) => sum + p.amount_cents, 0);

  if (agreement.repayment_type === 'one_time') {
    // One-time loan
    const dueDate = new Date(agreement.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    // Calculate current total owed
    const interestToDate = calculateAccruedInterest(
      agreement.amount_cents,
      agreement.interest_rate || 0,
      agreement.money_sent_date,
      new Date()
    );

    const totalOwed = agreement.amount_cents + interestToDate;
    const remainingBalance = totalOwed - totalPaidCents;

    if (remainingBalance <= 0) {
      return null; // Fully paid
    }

    return {
      amountCents: Math.round(remainingBalance),
      dueDate: agreement.due_date,
      isOverdue: today > dueDate,
      type: 'full'
    };
  } else if (agreement.repayment_type === 'installments' && paymentSchedule) {
    // Installment loan - find next unpaid installment
    let cumulativePaid = totalPaidCents;

    for (let i = 0; i < paymentSchedule.rows.length; i++) {
      const installment = paymentSchedule.rows[i];

      if (cumulativePaid < installment.paymentCents) {
        // This installment is not fully paid
        const dueDate = new Date(installment.dateISO);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);

        return {
          amountCents: installment.paymentCents - cumulativePaid,
          dueDate: installment.dateISO,
          isOverdue: today > dueDate,
          installmentNumber: i + 1,
          type: 'installment'
        };
      }

      cumulativePaid -= installment.paymentCents;
    }

    return null; // All installments paid
  }

  return null;
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateAccruedInterest,
    calculateTotalInterest,
    calculateOneTimeRepaymentImpact,
    calculateInstallmentRepaymentImpact,
    getNextPaymentDue
  };
}
