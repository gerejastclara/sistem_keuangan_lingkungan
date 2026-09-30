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
  "St. Agnes 1": "eea00d03-96b0-40a0-9465-5eb4e97496c6",
  "St. Agnes 2": "7a12edb0-663f-4abf-9476-33a65215a6cc",
  "St. Agnes 3": "006217f4-ac94-4d36-9f9f-1370ecc17701",
  "St. Agnes 4": "0d706022-f150-4dad-a17c-c24e1f20a3f4",
  "St. Agnes 5": "d273429a-9e62-40e9-bd98-e32fb6ab9f17",
  "St. Antonius 1": "69ed2970-8372-44a6-9cc3-377c522ed916",
  "St. Antonius 2": "06fc7687-0c40-4119-9847-cda7931b779e",
  "St. Antonius 3": "e6515d0f-314d-40dd-ad2b-d1529767bdcc",
  "St. Antonius 4": "04ed939c-bf5d-41d7-b5c8-0d69da9b4578",
  "St. Antonius 5": "6b8dd929-7623-490b-af4c-8f43d10e131b",
  "St. Antonius 6": "685c464a-f8f6-4ec4-9fe5-d2800b8314d3",
  "St. Bonaventura 1": "4bc7682d-5c70-4ded-9eee-053e05bc2a9f",
  "St. Bonaventura 2": "c0963565-66f4-4664-ac66-bf4d189d7fcf",
  "St. Bonaventura 3": "3ae15de0-8736-4437-b056-7592a38cd61e",
  "St. Bonaventura 4": "d9ee403c-ebec-4aa0-945f-28320b4ca1dc",
  "St. Bonaventura 5": "93e20096-9197-46c1-8129-157a68819d6d",
  "St. Bonaventura 6": "92adeea3-df83-4676-9bee-01c26c0a5d55",
  "St. Bunda Teresa 1": "52c3416e-ad2a-49c7-9917-65f1438c6007",
  "St. Bunda Teresa 2": "41872929-189e-4971-8077-4b90074a6e6d",
  "St. Bunda Teresa 3": "7518ffc3-bea9-4ab6-9ad1-292aa7e18e38",
  "St. Bunda Teresa 4": "329b6f39-7108-48cc-b638-e872085cada1",
  "St. Bunda Teresa 5": "0db76cd7-dcaa-4fe1-ac98-193699614953",
  "St. Bunda Teresa 6": "a8f24e57-0f5b-47f6-b464-4b52de9a4394",
  "St. Catarina 1": "78e58e17-5ed2-41a8-a605-4ef75b6f4d76",
  "St. Catarina 2": "05a86a93-74e1-4d9e-b2e6-b2d7b1750466",
  "St. Catarina 3": "c5e69c78-24b0-46ad-b469-aa07a899d69e",
  "St. Catarina 4": "8205c551-ba47-4ac6-94a6-7e6d1e76b593",
  "St. Fidelis 1": "7115177e-8d51-4708-a315-67ef496828df",
  "St. Fidelis 2": "829908a8-57ef-4dfb-a0ca-f210e46da1b3",
  "St. Fidelis 3": "fdeb08d8-9d27-434a-982c-1699218fac9a",
  "St. Fidelis 4": "409689f0-7958-4c33-af19-52c7b44df7b4",
  "St. Fidelis 5": "8866609a-0e1e-4eeb-b7aa-9bd96e2f0cd9",
  "St. Konradus 1": "691e2fe3-7586-4b5f-94d8-0a433bbb650b",
  "St. Konradus 2": "4273cb21-79eb-481f-bde7-9a24aebe9ebe",
  "St. Konradus 3": "56fe4cf1-beb5-4147-b001-0f01b859434b",
  "St. Konradus 4": "af8525ec-5979-4ee7-923e-571c38474ab1",
  "St. Konradus 5": "ef9bcfc4-6093-4324-9036-b8e4ad8d4940",
  "St. Konradus 6": "7ae5fb57-5050-4f26-b543-cd1e60d7c25b",
  "St. Laurentius 1": "d366172d-85ff-4cdf-82fd-ac15185415d3",
  "St. Laurentius 2": "f02ba5e8-0b9e-4d3c-b675-685fa93914d1",
  "St. Laurentius 3": "646c6aff-c12a-43bf-9ee5-4e7d8d157d1a",
  "Padre Pio 1": "da1b6d3b-db10-48cc-8159-b211dffc3c22",
  "Padre Pio 2": "835a6f75-e179-4bf4-b91a-6f130e10f815",
  "Padre Pio 3": "ed386ceb-c994-4fba-a306-2c32a60fe6f3",
  "Padre Pio 4": "4e642d87-c1be-494c-a43e-f7f8a110e56f",
  "St. Paulus 1": "dedc0bf0-82ea-4224-94ce-7c52437baab0",
  "St. Paulus 2": "578f905f-7b94-45ce-bf88-013c9f7a4ce5",
  "St. Paulus 3": "5aa688cd-ee68-4146-8708-82ad170b1b9e",
  "St. Paulus 4": "4cb9c5bb-a1ca-4809-ba13-965a6ae3ace1",
  "St. Paulus 5": "1e7a3c13-5984-4ba6-ad6f-8094f9c9792c",
  "St. Petrus 1": "e18c06c5-01a1-4c64-a106-0f49ee6a273a",
  "St. Petrus 2": "eecc1676-df80-4259-852f-c2eb16eb053e",
  "St. Petrus 3": "892b5714-db56-4681-9625-dc23342759a3",
  "St. Petrus 4": "2db49859-3482-49bb-959d-739d73e6d45d",
  "St. Petrus 5": "af8432f9-a32a-4a9e-ac46-8c04598287c2",
  "St. Petrus 6": "2cc7d802-ac7c-4ea3-abf9-bfc92cf5f086",
  "St. Petrus 7": "eb2da738-f640-4835-8081-a0dee5c0caff",
  "St. Petrus 8": "fb2444be-7094-45df-9ea2-8f7b83ef6f21",
  "St. Thomas Aquinas 1": "5a48369f-f67d-4387-92c1-35d8180f0d2d",
  "St. Thomas Aquinas 2": "70b28f22-0b6f-4a29-9575-7ce620b86b8d",
  "St. Thomas Aquinas 3": "1e7126a2-0c3a-4a0b-990b-53d0919d834e",
  "St. Thomas Aquinas 4": "faf3fc60-1b61-4e9f-8c6c-7edfdb4d06f1",
  "St. Thomas Aquinas 5": "09e3f531-3082-4c65-a33e-b1fe6862563d",
  "St. Thomas Aquinas 6": "b0fb42fc-a621-4219-ab79-f68a46c7d381",
  "St. Yohannes Pemandi 1": "d31c4a08-a3c1-44fb-ba38-b2a87295572d",
  "St. Yohannes Pemandi 2": "828cb5df-7320-45ea-a7ce-f435e34baa26",
  "St. Yohannes Pemandi 3": "65f80752-85d3-477a-8f24-0326e7ea08a9",
  "St. Yohannes Pemandi 4": "63ff8cda-1c6e-4a5d-b627-1d25d9dce80a",
  "St. Yohannes Pemandi 5": "9127df5d-13ba-4adb-bf78-d3d3c37d840e"
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

export function getNamaLingkunganFromAnyIdentifier(val?: string | null): string {
  if (!val || val === 'ALL' || val === 'all') return 'Semua Lingkungan (69 Lingkungan)';
  const trimmed = val.trim();

  // 1. Cek reverse lookup di MASTER_LINGKUNGAN_UUID_MAP
  for (const [name, uuid] of Object.entries(MASTER_LINGKUNGAN_UUID_MAP)) {
    if (uuid.toLowerCase() === trimmed.toLowerCase()) {
      return formatNamaLingkungan(name);
    }
  }

  // 2. Cek di getAllMasterLingkungan()
  const all = getAllMasterLingkungan();
  const found = all.find(
    (m) =>
      m.id.toLowerCase() === trimmed.toLowerCase() ||
      m.slug.toLowerCase() === trimmed.toLowerCase() ||
      m.nama_lingkungan.toLowerCase() === trimmed.toLowerCase() ||
      m.csv_id.toLowerCase() === trimmed.toLowerCase()
  );
  if (found) return formatNamaLingkungan(found.nama_lingkungan);

  // 3. Coba findLingkunganByQuery
  const queried = findLingkunganByQuery(trimmed);
  if (queried) return formatNamaLingkungan(queried.nama_lingkungan);

  return formatNamaLingkungan(trimmed);
}
