/**
 * GroupTabs Payment Logic
 * Handles payment processing, overpay detection, and redistribution calculations
 */

(function() {
  'use strict';

  /**
   * Calculate fair share for equal split
   * @param {number} totalBillCents - Total bill amount in cents
   * @param {number} participantCount - Number of participants
   * @returns {number} Fair share per person in cents
   */
  function calculateFairShare(totalBillCents, participantCount) {
    if (participantCount <= 0) return 0;
    return Math.floor(totalBillCents / participantCount);
  }

  /**
   * Get total outstanding for the tab (sum of all remaining balances)
   * @param {Array} participants - Array of participant objects with remaining_cents
   * @returns {number} Total outstanding in cents
   */
  function getTotalOutstanding(participants) {
    return participants.reduce((sum, p) => sum + (p.remaining_cents || 0), 0);
  }

  /**
   * Validate payment amount
   * @param {number} amountCents - Amount to pay in cents
   * @param {number} totalOutstanding - Total outstanding for the tab
   * @param {number} participantRemaining - Participant's remaining balance (optional)
   * @returns {Object} { valid: boolean, error: string|null, isOverpay: boolean }
   */
  function validatePaymentAmount(amountCents, totalOutstanding, participantRemaining = null) {
    if (!amountCents || amountCents <= 0) {
      return { valid: false, error: 'Amount must be greater than zero', isOverpay: false };
    }
    
    if (amountCents > totalOutstanding) {
      return { valid: false, error: 'Amount exceeds total outstanding balance', isOverpay: false };
    }
    
    const isOverpay = participantRemaining !== null && amountCents > participantRemaining;
    
    return { valid: true, error: null, isOverpay };
  }

  /**
   * Check if payment triggers overpay
   * @param {number} amountCents - Amount being paid
   * @param {number} participantRemaining - Participant's remaining balance
   * @returns {boolean}
   */
  function isOverpayment(amountCents, participantRemaining) {
    return amountCents > participantRemaining;
  }

  /**
   * Calculate proportional redistribution of overpay amount
   * @param {number} overpayCents - Amount to redistribute
   * @param {Array} otherParticipants - Participants to receive redistribution (with remaining_cents > 0)
   * @returns {Array} Array of { participantId, participantName, currentRemaining, reduction, newRemaining }
   */
  function calculateRedistribution(overpayCents, otherParticipants) {
    if (overpayCents <= 0 || otherParticipants.length === 0) {
      return [];
    }
    
    // Filter to only those with remaining balance
    const eligibleParticipants = otherParticipants.filter(p => (p.remaining_cents || 0) > 0);
    
    if (eligibleParticipants.length === 0) {
      return [];
    }
    
    const sumOthersRemaining = eligibleParticipants.reduce((sum, p) => sum + (p.remaining_cents || 0), 0);
    
    if (sumOthersRemaining <= 0) {
      return [];
    }
    
    const redistribution = [];
    let totalReduction = 0;
    
    for (const p of eligibleParticipants) {
      const currentRemaining = p.remaining_cents || 0;
      const shareFactor = currentRemaining / sumOthersRemaining;
      let reduction = Math.floor(overpayCents * shareFactor);
      
      // Ensure we don't reduce below 0
      reduction = Math.min(reduction, currentRemaining);
      
      redistribution.push({
        participantId: p.id,
        participantName: p.display_name || p.guest_name || 'Unknown',
        currentRemaining: currentRemaining,
        reduction: reduction,
        newRemaining: Math.max(0, currentRemaining - reduction)
      });
      
      totalReduction += reduction;
    }
    
    // Handle rounding - distribute any remaining cents to first participants
    let remaining = overpayCents - totalReduction;
    let i = 0;
    while (remaining > 0 && i < redistribution.length) {
      const r = redistribution[i];
      if (r.newRemaining > 0) {
        const extraReduction = Math.min(remaining, r.newRemaining);
        r.reduction += extraReduction;
        r.newRemaining -= extraReduction;
        remaining -= extraReduction;
      }
      i++;
    }
    
    return redistribution;
  }

  /**
   * Process a normal payment (no overpay)
   * @param {number} amountCents - Amount being paid
   * @param {Object} participant - Participant making payment
   * @param {Object} tabState - Current tab state { host_overpaid_cents, paid_up_cents }
   * @returns {Object} Updated state { participantUpdate, tabUpdate }
   */
  function processNormalPayment(amountCents, participant, tabState) {
    const currentRemaining = participant.remaining_cents || 0;
    const delta = Math.min(amountCents, currentRemaining);
    
    const newRemaining = currentRemaining - delta;
    const newTotalPaid = (participant.total_paid_cents || 0) + amountCents;
    
    // Update tab state
    const newPaidUp = (tabState.paid_up_cents || 0) + delta;
    let newHostOverpaid = tabState.host_overpaid_cents || 0;
    
    // Reduce host overpaid by the amount settled
    if (newHostOverpaid > 0) {
      newHostOverpaid = Math.max(0, newHostOverpaid - delta);
    }
    
    return {
      participantUpdate: {
        remaining_cents: newRemaining,
        total_paid_cents: newTotalPaid
      },
      tabUpdate: {
        paid_up_cents: newPaidUp,
        host_overpaid_cents: newHostOverpaid
      },
      appliedCents: delta,
      overpayCents: 0
    };
  }

  /**
   * Process an overpayment with redistribution
   * @param {number} amountCents - Amount being paid
   * @param {Object} payer - Participant making payment
   * @param {Array} allParticipants - All participants in the tab
   * @param {Object} tabState - Current tab state
   * @returns {Object} { payerUpdate, participantUpdates, tabUpdate, redistribution }
   */
  function processOverpayment(amountCents, payer, allParticipants, tabState) {
    const payerRemaining = payer.remaining_cents || 0;
    const settleAmount = payerRemaining;
    const overpayCents = amountCents - settleAmount;
    
    // Update payer: remaining becomes 0, total_paid increases
    const payerUpdate = {
      remaining_cents: 0,
      total_paid_cents: (payer.total_paid_cents || 0) + amountCents
    };
    
    // Get others with remaining > 0
    const others = allParticipants.filter(p => p.id !== payer.id && (p.remaining_cents || 0) > 0);
    
    // Calculate redistribution
    const redistribution = calculateRedistribution(overpayCents, others);
    
    // Build participant updates
    const participantUpdates = {};
    participantUpdates[payer.id] = payerUpdate;
    
    let totalReduction = 0;
    for (const r of redistribution) {
      participantUpdates[r.participantId] = {
        remaining_cents: r.newRemaining
      };
      totalReduction += r.reduction;
    }
    
    // Calculate new tab state
    // paid_up_cents = sum of (fair_share - remaining) for all participants
    let newPaidUp = 0;
    for (const p of allParticipants) {
      const fairShare = p.fair_share_cents || 0;
      let remaining;
      if (participantUpdates[p.id]) {
        remaining = participantUpdates[p.id].remaining_cents;
        if (remaining === undefined) {
          remaining = p.remaining_cents || 0;
        }
      } else {
        remaining = p.remaining_cents || 0;
      }
      newPaidUp += (fairShare - remaining);
    }
    
    // Reduce host overpaid
    let newHostOverpaid = tabState.host_overpaid_cents || 0;
    const totalSettled = settleAmount + totalReduction;
    newHostOverpaid = Math.max(0, newHostOverpaid - totalSettled);
    
    return {
      payerUpdate,
      participantUpdates,
      tabUpdate: {
        paid_up_cents: newPaidUp,
        host_overpaid_cents: newHostOverpaid
      },
      redistribution,
      appliedCents: settleAmount,
      overpayCents: overpayCents
    };
  }

  /**
   * Process a multi-person payment
   * @param {Array} paymentRows - Array of { participantId, amountCents }
   * @param {Array} allParticipants - All participants in the tab
   * @param {Object} tabState - Current tab state
   * @returns {Object} { participantUpdates, tabUpdate, redistribution, totalAmount, totalApplied, totalOverpay }
   */
  function processMultiPersonPayment(paymentRows, allParticipants, tabState) {
    // Calculate totals
    const totalAmount = paymentRows.reduce((sum, row) => sum + row.amountCents, 0);
    
    // Create participant map
    const participantMap = {};
    allParticipants.forEach(p => { participantMap[p.id] = { ...p }; });
    
    // First pass: settle each beneficiary up to their remaining
    let totalApplied = 0;
    let totalOverpay = 0;
    const participantUpdates = {};
    
    for (const row of paymentRows) {
      const participant = participantMap[row.participantId];
      if (!participant) continue;
      
      const currentRemaining = participant.remaining_cents || 0;
      const applied = Math.min(row.amountCents, currentRemaining);
      const overpay = row.amountCents - applied;
      
      totalApplied += applied;
      totalOverpay += overpay;
      
      // Update participant
      participant.remaining_cents = currentRemaining - applied;
      participant.total_paid_cents = (participant.total_paid_cents || 0) + row.amountCents;
      
      participantUpdates[row.participantId] = {
        remaining_cents: participant.remaining_cents,
        total_paid_cents: participant.total_paid_cents
      };
    }
    
    // Second pass: redistribute overpay if any
    let redistribution = [];
    if (totalOverpay > 0) {
      // Get others with remaining > 0 who weren't in the payment
      const payerIds = new Set(paymentRows.map(r => r.participantId));
      const others = allParticipants
        .filter(p => !payerIds.has(p.id))
        .map(p => ({
          ...p,
          remaining_cents: participantUpdates[p.id]?.remaining_cents ?? p.remaining_cents
        }))
        .filter(p => (p.remaining_cents || 0) > 0);
      
      redistribution = calculateRedistribution(totalOverpay, others);
      
      // Apply redistribution
      for (const r of redistribution) {
        if (!participantUpdates[r.participantId]) {
          participantUpdates[r.participantId] = {};
        }
        participantUpdates[r.participantId].remaining_cents = r.newRemaining;
        participantMap[r.participantId].remaining_cents = r.newRemaining;
      }
    }
    
    // Calculate new tab state
    let newPaidUp = 0;
    for (const p of allParticipants) {
      const fairShare = p.fair_share_cents || 0;
      const remaining = participantUpdates[p.id]?.remaining_cents ?? p.remaining_cents ?? 0;
      newPaidUp += (fairShare - remaining);
    }
    
    // Reduce host overpaid
    let newHostOverpaid = tabState.host_overpaid_cents || 0;
    const totalReduction = redistribution.reduce((sum, r) => sum + r.reduction, 0);
    const totalSettled = totalApplied + totalReduction;
    newHostOverpaid = Math.max(0, newHostOverpaid - totalSettled);
    
    return {
      participantUpdates,
      tabUpdate: {
        paid_up_cents: newPaidUp,
        host_overpaid_cents: newHostOverpaid
      },
      redistribution,
      totalAmount,
      totalApplied,
      totalOverpay
    };
  }

  /**
   * Check if all participants have fully settled
   * @param {Array} participants - All participants with current remaining_cents
   * @returns {boolean}
   */
  function isFullySettled(participants) {
    return participants.every(p => (p.remaining_cents || 0) <= 0);
  }

  /**
   * Calculate initial state when host creates tab and pays the full bill
   * @param {number} totalBillCents - Total bill amount
   * @param {number} peopleCount - Number of people (including host)
   * @returns {Object} { fairShareCents, hostOverpaidCents, paidUpCents }
   */
  function calculateHostInitialPayment(totalBillCents, peopleCount) {
    const fairShareCents = calculateFairShare(totalBillCents, peopleCount);
    const hostOverpaidCents = totalBillCents - fairShareCents;
    const paidUpCents = fairShareCents; // Only host's fair share is "settled"
    
    return {
      fairShareCents,
      hostOverpaidCents,
      paidUpCents
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
  window.GroupTabsPaymentLogic = {
    calculateFairShare,
    getTotalOutstanding,
    validatePaymentAmount,
    isOverpayment,
    calculateRedistribution,
    processNormalPayment,
    processOverpayment,
    processMultiPersonPayment,
    isFullySettled,
    calculateHostInitialPayment,
    formatCurrency
  };

})();

