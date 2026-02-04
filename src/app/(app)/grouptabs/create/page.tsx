'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency2 } from '@/lib/formatters';

// Types
interface WizardState {
  step: string;
  data: WizardData;
}

interface WizardData {
  template: string;
  type: string;
  name: string;
  restaurantName: string;
  totalCents: number;
  tipCents: number;
  people: number;
  splitMode: string;
  receiptFile: File | null;
  // Gift specific
  giftMode: string | null;
  recipientName: string | null;
  groupGiftMode: string | null;
  aboutText: string | null;
  aboutImage: File | null;
  aboutLink: string | null;
  giftPlan: string | null;
  amountTarget: number;
  contributorCount: number | null;
  isOpenPot: boolean;
  // Payment methods
  paymentMethods: PaymentMethod[];
}

interface PaymentMethod {
  type: string;
  details: Record<string, string>;
}

interface Message {
  id: string;
  type: 'bot' | 'user' | 'typing';
  content: string;
  historyIndex: number;
}

interface CreatedTab {
  id: number;
  invite_code: string | null;
  name: string;
}

interface HistoryEntry {
  state: WizardState;
  index: number;
}

// Intent options
const INTENT_OPTIONS = [
  { id: 'restaurant', icon: '🍽️', title: 'Restaurant Bill', desc: 'Split a dinner bill easily' },
  { id: 'trip', icon: '✈️', title: 'Trip / Holiday', desc: 'Track shared travel expenses' },
  { id: 'gift', icon: '🎁', title: 'Group Gift', desc: 'Collect money for a present' },
];

// Split options
const SPLIT_OPTIONS = [
  { id: 'equal', icon: '⚖️', title: 'Equal Split', desc: 'Everyone pays the same' },
  { id: 'price_groups', icon: '🍷💧', iconAlt: true, title: 'Price Groups', desc: 'Different prices for different people' },
  { id: 'open', icon: '🧾', title: 'Go Dutch', desc: 'Each person enters their own amount' },
];

// Gift type options
const GIFT_TYPE_OPTIONS = [
  { id: 'gift_type_gift', icon: '🎁', title: 'Buying a gift', desc: 'Split the cost of a present' },
  { id: 'gift_type_fundraiser', icon: '💰', title: 'Raising money', desc: 'Collect contributions for something' },
];

// Gift plan options
const GIFT_PLAN_OPTIONS = [
  { id: 'already_bought', icon: '✅', title: 'Already bought', desc: 'Paid upfront, need to collect' },
  { id: 'planning_to_buy', icon: '🎯', title: 'Planning to buy', desc: 'Collecting first, then purchasing' },
];

// Default state
const getDefaultState = (): WizardState => ({
  step: 'INTENT',
  data: {
    template: '',
    type: '',
    name: '',
    restaurantName: '',
    totalCents: 0,
    tipCents: 0,
    people: 4,
    splitMode: 'equal',
    receiptFile: null,
    giftMode: null,
    recipientName: null,
    groupGiftMode: null,
    aboutText: null,
    aboutImage: null,
    aboutLink: null,
    giftPlan: null,
    amountTarget: 0,
    contributorCount: null,
    isOpenPot: false,
    paymentMethods: [],
  },
});

export default function CreateGroupTabWizard() {
  const router = useRouter();
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<WizardState>(getDefaultState());
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [historyStack, setHistoryStack] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createdTab, setCreatedTab] = useState<CreatedTab | null>(null);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeCard, scrollToBottom]);

  // Initialize wizard
  useEffect(() => {
    const timer = setTimeout(() => {
      addBotMessage('What is this GroupTab for?');
      setActiveCard('intent');
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Add bot message
  const addBotMessage = (content: string) => {
    const id = `msg-${Date.now()}`;
    setMessages(prev => [...prev, { id, type: 'bot', content, historyIndex }]);
  };

  // Add user message
  const addUserMessage = (content: string) => {
    const id = `msg-${Date.now()}`;
    setMessages(prev => [...prev, { id, type: 'user', content, historyIndex }]);
  };

  // Push history for undo
  const pushHistory = () => {
    setHistoryStack(prev => [...prev, { state: JSON.parse(JSON.stringify(state)), index: historyIndex }]);
    setHistoryIndex(prev => prev + 1);
  };

  // Undo step
  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const lastEntry = historyStack[historyStack.length - 1];
    setHistoryStack(prev => prev.slice(0, -1));
    setState(lastEntry.state);
    setHistoryIndex(lastEntry.index);
    // Remove messages after this index
    setMessages(prev => prev.filter(m => m.historyIndex < lastEntry.index || (m.historyIndex === lastEntry.index && m.type === 'bot')));
    setActiveCard(getCardForStep(lastEntry.state.step));
  };

  const getCardForStep = (step: string): string | null => {
    switch (step) {
      case 'INTENT': return 'intent';
      case 'NAME': return null;
      case 'AMOUNT': return 'amount';
      case 'PEOPLE': return 'people';
      case 'SPLIT': return 'split';
      case 'GIFT_RECIPIENT': return null;
      case 'GIFT_TYPE_CHOICE': return 'gift_type';
      case 'GIFT_ABOUT': return 'gift_about';
      case 'GIFT_PLAN': return 'gift_plan';
      case 'GIFT_AMOUNT': return 'gift_amount';
      case 'GIFT_CONTRIBUTORS': return 'gift_contributors';
      case 'PAYMENT_DETAILS': return 'payment';
      case 'CREATING': return 'creating';
      default: return null;
    }
  };

  // Handle intent selection
  const handleIntent = (id: string, label: string) => {
    pushHistory();
    addUserMessage(label);
    setActiveCard(null);

    if (id === 'restaurant') {
      setState(prev => ({ ...prev, step: 'NAME', data: { ...prev.data, template: 'restaurant', type: 'one_bill' } }));
      setTimeout(() => {
        addBotMessage('How shall we name this GroupTab?');
        inputRef.current?.focus();
      }, 400);
    } else if (id === 'trip') {
      addBotMessage('✈️ Trip splitting is coming soon! We\'re working hard to bring you the best experience for tracking shared travel expenses.');
      setTimeout(() => {
        addBotMessage('In the meantime, what would you like to do?');
        setActiveCard('intent');
      }, 1000);
    } else if (id === 'gift') {
      setState(prev => ({ ...prev, step: 'GIFT_RECIPIENT', data: { ...prev.data, template: 'gift', type: 'one_bill' } }));
      setTimeout(() => {
        addBotMessage('Who is this gift for?');
        inputRef.current?.focus();
      }, 400);
    }
  };

  // Handle text input
  const handleTextSubmit = () => {
    if (!inputValue.trim()) return;
    const text = inputValue.trim();
    setInputValue('');

    if (state.step === 'NAME') {
      handleName(text);
    } else if (state.step === 'GIFT_RECIPIENT') {
      handleGiftRecipient(text);
    }
  };

  // Handle name input
  const handleName = (text: string) => {
    pushHistory();
    addUserMessage(text);

    const name = state.data.template === 'restaurant'
      ? text.charAt(0).toUpperCase() + text.slice(1)
      : `Gift for ${text}`;

    setState(prev => ({ ...prev, step: 'AMOUNT', data: { ...prev.data, name, restaurantName: text } }));

    setTimeout(() => {
      addBotMessage(`"${name}" — got it!`);
      setTimeout(() => {
        addBotMessage('How much was the bill?');
        setActiveCard('amount');
      }, 400);
    }, 300);
  };

  // Handle gift recipient
  const handleGiftRecipient = (text: string) => {
    pushHistory();
    
    if (text.toLowerCase() === 'skip') {
      setState(prev => ({ ...prev, data: { ...prev.data, recipientName: null } }));
      addUserMessage('Skip');
      addBotMessage("No problem! Let's continue.");
    } else {
      setState(prev => ({ ...prev, data: { ...prev.data, recipientName: text, name: `Gift for ${text}` } }));
      addUserMessage(text);
      addBotMessage(`Lucky ${text}! 🎁`);
    }

    setTimeout(() => {
      setState(prev => ({ ...prev, step: 'GIFT_TYPE_CHOICE' }));
      addBotMessage('So what is the plan?');
      setActiveCard('gift_type');
    }, 500);
  };

  // Handle gift type selection
  const handleGiftType = (id: string, label: string) => {
    pushHistory();
    addUserMessage(label);
    setActiveCard(null);

    const isGift = id === 'gift_type_gift';
    setState(prev => ({
      ...prev,
      step: 'GIFT_ABOUT',
      data: { ...prev.data, groupGiftMode: isGift ? 'gift' : 'fundraiser' }
    }));

    setTimeout(() => {
      addBotMessage(isGift ? 'Add some details about the gift.' : 'What are you raising money for?');
      setActiveCard('gift_about');
    }, 400);
  };

  // Handle gift about confirmation
  const handleGiftAboutConfirm = (aboutText: string, aboutImage: File | null, aboutLink: string) => {
    pushHistory();
    addUserMessage(aboutText || '(Skipped)');
    setActiveCard(null);

    setState(prev => ({
      ...prev,
      data: { ...prev.data, aboutText, aboutImage, aboutLink: aboutLink || null }
    }));

    const isFundraiser = state.data.groupGiftMode === 'fundraiser';

    if (isFundraiser) {
      // Store aboutText as name if not set
      if (!state.data.name && aboutText) {
        setState(prev => ({ ...prev, data: { ...prev.data, name: aboutText } }));
      }
      setTimeout(() => {
        setState(prev => ({ ...prev, step: 'GIFT_AMOUNT' }));
        addBotMessage('Do you have a target amount in mind?');
        setActiveCard('gift_target');
      }, 400);
    } else {
      setTimeout(() => {
        setState(prev => ({ ...prev, step: 'GIFT_PLAN' }));
        addBotMessage('Has the gift already been bought?');
        setActiveCard('gift_plan');
      }, 400);
    }
  };

  // Handle gift plan selection
  const handleGiftPlan = (id: string, label: string) => {
    pushHistory();
    addUserMessage(label);
    setActiveCard(null);

    const isAlreadyBought = id === 'already_bought';
    setState(prev => ({
      ...prev,
      step: 'GIFT_AMOUNT',
      data: {
        ...prev.data,
        giftPlan: id,
        giftMode: isAlreadyBought ? 'gift_debt' : 'gift_pot_target'
      }
    }));

    setTimeout(() => {
      addBotMessage(isAlreadyBought ? 'What was the price?' : 'How much are we aiming to collect?');
      setActiveCard('gift_amount');
    }, 400);
  };

  // Handle amount confirmation
  const handleAmountConfirm = (totalCents: number, tipCents: number) => {
    pushHistory();
    addUserMessage(formatCurrency2(totalCents + tipCents));
    setActiveCard(null);

    setState(prev => ({
      ...prev,
      step: 'PEOPLE',
      data: { ...prev.data, totalCents, tipCents }
    }));

    setTimeout(() => {
      addBotMessage('How many people?');
      setActiveCard('people');
    }, 400);
  };

  // Handle gift amount confirmation
  const handleGiftAmountConfirm = (amountCents: number) => {
    pushHistory();
    addUserMessage(formatCurrency2(amountCents));
    setActiveCard(null);

    const isDebt = state.data.giftMode === 'gift_debt';

    setState(prev => ({
      ...prev,
      step: 'GIFT_CONTRIBUTORS',
      data: {
        ...prev.data,
        totalCents: isDebt ? amountCents : 0,
        amountTarget: isDebt ? 0 : amountCents
      }
    }));

    setTimeout(() => {
      addBotMessage('How many people are contributing?');
      setActiveCard('gift_contributors');
    }, 400);
  };

  // Handle fundraiser target confirmation
  const handleFundraiserTargetConfirm = (amountCents: number, isOpenPot: boolean) => {
    pushHistory();
    addUserMessage(isOpenPot ? 'Open pot (no target)' : formatCurrency2(amountCents));
    setActiveCard(null);

    setState(prev => ({
      ...prev,
      step: 'PAYMENT_DETAILS',
      data: {
        ...prev.data,
        giftMode: isOpenPot ? 'gift_pot_open' : 'gift_pot_target',
        amountTarget: isOpenPot ? 0 : amountCents,
        isOpenPot,
        name: prev.data.name || prev.data.aboutText || 'Group Fundraiser'
      }
    }));

    setTimeout(() => {
      goToPaymentDetails();
    }, 400);
  };

  // Handle people confirmation
  const handlePeopleConfirm = (count: number) => {
    pushHistory();
    addUserMessage(`${count} people`);
    setActiveCard(null);

    setState(prev => ({
      ...prev,
      step: 'SPLIT',
      data: { ...prev.data, people: count }
    }));

    const totalCents = state.data.totalCents + state.data.tipCents;

    setTimeout(() => {
      addBotMessage(`How should we split the ${formatCurrency2(totalCents)}?`);
      setActiveCard('split');
    }, 400);
  };

  // Handle gift contributors confirmation
  const handleGiftContributorsConfirm = (count: number) => {
    pushHistory();
    addUserMessage(`${count} people`);
    setActiveCard(null);

    setState(prev => ({
      ...prev,
      step: 'PAYMENT_DETAILS',
      data: { ...prev.data, contributorCount: count, people: count }
    }));

    let summary = '';
    if (state.data.giftMode === 'gift_debt') {
      const shareAmount = Math.floor(state.data.totalCents / count);
      summary = `Ok, that means each person should pay up ${formatCurrency2(shareAmount)}`;
    } else {
      const suggestedAmount = Math.floor(state.data.amountTarget / count);
      summary = `Suggested contribution: ${formatCurrency2(suggestedAmount)} per person`;
    }

    setTimeout(() => {
      addBotMessage(summary);
      setTimeout(() => {
        goToPaymentDetails();
      }, 500);
    }, 400);
  };

  // Handle split selection
  const handleSplit = (id: string, label: string) => {
    pushHistory();
    addUserMessage(label);
    setActiveCard(null);

    setState(prev => ({ ...prev, data: { ...prev.data, splitMode: id } }));

    if (id === 'price_groups') {
      addBotMessage('Price groups feature is coming soon!');
      setTimeout(() => {
        goToPaymentDetails();
      }, 800);
    } else if (id === 'open') {
      addBotMessage('Go Dutch feature is coming soon!');
      setTimeout(() => {
        goToPaymentDetails();
      }, 800);
    } else {
      setTimeout(() => {
        goToPaymentDetails();
      }, 400);
    }
  };

  // Go to payment details
  const goToPaymentDetails = () => {
    setState(prev => ({ ...prev, step: 'PAYMENT_DETAILS' }));
    addBotMessage('How can people pay you?');
    setActiveCard('payment');
  };

  // Handle payment methods confirmation
  const handlePaymentConfirm = (methods: PaymentMethod[]) => {
    pushHistory();
    addUserMessage(methods.length > 0 ? `${methods.length} payment method(s)` : 'Skipped');
    setActiveCard(null);

    setState(prev => ({
      ...prev,
      step: 'CREATING',
      data: { ...prev.data, paymentMethods: methods }
    }));

    setTimeout(() => {
      createGroupTab();
    }, 400);
  };

  // Create the GroupTab
  const createGroupTab = async () => {
    setIsCreating(true);
    addBotMessage('Creating your GroupTab...');
    setActiveCard('creating');

    try {
      const { data } = state;
      
      const payload = {
        name: data.name || 'Untitled Tab',
        tabType: data.type || 'one_bill',
        template: data.template || null,
        totalAmountCents: data.totalCents + data.tipCents,
        peopleCount: data.people,
        splitMode: data.splitMode,
        proofRequired: 'optional',
        giftMode: data.giftMode,
        recipientName: data.recipientName,
        aboutText: data.aboutText,
        aboutLink: data.aboutLink,
        amountTarget: data.amountTarget || null,
        contributorCount: data.contributorCount,
        isOpenPot: data.isOpenPot,
        paymentMethods: data.paymentMethods,
      };

      const response = await fetch('/api/grouptabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to create GroupTab');
      }

      const result = await response.json();
      
      // Store created tab and show share card
      setCreatedTab(result.tab);
      addBotMessage('GroupTab created! 🎉 Share it with your friends!');
      setActiveCard('share');
      setIsCreating(false);
    } catch (error) {
      console.error('Error creating GroupTab:', error);
      addBotMessage('Oops! Something went wrong. Please try again.');
      setIsCreating(false);
      setActiveCard('payment');
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto min-h-screen flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 px-5 py-4 bg-pf-bg/85 backdrop-blur-[16px] border-b border-white/5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pf-accent to-blue-600 flex items-center justify-center shadow-[0_4px_12px_rgba(61,220,151,0.3)] -rotate-[5deg]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="white"/>
            </svg>
          </div>
          <div>
            <div className="text-2xl font-extrabold tracking-tight bg-gradient-to-br from-white to-[#a7b0bd] bg-clip-text text-transparent">
              GroupTab Wizard
            </div>
            <div className="text-sm font-medium text-pf-accent opacity-90 mt-1">
              Let&apos;s get this sorted! 🚀
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={historyStack.length === 0}
            className="w-11 h-11 rounded-xl bg-white/[0.06] flex items-center justify-center text-pf-text disabled:opacity-25 disabled:cursor-default hover:enabled:bg-white/[0.12] hover:enabled:animate-[spinLeft_0.8s_linear_infinite] transition-all"
            title="Go back one step"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 14L4 9l5-5"/>
              <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/>
            </svg>
          </button>
          <Link href="/grouptabs" className="w-11 h-11 rounded-xl bg-white/[0.06] flex items-center justify-center text-pf-text hover:bg-[rgba(239,68,68,0.15)] hover:text-[#f87171] transition-all">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </Link>
        </div>
      </div>

      {/* Chat Area */}
      <div ref={chatRef} className="flex-1 p-5 flex flex-col gap-4 overflow-y-auto">
        {/* Messages */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[80%] px-4 py-3 rounded-[18px] text-[15px] leading-relaxed animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)] ${
              msg.type === 'bot'
                ? 'bg-[#1c212b] text-pf-text rounded-bl-[4px] self-start'
                : 'bg-pf-accent text-pf-bg rounded-br-[4px] self-end font-medium'
            }`}
          >
            {msg.content}
          </div>
        ))}

        {/* Active Cards */}
        {activeCard === 'intent' && (
          <SelectionBlocks options={INTENT_OPTIONS} onSelect={handleIntent} />
        )}

        {activeCard === 'gift_type' && (
          <SelectionBlocks options={GIFT_TYPE_OPTIONS} onSelect={handleGiftType} />
        )}

        {activeCard === 'gift_plan' && (
          <SelectionBlocks options={GIFT_PLAN_OPTIONS} onSelect={handleGiftPlan} />
        )}

        {activeCard === 'split' && (
          <SelectionBlocks options={SPLIT_OPTIONS} onSelect={handleSplit} />
        )}

        {activeCard === 'amount' && (
          <AmountCard onConfirm={handleAmountConfirm} />
        )}

        {activeCard === 'gift_amount' && (
          <GiftAmountCard onConfirm={handleGiftAmountConfirm} giftMode={state.data.giftMode} />
        )}

        {activeCard === 'gift_target' && (
          <FundraiserTargetCard onConfirm={handleFundraiserTargetConfirm} />
        )}

        {activeCard === 'people' && (
          <PeopleCard totalCents={state.data.totalCents + state.data.tipCents} onConfirm={handlePeopleConfirm} />
        )}

        {activeCard === 'gift_contributors' && (
          <GiftContributorsCard onConfirm={handleGiftContributorsConfirm} />
        )}

        {activeCard === 'gift_about' && (
          <GiftAboutCard mode={state.data.groupGiftMode || 'gift'} onConfirm={handleGiftAboutConfirm} />
        )}

        {activeCard === 'payment' && (
          <PaymentMethodsCard onConfirm={handlePaymentConfirm} />
        )}

        {activeCard === 'creating' && (
          <div className="self-center">
            <div className="w-8 h-8 border-[3px] border-white/10 border-t-pf-accent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {activeCard === 'success' && (
          <div className="self-center text-center">
            <div className="text-5xl mb-2">🎉</div>
            <div className="text-pf-accent font-semibold">Redirecting...</div>
          </div>
        )}

        {activeCard === 'share' && createdTab && (
          <ShareCard 
            tab={createdTab} 
            totalCents={state.data.totalCents + state.data.tipCents}
            amountTarget={state.data.amountTarget}
            giftMode={state.data.giftMode}
            peopleCount={state.data.people}
          />
        )}
      </div>

      {/* Input Area */}
      {(state.step === 'NAME' || state.step === 'GIFT_RECIPIENT') && !activeCard && (
        <div className="sticky bottom-0 bg-pf-bg border-t border-white/[0.08] p-4 z-[100]">
          {state.step === 'GIFT_RECIPIENT' && (
            <div className="flex gap-2 pb-3 overflow-x-auto">
              <button
                onClick={() => handleGiftRecipient('Skip')}
                className="px-4 py-2.5 bg-transparent border border-white/20 rounded-[20px] text-[15px] text-white/60 whitespace-nowrap hover:bg-white/5 hover:border-white/30 hover:text-white/80 hover:-translate-y-0.5 transition-all"
              >
                → Skip
              </button>
            </div>
          )}
          <div className="flex gap-3 items-center bg-[#1c212b] px-4 py-2 rounded-3xl border border-white/[0.08] focus-within:border-pf-accent transition-colors">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
              placeholder={state.step === 'GIFT_RECIPIENT' ? 'Enter name...' : 'Type a message...'}
              className="flex-1 bg-transparent border-none text-pf-text text-base outline-none min-h-[24px]"
              autoFocus
            />
            <button
              onClick={handleTextSubmit}
              disabled={!inputValue.trim()}
              className="w-10 h-10 rounded-full bg-pf-accent flex items-center justify-center text-pf-bg disabled:bg-pf-muted disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform"
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Selection Blocks Component
interface SelectionBlocksProps {
  options: { id: string; icon: string; iconAlt?: boolean; title: string; desc: string }[];
  onSelect: (id: string, label: string) => void;
}

function SelectionBlocks({ options, onSelect }: SelectionBlocksProps) {
  return (
    <div className="flex gap-8 overflow-x-auto py-6 px-5 mt-2 self-center w-fit animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)]">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onSelect(opt.id, opt.title)}
          className="min-w-[210px] max-w-[240px] bg-[#161b24] border-2 border-[#2a303c] rounded-3xl px-4 py-5 cursor-pointer transition-all duration-300 flex flex-col gap-1.5 flex-shrink-0 overflow-visible relative hover:bg-[#1a2030] hover:border-pf-accent hover:-rotate-1 hover:scale-[1.03] hover:shadow-[0_12px_32px_rgba(0,0,0,0.4)] hover:z-10 active:scale-[0.98]"
        >
          <div className={`text-5xl mb-2 drop-shadow-[0_3px_0_rgba(0,0,0,0.15)] ${opt.iconAlt ? 'flex items-center gap-2' : ''}`}>
            {opt.iconAlt ? (
              <>
                <span>🍷</span>
                <span className="text-xs text-pf-muted font-semibold uppercase mt-1">vs</span>
                <span>💧</span>
              </>
            ) : (
              opt.icon
            )}
          </div>
          <div className="text-[15px] font-semibold text-pf-text">{opt.title}</div>
          <div className="text-xs text-pf-muted leading-relaxed">{opt.desc}</div>
        </button>
      ))}
    </div>
  );
}

// Amount Card Component
interface AmountCardProps {
  onConfirm: (totalCents: number, tipCents: number) => void;
}

function AmountCard({ onConfirm }: AmountCardProps) {
  const [amount, setAmount] = useState('');
  const [tip, setTip] = useState('');
  const [showTip, setShowTip] = useState(false);

  const parseAmount = (val: string) => {
    const cleaned = val.replace(',', '.').replace(/[^\d.]/g, '');
    return parseFloat(cleaned) || 0;
  };

  const totalCents = Math.round(parseAmount(amount) * 100);
  const tipCents = Math.round(parseAmount(tip) * 100);

  return (
    <div className="self-center max-w-[380px] w-full animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)]">
      <div className="bg-[#161b24] border-2 border-[#2a303c] rounded-3xl px-4 py-5 shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
        {/* Amount input */}
        <div className="flex items-center gap-1.5 mb-2 bg-[#0e1116] rounded-2xl px-4 py-3.5 border-2 border-[#2a303c] focus-within:border-pf-accent transition-colors shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]">
          <span className="text-[28px] text-pf-muted opacity-70">€</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-transparent border-none text-pf-text text-[32px] font-semibold outline-none w-full"
            autoFocus
          />
        </div>

        {/* Tip preview */}
        {showTip && tipCents > 0 && (
          <div className="text-center text-sm text-pf-muted mb-3">
            Total with tip: <span className="text-pf-accent font-semibold">{formatCurrency2(totalCents + tipCents)}</span>
          </div>
        )}

        {/* Tip toggle */}
        <button
          onClick={() => setShowTip(!showTip)}
          className={`w-full p-3 border rounded-xl text-sm font-medium cursor-pointer transition-all mb-2.5 ${
            showTip
              ? 'bg-pf-accent/5 border-pf-accent border-solid text-pf-accent'
              : 'bg-[#0e1116] border-[#2a303c] border-dashed text-pf-muted hover:bg-[#1c212b] hover:border-pf-accent hover:text-pf-accent'
          }`}
        >
          {showTip ? '− Remove Tip' : 'Separate tip? Add it here.'}
        </button>

        {/* Tip input */}
        {showTip && (
          <div className="flex items-center gap-2.5 mb-2.5 p-2.5 bg-[#0e1116] rounded-xl border border-[#2a303c]">
            <span className="text-sm text-pf-muted whitespace-nowrap">Tip €</span>
            <input
              type="text"
              inputMode="decimal"
              value={tip}
              onChange={(e) => setTip(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-[#1c212b] border border-[#2a303c] rounded-lg text-pf-accent text-lg font-semibold p-1.5 outline-none max-w-[100px] focus:border-pf-accent"
            />
          </div>
        )}

        {/* Confirm button */}
        <button
          onClick={() => onConfirm(totalCents, tipCents)}
          disabled={totalCents <= 0}
          className="w-full py-3.5 px-5 bg-pf-accent border-none rounded-xl text-pf-bg text-[15px] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:enabled:-translate-y-0.5 hover:enabled:shadow-[0_4px_16px_rgba(61,220,151,0.3)] active:enabled:scale-[0.98] transition-all"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

// Gift Amount Card
interface GiftAmountCardProps {
  giftMode: string | null;
  onConfirm: (amountCents: number) => void;
}

function GiftAmountCard({ giftMode, onConfirm }: GiftAmountCardProps) {
  const [amount, setAmount] = useState('');
  const amountCents = Math.round(parseFloat(amount.replace(',', '.').replace(/[^\d.]/g, '')) * 100) || 0;
  const isPrice = giftMode === 'gift_debt';

  return (
    <div className="self-center max-w-[380px] w-full animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)]">
      <div className="bg-[#161b24] border-2 border-[#2a303c] rounded-3xl px-4 py-5 shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
        <div className="text-xs uppercase tracking-wider text-pf-muted mb-3 font-bold">
          {isPrice ? 'Gift Price' : 'Target Amount'}
        </div>
        <div className="flex items-center gap-1.5 mb-4 bg-[#0e1116] rounded-2xl px-4 py-3.5 border-2 border-[#2a303c] focus-within:border-pf-accent transition-colors">
          <span className="text-[28px] text-pf-muted opacity-70">€</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-transparent border-none text-pf-text text-[32px] font-semibold outline-none w-full"
            autoFocus
          />
        </div>
        <button
          onClick={() => onConfirm(amountCents)}
          disabled={amountCents <= 0}
          className="w-full py-3.5 px-5 bg-pf-accent border-none rounded-xl text-pf-bg text-[15px] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:enabled:-translate-y-0.5 hover:enabled:shadow-[0_4px_16px_rgba(61,220,151,0.3)] transition-all"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

// Fundraiser Target Card
interface FundraiserTargetCardProps {
  onConfirm: (amountCents: number, isOpenPot: boolean) => void;
}

function FundraiserTargetCard({ onConfirm }: FundraiserTargetCardProps) {
  const [amount, setAmount] = useState('');
  const [isOpenPot, setIsOpenPot] = useState(false);
  const amountCents = Math.round(parseFloat(amount.replace(',', '.').replace(/[^\d.]/g, '')) * 100) || 0;

  return (
    <div className="self-center max-w-[380px] w-full animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)]">
      <div className="bg-[#161b24] border-2 border-[#2a303c] rounded-3xl px-4 py-5 shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-2.5 mb-5">
          <span className="text-xl">🎯</span>
          <span className="text-base font-semibold text-pf-text">Target Amount</span>
          <span className="text-sm text-pf-muted font-normal">(optional)</span>
        </div>

        {!isOpenPot && (
          <div className="flex items-center bg-white/[0.03] border-2 border-white/[0.12] rounded-xl px-5 py-4 mb-4 focus-within:border-pf-accent focus-within:bg-pf-accent/[0.03] transition-all">
            <span className="text-lg text-pf-muted mr-2">€</span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-transparent border-none text-pf-text text-xl font-semibold outline-none"
              autoFocus
            />
          </div>
        )}

        <label className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/[0.08] cursor-pointer hover:bg-white/[0.06] transition-colors mb-4">
          <input
            type="checkbox"
            checked={isOpenPot}
            onChange={(e) => setIsOpenPot(e.target.checked)}
            className="w-5 h-5 accent-pf-accent"
          />
          <div>
            <div className="text-sm font-semibold text-pf-text">Open pot (no target)</div>
            <div className="text-xs text-pf-muted">Accept any amount, no goal needed</div>
          </div>
        </label>

        <button
          onClick={() => onConfirm(amountCents, isOpenPot)}
          disabled={!isOpenPot && amountCents <= 0}
          className="w-full py-3.5 px-5 bg-pf-accent border-none rounded-xl text-pf-bg text-[15px] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:enabled:-translate-y-0.5 hover:enabled:shadow-[0_4px_16px_rgba(61,220,151,0.3)] transition-all"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// People Card Component
interface PeopleCardProps {
  totalCents: number;
  onConfirm: (count: number) => void;
}

function PeopleCard({ totalCents, onConfirm }: PeopleCardProps) {
  const [count, setCount] = useState(4);
  const perPerson = totalCents > 0 ? Math.floor(totalCents / count) : 0;

  return (
    <div className="self-center max-w-[380px] w-full animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)]">
      <div className="bg-[#161b24] border-2 border-[#2a303c] rounded-3xl px-4 py-5 shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
        {/* Counter */}
        <div className="flex items-center justify-center gap-6 py-4">
          <button
            onClick={() => setCount(Math.max(2, count - 1))}
            disabled={count <= 2}
            className="w-14 h-14 rounded-full bg-[#1c212b] border-2 border-[#2a303c] text-pf-text text-2xl flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.2)] disabled:opacity-30 disabled:cursor-not-allowed hover:enabled:bg-[#2a303c] hover:enabled:border-pf-accent hover:enabled:text-pf-accent hover:enabled:-translate-y-0.5 active:enabled:scale-95 transition-all"
          >
            −
          </button>
          <input
            type="number"
            value={count}
            onChange={(e) => setCount(Math.max(2, Math.min(99, parseInt(e.target.value) || 2)))}
            className="w-20 text-5xl font-extrabold text-pf-text text-center bg-transparent border-none outline-none focus:text-pf-accent [-moz-appearance:textfield] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={() => setCount(Math.min(99, count + 1))}
            disabled={count >= 99}
            className="w-14 h-14 rounded-full bg-[#1c212b] border-2 border-[#2a303c] text-pf-text text-2xl flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.2)] disabled:opacity-30 disabled:cursor-not-allowed hover:enabled:bg-[#2a303c] hover:enabled:border-pf-accent hover:enabled:text-pf-accent hover:enabled:-translate-y-0.5 active:enabled:scale-95 transition-all"
          >
            +
          </button>
        </div>

        {/* Per person display */}
        {totalCents > 0 && (
          <div className="bg-[#0e1116] border-2 border-[#2a303c] rounded-2xl px-5 py-3 flex flex-col items-center gap-1.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] mb-4">
            <div className="flex items-baseline justify-center gap-2 w-full">
              <span className="text-[28px] font-bold text-pf-accent">{formatCurrency2(perPerson)}</span>
              <span className="text-sm text-pf-accent opacity-80 font-medium">per person</span>
            </div>
            <div className="text-sm text-pf-muted">
              Total: <span className="text-pf-text font-medium">{formatCurrency2(totalCents)}</span>
            </div>
          </div>
        )}

        {/* Confirm */}
        <button
          onClick={() => onConfirm(count)}
          className="w-full py-3.5 px-5 bg-pf-accent border-none rounded-xl text-pf-bg text-[15px] font-semibold cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(61,220,151,0.3)] active:scale-[0.98] transition-all"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

// Gift Contributors Card
interface GiftContributorsCardProps {
  onConfirm: (count: number) => void;
}

function GiftContributorsCard({ onConfirm }: GiftContributorsCardProps) {
  const [count, setCount] = useState(4);

  return (
    <div className="self-center max-w-[380px] w-full animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)]">
      <div className="bg-[#161b24] border-2 border-[#2a303c] rounded-3xl px-4 py-5 shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
        <div className="text-xs uppercase tracking-wider text-pf-muted mb-3 font-bold">
          Number of Contributors
        </div>
        <div className="flex items-center justify-center gap-6 py-4 mb-4">
          <button
            onClick={() => setCount(Math.max(2, count - 1))}
            disabled={count <= 2}
            className="w-14 h-14 rounded-full bg-[#1c212b] border-2 border-[#2a303c] text-pf-text text-2xl flex items-center justify-center disabled:opacity-30 hover:enabled:bg-[#2a303c] hover:enabled:border-pf-accent hover:enabled:text-pf-accent transition-all"
          >
            −
          </button>
          <input
            type="number"
            value={count}
            onChange={(e) => setCount(Math.max(2, Math.min(99, parseInt(e.target.value) || 2)))}
            className="w-20 text-5xl font-extrabold text-pf-text text-center bg-transparent border-none outline-none [-moz-appearance:textfield] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={() => setCount(Math.min(99, count + 1))}
            className="w-14 h-14 rounded-full bg-[#1c212b] border-2 border-[#2a303c] text-pf-text text-2xl flex items-center justify-center hover:bg-[#2a303c] hover:border-pf-accent hover:text-pf-accent transition-all"
          >
            +
          </button>
        </div>
        <button
          onClick={() => onConfirm(count)}
          className="w-full py-3.5 px-5 bg-pf-accent border-none rounded-xl text-pf-bg text-[15px] font-semibold cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(61,220,151,0.3)] transition-all"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

// Gift About Card
interface GiftAboutCardProps {
  mode: string;
  onConfirm: (aboutText: string, aboutImage: File | null, aboutLink: string) => void;
}

function GiftAboutCard({ mode, onConfirm }: GiftAboutCardProps) {
  const [aboutText, setAboutText] = useState('');
  const [aboutLink, setAboutLink] = useState('');
  const isFundraiser = mode === 'fundraiser';

  return (
    <div className="self-center max-w-[380px] w-full animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)]">
      <div className="bg-[#161b24] border-2 border-[#2a303c] rounded-3xl px-4 py-5 shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
        <div className="mb-4">
          <label className="block text-sm text-pf-muted mb-2 font-medium">
            {isFundraiser ? 'What are you raising for?' : 'Tell us about the gift'}
          </label>
          <textarea
            value={aboutText}
            onChange={(e) => setAboutText(e.target.value)}
            placeholder={isFundraiser ? "e.g., New laptop for Sarah's birthday" : "e.g., A nice speaker for John"}
            rows={3}
            className="w-full p-3.5 bg-[#1a1f2a] border-2 border-[#2a303c] rounded-xl text-pf-text text-[15px] leading-relaxed resize-none outline-none focus:border-pf-accent focus:shadow-[0_0_0_3px_rgba(0,214,143,0.1)] transition-all placeholder:text-[#6b7280]"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm text-pf-muted mb-2 font-medium">
            Product link (optional)
          </label>
          <input
            type="url"
            value={aboutLink}
            onChange={(e) => setAboutLink(e.target.value)}
            placeholder="https://..."
            className="w-full p-3.5 bg-[#1a1f2a] border-2 border-[#2a303c] rounded-xl text-pf-text text-[15px] outline-none focus:border-pf-accent transition-colors placeholder:text-[#6b7280]"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onConfirm('', null, '')}
            className="flex-1 py-3.5 px-5 bg-transparent border border-white/20 rounded-xl text-pf-muted text-[15px] font-semibold cursor-pointer hover:bg-white/5 hover:text-pf-text transition-all"
          >
            Skip
          </button>
          <button
            onClick={() => onConfirm(aboutText, null, aboutLink)}
            className="flex-1 py-3.5 px-5 bg-pf-accent border-none rounded-xl text-pf-bg text-[15px] font-semibold cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(61,220,151,0.3)] transition-all"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

// Payment Methods Card
interface PaymentMethodsCardProps {
  onConfirm: (methods: PaymentMethod[]) => void;
}

function PaymentMethodsCard({ onConfirm }: PaymentMethodsCardProps) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<string>('');
  const [formData, setFormData] = useState<Record<string, string>>({});

  const paymentTypes = [
    { type: 'bank', icon: '🏦', label: 'Bank Transfer' },
    { type: 'paypal', icon: '💳', label: 'PayPal' },
    { type: 'tikkie', icon: '📱', label: 'Tikkie' },
    { type: 'cash', icon: '💵', label: 'Cash' },
  ];

  const handleAddMethod = () => {
    if (!formType) return;
    
    const newMethod: PaymentMethod = { type: formType, details: formData };
    setMethods(prev => [...prev, newMethod]);
    setShowForm(false);
    setFormType('');
    setFormData({});
  };

  const handleRemoveMethod = (index: number) => {
    setMethods(prev => prev.filter((_, i) => i !== index));
  };

  const getMethodSummary = (method: PaymentMethod) => {
    if (method.type === 'bank') return method.details.iban || 'Bank Transfer';
    if (method.type === 'paypal') return method.details.email || 'PayPal';
    if (method.type === 'tikkie') return method.details.link || 'Tikkie';
    if (method.type === 'cash') return 'Cash payment';
    return method.type;
  };

  return (
    <div className="self-center max-w-[480px] w-full animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)]">
      <div className="bg-[#1c212b] rounded-2xl p-5 border border-white/[0.08]">
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="text-sm font-semibold text-pf-text flex items-center gap-2">
              <span className="text-lg">💳</span> Payment Methods
            </div>
            <div className="text-xs text-pf-muted mt-0.5">How can people pay you?</div>
          </div>
        </div>

        {/* List of added methods */}
        {methods.length > 0 && (
          <div className="flex flex-col gap-2.5 mb-4">
            {methods.map((method, index) => {
              const typeInfo = paymentTypes.find(t => t.type === method.type);
              return (
                <div key={index} className="flex items-center gap-3 p-3.5 bg-black/20 border border-white/[0.08] rounded-xl">
                  <div className="w-10 h-10 rounded-[10px] bg-pf-accent/10 flex items-center justify-center text-lg flex-shrink-0">
                    {typeInfo?.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-pf-text">{typeInfo?.label}</div>
                    <div className="text-xs text-pf-muted truncate">{getMethodSummary(method)}</div>
                  </div>
                  <button
                    onClick={() => handleRemoveMethod(index)}
                    className="w-7 h-7 rounded-full bg-[rgba(248,113,113,0.15)] text-[#f87171] flex items-center justify-center text-lg hover:bg-[rgba(248,113,113,0.3)] transition-colors"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add form */}
        {showForm ? (
          <div className="bg-black/15 border border-white/[0.08] rounded-xl p-4 mb-4">
            <div className="text-sm font-semibold text-pf-text mb-3.5">Add Payment Method</div>
            
            {/* Type selector */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {paymentTypes.map(pt => (
                <button
                  key={pt.type}
                  onClick={() => { setFormType(pt.type); setFormData({}); }}
                  className={`flex items-center gap-2.5 p-3 bg-black/20 border rounded-xl text-pf-text text-sm font-medium cursor-pointer transition-all ${
                    formType === pt.type
                      ? 'bg-pf-accent/10 border-pf-accent text-pf-accent'
                      : 'border-white/[0.08] hover:bg-black/30 hover:border-pf-accent'
                  }`}
                >
                  <span className="text-xl">{pt.icon}</span>
                  {pt.label}
                </button>
              ))}
            </div>

            {/* Form fields based on type */}
            {formType === 'bank' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1.5">Account Holder</label>
                  <input
                    type="text"
                    value={formData.accountHolder || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, accountHolder: e.target.value }))}
                    placeholder="John Doe"
                    className="w-full p-3 bg-black/30 border border-white/10 rounded-[10px] text-pf-text text-sm outline-none focus:border-pf-accent focus:shadow-[0_0_0_2px_rgba(61,220,151,0.15)] transition-all placeholder:text-white/30"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1.5">IBAN</label>
                  <input
                    type="text"
                    value={formData.iban || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, iban: e.target.value }))}
                    placeholder="NL00 BANK 0000 0000 00"
                    className="w-full p-3 bg-black/30 border border-white/10 rounded-[10px] text-pf-text text-sm outline-none focus:border-pf-accent transition-all placeholder:text-white/30"
                  />
                </div>
              </div>
            )}

            {formType === 'paypal' && (
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1.5">PayPal Email</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="you@email.com"
                  className="w-full p-3 bg-black/30 border border-white/10 rounded-[10px] text-pf-text text-sm outline-none focus:border-pf-accent transition-all placeholder:text-white/30"
                />
              </div>
            )}

            {formType === 'tikkie' && (
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1.5">Tikkie Link</label>
                <input
                  type="url"
                  value={formData.link || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, link: e.target.value }))}
                  placeholder="https://tikkie.me/..."
                  className="w-full p-3 bg-black/30 border border-white/10 rounded-[10px] text-pf-text text-sm outline-none focus:border-pf-accent transition-all placeholder:text-white/30"
                />
              </div>
            )}

            {formType === 'cash' && (
              <div className="text-sm text-pf-muted text-center py-4">
                Cash payment - no additional details needed
              </div>
            )}

            {/* Form actions */}
            <div className="flex gap-2.5 mt-4">
              <button
                onClick={() => { setShowForm(false); setFormType(''); setFormData({}); }}
                className="flex-1 p-3 bg-transparent border border-white/15 rounded-[10px] text-pf-muted text-sm font-semibold hover:bg-white/5 hover:text-pf-text transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMethod}
                disabled={!formType}
                className="flex-1 p-3 bg-pf-accent border-none rounded-[10px] text-pf-bg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:enabled:brightness-110 transition-all"
              >
                Add
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full p-3.5 bg-pf-accent/[0.08] border-2 border-dashed border-pf-accent/30 rounded-xl text-pf-accent text-sm font-semibold flex items-center justify-center gap-2 hover:bg-pf-accent/15 hover:border-pf-accent transition-all"
          >
            <span className="text-lg font-bold">+</span> Add Payment Method
          </button>
        )}

        {/* Actions */}
        <div className="flex gap-2.5 mt-5">
          <button
            onClick={() => onConfirm([])}
            className="flex-[0.4] p-3.5 bg-transparent border border-white/15 rounded-xl text-pf-muted text-sm font-semibold hover:bg-white/5 hover:text-pf-text transition-all"
          >
            Skip
          </button>
          <button
            onClick={() => onConfirm(methods)}
            className="flex-[0.6] p-3.5 bg-pf-accent border-none rounded-xl text-pf-bg text-sm font-bold hover:brightness-110 transition-all"
          >
            {methods.length > 0 ? 'Continue' : 'Create Tab'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Share Card - shown after GroupTab creation
interface ShareCardProps {
  tab: CreatedTab;
  totalCents: number;
  amountTarget: number;
  giftMode: string | null;
  peopleCount: number;
}

function ShareCard({ tab, totalCents, amountTarget, giftMode, peopleCount }: ShareCardProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  
  const isPotMode = giftMode === 'gift_pot_open' || giftMode === 'gift_pot_target';
  const displayAmount = isPotMode ? amountTarget : totalCents;
  const shareUrl = tab.invite_code 
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/tab/${tab.invite_code}`
    : '';
  
  const qrCodeUrl = shareUrl 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=140x140&bgcolor=0e1116&color=00D68F&data=${encodeURIComponent(shareUrl)}`
    : '';

  const copyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      prompt('Copy this link:', shareUrl);
    }
  };

  const handleShare = async () => {
    if ('share' in navigator && shareUrl) {
      try {
        await navigator.share({
          title: tab.name,
          text: `Join my GroupTab: ${tab.name}`,
          url: shareUrl,
        });
      } catch {
        // User cancelled or share failed - fall back to copy
        copyShareLink();
      }
    } else {
      copyShareLink();
    }
  };

  return (
    <div className="self-center max-w-[420px] w-full animate-[slideUp_0.4s_cubic-bezier(0.16,1,0.3,1)]">
      <div className="bg-[#1c212b] rounded-2xl p-6 border border-white/[0.08] text-center">
        {/* Success icon */}
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-pf-accent/20 flex items-center justify-center">
          <span className="text-3xl">🚀</span>
        </div>
        
        {/* Tab name */}
        <h2 className="text-xl font-bold text-white mb-1">{tab.name}</h2>
        
        {/* Amount */}
        {displayAmount > 0 && (
          <div className="text-2xl font-bold text-pf-accent mb-1">
            {formatCurrency2(displayAmount)}
          </div>
        )}
        
        {/* People count */}
        {peopleCount > 0 && !isPotMode && (
          <div className="text-sm text-pf-muted mb-6">
            {peopleCount} people · {formatCurrency2(Math.round(displayAmount / peopleCount))} each
          </div>
        )}
        {isPotMode && (
          <div className="text-sm text-pf-muted mb-6">Target amount</div>
        )}
        
        {/* QR Code */}
        {qrCodeUrl && (
          <div className="bg-[#0e1116] rounded-xl p-4 mb-6 inline-block">
            <img 
              src={qrCodeUrl} 
              alt="QR Code" 
              className="w-[140px] h-[140px] mx-auto"
            />
          </div>
        )}
        
        {/* Share URL preview */}
        {shareUrl && (
          <div className="bg-black/30 rounded-lg px-4 py-2.5 mb-6 text-sm text-pf-muted truncate">
            {shareUrl}
          </div>
        )}
        
        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleShare}
            className="w-full py-4 bg-pf-accent text-pf-bg rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:brightness-110 transition-all"
          >
            {copied ? '✓ Copied!' : '📋 Copy Share Link'}
          </button>
          
          <button
            onClick={() => router.push(`/grouptabs/${tab.id}`)}
            className="w-full py-4 bg-white/10 text-white rounded-xl font-semibold text-base flex items-center justify-center gap-2 hover:bg-white/15 transition-all"
          >
            👀 View GroupTab
          </button>
        </div>
        
        <p className="text-xs text-pf-muted mt-4">
          Share this link with friends to let them join and pay their share
        </p>
      </div>
    </div>
  );
}
