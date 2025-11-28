/**
 * Seed Demo Data Script
 * Creates test users and active agreements for local development and E2E testing.
 * 
 * Usage: node scripts/seed-demo-data.js
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
const LENDER_EMAIL = 'lender@test.dev';
const BORROWER_EMAIL = 'borrower@test.dev';
const PASSWORD = 'password123';

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
      SET password_hash = ?, full_name = ?, created_at = ?
      WHERE email = ?
    `).run(passwordHash, fullName, createdAt, email);

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
function upsertAgreement(lenderUserId, borrowerUserId, lenderName, borrowerEmail, borrowerName, amountCents = 100000, description = 'Demo loan for testing') {
    // Agreement parameters
    // Agreement parameters
    const interestRate = 5.0; // 5% annual
    const daysUntilDue = 90; // 90 days from now

    const now = new Date();
    const createdAt = now.toISOString();
    const acceptedAt = now.toISOString(); // Make it accepted immediately
    const moneySentDate = now.toISOString().split('T')[0]; // Today's date

    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + daysUntilDue);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    // Calculate total repayment amount with simple interest
    const yearFraction = daysUntilDue / 365;
    const interestCents = Math.round(amountCents * (interestRate / 100) * yearFraction);
    const totalRepayAmount = (amountCents + interestCents) / 100; // Convert to euros for storage

    // Check if agreement already exists for these users
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
          repayment_type = 'one_time',
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
            totalRepayAmount,
            acceptedAt,
            moneySentDate,
            description,
            existing.id
        );

        console.log(`✓ Updated existing agreement ID: ${existing.id}`);
        console.log(`  Principal: €${(amountCents / 100).toFixed(2)}`);
        console.log(`  Interest: ${interestRate}% (€${(interestCents / 100).toFixed(2)})`);
        console.log(`  Total to repay: €${totalRepayAmount.toFixed(2)}`);
        console.log(`  Due date: ${dueDateStr} (${daysUntilDue} days from now)`);
        console.log(`  Status: active`);

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
      ) VALUES (?, ?, ?, ?, ?, 'lend', 'one_time', ?, ?, ?, 'active', ?, ?, ?, ?, ?, 'bank,cash', 0)
    `).run(
            lenderUserId,
            lenderName,
            borrowerEmail,
            borrowerUserId,
            borrowerName,
            amountCents,
            dueDateStr,
            createdAt,
            description,
            interestRate,
            totalRepayAmount,
            acceptedAt,
            moneySentDate
        );

        console.log(`✓ Created new agreement ID: ${result.lastInsertRowid}`);
        console.log(`  Principal: €${(amountCents / 100).toFixed(2)}`);
        console.log(`  Interest: ${interestRate}% (€${(interestCents / 100).toFixed(2)})`);
        console.log(`  Total to repay: €${totalRepayAmount.toFixed(2)}`);
        console.log(`  Due date: ${dueDateStr} (${daysUntilDue} days from now)`);
        console.log(`  Status: active`);

        return result.lastInsertRowid;
    }
}

/**
 * Create or update a payment
 */
function upsertPayment(agreementId, lenderUserId, borrowerUserId, amountCents, dateStr, status) {
    // Check if payment exists (by date/created_at and amount to avoid dupes)
    // We use LIKE for date matching since created_at is ISO timestamp
    const existing = db.prepare(`
        SELECT id FROM payments 
        WHERE agreement_id = ? AND amount_cents = ? AND created_at LIKE ?
    `).get(agreementId, amountCents, `${dateStr}%`);

    if (existing) {
        db.prepare(`
            UPDATE payments
            SET status = ?
            WHERE id = ?
        `).run(status, existing.id);
        console.log(`✓ Updated payment ID: ${existing.id} (${status})`);
        return existing.id;
    } else {
        // Use dateStr as created_at (assuming it's YYYY-MM-DD, we append time)
        const fullDate = dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00.000Z`;

        const result = db.prepare(`
            INSERT INTO payments (
                agreement_id, recorded_by_user_id, amount_cents, created_at, status, method
            ) VALUES (?, ?, ?, ?, ?, 'bank')
        `).run(agreementId, borrowerUserId, amountCents, fullDate, status);
        console.log(`✓ Created payment ID: ${result.lastInsertRowid} (${status})`);
        return result.lastInsertRowid;
    }
}

/**
 * Main execution
 */
async function main() {
    try {
        console.log('Creating test users...\n');

        // Create lender
        const lender = await upsertUser(LENDER_EMAIL, PASSWORD, 'Lenny Lender');

        // Create borrower
        const borrower = await upsertUser(BORROWER_EMAIL, PASSWORD, 'Bob Borrower');

        console.log('\nCreating active agreements...\n');

        // Agreement 1: Standard active loan (Scenario A & B)
        const agreement1Id = upsertAgreement(
            lender.id,
            borrower.id,
            'Lenny Lender',
            BORROWER_EMAIL,
            'Bob',
            100000, // €1,000
            'Demo loan 1'
        );

        // Agreement 2: Active loan with history and pending payment (Scenario B, C, D)
        const agreement2Id = upsertAgreement(
            lender.id,
            borrower.id,
            'Lenny Lender',
            BORROWER_EMAIL,
            'Bob',
            250000, // €2,500
            'Demo loan 2 with history'
        );

        // Add past payments to Agreement 2 (Scenario D)
        console.log('\nAdding payment history...\n');
        upsertPayment(agreement2Id, lender.id, borrower.id, 50000, '2023-01-15', 'settled');
        upsertPayment(agreement2Id, lender.id, borrower.id, 50000, '2023-02-15', 'settled');

        // Add pending payment to Agreement 2 (Scenario C)
        console.log('\nAdding pending payment...\n');
        upsertPayment(agreement2Id, lender.id, borrower.id, 50000, new Date().toISOString().split('T')[0], 'pending');

        console.log('\n=== Demo Data Ready ===\n');
        console.log('Test Users:');
        console.log(`  Lender:   ${LENDER_EMAIL} / ${PASSWORD}`);
        console.log(`  Borrower: ${BORROWER_EMAIL} / ${PASSWORD}`);
        console.log('\nActive Agreements:');
        console.log(`  ID: ${agreement1Id} (Standard)`);
        console.log(`  ID: ${agreement2Id} (With history & pending task)`);
        console.log(`  View at: http://localhost:3000/agreements/${agreement1Id}/manage`);
        console.log('\nYou can now:');
        console.log('  1. Run: npm run dev');
        console.log('  2. Login as borrower@test.dev');
        console.log('  3. Test "Report a payment" from dashboard');
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
