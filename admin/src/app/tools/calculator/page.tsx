'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  generateRepaymentSchedule, 
  RepaymentScheduleConfig,
  RepaymentScheduleResult,
  RepaymentScheduleRow
} from '@/lib/calculations/repaymentSchedule';

type RepaymentType = 'one_time' | 'installments';
type LoanStartMode = 'fixed_date' | 'upon_acceptance';

interface FormValues {
  principal: number;
  annualInterestRate: number;
  repaymentType: RepaymentType;
  numInstallments: number;
  paymentFrequency: string;
  loanStartMode: LoanStartMode;
  loanStartDate: string;
  firstPaymentOffsetDays: number;
}

const DEFAULT_VALUES: FormValues = {
  principal: 100000, // 1000.00 in cents
  annualInterestRate: 5,
  repaymentType: 'installments',
  numInstallments: 12,
  paymentFrequency: 'monthly',
  loanStartMode: 'fixed_date',
  loanStartDate: new Date().toISOString().split('T')[0],
  firstPaymentOffsetDays: 30,
};

const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 Weeks' },
  { value: 'every_4_weeks', label: 'Every 4 Weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

function formatDate(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function CalculatorPage() {
  const [values, setValues] = useState<FormValues>(DEFAULT_VALUES);
  const [result, setResult] = useState<RepaymentScheduleResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const runCalculation = useCallback(() => {
    setError(null);
    
    try {
      const hasRealDate = values.loanStartMode === 'fixed_date' && values.loanStartDate;
      
      const config: RepaymentScheduleConfig = {
        principal: values.principal,
        annualInterestRate: values.annualInterestRate,
        repaymentType: values.repaymentType,
        numInstallments: values.numInstallments,
        paymentFrequency: values.paymentFrequency,
        loanStartMode: values.loanStartMode,
        loanStartDate: hasRealDate ? values.loanStartDate : null,
        firstPaymentOffsetDays: values.firstPaymentOffsetDays,
        context: {
          preview: !hasRealDate,
          agreementStatus: 'active',
          hasRealStartDate: !!hasRealDate,
        },
      };
      
      setIsPreview(!hasRealDate);
      const scheduleResult = generateRepaymentSchedule(config);
      setResult(scheduleResult);
    } catch (err: any) {
      setError(err.message || 'Calculation failed');
      setResult(null);
    }
  }, [values]);

  // Auto-calculate on value changes
  useEffect(() => {
    runCalculation();
  }, [runCalculation]);

  const handleChange = (field: keyof FormValues, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));
  };

  const handleReset = () => {
    setValues(DEFAULT_VALUES);
  };

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Repayment Calculator</h1>
        <div className="flex items-center gap-3">
          {isPreview && (
            <span className="text-xs bg-yellow-600 text-white px-2 py-1 rounded">
              Preview Mode
            </span>
          )}
          <span className="text-sm text-gray-500">Source of Truth Calculator</span>
        </div>
      </div>

      {/* Engine Status */}
      <div className="admin-card p-4 mb-6 border-green-800">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-sm">Calculation Engine: Active</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Using: <code className="bg-gray-800 px-1 rounded">admin/src/lib/calculations/repaymentSchedule.ts</code>
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Configuration Panel */}
        <div className="col-span-4">
          <div className="admin-card p-4 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-400 uppercase">Configuration</h2>
              <button
                onClick={handleReset}
                className="text-xs text-gray-400 hover:text-white"
              >
                Reset
              </button>
            </div>
            
            {/* Loan Amount */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Loan Amount (EUR)</label>
              <input
                type="number"
                value={values.principal / 100}
                onChange={(e) => handleChange('principal', Math.round(parseFloat(e.target.value || '0') * 100))}
                className="admin-input"
                step="0.01"
                min="0"
              />
            </div>

            {/* Interest Rate */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Annual Interest Rate (%)</label>
              <input
                type="number"
                value={values.annualInterestRate}
                onChange={(e) => handleChange('annualInterestRate', parseFloat(e.target.value || '0'))}
                className="admin-input"
                step="0.1"
                min="0"
                max="100"
              />
            </div>

            {/* Repayment Type */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Repayment Type</label>
              <select
                value={values.repaymentType}
                onChange={(e) => handleChange('repaymentType', e.target.value as RepaymentType)}
                className="admin-input"
              >
                <option value="one_time">One-Time Payment</option>
                <option value="installments">Installments</option>
              </select>
            </div>

            {/* Number of Installments */}
            {values.repaymentType === 'installments' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Number of Installments</label>
                <input
                  type="number"
                  value={values.numInstallments}
                  onChange={(e) => handleChange('numInstallments', parseInt(e.target.value || '1', 10))}
                  className="admin-input"
                  min="1"
                  max="120"
                />
              </div>
            )}

            {/* Payment Frequency */}
            {values.repaymentType === 'installments' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Payment Frequency</label>
                <select
                  value={values.paymentFrequency}
                  onChange={(e) => handleChange('paymentFrequency', e.target.value)}
                  className="admin-input"
                >
                  {FREQUENCY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Loan Start Mode */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Loan Start Mode</label>
              <select
                value={values.loanStartMode}
                onChange={(e) => handleChange('loanStartMode', e.target.value as LoanStartMode)}
                className="admin-input"
              >
                <option value="fixed_date">Fixed Date</option>
                <option value="upon_acceptance">Upon Acceptance (Preview)</option>
              </select>
            </div>

            {/* Loan Start Date */}
            {values.loanStartMode === 'fixed_date' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Loan Start Date</label>
                <input
                  type="date"
                  value={values.loanStartDate}
                  onChange={(e) => handleChange('loanStartDate', e.target.value)}
                  className="admin-input"
                />
              </div>
            )}

            {/* First Payment Offset */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">First Payment Offset (Days)</label>
              <input
                type="number"
                value={values.firstPaymentOffsetDays}
                onChange={(e) => handleChange('firstPaymentOffsetDays', parseInt(e.target.value || '0', 10))}
                className="admin-input"
                min="0"
              />
            </div>

            {/* Debug Toggle */}
            <div className="pt-4 border-t border-gray-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDebug}
                  onChange={(e) => setShowDebug(e.target.checked)}
                  className="rounded bg-gray-800 border-gray-600"
                />
                <span className="text-xs text-gray-400">Show Debug Output</span>
              </label>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="col-span-8 space-y-6">
          {error && (
            <div className="admin-card p-4 border-red-800 bg-red-900/20">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {result && (
            <>
              {/* Summary */}
              <div className="admin-card p-4">
                <h2 className="text-sm font-semibold text-gray-400 uppercase mb-4">Summary</h2>
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <dt className="text-gray-500 text-sm">Principal</dt>
                    <dd className="text-2xl font-mono">{formatCurrency(values.principal)}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 text-sm">Total Interest</dt>
                    <dd className="text-2xl font-mono text-yellow-400">{formatCurrency(result.totalInterest)}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 text-sm">Total to Repay</dt>
                    <dd className="text-2xl font-mono text-green-400">{formatCurrency(result.totalToRepay)}</dd>
                  </div>
                </div>
              </div>

              {/* Schedule Table */}
              <div className="admin-card p-4">
                <h2 className="text-sm font-semibold text-gray-400 uppercase mb-4">
                  Repayment Schedule
                  {result.rows.length > 0 && (
                    <span className="ml-2 text-gray-600">({result.rows.length} payments)</span>
                  )}
                </h2>
                <div className="max-h-96 overflow-y-auto">
                  <table className="admin-table">
                    <thead className="sticky top-0 bg-gray-900">
                      <tr>
                        <th>#</th>
                        <th>Due Date</th>
                        <th>Principal</th>
                        <th>Interest</th>
                        <th>Payment</th>
                        <th>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row) => (
                        <tr key={row.index}>
                          <td>{row.index}</td>
                          <td>{row.dateLabel || formatDate(row.date)}</td>
                          <td className="font-mono">{formatCurrency(row.principal)}</td>
                          <td className="font-mono text-yellow-400">{formatCurrency(row.interest)}</td>
                          <td className="font-mono font-medium">{formatCurrency(row.totalPayment)}</td>
                          <td className="font-mono text-gray-400">{formatCurrency(row.remainingBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Loan Duration */}
              {result.rows.length > 0 && values.loanStartMode === 'fixed_date' && result.rows[result.rows.length - 1].date && (
                <div className="admin-card p-4">
                  <h2 className="text-sm font-semibold text-gray-400 uppercase mb-2">Loan Duration</h2>
                  <p className="text-sm text-gray-300">
                    From <span className="font-mono">{values.loanStartDate}</span> to{' '}
                    <span className="font-mono">{formatDate(result.rows[result.rows.length - 1].date)}</span>
                  </p>
                </div>
              )}

              {/* Debug Output */}
              {showDebug && (
                <div className="admin-card p-4">
                  <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Debug Output</h2>
                  <div className="bg-gray-900 rounded p-3 font-mono text-xs overflow-x-auto">
                    <pre className="text-green-400">
{JSON.stringify({
  config: {
    principal: values.principal,
    annualInterestRate: values.annualInterestRate,
    repaymentType: values.repaymentType,
    numInstallments: values.numInstallments,
    paymentFrequency: values.paymentFrequency,
    loanStartMode: values.loanStartMode,
    loanStartDate: values.loanStartDate,
    firstPaymentOffsetDays: values.firstPaymentOffsetDays,
  },
  result: {
    totalInterest: result.totalInterest,
    totalToRepay: result.totalToRepay,
    rowCount: result.rows.length,
  },
  isPreview,
}, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
