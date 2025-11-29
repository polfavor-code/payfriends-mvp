/**
 * Seed Demo Data Script
 * Creates test users and active agreements for local development and E2E testing.
 * 
 * Usage: node scripts/seed-demo-data.js
 * 
 * Test Scenarios Created:
 * 
 * User A (Alice): Lender in multiple loans
 *   - Bullet loan to Bob (€1,000, due in 3 months, with partial confirmed payments)
 *   - Installment loan to Charlie (€3,000, 6 monthly installments, some paid)
 *   - Also a borrower from Dave (€500, small loan)
 * 
 * User B (Bob): Borrower from Alice (bullet loan)
 * 
 * User C (Charlie): Borrower from Alice (installment loan)
 * 
 * User D (Dave): Lender to Alice (small loan where Alice is borrower)
 * 
 * This script is idempotent - safe to run multiple times.
 */

const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'payfriends.db');
const SALT_ROUNDS = 10;

// Test user credentials
const USERS = {
  alice: { email: 'alice@test.dev', password: 'password123', fullName: 'Alice Anderson' },
  bob: { email: 'bob@test.dev', password: 'password123', fullName: 'Bob Brown' },
  charlie: { email: 'charlie@test.dev', password: 'password123', fullName: 'Charlie Chen' },
  dave: { email: 'dave@test.dev', password: 'password123', fullName: 'Dave Davis' },
  // Keep legacy test users for backward compatibility
  lender: { email: 'lender@test.dev', password: 'password123', fullName: 'Lenny Lender' },
  borrower: { email: 'borrower@test.dev', password: 'password123', fullName: 'Bob Borrower' }
};

console.log('=== PayFriends Demo Data Seeder ===\n');

// Connect to database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

/**
 * Create or update a user
 */
async function upsertUser(email, password, fullName) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const publicId = crypto.randomBytes(16).toString('hex');
  const createdAt = new Date().toISOString();

  // Check if user exists
  const existing = db.prepare('SELECT id, public_id FROM users WHERE email = ?').get(email);

  if (existing) {
    // Update existing user (password and name only, keep existing public_id)
    db.prepare(`
      UPDATE users 
      SET password_hash = ?, full_name = ?
      WHERE email = ?
    `).run(passwordHash, fullName, email);

    console.log(`✓ Updated existing user: ${email} (ID: ${existing.id})`);
    return { id: existing.id, public_id: existing.public_id };
  } else {
    // Insert new user
    const result = db.prepare(`
      INSERT INTO users (email, password_hash, full_name, public_id, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(email, passwordHash, fullName, publicId, createdAt);

    console.log(`✓ Created new user: ${email} (ID: ${result.lastInsertRowid})`);
    return { id: result.lastInsertRowid, public_id: publicId };
  }
}

/**
 * Create or update an active agreement
 */
function upsertAgreement(params) {
  const {
    lenderUserId,
    borrowerUserId,
    lenderName,
    borrowerEmail,
    borrowerName,
    amountCents,
    description,
    interestRate = 5.0,
    repaymentType = 'one_time',
    installmentCount = 1,
    paymentFrequency = 'once',
    dueInDays = 90,
    moneysentDaysAgo = 0
  } = params;

  const now = new Date();
  const createdAt = now.toISOString();
  const acceptedAt = now.toISOString();
  
  // Money sent date (can be in the past for testing)
  const moneySentDate = new Date(now);
  moneySentDate.setDate(moneySentDate.getDate() - moneysentDaysAgo);
  const moneySentDateStr = moneySentDate.toISOString().split('T')[0];

  // Due date
  const dueDate = new Date(moneySentDate);
  dueDate.setDate(dueDate.getDate() + dueInDays);
  const dueDateStr = dueDate.toISOString().split('T')[0];

  // First payment date for installments
  let firstPaymentDate = null;
  if (repaymentType === 'installments') {
    const fpDate = new Date(moneySentDate);
    fpDate.setDate(fpDate.getDate() + 30); // First payment 30 days after money sent
    firstPaymentDate = fpDate.toISOString().split('T')[0];
  }

  // Calculate total repayment amount with simple interest
  const yearFraction = dueInDays / 365;
  const interestCents = Math.round(amountCents * (interestRate / 100) * yearFraction);
  const totalRepayAmount = (amountCents + interestCents) / 100;

  // Check if agreement already exists
  const existing = db.prepare(`
    SELECT id FROM agreements 
    WHERE lender_user_id = ? AND borrower_user_id = ?
    AND status IN ('pending', 'active')
    AND description = ?
    LIMIT 1
  `).get(lenderUserId, borrowerUserId, description);

  if (existing) {
    // Update existing agreement
    db.prepare(`
      UPDATE agreements 
      SET amount_cents = ?,
          interest_rate = ?,
          due_date = ?,
          status = 'active',
          repayment_type = ?,
          installment_count = ?,
          payment_frequency = ?,
          first_payment_date = ?,
          total_repay_amount = ?,
          accepted_at = ?,
          money_sent_date = ?,
          description = ?,
          payment_preference_method = 'bank,cash',
          proof_required = 0
      WHERE id = ?
    `).run(
      amountCents,
      interestRate,
      dueDateStr,
      repaymentType,
      installmentCount,
      paymentFrequency,
      firstPaymentDate,
      totalRepayAmount,
      acceptedAt,
      moneySentDateStr,
      description,
      existing.id
    );

    console.log(`✓ Updated agreement ID: ${existing.id} - ${description}`);
    return existing.id;
  } else {
    // Create new agreement
    const result = db.prepare(`
      INSERT INTO agreements (
        lender_user_id,
        lender_name,
        borrower_email,
        borrower_user_id,
        friend_first_name,
        direction,
        repayment_type,
        installment_count,
        payment_frequency,
        first_payment_date,
        amount_cents,
        due_date,
        created_at,
        status,
        description,
        interest_rate,
        total_repay_amount,
        accepted_at,
        money_sent_date,
        payment_preference_method,
        proof_required
      ) VALUES (?, ?, ?, ?, ?, 'lend', ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, 'bank,cash', 0)
    `).run(
      lenderUserId,
      lenderName,
      borrowerEmail,
      borrowerUserId,
      borrowerName,
      repaymentType,
      installmentCount,
      paymentFrequency,
      firstPaymentDate,
      amountCents,
      dueDateStr,
      createdAt,
      description,
      interestRate,
      totalRepayAmount,
      acceptedAt,
      moneySentDateStr
    );

    console.log(`✓ Created agreement ID: ${result.lastInsertRowid} - ${description}`);
    return result.lastInsertRowid;
  }
}

/**
 * Clear existing payments for an agreement
 */
function clearPayments(agreementId) {
  db.prepare('DELETE FROM payments WHERE agreement_id = ?').run(agreementId);
}

/**
 * Create a payment
 */
function createPayment(agreementId, recordedByUserId, amountCents, daysAgo, status = 'approved') {
  const paymentDate = new Date();
  paymentDate.setDate(paymentDate.getDate() - daysAgo);
  const createdAt = paymentDate.toISOString();

  // For applied_amount_cents, use the full amount (no overpayment handling in seed)
  const result = db.prepare(`
    INSERT INTO payments (
      agreement_id, 
      recorded_by_user_id, 
      amount_cents, 
      applied_amount_cents,
      created_at, 
      status, 
      method
    ) VALUES (?, ?, ?, ?, ?, ?, 'bank')
  `).run(agreementId, recordedByUserId, amountCents, amountCents, createdAt, status);
  
  console.log(`  ✓ Payment: €${(amountCents/100).toFixed(2)} (${status}) - ${daysAgo} days ago`);
  return result.lastInsertRowid;
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('Creating test users...\n');

    // Create all users
    const alice = await upsertUser(USERS.alice.email, USERS.alice.password, USERS.alice.fullName);
    const bob = await upsertUser(USERS.bob.email, USERS.bob.password, USERS.bob.fullName);
    const charlie = await upsertUser(USERS.charlie.email, USERS.charlie.password, USERS.charlie.fullName);
    const dave = await upsertUser(USERS.dave.email, USERS.dave.password, USERS.dave.fullName);
    
    // Legacy users for backward compatibility
    const lender = await upsertUser(USERS.lender.email, USERS.lender.password, USERS.lender.fullName);
    const borrower = await upsertUser(USERS.borrower.email, USERS.borrower.password, USERS.borrower.fullName);

    console.log('\n--- Creating Agreements for ALICE (mixed lender/borrower) ---\n');

    // Agreement 1: Alice lends to Bob (bullet loan, partial payments)
    const aliceToBobId = upsertAgreement({
      lenderUserId: alice.id,
      borrowerUserId: bob.id,
      lenderName: USERS.alice.fullName,
      borrowerEmail: USERS.bob.email,
      borrowerName: 'Bob',
      amountCents: 100000, // €1,000
      description: 'Loan to Bob for car repairs',
      interestRate: 5.0,
      repaymentType: 'one_time',
      dueInDays: 90,
      moneysentDaysAgo: 30 // Started 30 days ago
    });
    
    // Add some confirmed payments
    console.log('  Adding payments for Alice → Bob loan:');
    clearPayments(aliceToBobId);
    createPayment(aliceToBobId, bob.id, 30000, 20, 'approved'); // €300 paid 20 days ago
    createPayment(aliceToBobId, bob.id, 20000, 10, 'approved'); // €200 paid 10 days ago

    // Agreement 2: Alice lends to Charlie (installment loan)
    const aliceToCharlieId = upsertAgreement({
      lenderUserId: alice.id,
      borrowerUserId: charlie.id,
      lenderName: USERS.alice.fullName,
      borrowerEmail: USERS.charlie.email,
      borrowerName: 'Charlie',
      amountCents: 300000, // €3,000
      description: 'Wedding expenses loan to Charlie',
      interestRate: 3.0,
      repaymentType: 'installments',
      installmentCount: 6,
      paymentFrequency: 'every-month',
      dueInDays: 180, // 6 months
      moneysentDaysAgo: 60 // Started 60 days ago
    });
    
    // First 2 installments paid
    console.log('  Adding payments for Alice → Charlie loan:');
    clearPayments(aliceToCharlieId);
    createPayment(aliceToCharlieId, charlie.id, 51500, 30, 'approved'); // ~€515 (installment 1)
    createPayment(aliceToCharlieId, charlie.id, 51500, 0, 'approved');  // ~€515 (installment 2)

    // Agreement 3: Dave lends to Alice (Alice is borrower here)
    const daveToAliceId = upsertAgreement({
      lenderUserId: dave.id,
      borrowerUserId: alice.id,
      lenderName: USERS.dave.fullName,
      borrowerEmail: USERS.alice.email,
      borrowerName: 'Alice',
      amountCents: 50000, // €500
      description: 'Small emergency loan to Alice',
      interestRate: 0, // Interest-free friendly loan
      repaymentType: 'one_time',
      dueInDays: 60,
      moneysentDaysAgo: 15
    });
    console.log('  No payments yet for Dave → Alice loan');
    clearPayments(daveToAliceId);

    console.log('\n--- Creating Legacy Test Agreements ---\n');

    // Legacy Agreement 1: Standard active loan
    const legacyId1 = upsertAgreement({
      lenderUserId: lender.id,
      borrowerUserId: borrower.id,
      lenderName: USERS.lender.fullName,
      borrowerEmail: USERS.borrower.email,
      borrowerName: 'Bob',
      amountCents: 100000, // €1,000
      description: 'Demo loan 1',
      dueInDays: 90
    });
    clearPayments(legacyId1);

    // Legacy Agreement 2: Loan with payment history
    const legacyId2 = upsertAgreement({
      lenderUserId: lender.id,
      borrowerUserId: borrower.id,
      lenderName: USERS.lender.fullName,
      borrowerEmail: USERS.borrower.email,
      borrowerName: 'Bob',
      amountCents: 250000, // €2,500
      description: 'Demo loan 2 with history',
      dueInDays: 90
    });
    
    console.log('  Adding payments for legacy loan 2:');
    clearPayments(legacyId2);
    createPayment(legacyId2, borrower.id, 50000, 60, 'approved');
    createPayment(legacyId2, borrower.id, 50000, 30, 'approved');
    createPayment(legacyId2, borrower.id, 50000, 0, 'pending'); // Pending confirmation

    console.log('\n=== Demo Data Ready ===\n');
    
    console.log('Test Users (password for all: password123):');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│ User       │ Email              │ Role                        │');
    console.log('├──────────────────────────────────────────────────────────────┤');
    console.log('│ Alice      │ alice@test.dev     │ Lender AND Borrower (best!) │');
    console.log('│ Bob        │ bob@test.dev       │ Borrower only               │');
    console.log('│ Charlie    │ charlie@test.dev   │ Borrower only               │');
    console.log('│ Dave       │ dave@test.dev      │ Lender only                 │');
    console.log('│ Lenny      │ lender@test.dev    │ Lender (legacy)             │');
    console.log('│ Bob B.     │ borrower@test.dev  │ Borrower (legacy)           │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    
    console.log('\nTest Scenarios:');
    console.log('  • Login as ALICE to see:');
    console.log('    - Mixed incoming (€500 from Bob, €2.5k from Charlie)');
    console.log('    - Outgoing (€500 to Dave)');
    console.log('    - Multiple active loans on timeline');
    console.log('');
    console.log('  • Login as BOB to see:');
    console.log('    - Outgoing payment to Alice (partial paid)');
    console.log('');
    console.log('  • Login as DAVE to see:');
    console.log('    - Incoming from Alice');
    console.log('');
    console.log('Run: npm start');
    console.log('Then visit: http://localhost:3000');
    console.log('\n✅ Seed complete!\n');

  } catch (error) {
    console.error('\n❌ Error seeding data:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run
main();
