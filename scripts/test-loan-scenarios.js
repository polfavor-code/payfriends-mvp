#!/usr/bin/env node
/**
 * Test script for loan scenarios
 * Creates test users and various loan agreements to verify flows
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

function generatePublicId() {
  return 'usr_' + generateToken(12);
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function createTestUser(email, fullName, password = 'test1234') {
  // Check if user exists
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (existing) {
    console.log(`  User ${email} already exists (ID: ${existing.id})`);
    return existing;
  }

  const passwordHash = await hashPassword(password);
  const publicId = generatePublicId();

  const { data, error } = await supabase
    .from('users')
    .insert({
      email: email.toLowerCase(),
      password_hash: passwordHash,
      full_name: fullName,
      public_id: publicId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error(`  Error creating user ${email}:`, error.message);
    throw error;
  }

  console.log(`  Created user ${email} (ID: ${data.id})`);
  return data;
}

async function createAgreement(lenderId, lenderName, borrowerEmail, friendFirstName, details) {
  const {
    amountCents,
    interestRate = null,
    repaymentType = 'one_time',
    installmentCount = null,
    paymentFrequency = null,
    dueDate,
    status = 'pending',
    description = null,
  } = details;

  const { data, error } = await supabase
    .from('agreements')
    .insert({
      lender_user_id: lenderId,
      lender_name: lenderName,
      borrower_user_id: null,
      borrower_email: borrowerEmail.toLowerCase(),
      friend_first_name: friendFirstName,
      direction: 'lend',
      repayment_type: repaymentType,
      amount_cents: amountCents,
      interest_rate: interestRate,
      installment_count: installmentCount,
      payment_frequency: paymentFrequency,
      due_date: dueDate,
      status: status,
      description: description,
      has_repayment_issue: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('  Error creating agreement:', error.message);
    throw error;
  }

  // Create invite token
  const inviteToken = generateToken(32);
  await supabase
    .from('agreement_invites')
    .insert({
      agreement_id: data.id,
      email: borrowerEmail.toLowerCase(),
      token: inviteToken,
      created_at: new Date().toISOString(),
    });

  console.log(`  Created agreement #${data.id}: €${(amountCents / 100).toFixed(2)} to ${friendFirstName}`);
  return { ...data, inviteToken };
}

async function linkBorrowerToAgreement(agreementId, borrowerUserId) {
  const { data, error } = await supabase
    .from('agreements')
    .update({
      borrower_user_id: borrowerUserId,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', agreementId)
    .select()
    .single();

  if (error) {
    console.error('  Error linking borrower:', error.message);
    throw error;
  }

  // Mark invite as accepted
  await supabase
    .from('agreement_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('agreement_id', agreementId);

  console.log(`  Agreement #${agreementId} now active with borrower`);
  return data;
}

async function createMessage(userId, agreementId, subject, body, eventType) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      user_id: userId,
      agreement_id: agreementId,
      tab_id: null,
      subject: subject,
      body: body,
      event_type: eventType,
      created_at: new Date().toISOString(),
      read_at: null,
    })
    .select()
    .single();

  if (error) {
    console.error('  Error creating message:', error.message);
    throw error;
  }

  console.log(`  Created message for user ${userId}: ${subject}`);
  return data;
}

async function main() {
  console.log('\n=== PayFriends Test Scenario Setup ===\n');

  // 1. Create test users
  console.log('1. Creating test users...');
  const alice = await createTestUser('alice@test.com', 'Alice Johnson', 'alice123');
  const bob = await createTestUser('bob@test.com', 'Bob Smith', 'bob123');
  const charlie = await createTestUser('charlie@test.com', 'Charlie Brown', 'charlie123');
  const diana = await createTestUser('diana@test.com', 'Diana Prince', 'diana123');

  // Calculate dates
  const today = new Date();
  const inOneWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const inOneMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const inSixMonths = new Date(today.getFullYear(), today.getMonth() + 6, today.getDate());
  const inOneYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());

  const formatDate = (d) => d.toISOString().split('T')[0];

  // 2. Create various loan scenarios
  console.log('\n2. Creating loan scenarios...');

  // Scenario 1: Simple one-time loan, no interest (Alice lends to Bob)
  console.log('\n  Scenario 1: Simple one-time loan, no interest');
  const loan1 = await createAgreement(alice.id, 'Alice Johnson', 'bob@test.com', 'Bob', {
    amountCents: 50000, // €500
    interestRate: 0,
    repaymentType: 'one_time',
    dueDate: formatDate(inOneMonth),
    description: 'Loan for bike repair',
  });

  // Scenario 2: One-time loan with interest (Alice lends to Charlie)
  console.log('\n  Scenario 2: One-time loan with 5% interest');
  const loan2 = await createAgreement(alice.id, 'Alice Johnson', 'charlie@test.com', 'Charlie', {
    amountCents: 200000, // €2,000
    interestRate: 5,
    repaymentType: 'one_time',
    dueDate: formatDate(inOneYear),
    description: 'Loan for laptop purchase',
  });

  // Scenario 3: Installment loan, monthly (Bob lends to Diana)
  console.log('\n  Scenario 3: Installment loan - 6 monthly payments');
  const loan3 = await createAgreement(bob.id, 'Bob Smith', 'diana@test.com', 'Diana', {
    amountCents: 300000, // €3,000
    interestRate: 4,
    repaymentType: 'installments',
    installmentCount: 6,
    paymentFrequency: 'monthly',
    dueDate: formatDate(inOneMonth), // First payment due
    description: 'Car repair loan',
  });

  // Scenario 4: Large loan, 12 monthly installments (Charlie lends to Alice)
  console.log('\n  Scenario 4: Larger loan - 12 monthly payments');
  const loan4 = await createAgreement(charlie.id, 'Charlie Brown', 'alice@test.com', 'Alice', {
    amountCents: 600000, // €6,000
    interestRate: 5,
    repaymentType: 'installments',
    installmentCount: 12,
    paymentFrequency: 'monthly',
    dueDate: formatDate(inOneMonth),
    description: 'Home improvement loan',
  });

  // Scenario 5: Quick small loan, weekly payments (Diana lends to Bob)
  console.log('\n  Scenario 5: Small loan - 4 weekly payments');
  const loan5 = await createAgreement(diana.id, 'Diana Prince', 'bob@test.com', 'Bob', {
    amountCents: 20000, // €200
    interestRate: 0,
    repaymentType: 'installments',
    installmentCount: 4,
    paymentFrequency: 'weekly',
    dueDate: formatDate(inOneWeek),
    description: 'Festival tickets',
  });

  // 3. Link some borrowers to make agreements active
  console.log('\n3. Activating some agreements (linking borrowers)...');

  // Activate loan1 (Bob accepts Alice's loan)
  await linkBorrowerToAgreement(loan1.id, bob.id);

  // Activate loan3 (Diana accepts Bob's loan)
  await linkBorrowerToAgreement(loan3.id, diana.id);

  // Activate loan5 (Bob accepts Diana's loan)
  await linkBorrowerToAgreement(loan5.id, bob.id);

  // 4. Create messages/notifications
  console.log('\n4. Creating messages...');

  // Message to Bob about loan1
  await createMessage(
    bob.id,
    loan1.id,
    'Loan Agreement Received',
    'Alice has sent you a loan agreement for €500.00. Please review and accept.',
    'agreement_received'
  );

  // Message to Alice about loan4 being pending
  await createMessage(
    alice.id,
    loan4.id,
    'Loan Agreement Created',
    'You have received a loan agreement from Charlie for €6,000.00.',
    'agreement_created'
  );

  // Message to Diana about active loan
  await createMessage(
    diana.id,
    loan3.id,
    'Loan Activated',
    'Your loan agreement with Bob is now active. First payment of €512.50 due in 1 month.',
    'agreement_activated'
  );

  // Message to Bob about multiple loans
  await createMessage(
    bob.id,
    loan5.id,
    'Loan Activated',
    'Your loan from Diana (€200.00) is now active. First weekly payment due soon.',
    'agreement_activated'
  );

  // Unread message for testing activity badge
  await createMessage(
    charlie.id,
    loan2.id,
    'Loan Agreement Pending',
    'Your loan to Alice (€2,000.00) is pending acceptance.',
    'agreement_pending'
  );

  console.log('\n=== Test Setup Complete ===\n');

  console.log('Test Accounts Created:');
  console.log('  - alice@test.com (password: alice123)');
  console.log('  - bob@test.com (password: bob123)');
  console.log('  - charlie@test.com (password: charlie123)');
  console.log('  - diana@test.com (password: diana123)');

  console.log('\nLoan Scenarios:');
  console.log(`  1. Loan #${loan1.id}: Alice → Bob, €500, no interest, one-time [ACTIVE]`);
  console.log(`  2. Loan #${loan2.id}: Alice → Charlie, €2,000, 5% interest, one-time [PENDING]`);
  console.log(`  3. Loan #${loan3.id}: Bob → Diana, €3,000, 4% interest, 6 monthly [ACTIVE]`);
  console.log(`  4. Loan #${loan4.id}: Charlie → Alice, €6,000, 5% interest, 12 monthly [PENDING]`);
  console.log(`  5. Loan #${loan5.id}: Diana → Bob, €200, no interest, 4 weekly [ACTIVE]`);

  console.log('\nTo test:');
  console.log('  1. Login as alice@test.com - should see loans as lender and borrower');
  console.log('  2. Login as bob@test.com - should see multiple active loans');
  console.log('  3. Check activity/messages for each user');
  console.log('  4. Test the loan overview filters');
  console.log('  5. Verify calculations in loan details\n');
}

main().catch(console.error);
