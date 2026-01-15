#!/usr/bin/env node
/**
 * Run Supabase migrations using the Supabase client
 * This uses the service role key to execute SQL
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

async function runMigrations() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('Connecting to Supabase:', supabaseUrl);
  
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  // Get migration files in order
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`\nFound ${files.length} migration files:\n`);
  files.forEach(f => console.log(`  - ${f}`));
  console.log('');

  // Run each migration
  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    let sql = fs.readFileSync(filePath, 'utf8');
    
    console.log(`Running: ${file}...`);
    
    try {
      // Split into individual statements for better error handling
      // Remove comments and split on semicolons
      const statements = sql
        .split(/;(?=(?:[^']*'[^']*')*[^']*$)/)  // Split on ; not inside quotes
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        if (statement.length < 10) continue; // Skip tiny fragments
        
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
        
        if (error) {
          // Try direct query if rpc doesn't exist
          if (error.message.includes('function') && error.message.includes('does not exist')) {
            throw new Error('Need to use direct database connection. See instructions below.');
          }
          
          if (error.message.includes('already exists') || 
              error.message.includes('duplicate')) {
            // Skip - already applied
            continue;
          }
          throw error;
        }
      }
      console.log(`  OK\n`);
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        console.log(`  SKIPPED (already applied)\n`);
      } else {
        console.error(`  FAILED: ${err.message}\n`);
        
        if (err.message.includes('direct database connection')) {
          console.log('\n==========================================');
          console.log('MANUAL STEPS REQUIRED:');
          console.log('==========================================\n');
          console.log('1. Go to your Supabase Dashboard');
          console.log('2. Navigate to: SQL Editor');
          console.log('3. Copy and paste each migration file content');
          console.log('4. Run them in order:\n');
          files.forEach((f, i) => console.log(`   ${i+1}. ${f}`));
          console.log('\nMigration files are in: supabase/migrations/');
        }
        process.exit(1);
      }
    }
  }

  console.log('All migrations completed successfully!');
}

runMigrations();
