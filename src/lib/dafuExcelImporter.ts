import * as XLSX from 'xlsx'
import {
  MASTER_LINGKUNGAN_UUID_MAP,
  getAllMasterLingkungan,
  getLingkunganDbUuid
} from './constants'
import { PeranKeluarga, KategoriGolongan } from './types'
import { toDeterministicUuid } from './uuid'

export interface ParsedMemberItem {
  id?: string
  no_anggota?: string
  nama: string
  peran: PeranKeluarga
  jenis_kelamin?: string
  is_kaj: boolean
  keterangan?: string
}

export interface ParsedKkItem {
  id: string
  no_kk: string
  lingkungan_id: string
  nama_lingkungan: string
  wilayah?: string
  nama_kk: string
  alamat: string
  telepon?: string
  is_biduk: boolean
  golongan: KategoriGolongan
  kriteria_catatan?: string
  anggota: ParsedMemberItem[]
}

export interface ParsedDafuResult {
  summary: {
    totalRows: number
    totalKks: number
    totalJiwa: number
    lingkunganCount: number
    unmappedRowsCount: number
  }
  kks: ParsedKkItem[]
  byLingkungan: Array<{
    lingkunganId: string
    namaLingkungan: string
    kkCount: number
    jiwaCount: number
  }>
  unmappedRows: any[]
}

/**
 * Normalizes string for key lookup
 */
function normalizeKey(str: string): string {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Intelligently resolves raw Lingkungan names (e.g. "AGNES 1", "PADRE PIO 2", "St. Agnes 1")
 * to the authoritative Lingkungan UUID and official standard name.
 */
export function resolveLingkunganName(rawInput: string): { id: string; nama_lingkungan: string } | null {
  if (!rawInput) return null
  const clean = String(rawInput).trim()

  // 1. Direct match in MASTER_LINGKUNGAN_UUID_MAP
  if (MASTER_LINGKUNGAN_UUID_MAP[clean]) {
    return { id: MASTER_LINGKUNGAN_UUID_MAP[clean], nama_lingkungan: clean }
  }

  // 2. Try prefixing "St. "
  const withSt = `St. ${clean}`
  if (MASTER_LINGKUNGAN_UUID_MAP[withSt]) {
    return { id: MASTER_LINGKUNGAN_UUID_MAP[withSt], nama_lingkungan: withSt }
  }

  // 3. Wilayah alias matcher
  const WILAYAH_ALIAS_MAP: Array<{ match: RegExp; prefix: string; max: number }> = [
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
  ]

  const numMatch = clean.match(/\d+/)
  const num = numMatch ? parseInt(numMatch[0], 10) : 1
  const cleanNormalized = clean.toLowerCase().replace(/[^a-z0-9]/g, '')

  for (const alias of WILAYAH_ALIAS_MAP) {
    if (alias.match.test(cleanNormalized)) {
      const validNum = Math.min(Math.max(num, 1), alias.max)
      const targetName = `${alias.prefix} ${validNum}`
      if (MASTER_LINGKUNGAN_UUID_MAP[targetName]) {
        return { id: MASTER_LINGKUNGAN_UUID_MAP[targetName], nama_lingkungan: targetName }
      }
    }
  }

  // 4. Fallback search through all master lingkungan
  const all = getAllMasterLingkungan()
  const found = all.find(l => {
    const lClean = l.nama_lingkungan.toLowerCase().replace(/[^a-z0-9]/g, '')
    return lClean === cleanNormalized || lClean.replace(/^st/, '') === cleanNormalized
  })
  if (found) {
    return { id: found.id, nama_lingkungan: found.nama_lingkungan }
  }

  return null
}

/**
 * Normalizes Peran / Hubungan Keluarga
 */
function normalizePeran(raw: string): PeranKeluarga {
  const r = (raw || '').toLowerCase().trim()
  if (r.includes('kepala keluarga') || r.includes('00 kepala')) return 'Kepala Keluarga'
  if (r.includes('suami')) return 'Suami'
  if (r.includes('istri')) return 'Istri'
  if (r.includes('anak')) return 'Anak'
  if (r.includes('orang tua') || r.includes('ayah') || r.includes('ibu') || r.includes('mertua')) return 'Orang Tua'
  return 'Famili Lain'
}

/**
 * Normalizes Status Kesejahteraan / Golongan
 */
function normalizeGolongan(raw: string): KategoriGolongan {
  const g = (raw || '').toLowerCase().trim()
  if (g.includes('tidak mampu')) return 'Tidak Mampu'
  if (g.includes('rentan')) return 'Rentan Tidak Mampu'
  if (g.includes('terduga') || g.includes('prasejahtera') || g.includes('pra sejahtera')) return 'Terduga Prasejahtera'
  return 'Sejahtera'
}

/**
 * Parses an Excel or CSV file buffer and converts it into a grouped DAFU dataset.
 */
export async function parseDafuExcelOrCsv(fileBuffer: ArrayBuffer): Promise<ParsedDafuResult> {
  const wb = XLSX.read(fileBuffer, { type: 'array' })
  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    throw new Error('File tidak memiliki sheet yang valid.')
  }

  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  if (!rawRows || rawRows.length === 0) {
    throw new Error('File kosong atau tidak memiliki baris data.')
  }

  // Detect column mapping dynamically
  const sample = rawRows[0] || {}
  const keys = Object.keys(sample)

  const findKey = (pattern: RegExp): string => {
    return keys.find(k => pattern.test(k.trim())) || ''
  }

  const keyLingkungan = findKey(/(?:nama\s*)?lingkungan/i)
  const keyWilayah = findKey(/wilayah/i)
  const keyNoKk = findKey(/(?:nomor|no)\s*(?:kartu\s*keluarga|kk)/i)
  const keyNoAnggota = findKey(/(?:nomor|no)\s*anggota/i)
  const keyNamaLengkap = findKey(/(?:nama\s*lengkap|nama)/i)
  const keyHubungan = findKey(/(?:hubungan|peran|status\s*hubungan)/i)
  const keyJenisKelamin = findKey(/(?:jenis\s*kelamin|gender|jk)/i)
  const keyAlamat = findKey(/alamat/i)
  const keyRt = findKey(/^rt\b/i)
  const keyRw = findKey(/^rw\b/i)
  const keyKelurahan = findKey(/kelurahan/i)
  const keyKecamatan = findKey(/kecamatan/i)
  const keyTelepon = findKey(/(?:telepon|telp|hp|kontak)/i)
  const keyStatusKesejahteraan = findKey(/(?:kesejahteraan|golongan|status|desil)/i)

  const groupedKkMap = new Map<string, any[]>()
  const unmappedRows: any[] = []

  rawRows.forEach((row, idx) => {
    const rawLing = String(row[keyLingkungan] || '').trim()
    const resolvedLing = resolveLingkunganName(rawLing)

    if (!resolvedLing) {
      unmappedRows.push({ rowIndex: idx + 2, rawLing, row })
      return
    }

    let noKk = String(row[keyNoKk] || '').trim()
    if (!noKk) {
      // Fallback identifier if no_kk is empty
      const nama = String(row[keyNamaLengkap] || '').trim()
      noKk = `GEN-${resolvedLing.id.slice(0, 8)}-${nama.toLowerCase().replace(/[^a-z0-9]/g, '')}`
    }

    const groupKey = `${resolvedLing.id}__${noKk}`
    if (!groupedKkMap.has(groupKey)) {
      groupedKkMap.set(groupKey, [])
    }
    groupedKkMap.get(groupKey)!.push({
      ...row,
      __resolvedLing: resolvedLing
    })
  })

  const parsedKks: ParsedKkItem[] = []
  const lingkunganStatsMap = new Map<string, { nama: string; kkCount: number; jiwaCount: number }>()

  groupedKkMap.forEach((members, groupKey) => {
    const firstRow = members[0]
    const resolvedLing = firstRow.__resolvedLing
    const noKk = String(firstRow[keyNoKk] || '').trim() || groupKey.split('__')[1]

    // Find head of family (Kepala Keluarga)
    let headMember = members.find(m => {
      const hub = String(m[keyHubungan] || '')
      return hub.includes('00 Kepala') || hub.toLowerCase().includes('kepala keluarga')
    })
    if (!headMember) {
      headMember = members[0]
    }

    const rawAlamat = String(headMember[keyAlamat] || firstRow[keyAlamat] || '').trim()
    const rt = String(headMember[keyRt] || firstRow[keyRt] || '').trim()
    const rw = String(headMember[keyRw] || firstRow[keyRw] || '').trim()
    const kel = String(headMember[keyKelurahan] || firstRow[keyKelurahan] || '').trim()
    const kec = String(headMember[keyKecamatan] || firstRow[keyKecamatan] || '').trim()

    const addrParts = [
      rawAlamat,
      rt ? `RT ${rt.padStart(3, '0')}` : '',
      rw ? `RW ${rw.padStart(2, '0')}` : '',
      kel,
      kec
    ].filter(Boolean)
    const combinedAlamat = addrParts.join(', ')

    const telepon = String(headMember[keyTelepon] || firstRow[keyTelepon] || '').trim()
    const rawGolongan = String(headMember[keyStatusKesejahteraan] || firstRow[keyStatusKesejahteraan] || '').trim()
    const golongan = normalizeGolongan(rawGolongan)

    const kkId = toDeterministicUuid('kk', `${resolvedLing.id}:${noKk}`)

    const parsedMembers: ParsedMemberItem[] = members.map((m, mIdx) => {
      const mNama = String(m[keyNamaLengkap] || '').trim()
      const mNoAnggota = String(m[keyNoAnggota] || '').trim()
      const mPeran = normalizePeran(String(m[keyHubungan] || ''))
      const mJk = String(m[keyJenisKelamin] || '').toUpperCase().trim()
      const memberId = toDeterministicUuid('mem', `${kkId}:${mNoAnggota || (mNama + '_' + (mIdx + 1))}`)

      return {
        id: memberId,
        no_anggota: mNoAnggota || undefined,
        nama: mNama,
        peran: mPeran,
        jenis_kelamin: mJk || undefined,
        is_kaj: true,
        keterangan: `${m[keyHubungan] || mPeran}${mJk ? ` (${mJk})` : ''}`
      }
    })

    const kkItem: ParsedKkItem = {
      id: kkId,
      no_kk: noKk,
      lingkungan_id: resolvedLing.id,
      nama_lingkungan: resolvedLing.nama_lingkungan,
      wilayah: String(firstRow[keyWilayah] || '').trim() || undefined,
      nama_kk: String(headMember[keyNamaLengkap] || 'Keluarga').trim(),
      alamat: combinedAlamat,
      telepon: telepon || undefined,
      is_biduk: true,
      golongan: golongan,
      kriteria_catatan: `Status Kesejahteraan: ${golongan}`,
      anggota: parsedMembers
    }

    parsedKks.push(kkItem)

    // Update stats
    if (!lingkunganStatsMap.has(resolvedLing.id)) {
      lingkunganStatsMap.set(resolvedLing.id, {
        nama: resolvedLing.nama_lingkungan,
        kkCount: 0,
        jiwaCount: 0
      })
    }
    const stat = lingkunganStatsMap.get(resolvedLing.id)!
    stat.kkCount += 1
    stat.jiwaCount += parsedMembers.length
  })

  // Sort KKs by nama_lingkungan, then nama_kk
  parsedKks.sort((a, b) => {
    const cmp = a.nama_lingkungan.localeCompare(b.nama_lingkungan)
    if (cmp !== 0) return cmp
    return a.nama_kk.localeCompare(b.nama_kk)
  })

  const byLingkungan = Array.from(lingkunganStatsMap.entries()).map(([id, s]) => ({
    lingkunganId: id,
    namaLingkungan: s.nama,
    kkCount: s.kkCount,
    jiwaCount: s.jiwaCount
  })).sort((a, b) => a.namaLingkungan.localeCompare(b.namaLingkungan))

  return {
    summary: {
      totalRows: rawRows.length,
      totalKks: parsedKks.length,
      totalJiwa: parsedKks.reduce((acc, k) => acc + k.anggota.length, 0),
      lingkunganCount: byLingkungan.length,
      unmappedRowsCount: unmappedRows.length
    },
    kks: parsedKks,
    byLingkungan,
    unmappedRows
  }
}

/**
 * Uploads parsed DAFU items in batches to Supabase database tables:
 * - public.kepala_keluarga
 * - public.anggota_keluarga
 * - public.golongan_keluarga
 * - public.riwayat_import_dafu
 */
export async function uploadDafuParsedDataToSupabase(
  supabase: any,
  parsedKks: ParsedKkItem[],
  options: {
    userRole?: string
    userLingkunganId?: string | null
    fileName?: string
    fileSizeBytes?: number
    onProgress?: (percent: number, currentKk: number, totalKk: number, message: string) => void
  } = {}
): Promise<{ success: boolean; totalKksInserted: number; totalJiwaInserted: number; error?: string }> {
  const { userRole, userLingkunganId, fileName, fileSizeBytes, onProgress } = options

  // Security check: If not PAROKI / SEKRETARIS_PAROKI, restrict upload strictly to user's Lingkungan
  let targetKks = parsedKks
  if (userRole && userRole !== 'PAROKI' && userRole !== 'SEKRETARIS_PAROKI' && userLingkunganId) {
    const userDbUuid = getLingkunganDbUuid(userLingkunganId)
    targetKks = parsedKks.filter(k => k.lingkungan_id === userLingkunganId || k.lingkungan_id === userDbUuid)
  }

  if (targetKks.length === 0) {
    return { success: false, totalKksInserted: 0, totalJiwaInserted: 0, error: 'Tidak ada data keluarga yang sesuai dengan hak akses lingkungan Anda.' }
  }

  const BATCH_SIZE = 100
  let totalKksInserted = 0
  let totalJiwaInserted = 0
  const totalKks = targetKks.length

  try {
    for (let i = 0; i < totalKks; i += BATCH_SIZE) {
      const batch = targetKks.slice(i, i + BATCH_SIZE)
      const currentCount = Math.min(i + batch.length, totalKks)
      const percent = Math.round((currentCount / totalKks) * 100)

      if (onProgress) {
        onProgress(percent, currentCount, totalKks, `Menyimpan keluarga ${currentCount} dari ${totalKks} ke database...`)
      }

      // 1. Prepare kepala_keluarga rows
      const kkRows = batch.map(k => ({
        id: k.id,
        lingkungan_id: k.lingkungan_id,
        nama_kk: k.nama_kk,
        no_kk: k.no_kk || null,
        alamat: k.alamat || null,
        telepon: k.telepon || null,
        is_biduk: k.is_biduk
      }))

      const { error: kkErr } = await supabase
        .from('kepala_keluarga')
        .upsert(kkRows, { onConflict: 'id' })

      if (kkErr) {
        console.error('Error batch upsert kepala_keluarga:', kkErr)
        throw new Error(`Gagal menyimpan data KK (batch ${i + 1}-${currentCount}): ${kkErr.message}`)
      }

      // 2. Prepare anggota_keluarga rows
      const memberRows: any[] = []
      batch.forEach(k => {
        k.anggota.forEach(m => {
          memberRows.push({
            id: m.id || toDeterministicUuid('mem', `${k.id}:${m.no_anggota || m.nama}`),
            kk_id: k.id,
            no_anggota: m.no_anggota || null,
            nama: m.nama,
            peran: m.peran,
            jenis_kelamin: m.jenis_kelamin || null,
            is_kaj: m.is_kaj,
            keterangan: m.keterangan || null
          })
        })
      })

      if (memberRows.length > 0) {
        const { error: memErr } = await supabase
          .from('anggota_keluarga')
          .upsert(memberRows, { onConflict: 'id' })

        if (memErr) {
          console.warn('Warning upsert anggota_keluarga:', memErr.message)
        }
      }

      // 3. Prepare golongan_keluarga rows
      const golRows = batch.map(k => ({
        id: toDeterministicUuid('gol', k.id),
        kk_id: k.id,
        lingkungan_id: k.lingkungan_id,
        golongan: k.golongan,
        kriteria_catatan: k.kriteria_catatan || 'Diimpor dari file data umat paroki',
        updated_by_role: userRole || 'SEKRETARIS_PAROKI',
        updated_at: new Date().toISOString()
      }))

      const { error: golErr } = await supabase
        .from('golongan_keluarga')
        .upsert(golRows, { onConflict: 'kk_id' })

      if (golErr) {
        console.warn('Warning upsert golongan_keluarga:', golErr.message)
      }

      totalKksInserted += batch.length
      totalJiwaInserted += memberRows.length
    }

    // 4. Record history into riwayat_import_dafu
    try {
      const distinctLingkungan = new Set(targetKks.map(k => k.lingkungan_id))
      await supabase.from('riwayat_import_dafu').insert({
        file_name: fileName || 'Data_Umat_Santa_Clara.xlsx',
        file_size_bytes: fileSizeBytes || 0,
        total_baris: parsedKks.reduce((acc, k) => acc + k.anggota.length, 0),
        total_kk: totalKksInserted,
        total_jiwa: totalJiwaInserted,
        lingkungan_terdampak: distinctLingkungan.size,
        uploaded_by: userRole || 'PAROKI',
        user_role: userRole || 'PAROKI',
        status: 'SUCCESS',
        catatan: `Berhasil mengimpor ${totalKksInserted} KK dan ${totalJiwaInserted} Jiwa terdistribusi ke ${distinctLingkungan.size} lingkungan.`
      })
    } catch (e) {
      console.warn('Notice logging riwayat import:', e)
    }

    if (onProgress) {
      onProgress(100, totalKks, totalKks, 'Penyimpanan ke database berhasil!')
    }

    // Trigger local events for instant UI reactivity
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('dafuDataUpdated'))
      window.dispatchEvent(new Event('storage'))
    }

    return {
      success: true,
      totalKksInserted,
      totalJiwaInserted
    }
  } catch (err: any) {
    console.error('Exception uploadDafuParsedDataToSupabase:', err)
    return {
      success: false,
      totalKksInserted,
      totalJiwaInserted,
      error: err?.message || 'Terjadi kesalahan saat menyimpan ke database.'
    }
  }
}
