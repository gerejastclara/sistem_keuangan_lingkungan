export interface KriteriaGolonganItem {
  id: string;
  nama: string;
  badgeColor: string; // Hex or tailwind color
  bgLight: string;
  borderLight: string;
  textColor: string;
  iconEmoji: string;
  subjudul: string;
  indikator: string;
  contohKondisi: string;
  rekomendasiBantuan: string;
  isDefault?: boolean;
  urutan: number;
}

export const DEFAULT_KRITERIA_GOLONGAN: KriteriaGolonganItem[] = [
  {
    id: 'gol-sejahtera',
    nama: 'Sejahtera',
    badgeColor: '#16a34a',
    bgLight: '#f0fdf4',
    borderLight: '#bbf7d0',
    textColor: '#15803d',
    iconEmoji: '🟢',
    subjudul: 'Keluarga Mandiri / Mampu',
    indikator: 'Memiliki penghasilan tetap di atas UMR, tempat tinggal milik sendiri atau sewa layak, mampu membiayai kebutuhan pokok & pendidikan secara mandiri, serta aktif berkontribusi derma/iuran lingkungan.',
    contohKondisi: 'Karyawan tetap / wirausaha mandiri, tidak memerlukan subsidi sosial lingkungan.',
    rekomendasiBantuan: 'Tidak memerlukan subsidi. Diharapkan menjadi penopang gotong-royong warga.',
    isDefault: true,
    urutan: 1,
  },
  {
    id: 'gol-terduga-prasejahtera',
    nama: 'Terduga Prasejahtera',
    badgeColor: '#eab308',
    bgLight: '#fefce8',
    borderLight: '#fef08a',
    textColor: '#a16207',
    iconEmoji: '🟡',
    subjudul: 'Keluarga Menengah Bawah',
    indikator: 'Memiliki penghasilan pas-pasan (setara/sedikit di bawah UMR) atau tidak menentu, memiliki tanggungan anak sekolah/kuliah lebih dari 2 orang, atau memiliki cicilan mendesak.',
    contohKondisi: 'Pekerja kontrak, wiraswasta kecil, atau keluarga muda dalam penataan ekonomi.',
    rekomendasiBantuan: 'Pemantauan berkala, bantuan insidental saat ada musibah atau kegiatan gereja.',
    isDefault: true,
    urutan: 2,
  },
  {
    id: 'gol-rentan-tidak-mampu',
    nama: 'Rentan Tidak Mampu',
    badgeColor: '#ea580c',
    bgLight: '#fff7ed',
    borderLight: '#fed7aa',
    textColor: '#c2410c',
    iconEmoji: '🟠',
    subjudul: 'Butuh Bantuan / Subsidi Lingkungan',
    indikator: 'Penghasilan di bawah UMR atau tidak tetap, tinggal di kontrakan sederhana, memiliki anggota keluarga sakit menahun/lansia tanpa pensiun, kesulitan membayar iuran kas/kolekte secara rutin.',
    contohKondisi: 'Pekerja harian lepas, ojol, lansia tanpa tunjangan, buruh tidak tetap.',
    rekomendasiBantuan: 'Prioritas penerima subsidi sembako hari raya, bantuan pengobatan, dan pembebasan iuran kas lingkungan.',
    isDefault: true,
    urutan: 3,
  },
  {
    id: 'gol-tidak-mampu',
    nama: 'Tidak Mampu',
    badgeColor: '#dc2626',
    bgLight: '#fef2f2',
    borderLight: '#fecaca',
    textColor: '#b91c1c',
    iconEmoji: '🔴',
    subjudul: 'Bantuan Penuh / Prioritas Khusus',
    indikator: 'Tidak memiliki sumber penghasilan tetap atau pencari nafkah utama meninggal dunia/sakit berat (janda/duda lansia, anak yatim piatu), tempat tinggal sangat memprihatinkan, membutuhkan intervensi paroki.',
    contohKondisi: 'Lansia sebatang kara, keluarga dengan keterbatasan fisik berat/disabilitas tanpa penopang nafkah.',
    rekomendasiBantuan: 'Bantuan penuh sembako bulanan, advokasi PSE Paroki, santunan kesehatan dan biaya pendidikan darurat.',
    isDefault: true,
    urutan: 4,
  },
];

const STORAGE_KEY = 'kriteria_golongan_custom_list';

export function getKriteriaGolonganList(): KriteriaGolonganItem[] {
  if (typeof window === 'undefined') {
    return DEFAULT_KRITERIA_GOLONGAN;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_KRITERIA_GOLONGAN;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
    }
  } catch (err) {
    console.error('Error loading custom kriteria golongan:', err);
  }

  return DEFAULT_KRITERIA_GOLONGAN;
}

export function saveKriteriaGolonganList(list: KriteriaGolonganItem[]): void {
  if (typeof window === 'undefined') return;

  try {
    const sorted = [...list].sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
    window.dispatchEvent(new CustomEvent('kriteriaGolonganChanged', { detail: sorted }));
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.error('Error saving custom kriteria golongan:', err);
  }
}

export function resetKriteriaGolonganDefault(): KriteriaGolonganItem[] {
  if (typeof window === 'undefined') return DEFAULT_KRITERIA_GOLONGAN;
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('kriteriaGolonganChanged', { detail: DEFAULT_KRITERIA_GOLONGAN }));
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.error('Error resetting kriteria golongan:', err);
  }
  return DEFAULT_KRITERIA_GOLONGAN;
}
