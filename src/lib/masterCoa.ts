import { COA } from './types'

export interface MasterCOAItem {
  id: string
  nama_akun: string
  tipe: 'DEBIT' | 'KREDIT'
  kategori: 'KAS' | 'PENERIMAAN' | 'PENGELUARAN'
  keterangan?: string
}

export const DEFAULT_MASTER_COA_LIST: MasterCOAItem[] = [
  // Kas & Setara Kas (Debit Normal)
  { id: '1100', nama_akun: 'Bank', tipe: 'DEBIT', kategori: 'KAS', keterangan: 'Saldo rekening bank lingkungan' },
  { id: '1200', nama_akun: 'Kas', tipe: 'DEBIT', kategori: 'KAS', keterangan: 'Uang tunai kas kecil lingkungan' },
  { id: '1300', nama_akun: 'Dana talangan Dahar Romo', tipe: 'DEBIT', kategori: 'KAS', keterangan: 'Bersumber dari kas lingkungan atau umat' },
  { id: '1400', nama_akun: 'Dana talangan Santo Yusuf', tipe: 'DEBIT', kategori: 'KAS', keterangan: 'Bersumber dari kas lingkungan atau umat' },

  // Penerimaan (Kredit Normal - Akun 4xxx)
  { id: '4100', nama_akun: 'Iuran Kas Lingkungan', tipe: 'KREDIT', kategori: 'PENERIMAAN', keterangan: 'Iuran rutin warga lingkungan' },
  { id: '4110', nama_akun: 'Kolekte Ibadat Sabda', tipe: 'KREDIT', kategori: 'PENERIMAAN', keterangan: 'Persembahan kolekte ibadat' },
  { id: '4120', nama_akun: 'Sumbangan Dahar Romo', tipe: 'KREDIT', kategori: 'PENERIMAAN', keterangan: 'Sumbangan makan/dahar Romo' },
  { id: '4200', nama_akun: 'Sumbangan ASAK', tipe: 'KREDIT', kategori: 'PENERIMAAN', keterangan: 'Ayo Sekolah Ayo Kuliah' },
  { id: '4300', nama_akun: 'Iuran Dana Kematian/St. Yusuf', tipe: 'KREDIT', kategori: 'PENERIMAAN', keterangan: 'Dana santunan kematian' },
  { id: '4400', nama_akun: 'Kolekte Misa Lingkungan', tipe: 'KREDIT', kategori: 'PENERIMAAN', keterangan: 'Persembahan misa di lingkungan' },
  { id: '4500', nama_akun: 'Sumbangan Umat', tipe: 'KREDIT', kategori: 'PENERIMAAN', keterangan: 'Donasi sukarela warga umat' },
  { id: '4600', nama_akun: 'Bantuan dari Paroki', tipe: 'KREDIT', kategori: 'PENERIMAAN', keterangan: 'Subsidi/dana dari Dewan Paroki' },
  { id: '4700', nama_akun: 'Dana APP', tipe: 'KREDIT', kategori: 'PENERIMAAN', keterangan: 'Aksi Puasa Pembangunan' },
  { id: '4800', nama_akun: 'Dana Aksi Natal', tipe: 'KREDIT', kategori: 'PENERIMAAN', keterangan: 'Aksi sosial perayaan Natal' },
  { id: '4900', nama_akun: 'Penerimaan Lainnya', tipe: 'KREDIT', kategori: 'PENERIMAAN', keterangan: 'Penerimaan kas non-rutin lainnya' },

  // Pengeluaran (Debit Normal - Akun 5xxx)
  { id: '5100', nama_akun: 'Misa', tipe: 'DEBIT', kategori: 'PENGELUARAN', keterangan: 'Biaya perlengkapan perayaan ekaristi' },
  { id: '5110', nama_akun: 'Ibadat Sabda', tipe: 'DEBIT', kategori: 'PENGELUARAN', keterangan: 'Biaya penyelenggaraan ibadat' },
  { id: '5120', nama_akun: 'Rosario', tipe: 'DEBIT', kategori: 'PENGELUARAN', keterangan: 'Konsumsi & lilin doa rosario' },
  { id: '5130', nama_akun: 'Koor', tipe: 'DEBIT', kategori: 'PENGELUARAN', keterangan: 'Latihan koor & fotokopi partitur' },
  { id: '5140', nama_akun: 'Stipendium/ Iura stolae', tipe: 'DEBIT', kategori: 'PENGELUARAN', keterangan: 'Stipendium Romo & pelayan altar' },
  { id: '5150', nama_akun: 'Bina iman', tipe: 'DEBIT', kategori: 'PENGELUARAN', keterangan: 'Kegiatan BIA / BIR anak-anak' },
  { id: '5160', nama_akun: 'Pendalaman kitab suci', tipe: 'DEBIT', kategori: 'PENGELUARAN', keterangan: 'Bulan Kitab Suci Nasional (BKSN)' },
  { id: '5170', nama_akun: 'Kepemudaan', tipe: 'DEBIT', kategori: 'PENGELUARAN', keterangan: 'Kegiatan Orang Muda Katolik (OMK)' },
  { id: '5180', nama_akun: 'Kerasulan keluarga', tipe: 'DEBIT', kategori: 'PENGELUARAN', keterangan: 'Program pembinaan pasutri & keluarga' },
  { id: '5190', nama_akun: 'Pendidikan calon imam', tipe: 'DEBIT', kategori: 'PENGELUARAN', keterangan: 'Bantuan seminari / calon imam' },
  { id: '5200', nama_akun: 'Rapat / pertemuan lingkungan', tipe: 'DEBIT', kategori: 'PENGELUARAN', keterangan: 'Konsumsi & perlengkapan rapat warga' },
  { id: '5210', nama_akun: 'Perayaan (Natal / Paskah / HUT)', tipe: 'DEBIT', kategori: 'PENGELUARAN', keterangan: 'Acara pesta & perayaan bersama' },
  { id: '5220', nama_akun: 'Inventaris (Pembelian / Pemeliharaan)', tipe: 'DEBIT', kategori: 'PENGELUARAN', keterangan: 'Pengadaan & perawatan aset' },
  { id: '5230', nama_akun: 'Administrasi', tipe: 'DEBIT', kategori: 'PENGELUARAN', keterangan: 'ATK, fotokopi buku warta, materai' },
  { id: '5240', nama_akun: 'Kegiatan rohani lain (retret, rekoleksi, dsb)', tipe: 'DEBIT', kategori: 'PENGELUARAN', keterangan: 'Ziarah rohani, retret pengurus' },
  { id: '5250', nama_akun: 'Bantuan Sosial Internal (umat lingkungan)', tipe: 'DEBIT', kategori: 'PENGELUARAN', keterangan: 'Santunan warga lingkungan prasejahtera' },
  { id: '5260', nama_akun: 'Bantuan Sosial Eksternal (umat luar lingkungan)', tipe: 'DEBIT', kategori: 'PENGELUARAN', keterangan: 'Bakti sosial warga luar lingkungan' },
  { id: '5270', nama_akun: 'Pastoran (dahar Romo)', tipe: 'DEBIT', kategori: 'PENGELUARAN', keterangan: 'Penyaluran konsumsi pastoran' },
  { id: '5280', nama_akun: 'Sumbangan kematian/St. Yusuf', tipe: 'DEBIT', kategori: 'PENGELUARAN', keterangan: 'Bantuan kedukaan warga' },
  { id: '5290', nama_akun: 'Sumbangan Dana ASAK', tipe: 'DEBIT', kategori: 'PENGELUARAN', keterangan: 'Penyaluran dana beasiswa ASAK' },
  { id: '5300', nama_akun: 'Sumbangan Dana Pastoran', tipe: 'DEBIT', kategori: 'PENGELUARAN', keterangan: 'Dukungan operasional pastoran' },
  { id: '5310', nama_akun: 'Sumbangan Dana APP', tipe: 'DEBIT', kategori: 'PENGELUARAN', keterangan: 'Penyetoran kotak APP ke paroki' },
  { id: '5320', nama_akun: 'Sumbangan Dana Aksi Natal', tipe: 'DEBIT', kategori: 'PENGELUARAN', keterangan: 'Penyetoran aksi Natal ke paroki' },
  { id: '5350', nama_akun: 'Kolekte yg disetor ke Paroki', tipe: 'DEBIT', kategori: 'PENGELUARAN', keterangan: 'Penyetoran kolekte misa / ibadat ke paroki' },
  { id: '5900', nama_akun: 'Pengeluaran lainnya', tipe: 'DEBIT', kategori: 'PENGELUARAN', keterangan: 'Pengeluaran operasional lain-lain' }
]

const CUSTOM_COA_STORAGE_KEY = 'custom_coa_list_store'

export function getAllMasterCOA(): MasterCOAItem[] {
  let customList: MasterCOAItem[] = []
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(CUSTOM_COA_STORAGE_KEY)
      if (raw) customList = JSON.parse(raw)
    } catch (e) {
      console.error('Error reading custom COA:', e)
    }
  }

  const map = new Map<string, MasterCOAItem>()
  DEFAULT_MASTER_COA_LIST.forEach((item) => map.set(item.id, item))
  customList.forEach((item) => map.set(item.id, item))

  return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
}

export function saveCustomCOA(item: MasterCOAItem): MasterCOAItem[] {
  const current = getAllMasterCOA()
  const map = new Map<string, MasterCOAItem>()
  current.forEach((c) => map.set(c.id, c))
  map.set(item.id, item)

  const updated = Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CUSTOM_COA_STORAGE_KEY, JSON.stringify(updated))
      window.dispatchEvent(new Event('coaDataUpdated'))
      window.dispatchEvent(new Event('storage'))
    } catch (e) {
      console.error('Error saving custom COA:', e)
    }
  }

  return updated
}

/**
 * Sinkronisasi seluruh COA ke database Supabase tabel `coa`
 */
export async function syncAllCoaToDatabase(supabase: any): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const allCoas = getAllMasterCOA()
    const rows = allCoas.map(item => ({
      id: item.id,
      nama_akun: item.nama_akun,
      tipe: item.tipe
    }))

    const { error } = await supabase
      .from('coa')
      .upsert(rows, { onConflict: 'id' })

    if (error) {
      console.error('Gagal upsert COA ke Supabase:', error)
      return { success: false, count: 0, error: error.message }
    }

    return { success: true, count: rows.length }
  } catch (err: any) {
    console.error('Exception sinkronisasi COA:', err)
    return { success: false, count: 0, error: err?.message || 'Gagal sinkronisasi' }
  }
}
