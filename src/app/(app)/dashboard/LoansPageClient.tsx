'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AgreementsTable } from '@/components/AgreementsTable';
import { cn } from '@/lib/utils';
import type { Agreement } from '@/lib/supabase/db';

interface User {
  id: number;
  email: string;
  fullName: string | null;
}

interface LoansPageClientProps {
  agreements: Agreement[];
  currentUser: User;
}

type FilterType = 'all' | 'pending' | 'active' | 'settled';

export function LoansPageClient({ agreements, currentUser }: LoansPageClientProps) {
  const [currentFilter, setCurrentFilter] = useState<FilterType>('all');

  const handleFilterClick = (filter: FilterType) => {
    setCurrentFilter(filter);
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-[28px] font-semibold m-0">Loans</h1>
      </div>

      {/* Main card container */}
      <div className="bg-pf-card border border-pf-card-border rounded-2xl p-6">
        {/* Subtitle */}
        <p className="text-pf-muted text-sm mb-6 leading-relaxed">
          All your loan agreements in one place.
        </p>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 border-b border-pf-card-border">
          <FilterTab
            label="All"
            active={currentFilter === 'all'}
            onClick={() => handleFilterClick('all')}
          />
          <FilterTab
            label="Pending"
            active={currentFilter === 'pending'}
            onClick={() => handleFilterClick('pending')}
          />
          <FilterTab
            label="Active"
            active={currentFilter === 'active'}
            onClick={() => handleFilterClick('active')}
          />
          <FilterTab
            label="Settled"
            active={currentFilter === 'settled'}
            onClick={() => handleFilterClick('settled')}
          />
        </div>

        {/* Agreements table */}
        <AgreementsTable
          agreements={agreements}
          currentUser={currentUser}
          filter={currentFilter}
        />

        {/* New agreement button at bottom */}
        <div className="flex justify-end mt-4 pt-4">
          <Link
            href="/calculate"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-pf-accent text-pf-bg font-bold hover:brightness-105 transition-all"
          >
            <span className="text-lg font-bold">+</span>
            <span>New Loan Agreement</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

interface FilterTabProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function FilterTab({ label, active, onClick }: FilterTabProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2.5 cursor-pointer text-sm font-medium border-b-2 -mb-px transition-colors bg-transparent border-0',
        active
          ? 'text-pf-accent border-b-pf-accent'
          : 'text-pf-muted border-b-transparent hover:text-pf-text'
      )}
    >
      {label}
    </button>
  );
}
