'use client';

import { cn } from '@/lib/utils';

type Status = 'pending' | 'active' | 'settled' | 'cancelled' | 'declined' | 'overdue';

interface StatusDotProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<Status, { color: string; label: string }> = {
  pending: { color: 'bg-yellow-400', label: 'Pending' },
  active: { color: 'bg-green-500', label: 'Active' },
  settled: { color: 'bg-gray-400', label: 'Settled' },
  cancelled: { color: 'bg-gray-400', label: 'Cancelled' },
  declined: { color: 'bg-red-400', label: 'Declined' },
  overdue: { color: 'bg-red-400', label: 'Overdue' },
};

export function StatusDot({ status, className }: StatusDotProps) {
  const config = statusConfig[status] || statusConfig.pending;

  return (
    <div className={cn('relative inline-flex items-center justify-center group', className)}>
      <span
        className={cn(
          'inline-block w-4 h-4 rounded-full cursor-help',
          config.color
        )}
        role="img"
        aria-label={config.label}
      />
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 border border-white/10 z-50">
        {config.label}
        {/* Tooltip arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
      </div>
    </div>
  );
}
