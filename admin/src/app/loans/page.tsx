import Link from 'next/link';
import { getAgreements } from '@/lib/db-supabase';
import { formatDate, formatCurrency, getStatusBadgeClass } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: string;
  lenderId?: string;
  borrowerId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const agreements = await getAgreements({
    status: params.status,
    lenderId: params.lenderId,
    borrowerId: params.borrowerId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  }, 100, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Loans</h1>
        <span className="text-sm text-gray-500">Read-only</span>
      </div>

      {/* Filters */}
      <div className="admin-card p-4 mb-6">
        <form method="get" className="grid grid-cols-5 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Status</label>
            <select name="status" defaultValue={params.status || ''} className="admin-input">
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="settled">Settled</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Lender ID</label>
            <input
              type="text"
              name="lenderId"
              placeholder="Lender ID"
              defaultValue={params.lenderId || ''}
              className="admin-input"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Borrower ID</label>
            <input
              type="text"
              name="borrowerId"
              placeholder="Borrower ID"
              defaultValue={params.borrowerId || ''}
              className="admin-input"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Date From</label>
            <input
              type="date"
              name="dateFrom"
              defaultValue={params.dateFrom || ''}
              className="admin-input"
            />
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="admin-btn admin-btn-primary">
              Filter
            </button>
            <Link href="/loans" className="admin-btn admin-btn-secondary">
              Clear
            </Link>
          </div>
        </form>
      </div>

      {/* Loans Table */}
      <div className="admin-card overflow-hidden">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Loan ID</th>
              <th>Borrower</th>
              <th>Lender</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {agreements.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-500">
                  No loans found matching your filters.
                </td>
              </tr>
            ) : (
              agreements.map((agreement) => (
                <tr key={agreement.id}>
                  <td className="font-mono text-xs text-gray-400">{agreement.id}</td>
                  <td>
                    <div className="text-sm">{agreement.borrower_name || agreement.friend_first_name || '—'}</div>
                    <div className="text-xs text-gray-500">{agreement.borrower_user_id || agreement.borrower_email}</div>
                  </td>
                  <td>
                    <div className="text-sm">{agreement.lender_name || '—'}</div>
                    <div className="text-xs text-gray-500">{agreement.lender_user_id}</div>
                  </td>
                  <td className="font-mono">{formatCurrency(agreement.amount_cents)}</td>
                  <td>
                    <span className={getStatusBadgeClass(agreement.status)}>
                      {agreement.status}
                    </span>
                  </td>
                  <td className="text-sm text-gray-400">{formatDate(agreement.created_at)}</td>
                  <td>
                    <Link
                      href={`/loans/${agreement.id}`}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-500">
        Showing {agreements.length} loan(s)
      </div>
    </div>
  );
}
