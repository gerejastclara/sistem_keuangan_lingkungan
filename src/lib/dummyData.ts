import { KepalaKeluarga, AnggotaKeluarga, GolonganKeluarga, PeranKeluarga } from './types'
import rawLingkunganStats from '@/data/lingkunganStats.json'
import { getAllMasterLingkungan, getLingkunganDbUuid } from './constants'
import { getDafuApprovals } from './dafuApproval'

const lingkunganStatsMap = rawLingkunganStats as Record<string, { kkCount: number; jiwaCount: number }>

function normalizeLookupKey(key: string): string {
  if (!key) return ''
  return key
    .toLowerCase()
    .replace(/^lingkungan\s+/i, '')
    .replace(/^csv-/, '')
    .replace(/^st-?/i, '')
    .replace(/[^a-z0-9]/g, '')
}

// Auto-purge any legacy testing dummy data stored in browser localStorage
if (typeof window !== 'undefined') {
  try {
    const keysToPurge = ['custom_kks_all_store', 'custom_anggota_all_store', 'custom_golongan_all_store']
    keysToPurge.forEach(k => {
      const raw = localStorage.getItem(k)
      if (raw && (raw.includes('dummy-') || raw.includes('Anastasia Gunawan') || raw.includes('Petrus Sugeng') || raw.toLowerCase().includes('"dimas"') || raw.toLowerCase().includes('"nama_kk":"dimas"') || raw.toLowerCase().includes('test12') || raw.toLowerCase().includes('test 12'))) {
        localStorage.removeItem(k)
      }
    })
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('custom_kks_') || key.startsWith('custom_anggota_') || key.startsWith('custom_golongan_'))) {
        const val = localStorage.getItem(key)
        if (val && (val.includes('dummy-') || val.includes('Anastasia Gunawan') || val.includes('Petrus Sugeng') || val.toLowerCase().includes('"dimas"') || val.toLowerCase().includes('"nama_kk":"dimas"') || val.toLowerCase().includes('test12') || val.toLowerCase().includes('test 12'))) {
          localStorage.removeItem(key)
        }
      }
    }

    // Purge old dummy seeds from dafu_approvals_store
    const rawAppr = localStorage.getItem('dafu_approvals_store')
    if (rawAppr) {
      try {
        const parsed = JSON.parse(rawAppr)
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(a =>
            a.id !== '35fb2279-43d5-424d-b349-d95313d9901e' &&
            a.id !== 'ca43092a-537d-4604-b5ad-dbfb35de5c91' &&
            a.id !== '7ac5b273-c7a4-4176-a7d4-2658a8b892a1' &&
            !(a.nama_kk || '').toLowerCase().includes('test12') &&
            !(a.nama_kk || '').toLowerCase().includes('test 12')
          )
          localStorage.setItem('dafu_approvals_store', JSON.stringify(filtered))
        }
      } catch (e) {}
    }
  } catch (e) {}
}

/**
 * Compatibility helper. Real data is now fetched directly from Supabase Cloud.
 */
export function getRealKkListForLingkungan(_lingkunganId: string, _namaLingkungan?: string): KepalaKeluarga[] {
  return []
}

/**
 * Returns aggregate stats (kkCount, jiwaCount) for a Lingkungan in O(1) time.
 * Pure lightweight JSON (under 4 KB).
 */
export function getLingkunganStats(lingkunganId: string, namaLingkungan?: string): { kkCount: number; jiwaCount: number } {
  const normId = normalizeLookupKey(lingkunganId)
  if (normId && lingkunganStatsMap[normId]) return lingkunganStatsMap[normId]

  const normName = normalizeLookupKey(namaLingkungan || '')
  if (normName && lingkunganStatsMap[normName]) return lingkunganStatsMap[normName]

  if (lingkunganId) {
    const all = getAllMasterLingkungan()
    const targetUuid = getLingkunganDbUuid(lingkunganId)
    const found = all.find(l => l.id === lingkunganId || l.slug === lingkunganId || getLingkunganDbUuid(l.id) === targetUuid)
    if (found) {
      const fn = normalizeLookupKey(found.nama_lingkungan)
      if (fn && lingkunganStatsMap[fn]) return lingkunganStatsMap[fn]
    }
  }

  return { kkCount: 0, jiwaCount: 0 }
}

export const getDummyKkListForLingkungan = getRealKkListForLingkungan

/**
 * Merges Supabase cloud family list with any approved DAFU items and local overrides.
 */
export function ensureDummyKksForLingkungan(
  lingkunganId: string,
  namaLingkungan: string,
  existingList: KepalaKeluarga[],
  preloadedApprovals?: any[],
  _includeParishData: boolean = true
): KepalaKeluarga[] {
  let deletedSet = new Set<string>()
  if (typeof window !== 'undefined') {
    try {
      const dbUuid = getLingkunganDbUuid(lingkunganId)
      const rawAll = localStorage.getItem('custom_kks_deleted_store')
      const rawL = localStorage.getItem(`custom_kks_deleted_${lingkunganId}`)
      const rawU = dbUuid ? localStorage.getItem(`custom_kks_deleted_${dbUuid}`) : null
      const allD: string[] = rawAll ? JSON.parse(rawAll) : []
      const lD: string[] = rawL ? JSON.parse(rawL) : []
      const uD: string[] = rawU ? JSON.parse(rawU) : []
      deletedSet = new Set([...allD, ...lD, ...uD].map(s => String(s).toLowerCase().trim()))
    } catch (e) {}
  }

  const isDeleted = (id?: string | null, name?: string | null): boolean => {
    if (!id && !name) return false
    const idClean = (id || '').toLowerCase().trim()
    const nameClean = (name || '').toLowerCase().trim()
    if (idClean && deletedSet.has(idClean)) return true
    if (nameClean && deletedSet.has(nameClean)) return true
    if (idClean && idClean.startsWith('kk-appr-') && deletedSet.has(idClean.replace('kk-appr-', ''))) return true
    return false
  }

  const combinedMap = new Map<string, KepalaKeluarga>()

  // 1. Include cloud families fetched from Supabase
  if (existingList && existingList.length > 0) {
    existingList.forEach(k => {
      if (
        k &&
        k.id &&
        !k.id.startsWith('dummy-') &&
        !k.id.includes('dummy') &&
        !k.id.startsWith('kk-prop-') &&
        k.nama_kk.toLowerCase().trim() !== 'dimas' &&
        !k.nama_kk.toLowerCase().includes('test12') &&
        !k.nama_kk.toLowerCase().includes('test 12') &&
        !isDeleted(k.id, k.nama_kk)
      ) {
        combinedMap.set(k.id, k)
      }
    })
  }

  // 2. Merge officially approved families from DAFU Approval system
  try {
    const approvals = (preloadedApprovals && Array.isArray(preloadedApprovals) && preloadedApprovals.length > 0)
      ? preloadedApprovals
      : (typeof window !== 'undefined' ? getDafuApprovals() : [])
    const targetUuid = getLingkunganDbUuid(lingkunganId)
    const targetNorm = (namaLingkungan || '').toLowerCase().replace(/[^a-z0-9]/g, '')

    approvals.forEach(appr => {
      // Include APPROVED items, as well as PENDING items with TAMBAH_KK (new families submitted by Lingkungan awaiting Paroki approval)
      const isApproved = appr.status === 'APPROVED'
      const isPendingNewKk = appr.status === 'PENDING' && appr.action_type === 'TAMBAH_KK'
      if (!isApproved && !isPendingNewKk) return

      const apprUuid = getLingkunganDbUuid(appr.lingkungan_id)
      const apprNorm = (appr.nama_lingkungan || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      const matchesLingkungan =
        lingkunganId === 'all' ||
        appr.lingkungan_id === lingkunganId ||
        (targetUuid && apprUuid && targetUuid === apprUuid) ||
        (targetNorm && apprNorm && (targetNorm === apprNorm || targetNorm.includes(apprNorm) || apprNorm.includes(targetNorm)))

      if (!matchesLingkungan) return

      const kkId = appr.kk_id || `kk-appr-${appr.id}`

      // Skip if deleted by user
      if (isDeleted(kkId, appr.nama_kk) || isDeleted(appr.id, appr.nama_kk) || (appr.kk_id && isDeleted(appr.kk_id, appr.nama_kk))) {
        combinedMap.delete(kkId)
        if (appr.kk_id) combinedMap.delete(appr.kk_id)
        return
      }

      if (isApproved && appr.action_type === 'HAPUS_KK') {
        combinedMap.delete(kkId)
        if (appr.kk_id) combinedMap.delete(appr.kk_id)
        return
      }

      const mergedKk: KepalaKeluarga = {
        id: kkId,
        lingkungan_id: targetUuid || lingkunganId,
        nama_kk: appr.nama_kk,
        alamat: appr.alamat || '',
        is_biduk: appr.is_biduk,
        jumlah_anggota: Array.isArray(appr.anggota_keluarga) && appr.anggota_keluarga.length > 0 ? appr.anggota_keluarga.length : 1
      }

      combinedMap.set(kkId, mergedKk)
    })
  } catch (e) {
    console.warn('Notice merging approved DAFU items:', e)
  }

  return Array.from(combinedMap.values()).sort((a, b) => a.nama_kk.localeCompare(b.nama_kk))
}

export const isUuid = (id: string): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

/**
 * Returns family members for a given KK.
 * Real data is loaded from Supabase; this handles approvals or fallback defaults.
 */
export function getDummyAnggotaForKk(kk: KepalaKeluarga, customApprovals?: any[]): AnggotaKeluarga[] {
  if (!kk) return []

  // Check if this is an approved or pending DAFU approval
  if (typeof window !== 'undefined' || customApprovals) {
    try {
      const approvals = customApprovals && customApprovals.length > 0 ? customApprovals : getDafuApprovals()
      const foundAppr = approvals.find(a =>
        (a.status === 'APPROVED' || a.status === 'PENDING') &&
        (a.kk_id === kk.id ||
         a.id === kk.id ||
         `kk-appr-${a.id}` === kk.id ||
         `kk-prop-${a.id}` === kk.id ||
         (a.nama_kk && kk.nama_kk && a.nama_kk.toLowerCase().trim() === kk.nama_kk.toLowerCase().trim()))
      )
      if (foundAppr && Array.isArray(foundAppr.anggota_keluarga) && foundAppr.anggota_keluarga.length > 0) {
        return foundAppr.anggota_keluarga.map((m: any, idx: number) => ({
          id: m.id || `mem-${kk.id}-${idx}`,
          kk_id: kk.id,
          nama: m.nama,
          peran: (m.peran || 'Anggota') as PeranKeluarga,
          is_kaj: m.is_kaj,
          keterangan: m.keterangan || undefined
        }))
      }
    } catch (e) {}
  }

  // Fallback for newly created KK
  return [
    {
      id: `member-${kk.id}-1`,
      kk_id: kk.id,
      nama: kk.nama_kk,
      peran: 'Kepala Keluarga',
      is_kaj: kk.is_biduk ?? true,
      keterangan: 'Kepala Keluarga'
    }
  ]
}

export const getRealAnggotaForKk = getDummyAnggotaForKk

/**
 * Returns economic status (Golongan) for the family.
 * Real data is loaded from Supabase; this handles approvals or fallback defaults.
 */
export function getDummyGolonganForKk(kk: KepalaKeluarga, customApprovals?: any[]): GolonganKeluarga {
  if (!kk) {
    return {
      id: 'default-gol',
      kk_id: 'unknown',
      lingkungan_id: 'unknown',
      golongan: 'Sejahtera',
      kriteria_catatan: 'Keluarga Sejahtera',
      updated_by_role: 'SEKRETARIS',
      updated_at: new Date().toISOString()
    }
  }

  // Check if this is an approved or pending DAFU approval
  if (typeof window !== 'undefined' || customApprovals) {
    try {
      const approvals = customApprovals && customApprovals.length > 0 ? customApprovals : getDafuApprovals()
      const foundAppr = approvals.find(a =>
        (a.status === 'APPROVED' || a.status === 'PENDING') &&
        (a.kk_id === kk.id ||
         a.id === kk.id ||
         `kk-appr-${a.id}` === kk.id ||
         `kk-prop-${a.id}` === kk.id ||
         (a.nama_kk && kk.nama_kk && a.nama_kk.toLowerCase().trim() === kk.nama_kk.toLowerCase().trim()))
      )
      if (foundAppr && foundAppr.golongan) {
        return {
          id: `gol-${kk.id}`,
          kk_id: kk.id,
          lingkungan_id: kk.lingkungan_id,
          golongan: foundAppr.golongan,
          kriteria_catatan: foundAppr.kriteria_catatan || (foundAppr.status === 'PENDING' ? 'Usulan dalam pengajuan' : 'Ditetapkan Sekretaris Paroki'),
          updated_by_role: foundAppr.status === 'PENDING' ? 'SEKRETARIS' : 'SEKRETARIS_PAROKI',
          updated_at: foundAppr.reviewed_at || foundAppr.created_at
        }
      }
    } catch (e) {}
  }

  return {
    id: `gol-${kk.id}`,
    kk_id: kk.id,
    lingkungan_id: kk.lingkungan_id,
    golongan: 'Sejahtera',
    kriteria_catatan: 'Keluarga Sejahtera',
    updated_by_role: 'SEKRETARIS',
    updated_at: new Date().toISOString()
  }
}

export const getRealGolonganForKk = getDummyGolonganForKk

export const santaClaraStats = {
  totalFamilies: 2884,
  totalMembers: 9802,
  totalLingkungan: 69,
  totalWilayah: 13
}
