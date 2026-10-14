import { JurnalTransaksi } from './types'

export function isStandardUuid(id: string | null | undefined): boolean {
  if (!id) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

/**
 * Reconciles cloud journals from Supabase with local offline journals.
 * - When supabaseSuccess is true: Cloud is authoritative for UUID items.
 *   Any items with UUID that no longer exist in cloud are considered deleted and pruned from localStorage.
 *   Only non-UUID offline drafts (e.g. 'jurnal-12345') are preserved.
 * - When supabaseSuccess is false (offline/error): Keeps local cache intact.
 */
export function reconcileJournals(
  cloudJournals: JurnalTransaksi[],
  dbUuid: string,
  lingkunganId: string | null,
  supabaseSuccess: boolean
): JurnalTransaksi[] {
  if (typeof window === 'undefined') return cloudJournals

  const keys = [`custom_journals_${dbUuid}`]
  if (lingkunganId && lingkunganId !== dbUuid) {
    keys.push(`custom_journals_${lingkunganId}`)
  }
  if (lingkunganId) {
    keys.push(`custom_journals_csv-${lingkunganId}`)
  }

  const localList: JurnalTransaksi[] = []
  keys.forEach(k => {
    const raw = localStorage.getItem(k)
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) localList.push(...parsed)
      } catch (e) {}
    }
  })

  const rawAll = localStorage.getItem('custom_journals_all_store')
  if (rawAll) {
    try {
      const parsedAll = JSON.parse(rawAll)
      if (Array.isArray(parsedAll)) {
        localList.push(
          ...parsedAll.filter(
            (j: any) => j.lingkungan_id === dbUuid || (lingkunganId && j.lingkungan_id === lingkunganId)
          )
        )
      }
    } catch (e) {}
  }

  const cloudIds = new Set(cloudJournals.map(j => j.id))

  // If Supabase query succeeded, prune items that have UUIDs but are no longer in Supabase
  if (supabaseSuccess) {
    // Keep only offline drafts (non-UUID) that haven't been synced to Supabase yet
    const pendingOfflineDrafts = localList.filter(j => !isStandardUuid(j.id))
    const freshForLingkungan = [...cloudJournals, ...pendingOfflineDrafts]

    // Deduplicate fresh list
    const dedupedMap = new Map<string, JurnalTransaksi>()
    freshForLingkungan.forEach(j => dedupedMap.set(j.id, j))
    const dedupedList = Array.from(dedupedMap.values())

    keys.forEach(k => {
      localStorage.setItem(k, JSON.stringify(dedupedList))
    })

    if (rawAll) {
      try {
        const parsedAll = JSON.parse(rawAll)
        if (Array.isArray(parsedAll)) {
          const otherLingkungan = parsedAll.filter(
            (j: any) => j.lingkungan_id !== dbUuid && (!lingkunganId || j.lingkungan_id !== lingkunganId)
          )
          localStorage.setItem('custom_journals_all_store', JSON.stringify([...otherLingkungan, ...dedupedList]))
        }
      } catch (e) {}
    }
  }

  const map = new Map<string, JurnalTransaksi>()
  cloudJournals.forEach(j => map.set(j.id, j))

  localList.forEach(j => {
    // If Supabase succeeded and this item has a UUID not in cloud, it was deleted in Supabase -> ignore
    if (supabaseSuccess && isStandardUuid(j.id) && !cloudIds.has(j.id)) {
      return
    }
    if (!map.has(j.id)) {
      map.set(j.id, j)
    } else {
      const existing = map.get(j.id)!
      if (!existing.kk_id && j.kk_id) existing.kk_id = j.kk_id
      if (!existing.kepala_keluarga && j.kepala_keluarga) existing.kepala_keluarga = j.kepala_keluarga
      if (!existing.sumber_setoran && j.sumber_setoran) existing.sumber_setoran = j.sumber_setoran
    }
  })

  return Array.from(map.values()).sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())
}

/**
 * Forcefully clears local cache for a specific lingkungan
 */
export function clearLingkunganJournalsCache(dbUuid: string, lingkunganId: string | null) {
  if (typeof window === 'undefined') return
  const keys = [`custom_journals_${dbUuid}`]
  if (lingkunganId && lingkunganId !== dbUuid) keys.push(`custom_journals_${lingkunganId}`)
  if (lingkunganId) keys.push(`custom_journals_csv-${lingkunganId}`)

  keys.forEach(k => localStorage.removeItem(k))

  const rawAll = localStorage.getItem('custom_journals_all_store')
  if (rawAll) {
    try {
      const parsedAll = JSON.parse(rawAll)
      if (Array.isArray(parsedAll)) {
        const otherLingkungan = parsedAll.filter(
          (j: any) => j.lingkungan_id !== dbUuid && (!lingkunganId || j.lingkungan_id !== lingkunganId)
        )
        localStorage.setItem('custom_journals_all_store', JSON.stringify(otherLingkungan))
      }
    } catch (e) {}
  }

  window.dispatchEvent(new Event('customJournalsUpdated'))
  window.dispatchEvent(new Event('storage'))
}
