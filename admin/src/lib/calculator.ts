/**
 * Calculation Debugger - Uses the LOCAL calculation engine
 * 
 * CRITICAL: This module imports and uses calculation functions that are
 * copied from production sources. The source of truth is now local.
 * 
 * Source of Truth Chain:
 * 1. admin/src/lib/calculations/schedule.ts - Core mathematical engine (copied from public/js/schedule.js)
 * 2. admin/src/lib/calculations/repaymentSchedule.ts - Wrapper (copied from lib/repayments/repaymentSchedule.js)
 * 3. This file - Admin debugger/calculator interface
 */

import { 
  generateRepaymentSchedule, 
  RepaymentScheduleConfig,
  RepaymentScheduleResult,
  RepaymentScheduleRow 
} from './calculations/repaymentSchedule';

export interface CalculationInput {
  principal: number;
  annualInterestRate: number;
  repaymentType: 'one_time' | 'installments';
  numInstallments: number;
  paymentFrequency: string;
  loanStartMode: 'fixed_date' | 'upon_acceptance';
  loanStartDate: string | null;
  firstPaymentOffsetDays: number;
}

export interface CalculationOutput {
  rows: Array<{
    index: number;
    date: Date | null;
    dateLabel: string;
    principal: number;
    interest: number;
    totalPayment: number;
    remainingBalance: number;
  }>;
  totalInterest: number;
  totalToRepay: number;
}

/**
 * Run the calculation engine on a set of inputs
 * Returns the calculated schedule for comparison with stored values
 */
export function runCalculation(input: CalculationInput): CalculationOutput | null {
  try {
    const config: RepaymentScheduleConfig = {
      principal: input.principal,
      annualInterestRate: input.annualInterestRate,
      repaymentType: input.repaymentType,
      numInstallments: input.numInstallments,
      paymentFrequency: input.paymentFrequency,
      loanStartMode: input.loanStartMode,
      loanStartDate: input.loanStartDate ? new Date(input.loanStartDate) : null,
      firstPaymentOffsetDays: input.firstPaymentOffsetDays,
      context: {
        preview: !input.loanStartDate,
        agreementStatus: 'active',
        hasRealStartDate: !!input.loanStartDate,
      },
    };

    const result = generateRepaymentSchedule(config);

    return {
      rows: result.rows,
      totalInterest: result.totalInterest,
      totalToRepay: result.totalToRepay,
    };
  } catch (error) {
    console.error('[Calculator] Calculation error:', error);
    return null;
  }
}

/**
 * Compare stored values with recomputed values
 */
export function compareCalculations(
  stored: { totalInterest: number; totalToRepay: number },
  computed: CalculationOutput
): {
  matches: boolean;
  interestDiff: number;
  totalDiff: number;
} {
  const interestDiff = Math.abs(stored.totalInterest - computed.totalInterest);
  const totalDiff = Math.abs(stored.totalToRepay - computed.totalToRepay);
  
  const matches = interestDiff <= 1 && totalDiff <= 1;

  return {
    matches,
    interestDiff,
    totalDiff,
  };
}

/**
 * Check if the calculation engine is available
 * Always returns true since we're using local imports now
 */
export function isEngineAvailable(): boolean {
  return true;
}

// Re-export types and functions that may be useful for the Calculator page
export { generateRepaymentSchedule } from './calculations/repaymentSchedule';
export type { RepaymentScheduleConfig, RepaymentScheduleResult, RepaymentScheduleRow };
