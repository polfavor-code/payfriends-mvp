'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Message {
  id: number;
  user_id: number;
  agreement_id: number | null;
  tab_id: number | null;
  subject: string;
  body: string;
  event_type: string | null;
  created_at: string;
  read_at: string | null;
}

interface ActivityPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialMessages?: Message[];
  initialUnreadCount?: number;
  onUnreadCountChange?: (count: number) => void;
}

/**
 * Format a timestamp relative to now (e.g., "2 hours ago", "Yesterday")
 */
function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
}

/**
 * Format full timestamp for tooltip
 */
function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get human-readable description for event type
 */
function getEventDescription(message: Message): string {
  const { event_type, body } = message;

  // Default to the body if no special handling needed
  if (!event_type) return body;

  // Customize based on event type
  switch (event_type) {
    case 'AGREEMENT_SENT':
      return body || 'New loan agreement sent';
    case 'AGREEMENT_ACCEPTED':
      return body || 'Loan agreement was accepted';
    case 'AGREEMENT_DECLINED':
      return body || 'Loan agreement was declined';
    case 'AGREEMENT_CANCELLED':
      return body || 'Loan agreement was cancelled';
    case 'PAYMENT_RECEIVED':
      return body || 'Payment was received';
    case 'PAYMENT_REMINDER':
      return body || 'Payment reminder';
    case 'GROUPTAB_INVITE':
      return body || 'You were invited to a GroupTab';
    case 'GROUPTAB_JOINED':
      return body || 'Someone joined your GroupTab';
    case 'GROUPTAB_PAYMENT':
      return body || 'Payment reported on GroupTab';
    default:
      return body;
  }
}

/**
 * Get icon for event type
 */
function getEventIcon(eventType: string | null): string {
  switch (eventType) {
    case 'AGREEMENT_SENT':
      return '📤';
    case 'AGREEMENT_ACCEPTED':
      return '✅';
    case 'AGREEMENT_DECLINED':
      return '❌';
    case 'AGREEMENT_CANCELLED':
      return '🚫';
    case 'PAYMENT_RECEIVED':
      return '💰';
    case 'PAYMENT_REMINDER':
      return '⏰';
    case 'GROUPTAB_INVITE':
      return '📨';
    case 'GROUPTAB_JOINED':
      return '👋';
    case 'GROUPTAB_PAYMENT':
      return '💳';
    default:
      return '📌';
  }
}

export function ActivityPanel({
  isOpen,
  onClose,
  initialMessages = [],
  initialUnreadCount = 0,
  onUnreadCountChange,
}: ActivityPanelProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [loading, setLoading] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Calculate unread count from messages
  const unreadCount = messages.filter(m => !m.read_at).length;

  // Fetch messages when panel opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      fetchMessages();
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      // Delay adding listener to prevent immediate close
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/messages');
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        const newUnreadCount = (data.messages || []).filter((m: Message) => !m.read_at).length;
        onUnreadCountChange?.(newUnreadCount);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAllAsRead = async () => {
    setMarkingAllRead(true);
    try {
      const res = await fetch('/api/activity/mark-all-read', { method: 'POST' });
      if (res.ok) {
        // Update local state
        setMessages(prev => prev.map(m => ({ ...m, read_at: m.read_at || new Date().toISOString() })));
        onUnreadCountChange?.(0);
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const markAsRead = async (messageId: number) => {
    try {
      const res = await fetch(`/api/activity/${messageId}/mark-read`, { method: 'POST' });
      if (res.ok) {
        setMessages(prev =>
          prev.map(m =>
            m.id === messageId ? { ...m, read_at: m.read_at || new Date().toISOString() } : m
          )
        );
        onUnreadCountChange?.(Math.max(0, unreadCount - 1));
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMessageClick = (message: Message) => {
    // Mark as read
    if (!message.read_at) {
      markAsRead(message.id);
    }

    // Navigate to related item
    if (message.agreement_id) {
      router.push(`/dashboard`);
      onClose();
    } else if (message.tab_id) {
      router.push(`/grouptabs/${message.tab_id}`);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-[400px] max-w-[calc(100vw-32px)] bg-[#0f1419] rounded-xl border border-white/10 shadow-2xl z-50 animate-fadeIn overflow-hidden"
      style={{ maxHeight: 'calc(100vh - 120px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-pf-card/50">
        <h2 className="text-lg font-semibold">Activity</h2>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              disabled={markingAllRead}
              className="text-xs text-pf-accent hover:underline disabled:opacity-50"
            >
              {markingAllRead ? 'Marking...' : 'Mark all read'}
            </button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-pf-muted"
          >
            ×
          </button>
        </div>
      </div>

      {/* Messages list */}
      <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        {loading ? (
          <div className="py-8 text-center text-pf-muted">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="py-8 text-center text-pf-muted">
            <p className="text-4xl mb-2">📭</p>
            <p>No activity yet</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {messages.map(message => (
              <button
                key={message.id}
                onClick={() => handleMessageClick(message)}
                className={`w-full text-left px-4 py-3 transition-colors hover:bg-white/5 ${
                  !message.read_at ? 'bg-pf-accent/5' : ''
                }`}
              >
                <div className="flex gap-3">
                  {/* Icon */}
                  <span className="text-xl flex-shrink-0 mt-0.5">
                    {getEventIcon(message.event_type)}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Subject */}
                    {message.subject && (
                      <div className={`text-sm font-medium mb-0.5 ${!message.read_at ? 'text-pf-text' : 'text-pf-muted'}`}>
                        {message.subject}
                      </div>
                    )}

                    {/* Body */}
                    <div className={`text-sm ${!message.read_at ? 'text-pf-text' : 'text-pf-muted'}`}>
                      {getEventDescription(message)}
                    </div>

                    {/* Timestamp */}
                    <div
                      className="text-xs text-pf-muted/70 mt-1"
                      title={formatTimestamp(message.created_at)}
                    >
                      {timeAgo(message.created_at)}
                    </div>
                  </div>

                  {/* Unread indicator */}
                  {!message.read_at && (
                    <span className="w-2 h-2 rounded-full bg-pf-accent flex-shrink-0 mt-2" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-white/10 text-xs text-pf-muted text-center">
        Times shown in your local timezone
      </div>
    </div>
  );
}
