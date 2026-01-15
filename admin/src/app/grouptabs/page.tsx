import Link from 'next/link';
import { getGroupTabs } from '@/lib/db';
import { formatDate, formatCurrency, getStatusBadgeClass } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: string;
  type?: string;
  creatorId?: string;
}

export default async function GroupTabsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const grouptabs = getGroupTabs({
    status: params.status,
    type: params.type,
    creatorId: params.creatorId,
  }, 100, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">GroupTabs</h1>
        <span className="text-sm text-gray-500">Read-only</span>
      </div>

      {/* Filters */}
      <div className="admin-card p-4 mb-6">
        <form method="get" className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Status</label>
            <select name="status" defaultValue={params.status || ''} className="admin-input">
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="settled">Settled</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Type</label>
            <select name="type" defaultValue={params.type || ''} className="admin-input">
              <option value="">All Types</option>
              <option value="equal_split">Equal Split</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Creator ID</label>
            <input
              type="text"
              name="creatorId"
              placeholder="Creator ID"
              defaultValue={params.creatorId || ''}
              className="admin-input"
            />
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="admin-btn admin-btn-primary">
              Filter
            </button>
            <Link href="/grouptabs" className="admin-btn admin-btn-secondary">
              Clear
            </Link>
          </div>
        </form>
      </div>

      {/* GroupTabs Table */}
      <div className="admin-card overflow-hidden">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Tab ID</th>
              <th>Name</th>
              <th>Creator</th>
              <th>Type</th>
              <th>Total</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {grouptabs.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-500">
                  No GroupTabs found matching your filters.
                </td>
              </tr>
            ) : (
              grouptabs.map((tab) => (
                <tr key={tab.id}>
                  <td className="font-mono text-xs text-gray-400">{tab.id}</td>
                  <td className="font-medium">{tab.name}</td>
                  <td>
                    <div className="text-sm">{tab.creator_name || '—'}</div>
                    <div className="text-xs text-gray-500">User #{tab.creator_user_id}</div>
                  </td>
                  <td className="text-sm text-gray-400">{tab.tab_type || '—'}</td>
                  <td className="font-mono">{formatCurrency(tab.total_amount_cents || 0)}</td>
                  <td>
                    <span className={getStatusBadgeClass(tab.status)}>
                      {tab.status}
                    </span>
                  </td>
                  <td className="text-sm text-gray-400">{formatDate(tab.created_at)}</td>
                  <td>
                    <Link
                      href={`/grouptabs/${tab.id}`}
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
        Showing {grouptabs.length} GroupTab(s)
      </div>
    </div>
  );
}
