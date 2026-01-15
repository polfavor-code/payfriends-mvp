import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAgreementById, getAgreementPayments, getAdminNotes } from '@/lib/db-supabase';
import { formatDate, formatDateTime, formatCurrency, getStatusBadgeClass } from '@/lib/utils';
import { AdminNotesSection } from '@/components/AdminNotes';
import { Timeline } from '@/components/Timeline';

export const dynamic = 'force-dynamic';

interface PageParams {
  id: string;
}

export default async function LoanDetailPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { id } = await params;
  const agreement = await getAgreementById(id);

  if (!agreement) {
    notFound();
  }

  const payments = await getAgreementPayments(id);
  const notes = await getAdminNotes('loan', id);

  // Build timeline events
  const timelineEvents = [
    {
      type: 'system' as const,
      label: 'Created',
      timestamp: agreement.created_at,
      details: `Loan created by ${agreement.lender_name || 'User #' + agreement.lender_user_id}`,
    },
    ...payments.map((p: any) => ({
      type: 'payment' as const,
      label: `Payment: ${formatCurrency(p.amount_cents)}`,
      timestamp: p.created_at,
      details: p.status || 'reported',
    })),
    ...notes.map((n) => ({
      type: 'admin' as const,
      label: 'Admin Note',
      timestamp: n.created_at,
      details: n.note.substring(0, 100),
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/loans" className="text-gray-400 hover:text-white">
          &larr; Back to Loans
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Loan Detail</h1>
          <p className="text-gray-400 font-mono text-sm mt-1">{agreement.id}</p>
        </div>
        <span className={getStatusBadgeClass(agreement.status)}>
          {agreement.status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="col-span-2 space-y-6">
          {/* Parties */}
          <div className="admin-card p-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Parties</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500">Lender</div>
                <div className="text-sm font-medium">{agreement.lender_name || '—'}</div>
                {agreement.lender_user_id && (
                  <Link href={`/users/${agreement.lender_user_id}`} className="text-xs text-blue-400">
                    User #{agreement.lender_user_id}
                  </Link>
                )}
              </div>
              <div>
                <div className="text-xs text-gray-500">Borrower</div>
                <div className="text-sm font-medium">{agreement.borrower_name || agreement.friend_first_name || '—'}</div>
                {agreement.borrower_user_id ? (
                  <Link href={`/users/${agreement.borrower_user_id}`} className="text-xs text-blue-400">
                    User #{agreement.borrower_user_id}
                  </Link>
                ) : agreement.borrower_email ? (
                  <span className="text-xs text-gray-400">{agreement.borrower_email}</span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Raw Metadata (Read-only) */}
          <div className="admin-card p-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Raw Metadata</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-gray-500">Amount</dt>
                <dd className="font-mono">{formatCurrency(agreement.amount_cents)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Interest Rate</dt>
                <dd>{agreement.interest_rate ? `${agreement.interest_rate}%` : '0%'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Repayment Type</dt>
                <dd>{agreement.repayment_type || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Installments</dt>
                <dd>{agreement.installment_count || 1}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Frequency</dt>
                <dd>{agreement.payment_frequency || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Due Date</dt>
                <dd>{formatDate(agreement.due_date)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Created</dt>
                <dd>{formatDateTime(agreement.created_at)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Calc Version</dt>
                <dd className="font-mono text-xs">{agreement.calc_version || '—'}</dd>
              </div>
            </dl>
          </div>

          {/* Calculation Snapshot */}
          <div className="admin-card p-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Calculation Snapshot</h2>
            <div className="bg-gray-900 rounded p-3 font-mono text-xs overflow-x-auto">
              <div className="text-gray-400 mb-2">// Stored Inputs</div>
              <pre className="text-green-400">
{JSON.stringify({
  principal_cents: agreement.amount_cents,
  interest_rate: agreement.interest_rate,
  repayment_type: agreement.repayment_type,
  installment_count: agreement.installment_count,
  payment_frequency: agreement.payment_frequency,
  calc_version: agreement.calc_version,
}, null, 2)}
              </pre>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Use the <Link href={`/tools/debugger?loan_id=${agreement.id}`} className="text-blue-400">Calculation Debugger</Link> to verify these values.
            </div>
          </div>

          {/* Payment Log */}
          <div className="admin-card p-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Payment Log</h2>
            {payments.length === 0 ? (
              <p className="text-sm text-gray-500">No payments recorded.</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Payer</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment: any) => (
                    <tr key={payment.id}>
                      <td className="text-sm">{formatDateTime(payment.created_at)}</td>
                      <td className="font-mono">{formatCurrency(payment.amount_cents)}</td>
                      <td>
                        <span className={getStatusBadgeClass(payment.status || 'pending')}>
                          {payment.status || 'pending'}
                        </span>
                      </td>
                      <td className="text-xs text-gray-400">{payment.payer_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Admin Notes */}
          <AdminNotesSection 
            entityType="loan" 
            entityId={id} 
            existingNotes={notes}
          />
        </div>

        {/* Right Column - Timeline */}
        <div>
          <Timeline events={timelineEvents} />
        </div>
      </div>
    </div>
  );
}
