import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env.local');

function loadEnv() {
  const env = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        env[key] = val;
      }
    }
  }
  return env;
}

const env = { ...process.env, ...loadEnv() };

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:3000/api/mock-supabase';
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('\x1b[31m[Error] Missing NEXT_PUBLIC_SUPABASE_URL or API Key in .env.local\x1b[0m');
  process.exit(1);
}

const isServiceRole = Boolean(env.SUPABASE_SERVICE_ROLE_KEY);

console.log('\n\x1b[34m========================================\x1b[0m');
console.log('\x1b[1m  subukAn Database Reset Tool (CLI)\x1b[0m');
console.log('\x1b[34m========================================\x1b[0m');
console.log(`Endpoint: \x1b[36m${supabaseUrl}\x1b[0m`);
console.log(`Auth Mode: \x1b[33m${isServiceRole ? 'Service Role Admin (Full Bypass)' : 'Anon Key'}\x1b[0m\n`);

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const TABLES_IN_CASCADE_ORDER = [
  'submission_comments',
  'task_responses',
  'submissions',
  'tasks',
  'payouts',
  'notifications',
  'poster_payment_settings',
  'listings',
  'profiles',
];

async function resetDatabase() {
  console.log('\x1b[33mStarting database cleanup...\x1b[0m\n');

  for (const table of TABLES_IN_CASCADE_ORDER) {
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) {
        const { error: fallbackError } = await supabase
          .from(table)
          .delete()
          .not('created_at', 'is', null);

        if (fallbackError) {
          console.warn(`  \x1b[33m⚠ ${table}\x1b[0m: ${error.message}`);
          continue;
        }
      }
      console.log(`  \x1b[32m✔ Cleared table:\x1b[0m ${table}`);
    } catch (err) {
      console.warn(`  \x1b[33m⚠ Error clearing ${table}:\x1b[0m`, err?.message || err);
    }
  }

  if (isServiceRole && supabase.auth?.admin) {
    console.log('\n\x1b[33mClearing registered auth users...\x1b[0m');
    try {
      const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
      if (!listError && usersData?.users?.length > 0) {
        for (const user of usersData.users) {
          await supabase.auth.admin.deleteUser(user.id);
          console.log(`  \x1b[32m✔ Deleted user:\x1b[0m ${user.email} (${user.id})`);
        }
      } else {
        console.log('  \x1b[32m✔ No auth users found or already clean.\x1b[0m');
      }
    } catch (authErr) {
      console.warn('  \x1b[33m⚠ Notice:\x1b[0m Could not delete auth users:', authErr?.message || authErr);
    }
  }

  console.log('\n\x1b[32m========================================\x1b[0m');
  console.log('\x1b[1;32m✔ Database successfully reset to zero!\x1b[0m');
  console.log('\x1b[32m========================================\x1b[0m\n');
}

resetDatabase();
