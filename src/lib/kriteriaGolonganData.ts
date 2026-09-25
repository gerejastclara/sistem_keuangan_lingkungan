export interface KriteriaGolonganItem {
  id: string;
  nama: string;
  badgeColor: string; // Hex color
  bgLight: string;
  borderLight: string;
  textColor: string;
  iconEmoji: string;
  subjudul: string;
  indikator: string;
  garisPengeluaran?: string;
  tahapMetode?: string;
  contohKondisi: string;
  rekomendasiBantuan: string;
  isDefault?: boolean;
  urutan: number;
}

export const PEDOMAN_DUPRAS_KAJ_INFO = {
  judul: 'PEDOMAN KONSEP DATA UMAT PRA-SEJAHTERA (DUPRAS)',
  instansi: 'KEUSKUPAN AGUNG JAKARTA (KAJ)',
  penyusun: 'Tim Sinergi Bidang Prioritas 5 dan Komisi Pengembangan Sosial Ekonomi (PSE) Tahun 2025',
  temaTahunan: 'Arah Dasar KAJ 2022-2026: Nilai-nilai Ajaran Sosial Gereja — Tema 2025: "Kepedulian Lebih kepada Saudara yang Lemah dan Miskin"',
  standarBPS: 'BPS RI (Profil Kemiskinan Maret 2024 Perkotaan DKI Jakarta & Susenas)',
  garisTidakMampu: 'Rp 850.000,- / kapita / bulan (Rp 4.250.000,- / Rumah Tangga / bulan)',
  garisRentanTidakMampu: 'Rp 1.700.000,- / kapita / bulan (Rp 8.500.000,- / Rumah Tangga / bulan)',
  mekanisme: {
    tahap1: 'Pendataan-1: Skrining 5 Data Pokok & 5 Data Tambahan dari BIDUK Lingkungan (Menghasilkan kategori Sejahtera atau Terduga Pra-Sejahtera).',
    tahap2: 'Pendataan-2: Survei verifikasi langsung bagi Terduga Pra-Sejahtera menghitung rasio pengeluaran Z = Y / X (Menghasilkan kategori Sejahtera, Rentan Tidak Mampu, atau Tidak Mampu).'
  }
};

export const DEFAULT_KRITERIA_GOLONGAN: KriteriaGolonganItem[] = [
  {
    id: 'gol-sejahtera',
    nama: 'Sejahtera',
    badgeColor: '#16a34a',
    bgLight: '#f0fdf4',
    borderLight: '#bbf7d0',
    textColor: '#15803d',
    iconEmoji: '🟢',
    subjudul: 'Keluarga Mandiri / Berdaya (Di Atas Garis Rentan)',
    garisPengeluaran: 'Z ≥ Rp 1.700.000,- / kapita / bln (atau ≥ Rp 8.500.000,- / RT)',
    tahapMetode: 'Tahap 1 (Semua Data Pokok = "TIDAK") / Tahap 2 (Z ≥ Rp 1.700.000)',
    indikator: 'Menjawab "TIDAK" pada seluruh indikator kerentanan Data Pokok. Memiliki hunian layak & permanen (bukan kawasan kumuh, luas lantai ≥ 8 m²/orang, sanitasi sendiri), tempat tinggal milik sendiri atau sewa mandiri, kepala keluarga/ART bekerja tetap (durasi kerja ≥ 40 jam/minggu), dan pengeluaran per kapita per bulan Z ≥ Rp 1.700.000,- (atau pengeluaran rumah tangga ≥ Rp 8.500.000,-/bulan untuk rata-rata 5 anggota). Mampu memenuhi kebutuhan pokok pangan, papan, pendidikan, dan kesehatan secara mandiri.',
    contohKondisi: 'Karyawan tetap, profesional, wirausaha mandiri dengan penghasilan teratur, keluarga yang berkecukupan dan tidak membutuhkan subsidi sosial gereja.',
    rekomendasiBantuan: 'Tidak memerlukan subsidi atau bantuan ekonomi. Diharapkan menjadi penopang gotong-royong, donatur iuran/kolekte lingkungan, serta penggerak solidaritas umat.',
    isDefault: true,
    urutan: 1,
  },
  {
    id: 'gol-terduga-prasejahtera',
    nama: 'Terduga Pra Sejahtera',
    badgeColor: '#eab308',
    bgLight: '#fefce8',
    borderLight: '#fef08a',
    textColor: '#a16207',
    iconEmoji: '🟡',
    subjudul: 'Hasil Skrining Awal (Perlu Verifikasi Pendataan-2)',
    garisPengeluaran: 'Pengeluaran RT < Rp 8.500.000,- / bln atau terindikasi pada Data Pokok/Tambahan',
    tahapMetode: 'Tahap 1 (Skrining Awal BIDUK Lingkungan: Minimal 1 jawaban YA/RAGU)',
    indikator: 'Menjawab "YA" atau "RAGU-RAGU" pada sekurang-kurangnya satu pertanyaan Data Pokok: (1) Tinggal di wilayah kumuh (lahan tanpa legalitas, luas lantai < 8 m²/orang, atau jamban bersama), (2) Bangunan tempat tinggal semi permanen (lantai tanah/kayu murah, dinding rumbia/bambu/tanpa plester, tanpa listrik PLN, atau air tak terlindung), (3) Tempat tinggal bukan milik sendiri (kontrak/sewa/numpang), (4) Tidak memiliki pekerjaan tetap (< 40 jam/minggu/serabutan), atau (5) Pengeluaran rumah tangga < Rp 8.500.000,-/bulan. Serta didukung Data Tambahan faktor risiko kemiskinan (anggota keluarga disabilitas fisik/intelektual/mental/sensorik, anak risiko stunting/gizi buruk, sakit kronis/menahun, atau lansia >60 th terlantar/hidup sendirian).',
    contohKondisi: 'Pekerja kontrak/serabutan, keluarga mengontrak di permukiman padat, buruh lepas harian, atau keluarga dengan anggota sakit kronis yang belum disurvei mendalam.',
    rekomendasiBantuan: 'Wajib dilakukan Pendataan-2 oleh Pengurus Lingkungan (Ketua Lingkungan, Seksi Sosial PSE, Sekretaris) melalui survei & kunjungan langsung by name by address guna mengumpulkan Data Pendalaman dan menghitung rasio pengeluaran riil per kapita (Z = Y/X) untuk menentukan klasifikasi definitif.',
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
    subjudul: 'Waspada Kerentanan (Antara 1x s/d 2x Garis Kemiskinan)',
    garisPengeluaran: 'Rp 850.000,- < Z < Rp 1.700.000,- / kapita / bln (RT: Rp 4.250.000 - Rp 8.500.000 / bln)',
    tahapMetode: 'Hasil Pendataan-2 (Survei Langsung Nilai Pengeluaran Z = Y / X)',
    indikator: 'Golongan keluarga yang berada di atas Garis Tidak Mampu secara konsep, namun rentan jatuh menjadi Tidak Mampu bila terjadi gejolak ekonomi, inflasi, atau risiko tak terduga (kehilangan pekerjaan, sakit keras, musibah). Nilai pengeluaran per kapita per bulan berada di antara Rp 850.000,- s/d Rp 1.700.000,- (atau pengeluaran rumah tangga antara Rp 4.250.000,- s/d Rp 8.500.000,-/bulan). Memiliki pekerjaan tidak tetap, pekerja paruh waktu (< 40 jam/minggu), atau beban tanggungan biaya sekolah dan kesehatan yang tinggi.',
    contohKondisi: 'Pekerja harian lepas, buruh pabrik kontrak, pengemudi ojek online, pedagang kelontong kecil, keluarga dengan lansia tanpa tunjangan pensiun atau beban cicilan mendesak.',
    rekomendasiBantuan: 'Prioritas program pemberdayaan ekonomi umat (SABUK - Sentra Bimbingan Usaha Kecil, pelatihan kerja Ayo Kerja, Koperasi Credit Union), bantuan akses beasiswa pendidikan (Gerakan ASAK Paroki / KIP), advokasi jaminan kesehatan (BPJS/KIS), serta subsidi sembako hari raya.',
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
    subjudul: 'Bantuan Penuh & Prioritas Khusus (Di Bawah Garis Kemiskinan KAJ)',
    garisPengeluaran: 'Z ≤ Rp 850.000,- / kapita / bln (atau ≤ Rp 4.250.000,- / RT / bln)',
    tahapMetode: 'Hasil Pendataan-2 (Survei Langsung Nilai Pengeluaran Z = Y / X)',
    indikator: 'Ketidakmampuan secara ekonomi untuk memenuhi kebutuhan dasar makanan minimum (2100 kkalori per kapita/hari) dan kebutuhan non-makanan dasar (perumahan, sandang, pendidikan, kesehatan). Nilai pengeluaran per kapita per bulan Z ≤ Rp 850.000,- (atau pengeluaran rumah tangga ≤ Rp 4.250.000,-/bulan untuk rata-rata 5 ART) mengacu pada standar Susenas BPS DKI Jakarta. Kepala rumah tangga tidak memiliki pekerjaan/penghasilan mandiri, kondisi hunian memprihatinkan, atau tidak memiliki aset yang dapat dijual minimal Rp 500.000,-.',
    contohKondisi: 'Lansia sebatang kara/terlantar tanpa sanak saudara, janda/duda dhuafa tanpa pencari nafkah, keluarga dengan disabilitas berat tanpa penopang nafkah, anak yatim piatu.',
    rekomendasiBantuan: 'Intervensi karitatif penuh dan prioritas utama PSE Paroki: santunan kebutuhan pokok sembako rutin bulanan, advokasi tanggap darurat kesehatan/pengobatan, beasiswa penuh anak asuh (Gerakan ASAK Paroki), bantuan bedah rumah/hunian layak, serta pembebasan total dari iuran kas lingkungan.',
    isDefault: true,
    urutan: 4,
  },
];

const STORAGE_KEY = 'kriteria_golongan_dupras_kaj_v2';
const LEGACY_STORAGE_KEY = 'kriteria_golongan_custom_list';

export function getKriteriaGolonganList(): KriteriaGolonganItem[] {
  if (typeof window === 'undefined') {
    return DEFAULT_KRITERIA_GOLONGAN;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Check legacy: if only legacy exists and might be old mock, reset to official KAJ
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_KRITERIA_GOLONGAN));
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
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(sorted));
    window.dispatchEvent(new CustomEvent('kriteriaGolonganChanged', { detail: sorted }));
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.error('Error saving custom kriteria golongan:', err);
  }
}

export function resetKriteriaGolonganDefault(): KriteriaGolonganItem[] {
  if (typeof window === 'undefined') return DEFAULT_KRITERIA_GOLONGAN;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_KRITERIA_GOLONGAN));
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(DEFAULT_KRITERIA_GOLONGAN));
    window.dispatchEvent(new CustomEvent('kriteriaGolonganChanged', { detail: DEFAULT_KRITERIA_GOLONGAN }));
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.error('Error resetting kriteria golongan:', err);
  }
  return DEFAULT_KRITERIA_GOLONGAN;
}
