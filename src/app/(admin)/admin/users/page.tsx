import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { formatDate } from '@/lib/formatters';

interface User {
  id: number;
  email: string;
  full_name: string | null;
  phone_number: string | null;
  created_at: string;
  is_admin: boolean;
}

async function getUsers(): Promise<User[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, phone_number, created_at, is_admin')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

export default async function AdminUsersPage() {
  const users = await getUsers();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <span className="text-sm text-gray-400">{users.length} users</span>
      </div>

      <div className="admin-card overflow-hidden">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Joined</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className="font-mono text-xs">{user.id}</td>
                <td>{user.full_name || '—'}</td>
                <td>{user.email}</td>
                <td className="text-gray-400">{user.phone_number || '—'}</td>
                <td className="text-gray-400">{formatDate(user.created_at)}</td>
                <td>
                  {user.is_admin ? (
                    <span className="badge bg-blue-900/50 text-blue-300">Admin</span>
                  ) : (
                    <span className="text-gray-500">User</span>
                  )}
                </td>
                <td>
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="text-blue-400 hover:text-blue-300 text-sm no-underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            No users found
          </div>
        )}
      </div>
    </div>
  );
}
