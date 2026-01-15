import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getGroupTabById, getGroupTabParticipants, getAdminNotes } from '@/lib/db';
import { formatDate, formatDateTime, formatCurrency, getStatusBadgeClass } from '@/lib/utils';
import { AdminNotesSection } from '@/components/AdminNotes';
import { Timeline } from '@/components/Timeline';

export const dynamic = 'force-dynamic';

interface PageParams {
  id: string;
}

export default async function GroupTabDetailPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { id } = await params;
  const grouptab = getGroupTabById(id);

  if (!grouptab) {
    notFound();
  }

  const participants = getGroupTabParticipants(id);
  const notes = getAdminNotes('grouptab', id);

  // Build timeline events
  const timelineEvents = [
    {
      type: 'system' as const,
      label: 'Created',
      timestamp: grouptab.created_at,
      details: `GroupTab created by ${grouptab.creator_name || 'User #' + grouptab.creator_user_id}`,
    },
    ...notes.map((n) => ({
      type: 'admin' as const,
      label: 'Admin Note',
      timestamp: n.created_at,
      details: n.note.substring(0, 100),
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Calculate totals
  const totalPaid = participants.reduce((sum: number, p: any) => sum + (p.paid_cents || 0), 0);
  const totalAmount = grouptab.total_amount_cents || 0;
  const outstanding = totalAmount - totalPaid;

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/grouptabs" className="text-gray-400 hover:text-white">
          &larr; Back to GroupTabs
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{grouptab.name}</h1>
          <p className="text-gray-400 font-mono text-sm mt-1">{grouptab.id}</p>
        </div>
        <span className={getStatusBadgeClass(grouptab.status)}>
          {grouptab.status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="col-span-2 space-y-6">
          {/* Overview */}
          <div className="admin-card p-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Overview</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-gray-500">Total Amount</dt>
                <dd className="font-mono text-lg">{formatCurrency(totalAmount)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Outstanding</dt>
                <dd className="font-mono text-lg text-yellow-400">{formatCurrency(outstanding)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Type</dt>
                <dd>{grouptab.tab_type || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Creator</dt>
                <dd>
                  <Link href={`/users/${grouptab.creator_user_id}`} className="text-blue-400">
                    {grouptab.creator_name || 'User #' + grouptab.creator_user_id}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Created</dt>
                <dd>{formatDateTime(grouptab.created_at)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Participants</dt>
                <dd>{participants.length}</dd>
              </div>
            </dl>
          </div>

          {/* Participants */}
          <div className="admin-card p-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Participants</h2>
            {participants.length === 0 ? (
              <p className="text-sm text-gray-500">No participants.</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Fair Share</th>
                    <th>Paid</th>
                    <th>Remaining</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p: any) => {
                    const fairShare = p.fair_share_cents || 0;
                    const paid = p.paid_cents || 0;
                    const remaining = Math.max(0, fairShare - paid);
                    const isPaid = remaining === 0 && fairShare > 0;
                    
                    return (
                      <tr key={p.id || p.user_id}>
                        <td>
                          <div className="text-sm">{p.user_name || p.name || '—'}</div>
                          {p.user_id && (
                            <Link href={`/users/${p.user_id}`} className="text-xs text-blue-400">
                              {p.user_id}
                            </Link>
                          )}
                        </td>
                        <td className="font-mono">{formatCurrency(fairShare)}</td>
                        <td className="font-mono text-green-400">{formatCurrency(paid)}</td>
                        <td className="font-mono text-yellow-400">{formatCurrency(remaining)}</td>
                        <td>
                          {isPaid ? (
                            <span className="badge badge-settled">Settled</span>
                          ) : paid > 0 ? (
                            <span className="badge badge-pending">Partial</span>
                          ) : (
                            <span className="badge bg-gray-700 text-gray-300">Unpaid</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Admin Notes */}
          <AdminNotesSection 
            entityType="grouptab" 
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
