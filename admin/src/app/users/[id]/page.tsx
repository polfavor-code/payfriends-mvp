import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getUserById, getUserStats, getAdminNotes } from '@/lib/db-supabase';
import { formatDate, formatDateTime } from '@/lib/utils';
import { UserActions } from './UserActions';
import { AdminNotesSection } from '@/components/AdminNotes';

export const dynamic = 'force-dynamic';

interface PageParams {
  id: string;
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { id } = await params;
  const user = await getUserById(id);

  if (!user) {
    notFound();
  }

  const stats = await getUserStats(id);
  const notes = await getAdminNotes('user', id);

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/users" className="text-gray-400 hover:text-white">
          &larr; Back to Users
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{user.full_name || 'Unnamed User'}</h1>
          <p className="text-gray-400 font-mono text-sm mt-1">ID: {user.id}</p>
        </div>
        <div>
          <span className="badge badge-active">Active</span>
        </div>
      </div>

      {/* User Info */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="admin-card p-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Contact Info</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-xs text-gray-500">Email</dt>
              <dd className="text-sm">{user.email || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Phone</dt>
              <dd className="text-sm">{user.phone_number || '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="admin-card p-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Activity</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-xs text-gray-500">Joined</dt>
              <dd className="text-sm">{formatDateTime(user.created_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Public ID</dt>
              <dd className="text-sm font-mono">{user.public_id || '—'}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Stats */}
      <div className="admin-card p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Activity Summary</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-800/50 rounded p-3">
            <div className="text-2xl font-bold">{stats.loansCreated}</div>
            <div className="text-xs text-gray-400">Loans Created</div>
          </div>
          <div className="bg-gray-800/50 rounded p-3">
            <div className="text-2xl font-bold">{stats.grouptabsCreated}</div>
            <div className="text-xs text-gray-400">GroupTabs Created</div>
          </div>
        </div>
      </div>

      {/* Admin Actions */}
      <div className="admin-card p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Admin Actions</h2>
        <UserActions 
          userId={user.id} 
          hasFinancialHistory={stats.loansCreated > 0 || stats.grouptabsCreated > 0}
        />
      </div>

      {/* Admin Notes */}
      <AdminNotesSection 
        entityType="user" 
        entityId={id} 
        existingNotes={notes}
      />
    </div>
  );
}
