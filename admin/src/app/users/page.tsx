import Link from 'next/link';
import { getUsers } from '@/lib/db-supabase';
import { formatDate, getStatusBadgeClass } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface SearchParams {
  search?: string;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const search = params.search || '';
  const users = await getUsers(search, 100, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
      </div>

      {/* Search */}
      <div className="admin-card p-4 mb-6">
        <form method="get" className="flex gap-4">
          <input
            type="text"
            name="search"
            placeholder="Search by name, email, phone, or user_id..."
            defaultValue={search}
            className="admin-input flex-1"
          />
          <button type="submit" className="admin-btn admin-btn-primary">
            Search
          </button>
          {search && (
            <Link href="/users" className="admin-btn admin-btn-secondary">
              Clear
            </Link>
          )}
        </form>
      </div>

      {/* Users Table */}
      <div className="admin-card overflow-hidden">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Name</th>
              <th>Email / Phone</th>
              <th>Joined</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  {search ? 'No users found matching your search.' : 'No users found.'}
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td className="font-mono text-xs text-gray-400">{user.id}</td>
                  <td className="font-medium">{user.full_name || '—'}</td>
                  <td className="text-sm text-gray-400">
                    {user.email || user.phone_number || '—'}
                  </td>
                  <td className="text-sm text-gray-400">{formatDate(user.created_at)}</td>
                  <td>
                    <span className="badge badge-active">Active</span>
                  </td>
                  <td>
                    <Link
                      href={`/users/${user.id}`}
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
        Showing {users.length} user(s)
      </div>
    </div>
  );
}
