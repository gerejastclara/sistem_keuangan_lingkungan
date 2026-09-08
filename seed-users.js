const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  global: { fetch: fetch },
  realtime: { transport: ws }
});

const MASTER_LINGKUNGAN_LIST = [
  'St. Agnes 1', 'St. Agnes 2', 'St. Agnes 3', 'St. Agnes 4', 'St. Agnes 5',
  'St. Antonius 1', 'St. Antonius 2', 'St. Antonius 3', 'St. Antonius 4', 'St. Antonius 5', 'St. Antonius 6',
  'St. Bonaventura 1', 'St. Bonaventura 2', 'St. Bonaventura 3', 'St. Bonaventura 4', 'St. Bonaventura 5', 'St. Bonaventura 6',
  'St. Bunda Teresa 1', 'St. Bunda Teresa 2', 'St. Bunda Teresa 3', 'St. Bunda Teresa 4', 'St. Bunda Teresa 5', 'St. Bunda Teresa 6',
  'St. Catarina 1', 'St. Catarina 2', 'St. Catarina 3', 'St. Catarina 4',
  'St. Fidelis 1', 'St. Fidelis 2', 'St. Fidelis 3', 'St. Fidelis 4', 'St. Fidelis 5',
  'St. Konradus 1', 'St. Konradus 2', 'St. Konradus 3', 'St. Konradus 4', 'St. Konradus 5', 'St. Konradus 6',
  'St. Laurentius 1', 'St. Laurentius 2', 'St. Laurentius 3',
  'Padre Pio 1', 'Padre Pio 2', 'Padre Pio 3', 'Padre Pio 4',
  'St. Paulus 1', 'St. Paulus 2', 'St. Paulus 3', 'St. Paulus 4', 'St. Paulus 5',
  'St. Petrus 1', 'St. Petrus 2', 'St. Petrus 3', 'St. Petrus 4', 'St. Petrus 5', 'St. Petrus 6', 'St. Petrus 7', 'St. Petrus 8',
  'St. Thomas Aquinas 1', 'St. Thomas Aquinas 2', 'St. Thomas Aquinas 3', 'St. Thomas Aquinas 4', 'St. Thomas Aquinas 5', 'St. Thomas Aquinas 6',
  'St. Yohannes Pemandi 1', 'St. Yohannes Pemandi 2', 'St. Yohannes Pemandi 3', 'St. Yohannes Pemandi 4', 'St. Yohannes Pemandi 5'
];

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function seed() {
  console.log('Seeding scoped users for all lingkungan...');

  // 1. Fetch DB Lingkungan if available
  const { data: dbLingkungan } = await supabase.from('lingkungan').select('id, nama_lingkungan');
  const lMap = new Map();
  if (dbLingkungan) {
    dbLingkungan.forEach(l => lMap.set(slugify(l.nama_lingkungan), l.id));
  }

  const usersToCreate = [
    // General Admin / Demo accounts
    { email: 'paroki@example.com', role: 'PAROKI', lingkungan_id: null },
    { email: 'sekretaris@example.com', role: 'SEKRETARIS', lingkungan_id: dbLingkungan?.[0]?.id || 'csv-padre-pio-1' },
    { email: 'bendahara@example.com', role: 'BENDAHARA', lingkungan_id: dbLingkungan?.[0]?.id || 'csv-padre-pio-1' },

    // Special requested accounts (e.g. Pedro / Padre Pio)
    { email: 'sekretaris_pedro@example.com', role: 'SEKRETARIS', lingkungan_id: lMap.get('padrepio1') || 'csv-padre-pio-1' },
    { email: 'bendahara_pedro@example.com', role: 'BENDAHARA', lingkungan_id: lMap.get('padrepio1') || 'csv-padre-pio-1' },
  ];

  // Add accounts for each Lingkungan
  for (const lName of MASTER_LINGKUNGAN_LIST) {
    const s = slugify(lName);
    const lid = lMap.get(s) || `csv-${lName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    usersToCreate.push({
      email: `sekretaris_${s}@example.com`,
      role: 'SEKRETARIS',
      lingkungan_id: lid
    });
    usersToCreate.push({
      email: `bendahara_${s}@example.com`,
      role: 'BENDAHARA',
      lingkungan_id: lid
    });
  }

  console.log(`Total users to ensure: ${usersToCreate.length}`);

  for (const u of usersToCreate) {
    try {
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const existing = users?.find(x => x.email === u.email);
      if (!existing) {
        const { data, error } = await supabase.auth.admin.createUser({
          email: u.email,
          password: 'password123',
          email_confirm: true
        });
        if (data?.user) {
          await supabase.from('users').upsert({
            id: data.user.id,
            email: u.email,
            role: u.role,
            lingkungan_id: u.lingkungan_id
          });
          console.log(`Created user: ${u.email} (${u.role})`);
        }
      }
    } catch (e) {
      // Ignored for offline/mock
    }
  }

  console.log('Seeding completed successfully!');
}

seed();
