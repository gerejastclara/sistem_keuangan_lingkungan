/**
 * Seed all DAFU Parishioners data to Supabase Cloud Database.
 * Converts raw JSON entries into deterministic UUID rows.
 * Batch inserts into:
 *  1. kepala_keluarga
 *  2. anggota_keluarga
 *  3. golongan_keluarga
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vjcchxutoohmscyvwczq.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_eDmMjqjyjbYFq0dgNUEe5A_xteHOq-D';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function toDeterministicUuid(namespace, value) {
  const hash = crypto.createHash('sha1').update(`${namespace}:${value}`).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '5' + hash.substring(13, 16),
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + hash.substring(18, 20),
    hash.substring(20, 32)
  ].join('-');
}

async function run() {
  console.log('--- STARTING DAFU SEED TO SUPABASE CLOUD ---');
  
  // 1. Load Lingkungan mapping from Supabase
  console.log('Fetching master Lingkungan from Supabase...');
  const { data: dbLingkungan, error: lingErr } = await supabase.from('lingkungan').select('id, nama_lingkungan');
  if (lingErr || !dbLingkungan) {
    console.error('Error fetching lingkungan:', lingErr);
    process.exit(1);
  }
  
  const normMap = new Map();
  dbLingkungan.forEach(l => {
    const norm = l.nama_lingkungan.toLowerCase().replace(/[^a-z0-9]/g, '');
    normMap.set(norm, l.id);
  });
  console.log(`Loaded ${dbLingkungan.length} Lingkungan from Supabase.`);

  // 2. Read santaClaraUmat.json
  const dataPath = path.resolve(__dirname, '../src/data/santaClaraUmat.json');
  if (!fs.existsSync(dataPath)) {
    console.error('santaClaraUmat.json not found at:', dataPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(dataPath, 'utf8');
  const data = JSON.parse(raw);
  console.log(`Loaded source dataset: ${data.totalFamilies} KK, ${data.totalMembers} Jiwa`);

  // 3. Prepare all rows
  const kkRows = [];
  const anggotaRows = [];
  const golonganRows = [];

  const kkKeys = Object.keys(data.kksByLingkungan);
  let totalKkCount = 0;

  for (const lKey of kkKeys) {
    const kks = data.kksByLingkungan[lKey];
    for (const kk of kks) {
      totalKkCount++;
      const lNorm = (kk.nama_lingkungan || lKey).toLowerCase().replace(/[^a-z0-9]/g, '');
      const dbLingId = normMap.get(lNorm) || 'da1b6d3b-db10-48cc-8159-b211dffc3c22'; // fallback Padre Pio 1 if unmapped
      
      const kkUuid = toDeterministicUuid('kk', kk.id);

      kkRows.push({
        id: kkUuid,
        lingkungan_id: dbLingId,
        nama_kk: kk.nama_kk,
        alamat: kk.alamat || null,
        telepon: kk.telepon || null,
        is_biduk: kk.is_biduk !== false
      });

      // Prepare Anggota
      const members = data.anggotaMap[kk.id] || [];
      members.forEach((m, mIdx) => {
        const memUuid = toDeterministicUuid('mem', m.id || `${kk.id}_${mIdx}`);
        anggotaRows.push({
          id: memUuid,
          kk_id: kkUuid,
          nama: m.nama,
          peran: m.peran || 'Anggota',
          is_kaj: m.is_kaj !== false,
          keterangan: m.keterangan || null
        });
      });

      // Prepare Golongan
      const gol = data.golonganMap[kk.id];
      const golUuid = toDeterministicUuid('gol', (gol && gol.id) || kk.id);
      golonganRows.push({
        id: golUuid,
        kk_id: kkUuid,
        lingkungan_id: dbLingId,
        golongan: (gol && gol.golongan) || 'Sejahtera',
        kriteria_catatan: (gol && gol.kriteria_catatan) || 'Keluarga Sejahtera',
        updated_by_role: 'SEKRETARIS'
      });
    }
  }

  console.log(`Prepared rows: ${kkRows.length} KK, ${anggotaRows.length} Anggota, ${golonganRows.length} Golongan`);

  // 4. Batch Insert KEPALA_KELUARGA
  console.log('Inserting KEPALA_KELUARGA...');
  const BATCH_SIZE = 100;
  for (let i = 0; i < kkRows.length; i += BATCH_SIZE) {
    const batch = kkRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('kepala_keluarga').upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error(`Error inserting KK batch ${i} - ${i + batch.length}:`, error);
      process.exit(1);
    }
    process.stdout.write(`KK inserted: ${Math.min(i + BATCH_SIZE, kkRows.length)} / ${kkRows.length}\r`);
  }
  console.log(`\nSuccessfully inserted all ${kkRows.length} KEPALA_KELUARGA.`);

  // 5. Batch Insert ANGGOTA_KELUARGA
  console.log('Inserting ANGGOTA_KELUARGA...');
  for (let i = 0; i < anggotaRows.length; i += BATCH_SIZE) {
    const batch = anggotaRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('anggota_keluarga').upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error(`Error inserting Anggota batch ${i} - ${i + batch.length}:`, error);
      process.exit(1);
    }
    process.stdout.write(`Anggota inserted: ${Math.min(i + BATCH_SIZE, anggotaRows.length)} / ${anggotaRows.length}\r`);
  }
  console.log(`\nSuccessfully inserted all ${anggotaRows.length} ANGGOTA_KELUARGA.`);

  // 6. Batch Insert GOLONGAN_KELUARGA
  console.log('Inserting GOLONGAN_KELUARGA...');
  for (let i = 0; i < golonganRows.length; i += BATCH_SIZE) {
    const batch = golonganRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('golongan_keluarga').upsert(batch, { onConflict: 'kk_id' });
    if (error) {
      console.error(`Error inserting Golongan batch ${i} - ${i + batch.length}:`, error);
      process.exit(1);
    }
    process.stdout.write(`Golongan inserted: ${Math.min(i + BATCH_SIZE, golonganRows.length)} / ${golonganRows.length}\r`);
  }
  console.log(`\nSuccessfully inserted all ${golonganRows.length} GOLONGAN_KELUARGA.`);

  console.log('--- SEEDING COMPLETED SUCCESSFULLY! ---');
}

run().catch(err => {
  console.error('Fatal error during seeding:', err);
  process.exit(1);
});
