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
    badgeColor: '#2d6a4f',
    bgLight: '#f4f9f6',
    borderLight: '#d5e8dc',
    textColor: '#22543d',
    iconEmoji: '🟢',
    subjudul: 'Keluarga Mandiri / Berdaya',
    garisPengeluaran: 'Pengeluaran keluarga di atas Rp 8.500.000,- / bulan',
    tahapMetode: 'Keluarga Mandiri (Kecukupan Ekonomi)',
    indikator: `• **Gaji & Penghasilan:** Penghasilan keluarga stabil dan berkecukupan (di atas Rp 8,5 juta per bulan).
• **Kepemilikan Rumah:** Memiliki rumah tinggal sendiri yang layak & permanen (atau mampu kontrak secara mandiri).
• **Status Pekerjaan:** Kepala keluarga atau anggota keluarga bekerja tetap (karyawan, PNS, profesional, atau wirausaha).
• **Kebutuhan Hidup:** Mampu mencukupi kebutuhan makan, sandang, papan, pendidikan anak, dan kesehatan sendiri.
• **Kemandirian:** Berdaya secara finansial dan tidak membutuhkan subsidi atau bantuan sosial gereja.`,
    contohKondisi: 'Karyawan tetap swasta/BUMN, pengusaha, profesional dengan penghasilan bulanan teratur dan stabil.',
    rekomendasiBantuan: 'Tidak memerlukan subsidi ekonomi gereja. Diharapkan menjadi penopang gotong-royong, donatur iuran/kolekte lingkungan, serta penggerak solidaritas umat.',
    isDefault: true,
    urutan: 1,
  },
  {
    id: 'gol-terduga-prasejahtera',
    nama: 'Terduga Pra Sejahtera',
    badgeColor: '#526b83',
    bgLight: '#f6f8fa',
    borderLight: '#dde3ea',
    textColor: '#334155',
    iconEmoji: '⚪',
    subjudul: 'Perlu Ditinjau Pengurus Lingkungan',
    garisPengeluaran: 'Pengeluaran keluarga di bawah Rp 8.500.000,- / bulan (Perlu Ditinjau)',
    tahapMetode: 'Perlu Verifikasi & Kunjungan Kasih',
    indikator: `• **Gaji & Penghasilan:** Penghasilan keluarga di bawah Rp 8,5 juta per bulan dan masih belum stabil.
• **Kepemilikan Rumah:** Belum punya rumah sendiri (masih ngontrak, sewa murah, atau numpang keluarga), atau tinggal di permukiman padat.
• **Status Pekerjaan:** Belum ada pekerjaan tetap, pekerja kontrak, buruh harian lepas, ojek online, atau kerja serabutan.
• **Kondisi Khusus:** Memiliki tanggungan berat seperti anggota keluarga sakit kronis menahun, anak balita, lansia, atau difabel.
• **Tindak Lanjut:** Perlu dikunjungi oleh Pengurus Lingkungan untuk memastikan apakah membutuhkan bantuan sosial gereja.`,
    contohKondisi: 'Pekerja kontrak, buruh harian, keluarga yang mengontrak di gang sempit, atau keluarga dengan penghasilan tidak menentu.',
    rekomendasiBantuan: 'Wajib dikunjungi oleh Pengurus Lingkungan (Ketua, Seksi Sosial/PSE, Sekretaris) untuk melihat langsung kondisi riil keluarga.',
    isDefault: true,
    urutan: 2,
  },
  {
    id: 'gol-rentan-tidak-mampu',
    nama: 'Rentan Tidak Mampu',
    badgeColor: '#b45309',
    bgLight: '#fff9f3',
    borderLight: '#f3e8d5',
    textColor: '#8c4e09',
    iconEmoji: '🟠',
    subjudul: 'Penghasilan Pas-pasan / Rentan Kesulitan',
    garisPengeluaran: 'Pengeluaran keluarga sekitar Rp 4.250.000 - Rp 8.500.000 / bulan',
    tahapMetode: 'Prioritas Pemberdayaan & Beasiswa',
    indikator: `• **Gaji & Penghasilan:** Penghasilan pas-pasan (antara Rp 4,25 juta s/d Rp 8,5 juta per bulan), cukup untuk makan sehari-hari tapi sulit menabung.
• **Kepemilikan Rumah:** Mengontrak atau sewa rumah sederhana dengan biaya sewa yang memberatkan keuangan keluarga.
• **Status Pekerjaan:** Bekerja sebagai buruh lepas, pedagang kelontong kecil, pengemudi ojol, atau pekerja paruh waktu.
• **Kerentanan Ekonomi:** Gaji hanya cukup untuk sehari-hari, sangat rentan berutang jika ada sakit, PHK, atau musibah keluarga.
• **Beban Tanggungan:** Terbebani biaya pendidikan sekolah anak atau biaya perawatan lansia tanpa pensiun.`,
    contohKondisi: 'Buruh pabrik kontrak, pedagang kecil, pengemudi online, keluarga dengan beban biaya pendidikan anak yang berat.',
    rekomendasiBantuan: 'Prioritas program pemberdayaan ekonomi umat (SABUK, Ayo Kerja, Credit Union), bantuan akses beasiswa pendidikan (ASAK / KIP), advokasi BPJS/KIS, serta subsidi sembako hari raya.',
    isDefault: true,
    urutan: 3,
  },
  {
    id: 'gol-tidak-mampu',
    nama: 'Tidak Mampu',
    badgeColor: '#9f3a3a',
    bgLight: '#faf5f5',
    borderLight: '#eddcdc',
    textColor: '#802e2e',
    iconEmoji: '🔴',
    subjudul: 'Sangat Membutuhkan Bantuan (Miskin)',
    garisPengeluaran: 'Pengeluaran keluarga di bawah Rp 4.250.000,- / bulan',
    tahapMetode: 'Bantuan Penuh & Prioritas Utama PSE',
    indikator: `• **Gaji & Penghasilan:** Sangat minim di bawah Rp 4,25 juta sekeluarga (sering kesulitan memenuhi makan harian).
• **Kepemilikan Rumah:** Tidak punya rumah tinggal sendiri, menumpang tanpa kepastian, atau kondisi hunian sangat memprihatinkan.
• **Pencari Nafkah:** Kepala keluarga menganggur, tidak mampu bekerja, lansia hidup sebatang kara, janda dhuafa, atau difabel berat.
• **Kondisi Ekonomi:** Tidak memiliki tabungan maupun barang berharga yang bisa dijual untuk bertahan hidup darurat.
• **Kebutuhan Pokok:** Sangat membutuhkan uluran tangan untuk makan harian, sewa tempat berteduh, dan biaya berobat.`,
    contohKondisi: 'Lansia sebatang kara tanpa penghasilan, keluarga dhuafa tanpa pencari nafkah, janda dengan anak kecil, penderita sakit berat terlantar.',
    rekomendasiBantuan: 'Intervensi karitatif penuh dan prioritas utama PSE Paroki: santunan kebutuhan pokok sembako rutin bulanan, advokasi darurat medis, beasiswa penuh ASAK, bedah rumah, & bebas iuran kas.',
    isDefault: true,
    urutan: 4,
  },
];

const STORAGE_KEY = 'kriteria_golongan_dupras_kaj_v4';
const LEGACY_STORAGE_KEY = 'kriteria_golongan_custom_list';

let memoryKriteriaCache: KriteriaGolonganItem[] | null = null;

export async function fetchKriteriaGolonganFromDb(supabase: any): Promise<KriteriaGolonganItem[]> {
  try {
    const { data, error } = await supabase
      .from('kriteria_golongan')
      .select('*')
      .order('urutan', { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      const mapped: KriteriaGolonganItem[] = data.map((item: any) => ({
        id: item.id,
        nama: item.nama,
        badgeColor: item.badge_color || '#16a34a',
        bgLight: item.bg_light || '#f0fdf4',
        borderLight: item.border_light || '#bbf7d0',
        textColor: item.text_color || '#15803d',
        iconEmoji: item.icon_emoji || '🟢',
        subjudul: item.subjudul || '',
        garisPengeluaran: item.garis_pengeluaran || '',
        tahapMetode: item.tahap_metode || '',
        indikator: item.indikator || '',
        contohKondisi: item.contoh_kondisi || '',
        rekomendasiBantuan: item.rekomendasi_bantuan || '',
        isDefault: item.is_default !== false,
        urutan: item.urutan || 1
      }));

      memoryKriteriaCache = mapped;
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
        window.dispatchEvent(new CustomEvent('kriteriaGolonganChanged', { detail: mapped }));
      }
      return mapped;
    }
  } catch (err) {
    console.warn('Notice loading kriteria golongan from Supabase:', err);
  }

  return getKriteriaGolonganList();
}

export async function syncKriteriaGolonganToDb(supabase: any, list: KriteriaGolonganItem[]): Promise<boolean> {
  try {
    const rows = list.map(item => ({
      id: item.id,
      nama: item.nama,
      badge_color: item.badgeColor,
      bg_light: item.bgLight,
      border_light: item.borderLight,
      text_color: item.textColor,
      icon_emoji: item.iconEmoji,
      subjudul: item.subjudul,
      garis_pengeluaran: item.garisPengeluaran || null,
      tahap_metode: item.tahapMetode || null,
      indikator: item.indikator,
      contoh_kondisi: item.contohKondisi,
      rekomendasi_bantuan: item.rekomendasiBantuan,
      is_default: item.isDefault !== false,
      urutan: item.urutan
    }));

    const { error } = await supabase
      .from('kriteria_golongan')
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase upsert kriteria_golongan notice:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Exception upserting kriteria_golongan:', err);
    return false;
  }
}

export function getKriteriaGolonganList(): KriteriaGolonganItem[] {
  if (memoryKriteriaCache && memoryKriteriaCache.length > 0) {
    return memoryKriteriaCache;
  }

  if (typeof window === 'undefined') {
    return DEFAULT_KRITERIA_GOLONGAN;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_KRITERIA_GOLONGAN));
      return DEFAULT_KRITERIA_GOLONGAN;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const sorted = parsed.sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
      memoryKriteriaCache = sorted;
      return sorted;
    }
  } catch (err) {
    console.error('Error loading custom kriteria golongan:', err);
  }

  return DEFAULT_KRITERIA_GOLONGAN;
}

export function saveKriteriaGolonganList(list: KriteriaGolonganItem[], supabase?: any): void {
  const sorted = [...list].sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
  memoryKriteriaCache = sorted;

  if (supabase) {
    syncKriteriaGolonganToDb(supabase, sorted).catch(() => {});
  }

  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(sorted));
    window.dispatchEvent(new CustomEvent('kriteriaGolonganChanged', { detail: sorted }));
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.error('Error saving custom kriteria golongan:', err);
  }
}

export function resetKriteriaGolonganDefault(supabase?: any): KriteriaGolonganItem[] {
  memoryKriteriaCache = DEFAULT_KRITERIA_GOLONGAN;

  if (supabase) {
    syncKriteriaGolonganToDb(supabase, DEFAULT_KRITERIA_GOLONGAN).catch(() => {});
  }

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
