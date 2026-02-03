'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  paid_up_cents: number;
  split_mode: string;
  people_count: number;
  magic_token: string;
  invite_code: string | null;
  created_at: string;
  updated_at: string;
  // Gift fields
  gift_mode: string | null;
  recipient_name: string | null;
  about_text: string | null;
  about_image_path: string | null;
  about_link: string | null;
  amount_target: number | null;
  is_open_pot: boolean;
  payment_methods_json: string | null;
  creator_user_id: number;
}

interface Participant {
  id: number;
  guest_name: string | null;
  fair_share_cents: number | null;
  total_paid_cents: number;
  role: string;
  price_group_id: string | null;
  user?: {
    id: number;
    full_name: string | null;
  };
}

interface PaymentMethod {
  type: string;
  details: Record<string, string>;
}

export default function GroupTabDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tabId = params.id as string;
  
  const [tab, setTab] = useState<GroupTab | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchTab = useCallback(async () => {
    try {
      const response = await fetch(`/api/grouptabs/${tabId}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to load GroupTab');
        setLoading(false);
        return;
      }

      setTab(data.tab);
      setParticipants(data.participants || []);
      setLoading(false);
    } catch {
      setError('Failed to load GroupTab');
      setLoading(false);
    }
  }, [tabId]);

  useEffect(() => {
    fetchTab();
  }, [fetchTab]);

  const getShareLink = () => {
    if (!tab) return '';
    if (tab.invite_code) {
      return `${window.location.origin}/tab/${tab.invite_code}`;
    }
    return `${window.location.origin}/grouptabs/guest?token=${tab.magic_token}`;
  };

  const copyShareLink = async () => {
    const link = getShareLink();
    await navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const shareViaNavigator = async () => {
    if ('share' in navigator) {
      try {
        await navigator.share({
          title: tab?.name || 'GroupTab',
          text: `Join my GroupTab: ${tab?.name}`,
          url: getShareLink(),
        });
      } catch (err) {
        // User cancelled or share failed
        console.log('Share cancelled', err);
      }
    } else {
      copyShareLink();
    }
  };

  if (loading) {
    return (
      <div className="max-w-[960px] mx-auto px-6">
        <div className="text-center py-20">
          <div className="w-8 h-8 border-[3px] border-white/10 border-t-pf-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-pf-muted">Loading GroupTab...</p>
        </div>
      </div>
    );
  }

  if (error || !tab) {
    return (
      <div className="max-w-[960px] mx-auto px-6">
        <div className="text-center py-20">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-pf-muted mb-6">{error || 'GroupTab not found'}</p>
          <Link href="/grouptabs" className="btn-primary">
            Back to GroupTabs
          </Link>
        </div>
      </div>
    );
  }

  // Calculate amounts
  const isGiftPot = tab.gift_mode === 'gift_pot_target' || tab.gift_mode === 'gift_pot_open' || tab.is_open_pot;
  const totalCents = tab.total_amount_cents || 0;
  const paidCents = tab.paid_up_cents || 0;
  const targetCents = tab.amount_target || totalCents;
  const unpaidCents = targetCents - paidCents;
  const progressPercent = targetCents > 0 ? Math.min(100, Math.round((paidCents / targetCents) * 100)) : 0;
  const perPersonAmount = totalCents && tab.people_count ? Math.round(totalCents / tab.people_count) : 0;
  const isSettled = tab.status === 'closed' || (targetCents > 0 && paidCents >= targetCents);

  // Payment methods
  const paymentMethods: PaymentMethod[] = tab.payment_methods_json 
    ? JSON.parse(tab.payment_methods_json) 
    : [];

  // Get emoji for tab type
  const getEmoji = () => {
    if (tab.template === 'gift') return isGiftPot ? '💰' : '🎁';
    if (tab.template === 'restaurant') return '🍽️';
    if (tab.template === 'trip') return '✈️';
    return '🧾';
  };

  const getPaymentIcon = (type: string) => {
    switch (type) {
      case 'bank': return '🏦';
      case 'paypal': return '💳';
      case 'tikkie': return '📱';
      case 'cash': return '💵';
      default: return '💳';
    }
  };

  const getPaymentLabel = (type: string) => {
    switch (type) {
      case 'bank': return 'Bank Transfer';
      case 'paypal': return 'PayPal';
      case 'tikkie': return 'Tikkie';
      case 'cash': return 'Cash';
      default: return type;
    }
  };

  return (
    <div className="max-w-[960px] mx-auto px-6 -mt-5 pb-32">
      {/* Header Card */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 md:p-8 relative">
        {/* Nav bar */}
        <div className="flex justify-between items-center mb-3">
          <Link href="/grouptabs" className="text-xl text-pf-text">
            ←
          </Link>
          <button
            onClick={() => setShowShareModal(true)}
            className="w-10 h-10 rounded-full border border-[#30363d] flex items-center justify-center text-pf-muted hover:border-pf-accent hover:text-pf-accent hover:bg-pf-accent/10 hover:scale-[1.08] transition-all"
          >
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
        </div>

        {/* Header content */}
        <div className="flex gap-5 items-center mb-4">
          {/* Icon */}
          <div className="text-7xl flex-shrink-0">
            {tab.about_image_path ? (
              <Image 
                src={tab.about_image_path} 
                alt="" 
                width={110} 
                height={110} 
                className="w-[110px] h-[110px] rounded-xl object-cover"
              />
            ) : (
              getEmoji()
            )}
          </div>
          
          {/* Title & meta */}
          <div className="flex-1">
            <h1 className="text-[26px] font-black text-white mb-1 leading-tight">{tab.name}</h1>
            <div className="flex items-center gap-2 text-sm text-pf-muted">
              <span>{tab.people_count} people</span>
              <span>·</span>
              <span className="capitalize">{tab.split_mode} split</span>
            </div>
            {tab.recipient_name && (
              <div className="text-sm text-pf-muted mt-1">
                For: <span className="text-pf-accent">{tab.recipient_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2.5 mb-6 flex-wrap">
          <button
            onClick={shareViaNavigator}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-[10px] text-pf-text text-sm font-medium hover:bg-white/10 hover:border-white/20 transition-all whitespace-nowrap"
          >
            <span>📤</span> Invite
          </button>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-[10px] text-pf-text text-sm font-medium hover:bg-white/10 hover:border-white/20 transition-all whitespace-nowrap"
          >
            <span>💳</span> Payment Info
          </button>
          <button
            onClick={() => router.push(`/grouptabs/${tabId}/edit`)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-[10px] text-pf-text text-sm font-medium hover:bg-white/10 hover:border-white/20 transition-all whitespace-nowrap"
          >
            <span>✏️</span> Edit
          </button>
        </div>

        {/* About text */}
        {tab.about_text && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-[20px] p-4 mb-6">
            <div className="text-xs font-semibold text-pf-muted uppercase tracking-wider mb-2">About</div>
            <p className="text-[15px] text-white font-bold">{tab.about_text}</p>
            {tab.about_link && (
              <a 
                href={tab.about_link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-pf-accent/10 border border-pf-accent/30 rounded-lg text-pf-accent text-sm font-medium hover:bg-pf-accent/20 transition-colors"
              >
                🔗 View Product
              </a>
            )}
          </div>
        )}

        {/* Bill summary */}
        <div className="flex justify-between items-center mt-7 mb-3">
          <div>
            <div className="text-[9px] font-semibold text-pf-muted uppercase tracking-wider mb-0.5">
              {isGiftPot ? 'Raised' : 'Paid'}
            </div>
            <div className="text-[28px] font-bold text-pf-accent">{formatCurrency2(paidCents)}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-semibold text-pf-muted uppercase tracking-wider mb-0.5">
              {isGiftPot ? (tab.is_open_pot ? 'Open Pot' : 'Target') : 'Total'}
            </div>
            <div className="text-[28px] font-bold text-pf-text">
              {tab.is_open_pot ? '∞' : formatCurrency2(targetCents)}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {!tab.is_open_pot && (
          <div className="mt-2">
            <div className="flex justify-between items-center text-xs text-pf-muted mb-1">
              <span>{progressPercent}% {isGiftPot ? 'raised' : 'paid'}</span>
              {!isGiftPot && unpaidCents > 0 && (
                <span>{formatCurrency2(unpaidCents)} remaining</span>
              )}
            </div>
            <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${isSettled ? 'bg-[#818cf8]' : 'bg-pf-accent'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Status line */}
        <div className="pt-4 mt-4 border-t border-white/[0.06] text-center text-sm">
          {isSettled ? (
            <span className="text-[#818cf8] font-medium">✓ Settled</span>
          ) : (
            <span className="text-pf-muted">
              {participants.length} of {tab.people_count} joined
              {perPersonAmount > 0 && ` · ${formatCurrency2(perPersonAmount)} per person`}
            </span>
          )}
        </div>
      </div>

      {/* Participants Section */}
      <div className="mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-pf-text">Participants</h2>
          <span className="text-sm text-pf-muted">{participants.length}/{tab.people_count}</span>
        </div>

        {participants.length === 0 ? (
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3 opacity-40">👥</div>
            <p className="text-pf-muted mb-4">No one has joined yet</p>
            <button
              onClick={shareViaNavigator}
              className="inline-flex items-center gap-2 px-6 py-3 bg-pf-accent text-pf-bg rounded-xl font-semibold hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(61,220,151,0.3)] transition-all"
            >
              📤 Share Invite Link
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {participants.map((p) => {
              const owedCents = p.fair_share_cents || perPersonAmount;
              const paidPercent = owedCents > 0 ? Math.min(100, Math.round((p.total_paid_cents / owedCents) * 100)) : 0;
              const isPaid = p.total_paid_cents >= owedCents;
              
              return (
                <div
                  key={p.id}
                  className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 flex items-center gap-4"
                >
                  {/* Avatar */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                    isPaid ? 'bg-pf-accent/20 text-pf-accent' : 'bg-white/10 text-pf-text'
                  }`}>
                    {(p.guest_name || p.user?.full_name || '?')[0].toUpperCase()}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-pf-text truncate">
                        {p.guest_name || p.user?.full_name || 'Unknown'}
                      </span>
                      {p.role === 'host' && (
                        <span className="text-[10px] font-semibold text-pf-bg bg-pf-accent px-2 py-0.5 rounded-full">
                          HOST
                        </span>
                      )}
                    </div>
                    {/* Progress */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${isPaid ? 'bg-pf-accent' : 'bg-[#f59e0b]'}`}
                          style={{ width: `${paidPercent}%` }}
                        />
                      </div>
                      <span className="text-xs text-pf-muted whitespace-nowrap">
                        {isPaid ? '✓' : `${formatCurrency2(p.total_paid_cents)} / ${formatCurrency2(owedCents)}`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment Methods Section */}
      {paymentMethods.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-pf-text mb-4">Payment Methods</h2>
          <div className="space-y-3">
            {paymentMethods.map((method, idx) => (
              <PaymentMethodCard key={idx} method={method} />
            ))}
          </div>
        </div>
      )}

      {/* Footer bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161b22]/95 backdrop-blur-lg border-t border-[#30363d] px-4 py-3 z-50">
        <div className="max-w-[960px] mx-auto flex items-center justify-center gap-3">
          <button
            onClick={() => setShowShareModal(true)}
            className="w-12 h-12 rounded-full border border-[#30363d] flex items-center justify-center text-pf-muted hover:border-pf-accent hover:text-pf-accent hover:bg-pf-accent/10 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="flex-1 max-w-[200px] py-3 bg-[#f59e0b] text-pf-bg rounded-xl font-bold text-sm hover:bg-[#fbbf24] transition-colors"
          >
            Report Payment
          </button>
          <button
            className="flex-1 max-w-[200px] py-3 bg-pf-accent text-pf-bg rounded-xl font-bold text-sm hover:bg-[#4ade80] transition-colors"
          >
            Mark as Paid
          </button>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div 
          className="fixed inset-0 bg-black/90 z-[1000] flex items-center justify-center p-4"
          onClick={() => setShowShareModal(false)}
        >
          <div 
            className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">Share Tab</h3>
              <button 
                onClick={() => setShowShareModal(false)}
                className="text-2xl text-pf-muted hover:text-pf-text"
              >
                ×
              </button>
            </div>
            
            <p className="text-sm text-pf-muted mb-4">
              Share this link with friends to let them join the tab
            </p>
            
            <div className="bg-black/30 border border-[#30363d] rounded-xl p-3 mb-4 break-all text-sm text-pf-text">
              {getShareLink()}
            </div>
            
            <button
              onClick={copyShareLink}
              className="w-full py-3.5 bg-pf-accent text-pf-bg rounded-xl font-bold hover:bg-[#4ade80] transition-colors"
            >
              {copiedLink ? '✓ Copied!' : 'Copy Link'}
            </button>
            
            {'share' in navigator && (
              <button
                onClick={shareViaNavigator}
                className="w-full py-3.5 mt-3 bg-white/5 border border-white/10 text-pf-text rounded-xl font-semibold hover:bg-white/10 transition-colors"
              >
                Share via...
              </button>
            )}
          </div>
        </div>
      )}

      {/* Payment Info Modal */}
      {showPaymentModal && (
        <div 
          className="fixed inset-0 bg-black/90 z-[1000] flex items-end sm:items-center justify-center"
          onClick={() => setShowPaymentModal(false)}
        >
          <div 
            className="bg-[#161b22] border border-[#30363d] rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">Payment Methods</h3>
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="text-2xl text-pf-muted hover:text-pf-text"
              >
                ×
              </button>
            </div>
            
            {paymentMethods.length === 0 ? (
              <p className="text-center text-pf-muted py-8">
                No payment methods configured
              </p>
            ) : (
              <div className="space-y-4">
                {paymentMethods.map((method, idx) => (
                  <div key={idx} className="bg-black/20 border border-[#30363d] rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{getPaymentIcon(method.type)}</span>
                      <span className="font-semibold">{getPaymentLabel(method.type)}</span>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(method.details).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center text-sm">
                          <span className="text-pf-muted capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-pf-text">{value}</span>
                            <button
                              onClick={() => navigator.clipboard.writeText(value)}
                              className="px-2 py-1 text-xs border border-[#30363d] rounded text-pf-muted hover:border-pf-accent hover:text-pf-accent transition-colors"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentMethodCard({ method }: { method: PaymentMethod }) {
  const [expanded, setExpanded] = useState(false);
  
  const getIcon = (type: string) => {
    switch (type) {
      case 'bank': return '🏦';
      case 'paypal': return '💳';
      case 'tikkie': return '📱';
      case 'cash': return '💵';
      default: return '💳';
    }
  };

  const getLabel = (type: string) => {
    switch (type) {
      case 'bank': return 'Bank Transfer';
      case 'paypal': return 'PayPal';
      case 'tikkie': return 'Tikkie';
      case 'cash': return 'Cash';
      default: return type;
    }
  };

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getIcon(method.type)}</span>
          <span className="font-semibold text-pf-text">{getLabel(method.type)}</span>
        </div>
        <span className={`text-xs text-pf-muted transition-transform ${expanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      {expanded && (
        <div className="border-t border-white/5 px-4 pb-4">
          {Object.entries(method.details).map(([key, value]) => (
            <div key={key} className="flex justify-between items-center py-3 border-b border-white/5 last:border-0">
              <span className="text-xs text-pf-muted capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-pf-text font-medium">{value}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(value)}
                  className="px-2.5 py-1.5 text-xs border border-[#30363d] rounded-md text-pf-muted hover:border-pf-accent hover:text-pf-accent transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
