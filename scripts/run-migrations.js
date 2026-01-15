#!/usr/bin/env node
/**
 * Run Supabase migrations against cloud database
 * Usage: node scripts/run-migrations.js
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL not found in .env.local');
    process.exit(1);
  }

  console.log('Connecting to database...');
  
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected successfully!\n');

    // Get migration files in order
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration files:\n`);
    files.forEach(f => console.log(`  - ${f}`));
    console.log('');

    // Run each migration
    for (const file of files) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      console.log(`Running: ${file}...`);
      
      try {
        await client.query(sql);
        console.log(`  OK\n`);
      } catch (err) {
        // Check if it's a "already exists" error (idempotent)
        if (err.message.includes('already exists') || 
            err.message.includes('duplicate key')) {
          console.log(`  SKIPPED (already applied)\n`);
        } else {
          console.error(`  FAILED: ${err.message}\n`);
          throw err;
        }
      }
    }

    console.log('All migrations completed successfully!');

  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
