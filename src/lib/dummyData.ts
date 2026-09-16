import { KepalaKeluarga, AnggotaKeluarga, GolonganKeluarga } from './types'
import rawSantaClaraData from '@/data/santaClaraUmat.json'
import { getAllMasterLingkungan } from './constants'

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
      if (raw && (raw.includes('dummy-') || raw.includes('Anastasia Gunawan') || raw.includes('Petrus Sugeng'))) {
        localStorage.removeItem(k)
      }
    })
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('custom_kks_') || key.startsWith('custom_anggota_') || key.startsWith('custom_golongan_'))) {
        const val = localStorage.getItem(key)
        if (val && (val.includes('dummy-') || val.includes('Anastasia Gunawan') || val.includes('Petrus Sugeng'))) {
          localStorage.removeItem(key)
        }
      }
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

  // Resolve canonical name if not provided
  let resolvedName = namaLingkungan || ''
  if (!resolvedName && lingkunganId) {
    const all = getAllMasterLingkungan()
    const found = all.find(l => l.id === lingkunganId || l.slug === lingkunganId)
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
  existingList: KepalaKeluarga[]
): KepalaKeluarga[] {
  const realList = getRealKkListForLingkungan(lingkunganId, namaLingkungan)

  const combinedMap = new Map<string, KepalaKeluarga>()
  // Load real parishioners first
  realList.forEach(k => combinedMap.set(k.id, k))

  // Merge any locally saved / custom user entries (from Supabase or localStorage), strictly ignoring any legacy dummy IDs
  if (existingList && existingList.length > 0) {
    existingList.forEach(k => {
      if (k && k.id && !k.id.startsWith('dummy-') && !k.id.includes('dummy')) {
        combinedMap.set(k.id, k)
      }
    })
  }

  return Array.from(combinedMap.values()).sort((a, b) => a.nama_kk.localeCompare(b.nama_kk))
}

/**
 * Returns the real family members (Kepala Keluarga, Istri, Anak, Orang Tua, dll.) from CSV
 */
export function getDummyAnggotaForKk(kk: KepalaKeluarga): AnggotaKeluarga[] {
  if (!kk) return []

  // 1. Check real anggota map
  if (data.anggotaMap[kk.id]) {
    return data.anggotaMap[kk.id]
  }

  // 2. Fallback for newly created custom KK
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
 * Returns the real economic status (Golongan) for the family from CSV
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

  // 1. Check real golongan map
  if (data.golonganMap[kk.id]) {
    return data.golonganMap[kk.id]
  }

  // 2. Default for newly created custom KK
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
