import Link from 'next/link';
import { getPaymentReports } from '@/lib/db-supabase';
import { formatDateTime, formatCurrency, getStatusBadgeClass } from '@/lib/utils';
import { MarkReviewedButton } from './MarkReviewedButton';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: string;
  entityType?: string;
}

export default async function PaymentReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const reports = await getPaymentReports({
    status: params.status,
    entityType: params.entityType,
  }, 100, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Payment Reports</h1>
        <span className="text-sm text-gray-500">Global Queue - Read-only triage</span>
      </div>

      {/* Filters */}
      <div className="admin-card p-4 mb-6">
        <form method="get" className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Status</label>
            <select name="status" defaultValue={params.status || ''} className="admin-input">
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="reviewed">Reviewed</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Entity Type</label>
            <select name="entityType" defaultValue={params.entityType || ''} className="admin-input">
              <option value="">All Types</option>
              <option value="loan">Loan</option>
              <option value="grouptab">GroupTab</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="admin-btn admin-btn-primary">
              Filter
            </button>
            <Link href="/payments" className="admin-btn admin-btn-secondary">
              Clear
            </Link>
          </div>
        </form>
      </div>

      {/* Reports Table */}
      <div className="admin-card overflow-hidden">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Report ID</th>
              <th>Type</th>
              <th>Parent</th>
              <th>Reporter</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Timestamp</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-500">
                  No payment reports found.
                </td>
              </tr>
            ) : (
              reports.map((report) => (
                <tr key={report.id}>
                  <td className="font-mono text-xs text-gray-400">{report.id}</td>
                  <td>
                    <span className="text-xs uppercase text-gray-400">
                      {report.entity_type}
                    </span>
                  </td>
                  <td>
                    <Link
                      href={report.entity_type === 'loan' 
                        ? `/loans/${report.entity_id}` 
                        : `/grouptabs/${report.entity_id}`}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      <div className="font-medium">{report.entity_name || `#${report.entity_id}`}</div>
                      <div className="text-xs text-gray-500 font-mono">ID: {report.entity_id}</div>
                    </Link>
                  </td>
                  <td>
                    <div className="text-sm">{report.reporter_name || '—'}</div>
                    <div className="text-xs text-gray-500">{report.reporter_id}</div>
                  </td>
                  <td className="font-mono">{formatCurrency(report.amount_cents)}</td>
                  <td>
                    <span className={getStatusBadgeClass(report.status)}>
                      {report.status}
                    </span>
                  </td>
                  <td className="text-sm text-gray-400">{formatDateTime(report.created_at)}</td>
                  <td>
                    <div className="flex gap-2">
                      {report.status === 'pending' && (
                        <MarkReviewedButton reportId={report.id} />
                      )}
                      <Link
                        href={`/payments/${report.id}/note`}
                        className="text-blue-400 hover:text-blue-300 text-sm"
                      >
                        Add Note
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-500">
        Showing {reports.length} report(s)
      </div>

      <div className="mt-4 admin-card p-4">
        <h3 className="text-sm font-semibold text-gray-400 mb-2">MVP Actions</h3>
        <ul className="text-xs text-gray-500 space-y-1">
          <li>• <strong>Mark as reviewed</strong> - Flag the report as seen by admin</li>
          <li>• <strong>Add note</strong> - Add internal commentary (append-only)</li>
        </ul>
        <p className="text-xs text-gray-500 mt-2 italic">
          Approve/Reject actions deferred to future version.
        </p>
      </div>
    </div>
  );
}
