'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency2 } from '@/lib/formatters';
import {
  PaymentFrequency,
  RepaymentType,
  generatePreviewSchedule,
  generateLoanSchedule,
  formatFrequency,
  formatDuration,
  formatScheduleDate,
  addDays,
  addMonthsKeepingDay,
} from '@/lib/schedule';

type FirstPaymentOffset = 'week' | 'month' | '6months' | 'year' | 'custom';
type LoanStartMode = 'upon_acceptance' | 'today' | 'tomorrow' | 'week' | 'month' | 'pick_date';
type InterestMode = 'interest' | 'no-interest';

// Unified row type for display
interface DisplayRow {
  index: number;
  dateLabel: string;
  principalCents: number;
  interestCents: number;
  paymentCents: number;
  remainingCents: number;
}

// Unified schedule type for display
interface DisplaySchedule {
  rows: DisplayRow[];
  totalPrincipalCents: number;
  totalInterestCents: number;
  totalToRepayCents: number;
  loanDurationMonths?: number;
}

interface LoanConfig {
  principal: string;
  loanStartMode: LoanStartMode;
  loanStartDate: string;
  repaymentType: RepaymentType;
  firstPaymentOffset: FirstPaymentOffset;
  firstPaymentDate: string;
  frequency: PaymentFrequency;
  installmentCount: number;
  interestMode: InterestMode;
  interestRate: number;
}

const initialConfig: LoanConfig = {
  principal: '',
  loanStartMode: 'upon_acceptance',
  loanStartDate: '',
  repaymentType: 'one_time',
  firstPaymentOffset: 'year',
  firstPaymentDate: '',
  frequency: 'monthly',
  installmentCount: 12,
  interestMode: 'interest',
  interestRate: 5,
};

export default function CalculatePage() {
  const router = useRouter();
  const [config, setConfig] = useState<LoanConfig>(initialConfig);
  const [showFairRangeExplanation, setShowFairRangeExplanation] = useState(false);
  const [showFairnessExplanation, setShowFairnessExplanation] = useState(false);
  const [creatingAgreement, setCreatingAgreement] = useState(false);
  const [error, setError] = useState('');

  const updateConfig = (updates: Partial<LoanConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  // Parse principal to cents
  const parsePrincipal = (value: string): number => {
    const cleaned = value.replace(/[.,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.round(num * 100);
  };

  // Format principal for display
  const formatPrincipalDisplay = (value: string): string => {
    const num = parsePrincipal(value) / 100;
    if (num <= 0) return '';
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  // Calculate loan start date
  const getLoanStartDate = useCallback((): Date | null => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (config.loanStartMode) {
      case 'upon_acceptance':
        return null;
      case 'today':
        return today;
      case 'tomorrow':
        return addDays(today, 1);
      case 'week':
        return addDays(today, 7);
      case 'month':
        return addMonthsKeepingDay(today, 1);
      case 'pick_date':
        return config.loanStartDate ? new Date(config.loanStartDate + 'T00:00:00') : null;
      default:
        return null;
    }
  }, [config.loanStartMode, config.loanStartDate]);

  // Calculate first payment date
  const getFirstPaymentDate = useCallback((startDate: Date | null): Date | null => {
    if (!startDate) return null;

    if (config.firstPaymentOffset === 'custom' && config.firstPaymentDate) {
      return new Date(config.firstPaymentDate + 'T00:00:00');
    }

    switch (config.firstPaymentOffset) {
      case 'week':
        return addDays(startDate, 7);
      case 'month':
        return addMonthsKeepingDay(startDate, 1);
      case '6months':
        return addMonthsKeepingDay(startDate, 6);
      case 'year':
        return addMonthsKeepingDay(startDate, 12);
      default:
        return addMonthsKeepingDay(startDate, 1);
    }
  }, [config.firstPaymentOffset, config.firstPaymentDate]);

  // Get effective interest rate
  const effectiveInterestRate = config.interestMode === 'no-interest' ? 0 : config.interestRate;

  // Calculate fair range based on loan parameters
  const fairRange = useMemo(() => {
    const principalCents = parsePrincipal(config.principal);
    let minRate = 4;
    let maxRate = 7;

    // Adjust for amount
    if (principalCents > 1000000) { // > €10,000
      minRate += 1;
      maxRate += 1;
    } else if (principalCents < 200000) { // < €2,000
      minRate = Math.max(3, minRate - 1);
      maxRate = Math.max(5, maxRate - 1);
    }

    // Adjust for duration
    const durationMonths = config.firstPaymentOffset === 'year' ? 12 :
      config.firstPaymentOffset === '6months' ? 6 :
        config.firstPaymentOffset === 'month' ? 1 : 12;
    const totalMonths = config.repaymentType === 'installments'
      ? durationMonths + config.installmentCount
      : durationMonths;

    if (totalMonths > 24) {
      minRate += 1;
      maxRate += 1;
    } else if (totalMonths < 6) {
      minRate = Math.max(3, minRate - 1);
      maxRate = Math.max(5, maxRate - 1);
    }

    // Adjust for installments
    if (config.repaymentType === 'installments' && config.installmentCount >= 12) {
      maxRate = Math.max(5, maxRate - 1);
    }

    return { min: minRate, max: maxRate };
  }, [config.principal, config.repaymentType, config.installmentCount, config.firstPaymentOffset]);

  // Generate schedule
  const schedule = useMemo((): DisplaySchedule | null => {
    const principalCents = parsePrincipal(config.principal);
    if (principalCents <= 0) return null;

    const count = config.repaymentType === 'one_time' ? 1 : config.installmentCount;
    const loanStartDate = getLoanStartDate();

    // If we have a real start date, generate actual schedule
    if (loanStartDate) {
      const firstPaymentDate = getFirstPaymentDate(loanStartDate);
      const result = generateLoanSchedule({
        principalCents,
        aprPercent: effectiveInterestRate,
        repaymentType: config.repaymentType,
        installmentCount: count,
        frequency: config.frequency,
        loanStartDate,
        firstPaymentOffset: config.firstPaymentOffset,
        customFirstPaymentDate: firstPaymentDate || undefined,
      });
      
      // Transform to display format
      return {
        rows: result.rows.map(row => ({
          index: row.index,
          dateLabel: row.dateLabel,
          principalCents: row.principalCents,
          interestCents: row.interestCents,
          paymentCents: row.paymentCents,
          remainingCents: row.remainingCents,
        })),
        totalPrincipalCents: result.totalPrincipalCents,
        totalInterestCents: result.totalInterestCents,
        totalToRepayCents: result.totalToRepayCents,
        loanDurationMonths: result.loanDurationMonths,
      };
    }

    // Otherwise generate preview schedule
    // Map custom to year for preview (we can't preview custom without a date)
    const previewOffset = config.firstPaymentOffset === 'custom' ? 'year' : config.firstPaymentOffset;
    const result = generatePreviewSchedule({
      principalCents,
      aprPercent: effectiveInterestRate,
      count,
      frequency: config.frequency,
      firstPaymentOffset: previewOffset,
    });
    
    // Transform to display format
    return {
      rows: result.rows.map(row => ({
        index: row.index,
        dateLabel: row.dateLabel,
        principalCents: row.principalCents,
        interestCents: row.interestCents,
        paymentCents: row.paymentCents,
        remainingCents: row.remainingCents,
      })),
      totalPrincipalCents: result.totalPrincipalCents,
      totalInterestCents: result.totalInterestCents,
      totalToRepayCents: result.totalToRepayCents,
    };
  }, [
    config.principal,
    config.repaymentType,
    config.installmentCount,
    config.frequency,
    config.firstPaymentOffset,
    effectiveInterestRate,
    getLoanStartDate,
    getFirstPaymentDate,
  ]);

  // Loan start label
  const loanStartLabel = useMemo(() => {
    const date = getLoanStartDate();
    if (date) {
      return formatScheduleDate(date);
    }
    return 'When agreement is accepted';
  }, [getLoanStartDate]);

  // Loan duration label
  const loanDurationLabel = useMemo(() => {
    if (!schedule || schedule.rows.length === 0) return null;

    // If we have loanDurationMonths (actual schedule)
    if (schedule.loanDurationMonths && schedule.loanDurationMonths > 0) {
      return formatDuration(schedule.loanDurationMonths);
    }

    // For preview, use last row's date label
    const lastRow = schedule.rows[schedule.rows.length - 1];
    return lastRow.dateLabel;
  }, [schedule]);

  // Handle repayment type change
  useEffect(() => {
    if (config.repaymentType === 'one_time') {
      updateConfig({ installmentCount: 1 });
    } else if (config.installmentCount === 1) {
      updateConfig({ installmentCount: 12 });
    }
  }, [config.repaymentType, config.installmentCount]);

  // Reset calculator
  const handleReset = () => {
    setConfig(initialConfig);
    setShowFairRangeExplanation(false);
    setShowFairnessExplanation(false);
  };

  // Create agreement (simplified - could be expanded with more borrower details)
  const handleCreateAgreement = async () => {
    const principalCents = parsePrincipal(config.principal);
    if (principalCents <= 0) {
      setError('Please enter a valid loan amount');
      return;
    }

    setCreatingAgreement(true);
    setError('');

    try {
      // For now, redirect to a more detailed creation flow or dashboard
      // In a full implementation, this would create a draft agreement
      router.push(`/dashboard?amount=${principalCents}&interest=${effectiveInterestRate}&type=${config.repaymentType}`);
    } catch {
      setError('Failed to create agreement. Please try again.');
      setCreatingAgreement(false);
    }
  };

  const principalCents = parsePrincipal(config.principal);
  const hasValidPrincipal = principalCents > 0;
  const isPreviewMode = config.loanStartMode === 'upon_acceptance';

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <Link href="/dashboard" className="text-sm text-pf-accent mb-2 block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-semibold">Loan Calculator</h1>
          <p className="text-sm text-pf-muted mt-1">Calculate repayment schedules and interest for loans between friends</p>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
        {/* Left: Configuration card */}
        <div className="card p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold">Configuration</h2>
            <button
              onClick={handleReset}
              className="text-sm text-pf-accent hover:underline"
            >
              Reset
            </button>
          </div>

          {/* Loan amount */}
          <div className="mb-5">
            <label className="block text-sm text-pf-muted mb-2">Loan amount (EUR)</label>
            <input
              type="text"
              value={config.principal}
              onChange={(e) => updateConfig({ principal: e.target.value })}
              onBlur={(e) => {
                const formatted = formatPrincipalDisplay(e.target.value);
                if (formatted) updateConfig({ principal: formatted });
              }}
              placeholder="e.g. 6,000"
              className={`input ${!config.principal ? 'border-pf-accent' : ''}`}
            />
          </div>

          {/* Loan start date */}
          <div className="mb-5">
            <label className="block text-sm text-pf-muted mb-2">Loan start date</label>
            <select
              value={config.loanStartMode}
              onChange={(e) => updateConfig({ loanStartMode: e.target.value as LoanStartMode })}
              className="input"
            >
              <option value="upon_acceptance">When agreement is accepted</option>
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="week">In 1 week</option>
              <option value="month">In 1 month</option>
              <option value="pick_date">Pick a date...</option>
            </select>
            <p className="text-xs text-pf-muted mt-1 italic">Date used for interest calculations</p>
          </div>

          {config.loanStartMode === 'pick_date' && (
            <div className="mb-5">
              <label className="block text-sm text-pf-muted mb-2">Pick a date</label>
              <input
                type="date"
                value={config.loanStartDate}
                onChange={(e) => updateConfig({ loanStartDate: e.target.value })}
                className="input"
              />
            </div>
          )}

          {/* Repayment type */}
          <div className="mb-5">
            <label className="block text-sm text-pf-muted mb-2">Repayment type</label>
            <select
              value={config.repaymentType}
              onChange={(e) => updateConfig({ repaymentType: e.target.value as RepaymentType })}
              className="input"
            >
              <option value="one_time">One-time payment</option>
              <option value="installments">Installments</option>
            </select>
          </div>

          {/* First payment due */}
          <div className="mb-5">
            <label className="block text-sm text-pf-muted mb-2">
              {config.repaymentType === 'one_time' ? 'Full repayment due' : 'First payment due'}
            </label>
            <select
              value={config.firstPaymentOffset}
              onChange={(e) => updateConfig({ firstPaymentOffset: e.target.value as FirstPaymentOffset })}
              className="input"
            >
              <option value="week">In 1 week</option>
              <option value="month">In 1 month</option>
              <option value="6months">In 6 months</option>
              <option value="year">In 1 year</option>
              <option value="custom">Pick a date...</option>
            </select>
            <p className="text-xs text-pf-muted mt-1 italic">
              {config.repaymentType === 'one_time' ? 'When full repayment is due' : 'When first payment is due'}
            </p>
          </div>

          {config.firstPaymentOffset === 'custom' && (
            <div className="mb-5">
              <label className="block text-sm text-pf-muted mb-2">Pick a date</label>
              <input
                type="date"
                value={config.firstPaymentDate}
                onChange={(e) => updateConfig({ firstPaymentDate: e.target.value })}
                className="input"
              />
            </div>
          )}

          {/* Payment frequency (installments only) */}
          {config.repaymentType === 'installments' && (
            <div className="mb-5">
              <label className="block text-sm text-pf-muted mb-2">Payment frequency</label>
              <select
                value={config.frequency}
                onChange={(e) => updateConfig({ frequency: e.target.value as PaymentFrequency })}
                className="input"
              >
                <optgroup label="Week-based">
                  <option value="weekly">Every week</option>
                  <option value="biweekly">Every 2 weeks</option>
                  <option value="every_4_weeks">Every 4 weeks</option>
                </optgroup>
                <optgroup label="Month-based">
                  <option value="monthly">Every month</option>
                  <option value="quarterly">Every 3 months</option>
                </optgroup>
                <optgroup label="Year-based">
                  <option value="yearly">Every year</option>
                </optgroup>
              </select>
            </div>
          )}

          {/* Number of installments */}
          {config.repaymentType === 'installments' && (
            <div className="mb-5">
              <label className="block text-sm text-pf-muted mb-2">Number of installments</label>
              <input
                type="number"
                value={config.installmentCount}
                onChange={(e) => updateConfig({ installmentCount: parseInt(e.target.value) || 1 })}
                min="2"
                max="120"
                className="input"
              />
            </div>
          )}

          {/* Loan timing info */}
          {hasValidPrincipal && (
            <div className="mb-5 text-sm">
              <p>Loan start: {loanStartLabel}</p>
              {loanDurationLabel && (
                <p className="text-pf-accent mt-1">Loan duration: {loanDurationLabel}</p>
              )}
            </div>
          )}

          {/* Interest section */}
          <div className="pt-5 mt-5 border-t border-pf-card-border">
            <label className="block text-sm text-pf-muted mb-3">Interest</label>

            {/* Interest toggle */}
            <div className="inline-flex bg-pf-dark rounded-lg p-1 gap-1 mb-4">
              <button
                onClick={() => updateConfig({ interestMode: 'interest' })}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  config.interestMode === 'interest'
                    ? 'bg-pf-accent text-black'
                    : 'text-pf-text'
                }`}
              >
                Interest
              </button>
              <button
                onClick={() => updateConfig({ interestMode: 'no-interest' })}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  config.interestMode === 'no-interest'
                    ? 'bg-pf-accent text-black'
                    : 'text-pf-text'
                }`}
              >
                No interest
              </button>
            </div>

            {/* Interest input */}
            {config.interestMode === 'interest' && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.interestRate}
                    onChange={(e) => updateConfig({ interestRate: parseFloat(e.target.value) || 0 })}
                    min="0"
                    max="100"
                    step="0.1"
                    className="input w-20 text-center"
                  />
                  <span className="text-sm font-medium">% per year</span>
                </div>

                {/* Fair range pill */}
                <button
                  onClick={() => setShowFairRangeExplanation(!showFairRangeExplanation)}
                  className="px-4 py-2 rounded-full text-xs font-semibold bg-pf-accent/15 text-pf-accent flex items-center gap-1.5"
                >
                  <span>Fair range ({fairRange.min}–{fairRange.max}%)</span>
                  <svg className="w-3.5 h-3.5 opacity-80" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                    <circle cx="8" cy="8" r="6.5" strokeWidth="1.5" />
                    <path d="M8 7.5v4M8 5v0.5" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            )}

            {/* Fair range explanation */}
            {showFairRangeExplanation && config.interestMode === 'interest' && (
              <div className="mt-3 p-4 bg-pf-accent/10 border border-pf-accent/20 rounded-lg text-sm">
                <p className="font-semibold mb-2">Why this rate?</p>
                <ul className="list-disc pl-5 space-y-1 text-pf-muted">
                  <li>Larger loan amounts increase risk</li>
                  <li>Longer durations increase uncertainty</li>
                  <li>More installments reduce repayment risk</li>
                </ul>
                <p className="mt-3 text-pf-muted text-xs">
                  Together, these factors suggest a fair interest range. Your chosen rate should stay inside this range for balanced, respectful lending between friends.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Results */}
        <div className="space-y-6">
          {/* Schedule table */}
          <div className="card p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Repayment Schedule</h2>
              <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${
                isPreviewMode
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-pf-accent/20 text-pf-accent'
              }`}>
                {isPreviewMode ? 'Preview' : 'Actual'}
              </span>
            </div>

            {!hasValidPrincipal ? (
              <div className="text-center py-10 text-pf-muted">
                Enter loan amount and details to calculate...
              </div>
            ) : schedule ? (
              <>
                <div className="overflow-x-auto border border-pf-card-border rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-pf-card/50 border-b border-pf-card-border">
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-pf-muted uppercase">#</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-pf-muted uppercase">Due date</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-pf-muted uppercase">Principal</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-pf-muted uppercase">Interest</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-pf-muted uppercase">Total</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-pf-muted uppercase">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.rows.map((row, idx) => (
                        <tr
                          key={row.index}
                          className={`border-b border-pf-card-border/50 ${idx % 2 === 0 ? '' : 'bg-pf-dark/30'}`}
                        >
                          <td className="px-3 py-2.5">{row.index}</td>
                          <td className="px-3 py-2.5 text-pf-muted">
                            {row.dateLabel}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency2(row.principalCents)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency2(row.interestCents)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{formatCurrency2(row.paymentCents)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency2(row.remainingCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-pf-accent/50 text-pf-accent font-semibold">
                        <td colSpan={2} className="px-3 py-3 uppercase text-xs">Loan totals</td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatCurrency2(schedule.totalPrincipalCents)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatCurrency2(schedule.totalInterestCents)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatCurrency2(schedule.totalToRepayCents)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            ) : null}
          </div>

          {/* Loan summary */}
          {hasValidPrincipal && schedule && (
            <div className="card p-6 bg-pf-accent/10 border-pf-accent/30">
              <h2 className="text-lg font-semibold text-pf-accent mb-4">Loan Summary</h2>
              <div className="space-y-2 text-sm">
                <SummaryRow label="Loan amount" value={formatCurrency2(parsePrincipal(config.principal))} />
                <SummaryRow
                  label="Repayment type"
                  value={config.repaymentType === 'one_time' ? 'One-time payment' : `${config.installmentCount} installments`}
                />
                {config.repaymentType === 'installments' && (
                  <SummaryRow label="Frequency" value={formatFrequency(config.frequency)} />
                )}
                {loanDurationLabel && (
                  <SummaryRow label="Loan duration" value={loanDurationLabel} />
                )}
                <SummaryRow
                  label="Annual interest rate"
                  value={effectiveInterestRate === 0 ? 'No interest (0%)' : `${effectiveInterestRate}% per year`}
                />
                <div className="border-t border-pf-card-border my-3" />
                <SummaryRow
                  label="Total interest"
                  value={formatCurrency2(schedule.totalInterestCents)}
                  icon
                />
                <SummaryRow
                  label="Total to repay"
                  value={formatCurrency2(schedule.totalToRepayCents)}
                  highlight
                  icon
                />
              </div>

              {/* Fairness explanation */}
              <div className="mt-5 pt-4 border-t border-pf-card-border/50 text-xs text-pf-muted">
                <p>
                  Amounts marked with{' '}
                  <span className="inline-flex items-center text-pf-accent">
                    <FairnessIcon />
                  </span>{' '}
                  are calculated using Fairness Between Friends rules.{' '}
                  <button
                    onClick={() => setShowFairnessExplanation(!showFairnessExplanation)}
                    className="text-pf-accent hover:underline"
                  >
                    How it works
                  </button>
                </p>
                {showFairnessExplanation && (
                  <div className="mt-3 p-3 bg-black/20 rounded-lg text-xs">
                    Fairness Between Friends adjusts interest dynamically based on the outstanding balance and time elapsed. Paying earlier reduces total interest, while paying later increases it. Both sides always see the current, fair value of the loan.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Create agreement button */}
          {hasValidPrincipal && (
            <div className="card p-6">
              <p className="text-sm text-pf-muted mb-4">
                Ready to create a loan agreement? You&apos;ll be able to add borrower details next.
              </p>
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400 mb-4">
                  {error}
                </div>
              )}
              <button
                onClick={handleCreateAgreement}
                disabled={creatingAgreement}
                className="btn-primary w-full"
              >
                {creatingAgreement ? 'Creating...' : 'Create Agreement'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  highlight = false,
  icon = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  icon?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-pf-muted">{label}</span>
      <span className={`flex items-center gap-1 ${highlight ? 'font-bold text-pf-accent' : 'font-medium'}`}>
        {value}
        {icon && <FairnessIcon />}
      </span>
    </div>
  );
}

function FairnessIcon() {
  return (
    <svg
      className="w-4 h-4 text-pf-accent"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}
