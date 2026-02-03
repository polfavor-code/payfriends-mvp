'use client';

import Link from 'next/link';
import { UserAvatar } from './UserAvatar';
import { StatusDot } from './StatusDot';
import { formatCurrency0 } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Agreement } from '@/lib/supabase/db';

interface User {
  id: number;
  email: string;
  fullName: string | null;
}

interface AgreementsTableProps {
  agreements: Agreement[];
  currentUser: User;
  filter?: 'all' | 'pending' | 'active' | 'settled';
  currentAgreementId?: number | null;
}

interface DueDateInfo {
  text: string;
  className: string;
}

function formatDueDate(agreement: Agreement, isLender: boolean): DueDateInfo {
  if (agreement.status === 'settled') {
    return { text: '—', className: 'text-pf-muted' };
  }

  const dueDate = agreement.due_date;

  if (!dueDate) {
    return { text: '—', className: 'text-pf-muted' };
  }

  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const dateStr = due.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  let className = '';
  let countdownText = '';

  if (diffDays < 0) {
    className = 'text-red-400';
    countdownText = `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} overdue`;
  } else if (diffDays === 0) {
    className = 'text-yellow-400';
    countdownText = 'Due today';
  } else if (diffDays <= 7) {
    className = 'text-amber-400';
    countdownText = `${diffDays} day${diffDays !== 1 ? 's' : ''} left`;
  } else {
    className = 'text-pf-muted';
    countdownText = `${diffDays} days left`;
  }

  // For active agreements with installments, show next payment amount
  if (agreement.status === 'active' && agreement.repayment_type === 'installments') {
    // Calculate per-payment amount (simplified)
    const installmentCount = agreement.installment_count || 1;
    const perPaymentCents = Math.ceil(agreement.amount_cents / installmentCount);
    const amountFormatted = formatCurrency0(perPaymentCents);
    const text = `${amountFormatted} on ${dateStr} (${countdownText})`;
    return { text, className };
  }

  const text = countdownText ? `${dateStr} (${countdownText})` : dateStr;
  return { text, className };
}

export function AgreementsTable({
  agreements,
  currentUser,
  filter = 'all',
  currentAgreementId,
}: AgreementsTableProps) {
  // Filter agreements - exclude cancelled that were never accepted
  let filtered = agreements.filter(a => {
    if (a.status === 'cancelled') {
      return false;
    }
    return true;
  });

  // Apply status filter
  if (filter !== 'all') {
    filtered = filtered.filter(a => a.status === filter);
  }

  // Determine counterparty header based on user roles
  const userRoles = new Set<'lender' | 'borrower'>();
  filtered.forEach(a => {
    userRoles.add(a.lender_user_id === currentUser.id ? 'lender' : 'borrower');
  });

  let counterpartyHeader = 'Counterparty';
  let dueHeader = 'Due';

  if (userRoles.size === 1) {
    if (userRoles.has('lender')) {
      counterpartyHeader = 'Borrower';
      dueHeader = 'Next repayment due';
    } else {
      counterpartyHeader = 'Lender';
      dueHeader = 'Next payment due';
    }
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-16 px-8">
        <div className="text-5xl mb-4 opacity-50">📋</div>
        <p className="text-base text-pf-muted mb-2">No agreements found</p>
        <p className="text-sm text-pf-muted/70">Try adjusting the filter above.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-pf-muted text-left px-3 py-2.5 text-[13px] font-semibold border-b border-pf-card-border">
              {counterpartyHeader}
            </th>
            <th className="text-pf-muted text-left px-3 py-2.5 text-[13px] font-semibold border-b border-pf-card-border">
              Description
            </th>
            <th className="text-pf-muted text-left px-3 py-2.5 text-[13px] font-semibold border-b border-pf-card-border">
              Outstanding / Total
            </th>
            <th className="text-pf-muted text-left px-3 py-2.5 text-[13px] font-semibold border-b border-pf-card-border">
              {dueHeader}
            </th>
            <th className="text-pf-muted text-center px-3 py-2.5 text-[13px] font-semibold border-b border-pf-card-border w-20">
              Status
            </th>
            <th className="text-pf-muted text-right px-3 py-2.5 text-[13px] font-semibold border-b border-pf-card-border">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((agreement) => {
            const userIsLender = agreement.lender_user_id === currentUser.id;
            
            // Determine counterparty
            const counterparty = userIsLender
              ? {
                  name: agreement.borrower?.full_name || agreement.friend_first_name || agreement.borrower_email,
                  email: agreement.borrower_email,
                  userId: agreement.borrower_user_id,
                }
              : {
                  name: agreement.lender?.full_name || agreement.lender_name,
                  email: agreement.lender?.email || '',
                  userId: agreement.lender_user_id,
                };

            // Calculate outstanding and total (simplified - would use payments in real app)
            const outstandingCents = agreement.amount_cents;
            const totalDueCents = agreement.amount_cents;
            const principalCents = agreement.amount_cents;
            const hasInterest = totalDueCents !== principalCents;
            const tooltipText = hasInterest 
              ? `Principal: ${formatCurrency0(principalCents)}`
              : `Original: ${formatCurrency0(principalCents)}`;

            const dueInfo = formatDueDate(agreement, userIsLender);
            const isCurrentAgreement = currentAgreementId === agreement.id;

            return (
              <tr
                key={agreement.id}
                className={cn(
                  'border-b border-pf-card-border hover:bg-white/[0.02]',
                  isCurrentAgreement && 'bg-pf-accent/5'
                )}
              >
                {/* Counterparty */}
                <td className="px-3 py-2.5 align-middle">
                  <div className="flex items-center gap-2.5">
                    <UserAvatar name={counterparty.name} userId={counterparty.userId} size="sm" />
                    <span className="text-pf-text">{counterparty.name || counterparty.email}</span>
                  </div>
                </td>

                {/* Description */}
                <td className="px-3 py-2.5 align-middle">
                  {agreement.description ? (
                    <span className="text-pf-text">{agreement.description}</span>
                  ) : (
                    <span className="text-pf-muted italic">(No description)</span>
                  )}
                </td>

                {/* Outstanding / Total */}
                <td className="px-3 py-2.5 align-middle">
                  <span className="text-pf-text" title={tooltipText}>
                    {formatCurrency0(outstandingCents)} / {formatCurrency0(totalDueCents)}
                  </span>
                </td>

                {/* Due date */}
                <td className="px-3 py-2.5 align-middle">
                  <div className={cn('whitespace-nowrap', dueInfo.className)}>
                    {dueInfo.text}
                  </div>
                </td>

                {/* Status */}
                <td className="px-3 py-2.5 align-middle text-center">
                  <StatusDot status={agreement.status as 'pending' | 'active' | 'settled' | 'cancelled'} />
                </td>

                {/* Actions */}
                <td className="px-3 py-2.5 align-middle">
                  <div className="flex items-center justify-end gap-2 flex-wrap">
                    {agreement.status === 'cancelled' ? (
                      <span className="text-pf-muted">—</span>
                    ) : agreement.status === 'pending' && !userIsLender ? (
                      <Link
                        href={`/review?id=${agreement.id}`}
                        className="inline-block px-3 py-2 rounded-lg bg-yellow-400 text-pf-bg text-sm font-bold hover:brightness-110 transition-all"
                      >
                        Review
                      </Link>
                    ) : (
                      <Link
                        href={`/agreements/${agreement.id}/manage`}
                        className={cn(
                          'inline-block px-3 py-2 rounded-lg text-sm font-bold transition-all',
                          isCurrentAgreement
                            ? 'bg-pf-accent text-pf-bg'
                            : 'bg-pf-accent text-pf-bg hover:brightness-105'
                        )}
                      >
                        Manage
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
