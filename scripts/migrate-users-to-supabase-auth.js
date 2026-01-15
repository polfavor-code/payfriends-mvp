#!/usr/bin/env node

/**
 * Migrate Users to Supabase Auth
 * 
 * This script creates Supabase Auth users for existing users in the database.
 * Since we cannot migrate bcrypt password hashes directly, users will need to
 * use password reset or magic link for their first login.
 * 
 * Usage:
 *   node scripts/migrate-users-to-supabase-auth.js
 * 
 * Options:
 *   --dry-run    Preview migration without making changes
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// Parse arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

// Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Supabase credentials not configured');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Statistics
const stats = {
  total: 0,
  created: 0,
  skipped: 0,
  errors: [],
};

async function migrateUsers() {
  console.log('\n========================================');
  console.log('  Migrate Users to Supabase Auth');
  console.log('========================================\n');

  if (DRY_RUN) {
    console.log('[DRY RUN] No changes will be made\n');
  }

  // Get all users from public.users table
  const { data: users, error: fetchError } = await supabase
    .from('users')
    .select('id, email, full_name')
    .is('auth_id', null) // Only users without auth_id
    .order('id');

  if (fetchError) {
    console.error('Error fetching users:', fetchError.message);
    process.exit(1);
  }

  stats.total = users?.length || 0;
  console.log(`Found ${stats.total} users to migrate\n`);

  if (!users || users.length === 0) {
    console.log('No users to migrate.');
    return;
  }

  for (const user of users) {
    console.log(`Processing user ${user.id}: ${user.email}`);

    if (DRY_RUN) {
      stats.created++;
      console.log(`  [DRY RUN] Would create auth user`);
      continue;
    }

    try {
      // Check if auth user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingAuthUser = existingUsers?.users?.find(
        u => u.email?.toLowerCase() === user.email.toLowerCase()
      );

      if (existingAuthUser) {
        // Link existing auth user
        const { error: updateError } = await supabase
          .from('users')
          .update({ auth_id: existingAuthUser.id })
          .eq('id', user.id);

        if (updateError) {
          throw updateError;
        }

        console.log(`  Linked to existing auth user: ${existingAuthUser.id}`);
        stats.skipped++;
        continue;
      }

      // Create new auth user
      // Generate a random password - user will need to reset it
      const tempPassword = generateSecurePassword();

      const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: tempPassword,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: user.full_name,
          migrated_from_sqlite: true,
          original_user_id: user.id,
        },
      });

      if (createError) {
        throw createError;
      }

      // Update public.users with auth_id
      const { error: updateError } = await supabase
        .from('users')
        .update({ auth_id: authUser.user.id })
        .eq('id', user.id);

      if (updateError) {
        console.error(`  Warning: Failed to link auth_id: ${updateError.message}`);
      }

      console.log(`  Created auth user: ${authUser.user.id}`);
      stats.created++;

    } catch (err) {
      console.error(`  Error: ${err.message}`);
      stats.errors.push({ userId: user.id, email: user.email, error: err.message });
    }
  }

  // Print summary
  console.log('\n========================================');
  console.log('  Migration Summary');
  console.log('========================================\n');
  console.log(`Total users: ${stats.total}`);
  console.log(`Created: ${stats.created}`);
  console.log(`Skipped (already linked): ${stats.skipped}`);
  console.log(`Errors: ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    stats.errors.forEach((e, i) => {
      console.log(`  ${i + 1}. User ${e.userId} (${e.email}): ${e.error}`);
    });
  }

  console.log('\n========================================');
  console.log('  IMPORTANT: User Password Reset');
  console.log('========================================\n');
  console.log('Migrated users have temporary passwords.');
  console.log('They will need to use "Forgot Password" or magic link to log in.\n');
  console.log('To send password reset emails, run:');
  console.log('  node scripts/send-password-reset-emails.js\n');
}

function generateSecurePassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 32; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

migrateUsers().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
