/**
 * Central repayment schedule generator - single source of truth
 * Handles both preview contexts (no real dates) and actual contexts (with real dates)
 * 
 * COPIED FROM: lib/repayments/repaymentSchedule.js
 * This wraps the core schedule.ts engine for higher-level usage
 */

import {
  addMonthsKeepingDay,
  addOnePeriod,
  normalizeFirstDueDate,
  generatePaymentDates,
  buildRepaymentSchedule,
  formatScheduleDate
} from './schedule';

export type RepaymentType = 'one_time' | 'installments';
export type LoanStartMode = 'fixed_date' | 'upon_acceptance';
export type PaymentFrequencyCode = 
  | 'monthly' | 'weekly' | 'biweekly' | 'every_4_weeks' | 'quarterly' | 'yearly' 
  | 'custom_days' | 'every-3-days' | 'every-week' | 'every-month' | 'every-year' | 'once';

export interface ScheduleContext {
  preview: boolean;
  agreementStatus: 'pending' | 'active' | 'settled';
  hasRealStartDate: boolean;
}

export interface RepaymentScheduleConfig {
  principal: number;
  annualInterestRate: number;
  repaymentType: RepaymentType;
  numInstallments?: number;
  paymentFrequency: PaymentFrequencyCode | string;
  loanStartMode: LoanStartMode;
  loanStartDate?: string | Date | null;
  firstPaymentOffsetDays: number;
  context: ScheduleContext;
}

export interface RepaymentScheduleRow {
  index: number;
  date: Date | null;
  dateLabel: string;
  principal: number;
  interest: number;
  totalPayment: number;
  remainingBalance: number;
}

export interface RepaymentScheduleResult {
  rows: RepaymentScheduleRow[];
  totalInterest: number;
  totalToRepay: number;
}

/**
 * Get human-readable label for relative time after loan start
 */
export function getRelativeDateLabel(
  paymentIndex: number,
  frequency: PaymentFrequencyCode | string,
  offsetDays: number
): string {
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
 * Generate preview schedule without real dates (for upon_acceptance mode before acceptance)
 */
function generatePreviewSchedule(config: RepaymentScheduleConfig, count: number): RepaymentScheduleResult {
  const {
    principal,
    annualInterestRate,
    paymentFrequency,
    firstPaymentOffsetDays
  } = config;

  // For preview without dates, we still need to calculate interest
  // We'll use approximate period lengths to estimate interest
  const rows: RepaymentScheduleRow[] = [];
  let remainingBalance = principal;
  const principalPerPayment = principal / count;

  // Approximate days per period
  let daysPerPeriod: number;
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
 */
function generateActualSchedule(
  config: RepaymentScheduleConfig,
  count: number,
  startDate: string | Date
): RepaymentScheduleResult {
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
  const firstDueDate = new Date(transferDate);
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
  const rows: RepaymentScheduleRow[] = schedule.rows.map((row, index) => ({
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

/**
 * Generate complete repayment schedule based on configuration
 */
export function generateRepaymentSchedule(config: RepaymentScheduleConfig): RepaymentScheduleResult {
  const {
    repaymentType,
    numInstallments = 1,
    loanStartMode,
    loanStartDate,
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

// Re-export core functions for convenience
export {
  formatScheduleDate,
  addMonthsKeepingDay,
  addOnePeriod,
  normalizeFirstDueDate,
  generatePaymentDates,
  buildRepaymentSchedule
} from './schedule';
