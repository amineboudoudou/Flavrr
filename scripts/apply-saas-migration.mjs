#!/usr/bin/env node

/**
 * Apply SaaS Multi-Tenant Migration
 * 
 * This script applies the workspaces and workspace_memberships migration
 * to your Supabase database.
 * 
 * Usage:
 *   node scripts/apply-saas-migration.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables:');
    console.error('   VITE_SUPABASE_URL');
    console.error('   SUPABASE_SERVICE_ROLE_KEY');
    console.error('\nMake sure these are set in your .env.local file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function applyMigration() {
    console.log('🚀 Starting SaaS Multi-Tenant Migration...\n');

    try {
        // Read migration file
        const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20260129000001_create_workspaces_and_memberships.sql');
        const migrationSQL = readFileSync(migrationPath, 'utf8');

        console.log('📄 Migration file loaded');
        console.log('📊 Executing SQL...\n');

        // Execute migration
        const { data, error } = await supabase.rpc('exec_sql', {
            sql: migrationSQL
        });

        if (error) {
            // If exec_sql doesn't exist, try direct execution
            if (error.message?.includes('function') && error.message?.includes('does not exist')) {
                console.log('⚠️  exec_sql function not found, trying direct execution...\n');
                
                // Split migration into individual statements
                const statements = migrationSQL
                    .split(';')
                    .map(s => s.trim())
                    .filter(s => s.length > 0 && !s.startsWith('--'));

                for (let i = 0; i < statements.length; i++) {
                    const statement = statements[i];
                    console.log(`Executing statement ${i + 1}/${statements.length}...`);
                    
                    const { error: stmtError } = await supabase.rpc('exec', {
                        query: statement + ';'
                    });

                    if (stmtError) {
                        console.error(`❌ Error in statement ${i + 1}:`, stmtError.message);
                        throw stmtError;
                    }
                }
            } else {
                throw error;
            }
        }

        console.log('\n✅ Migration applied successfully!\n');
        console.log('📋 Created tables:');
        console.log('   - workspaces');
        console.log('   - workspace_memberships');
        console.log('\n🔒 RLS policies enabled');
        console.log('🔧 Helper functions created\n');

        // Verify tables exist
        const { data: tables, error: tablesError } = await supabase
            .from('workspaces')
            .select('count')
            .limit(0);

        if (!tablesError) {
            console.log('✅ Verification: workspaces table accessible');
        }

        const { data: memberships, error: membershipsError } = await supabase
            .from('workspace_memberships')
            .select('count')
            .limit(0);

        if (!membershipsError) {
            console.log('✅ Verification: workspace_memberships table accessible');
        }

        console.log('\n🎉 Migration complete! Your database is now multi-tenant ready.\n');
        console.log('Next steps:');
        console.log('1. Restart your dev server: npm run dev');
        console.log('2. Sign up for a new account');
        console.log('3. Create your first workspace');
        console.log('4. Start building!\n');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('\nFull error:', error);
        process.exit(1);
    }
}

applyMigration();
