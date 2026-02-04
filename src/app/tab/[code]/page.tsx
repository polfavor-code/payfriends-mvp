'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  gift_mode: string | null;
  recipient_name: string | null;
  about_text: string | null;
  about_image_path: string | null;
  about_link: string | null;
  amount_target: number | null;
  is_open_pot: boolean;
  payment_methods_json: string | null;
  creator_name?: string;
  creator_user_id?: number;
}

interface Participant {
  id: number;
  guest_name: string | null;
  fair_share_cents: number | null;
  remaining_cents: number | null;
  total_paid_cents: number;
  role: string;
  guest_session_token: string | null;
  user?: {
    id: number;
    full_name: string | null;
  };
}

interface PaymentMethod {
  type: string;
  details: Record<string, string>;
}

export default function PublicTabPage() {
  const params = useParams();
  const router = useRouter();
  const inviteCode = params.code as string;
  
  const [tab, setTab] = useState<GroupTab | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Join form state
  const [joined, setJoined] = useState(false);
  const [joiningName, setJoiningName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  
  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportAmount, setReportAmount] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const fetchTab = useCallback(async () => {
    try {
      const response = await fetch(`/api/grouptabs/invite/${inviteCode}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Tab not found');
        setLoading(false);
        return;
      }

      // Check if current user is the organizer - redirect to management view
      try {
        const userResponse = await fetch('/api/user');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          if (userData.id === data.tab.creator_user_id) {
            // Organizer should go to the management view
            router.push(`/grouptabs/${data.tab.id}`);
            return;
          }
        }
      } catch {
        // Not logged in or error - continue as guest
      }

      setTab(data.tab);
      setParticipants(data.participants || []);
      
      // Check if already joined via session
      const sessionToken = localStorage.getItem(`tab_session_${inviteCode}`);
      if (sessionToken) {
        const existingParticipant = data.participants?.find(
          (p: Participant) => p.guest_session_token === sessionToken
        );
        if (existingParticipant) {
          setCurrentParticipant(existingParticipant);
          setJoined(true);
        }
      }
      
      setLoading(false);
    } catch {
      setError('Failed to load tab');
      setLoading(false);
    }
  }, [inviteCode, router]);

  useEffect(() => {
    fetchTab();
  }, [fetchTab]);

  const handleJoin = async () => {
    if (!joiningName.trim()) {
      setJoinError('Please enter your name');
      return;
    }
    
    setJoining(true);
    setJoinError('');
    
    try {
      const response = await fetch(`/api/grouptabs/invite/${inviteCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: joiningName.trim(),
          isPrivate,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setJoinError(data.error || 'Failed to join');
        setJoining(false);
        return;
      }
      
      // Store session token
      if (data.sessionToken) {
        localStorage.setItem(`tab_session_${inviteCode}`, data.sessionToken);
      }
      
      setCurrentParticipant(data.participant);
      setJoined(true);
      setJoining(false);
      
      // Refresh tab data
      fetchTab();
    } catch {
      setJoinError('Failed to join tab');
      setJoining(false);
    }
  };

  const handleReportPayment = async () => {
    const amountCents = Math.round(parseFloat(reportAmount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      return;
    }
    
    setReportSubmitting(true);
    
    try {
      const sessionToken = localStorage.getItem(`tab_session_${inviteCode}`);
      const response = await fetch(`/api/grouptabs/invite/${inviteCode}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents,
          sessionToken,
        }),
      });
      
      if (response.ok) {
        setShowReportModal(false);
        setReportAmount('');
        fetchTab();
      }
    } catch {
      // Silent fail
    }
    
    setReportSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1a2233] to-[#0a0c10] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-8 h-8 border-[3px] border-white/10 border-t-pf-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-pf-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !tab) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1a2233] to-[#0a0c10] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">🔗</div>
          <h2 className="text-xl font-semibold mb-2">Tab Not Found</h2>
          <p className="text-pf-muted">{error || 'This invite link may have expired or been removed.'}</p>
        </div>
      </div>
    );
  }

  // Calculate amounts
  const isGiftPot = tab.gift_mode === 'gift_pot_target' || tab.gift_mode === 'gift_pot_open' || tab.is_open_pot;
  const totalCents = tab.total_amount_cents || 0;
  const paidCents = tab.paid_up_cents || 0;
  const targetCents = tab.amount_target || totalCents;
  const progressPercent = targetCents > 0 ? Math.min(100, Math.round((paidCents / targetCents) * 100)) : 0;
  const perPersonAmount = totalCents && tab.people_count ? Math.round(totalCents / tab.people_count) : 0;

  // Payment methods
  const paymentMethods: PaymentMethod[] = tab.payment_methods_json 
    ? JSON.parse(tab.payment_methods_json) 
    : [];

  const getEmoji = () => {
    if (tab.template === 'gift') return isGiftPot ? '💰' : '🎁';
    if (tab.template === 'restaurant') return '🍽️';
    return '🧾';
  };

  // Join Screen
  if (!joined) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1a2233] to-[#0a0c10] flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-[400px] animate-[joinFadeIn_0.6s_ease-out]">
          {/* Header */}
          <div className="flex items-center gap-4 mb-12">
            <div className="w-14 h-14 rounded-[18px] bg-gradient-to-br from-pf-accent/20 to-pf-accent/5 border border-white/10 flex items-center justify-center text-xl shadow-lg">
              {tab.about_image_path ? (
                <Image src={tab.about_image_path} alt="" width={56} height={56} className="w-full h-full object-cover rounded-[18px]" />
              ) : (
                getEmoji()
              )}
            </div>
            <div>
              <h2 className="text-[22px] font-bold text-white tracking-tight mb-1">{tab.name}</h2>
              <p className="text-sm text-pf-muted">
                Organized by <span className="text-pf-accent font-medium">{tab.creator_name || 'someone'}</span>
              </p>
            </div>
          </div>

          {/* Name input */}
          <div className="mb-12">
            <label className="block text-xs font-semibold text-pf-muted uppercase tracking-wider mb-3">
              Your Name
            </label>
            <input
              type="text"
              value={joiningName}
              onChange={(e) => setJoiningName(e.target.value)}
              placeholder="Enter your name"
              className="w-full bg-transparent border-b-2 border-white/15 focus:border-pf-accent py-3.5 text-lg text-white placeholder:text-white/25 outline-none transition-colors"
              maxLength={50}
              autoFocus
            />
            
            {/* Privacy option */}
            <label className="flex items-start gap-2.5 mt-4 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="hidden"
              />
              <div className={`w-[18px] h-[18px] mt-0.5 rounded border-2 flex items-center justify-center transition-all ${
                isPrivate ? 'bg-pf-accent border-pf-accent' : 'border-white/20'
              }`}>
                {isPrivate && <span className="text-[11px] text-black font-bold">✓</span>}
              </div>
              <div>
                <span className="text-[13px] text-white/70 font-medium">Hide my name from others</span>
                <span className="block text-[11px] text-white/35">Only the organizer will see your name</span>
              </div>
            </label>
          </div>

          {/* Join button */}
          {joinError && (
            <div className="text-red-400 text-sm text-center mb-4 px-3 py-2 bg-red-500/10 rounded-xl">
              {joinError}
            </div>
          )}
          <button
            onClick={handleJoin}
            disabled={joining || !joiningName.trim()}
            className="w-full bg-white text-[#0e1116] py-5 px-8 rounded-full text-base font-bold shadow-[0_4px_24px_rgba(255,255,255,0.1)] flex justify-between items-center hover:bg-[#f5f5f5] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{joining ? 'Joining...' : 'Join Tab'}</span>
            <span className="text-xl">→</span>
          </button>
        </div>
        
        <style jsx global>{`
          @keyframes joinFadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  // Joined View
  return (
    <div className="min-h-screen bg-[#0e1116] pb-32">
      {/* Header Card */}
      <div className="bg-[#161b22] border-b border-[#30363d] p-6">
        <div className="max-w-[600px] mx-auto">
          {/* Top section */}
          <div className="flex gap-4 items-center mb-4">
            <div className="text-5xl flex-shrink-0">
              {tab.about_image_path ? (
                <Image src={tab.about_image_path} alt="" width={72} height={72} className="w-[72px] h-[72px] rounded-xl object-cover" />
              ) : (
                getEmoji()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black text-white mb-0.5 truncate">{tab.name}</h1>
              <p className="text-sm text-pf-muted">
                By {tab.creator_name || 'someone'} · {participants.length}/{tab.people_count} joined
              </p>
              {tab.recipient_name && (
                <p className="text-sm text-pf-muted mt-0.5">
                  For: <span className="text-pf-accent">{tab.recipient_name}</span>
                </p>
              )}
            </div>
          </div>

          {/* About section */}
          {tab.about_text && (
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 mb-4">
              <p className="text-sm text-white">{tab.about_text}</p>
              {tab.about_link && (
                <a 
                  href={tab.about_link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-sm text-pf-accent hover:underline"
                >
                  🔗 View Product
                </a>
              )}
            </div>
          )}

          {/* Progress */}
          <div className="flex justify-between items-end mb-2">
            <div>
              <div className="text-[10px] font-semibold text-pf-muted uppercase mb-0.5">{isGiftPot ? 'Raised' : 'Paid'}</div>
              <div className="text-2xl font-bold text-pf-accent">{formatCurrency2(paidCents)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-semibold text-pf-muted uppercase mb-0.5">{isGiftPot ? 'Target' : 'Total'}</div>
              <div className="text-2xl font-bold text-white">{formatCurrency2(targetCents)}</div>
            </div>
          </div>
          <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
            <div 
              className="h-full bg-pf-accent rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-center text-xs text-pf-muted mt-2">{progressPercent}% complete</div>
        </div>
      </div>

      {/* My contribution */}
      {currentParticipant && (
        <div className="max-w-[600px] mx-auto px-4 mt-6">
          <div className="bg-pf-accent/10 border border-pf-accent/30 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-pf-accent/20 flex items-center justify-center text-lg font-bold text-pf-accent">
                  {(currentParticipant.guest_name || 'You')[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-white">{currentParticipant.guest_name || 'You'}</p>
                  <p className="text-xs text-pf-muted">
                    {currentParticipant.total_paid_cents > 0 
                      ? `${formatCurrency2(currentParticipant.total_paid_cents)} contributed` 
                      : 'Not paid yet'}
                  </p>
                </div>
              </div>
              {currentParticipant.total_paid_cents >= (currentParticipant.fair_share_cents || perPersonAmount) ? (
                <span className="px-3 py-1.5 bg-pf-accent text-pf-bg rounded-full text-xs font-bold">
                  ✓ Paid
                </span>
              ) : (
                <button
                  onClick={() => setShowReportModal(true)}
                  className="px-4 py-2 bg-pf-accent text-pf-bg rounded-xl text-sm font-bold hover:bg-[#4ade80] transition-colors"
                >
                  I&apos;ve Paid
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Participants list */}
      <div className="max-w-[600px] mx-auto px-4 mt-6">
        <h2 className="text-sm font-semibold text-pf-muted uppercase tracking-wider mb-3">Participants</h2>
        <div className="space-y-2">
          {participants.map((p) => {
            const isPaid = p.total_paid_cents >= (p.fair_share_cents || perPersonAmount);
            return (
              <div key={p.id} className="bg-[#161b22] border border-[#30363d] rounded-xl p-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                  isPaid ? 'bg-pf-accent/20 text-pf-accent' : 'bg-white/10 text-pf-text'
                }`}>
                  {(p.guest_name || p.user?.full_name || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {p.guest_name || p.user?.full_name || 'Anonymous'}
                    {p.role === 'host' && <span className="text-[10px] text-pf-accent ml-1.5">HOST</span>}
                  </p>
                </div>
                {isPaid ? (
                  <span className="text-pf-accent text-xs font-medium">✓ Paid</span>
                ) : (
                  <span className="text-pf-muted text-xs">Pending</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161b22]/95 backdrop-blur-lg border-t border-[#30363d] px-4 py-4 z-50">
        <div className="max-w-[600px] mx-auto flex gap-3">
          <button
            onClick={() => setShowPaymentModal(true)}
            className="flex-1 py-3.5 bg-white/5 border border-white/10 text-white rounded-xl font-semibold hover:bg-white/10 transition-colors"
          >
            💳 How to Pay
          </button>
          {!currentParticipant || currentParticipant.total_paid_cents < (currentParticipant.fair_share_cents || perPersonAmount) ? (
            <button
              onClick={() => setShowReportModal(true)}
              className="flex-1 py-3.5 bg-pf-accent text-pf-bg rounded-xl font-bold hover:bg-[#4ade80] transition-colors"
            >
              I&apos;ve Paid
            </button>
          ) : null}
        </div>
      </div>

      {/* Payment Methods Modal */}
      {showPaymentModal && (
        <div 
          className="fixed inset-0 bg-black/90 z-[1000] flex items-end sm:items-center justify-center"
          onClick={() => setShowPaymentModal(false)}
        >
          <div 
            className="bg-[#161b22] border border-[#30363d] rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold">How to Pay</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-2xl text-pf-muted hover:text-pf-text">×</button>
            </div>
            
            {perPersonAmount > 0 && (
              <p className="text-sm text-pf-muted mb-4">
                Pay <span className="text-pf-accent font-semibold">{formatCurrency2(perPersonAmount)}</span> to {tab.creator_name || 'the organizer'}
              </p>
            )}
            
            {paymentMethods.length === 0 ? (
              <div className="text-center py-8 text-pf-muted">
                <span className="text-4xl block mb-3">💳</span>
                <p>Payment details not added yet.</p>
                <p className="text-sm">Contact the organizer for payment instructions.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentMethods.map((method, idx) => (
                  <PaymentMethodCard key={idx} method={method} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Report Payment Modal */}
      {showReportModal && (
        <div 
          className="fixed inset-0 bg-black/90 z-[1000] flex items-end sm:items-center justify-center"
          onClick={() => setShowReportModal(false)}
        >
          <div 
            className="bg-[#161b22] border border-[#30363d] rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">Report Payment</h3>
              <button onClick={() => setShowReportModal(false)} className="text-2xl text-pf-muted hover:text-pf-text">×</button>
            </div>
            
            <div className="mb-4">
              <label className="block text-xs text-pf-muted uppercase tracking-wider mb-2">Amount Paid</label>
              <div className="flex items-center gap-2 bg-white/5 border border-[#30363d] rounded-xl px-4 py-3">
                <span className="text-pf-muted">€</span>
                <input
                  type="number"
                  step="0.01"
                  value={reportAmount}
                  onChange={(e) => setReportAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 bg-transparent text-white text-lg outline-none"
                />
              </div>
              {perPersonAmount > 0 && (
                <button
                  onClick={() => setReportAmount((perPersonAmount / 100).toFixed(2))}
                  className="mt-2 px-3 py-1.5 bg-pf-accent/10 border border-pf-accent rounded-full text-pf-accent text-xs font-semibold hover:bg-pf-accent/20 transition-colors"
                >
                  Use fair share: {formatCurrency2(perPersonAmount)}
                </button>
              )}
            </div>
            
            <button
              onClick={handleReportPayment}
              disabled={reportSubmitting || !reportAmount}
              className="w-full py-4 bg-pf-accent text-pf-bg rounded-xl font-bold text-base hover:bg-[#4ade80] transition-colors disabled:opacity-50"
            >
              {reportSubmitting ? 'Submitting...' : 'Submit Payment'}
            </button>
            
            <p className="text-xs text-pf-muted text-center mt-3">
              The organizer will confirm your payment
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentMethodCard({ method }: { method: PaymentMethod }) {
  const [expanded, setExpanded] = useState(true);
  
  const icons: Record<string, string> = { bank: '🏦', paypal: '💳', tikkie: '📱', cash: '💵' };
  const labels: Record<string, string> = { bank: 'Bank Transfer', paypal: 'PayPal', tikkie: 'Tikkie', cash: 'Cash' };
  
  return (
    <div className="bg-black/20 border border-[#30363d] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icons[method.type] || '💳'}</span>
          <span className="font-semibold text-pf-text">{labels[method.type] || method.type}</span>
        </div>
        <span className={`text-xs text-pf-muted transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {expanded && (
        <div className="border-t border-white/5 px-4 pb-4">
          {Object.entries(method.details).map(([key, value]) => (
            <div key={key} className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0">
              <span className="text-xs text-pf-muted capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-pf-text">{value}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(value)}
                  className="px-2 py-1 text-xs border border-[#30363d] rounded text-pf-muted hover:border-pf-accent hover:text-pf-accent transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
          ))}
          {method.type === 'tikkie' && method.details.link && (
            <a
              href={method.details.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-3 text-center py-3 bg-pf-accent text-pf-bg rounded-lg font-semibold hover:bg-[#4ade80] transition-colors"
            >
              Open Tikkie →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
