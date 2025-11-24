/**
 * Central repayment schedule generator - single source of truth
 * Handles both preview contexts (no real dates) and actual contexts (with real dates)
 */

const { addMonthsKeepingDay, addOnePeriod, normalizeFirstDueDate, generatePaymentDates, buildRepaymentSchedule, formatScheduleDate } = require('../../public/js/schedule.js');

/**
 * @typedef {'one_time' | 'installments'} RepaymentType
 * @typedef {'fixed_date' | 'upon_acceptance'} LoanStartMode
 * @typedef {'monthly' | 'weekly' | 'biweekly' | 'every_4_weeks' | 'quarterly' | 'yearly' | 'custom_days' | 'every-3-days' | 'every-week' | 'every-month' | 'every-year' | 'once'} PaymentFrequencyCode
 */

/**
 * @typedef {Object} ScheduleContext
 * @property {boolean} preview - Whether this is a preview context (wizard, review before acceptance)
 * @property {'pending' | 'active' | 'settled'} agreementStatus - Current agreement status
 * @property {boolean} hasRealStartDate - Whether we have an actual loan start date
 */

/**
 * @typedef {Object} RepaymentScheduleConfig
 * @property {number} principal - Principal amount in cents
 * @property {number} annualInterestRate - Annual interest rate as percentage (e.g., 5 for 5%)
 * @property {RepaymentType} repaymentType - One-time or installments
 * @property {number} [numInstallments] - Number of installments (required for installment type)
 * @property {PaymentFrequencyCode} paymentFrequency - Payment frequency code
 * @property {LoanStartMode} loanStartMode - Fixed date or upon acceptance
 * @property {string|Date} [loanStartDate] - Actual loan start date (ISO string or Date), only when known
 * @property {number} firstPaymentOffsetDays - Days offset for first payment from loan start
 * @property {ScheduleContext} context - Context information
 */

/**
 * @typedef {Object} RepaymentScheduleRow
 * @property {number} index - 1-based payment index
 * @property {Date|null} date - Actual due date, null when not available
 * @property {string} dateLabel - Display label for date (formatted date or relative label)
 * @property {number} principal - Principal portion in cents
 * @property {number} interest - Interest portion in cents
 * @property {number} totalPayment - Total payment in cents
 * @property {number} remainingBalance - Remaining balance after payment in cents
 */

/**
 * @typedef {Object} RepaymentScheduleResult
 * @property {RepaymentScheduleRow[]} rows - Schedule rows
 * @property {number} totalInterest - Total interest in cents
 * @property {number} totalToRepay - Total amount to repay in cents
 */

/**
 * Get human-readable label for relative time after loan start
 * @param {number} paymentIndex - 1-based payment index
 * @param {PaymentFrequencyCode} frequency - Payment frequency
 * @param {number} offsetDays - First payment offset in days
 * @returns {string} Label like "1 month after loan start"
 */
function getRelativeDateLabel(paymentIndex, frequency, offsetDays) {
  const isFirstPayment = paymentIndex === 1;

  // New frequency formats
  if (frequency === 'every-month') {
    const months = paymentIndex;
    if (months === 1) {
      return '1 month after loan start';
    }
    return `${months} months after loan start`;
  } else if (frequency === 'every-year') {
    const years = paymentIndex;
    if (years === 1) {
      return '1 year after loan start';
    }
    return `${years} years after loan start`;
  } else if (frequency === 'every-week') {
    const totalDays = isFirstPayment ? offsetDays : (offsetDays + (paymentIndex - 1) * 7);
    if (totalDays === 0) {
      return 'On loan start';
    }
    return `${totalDays} days after loan start`;
  } else if (frequency === 'every-3-days') {
    const totalDays = isFirstPayment ? offsetDays : (offsetDays + (paymentIndex - 1) * 3);
    if (totalDays === 0) {
      return 'On loan start';
    }
    return `${totalDays} days after loan start`;
  } else if (frequency === 'once') {
    if (offsetDays === 0) {
      return 'On loan start';
    }
    return `${offsetDays} days after loan start`;
  }

  // Legacy frequency formats (for backward compatibility)
  if (frequency === 'monthly') {
    // For monthly: first payment at offsetDays/30 months, then add 1 month for each subsequent payment
    const firstPaymentMonths = Math.round(offsetDays / 30);
    const months = isFirstPayment ? firstPaymentMonths : firstPaymentMonths + (paymentIndex - 1);

    if (months === 0) {
      return 'On loan start';
    }
    if (months === 1) {
      return '1 month after loan start';
    }
    return `${months} months after loan start`;
  } else if (frequency === 'weekly') {
    const firstPaymentWeeks = Math.round(offsetDays / 7);
    const weeks = isFirstPayment ? firstPaymentWeeks : firstPaymentWeeks + (paymentIndex - 1);

    if (weeks === 0) {
      return 'On loan start';
    }
    if (weeks === 1) {
      return '1 week after loan start';
    }
    return `${weeks} weeks after loan start`;
  } else if (frequency === 'biweekly') {
    const firstPaymentPeriods = Math.round(offsetDays / 14);
    const periods = isFirstPayment ? firstPaymentPeriods : firstPaymentPeriods + (paymentIndex - 1);
    const weeks = periods * 2;

    if (weeks === 0) {
      return 'On loan start';
    }
    if (weeks === 2) {
      return '2 weeks after loan start';
    }
    return `${weeks} weeks after loan start`;
  } else if (frequency === 'every_4_weeks') {
    const firstPaymentPeriods = Math.round(offsetDays / 28);
    const periods = isFirstPayment ? firstPaymentPeriods : firstPaymentPeriods + (paymentIndex - 1);
    const weeks = periods * 4;

    if (weeks === 0) {
      return 'On loan start';
    }
    if (weeks === 4) {
      return '4 weeks after loan start';
    }
    return `${weeks} weeks after loan start`;
  } else if (frequency === 'quarterly') {
    const firstPaymentQuarters = Math.round(offsetDays / 90);
    const quarters = isFirstPayment ? firstPaymentQuarters : firstPaymentQuarters + (paymentIndex - 1);
    const months = quarters * 3;

    if (months === 0) {
      return 'On loan start';
    }
    if (months === 3) {
      return '3 months after loan start';
    }
    return `${months} months after loan start`;
  } else if (frequency === 'yearly') {
    const firstPaymentYears = Math.round(offsetDays / 365);
    const years = isFirstPayment ? firstPaymentYears : firstPaymentYears + (paymentIndex - 1);

    if (years === 0) {
      return 'On loan start';
    }
    if (years === 1) {
      return '1 year after loan start';
    }
    return `${years} years after loan start`;
  } else if (frequency === 'custom_days') {
    const days = paymentIndex * offsetDays;

    if (days === 0) {
      return 'On loan start';
    }
    if (days === 1) {
      return '1 day after loan start';
    }
    return `${days} days after loan start`;
  }

  // Fallback
  return isFirstPayment && offsetDays === 0 ? 'On loan start' : `Payment ${paymentIndex}`;
}

/**
 * Generate complete repayment schedule based on configuration
 * @param {RepaymentScheduleConfig} config - Schedule configuration
 * @returns {RepaymentScheduleResult} Complete schedule with rows and totals
 */
function generateRepaymentSchedule(config) {
  const {
    principal,
    annualInterestRate,
    repaymentType,
    numInstallments = 1,
    paymentFrequency,
    loanStartMode,
    loanStartDate,
    firstPaymentOffsetDays,
    context
  } = config;

  const count = repaymentType === 'one_time' ? 1 : numInstallments;
  const hasRealDate = context.hasRealStartDate && loanStartDate;

  // Handle case where we don't have a real date yet (preview mode with upon_acceptance)
  if (!hasRealDate && loanStartMode === 'upon_acceptance') {
    // Generate schedule with relative labels, no actual dates
    return generatePreviewSchedule(config, count);
  }

  // We have a real date - generate actual schedule with dates
  if (!loanStartDate) {
    throw new Error('loanStartDate is required when hasRealStartDate is true');
  }

  return generateActualSchedule(config, count, loanStartDate);
}

/**
 * Generate preview schedule without real dates (for upon_acceptance mode before acceptance)
 * @param {RepaymentScheduleConfig} config - Schedule configuration
 * @param {number} count - Number of payments
 * @returns {RepaymentScheduleResult} Schedule with null dates and relative labels
 */
function generatePreviewSchedule(config, count) {
  const {
    principal,
    annualInterestRate,
    paymentFrequency,
    firstPaymentOffsetDays
  } = config;

  // For preview without dates, we still need to calculate interest
  // We'll use approximate period lengths to estimate interest
  const rows = [];
  let remainingBalance = principal;
  const principalPerPayment = principal / count;

  // Approximate days per period
  let daysPerPeriod;
  switch (paymentFrequency) {
    // New formats
    case 'every-3-days':
      daysPerPeriod = 3;
      break;
    case 'every-week':
      daysPerPeriod = 7;
      break;
    case 'every-month':
      daysPerPeriod = 30;
      break;
    case 'every-year':
      daysPerPeriod = 365;
      break;
    case 'once':
      daysPerPeriod = firstPaymentOffsetDays;
      break;
    // Legacy formats
    case 'weekly':
      daysPerPeriod = 7;
      break;
    case 'biweekly':
      daysPerPeriod = 14;
      break;
    case 'every_4_weeks':
      daysPerPeriod = 28;
      break;
    case 'monthly':
      daysPerPeriod = 30;
      break;
    case 'quarterly':
      daysPerPeriod = 91;
      break;
    case 'yearly':
      daysPerPeriod = 365;
      break;
    default:
      daysPerPeriod = 30; // Default to monthly
  }

  const dailyRate = (annualInterestRate / 100) / 365;
  let totalInterest = 0;

  for (let i = 1; i <= count; i++) {
    const outstandingBefore = remainingBalance;

    // Calculate days for this period (first payment includes offset)
    const daysForPeriod = i === 1 ? firstPaymentOffsetDays : daysPerPeriod;

    // Calculate interest
    const interestForPeriod = Math.round(outstandingBefore * dailyRate * daysForPeriod);
    const payment = Math.round(principalPerPayment) + interestForPeriod;

    remainingBalance -= principalPerPayment;
    if (remainingBalance < 1) remainingBalance = 0;

    totalInterest += interestForPeriod;

    rows.push({
      index: i,
      date: null,
      dateLabel: getRelativeDateLabel(i, paymentFrequency, firstPaymentOffsetDays),
      principal: Math.round(principalPerPayment),
      interest: interestForPeriod,
      totalPayment: payment,
      remainingBalance: Math.round(remainingBalance)
    });
  }

  return {
    rows,
    totalInterest: Math.round(totalInterest),
    totalToRepay: Math.round(principal + totalInterest)
  };
}

/**
 * Generate actual schedule with real dates
 * @param {RepaymentScheduleConfig} config - Schedule configuration
 * @param {number} count - Number of payments
 * @param {string|Date} startDate - Actual loan start date
 * @returns {RepaymentScheduleResult} Schedule with actual dates
 */
function generateActualSchedule(config, count, startDate) {
  const {
    principal,
    annualInterestRate,
    paymentFrequency,
    firstPaymentOffsetDays
  } = config;

  // Parse start date
  const transferDate = typeof startDate === 'string' ? new Date(startDate) : new Date(startDate);
  transferDate.setHours(0, 0, 0, 0);

  // Calculate first due date based on offset
  let firstDueDate = new Date(transferDate);
  firstDueDate.setDate(firstDueDate.getDate() + firstPaymentOffsetDays);

  // Generate payment dates using existing logic
  const { paymentDates, normalizedFirstDueDate } = generatePaymentDates({
    transferDate,
    firstDueDate,
    frequency: paymentFrequency,
    count
  });

  // Build schedule using existing logic
  const schedule = buildRepaymentSchedule({
    principalCents: principal,
    aprPercent: annualInterestRate,
    count,
    paymentDates,
    startDate: transferDate
  });

  // Transform to our output format
  const rows = schedule.rows.map((row, index) => ({
    index: index + 1,
    date: new Date(row.dateISO),
    dateLabel: formatScheduleDate(row.dateISO),
    principal: row.principalCents,
    interest: row.interestCents,
    totalPayment: row.paymentCents,
    remainingBalance: row.remainingCents
  }));

  return {
    rows,
    totalInterest: schedule.totalInterestCents,
    totalToRepay: schedule.totalToRepayCents
  };
}

module.exports = {
  generateRepaymentSchedule,
  getRelativeDateLabel
};
