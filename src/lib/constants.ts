export const MASTER_LINGKUNGAN_LIST = [
  'St. Agnes 1',
  'St. Agnes 2',
  'St. Agnes 3',
  'St. Agnes 4',
  'St. Agnes 5',
  'St. Antonius 1',
  'St. Antonius 2',
  'St. Antonius 3',
  'St. Antonius 4',
  'St. Antonius 5',
  'St. Antonius 6',
  'St. Bonaventura 1',
  'St. Bonaventura 2',
  'St. Bonaventura 3',
  'St. Bonaventura 4',
  'St. Bonaventura 5',
  'St. Bonaventura 6',
  'St. Bunda Teresa 1',
  'St. Bunda Teresa 2',
  'St. Bunda Teresa 3',
  'St. Bunda Teresa 4',
  'St. Bunda Teresa 5',
  'St. Bunda Teresa 6',
  'St. Catarina 1',
  'St. Catarina 2',
  'St. Catarina 3',
  'St. Catarina 4',
  'St. Fidelis 1',
  'St. Fidelis 2',
  'St. Fidelis 3',
  'St. Fidelis 4',
  'St. Fidelis 5',
  'St. Konradus 1',
  'St. Konradus 2',
  'St. Konradus 3',
  'St. Konradus 4',
  'St. Konradus 5',
  'St. Konradus 6',
  'St. Laurentius 1',
  'St. Laurentius 2',
  'St. Laurentius 3',
  'Padre Pio 1',
  'Padre Pio 2',
  'Padre Pio 3',
  'Padre Pio 4',
  'St. Paulus 1',
  'St. Paulus 2',
  'St. Paulus 3',
  'St. Paulus 4',
  'St. Paulus 5',
  'St. Petrus 1',
  'St. Petrus 2',
  'St. Petrus 3',
  'St. Petrus 4',
  'St. Petrus 5',
  'St. Petrus 6',
  'St. Petrus 7',
  'St. Petrus 8',
  'St. Thomas Aquinas 1',
  'St. Thomas Aquinas 2',
  'St. Thomas Aquinas 3',
  'St. Thomas Aquinas 4',
  'St. Thomas Aquinas 5',
  'St. Thomas Aquinas 6',
  'St. Yohannes Pemandi 1',
  'St. Yohannes Pemandi 2',
  'St. Yohannes Pemandi 3',
  'St. Yohannes Pemandi 4',
  'St. Yohannes Pemandi 5',
] as const;

export const MASTER_WILAYAH_LIST = [
  'AGNES',
  'ANTONIUS',
  'BONAVENTURA',
  'BUNDA TERESA',
  'CATERINA da SIENA',
  'FIDELIS',
  'KONRADUS',
  'LAURENTIUS da BRINDISI',
  'PADRE PIO',
  'PAULUS',
  'PETRUS',
  'THOMAS AQUINO',
  'YOHANES PEMANDI'
] as const;

export const WILAYAH_LINGKUNGAN_MAP: Record<string, string[]> = {
  'AGNES': ['St. Agnes 1', 'St. Agnes 2', 'St. Agnes 3', 'St. Agnes 4', 'St. Agnes 5'],
  'ANTONIUS': ['St. Antonius 1', 'St. Antonius 2', 'St. Antonius 3', 'St. Antonius 4', 'St. Antonius 5', 'St. Antonius 6'],
  'BONAVENTURA': ['St. Bonaventura 1', 'St. Bonaventura 2', 'St. Bonaventura 3', 'St. Bonaventura 4', 'St. Bonaventura 5', 'St. Bonaventura 6'],
  'BUNDA TERESA': ['St. Bunda Teresa 1', 'St. Bunda Teresa 2', 'St. Bunda Teresa 3', 'St. Bunda Teresa 4', 'St. Bunda Teresa 5', 'St. Bunda Teresa 6'],
  'CATERINA da SIENA': ['St. Catarina 1', 'St. Catarina 2', 'St. Catarina 3', 'St. Catarina 4'],
  'FIDELIS': ['St. Fidelis 1', 'St. Fidelis 2', 'St. Fidelis 3', 'St. Fidelis 4', 'St. Fidelis 5'],
  'KONRADUS': ['St. Konradus 1', 'St. Konradus 2', 'St. Konradus 3', 'St. Konradus 4', 'St. Konradus 5', 'St. Konradus 6'],
  'LAURENTIUS da BRINDISI': ['St. Laurentius 1', 'St. Laurentius 2', 'St. Laurentius 3'],
  'PADRE PIO': ['Padre Pio 1', 'Padre Pio 2', 'Padre Pio 3', 'Padre Pio 4'],
  'PAULUS': ['St. Paulus 1', 'St. Paulus 2', 'St. Paulus 3', 'St. Paulus 4', 'St. Paulus 5'],
  'PETRUS': ['St. Petrus 1', 'St. Petrus 2', 'St. Petrus 3', 'St. Petrus 4', 'St. Petrus 5', 'St. Petrus 6', 'St. Petrus 7', 'St. Petrus 8'],
  'THOMAS AQUINO': ['St. Thomas Aquinas 1', 'St. Thomas Aquinas 2', 'St. Thomas Aquinas 3', 'St. Thomas Aquinas 4', 'St. Thomas Aquinas 5', 'St. Thomas Aquinas 6'],
  'YOHANES PEMANDI': ['St. Yohannes Pemandi 1', 'St. Yohannes Pemandi 2', 'St. Yohannes Pemandi 3', 'St. Yohannes Pemandi 4', 'St. Yohannes Pemandi 5']
};

export function getWilayahList(): string[] {
  return [...MASTER_WILAYAH_LIST];
}

export function getWilayahForLingkungan(namaOrId: string): string {
  if (!namaOrId) return 'Santa Clara';
  const clean = namaOrId
    .toLowerCase()
    .replace(/^csv-/, '')
    .replace(/^st-?/i, '')
    .replace(/yohan+es/gi, 'yohanes')
    .replace(/[^a-z0-9]/g, '');

  for (const [wil, lings] of Object.entries(WILAYAH_LINGKUNGAN_MAP)) {
    const wilClean = wil.toLowerCase().replace(/yohan+es/gi, 'yohanes').replace(/[^a-z0-9]/g, '');
    if (clean.includes(wilClean) || wilClean.includes(clean.replace(/\d+/g, ''))) {
      return wil;
    }
    for (const l of lings) {
      const lClean = l.toLowerCase().replace(/^st\.\s*/i, '').replace(/yohan+es/gi, 'yohanes').replace(/[^a-z0-9]/g, '');
      if (clean === lClean || clean.includes(lClean) || lClean.includes(clean)) {
        return wil;
      }
    }
  }
  return 'Santa Clara';
}

export function formatNamaLingkungan(nama: string): string {
  if (!nama) return '';
  const trimmed = nama.trim();
  if (trimmed.toLowerCase().startsWith('lingkungan')) {
    return trimmed;
  }
  return `Lingkungan ${trimmed}`;
}

export function getLingkunganSlug(nama: string): string {
  if (!nama) return '';
  return nama
    .toLowerCase()
    .replace(/^lingkungan\s+/i, '')
    .replace(/st\.\s*/gi, 'st-')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export const MASTER_LINGKUNGAN_UUID_MAP: Record<string, string> = {
  "St. Agnes 1": "61676e65-7331-4000-a000-000000000000",
  "St. Agnes 2": "61676e65-7332-4000-a000-000000000000",
  "St. Agnes 3": "61676e65-7333-4000-a000-000000000000",
  "St. Agnes 4": "61676e65-7334-4000-a000-000000000000",
  "St. Agnes 5": "61676e65-7335-4000-a000-000000000000",
  "St. Antonius 1": "616e746f-6e69-4573-a100-000000000000",
  "St. Antonius 2": "616e746f-6e69-4573-a200-000000000000",
  "St. Antonius 3": "616e746f-6e69-4573-a300-000000000000",
  "St. Antonius 4": "616e746f-6e69-4573-a400-000000000000",
  "St. Antonius 5": "616e746f-6e69-4573-a500-000000000000",
  "St. Antonius 6": "616e746f-6e69-4573-a600-000000000000",
  "St. Bonaventura 1": "626f6e61-7665-4e74-a572-613100000000",
  "St. Bonaventura 2": "626f6e61-7665-4e74-a572-613200000000",
  "St. Bonaventura 3": "626f6e61-7665-4e74-a572-613300000000",
  "St. Bonaventura 4": "626f6e61-7665-4e74-a572-613400000000",
  "St. Bonaventura 5": "626f6e61-7665-4e74-a572-613500000000",
  "St. Bonaventura 6": "626f6e61-7665-4e74-a572-613600000000",
  "St. Bunda Teresa 1": "62756e64-6174-4572-a573-613100000000",
  "St. Bunda Teresa 2": "62756e64-6174-4572-a573-613200000000",
  "St. Bunda Teresa 3": "62756e64-6174-4572-a573-613300000000",
  "St. Bunda Teresa 4": "62756e64-6174-4572-a573-613400000000",
  "St. Bunda Teresa 5": "62756e64-6174-4572-a573-613500000000",
  "St. Bunda Teresa 6": "62756e64-6174-4572-a573-613600000000",
  "St. Catarina 1": "63617465-7269-4e61-a100-000000000000",
  "St. Catarina 2": "63617465-7269-4e61-a200-000000000000",
  "St. Catarina 3": "63617465-7269-4e61-a300-000000000000",
  "St. Catarina 4": "63617465-7269-4e61-a400-000000000000",
  "St. Fidelis 1": "66696465-6c69-4331-a000-000000000000",
  "St. Fidelis 2": "66696465-6c69-4332-a000-000000000000",
  "St. Fidelis 3": "66696465-6c69-4333-a000-000000000000",
  "St. Fidelis 4": "66696465-6c69-4334-a000-000000000000",
  "St. Fidelis 5": "66696465-6c69-4335-a000-000000000000",
  "St. Konradus 1": "6b6f6e72-6164-4573-a100-000000000000",
  "St. Konradus 2": "6b6f6e72-6164-4573-a200-000000000000",
  "St. Konradus 3": "6b6f6e72-6164-4573-a300-000000000000",
  "St. Konradus 4": "6b6f6e72-6164-4573-a400-000000000000",
  "St. Konradus 5": "6b6f6e72-6164-4573-a500-000000000000",
  "St. Konradus 6": "6b6f6e72-6164-4573-a600-000000000000",
  "St. Laurentius 1": "6c617572-656e-4469-a573-310000000000",
  "St. Laurentius 2": "6c617572-656e-4469-a573-320000000000",
  "St. Laurentius 3": "6c617572-656e-4469-a573-330000000000",
  "Padre Pio 1": "70616472-6570-496f-a100-000000000000",
  "Padre Pio 2": "70616472-6570-496f-a200-000000000000",
  "Padre Pio 3": "70616472-6570-496f-a300-000000000000",
  "Padre Pio 4": "70616472-6570-496f-a400-000000000000",
  "St. Paulus 1": "7061756c-7573-4100-a000-000000000000",
  "St. Paulus 2": "7061756c-7573-4200-a000-000000000000",
  "St. Paulus 3": "7061756c-7573-4300-a000-000000000000",
  "St. Paulus 4": "7061756c-7573-4400-a000-000000000000",
  "St. Paulus 5": "7061756c-7573-4500-a000-000000000000",
  "St. Petrus 1": "70657472-7573-4100-a000-000000000000",
  "St. Petrus 2": "70657472-7573-4200-a000-000000000000",
  "St. Petrus 3": "70657472-7573-4300-a000-000000000000",
  "St. Petrus 4": "70657472-7573-4400-a000-000000000000",
  "St. Petrus 5": "70657472-7573-4500-a000-000000000000",
  "St. Petrus 6": "70657472-7573-4600-a000-000000000000",
  "St. Petrus 7": "70657472-7573-4700-a000-000000000000",
  "St. Petrus 8": "70657472-7573-4800-a000-000000000000",
  "St. Thomas Aquinas 1": "74686f6d-6173-4171-a569-6e6f31000000",
  "St. Thomas Aquinas 2": "74686f6d-6173-4171-a569-6e6f32000000",
  "St. Thomas Aquinas 3": "74686f6d-6173-4171-a569-6e6f33000000",
  "St. Thomas Aquinas 4": "74686f6d-6173-4171-a569-6e6f34000000",
  "St. Thomas Aquinas 5": "74686f6d-6173-4171-a569-6e6f35000000",
  "St. Thomas Aquinas 6": "74686f6d-6173-4171-a569-6e6f36000000",
  "St. Yohannes Pemandi 1": "796f6861-6e65-4370-a56d-616e64693100",
  "St. Yohannes Pemandi 2": "796f6861-6e65-4370-a56d-616e64693200",
  "St. Yohannes Pemandi 3": "796f6861-6e65-4370-a56d-616e64693300",
  "St. Yohannes Pemandi 4": "796f6861-6e65-4370-a56d-616e64693400",
  "St. Yohannes Pemandi 5": "796f6861-6e65-4370-a56d-616e64693500"
};

export function getLingkunganDbUuid(val?: string | null): string {
  if (!val) return "70616472-6570-496f-a100-000000000000";
  const trimmed = val.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed;
  }
  if (MASTER_LINGKUNGAN_UUID_MAP[trimmed]) {
    return MASTER_LINGKUNGAN_UUID_MAP[trimmed];
  }
  const cleanQ = trimmed.toLowerCase().replace(/^(csv-|lingkungan\s+)/i, '').replace(/[^a-z0-9]/g, '');
  for (const [name, uuid] of Object.entries(MASTER_LINGKUNGAN_UUID_MAP)) {
    const cleanName = name.toLowerCase().replace(/^st\.\s*/i, '').replace(/[^a-z0-9]/g, '');
    const cleanWithSt = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanName === cleanQ || cleanWithSt === cleanQ) {
      return uuid;
    }
  }
  return "70616472-6570-496f-a100-000000000000";
}

export function getAllMasterLingkungan(): Array<{ id: string; nama_lingkungan: string; slug: string; wilayah: string; csv_id: string }> {
  return MASTER_LINGKUNGAN_LIST.map((name) => {
    const slug = getLingkunganSlug(name);
    const uuid = MASTER_LINGKUNGAN_UUID_MAP[name] || getLingkunganDbUuid(name);
    return {
      id: uuid,
      nama_lingkungan: name,
      slug,
      csv_id: `csv-${slug}`,
      wilayah: getWilayahForLingkungan(name)
    };
  });
}

export function findLingkunganByQuery(query: string): { id: string; nama_lingkungan: string } | null {
  if (!query) return null;
  let decoded = query;
  try {
    decoded = decodeURIComponent(query);
  } catch (e) {}

  const rawQ = decoded
    .toLowerCase()
    .replace(/(?:@|%40).*$/gi, '')
    .trim();

  const cleanQ = rawQ
    .replace(/^(sekretaris|bendahara)[_.\-]?/i, '')
    .replace(/[^a-z0-9]/g, '');

  if (!cleanQ) return null;

  const all = getAllMasterLingkungan();

  // 1. Direct slug or clean name match
  const exact = all.find((l) => {
    const lClean = l.nama_lingkungan.toLowerCase().replace(/[^a-z0-9]/g, '');
    const lCleanWithoutSt = lClean.replace(/^st/i, '');
    const lSlugClean = l.slug.replace(/[^a-z0-9]/g, '');
    return (
      l.slug === cleanQ ||
      lSlugClean === cleanQ ||
      l.nama_lingkungan.toLowerCase() === rawQ ||
      lClean === cleanQ ||
      lCleanWithoutSt === cleanQ ||
      lClean === `st${cleanQ}`
    );
  });
  if (exact) return { id: exact.id, nama_lingkungan: exact.nama_lingkungan };

  // 2. Intelligent Wilayah & Lingkungan Number resolver
  // Handles variances like yohanes/yohannes, pedro/padre pio, thomas/aquinas, teresa, etc.
  const WILAYAH_ALIAS_MAP: Array<{
    match: RegExp;
    prefix: string;
    max: number;
  }> = [
    { match: /(?:yohan+es|pemandi)/i, prefix: 'St. Yohannes Pemandi', max: 5 },
    { match: /(?:thomas|aquinas|aquino)/i, prefix: 'St. Thomas Aquinas', max: 6 },
    { match: /(?:caterin|catarin|siena)/i, prefix: 'St. Catarina', max: 4 },
    { match: /(?:laurent|brindisi)/i, prefix: 'St. Laurentius', max: 3 },
    { match: /(?:padrepio|padre|pio|pedro)/i, prefix: 'Padre Pio', max: 4 },
    { match: /(?:bundateresa|teresa)/i, prefix: 'St. Bunda Teresa', max: 6 },
    { match: /(?:antonius|anto\b)/i, prefix: 'St. Antonius', max: 6 },
    { match: /(?:bonaventura|bona\b)/i, prefix: 'St. Bonaventura', max: 6 },
    { match: /(?:fidelis)/i, prefix: 'St. Fidelis', max: 5 },
    { match: /(?:konradus|konrad)/i, prefix: 'St. Konradus', max: 6 },
    { match: /(?:paulus)/i, prefix: 'St. Paulus', max: 5 },
    { match: /(?:petrus|peter)/i, prefix: 'St. Petrus', max: 8 },
    { match: /(?:agnes)/i, prefix: 'St. Agnes', max: 5 },
  ];

  const queryNumMatch = cleanQ.match(/\d+/);
  const num = queryNumMatch ? parseInt(queryNumMatch[0], 10) : 1;

  for (const alias of WILAYAH_ALIAS_MAP) {
    if (alias.match.test(cleanQ)) {
      const validNum = Math.min(Math.max(num, 1), alias.max);
      const targetName = `${alias.prefix} ${validNum}`;
      const found = all.find((l) => l.nama_lingkungan.toLowerCase() === targetName.toLowerCase());
      if (found) {
        return { id: found.id, nama_lingkungan: found.nama_lingkungan };
      }
    }
  }

  // 3. Fallback partial matching with numbers preserved
  const partial = all.find((l) => {
    const cleanName = l.nama_lingkungan.toLowerCase().replace(/[^a-z0-9]/g, '');
    const nameNum = cleanName.match(/\d+/)?.[0];
    if (queryNumMatch && nameNum && queryNumMatch[0] !== nameNum) {
      return false;
    }
    return cleanName.includes(cleanQ) || cleanQ.includes(cleanName.replace(/\d+/g, ''));
  });
  if (partial) return { id: partial.id, nama_lingkungan: partial.nama_lingkungan };

  return null;
}
