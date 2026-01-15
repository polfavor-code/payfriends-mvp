import Link from 'next/link';
import { getAgreementById } from '@/lib/db-supabase';
import { runCalculation, compareCalculations, isEngineAvailable, type CalculationInput } from '@/lib/calculator';
import { formatCurrency, formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface SearchParams {
  loan_id?: string;
}

export default async function CalculationDebuggerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const loanId = params.loan_id || '';
  
  let agreement: any = null;
  let computedResult: any = null;
  let comparison: any = null;
  let error: string | null = null;

  const engineAvailable = isEngineAvailable();

  if (loanId && engineAvailable) {
    agreement = await getAgreementById(loanId);
    
    if (!agreement) {
      error = `Loan not found: ${loanId}`;
    } else {
      // Build calculation input from agreement data
      const calculationInput: CalculationInput = {
        principal: agreement.amount_cents,
        annualInterestRate: agreement.interest_rate || 0,
        repaymentType: agreement.repayment_type === 'one_time' ? 'one_time' : 'installments',
        numInstallments: agreement.installment_count || 1,
        paymentFrequency: agreement.payment_frequency || 'monthly',
        loanStartMode: agreement.loan_start_mode || 'upon_acceptance',
        loanStartDate: agreement.money_sent_date || agreement.money_transfer_date || null,
        firstPaymentOffsetDays: agreement.first_payment_offset_days || 30,
      };

      computedResult = runCalculation(calculationInput);

      if (computedResult && agreement.planned_total_cents) {
        // Compare with stored values
        comparison = compareCalculations(
          {
            totalInterest: (agreement.planned_total_cents || 0) - agreement.amount_cents,
            totalToRepay: agreement.planned_total_cents || 0,
          },
          computedResult
        );
      }
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Calculation Debugger</h1>
        <span className="text-sm text-gray-500">Admin Tool - Read-only</span>
      </div>

      {/* Engine Status */}
      <div className={`admin-card p-4 mb-6 ${engineAvailable ? 'border-green-800' : 'border-red-800'}`}>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${engineAvailable ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm">
            Production Engine: {engineAvailable ? 'Connected' : 'Not Available'}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Using: <code className="bg-gray-800 px-1 rounded">admin/src/lib/calculations/repaymentSchedule.ts</code>
        </p>
      </div>

      {/* Loan ID Input */}
      <div className="admin-card p-4 mb-6">
        <form method="get" className="flex gap-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">Loan ID</label>
            <input
              type="text"
              name="loan_id"
              placeholder="Enter loan_id to debug..."
              defaultValue={loanId}
              className="admin-input"
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="admin-btn admin-btn-primary" disabled={!engineAvailable}>
              Run Debugger
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="admin-card p-4 mb-6 border-red-800 bg-red-900/20">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {agreement && (
        <>
          {/* Loan Overview */}
          <div className="admin-card p-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Loan Overview</h2>
            <dl className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Loan ID</dt>
                <dd className="font-mono">{agreement.id}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Principal</dt>
                <dd className="font-mono">{formatCurrency(agreement.amount_cents)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Interest Rate</dt>
                <dd>{agreement.interest_rate || 0}%</dd>
              </div>
              <div>
                <dt className="text-gray-500">Calc Version</dt>
                <dd className="font-mono text-xs">{agreement.calc_version || '—'}</dd>
              </div>
            </dl>
          </div>

          {/* Comparison Result */}
          {comparison && (
            <div className={`admin-card p-4 mb-6 ${comparison.matches ? 'border-green-800' : 'border-yellow-800'}`}>
              <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Verification Result</h2>
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-4 h-4 rounded-full ${comparison.matches ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <span className={comparison.matches ? 'text-green-400' : 'text-yellow-400'}>
                  {comparison.matches ? 'Calculations Match' : 'Calculations Differ'}
                </span>
              </div>
              {!comparison.matches && (
                <div className="text-sm text-gray-400">
                  <p>Interest difference: {comparison.interestDiff} cents</p>
                  <p>Total difference: {comparison.totalDiff} cents</p>
                </div>
              )}
            </div>
          )}

          {/* Side-by-Side Comparison */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Stored Values */}
            <div className="admin-card p-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Stored Outputs</h2>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-gray-500">Planned Total</dt>
                  <dd className="font-mono text-lg">{formatCurrency(agreement.planned_total_cents || 0)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Stored Interest</dt>
                  <dd className="font-mono">{formatCurrency((agreement.planned_total_cents || 0) - agreement.amount_cents)}</dd>
                </div>
              </dl>
            </div>

            {/* Recomputed Values */}
            <div className="admin-card p-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Recomputed Outputs</h2>
              {computedResult ? (
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-gray-500">Total to Repay</dt>
                    <dd className="font-mono text-lg">{formatCurrency(computedResult.totalToRepay)}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Total Interest</dt>
                    <dd className="font-mono">{formatCurrency(computedResult.totalInterest)}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-gray-500">Calculation failed or not available.</p>
              )}
            </div>
          </div>

          {/* Raw Inputs */}
          <div className="admin-card p-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Stored Inputs</h2>
            <div className="bg-gray-900 rounded p-3 font-mono text-xs overflow-x-auto">
              <pre className="text-green-400">
{JSON.stringify({
  principal_cents: agreement.amount_cents,
  interest_rate: agreement.interest_rate,
  repayment_type: agreement.repayment_type,
  installment_count: agreement.installment_count,
  payment_frequency: agreement.payment_frequency,
  loan_start_mode: agreement.loan_start_mode,
  money_sent_date: agreement.money_sent_date,
  first_payment_offset_days: agreement.first_payment_offset_days,
  calc_version: agreement.calc_version,
}, null, 2)}
              </pre>
            </div>
          </div>

          {/* Recomputed Schedule */}
          {computedResult && computedResult.rows && computedResult.rows.length > 0 && (
            <div className="admin-card p-4 mb-6">
              <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Recomputed Schedule</h2>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Due Date</th>
                    <th>Principal</th>
                    <th>Interest</th>
                    <th>Total</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {computedResult.rows.map((row: any) => (
                    <tr key={row.index}>
                      <td>{row.index}</td>
                      <td>{row.dateLabel || formatDate(row.date)}</td>
                      <td className="font-mono">{formatCurrency(row.principal)}</td>
                      <td className="font-mono">{formatCurrency(row.interest)}</td>
                      <td className="font-mono">{formatCurrency(row.totalPayment)}</td>
                      <td className="font-mono">{formatCurrency(row.remainingBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Export JSON */}
          <div className="admin-card p-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Export</h2>
            <div className="flex gap-4">
              <a
                href={`/api/debugger/export?loan_id=${agreement.id}`}
                className="admin-btn admin-btn-secondary"
                download={`debug-${agreement.id}.json`}
              >
                Download JSON
              </a>
              <Link
                href={`/loans/${agreement.id}`}
                className="admin-btn admin-btn-secondary"
              >
                View Loan Detail
              </Link>
            </div>
          </div>
        </>
      )}

      {!agreement && !error && !loanId && (
        <div className="admin-card p-8 text-center">
          <p className="text-gray-400 mb-4">Enter a loan ID above to debug its calculations.</p>
          <p className="text-xs text-gray-500">
            The debugger will recompute the loan schedule using the production calculation engine
            and compare it with the stored values in the database.
          </p>
        </div>
      )}
    </div>
  );
}
