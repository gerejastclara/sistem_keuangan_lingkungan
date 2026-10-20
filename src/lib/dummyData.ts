import { KepalaKeluarga, AnggotaKeluarga, GolonganKeluarga, PeranKeluarga } from './types'
import rawSantaClaraData from '@/data/santaClaraUmat.json'
import { getAllMasterLingkungan, getLingkunganDbUuid } from './constants'
import { getDafuApprovals } from './dafuApproval'

interface SantaClaraDataset {
  totalFamilies: number
  totalMembers: number
  wilayahLingkunganMap: Record<string, string[]>
  kksByLingkungan: Record<string, KepalaKeluarga[]>
  anggotaMap: Record<string, AnggotaKeluarga[]>
  golonganMap: Record<string, GolonganKeluarga>
}

const data = rawSantaClaraData as unknown as SantaClaraDataset

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
      if (raw && (raw.includes('dummy-') || raw.includes('Anastasia Gunawan') || raw.includes('Petrus Sugeng') || raw.toLowerCase().includes('"dimas"') || raw.toLowerCase().includes('"nama_kk":"dimas"'))) {
        localStorage.removeItem(k)
      }
    })
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('custom_kks_') || key.startsWith('custom_anggota_') || key.startsWith('custom_golongan_'))) {
        const val = localStorage.getItem(key)
        if (val && (val.includes('dummy-') || val.includes('Anastasia Gunawan') || val.includes('Petrus Sugeng') || val.toLowerCase().includes('"dimas"') || val.toLowerCase().includes('"nama_kk":"dimas"'))) {
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
            a.id !== '7ac5b273-c7a4-4176-a7d4-2658a8b892a1'
          )
          localStorage.setItem('dafu_approvals_store', JSON.stringify(filtered))
        }
      } catch (e) {}
    }
  } catch (e) {}
}

/**
 * Returns the real Santa Clara parish families for a given Lingkungan ID or name.
 */
export function getRealKkListForLingkungan(lingkunganId: string, namaLingkungan?: string): KepalaKeluarga[] {
  if (!lingkunganId && !namaLingkungan) return []

  // 1. Direct ID lookup
  if (lingkunganId && data.kksByLingkungan[lingkunganId]) {
    return data.kksByLingkungan[lingkunganId]
  }

  // Resolve canonical name if not provided or if generic (e.g. 'Lingkungan')
  let resolvedName = (namaLingkungan && namaLingkungan.trim().toLowerCase() !== 'lingkungan') ? namaLingkungan : ''
  if (!resolvedName && lingkunganId) {
    const all = getAllMasterLingkungan()
    const targetUuid = getLingkunganDbUuid(lingkunganId)
    const found = all.find(l => l.id === lingkunganId || l.slug === lingkunganId || getLingkunganDbUuid(l.id) === targetUuid)
    if (found) resolvedName = found.nama_lingkungan
  }

  const keysToTry: string[] = []
  if (lingkunganId) keysToTry.push(lingkunganId, normalizeLookupKey(lingkunganId))
  if (resolvedName) keysToTry.push(resolvedName, normalizeLookupKey(resolvedName))

  for (const k of keysToTry) {
    if (!k) continue
    if (data.kksByLingkungan[k]) return data.kksByLingkungan[k]
    if (data.kksByLingkungan[`csv-${k}`]) return data.kksByLingkungan[`csv-${k}`]
    if (data.kksByLingkungan[`st${k}`]) return data.kksByLingkungan[`st${k}`]
    if (data.kksByLingkungan[`csv-st-${k}`]) return data.kksByLingkungan[`csv-st-${k}`]

    const withDoubleN = k.replace(/yohanes/g, 'yohannes')
    if (data.kksByLingkungan[withDoubleN]) return data.kksByLingkungan[withDoubleN]
    if (data.kksByLingkungan[`st${withDoubleN}`]) return data.kksByLingkungan[`st${withDoubleN}`]
    if (data.kksByLingkungan[`csv-st-${withDoubleN}`]) return data.kksByLingkungan[`csv-st-${withDoubleN}`]
  }

  return []
}

// Backward compatibility alias for existing code
export const getDummyKkListForLingkungan = getRealKkListForLingkungan

/**
 * Ensures that the list contains all real Santa Clara parish families for this Lingkungan.
 * Custom families added by the user in the UI are merged seamlessly.
 */
export function ensureDummyKksForLingkungan(
  lingkunganId: string,
  namaLingkungan: string,
  existingList: KepalaKeluarga[],
  preloadedApprovals?: any[],
  includeParishData: boolean = true
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

  // 1. Include real parish families from Santa Clara CSV dataset
  if (includeParishData) {
    const realList = getRealKkListForLingkungan(lingkunganId, namaLingkungan)
    realList.forEach(k => {
      if (!isDeleted(k.id, k.nama_kk)) {
        combinedMap.set(k.id, k)
      }
    })
  }

  // 2. Merge any locally saved / custom user entries (from Supabase or localStorage), strictly ignoring any legacy dummy IDs or deleted entries
  if (existingList && existingList.length > 0) {
    existingList.forEach(k => {
      if (
        k &&
        k.id &&
        !k.id.startsWith('dummy-') &&
        !k.id.includes('dummy') &&
        k.nama_kk.toLowerCase().trim() !== 'dimas' &&
        !isDeleted(k.id, k.nama_kk)
      ) {
        combinedMap.set(k.id, k)
      }
    })
  }

  // 3. Merge officially approved families from DAFU Approval system
  try {
    const approvals = (preloadedApprovals && Array.isArray(preloadedApprovals) && preloadedApprovals.length > 0)
      ? preloadedApprovals
      : (typeof window !== 'undefined' ? getDafuApprovals() : [])
    const targetUuid = getLingkunganDbUuid(lingkunganId)
    const targetNorm = (namaLingkungan || '').toLowerCase().replace(/[^a-z0-9]/g, '')

    approvals.forEach(appr => {
      if (appr.status !== 'APPROVED') return
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

      if (appr.action_type === 'HAPUS_KK') {
        combinedMap.delete(kkId)
        if (appr.kk_id) combinedMap.delete(appr.kk_id)
        return
      }

      const approvedKk: KepalaKeluarga = {
        id: kkId,
        lingkungan_id: targetUuid || lingkunganId,
        nama_kk: appr.nama_kk,
        alamat: appr.alamat || '',
        is_biduk: appr.is_biduk,
        jumlah_anggota: Array.isArray(appr.anggota_keluarga) && appr.anggota_keluarga.length > 0 ? appr.anggota_keluarga.length : 1
      }

      combinedMap.set(kkId, approvedKk)
    })
  } catch (e) {
    console.warn('Notice merging approved DAFU items:', e)
  }

  return Array.from(combinedMap.values()).sort((a, b) => a.nama_kk.localeCompare(b.nama_kk))
}

/**
 * Returns the real family members (Kepala Keluarga, Istri, Anak, Orang Tua, dll.) from CSV or approved DAFU
 */
export function getDummyAnggotaForKk(kk: KepalaKeluarga): AnggotaKeluarga[] {
  if (!kk) return []

  // 1. Check if this is an approved DAFU approval
  if (typeof window !== 'undefined') {
    try {
      const approvals = getDafuApprovals()
      const foundAppr = approvals.find(a =>
        a.status === 'APPROVED' &&
        (a.kk_id === kk.id || `kk-appr-${a.id}` === kk.id || a.nama_kk.toLowerCase().trim() === kk.nama_kk.toLowerCase().trim())
      )
      if (foundAppr && Array.isArray(foundAppr.anggota_keluarga) && foundAppr.anggota_keluarga.length > 0) {
        return foundAppr.anggota_keluarga.map((m, idx) => ({
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

  // 2. Check real anggota map
  if (data.anggotaMap[kk.id]) {
    return data.anggotaMap[kk.id]
  }

  // 3. Fallback for newly created custom KK
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
 * Returns the real economic status (Golongan) for the family from CSV or approved DAFU
 */
export function getDummyGolonganForKk(kk: KepalaKeluarga): GolonganKeluarga {
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

  // 1. Check if this is an approved DAFU approval
  if (typeof window !== 'undefined') {
    try {
      const approvals = getDafuApprovals()
      const foundAppr = approvals.find(a =>
        a.status === 'APPROVED' &&
        (a.kk_id === kk.id || `kk-appr-${a.id}` === kk.id || a.nama_kk.toLowerCase().trim() === kk.nama_kk.toLowerCase().trim())
      )
      if (foundAppr && foundAppr.golongan) {
        return {
          id: `gol-${kk.id}`,
          kk_id: kk.id,
          lingkungan_id: kk.lingkungan_id,
          golongan: foundAppr.golongan,
          kriteria_catatan: foundAppr.kriteria_catatan || 'Ditetapkan Sekretaris Paroki',
          updated_by_role: 'SEKRETARIS_PAROKI',
          updated_at: foundAppr.reviewed_at || foundAppr.created_at
        }
      }
    } catch (e) {}
  }

  // 2. Check real golongan map
  if (data.golonganMap[kk.id]) {
    return data.golonganMap[kk.id]
  }

  // 3. Default for newly created custom KK
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
  totalFamilies: data.totalFamilies,
  totalMembers: data.totalMembers,
  totalLingkungan: 69,
  totalWilayah: 13
}
