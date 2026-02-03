'use client';

import { cn } from '@/lib/utils';

type Status = 'pending' | 'active' | 'settled' | 'cancelled' | 'overdue' | 'open' | 'closed';

interface StatusBadgeProps {
  status: Status | string;
  variant?: 'badge' | 'dot';
  className?: string;
}

const statusColors: Record<string, { badge: string; dot: string; text: string }> = {
  pending: {
    badge: 'bg-yellow-900/50 text-yellow-300',
    dot: 'bg-yellow-400',
    text: 'Pending',
  },
  active: {
    badge: 'bg-green-900/50 text-green-300',
    dot: 'bg-green-400',
    text: 'Active',
  },
  settled: {
    badge: 'bg-blue-900/50 text-blue-300',
    dot: 'bg-blue-400',
    text: 'Settled',
  },
  cancelled: {
    badge: 'bg-red-900/50 text-red-300',
    dot: 'bg-red-400',
    text: 'Cancelled',
  },
  overdue: {
    badge: 'bg-red-900/50 text-red-300',
    dot: 'bg-red-500',
    text: 'Overdue',
  },
  open: {
    badge: 'bg-green-900/50 text-green-300',
    dot: 'bg-green-400',
    text: 'Open',
  },
  closed: {
    badge: 'bg-gray-900/50 text-gray-300',
    dot: 'bg-gray-400',
    text: 'Closed',
  },
};

export function StatusBadge({ status, variant = 'badge', className }: StatusBadgeProps) {
  const statusLower = status.toLowerCase();
  const config = statusColors[statusLower] || statusColors.pending;

  if (variant === 'dot') {
    return (
      <div className={cn('flex items-center', className)} title={config.text}>
        <span className={cn('w-2.5 h-2.5 rounded-full', config.dot)} />
      </div>
    );
  }

  return (
    <span className={cn('badge', config.badge, className)}>
      {config.text}
    </span>
  );
}
