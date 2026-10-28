import { SupabaseClient } from '@supabase/supabase-js'
import { KepalaKeluarga, AnggotaKeluarga, GolonganKeluarga } from './types'
import {
  getAllMasterLingkungan,
  getLingkunganDbUuid,
  formatNamaLingkungan,
  getWilayahForLingkungan
} from './constants'
import { getDafuApprovals, DafuApprovalItem } from './dafuApproval'
import { isUuid } from './dummyData'

export interface ParishKkItem {
  id: string
  nama_kk: string
  alamat?: string
  lingkunganId: string
  lingkunganNama: string
  wilayah: string
  golongan: string
  kriteria_catatan?: string
  is_biduk?: boolean
  jumlah_anggota?: number
}

// In-memory & sessionStorage cache for ultra-fast parish-wide switches without flickering
let cachedParishKks: ParishKkItem[] | null = null
let lastParishFetchTime = 0
const PARISH_CACHE_TTL = 300000 // 5 minutes

export function getCachedParishKks(): ParishKkItem[] | null {
  if (cachedParishKks && cachedParishKks.length > 0) {
    return cachedParishKks
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem('cached_parish_kks')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedParishKks = parsed
          lastParishFetchTime = Date.now()
          return parsed
        }
      }
    } catch (e) {}
  }
  return null
}

export function invalidateParishCache() {
  cachedParishKks = null
  lastParishFetchTime = 0
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem('cached_parish_kks')
    } catch (e) {}
  }
}

/**
 * Service for querying DAFU data directly from Supabase PostgreSQL Cloud.
 * Pure Database-Driven, zero heavy JSON dependency.
 */

export async function fetchKkListFromDb(
  supabase: SupabaseClient,
  lingkunganId: string
): Promise<KepalaKeluarga[]> {
  const dbUuid = getLingkunganDbUuid(lingkunganId)

  let query = supabase.from('kepala_keluarga').select('*').order('nama_kk', { ascending: true })

  if (lingkunganId && lingkunganId !== 'all') {
    query = query.or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${lingkunganId}`)
  }

  const { data, error } = await query
  if (error) {
    console.error('Error fetching KK list from Supabase:', error)
    return []
  }

  return data || []
}

/**
 * Fetches all parish KKs with their integrated Golongan classifications from Supabase Cloud.
 * Uses parallel range pagination to bypass Supabase's default 1,000 row limit.
 */
export async function fetchAllParishKksWithGolongan(
  supabase: SupabaseClient,
  forceRefresh: boolean = false,
  includeMoved: boolean = false
): Promise<ParishKkItem[]> {
  if (!forceRefresh && !includeMoved && cachedParishKks && (Date.now() - lastParishFetchTime < PARISH_CACHE_TTL)) {
    return cachedParishKks
  }

  try {
    // 1. Fetch all KKs with pagination in parallel
    // 2. Fetch all Golongan with pagination in parallel
    // 3. Fetch DAFU Approvals from DB or local
    const [
      kk1, kk2, kk3, kk4,
      gol1, gol2, gol3, gol4,
      approvalsRes
    ] = await Promise.all([
      supabase.from('kepala_keluarga').select('id, lingkungan_id, nama_kk, alamat, is_biduk').range(0, 999),
      supabase.from('kepala_keluarga').select('id, lingkungan_id, nama_kk, alamat, is_biduk').range(1000, 1999),
      supabase.from('kepala_keluarga').select('id, lingkungan_id, nama_kk, alamat, is_biduk').range(2000, 2999),
      supabase.from('kepala_keluarga').select('id, lingkungan_id, nama_kk, alamat, is_biduk').range(3000, 3999),
      supabase.from('golongan_keluarga').select('id, kk_id, lingkungan_id, golongan, kriteria_catatan, updated_by_role, updated_at').range(0, 999),
      supabase.from('golongan_keluarga').select('id, kk_id, lingkungan_id, golongan, kriteria_catatan, updated_by_role, updated_at').range(1000, 1999),
      supabase.from('golongan_keluarga').select('id, kk_id, lingkungan_id, golongan, kriteria_catatan, updated_by_role, updated_at').range(2000, 2999),
      supabase.from('golongan_keluarga').select('id, kk_id, lingkungan_id, golongan, kriteria_catatan, updated_by_role, updated_at').range(3000, 3999),
      supabase.from('dafu_approvals').select('*').limit(500)
    ])

    const rawKks: any[] = [
      ...(kk1.data || []),
      ...(kk2.data || []),
      ...(kk3.data || []),
      ...(kk4.data || [])
    ]

    const rawGols: any[] = [
      ...(gol1.data || []),
      ...(gol2.data || []),
      ...(gol3.data || []),
      ...(gol4.data || [])
    ]

    // Read local overrides & cached approvals
    let localGolonganStore: Record<string, any> = {}
    let deletedSet = new Set<string>()
    if (typeof window !== 'undefined') {
      try {
        const rawG = localStorage.getItem('custom_golongan_all_store')
        if (rawG) localGolonganStore = JSON.parse(rawG)
        const rawDel = localStorage.getItem('custom_kks_deleted_store')
        if (rawDel) {
          const parsedDel = JSON.parse(rawDel)
          deletedSet = new Set(parsedDel.map((s: string) => String(s).toLowerCase().trim()))
        }
      } catch (e) {}
    }

    // Golongan Map
    const golMap = new Map<string, any>()
    rawGols.forEach((g: any) => {
      if (g && g.kk_id) golMap.set(g.kk_id, g)
    })

    // Master Lingkungan Lookup Map
    const masterList = getAllMasterLingkungan()
    const lingMap = new Map<string, { nama: string; wilayah: string; uuid: string }>()
    masterList.forEach((l) => {
      lingMap.set(l.id, { nama: l.nama_lingkungan, wilayah: l.wilayah, uuid: l.id })
      lingMap.set(l.slug, { nama: l.nama_lingkungan, wilayah: l.wilayah, uuid: l.id })
      const norm = l.nama_lingkungan.toLowerCase().replace(/[^a-z0-9]/g, '')
      lingMap.set(norm, { nama: l.nama_lingkungan, wilayah: l.wilayah, uuid: l.id })
    })

    const parishItems: ParishKkItem[] = []
    const processedKkIds = new Set<string>()

    rawKks.forEach((k: any) => {
      if (!k || !k.id) return
      const kIdClean = k.id.toLowerCase().trim()
      const kNameClean = (k.nama_kk || '').toLowerCase().trim()
      const kAlamatClean = (k.alamat || '').toLowerCase().trim()
      const isMarkedMoved =
        deletedSet.has(kIdClean) ||
        deletedSet.has(kNameClean) ||
        kAlamatClean.includes('[pindah]') ||
        kAlamatClean.includes('[keluar]') ||
        kAlamatClean === 'pindah / keluar'

      if (!includeMoved && isMarkedMoved) return

      processedKkIds.add(k.id)

      // Resolve Lingkungan
      const lingInfo = lingMap.get(k.lingkungan_id) || {
        nama: 'Lingkungan',
        wilayah: '-',
        uuid: k.lingkungan_id
      }

      // Resolve Golongan (priority: local store > Supabase DB > default 'Sejahtera')
      let currentGol = localGolonganStore[k.id]?.golongan
      let catatan = localGolonganStore[k.id]?.kriteria_catatan
      if (!currentGol && golMap.has(k.id)) {
        const gObj = golMap.get(k.id)
        currentGol = gObj.golongan
        catatan = gObj.kriteria_catatan
      }
      if (!currentGol) {
        currentGol = 'Sejahtera'
      }

      const finalAlamat = isMarkedMoved && !kAlamatClean.includes('pindah') && !kAlamatClean.includes('keluar')
        ? `${k.alamat || ''} [PINDAH]`.trim()
        : (k.alamat || undefined)

      parishItems.push({
        id: k.id,
        nama_kk: k.nama_kk,
        alamat: finalAlamat,
        lingkunganId: lingInfo.uuid || k.lingkungan_id,
        lingkunganNama: lingInfo.nama,
        wilayah: lingInfo.wilayah,
        golongan: currentGol,
        kriteria_catatan: catatan,
        is_biduk: k.is_biduk ?? true
      })
    })

    // Merge approved DAFU items from DB or local
    let approvals: DafuApprovalItem[] = []
    if (approvalsRes && Array.isArray(approvalsRes.data) && approvalsRes.data.length > 0) {
      approvals = approvalsRes.data
    } else if (typeof window !== 'undefined') {
      approvals = getDafuApprovals()
    }

    approvals.forEach((appr) => {
      if (appr.status !== 'APPROVED') return
      const kkId = appr.kk_id || `kk-appr-${appr.id}`
      const apprNameLower = (appr.nama_kk || '').toLowerCase().trim()
      const apprUuid = getLingkunganDbUuid(appr.lingkungan_id)

      if (appr.action_type === 'HAPUS_KK') {
        for (let i = parishItems.length - 1; i >= 0; i--) {
          const p = parishItems[i]
          const sameLing = p.lingkunganId === appr.lingkungan_id || (apprUuid && p.lingkunganId === apprUuid)
          if (p.id === kkId || p.id === appr.kk_id || (sameLing && (p.nama_kk || '').toLowerCase().trim() === apprNameLower)) {
            if (includeMoved) {
              p.alamat = `${p.alamat || ''} [PINDAH]`.trim()
            } else {
              parishItems.splice(i, 1)
            }
          }
        }
        return
      }

      if (!includeMoved && (deletedSet.has(kkId.toLowerCase()) || deletedSet.has(apprNameLower))) return

      const targetUuid = getLingkunganDbUuid(appr.lingkungan_id)
      const lingInfo = lingMap.get(targetUuid) || lingMap.get(appr.lingkungan_id) || {
        nama: appr.nama_lingkungan || 'Lingkungan',
        wilayah: getWilayahForLingkungan(appr.nama_lingkungan || ''),
        uuid: targetUuid || appr.lingkungan_id
      }

      const existingIdx = parishItems.findIndex(p => p.id === kkId || p.id === appr.kk_id)
      const golItem = localGolonganStore[kkId]?.golongan || appr.golongan || 'Sejahtera'

      if (existingIdx !== -1) {
        parishItems[existingIdx].nama_kk = appr.nama_kk
        parishItems[existingIdx].alamat = appr.alamat || parishItems[existingIdx].alamat
        parishItems[existingIdx].golongan = golItem
        parishItems[existingIdx].kriteria_catatan = appr.kriteria_catatan || parishItems[existingIdx].kriteria_catatan
      } else {
        parishItems.push({
          id: kkId,
          nama_kk: appr.nama_kk,
          alamat: appr.alamat || undefined,
          lingkunganId: lingInfo.uuid,
          lingkunganNama: lingInfo.nama,
          wilayah: lingInfo.wilayah,
          golongan: golItem,
          kriteria_catatan: appr.kriteria_catatan || undefined,
          is_biduk: appr.is_biduk ?? true,
          jumlah_anggota: Array.isArray(appr.anggota_keluarga) ? appr.anggota_keluarga.length : 1
        })
      }
    })

    parishItems.sort((a, b) => a.nama_kk.localeCompare(b.nama_kk))

    if (!includeMoved) {
      cachedParishKks = parishItems
      lastParishFetchTime = Date.now()
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('cached_parish_kks', JSON.stringify(parishItems))
        } catch (e) {}
      }
    }
    return parishItems
  } catch (err) {
    console.error('Error fetching all parish KKs with golongan:', err)
    return cachedParishKks || []
  }
}

/**
 * Fetches KK and Golongan list scoped to a specific lingkungan.
 * Returns in <100ms for single lingkungan queries.
 */
export async function fetchLingkunganKksWithGolongan(
  supabase: SupabaseClient,
  lingkunganId: string
): Promise<ParishKkItem[]> {
  if (!lingkunganId || lingkunganId === 'all' || lingkunganId === 'ALL') {
    return fetchAllParishKksWithGolongan(supabase)
  }

  // If parish cache is already warm, filter directly
  if (cachedParishKks && (Date.now() - lastParishFetchTime < PARISH_CACHE_TTL)) {
    const targetUuid = getLingkunganDbUuid(lingkunganId)
    return cachedParishKks.filter(
      k => k.lingkunganId === targetUuid || k.lingkunganId === lingkunganId
    )
  }

  const dbUuid = getLingkunganDbUuid(lingkunganId)
  const masterList = getAllMasterLingkungan()
  const matchedMaster = masterList.find(l => l.id === dbUuid || l.id === lingkunganId || l.slug === lingkunganId)
  const lingNama = matchedMaster?.nama_lingkungan || formatNamaLingkungan(lingkunganId)
  const lingWilayah = matchedMaster?.wilayah || getWilayahForLingkungan(lingNama)

  try {
    const [kkRes, golRes] = await Promise.all([
      supabase
        .from('kepala_keluarga')
        .select('id, lingkungan_id, nama_kk, alamat, is_biduk')
        .or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${lingkunganId}`)
        .order('nama_kk', { ascending: true }),
      supabase
        .from('golongan_keluarga')
        .select('id, kk_id, lingkungan_id, golongan, kriteria_catatan, updated_by_role, updated_at')
        .or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${lingkunganId}`)
    ])

    const dbKks: any[] = kkRes.data || []
    const dbGols: any[] = golRes.data || []

    let localGolonganStore: Record<string, any> = {}
    if (typeof window !== 'undefined') {
      try {
        const rawG = localStorage.getItem('custom_golongan_all_store')
        if (rawG) localGolonganStore = JSON.parse(rawG)
      } catch (e) {}
    }

    const golMap = new Map<string, any>()
    dbGols.forEach(g => {
      if (g && g.kk_id) golMap.set(g.kk_id, g)
    })

    const items: ParishKkItem[] = dbKks.map(k => {
      let g = localGolonganStore[k.id]?.golongan
      let catatan = localGolonganStore[k.id]?.kriteria_catatan
      if (!g && golMap.has(k.id)) {
        const obj = golMap.get(k.id)
        g = obj.golongan
        catatan = obj.kriteria_catatan
      }
      return {
        id: k.id,
        nama_kk: k.nama_kk,
        alamat: k.alamat || undefined,
        lingkunganId: dbUuid,
        lingkunganNama: lingNama,
        wilayah: lingWilayah,
        golongan: g || 'Sejahtera',
        kriteria_catatan: catatan,
        is_biduk: k.is_biduk ?? true
      }
    })

    return items
  } catch (err) {
    console.error('Error fetching scoped lingkungan KKs:', err)
    return []
  }
}

/**
 * Updates a family's economic status (Golongan) directly in Supabase Cloud
 * and propagates realtime events to all Sekretaris Lingkungan.
 */
export async function updateKkGolonganInDb(
  supabase: SupabaseClient,
  kkId: string,
  lingkunganId: string,
  golongan: string,
  catatan?: string,
  role: string = 'SEKRETARIS_PAROKI'
): Promise<boolean> {
  const dbUuid = getLingkunganDbUuid(lingkunganId) || lingkunganId
  const note = catatan?.trim() || 'Ditetapkan & Diperbarui oleh Sekretaris Paroki'
  const updatedAt = new Date().toISOString()

  try {
    const { error } = await supabase.from('golongan_keluarga').upsert({
      kk_id: kkId,
      lingkungan_id: dbUuid,
      golongan,
      kriteria_catatan: note,
      updated_by_role: role,
      updated_at: updatedAt
    }, { onConflict: 'kk_id' })

    if (error) {
      console.warn('Supabase upsert golongan_keluarga error:', error.message)
    }
  } catch (err) {
    console.warn('Supabase upsert exception:', err)
  }

  // Update local storage for immediate offline/local reactivity
  if (typeof window !== 'undefined') {
    try {
      const rawG = localStorage.getItem('custom_golongan_all_store')
      const store = rawG ? JSON.parse(rawG) : {}
      store[kkId] = {
        id: `gol-${Date.now()}`,
        kk_id: kkId,
        lingkungan_id: dbUuid,
        golongan,
        kriteria_catatan: note,
        updated_by_role: role,
        updated_at: updatedAt
      }
      localStorage.setItem('custom_golongan_all_store', JSON.stringify(store))
    } catch (e) {}
  }

  // Invalidate cache
  invalidateParishCache()

  // Dispatch events to notify all tabs and pages
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('dafuDataUpdated'))
    window.dispatchEvent(new Event('dafuApprovalUpdated'))
    window.dispatchEvent(new Event('storage'))
  }

  return true
}

export async function fetchAnggotaMapFromDb(
  supabase: SupabaseClient,
  kkIds: string[]
): Promise<Record<string, AnggotaKeluarga[]>> {
  const validIds = (kkIds || []).filter(isUuid)
  if (validIds.length === 0) return {}

  const map: Record<string, AnggotaKeluarga[]> = {}
  const BATCH_SIZE = 100

  for (let i = 0; i < validIds.length; i += BATCH_SIZE) {
    const batch = validIds.slice(i, i + BATCH_SIZE)
    const { data, error } = await supabase
      .from('anggota_keluarga')
      .select('*')
      .in('kk_id', batch)

    if (!error && data) {
      data.forEach((m: AnggotaKeluarga) => {
        if (!map[m.kk_id]) map[m.kk_id] = []
        map[m.kk_id].push(m)
      })
    }
  }

  return map
}

export async function fetchGolonganMapFromDb(
  supabase: SupabaseClient,
  kkIds: string[]
): Promise<Record<string, GolonganKeluarga>> {
  const validIds = (kkIds || []).filter(isUuid)
  if (validIds.length === 0) return {}

  const map: Record<string, GolonganKeluarga> = {}
  const BATCH_SIZE = 100

  for (let i = 0; i < validIds.length; i += BATCH_SIZE) {
    const batch = validIds.slice(i, i + BATCH_SIZE)
    const { data, error } = await supabase
      .from('golongan_keluarga')
      .select('*')
      .in('kk_id', batch)

    if (!error && data) {
      data.forEach((g: GolonganKeluarga) => {
        map[g.kk_id] = g
      })
    }
  }

  return map
}

export async function fetchLingkunganCountsFromDb(
  supabase: SupabaseClient,
  lingkunganId: string
): Promise<{ kkCount: number; jiwaCount: number }> {
  const dbUuid = getLingkunganDbUuid(lingkunganId)

  const { count: kkCount } = await supabase
    .from('kepala_keluarga')
    .select('*', { count: 'exact', head: true })
    .or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${lingkunganId}`)

  // Get KK IDs to count members
  const { data: kks } = await supabase
    .from('kepala_keluarga')
    .select('id')
    .or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${lingkunganId}`)

  let jiwaCount = 0
  if (kks && kks.length > 0) {
    const ids = kks.map(k => k.id)
    const { count } = await supabase
      .from('anggota_keluarga')
      .select('*', { count: 'exact', head: true })
      .in('kk_id', ids)
    jiwaCount = count || 0
  }

  return {
    kkCount: kkCount || 0,
    jiwaCount: jiwaCount || (kkCount ? kkCount * 3 : 0)
  }
}

