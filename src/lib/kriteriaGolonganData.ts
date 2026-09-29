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
    indikator: `• **Hasil Skrining Awal:** Menjawab "TIDAK" pada seluruh 5 indikator Data Pokok kerentanan.
• **Kondisi Tempat Tinggal:** Rumah permanen & layak (luas ≥ 8 m²/jiwa, bukan kawasan kumuh, sanitasi mandiri).
• **Status Kepemilikan:** Rumah milik sendiri atau kontrak/sewa mandiri tanpa beban bantuan.
• **Pekerjaan & Penghasilan:** Kepala keluarga / ART berpenghasilan teratur & bekerja tetap (≥ 40 jam/minggu).
• **Tingkat Pengeluaran (Z):** Z ≥ Rp 1.700.000,- / kapita / bln (atau pengeluaran RT ≥ Rp 8.500.000,- / bln).
• **Kemandirian Finansial:** Mandiri memenuhi pangan, papan, pendidikan, & kesehatan tanpa subsidi gereja.`,
    contohKondisi: 'Karyawan tetap, profesional, wirausaha mandiri dengan penghasilan teratur, keluarga yang berkecukupan dan tidak membutuhkan subsidi sosial gereja.',
    rekomendasiBantuan: 'Tidak memerlukan subsidi ekonomi gereja. Diharapkan menjadi penopang gotong-royong, donatur iuran/kolekte lingkungan, serta penggerak solidaritas umat.',
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
    indikator: `• **Hasil Skrining Awal:** Menjawab "YA" atau "RAGU-RAGU" pada minimal satu pertanyaan Data Pokok.
• **Kawasan & Sanitasi:** Tinggal di kawasan kumuh, lahan tanpa legalitas, luas < 8 m²/jiwa, atau jamban bersama.
• **Kondisi Fisik Bangunan:** Semi permanen (lantai tanah/kayu murah, dinding rumbia/tanpa plester, tanpa listrik PLN/air terlindung).
• **Kepemilikan & Pekerjaan:** Rumah bukan milik sendiri (kontrak/sewa/numpang) dan/atau kerja serabutan (< 40 jam/minggu).
• **Pengeluaran Rumah Tangga:** Pengeluaran keluarga < Rp 8.500.000,- / bln (indikasi awal sebelum rasio per kapita Z).
• **Faktor Risiko Tambahan:** Anggota keluarga disabilitas, balita risiko stunting/gizi buruk, sakit menahun, atau lansia terlantar.`,
    contohKondisi: 'Pekerja kontrak/serabutan, keluarga mengontrak di permukiman padat, buruh lepas harian, atau keluarga dengan anggota sakit kronis yang belum disurvei mendalam.',
    rekomendasiBantuan: 'Wajib dilakukan Pendataan-2 oleh Pengurus Lingkungan (Ketua, PSE, Sekretaris) melalui survei & kunjungan langsung untuk mengumpulkan Data Pendalaman dan menghitung rasio Z.',
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
    indikator: `• **Tingkat Kerentanan:** Berada di atas Garis Kemiskinan, namun rentan jatuh miskin akibat inflasi, PHK, sakit keras, atau musibah.
• **Rasio Pengeluaran Riil (Z):** Rp 850.000,- < Z < Rp 1.700.000,- / kapita / bln (Pengeluaran RT: Rp 4.250.000 - Rp 8.500.000 / bln).
• **Kondisi Hunian:** Hunian sederhana/sewa dengan beban biaya sewa atau cicilan yang memberatkan ekonomi keluarga.
• **Status Mata Pencaharian:** Buruh lepas, ojek online, pedagang kecil, pekerja paruh waktu (< 40 jam/mgg), atau upah tidak menentu.
• **Beban Tanggungan:** Memiliki beban tanggungan biaya sekolah anak yang tinggi, lansia tanpa pensiun, atau biaya berobat rutin.
• **Ketahanan Finansial:** Belum mandiri menghadapi kondisi darurat dan membutuhkan intervensi pemberdayaan ekonomi.`,
    contohKondisi: 'Pekerja harian lepas, buruh pabrik kontrak, pengemudi ojek online, pedagang kelontong kecil, keluarga dengan lansia tanpa tunjangan pensiun atau beban cicilan mendesak.',
    rekomendasiBantuan: 'Prioritas program pemberdayaan ekonomi umat (SABUK, Ayo Kerja, Credit Union), bantuan akses beasiswa pendidikan (ASAK / KIP), advokasi BPJS/KIS, serta subsidi sembako hari raya.',
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
    indikator: `• **Pemenuhan Kebutuhan Dasar:** Tidak mampu mencukupi kebutuhan dasar pangan minimum (2.100 kkal/jiwa/hari) serta papan/sandang dasar.
• **Rasio Pengeluaran Riil (Z):** Z ≤ Rp 850.000,- / kapita / bln (atau Pengeluaran RT ≤ Rp 4.250.000,- / bln) standar Susenas BPS DKI.
• **Kondisi Fisik Hunian:** Tempat tinggal sangat tidak layak huni, menumpang tanpa kepastian, atau fasilitas sanitasi sangat buruk.
• **Sumber Penghasilan:** Kepala keluarga tidak bekerja/menganggur, lansia hidup sebatang kara, keluarga disabilitas berat, atau janda dhuafa.
• **Ketiadaan Aset Cadangan:** Tidak memiliki tabungan maupun aset yang dapat dijual minimal Rp 500.000,- untuk bertahan hidup.
• **Intervensi Khusus:** Wajib menerima intervensi karitatif penuh dan santunan rutin dari Seksi Pengembangan Sosial Ekonomi (PSE).`,
    contohKondisi: 'Lansia sebatang kara/terlantar tanpa sanak saudara, janda/duda dhuafa tanpa pencari nafkah, keluarga dengan disabilitas berat tanpa penopang nafkah, anak yatim piatu.',
    rekomendasiBantuan: 'Intervensi karitatif penuh dan prioritas utama PSE Paroki: santunan kebutuhan pokok sembako rutin bulanan, advokasi darurat medis, beasiswa penuh ASAK, bedah rumah, & bebas iuran kas.',
    isDefault: true,
    urutan: 4,
  },
];

const STORAGE_KEY = 'kriteria_golongan_dupras_kaj_v3';
const LEGACY_STORAGE_KEY = 'kriteria_golongan_custom_list';

export function getKriteriaGolonganList(): KriteriaGolonganItem[] {
  if (typeof window === 'undefined') {
    return DEFAULT_KRITERIA_GOLONGAN;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Initialize with default KAJ
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
