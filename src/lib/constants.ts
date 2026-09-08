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

export function getAllMasterLingkungan(): Array<{ id: string; nama_lingkungan: string; slug: string }> {
  return MASTER_LINGKUNGAN_LIST.map((name) => {
    const slug = getLingkunganSlug(name);
    return {
      id: `csv-${slug}`,
      nama_lingkungan: name,
      slug,
    };
  });
}

export function findLingkunganByQuery(query: string): { id: string; nama_lingkungan: string } | null {
  if (!query) return null;
  const cleanQ = query.toLowerCase().replace(/[^a-z0-9]/g, '');

  const all = getAllMasterLingkungan();
  
  // 1. Exact slug match or clean match
  const exact = all.find(
    (l) =>
      l.slug === query.toLowerCase() ||
      l.nama_lingkungan.toLowerCase() === query.toLowerCase() ||
      l.nama_lingkungan.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanQ
  );
  if (exact) return { id: exact.id, nama_lingkungan: exact.nama_lingkungan };

  // 2. Special aliases (e.g. pedro -> Padre Pio, petrus -> St. Petrus)
  if (cleanQ.includes('pedro') || cleanQ.includes('padrepio')) {
    const num = cleanQ.match(/\d+/)?.[0] || '1';
    const matched = all.find((l) => l.nama_lingkungan.toLowerCase().includes('padre pio') && l.nama_lingkungan.includes(num))
      || all.find((l) => l.nama_lingkungan.toLowerCase().includes('padre pio'));
    if (matched) return { id: matched.id, nama_lingkungan: matched.nama_lingkungan };
  }

  // 3. Partial matching
  const partial = all.find((l) => {
    const cleanName = l.nama_lingkungan.toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleanName.includes(cleanQ) || cleanQ.includes(cleanName);
  });
  if (partial) return { id: partial.id, nama_lingkungan: partial.nama_lingkungan };

  return null;
}
