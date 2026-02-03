'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatCurrency2 } from '@/lib/formatters';

interface GroupTab {
  id: number;
  name: string;
  description: string | null;
  tab_type: string;
  template: string | null;
  status: string;
  total_amount_cents: number | null;
  paid_up_cents: number | null;
  total_raised_cents: number | null;
  amount_target: number | null;
  people_count: number;
  creator_user_id: number;
  created_at: string;
  updated_at: string;
  last_payment_at: string | null;
  magic_token: string;
  invite_code: string | null;
  gift_mode: string | null;
  is_open_pot: boolean;
  about_image_path: string | null;
  raising_for_image_path: string | null;
  organizer_contribution: number | null;
}

type FilterType = 'all' | 'open' | 'closed';
type SortType = 'newest' | 'payment_date' | 'oldest';

export default function GroupTabsPage() {
  const [tabs, setTabs] = useState<GroupTab[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFilter, setCurrentFilter] = useState<FilterType>('all');
  const [currentSort, setCurrentSort] = useState<SortType>('newest');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; tabId: number | null; tabName: string }>({
    open: false,
    tabId: null,
    tabName: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Get current user
      const userResponse = await fetch('/api/user');
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setCurrentUserId(userData.user?.id || null);
      }

      // Get tabs
      const response = await fetch('/api/grouptabs');
      const data = await response.json();
      setTabs(data.tabs || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const isTabSettled = (tab: GroupTab): boolean => {
    if (tab.status === 'closed') return true;

    const isGiftPot = tab.gift_mode === 'gift_pot_target' || tab.gift_mode === 'gift_pot_open' || tab.is_open_pot;
    const isOpenPot = tab.is_open_pot || tab.gift_mode === 'gift_pot_open';

    if (isGiftPot) {
      if (isOpenPot) return false;
      const raisedCents = tab.paid_up_cents || tab.total_raised_cents || 0;
      const targetCents = tab.amount_target || 0;
      return targetCents > 0 && raisedCents >= targetCents;
    }

    const totalCents = tab.total_amount_cents || 0;
    const paidCents = tab.paid_up_cents || 0;
    return totalCents > 0 && paidCents >= totalCents;
  };

  const getFilteredTabs = (): GroupTab[] => {
    let filtered = tabs;
    if (currentFilter === 'open') {
      filtered = tabs.filter(t => !isTabSettled(t));
    } else if (currentFilter === 'closed') {
      filtered = tabs.filter(t => isTabSettled(t));
    }

    return [...filtered].sort((a, b) => {
      if (currentSort === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (currentSort === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (currentSort === 'payment_date') {
        const dateA = a.last_payment_at ? new Date(a.last_payment_at).getTime() : 0;
        const dateB = b.last_payment_at ? new Date(b.last_payment_at).getTime() : 0;
        if (dateA !== 0 || dateB !== 0) {
          return dateB - dateA;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return 0;
    });
  };

  const handleDelete = async () => {
    if (!deleteModal.tabId) return;
    try {
      const response = await fetch(`/api/grouptabs/${deleteModal.tabId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      setTabs(tabs.filter(t => t.id !== deleteModal.tabId));
      setDeleteModal({ open: false, tabId: null, tabName: '' });
    } catch (error) {
      console.error('Error deleting tab:', error);
      alert('Failed to delete tab');
    }
  };

  const filteredTabs = getFilteredTabs();

  return (
    <div className="max-w-[1200px] mx-auto">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-extrabold tracking-tight bg-gradient-to-br from-white to-[#a7b0bd] bg-clip-text text-transparent">
            GroupTabs
          </h1>
          <p className="text-sm text-pf-muted">Split expenses with friends</p>
        </div>
        <Link
          href="/grouptabs/create"
          className="hidden sm:flex items-center gap-1.5 bg-pf-accent/15 text-pf-accent border border-pf-accent/30 px-[18px] py-2.5 rounded-3xl font-semibold text-sm hover:bg-pf-accent/25 hover:border-pf-accent/50 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(61,220,151,0.2)] transition-all"
        >
          <span>+</span> New GroupTab
        </Link>
      </div>

      {/* Filter Row */}
      <div className="flex justify-between items-center mb-5 gap-3 flex-col sm:flex-row sm:items-center">
        <div className="flex gap-2">
          {(['all', 'open', 'closed'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setCurrentFilter(filter)}
              className={`px-4 py-2 rounded-[20px] text-[13px] border transition-all ${
                currentFilter === filter
                  ? 'bg-pf-text text-pf-bg border-pf-text font-semibold'
                  : 'bg-white/[0.03] border-white/[0.08] text-pf-muted hover:bg-white/[0.06] hover:text-pf-text'
              }`}
            >
              {filter === 'all' ? 'All' : filter === 'open' ? 'Active' : 'Settled'}
            </button>
          ))}
        </div>
        <select
          value={currentSort}
          onChange={(e) => setCurrentSort(e.target.value as SortType)}
          className="bg-white/[0.03] border border-white/[0.08] text-pf-muted px-3 py-2 rounded-xl text-xs cursor-pointer focus:outline-none focus:border-pf-accent"
        >
          <option value="newest">Newest first</option>
          <option value="payment_date">Last Payment</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-[60px] text-pf-muted">
          <div className="w-8 h-8 border-[3px] border-white/10 border-t-pf-accent rounded-full animate-spin mx-auto mb-4" />
          Loading your tabs...
        </div>
      ) : filteredTabs.length === 0 ? (
        <EmptyState filter={currentFilter} />
      ) : (
        <div className="flex flex-col gap-3 pb-[100px]">
          {filteredTabs.map((tab) => (
            <TabCard
              key={tab.id}
              tab={tab}
              isCreator={tab.creator_user_id === currentUserId}
              onDelete={() => setDeleteModal({ open: true, tabId: tab.id, tabName: tab.name })}
            />
          ))}
        </div>
      )}

      {/* FAB (mobile only) */}
      <Link
        href="/grouptabs/create"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-pf-accent text-pf-bg flex items-center justify-center text-[28px] shadow-[0_4px_20px_rgba(61,220,151,0.4)] z-[200] hover:scale-[1.08] transition-transform sm:hidden"
      >
        +
      </Link>

      {/* Delete Modal */}
      {deleteModal.open && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-[4px] flex items-center justify-center z-[1000]"
          onClick={() => setDeleteModal({ open: false, tabId: null, tabName: '' })}
        >
          <div
            className="bg-[#1a1d24] border border-white/10 rounded-[20px] p-7 max-w-[380px] w-[90%] text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-5xl mb-4">🗑️</div>
            <h3 className="text-xl font-bold mb-3">Delete GroupTab?</h3>
            <p className="text-sm text-pf-muted leading-relaxed mb-6">
              This will permanently delete &quot;<strong className="text-pf-text">{deleteModal.tabName}</strong>&quot;.
              <br />
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal({ open: false, tabId: null, tabName: '' })}
                className="flex-1 py-3.5 px-5 rounded-xl text-sm font-semibold bg-white/[0.08] text-pf-text hover:bg-white/[0.12] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3.5 px-5 rounded-xl text-sm font-semibold bg-[#dc2626] text-white hover:bg-[#b91c1c] transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ filter }: { filter: FilterType }) {
  const config = {
    all: {
      icon: '📭',
      title: 'No tabs yet',
      text: 'Start a new tab to split dinner, a trip, or any shared expense with friends.',
      showBtn: true,
      btnText: 'Create your first tab',
    },
    open: {
      icon: '✨',
      title: 'All caught up!',
      text: 'No active tabs right now. All your expenses are settled.',
      showBtn: true,
      btnText: 'Start a new tab',
    },
    closed: {
      icon: '📊',
      title: 'No settled tabs',
      text: "Tabs will appear here once they're fully paid or closed.",
      showBtn: false,
      btnText: '',
    },
  }[filter];

  return (
    <div className="text-center py-20 px-5">
      <div className="text-6xl mb-4 opacity-40">{config.icon}</div>
      <h2 className="text-xl font-semibold mb-2">{config.title}</h2>
      <p className="text-pf-muted max-w-[280px] mx-auto mb-6 leading-relaxed">{config.text}</p>
      {config.showBtn && (
        <Link
          href="/grouptabs/create"
          className="inline-flex items-center gap-2 bg-pf-accent text-pf-bg px-6 py-3.5 rounded-3xl font-semibold hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(61,220,151,0.3)] transition-all"
        >
          <span>+</span> {config.btnText}
        </Link>
      )}
    </div>
  );
}

interface TabCardProps {
  tab: GroupTab;
  isCreator: boolean;
  onDelete: () => void;
}

function TabCard({ tab, isCreator, onDelete }: TabCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Calculations
  const isGiftPot = tab.gift_mode === 'gift_pot_target' || tab.gift_mode === 'gift_pot_open' || tab.is_open_pot;
  const isOpenPot = tab.is_open_pot || tab.gift_mode === 'gift_pot_open';

  let isSettled: boolean;
  let progressPercent: number;
  let unpaidCents: number;

  if (isGiftPot) {
    const raisedCents = tab.paid_up_cents || tab.total_raised_cents || 0;
    const targetCents = tab.amount_target || 0;

    if (isOpenPot) {
      isSettled = tab.status === 'closed';
      progressPercent = isSettled ? 100 : 0;
      unpaidCents = 0;
    } else {
      isSettled = tab.status === 'closed' || (targetCents > 0 && raisedCents >= targetCents);
      progressPercent = isSettled ? 100 : targetCents > 0 ? Math.min(100, Math.round((raisedCents / targetCents) * 100)) : 0;
      unpaidCents = Math.max(0, targetCents - raisedCents);
    }
  } else {
    const totalCents = tab.total_amount_cents || 0;
    const paidCents = tab.paid_up_cents || 0;
    unpaidCents = totalCents - paidCents;
    isSettled = tab.status === 'closed' || (totalCents > 0 && unpaidCents <= 0);
    progressPercent = isSettled ? 100 : totalCents > 0 ? Math.min(100, Math.round((paidCents / totalCents) * 100)) : 0;
  }

  // Progress ring
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  // Time ago
  const updatedDate = new Date(tab.last_payment_at || tab.updated_at || tab.created_at);
  const updatedText = getTimeAgo(updatedDate);

  // Emoji
  const emoji = getTabEmoji(tab);
  const uploadedImage = tab.about_image_path || tab.raising_for_image_path;

  // URL
  const tabUrl = tab.invite_code ? `/tab/${tab.invite_code}` : `/grouptabs/${tab.id}`;

  // Amount display
  let amountDisplay: React.ReactNode;
  if (isSettled) {
    amountDisplay = (
      <>
        <span className="text-[#818cf8] font-semibold">Settled</span> · <span className="text-pf-muted">Updated {updatedText}</span>
      </>
    );
  } else if (isGiftPot) {
    const raisedCents = tab.paid_up_cents || tab.total_raised_cents || 0;
    const targetCents = tab.amount_target || 0;
    if (isOpenPot) {
      amountDisplay = (
        <>
          <span className="text-[#f59e0b] font-semibold">{formatCurrency2(raisedCents)} raised</span> · <span className="text-pf-muted">Updated {updatedText}</span>
        </>
      );
    } else {
      amountDisplay = (
        <>
          <span className="text-[#f59e0b] font-semibold">{formatCurrency2(raisedCents)} / {formatCurrency2(targetCents)}</span> · <span className="text-pf-muted">Updated {updatedText}</span>
        </>
      );
    }
  } else {
    amountDisplay = (
      <>
        <span className="text-[#f59e0b] font-semibold">{formatCurrency2(unpaidCents)} unpaid</span> · <span className="text-pf-muted">Updated {updatedText}</span>
      </>
    );
  }

  return (
    <div
      className={`flex items-center gap-4 bg-white/[0.03] backdrop-blur-[10px] border border-white/[0.08] rounded-2xl px-5 py-[18px] cursor-pointer transition-all duration-[250ms] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-white/[0.06] hover:border-white/[0.15] hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.3)] ${menuOpen ? 'z-50' : ''}`}
      onClick={() => window.location.href = tabUrl}
    >
      {/* Icon */}
      <div className="w-[60px] h-[60px] flex items-center justify-center text-5xl flex-shrink-0 mr-2">
        {uploadedImage ? (
          <Image src={uploadedImage} alt="" width={60} height={60} className="w-full h-full object-cover rounded-xl border border-white/10" />
        ) : (
          emoji
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="mb-0.5">
          <span className="text-base font-semibold text-pf-text whitespace-nowrap overflow-hidden text-ellipsis block">
            {getDisplayTitle(tab)}
          </span>
        </div>
        <div className="text-sm">{amountDisplay}</div>
      </div>

      {/* Progress Ring */}
      <div className={`w-16 h-16 relative flex items-center justify-center flex-shrink-0 ${isSettled ? 'drop-shadow-[0_0_8px_rgba(129,140,248,0.25)]' : 'drop-shadow-[0_0_8px_rgba(61,220,151,0.25)]'}`}>
        <svg width="64" height="64">
          <circle
            className="fill-transparent stroke-white/[0.06]"
            strokeWidth="4"
            r={radius}
            cx="32"
            cy="32"
          />
          <circle
            className={`fill-transparent ${isSettled ? 'stroke-[#818cf8]' : 'stroke-pf-accent'}`}
            strokeWidth="4"
            strokeLinecap="round"
            r={radius}
            cx="32"
            cy="32"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <span className={`absolute text-sm font-bold ${isSettled ? 'text-[#818cf8]' : 'text-pf-text'}`}>
          {progressPercent}%
        </span>
      </div>

      {/* More Menu */}
      <div className="relative flex-shrink-0">
        <button
          className="p-2 text-pf-muted hover:text-pf-text transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
        >
          <span className="text-base tracking-[3px] leading-none">•••</span>
        </button>
        {menuOpen && (
          <div
            className="absolute top-full right-0 mt-2 bg-[rgba(22,25,32,0.98)] backdrop-blur-[20px] border border-white/10 rounded-[14px] p-2 min-w-[160px] shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_0_0_1px_rgba(255,255,255,0.05)] z-[200] animate-[menuFadeIn_0.15s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-3.5 py-3 rounded-[10px] text-sm font-medium text-pf-text cursor-pointer hover:bg-white/[0.08] whitespace-nowrap">
              <span>✏️</span> Edit
            </div>
            {isCreator && (
              <div
                className="flex items-center gap-3 px-3.5 py-3 rounded-[10px] text-sm font-medium text-[#f87171] cursor-pointer hover:bg-[rgba(248,113,113,0.15)] hover:text-[#fca5a5] whitespace-nowrap"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete();
                }}
              >
                <span>🗑️</span> Delete
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getTabEmoji(tab: GroupTab): string {
  if (tab.template === 'gift') {
    const isPotMode = tab.gift_mode === 'gift_pot_open' || tab.gift_mode === 'gift_pot_target' || tab.is_open_pot;
    return isPotMode ? '💰' : '🎁';
  }
  if (tab.template === 'restaurant') return '🍕';
  if (tab.template === 'trip') return '✈️';
  return tab.tab_type === 'one_bill' ? '🧾' : '✈️';
}

function getDisplayTitle(tab: GroupTab): string {
  let title = tab.name || 'Untitled Tab';
  const isPotMode = tab.gift_mode === 'gift_pot_open' || tab.gift_mode === 'gift_pot_target' || tab.is_open_pot;
  if (isPotMode && title.toLowerCase().startsWith('gift for')) {
    title = 'Raising money for' + title.substring(8);
  }
  return title;
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${monthNames[date.getMonth()]}`;
}
