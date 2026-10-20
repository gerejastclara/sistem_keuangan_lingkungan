'use client'

import { getLingkunganDbUuid, MASTER_LINGKUNGAN_UUID_MAP } from './constants'
import { toDeterministicUuid, isValidUuid } from './uuid'

export interface LocalStorageInventory {
  totalItems: number
  transactions: any[]
  kepalaKeluarga: any[]
  anggotaKeluarga: any[]
  golonganKeluarga: any[]
  profilLingkungan: any[]
  aset: any[]
  coa: any[]
  kriteriaGolongan: any[]
  approvals: any[]
  rawKeys: string[]
}

export interface MigrationProgress {
  percent: number
  currentModule: string
  currentCount: number
  totalCount: number
  message: string
}

export interface MigrationResult {
  success: boolean
  stats: {
    coaUploaded: number
    kriteriaUploaded: number
    profilUploaded: number
    kkUploaded: number
    anggotaUploaded: number
    golonganUploaded: number
    transaksiUploaded: number
    asetUploaded: number
    approvalsUploaded: number
  }
  error?: string
}

/**
 * Normalizes raw string/number ID into a valid RFC 4122 UUID.
 */
function ensureUuid(namespace: string, rawId: any, fallbackStr: string): string {
  const str = String(rawId || '').trim()
  if (isValidUuid(str)) {
    return str.toLowerCase()
  }
  return toDeterministicUuid(namespace, str || fallbackStr)
}

/**
 * Resolves any Lingkungan ID (slug, mock UUID, or official UUID) to the database UUID.
 */
function resolveLingkunganId(rawId: string | null | undefined): string {
  if (!rawId) return 'eea00d03-96b0-40a0-9465-5eb4e97496c6' // Default St. Agnes 1
  const clean = String(rawId).trim()
  const dbUuid = getLingkunganDbUuid(clean)
  if (dbUuid) return dbUuid

  // Check if clean matches any key in MASTER_LINGKUNGAN_UUID_MAP
  if (MASTER_LINGKUNGAN_UUID_MAP[clean]) {
    return MASTER_LINGKUNGAN_UUID_MAP[clean]
  }

  // If already a valid UUID, return it
  if (isValidUuid(clean)) return clean.toLowerCase()

  return 'eea00d03-96b0-40a0-9465-5eb4e97496c6'
}

/**
 * Scans all localStorage keys in the browser and parses system entities.
 */
export function scanLocalStorageData(): LocalStorageInventory {
  if (typeof window === 'undefined') {
    return {
      totalItems: 0,
      transactions: [],
      kepalaKeluarga: [],
      anggotaKeluarga: [],
      golonganKeluarga: [],
      profilLingkungan: [],
      aset: [],
      coa: [],
      kriteriaGolongan: [],
      approvals: [],
      rawKeys: []
    }
  }

  const rawKeys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k) rawKeys.push(k)
  }

  // 1. Transactions
  const txMap = new Map<string, any>()
  rawKeys.forEach(key => {
    if (key === 'custom_journals_all_store' || key.startsWith('custom_journals_')) {
      if (key.includes('deleted')) return
      try {
        const raw = localStorage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) {
            parsed.forEach((t: any) => {
              if (t && (t.id || t.nominal || t.keterangan)) {
                const uniqueKey = t.id || `${t.tanggal}_${t.nominal}_${t.keterangan}`
                txMap.set(uniqueKey, t)
              }
            })
          }
        }
      } catch (e) {}
    }
  })
  const transactions = Array.from(txMap.values())

  // 2. Kepala Keluarga
  const kkMap = new Map<string, any>()
  rawKeys.forEach(key => {
    if (key === 'custom_kks_all_store' || key.startsWith('custom_kks_')) {
      if (key.includes('deleted')) return
      try {
        const raw = localStorage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) {
            parsed.forEach((k: any) => {
              if (k && (k.nama_kk || k.id)) {
                const uniqueKey = k.id || `${k.lingkungan_id}_${k.nama_kk}`
                kkMap.set(uniqueKey, k)
              }
            })
          }
        }
      } catch (e) {}
    }
  })
  const kepalaKeluarga = Array.from(kkMap.values())

  // 3. Anggota Keluarga
  const memberMap = new Map<string, any>()
  try {
    const rawAng = localStorage.getItem('custom_anggota_all_store')
    if (rawAng) {
      const parsed = JSON.parse(rawAng)
      if (Array.isArray(parsed)) {
        parsed.forEach((m: any) => {
          if (m && m.nama) {
            memberMap.set(m.id || `${m.kk_id}_${m.nama}`, m)
          }
        })
      }
    }
  } catch (e) {}

  // Also include anggota embedded within KK objects
  kepalaKeluarga.forEach(kk => {
    if (Array.isArray(kk.anggota)) {
      kk.anggota.forEach((m: any, idx: number) => {
        if (m && m.nama) {
          const uniqueKey = m.id || `${kk.id}_${m.nama}_${idx}`
          if (!memberMap.has(uniqueKey)) {
            memberMap.set(uniqueKey, { ...m, kk_id: kk.id })
          }
        }
      })
    }
  })
  const anggotaKeluarga = Array.from(memberMap.values())

  // 4. Golongan Keluarga
  const golMap = new Map<string, any>()
  rawKeys.forEach(key => {
    if (key === 'custom_golongan_all_store' || key.startsWith('custom_golongan_')) {
      try {
        const raw = localStorage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) {
            parsed.forEach((g: any) => {
              if (g && (g.kk_id || g.golongan)) {
                golMap.set(g.kk_id || g.id, g)
              }
            })
          }
        }
      } catch (e) {}
    }
  })
  const golonganKeluarga = Array.from(golMap.values())

  // 5. Profil & Pengurus Lingkungan
  const profilMap = new Map<string, any>()
  rawKeys.forEach(key => {
    if (key.startsWith('profil_manual_') || key.startsWith('pengurus_manual_')) {
      try {
        const raw = localStorage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw)
          const lingId = parsed.lingkungan_id || key.replace(/^(profil_manual_|pengurus_manual_)/, '')
          const dbUuid = resolveLingkunganId(lingId)
          profilMap.set(dbUuid, { ...parsed, lingkungan_id: dbUuid })
        }
      } catch (e) {}
    }
  })
  const profilLingkungan = Array.from(profilMap.values())

  // 6. Aset
  const assetMap = new Map<string, any>()
  rawKeys.forEach(key => {
    if (key === 'custom_assets_all_store' || key.startsWith('custom_assets_')) {
      try {
        const raw = localStorage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) {
            parsed.forEach((a: any) => {
              if (a && a.nama_barang) {
                assetMap.set(a.id || `${a.lingkungan_id}_${a.nama_barang}`, a)
              }
            })
          }
        }
      } catch (e) {}
    }
  })
  const aset = Array.from(assetMap.values())

  // 7. COA
  let coa: any[] = []
  try {
    const rawCoa = localStorage.getItem('custom_coa_store')
    if (rawCoa) {
      const parsed = JSON.parse(rawCoa)
      if (Array.isArray(parsed)) coa = parsed
    }
  } catch (e) {}

  // 8. Kriteria Golongan
  let kriteriaGolongan: any[] = []
  try {
    const rawKriteria = localStorage.getItem('kriteria_golongan_store') || localStorage.getItem('kriteria_golongan_data')
    if (rawKriteria) {
      const parsed = JSON.parse(rawKriteria)
      if (Array.isArray(parsed)) kriteriaGolongan = parsed
    }
  } catch (e) {}

  // 9. Approvals
  let approvals: any[] = []
  try {
    const rawAppr = localStorage.getItem('dafu_approvals_store')
    if (rawAppr) {
      const parsed = JSON.parse(rawAppr)
      if (Array.isArray(parsed)) approvals = parsed
    }
  } catch (e) {}

  const totalItems =
    transactions.length +
    kepalaKeluarga.length +
    anggotaKeluarga.length +
    golonganKeluarga.length +
    profilLingkungan.length +
    aset.length +
    coa.length +
    kriteriaGolongan.length +
    approvals.length

  return {
    totalItems,
    transactions,
    kepalaKeluarga,
    anggotaKeluarga,
    golonganKeluarga,
    profilLingkungan,
    aset,
    coa,
    kriteriaGolongan,
    approvals,
    rawKeys
  }
}

/**
 * Generates and triggers browser download of an emergency JSON backup.
 */
export function exportLocalStorageBackup(inventory: LocalStorageInventory): void {
  if (typeof window === 'undefined') return

  const backupData = {
    app: 'Sistem Keuangan & DAFU Gereja Santa Clara',
    exportTimestamp: new Date().toISOString(),
    totalItems: inventory.totalItems,
    data: {
      transactions: inventory.transactions,
      kepalaKeluarga: inventory.kepalaKeluarga,
      anggotaKeluarga: inventory.anggotaKeluarga,
      golonganKeluarga: inventory.golonganKeluarga,
      profilLingkungan: inventory.profilLingkungan,
      aset: inventory.aset,
      coa: inventory.coa,
      kriteriaGolongan: inventory.kriteriaGolongan,
      approvals: inventory.approvals
    }
  }

  const jsonStr = JSON.stringify(backupData, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  a.href = url
  a.download = `backup_localstorage_santaclara_${dateStr}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Core engine that performs the migration from localStorage to Supabase Cloud Database.
 */
export async function executeMigrationToSupabase(
  supabase: any,
  onProgress?: (progress: MigrationProgress) => void
): Promise<MigrationResult> {
  const inventory = scanLocalStorageData()
  const total = Math.max(inventory.totalItems, 1)
  let processed = 0

  const updateProgress = (moduleName: string, count: number, message: string) => {
    processed += count
    const percent = Math.min(Math.round((processed / total) * 100), 100)
    if (onProgress) {
      onProgress({
        percent,
        currentModule: moduleName,
        currentCount: processed,
        totalCount: total,
        message
      })
    }
  }

  const stats = {
    coaUploaded: 0,
    kriteriaUploaded: 0,
    profilUploaded: 0,
    kkUploaded: 0,
    anggotaUploaded: 0,
    golonganUploaded: 0,
    transaksiUploaded: 0,
    asetUploaded: 0,
    approvalsUploaded: 0
  }

  try {
    // --------------------------------------------------------------------------
    // 1. MASTER COA
    // --------------------------------------------------------------------------
    if (inventory.coa.length > 0) {
      updateProgress('COA', 0, 'Mengunggah Master Akun Pembukuan (COA)...')
      const coaRows = inventory.coa.map((c: any) => ({
        id: String(c.id).trim(),
        nama_akun: c.nama_akun || c.nama || 'Akun Pembukuan',
        tipe: c.tipe === 'KREDIT' ? 'KREDIT' : 'DEBIT',
        kategori: c.kategori || (c.tipe === 'DEBIT' ? 'PENERIMAAN' : 'PENGELUARAN'),
        keterangan: c.keterangan || null,
        urutan: typeof c.urutan === 'number' ? c.urutan : 0
      }))

      const { error: coaErr } = await supabase.from('coa').upsert(coaRows, { onConflict: 'id' })
      if (!coaErr) stats.coaUploaded = coaRows.length
      updateProgress('COA', inventory.coa.length, `Berhasil menyimpan ${stats.coaUploaded} akun COA`)
    }

    // --------------------------------------------------------------------------
    // 2. KRITERIA GOLONGAN
    // --------------------------------------------------------------------------
    if (inventory.kriteriaGolongan.length > 0) {
      updateProgress('Kriteria Golongan', 0, 'Mengunggah Pedoman Kriteria DUPRAS KAJ...')
      const kriteriaRows = inventory.kriteriaGolongan.map((k: any) => ({
        id: String(k.id).trim(),
        nama: k.nama,
        badge_color: k.badge_color || null,
        bg_light: k.bg_light || null,
        border_light: k.border_light || null,
        text_color: k.text_color || null,
        icon_emoji: k.icon_emoji || null,
        subjudul: k.subjudul || null,
        garis_pengeluaran: k.garis_pengeluaran || null,
        tahap_metode: k.tahap_metode || null,
        indikator: k.indikator || null,
        contoh_kondisi: k.contoh_kondisi || null,
        rekomendasi_bantuan: k.rekomendasi_bantuan || null,
        is_default: k.is_default !== false,
        urutan: typeof k.urutan === 'number' ? k.urutan : 0
      }))

      const { error: kritErr } = await supabase.from('kriteria_golongan').upsert(kriteriaRows, { onConflict: 'id' })
      if (!kritErr) stats.kriteriaUploaded = kriteriaRows.length
      updateProgress('Kriteria Golongan', inventory.kriteriaGolongan.length, `Berhasil menyimpan ${stats.kriteriaUploaded} pedoman kriteria`)
    }

    // --------------------------------------------------------------------------
    // 3. PROFIL LINGKUNGAN
    // --------------------------------------------------------------------------
    if (inventory.profilLingkungan.length > 0) {
      updateProgress('Profil Lingkungan', 0, 'Mengunggah Susunan Pengurus Lingkungan...')
      for (const p of inventory.profilLingkungan) {
        const dbLingId = resolveLingkunganId(p.lingkungan_id)
        const row = {
          lingkungan_id: dbLingId,
          ketua_nama: p.ketua_nama || p.ketua || null,
          telepon_ketua: p.telepon_ketua || null,
          sekretaris_nama: p.sekretaris_nama || p.sekretaris || null,
          telepon_sekretaris: p.telepon_sekretaris || null,
          bendahara_nama: p.bendahara_nama || p.bendahara || null,
          telepon_bendahara: p.telepon_bendahara || null,
          periode_masa_bakti: p.periode_masa_bakti || '2024 - 2026',
          status: p.status || 'Aktif'
        }

        const { error: profErr } = await supabase.from('profil_lingkungan').upsert(row, { onConflict: 'lingkungan_id' })
        if (!profErr) stats.profilUploaded += 1
      }
      updateProgress('Profil Lingkungan', inventory.profilLingkungan.length, `Berhasil menyimpan ${stats.profilUploaded} profil lingkungan`)
    }

    // Map old KK ID to new UUID for foreign key preservation
    const kkIdUuidMap = new Map<string, string>()

    // --------------------------------------------------------------------------
    // 4. KEPALA KELUARGA (DAFU)
    // --------------------------------------------------------------------------
    if (inventory.kepalaKeluarga.length > 0) {
      updateProgress('Kepala Keluarga', 0, 'Mengunggah Data Kepala Keluarga...')
      const BATCH_SIZE = 50
      for (let i = 0; i < inventory.kepalaKeluarga.length; i += BATCH_SIZE) {
        const batch = inventory.kepalaKeluarga.slice(i, i + BATCH_SIZE)
        const rows = batch.map((k: any) => {
          const dbLingId = resolveLingkunganId(k.lingkungan_id)
          const oldId = String(k.id || '')
          const validUuid = ensureUuid('kk', oldId, `${dbLingId}:${k.nama_kk}`)
          kkIdUuidMap.set(oldId, validUuid)

          return {
            id: validUuid,
            lingkungan_id: dbLingId,
            nama_kk: k.nama_kk || 'Keluarga',
            no_kk: k.no_kk || null,
            alamat: k.alamat || null,
            telepon: k.telepon || null,
            is_biduk: k.is_biduk !== false
          }
        })

        const { error: kkErr } = await supabase.from('kepala_keluarga').upsert(rows, { onConflict: 'id' })
        if (!kkErr) stats.kkUploaded += rows.length
        else console.warn('Warning batch KK:', kkErr.message)
      }
      updateProgress('Kepala Keluarga', inventory.kepalaKeluarga.length, `Berhasil menyimpan ${stats.kkUploaded} Kepala Keluarga`)
    }

    // --------------------------------------------------------------------------
    // 5. ANGGOTA KELUARGA
    // --------------------------------------------------------------------------
    if (inventory.anggotaKeluarga.length > 0) {
      updateProgress('Anggota Keluarga', 0, 'Mengunggah Data Jiwa Umat...')
      const BATCH_SIZE = 50
      for (let i = 0; i < inventory.anggotaKeluarga.length; i += BATCH_SIZE) {
        const batch = inventory.anggotaKeluarga.slice(i, i + BATCH_SIZE)
        const rows: any[] = []

        batch.forEach((m: any, mIdx: number) => {
          const rawKkId = String(m.kk_id || '')
          const mappedKkUuid = kkIdUuidMap.get(rawKkId) || (isValidUuid(rawKkId) ? rawKkId : null)

          if (mappedKkUuid) {
            const memberUuid = ensureUuid('mem', m.id, `${mappedKkUuid}:${m.nama}_${mIdx}`)
            rows.push({
              id: memberUuid,
              kk_id: mappedKkUuid,
              no_anggota: m.no_anggota || null,
              nama: m.nama,
              peran: m.peran || 'Anak',
              jenis_kelamin: m.jenis_kelamin || null,
              is_kaj: m.is_kaj !== false,
              keterangan: m.keterangan || null
            })
          }
        })

        if (rows.length > 0) {
          const { error: memErr } = await supabase.from('anggota_keluarga').upsert(rows, { onConflict: 'id' })
          if (!memErr) stats.anggotaUploaded += rows.length
          else console.warn('Warning batch anggota:', memErr.message)
        }
      }
      updateProgress('Anggota Keluarga', inventory.anggotaKeluarga.length, `Berhasil menyimpan ${stats.anggotaUploaded} Jiwa Umat`)
    }

    // --------------------------------------------------------------------------
    // 6. GOLONGAN KELUARGA
    // --------------------------------------------------------------------------
    if (inventory.golonganKeluarga.length > 0) {
      updateProgress('Golongan Keluarga', 0, 'Mengunggah Klasifikasi Ekonomi...')
      const rows: any[] = []
      inventory.golonganKeluarga.forEach((g: any) => {
        const rawKkId = String(g.kk_id || g.id || '')
        const mappedKkUuid = kkIdUuidMap.get(rawKkId) || (isValidUuid(rawKkId) ? rawKkId : null)
        if (mappedKkUuid) {
          const dbLingId = resolveLingkunganId(g.lingkungan_id)
          rows.push({
            id: ensureUuid('gol', mappedKkUuid, mappedKkUuid),
            kk_id: mappedKkUuid,
            lingkungan_id: dbLingId,
            golongan: g.golongan || 'Sejahtera',
            kriteria_catatan: g.kriteria_catatan || null,
            updated_by_role: g.updated_by_role || 'SEKRETARIS',
            updated_at: new Date().toISOString()
          })
        }
      })

      if (rows.length > 0) {
        const { error: golErr } = await supabase.from('golongan_keluarga').upsert(rows, { onConflict: 'kk_id' })
        if (!golErr) stats.golonganUploaded = rows.length
      }
      updateProgress('Golongan Keluarga', inventory.golonganKeluarga.length, `Berhasil menyimpan ${stats.golonganUploaded} klasifikasi golongan`)
    }

    // --------------------------------------------------------------------------
    // 7. JURNAL TRANSAKSI
    // --------------------------------------------------------------------------
    if (inventory.transactions.length > 0) {
      updateProgress('Jurnal Transaksi', 0, 'Mengunggah Jurnal Transaksi Kas...')
      const BATCH_SIZE = 50
      for (let i = 0; i < inventory.transactions.length; i += BATCH_SIZE) {
        const batch = inventory.transactions.slice(i, i + BATCH_SIZE)
        const rows = batch.map((t: any) => {
          const dbLingId = resolveLingkunganId(t.lingkungan_id)
          const txUuid = ensureUuid('tx', t.id, `${dbLingId}:${t.tanggal}:${t.nominal}:${t.keterangan}`)
          
          let resolvedKkId: string | null = null
          if (t.kk_id) {
            const rawKkId = String(t.kk_id)
            resolvedKkId = kkIdUuidMap.get(rawKkId) || (isValidUuid(rawKkId) ? rawKkId : null)
          }

          // Format date YYYY-MM-DD
          let cleanTanggal = t.tanggal
          if (!cleanTanggal || !/^\d{4}-\d{2}-\d{2}$/.test(cleanTanggal)) {
            cleanTanggal = new Date().toISOString().slice(0, 10)
          }

          return {
            id: txUuid,
            lingkungan_id: dbLingId,
            kk_id: resolvedKkId,
            tanggal: cleanTanggal,
            tipe_arus: t.tipe_arus === 'KELUAR' ? 'KELUAR' : 'MASUK',
            coa_debit: t.coa_debit || '111.01',
            coa_kredit: t.coa_kredit || '411.01',
            nominal: Number(t.nominal) || 0,
            keterangan: t.keterangan || 'Transaksi Kas',
            is_posted: t.is_posted !== false
          }
        })

        const { error: txErr } = await supabase.from('jurnal_transaksi').upsert(rows, { onConflict: 'id' })
        if (!txErr) stats.transaksiUploaded += rows.length
        else console.warn('Warning batch transaksi:', txErr.message)
      }
      updateProgress('Jurnal Transaksi', inventory.transactions.length, `Berhasil menyimpan ${stats.transaksiUploaded} transaksi kas`)
    }

    // --------------------------------------------------------------------------
    // 8. ASET
    // --------------------------------------------------------------------------
    if (inventory.aset.length > 0) {
      updateProgress('Aset', 0, 'Mengunggah Inventaris Aset...')
      const rows = inventory.aset.map((a: any) => {
        const dbLingId = resolveLingkunganId(a.lingkungan_id)
        const assetUuid = ensureUuid('aset', a.id, `${dbLingId}:${a.nama_barang}`)

        return {
          id: assetUuid,
          lingkungan_id: dbLingId,
          kategori: a.kategori || 'Inventaris Umum',
          nama_barang: a.nama_barang || 'Barang Inventaris',
          tahun_beli: Number(a.tahun_beli) || new Date().getFullYear(),
          jumlah: Number(a.jumlah) || 1,
          harga_satuan: Number(a.harga_satuan) || 0
        }
      })

      const { error: astErr } = await supabase.from('aset').upsert(rows, { onConflict: 'id' })
      if (!astErr) stats.asetUploaded = rows.length
      updateProgress('Aset', inventory.aset.length, `Berhasil menyimpan ${stats.asetUploaded} aset inventaris`)
    }

    // --------------------------------------------------------------------------
    // 9. DAFU APPROVALS (Jika ada tabel)
    // --------------------------------------------------------------------------
    if (inventory.approvals.length > 0) {
      try {
        const rows = inventory.approvals.map((ap: any) => ({
          id: ensureUuid('appr', ap.id, `${ap.lingkungan_id}:${ap.nama_kk}`),
          lingkungan_id: resolveLingkunganId(ap.lingkungan_id),
          nama_lingkungan: ap.nama_lingkungan || 'Lingkungan',
          kk_id: ap.kk_id ? (kkIdUuidMap.get(ap.kk_id) || (isValidUuid(ap.kk_id) ? ap.kk_id : null)) : null,
          action_type: ap.action_type || 'TAMBAH_KK',
          nama_kk: ap.nama_kk,
          alamat: ap.alamat || null,
          is_biduk: ap.is_biduk !== false,
          golongan: ap.golongan || 'Sejahtera',
          kriteria_catatan: ap.kriteria_catatan || null,
          status: ap.status || 'PENDING',
          alasan_penolakan: ap.alasan_penolakan || null,
          submitted_by: ap.submitted_by || 'SEKRETARIS',
          created_at: ap.created_at || new Date().toISOString()
        }))
        const { error: apprErr } = await supabase.from('dafu_approvals').upsert(rows, { onConflict: 'id' })
        if (!apprErr) stats.approvalsUploaded = rows.length
      } catch (e) {}
      updateProgress('Approval', inventory.approvals.length, 'Sinkronisasi riwayat approval selesai')
    }

    if (onProgress) {
      onProgress({
        percent: 100,
        currentModule: 'Selesai',
        currentCount: total,
        totalCount: total,
        message: 'Seluruh data berhasil dipindahkan ke Database Cloud Supabase!'
      })
    }

    // Trigger reactive window events so open pages re-fetch from database immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('dafuDataUpdated'))
      window.dispatchEvent(new Event('financialDataUpdated'))
      window.dispatchEvent(new Event('storage'))
    }

    return {
      success: true,
      stats
    }
  } catch (err: any) {
    console.error('Fatal exception in executeMigrationToSupabase:', err)
    return {
      success: false,
      stats,
      error: err?.message || 'Terjadi kesalahan sistem saat memindahkan data.'
    }
  }
}

/**
 * Safely removes migrated local storage keys from the browser.
 */
export function clearMigratedLocalStorage(): void {
  if (typeof window === 'undefined') return

  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k) continue
    if (
      k.startsWith('custom_journals_') ||
      k.startsWith('custom_kks_') ||
      k.startsWith('custom_assets_') ||
      k.startsWith('custom_golongan_') ||
      k.startsWith('profil_manual_') ||
      k.startsWith('pengurus_manual_') ||
      k === 'custom_anggota_all_store' ||
      k === 'dafu_approvals_store'
    ) {
      keysToRemove.push(k)
    }
  }

  keysToRemove.forEach(k => localStorage.removeItem(k))
}
