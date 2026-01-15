import Link from 'next/link';
import { getAuditLog } from '@/lib/db-supabase';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AuditLogPage() {
  const logs = await getAuditLog(200, 0);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Admin Audit Log</h1>
        <span className="text-sm text-gray-500">Read-only</span>
      </div>

      <div className="admin-card overflow-hidden">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Admin</th>
              <th>Action</th>
              <th>Target</th>
              <th>Metadata</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-500">
                  No audit log entries yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                // Supabase returns metadata as an object, SQLite returned it as a string
                const metadata = typeof log.metadata === 'string' ? JSON.parse(log.metadata || '{}') : (log.metadata || {});
                const targetLink = getTargetLink(log.target_type, log.target_id);

                return (
                  <tr key={log.id}>
                    <td className="text-sm text-gray-400 whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="text-sm font-mono">{log.admin_id}</td>
                    <td>
                      <span className={`badge ${getActionBadgeClass(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td>
                      <div className="text-xs text-gray-400">{log.target_type}</div>
                      {targetLink ? (
                        <Link href={targetLink} className="text-sm text-blue-400 font-mono">
                          {log.target_id}
                        </Link>
                      ) : (
                        <span className="text-sm font-mono">{log.target_id}</span>
                      )}
                    </td>
                    <td className="text-xs text-gray-500 max-w-xs truncate">
                      {Object.keys(metadata).length > 0 ? (
                        <code className="bg-gray-800 px-1 rounded">
                          {JSON.stringify(metadata).substring(0, 50)}
                          {JSON.stringify(metadata).length > 50 ? '...' : ''}
                        </code>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-500">
        Showing {logs.length} log entries
      </div>

      <div className="mt-6 admin-card p-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-2">Tracked Actions</h2>
        <ul className="text-xs text-gray-500 space-y-1">
          <li>• soft_disable_user - User disabled by admin</li>
          <li>• enable_user - User re-enabled by admin</li>
          <li>• delete_user - User deleted (hard delete)</li>
          <li>• anonymize_user - User data anonymized</li>
          <li>• add_note - Admin note added</li>
          <li>• mark_reviewed - Payment report marked as reviewed</li>
          <li>• update_config - Remote config updated</li>
        </ul>
      </div>
    </div>
  );
}

function getTargetLink(type: string, id: string): string | null {
  switch (type) {
    case 'user':
      return `/users/${id}`;
    case 'loan':
      return `/loans/${id}`;
    case 'grouptab':
      return `/grouptabs/${id}`;
    case 'payment_report':
      return `/payments`;
    default:
      return null;
  }
}

function getActionBadgeClass(action: string): string {
  if (action.includes('delete') || action.includes('disable')) {
    return 'badge-disabled';
  }
  if (action.includes('enable')) {
    return 'badge-active';
  }
  if (action.includes('note') || action.includes('review')) {
    return 'badge-pending';
  }
  return 'bg-gray-700 text-gray-300';
}
