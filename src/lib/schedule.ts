/**
 * Repayment Schedule Calculator - Single Source of Truth
 * 
 * This module provides all loan repayment calculations used across
 * the wizard, review, and management pages.
 * 
 * Ported from old/public/js/schedule.js to TypeScript.
 */

// ============================================================================
// TYPES
// ============================================================================

export type PaymentFrequency = 
  | 'weekly' 
  | 'biweekly' 
  | 'every_4_weeks' 
  | 'monthly' 
  | 'quarterly' 
  | 'yearly';

export type RepaymentType = 'one_time' | 'installments';

export type LoanStartMode = 'upon_acceptance' | 'today' | 'tomorrow' | 'pick_date';

export interface ScheduleRow {
  index: number;
  dateISO: string;
  date: Date;
  dateLabel: string;
  principalCents: number;
  interestCents: number;
  paymentCents: number;
  remainingCents: number;
}

export interface RepaymentSchedule {
  rows: ScheduleRow[];
  totalPrincipalCents: number;
  totalInterestCents: number;
  totalToRepayCents: number;
  loanDurationMonths: number;
  firstPaymentDate: Date | null;
  lastPaymentDate: Date | null;
}

export interface ScheduleConfig {
  principalCents: number;
  aprPercent: number;
  count: number;
  paymentDates: Date[];
  startDate: Date;
}

export interface DateGenerationParams {
  transferDate: Date;
  firstDueDate: Date;
  frequency: PaymentFrequency;
  count: number;
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Format date as "5 Apr 2025"
 */
export function formatScheduleDate(dateInput: Date | string | null): string {
  if (!dateInput) return '—';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const day = date.getDate();
  const month = date.toLocaleDateString('en-GB', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Add months while preserving day-of-month (or clamping to valid day)
 */
export function addMonthsKeepingDay(date: Date, months: number): Date {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;
  const targetYear = result.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  const originalDay = result.getDate();
  result.setFullYear(targetYear, normalizedMonth, 1);
  const daysInTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const clampedDay = Math.min(originalDay, daysInTargetMonth);
  result.setDate(clampedDay);

  return result;
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add exactly one period to a date based on frequency
 */
export function addOnePeriod(dateInput: Date | string, frequency: PaymentFrequency): Date {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput);
  date.setHours(0, 0, 0, 0);

  switch (frequency) {
    case 'weekly':
      return new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'biweekly':
      return new Date(date.getTime() + 14 * 24 * 60 * 60 * 1000);
    case 'every_4_weeks':
      return new Date(date.getTime() + 28 * 24 * 60 * 60 * 1000);
    case 'monthly':
      return addMonthsKeepingDay(date, 1);
    case 'quarterly':
      return addMonthsKeepingDay(date, 3);
    case 'yearly':
      return addMonthsKeepingDay(date, 12);
    default:
      console.warn(`Unknown frequency "${frequency}", defaulting to monthly`);
      return addMonthsKeepingDay(date, 1);
  }
}

/**
 * Normalize first due date to ensure it's at least 1 period after transfer date.
 * Business rule: Never allow zero-length first period (which would yield zero interest).
 */
export function normalizeFirstDueDate(
  transferDate: Date | string, 
  firstDueDate: Date | string, 
  frequency: PaymentFrequency
): Date {
  const transfer = typeof transferDate === 'string' ? new Date(transferDate) : new Date(transferDate);
  const firstDue = typeof firstDueDate === 'string' ? new Date(firstDueDate) : new Date(firstDueDate);

  transfer.setHours(0, 0, 0, 0);
  firstDue.setHours(0, 0, 0, 0);

  // If first due date is on or before transfer date, shift forward by exactly 1 period
  if (firstDue <= transfer) {
    return addOnePeriod(transfer, frequency);
  }

  return firstDue;
}

/**
 * Get the approximate number of days per period for a given frequency
 */
export function getDaysPerPeriod(frequency: PaymentFrequency): number {
  switch (frequency) {
    case 'weekly': return 7;
    case 'biweekly': return 14;
    case 'every_4_weeks': return 28;
    case 'monthly': return 30;
    case 'quarterly': return 91;
    case 'yearly': return 365;
    default: return 30;
  }
}

// ============================================================================
// DATE GENERATION
// ============================================================================

/**
 * Generate payment dates based on frequency, count, first due date, and transfer date.
 */
export function generatePaymentDates(params: DateGenerationParams): {
  paymentDates: Date[];
  normalizedFirstDueDate: Date;
} {
  const { transferDate, firstDueDate, frequency, count } = params;

  // Normalize first due date to ensure minimum 1-period accrual
  const normalizedFirst = normalizeFirstDueDate(transferDate, firstDueDate, frequency);

  const paymentDates: Date[] = [];
  let currentDate = new Date(normalizedFirst);

  for (let i = 0; i < count; i++) {
    paymentDates.push(new Date(currentDate));
    if (i < count - 1) {
      currentDate = addOnePeriod(currentDate, frequency);
    }
  }

  return {
    paymentDates,
    normalizedFirstDueDate: normalizedFirst
  };
}

// ============================================================================
// CORE SCHEDULE CALCULATION - SINGLE SOURCE OF TRUTH
// ============================================================================

/**
 * Build an equal-principal repayment schedule with daily interest calculation.
 * 
 * This is the SINGLE SOURCE OF TRUTH for all interest calculations.
 * Uses actual days between payments for precise interest calculation.
 */
export function buildRepaymentSchedule(input: ScheduleConfig): RepaymentSchedule {
  const { principalCents, aprPercent, count, paymentDates, startDate } = input;

  // Convert to working values
  const principal = principalCents / 100; // Convert cents to euros
  const annualRate = aprPercent / 100; // Convert percentage to decimal
  const dailyRate = annualRate / 365; // Daily interest rate
  const principalPerPayment = principal / count;

  let totalInterest = 0;
  const rows: ScheduleRow[] = [];

  // Parse start date
  let previousDate = new Date(startDate);
  previousDate.setHours(0, 0, 0, 0);

  // Build schedule row by row
  for (let i = 1; i <= count; i++) {
    const outstandingBefore = principal - principalPerPayment * (i - 1);

    // Get payment date
    const currentPaymentDate = new Date(paymentDates[i - 1]);
    currentPaymentDate.setHours(0, 0, 0, 0);

    // Calculate days between payments for daily interest
    const daysBetweenPayments = Math.round(
      (currentPaymentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate interest for this period based on actual days
    const interestForPeriod = outstandingBefore * dailyRate * daysBetweenPayments;
    const payment = principalPerPayment + interestForPeriod;
    const remainingAfter = outstandingBefore - principalPerPayment;

    totalInterest += interestForPeriod;

    rows.push({
      index: i,
      dateISO: currentPaymentDate.toISOString(),
      date: currentPaymentDate,
      dateLabel: formatScheduleDate(currentPaymentDate),
      principalCents: Math.round(principalPerPayment * 100),
      interestCents: Math.round(interestForPeriod * 100),
      paymentCents: Math.round(payment * 100),
      remainingCents: remainingAfter > 0.01 ? Math.round(remainingAfter * 100) : 0
    });

    previousDate = currentPaymentDate;
  }

  const totalInterestCents = Math.round(totalInterest * 100);
  const totalToRepayCents = principalCents + totalInterestCents;

  // Calculate loan duration in months
  const firstPaymentDate = rows.length > 0 ? rows[0].date : null;
  const lastPaymentDate = rows.length > 0 ? rows[rows.length - 1].date : null;
  let loanDurationMonths = 0;
  
  if (firstPaymentDate && lastPaymentDate) {
    const yearsDiff = lastPaymentDate.getFullYear() - startDate.getFullYear();
    const monthsDiff = lastPaymentDate.getMonth() - startDate.getMonth();
    loanDurationMonths = Math.max(0, yearsDiff * 12 + monthsDiff);
  }

  return {
    rows,
    totalPrincipalCents: principalCents,
    totalInterestCents,
    totalToRepayCents,
    loanDurationMonths,
    firstPaymentDate,
    lastPaymentDate
  };
}

// ============================================================================
// HIGH-LEVEL SCHEDULE GENERATOR
// ============================================================================

export interface LoanScheduleParams {
  principalCents: number;
  aprPercent: number;
  repaymentType: RepaymentType;
  installmentCount: number;
  frequency: PaymentFrequency;
  loanStartDate: Date;
  firstPaymentOffset: 'week' | 'month' | '6months' | 'year' | 'custom';
  customFirstPaymentDate?: Date;
}

/**
 * Generate a complete loan schedule from user-friendly parameters
 */
export function generateLoanSchedule(params: LoanScheduleParams): RepaymentSchedule {
  const {
    principalCents,
    aprPercent,
    repaymentType,
    installmentCount,
    frequency,
    loanStartDate,
    firstPaymentOffset,
    customFirstPaymentDate
  } = params;

  const count = repaymentType === 'one_time' ? 1 : installmentCount;
  
  // Calculate first payment date based on offset
  let firstDueDate: Date;
  
  if (customFirstPaymentDate) {
    firstDueDate = new Date(customFirstPaymentDate);
  } else {
    const startDate = new Date(loanStartDate);
    startDate.setHours(0, 0, 0, 0);
    
    switch (firstPaymentOffset) {
      case 'week':
        firstDueDate = addDays(startDate, 7);
        break;
      case 'month':
        firstDueDate = addMonthsKeepingDay(startDate, 1);
        break;
      case '6months':
        firstDueDate = addMonthsKeepingDay(startDate, 6);
        break;
      case 'year':
        firstDueDate = addMonthsKeepingDay(startDate, 12);
        break;
      default:
        firstDueDate = addMonthsKeepingDay(startDate, 1);
    }
  }

  // Generate payment dates
  const { paymentDates } = generatePaymentDates({
    transferDate: loanStartDate,
    firstDueDate,
    frequency: repaymentType === 'one_time' ? 'monthly' : frequency,
    count
  });

  // Build schedule
  return buildRepaymentSchedule({
    principalCents,
    aprPercent,
    count,
    paymentDates,
    startDate: loanStartDate
  });
}

// ============================================================================
// PREVIEW SCHEDULE (for wizard - relative labels, no real dates)
// ============================================================================

export interface PreviewScheduleRow {
  index: number;
  dateLabel: string;
  principalCents: number;
  interestCents: number;
  paymentCents: number;
  remainingCents: number;
}

export interface PreviewSchedule {
  rows: PreviewScheduleRow[];
  totalPrincipalCents: number;
  totalInterestCents: number;
  totalToRepayCents: number;
}

/**
 * Generate a preview schedule with relative date labels (for wizard before dates are picked)
 */
export function generatePreviewSchedule(params: {
  principalCents: number;
  aprPercent: number;
  count: number;
  frequency: PaymentFrequency;
  firstPaymentOffset: 'week' | 'month' | '6months' | 'year';
}): PreviewSchedule {
  const { principalCents, aprPercent, count, frequency, firstPaymentOffset } = params;

  const principal = principalCents / 100;
  const dailyRate = (aprPercent / 100) / 365;
  const principalPerPayment = principal / count;
  const daysPerPeriod = getDaysPerPeriod(frequency);
  
  // Get first payment offset in days
  let firstOffsetDays: number;
  switch (firstPaymentOffset) {
    case 'week': firstOffsetDays = 7; break;
    case 'month': firstOffsetDays = 30; break;
    case '6months': firstOffsetDays = 182; break;
    case 'year': firstOffsetDays = 365; break;
    default: firstOffsetDays = 30;
  }

  const rows: PreviewScheduleRow[] = [];
  let remainingBalance = principal;
  let totalInterest = 0;

  for (let i = 1; i <= count; i++) {
    const outstandingBefore = remainingBalance;
    const daysForPeriod = i === 1 ? firstOffsetDays : daysPerPeriod;
    
    const interestForPeriod = outstandingBefore * dailyRate * daysForPeriod;
    const payment = principalPerPayment + interestForPeriod;
    
    remainingBalance -= principalPerPayment;
    if (remainingBalance < 0.01) remainingBalance = 0;
    
    totalInterest += interestForPeriod;

    // Generate relative date label
    let dateLabel: string;
    if (i === 1) {
      switch (firstPaymentOffset) {
        case 'week': dateLabel = '1 week after loan start'; break;
        case 'month': dateLabel = '1 month after loan start'; break;
        case '6months': dateLabel = '6 months after loan start'; break;
        case 'year': dateLabel = '1 year after loan start'; break;
        default: dateLabel = '1 month after loan start';
      }
    } else {
      // Calculate cumulative offset
      const periodsAfterFirst = i - 1;
      if (frequency === 'monthly') {
        const months = (firstPaymentOffset === 'month' ? 1 : firstPaymentOffset === '6months' ? 6 : 12) + periodsAfterFirst;
        dateLabel = `${months} months after loan start`;
      } else if (frequency === 'weekly') {
        const weeks = (firstPaymentOffset === 'week' ? 1 : 4) + periodsAfterFirst;
        dateLabel = `${weeks} weeks after loan start`;
      } else if (frequency === 'yearly') {
        const years = 1 + periodsAfterFirst;
        dateLabel = years === 1 ? '1 year after loan start' : `${years} years after loan start`;
      } else {
        dateLabel = `Payment ${i}`;
      }
    }

    rows.push({
      index: i,
      dateLabel,
      principalCents: Math.round(principalPerPayment * 100),
      interestCents: Math.round(interestForPeriod * 100),
      paymentCents: Math.round(payment * 100),
      remainingCents: Math.round(remainingBalance * 100)
    });
  }

  return {
    rows,
    totalPrincipalCents: principalCents,
    totalInterestCents: Math.round(totalInterest * 100),
    totalToRepayCents: principalCents + Math.round(totalInterest * 100)
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format frequency for display
 */
export function formatFrequency(frequency: PaymentFrequency): string {
  const map: Record<PaymentFrequency, string> = {
    weekly: 'Weekly',
    biweekly: 'Every 2 weeks',
    every_4_weeks: 'Every 4 weeks',
    monthly: 'Monthly',
    quarterly: 'Every 3 months',
    yearly: 'Yearly'
  };
  return map[frequency] || frequency;
}

/**
 * Format duration in months as "X years Y months"
 */
export function formatDuration(totalMonths: number): string {
  if (totalMonths === 0) return '0 months';
  
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years === 1 ? '' : 's'}`);
  if (months > 0) parts.push(`${months} month${months === 1 ? '' : 's'}`);
  
  return parts.join(' ');
}
