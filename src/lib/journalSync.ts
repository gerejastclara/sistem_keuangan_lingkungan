import { JurnalTransaksi } from './types'

export function isStandardUuid(id: string | null | undefined): boolean {
  if (!id) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

/**
 * Purges obsolete local storage cache so that transactions, profiles (saldo awal),
 * and family members are 100% database-driven from Supabase.
 */
export function purgeAllObsoleteLocalStorageCache() {
  if (typeof window === 'undefined') return
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (
        k &&
        (k.startsWith('custom_journals_') ||
          k === 'custom_journals_all_store' ||
          k.startsWith('custom_kks_') ||
          k === 'custom_kks_all_store' ||
          k.startsWith('profil_manual_') ||
          k.startsWith('pengurus_manual_') ||
          k.startsWith('tx_kk_'))
      ) {
        keysToRemove.push(k)
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k))
  } catch (e) {}
}

/**
 * Strictly database-driven journal resolver:
 * - Purges local journal caches
 * - Directly returns authoritative journals from Supabase
 */
export function reconcileJournals(
  cloudJournals: JurnalTransaksi[],
  dbUuid: string,
  lingkunganId: string | null,
  supabaseSuccess: boolean
): JurnalTransaksi[] {
  // Purge any residual local journal storage
  if (typeof window !== 'undefined') {
    try {
      const keys = [`custom_journals_${dbUuid}`]
      if (lingkunganId && lingkunganId !== dbUuid) keys.push(`custom_journals_${lingkunganId}`)
      if (lingkunganId) keys.push(`custom_journals_csv-${lingkunganId}`)
      keys.forEach(k => localStorage.removeItem(k))
      localStorage.removeItem('custom_journals_all_store')
    } catch (e) {}
  }

  // Authoritative cloud journals directly from Supabase
  return (cloudJournals || []).sort(
    (a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
  )
}

/**
 * Forcefully clears local cache for a specific lingkungan
 */
export function clearLingkunganJournalsCache(dbUuid: string, lingkunganId: string | null) {
  purgeAllObsoleteLocalStorageCache()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('customJournalsUpdated'))
    window.dispatchEvent(new Event('storage'))
  }
}
