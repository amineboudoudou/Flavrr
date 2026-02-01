#!/usr/bin/env node

/**
 * Apply the RLS recursion fix migration to Supabase
 * This script reads the migration file and executes it using the Supabase client
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing environment variables!');
    console.error('Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    console.error('\nPlease add SUPABASE_SERVICE_ROLE_KEY to your .env.local file');
    console.error('You can find it in: Supabase Dashboard → Settings → API → service_role key');
    process.exit(1);
}

console.log('🔧 Applying RLS recursion fix migration...\n');

// Read the migration file
const migrationPath = join(__dirname, 'supabase', 'migrations', '013_fix_rls_recursion.sql');
const migrationSQL = readFileSync(migrationPath, 'utf-8');

console.log('📄 Migration SQL:');
console.log('─'.repeat(80));
console.log(migrationSQL);
console.log('─'.repeat(80));
console.log('');

// Create Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Execute the migration
async function applyMigration() {
    try {
        console.log('⚙️  Executing migration...');

        const { data, error } = await supabase.rpc('exec_sql', {
            sql: migrationSQL
        });

        if (error) {
            // If exec_sql RPC doesn't exist, try direct execution
            console.log('⚠️  exec_sql RPC not found, trying alternative method...');

            // Split SQL into individual statements
            const statements = migrationSQL
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--'));

            for (const statement of statements) {
                console.log(`\n📝 Executing: ${statement.substring(0, 60)}...`);

                const { error: stmtError } = await supabase.rpc('exec', {
                    query: statement
                });

                if (stmtError) {
                    console.error('❌ Error executing statement:', stmtError);
                    throw stmtError;
                }
            }
        }

        console.log('\n✅ Migration applied successfully!');
        console.log('\n📋 Next steps:');
        console.log('1. Hard refresh your browser (Cmd+Shift+R)');
        console.log('2. Clear browser storage if needed');
        console.log('3. Log in to the Owner Portal again');
        console.log('4. Check console logs for successful profile load');

    } catch (error) {
        console.error('\n❌ Failed to apply migration:', error);
        console.error('\n💡 Alternative: Apply manually via Supabase Dashboard');
        console.error('1. Go to: https://supabase.com/dashboard/project/lcgckjfhlvuxnnjylzvk/sql');
        console.error('2. Copy the SQL from: supabase/migrations/013_fix_rls_recursion.sql');
        console.error('3. Paste and click "Run"');
        process.exit(1);
    }
}

applyMigration();
