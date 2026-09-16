/**
 * Seed script for Santa Clara Parishioners Data
 * Run with: node seed-santa-clara.js
 * Supports local and cloud Supabase
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('Loading Santa Clara JSON dataset...');
  const dataPath = path.resolve(__dirname, 'src/data/santaClaraUmat.json');
  if (!fs.existsSync(dataPath)) {
    console.error('Data file not found at:', dataPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(dataPath, 'utf8');
  const data = JSON.parse(raw);

  console.log(`Dataset loaded: ${data.totalFamilies} KK, ${data.totalMembers} Jiwa`);
  console.log('Note: The complete SQL migration is ready at: supabase/seed_santa_clara_umat.sql');
}

main();
