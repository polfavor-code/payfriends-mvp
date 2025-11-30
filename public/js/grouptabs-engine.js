/**
 * GroupTabs Engine
 * Fairness calculations, split logic, and settlement suggestions
 */

(function() {
  'use strict';

  /**
   * Calculate fair shares for all participants based on tab type and settings
   * @param {Object} tab - Tab data with type, splitMode, totalAmountCents, etc.
   * @param {Array} participants - Array of participant objects
   * @param {Array} tiers - Array of tier objects (for tiered split)
   * @param {Array} expenses - Array of expense objects (for multi-bill)
   * @returns {Object} Map of participantId -> fairShareCents
   */
  function calculateFairShares(tab, participants, tiers = [], expenses = []) {
    const fairShares = {};
    
    if (participants.length === 0) {
      return fairShares;
    }

    // Determine total amount
    let totalCents = 0;
    
    if (tab.tab_type === 'one_bill') {
      // One-bill: use total_amount_cents, adjusted by expected_pay_rate
      totalCents = tab.total_amount_cents || 0;
      const payRate = (tab.expected_pay_rate || 100) / 100;
      totalCents = Math.round(totalCents * payRate);
    } else {
      // Multi-bill: sum all expenses
      totalCents = expenses.reduce((sum, exp) => sum + (exp.amount_cents || 0), 0);
    }

    // Calculate shares based on split mode
    const splitMode = tab.split_mode || 'equal';

    if (splitMode === 'equal') {
      // Equal split among all participants
      const sharePerPerson = Math.round(totalCents / participants.length);
      participants.forEach(p => {
        fairShares[p.id] = sharePerPerson;
      });
    } else if (splitMode === 'tiered' && tiers.length > 0) {
      // Tiered split: calculate weighted shares
      const tierMap = {};
      tiers.forEach(t => { tierMap[t.id] = t; });

      // Calculate total weight
      let totalWeight = 0;
      participants.forEach(p => {
        const tier = tierMap[p.tier_id];
        const multiplier = tier ? tier.multiplier : 1.0;
        totalWeight += multiplier;
      });

      // Calculate each participant's share
      participants.forEach(p => {
        const tier = tierMap[p.tier_id];
        const multiplier = tier ? tier.multiplier : 1.0;
        const share = Math.round((totalCents * multiplier) / totalWeight);
        fairShares[p.id] = share;
      });
    } else if (splitMode === 'seats') {
      // Seat-based split
      let totalSeats = 0;
      participants.forEach(p => {
        const seats = p.assigned_seats ? JSON.parse(p.assigned_seats) : [];
        totalSeats += seats.length || 1; // Default to 1 seat if none assigned
      });

      const perSeat = totalSeats > 0 ? totalCents / totalSeats : 0;

      participants.forEach(p => {
        const seats = p.assigned_seats ? JSON.parse(p.assigned_seats) : [];
        const seatCount = seats.length || 1;
        fairShares[p.id] = Math.round(perSeat * seatCount);
      });
    } else if (splitMode === 'linked_sliders') {
      // Linked sliders: use custom_amount_cents if set, otherwise equal
      const customParticipants = participants.filter(p => p.custom_amount_cents != null);
      const customTotal = customParticipants.reduce((sum, p) => sum + p.custom_amount_cents, 0);
      const remaining = totalCents - customTotal;
      const defaultParticipants = participants.filter(p => p.custom_amount_cents == null);
      const defaultShare = defaultParticipants.length > 0 
        ? Math.round(remaining / defaultParticipants.length) 
        : 0;

      participants.forEach(p => {
        if (p.custom_amount_cents != null) {
          fairShares[p.id] = p.custom_amount_cents;
        } else {
          fairShares[p.id] = defaultShare;
        }
      });
    } else {
      // Default to equal split
      const sharePerPerson = Math.round(totalCents / participants.length);
      participants.forEach(p => {
        fairShares[p.id] = sharePerPerson;
      });
    }

    return fairShares;
  }

  /**
   * Calculate what each participant has actually paid
   * @param {Array} payments - Array of payment objects
   * @param {Array} expenses - Array of expense objects (for multi-bill)
   * @param {string} tabType - 'one_bill' or 'multi_bill'
   * @returns {Object} Map of participantId -> paidCents
   */
  function calculateActualPaid(payments, expenses, tabType) {
    const paid = {};

    if (tabType === 'multi_bill') {
      // For multi-bill: count expenses paid by each participant
      expenses.forEach(exp => {
        const pid = exp.paid_by_participant_id;
        paid[pid] = (paid[pid] || 0) + (exp.amount_cents || 0);
      });
    }

    // Add payments (for settling up)
    payments.forEach(p => {
      const fromId = p.from_participant_id;
      paid[fromId] = (paid[fromId] || 0) + (p.amount_cents || 0);
    });

    return paid;
  }

  /**
   * Calculate balance for each participant
   * Positive = overpaid (owed money back)
   * Negative = underpaid (owes money)
   * @param {Object} fairShares - Map of participantId -> fairShareCents
   * @param {Object} actualPaid - Map of participantId -> paidCents
   * @param {Array} participants - Array of participant objects
   * @returns {Array} Array of { participantId, name, fairShare, actualPaid, balance }
   */
  function calculateBalances(fairShares, actualPaid, participants) {
    return participants.map(p => {
      const fair = fairShares[p.id] || 0;
      const paid = actualPaid[p.id] || 0;
      const balance = paid - fair;
      
      return {
        participantId: p.id,
        displayName: p.full_name || p.guest_name || 'Unknown',
        userId: p.user_id,
        fairShare: fair,
        actualPaid: paid,
        balance: balance // Positive = owed, Negative = owes
      };
    });
  }

  /**
   * Calculate global fairness score (0-100)
   * 100 = everyone paid exactly their fair share
   * 0 = maximum unfairness (one person paid everything)
   * @param {Array} balances - Array from calculateBalances()
   * @returns {number} Score from 0-100
   */
  function calculateGlobalFairness(balances) {
    if (balances.length === 0) return 100;

    const totalExpenses = balances.reduce((sum, b) => sum + b.fairShare, 0);
    if (totalExpenses === 0) return 100;

    // Sum of absolute deviations
    const totalDeviation = balances.reduce((sum, b) => sum + Math.abs(b.balance), 0);

    // Maximum possible deviation = total (one person paid everything)
    // But since we have both overpaid and underpaid, max deviation is 2 * total
    const maxDeviation = 2 * totalExpenses;

    // Score: 100 when no deviation, 0 when max deviation
    const score = Math.round(100 * (1 - totalDeviation / maxDeviation));
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate settlement suggestions to balance everything out
   * Uses greedy algorithm: match biggest debtor with biggest creditor
   * @param {Array} balances - Array from calculateBalances()
   * @returns {Array} Array of { fromId, fromName, toId, toName, amountCents }
   */
  function generateSettlements(balances) {
    const settlements = [];
    
    // Create working copies of balances
    const debtors = balances
      .filter(b => b.balance < -50) // Owes more than $0.50
      .map(b => ({ ...b }))
      .sort((a, b) => a.balance - b.balance); // Most negative first

    const creditors = balances
      .filter(b => b.balance > 50) // Owed more than $0.50
      .map(b => ({ ...b }))
      .sort((a, b) => b.balance - a.balance); // Most positive first

    // Match debtors with creditors
    while (debtors.length > 0 && creditors.length > 0) {
      const debtor = debtors[0];
      const creditor = creditors[0];

      const debtAmount = Math.abs(debtor.balance);
      const creditAmount = creditor.balance;
      const amount = Math.min(debtAmount, creditAmount);

      if (amount > 50) { // Only suggest settlements > $0.50
        settlements.push({
          fromId: debtor.participantId,
          fromName: debtor.displayName,
          toId: creditor.participantId,
          toName: creditor.displayName,
          amountCents: Math.round(amount)
        });
      }

      // Update balances
      debtor.balance += amount;
      creditor.balance -= amount;

      // Remove settled parties
      if (Math.abs(debtor.balance) <= 50) debtors.shift();
      if (creditor.balance <= 50) creditors.shift();
    }

    return settlements;
  }

  /**
   * Get per-person donut chart data
   * @param {Object} balance - Single balance object from calculateBalances()
   * @returns {Object} { fairShare, actualPaid, percentOfFair, status }
   */
  function getParticipantDonutData(balance) {
    const percentOfFair = balance.fairShare > 0 
      ? Math.round((balance.actualPaid / balance.fairShare) * 100) 
      : 100;

    let status;
    if (balance.balance > 50) {
      status = 'overpaid';
    } else if (balance.balance < -50) {
      status = 'underpaid';
    } else {
      status = 'settled';
    }

    return {
      participantId: balance.participantId,
      displayName: balance.displayName,
      fairShare: balance.fairShare,
      actualPaid: balance.actualPaid,
      balance: balance.balance,
      percentOfFair: percentOfFair,
      status: status
    };
  }

  /**
   * Calculate complete fairness data for a tab
   * @param {Object} tab - Tab data
   * @param {Array} participants - Participant array
   * @param {Array} expenses - Expense array
   * @param {Array} payments - Payment array
   * @param {Array} tiers - Tier array
   * @returns {Object} Complete fairness analysis
   */
  function calculateFairnessData(tab, participants, expenses, payments, tiers = []) {
    // Calculate fair shares
    const fairShares = calculateFairShares(tab, participants, tiers, expenses);
    
    // Calculate actual paid
    const actualPaid = calculateActualPaid(payments, expenses, tab.tab_type);
    
    // Calculate balances
    const balances = calculateBalances(fairShares, actualPaid, participants);
    
    // Global fairness score
    const globalScore = calculateGlobalFairness(balances);
    
    // Per-person donut data
    const participantData = balances.map(b => getParticipantDonutData(b));
    
    // Settlement suggestions
    const settlements = generateSettlements(balances);

    // Calculate totals
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount_cents || 0), 0);
    const totalPayments = payments.reduce((sum, p) => sum + (p.amount_cents || 0), 0);
    const tabTotal = tab.tab_type === 'one_bill' ? (tab.total_amount_cents || 0) : totalExpenses;

    return {
      globalScore,
      participants: participantData,
      settlements,
      summary: {
        tabTotal,
        totalExpenses,
        totalPayments,
        participantCount: participants.length,
        unsettledCount: balances.filter(b => Math.abs(b.balance) > 50).length
      }
    };
  }

  /**
   * Format cents to currency display
   * @param {number} cents - Amount in cents
   * @returns {string} Formatted currency string
   */
  function formatCurrency(cents) {
    if (typeof window.formatCurrency2 === 'function') {
      return window.formatCurrency2(cents);
    }
    return '€' + (cents / 100).toFixed(2);
  }

  // Export functions to global scope
  window.GroupTabsEngine = {
    calculateFairShares,
    calculateActualPaid,
    calculateBalances,
    calculateGlobalFairness,
    generateSettlements,
    getParticipantDonutData,
    calculateFairnessData,
    formatCurrency
  };

})();

