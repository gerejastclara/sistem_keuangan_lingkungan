'use client'

import { createClient } from '@/utils/supabase/client'
import { KategoriGolongan } from './types'
import { getLingkunganDbUuid } from '@/lib/constants'
import { toDeterministicUuid } from './uuid'

export interface DafuMemberItem {
  id?: string
  nama: string
  peran: string
  is_kaj: boolean
  keterangan?: string
}

export interface DafuApprovalItem {
  id: string
  lingkungan_id: string
  nama_lingkungan: string
  kk_id?: string | null
  action_type: 'TAMBAH_KK' | 'UBAH_KK' | 'HAPUS_KK'
  nama_kk: string
  alamat?: string | null
  is_biduk: boolean
  golongan: KategoriGolongan
  kriteria_catatan?: string | null
  anggota_keluarga: DafuMemberItem[]
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  catatan_paroki?: string | null
  submitted_by: string
  reviewed_by?: string | null
  created_at: string
  reviewed_at?: string | null
  is_read?: boolean
}

const STORAGE_KEY = 'dafu_approvals_store'

const INITIAL_APPROVAL_SEED: DafuApprovalItem[] = []

function mapDbRowToApprovalItem(item: any): DafuApprovalItem {
  return {
    id: String(item.id),
    lingkungan_id: String(item.lingkungan_id || ''),
    nama_lingkungan: String(item.nama_lingkungan || ''),
    kk_id: item.kk_id ? String(item.kk_id) : null,
    action_type: (item.action_type || 'TAMBAH_KK') as any,
    nama_kk: String(item.nama_kk || ''),
    alamat: item.alamat ? String(item.alamat) : null,
    is_biduk: item.is_biduk !== false,
    golongan: (item.golongan || 'Sejahtera') as KategoriGolongan,
    kriteria_catatan: item.kriteria_catatan ? String(item.kriteria_catatan) : null,
    anggota_keluarga: Array.isArray(item.anggota_keluarga) ? item.anggota_keluarga : [],
    status: (item.status || 'PENDING') as any,
    catatan_paroki: item.catatan_paroki ? String(item.catatan_paroki) : null,
    submitted_by: String(item.submitted_by || 'Sekretaris Lingkungan'),
    reviewed_by: item.reviewed_by ? String(item.reviewed_by) : null,
    created_at: item.created_at || new Date().toISOString(),
    reviewed_at: item.reviewed_at ? String(item.reviewed_at) : null,
    is_read: Boolean(item.is_read)
  }
}

let memoryApprovalsCache: DafuApprovalItem[] | null = null

/**
 * Fetch approvals directly from Supabase database table `dafu_approvals`.
 * Updates cache and dispatches events.
 */
export async function fetchDafuApprovals(): Promise<DafuApprovalItem[]> {
  const supabase = createClient()
  try {
    const { data, error } = await supabase
      .from('dafu_approvals')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && Array.isArray(data)) {
      const mapped = data.map(mapDbRowToApprovalItem)
      memoryApprovalsCache = mapped
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped))
        window.dispatchEvent(new Event('dafuApprovalUpdated'))
      }
      return mapped
    }

    if (error) {
      console.warn('Supabase fetch dafu_approvals notice:', error.message)
    }
  } catch (err) {
    console.warn('Failed to query Supabase dafu_approvals:', err)
  }

  return getDafuApprovals()
}

/**
 * Synchronous getter from cache for instantaneous rendering.
 * In browser environment, it also schedules a background DB fetch if needed.
 */
export function getDafuApprovals(): DafuApprovalItem[] {
  if (memoryApprovalsCache && memoryApprovalsCache.length > 0) {
    return memoryApprovalsCache
  }

  if (typeof window === 'undefined') return INITIAL_APPROVAL_SEED

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_APPROVAL_SEED))
      // Trigger background sync to load real DB data
      setTimeout(() => fetchDafuApprovals().catch(() => {}), 10)
      return INITIAL_APPROVAL_SEED
    }
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) {
      memoryApprovalsCache = parsed
      return parsed
    }
  } catch (e) {
    console.warn('Failed to parse dafu approvals from localStorage:', e)
  }

  return INITIAL_APPROVAL_SEED
}

export function saveDafuApprovals(list: DafuApprovalItem[]) {
  memoryApprovalsCache = list
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    window.dispatchEvent(new Event('dafuApprovalUpdated'))
  } catch (e) {
    console.warn('Failed to save dafu approvals to localStorage:', e)
  }
}

/**
 * Inserts a new approval request directly into Supabase database table `dafu_approvals`.
 */
export async function createDafuApproval(payload: {
  lingkungan_id: string
  nama_lingkungan: string
  kk_id?: string | null
  action_type: 'TAMBAH_KK' | 'UBAH_KK' | 'HAPUS_KK'
  nama_kk: string
  alamat?: string | null
  is_biduk: boolean
  golongan: KategoriGolongan
  kriteria_catatan?: string | null
  anggota_keluarga: DafuMemberItem[]
  submitted_by?: string
}): Promise<DafuApprovalItem> {
  const supabase = createClient()

  const insertData = {
    lingkungan_id: payload.lingkungan_id,
    nama_lingkungan: payload.nama_lingkungan,
    kk_id: payload.kk_id || null,
    action_type: payload.action_type,
    nama_kk: payload.nama_kk,
    alamat: payload.alamat || null,
    is_biduk: payload.is_biduk,
    golongan: payload.golongan,
    kriteria_catatan: payload.kriteria_catatan || null,
    anggota_keluarga: payload.anggota_keluarga,
    status: 'PENDING',
    submitted_by: payload.submitted_by || 'Sekretaris Lingkungan',
    is_read: false
  }

  let createdItem: DafuApprovalItem

  try {
    const { data, error } = await supabase
      .from('dafu_approvals')
      .insert(insertData)
      .select()
      .single()

    if (!error && data) {
      createdItem = mapDbRowToApprovalItem(data)
    } else {
      console.warn('Supabase insert note:', error?.message)
      createdItem = {
        id: `appr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        ...payload,
        status: 'PENDING',
        catatan_paroki: null,
        submitted_by: payload.submitted_by || 'Sekretaris Lingkungan',
        created_at: new Date().toISOString(),
        is_read: false
      }
    }
  } catch (err) {
    console.warn('Insert dafu approval fallback:', err)
    createdItem = {
      id: `appr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ...payload,
      status: 'PENDING',
      catatan_paroki: null,
      submitted_by: payload.submitted_by || 'Sekretaris Lingkungan',
      created_at: new Date().toISOString(),
      is_read: false
    }
  }

  const current = getDafuApprovals()
  const updated = [createdItem, ...current.filter(i => i.id !== createdItem.id)]
  saveDafuApprovals(updated)
  return createdItem
}

/**
 * Updates approval item to 'APPROVED' directly in Supabase database table `dafu_approvals`.
 */
export async function approveDafuItem(
  id: string,
  reviewedBy: string = 'Sekretaris Paroki',
  adjustedGolongan?: KategoriGolongan,
  adjustedCatatan?: string
): Promise<boolean> {
  const supabase = createClient()
  const updatePayload: Record<string, any> = {
    status: 'APPROVED',
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
    is_read: true
  }
  if (adjustedGolongan) updatePayload.golongan = adjustedGolongan
  if (adjustedCatatan !== undefined) updatePayload.kriteria_catatan = adjustedCatatan

  try {
    const { error } = await supabase
      .from('dafu_approvals')
      .update(updatePayload)
      .eq('id', id)

    if (error) {
      console.warn('Supabase update approval error:', error.message)
    }
  } catch (err) {
    console.warn('Supabase update exception:', err)
  }

  // Also update local cache
  const current = getDafuApprovals()
  let found = false
  const updated = current.map(item => {
    if (item.id === id) {
      found = true
      return {
        ...item,
        status: 'APPROVED' as const,
        golongan: adjustedGolongan || item.golongan,
        kriteria_catatan: adjustedCatatan !== undefined ? adjustedCatatan : item.kriteria_catatan,
        reviewed_by: reviewedBy,
        reviewed_at: updatePayload.reviewed_at,
        is_read: true
      }
    }
    return item
  })

  if (found) {
    saveDafuApprovals(updated)

    // Sync to active KK / anggota / golongan stores and notify listeners
    try {
      const approvedItem = updated.find(i => i.id === id)
      if (approvedItem && typeof window !== 'undefined') {
        const kkId = approvedItem.kk_id || `kk-appr-${approvedItem.id}`
        const newKkObj = {
          id: kkId,
          lingkungan_id: approvedItem.lingkungan_id,
          nama_kk: approvedItem.nama_kk,
          alamat: approvedItem.alamat || '',
          is_biduk: approvedItem.is_biduk,
          jumlah_anggota: Array.isArray(approvedItem.anggota_keluarga) && approvedItem.anggota_keluarga.length > 0 ? approvedItem.anggota_keluarga.length : 1
        }

        // 1. custom_kks_all_store
        const rawAll = localStorage.getItem('custom_kks_all_store')
        let allKks: any[] = rawAll ? JSON.parse(rawAll) : []
        allKks = allKks.filter(k => k.id !== kkId && k.id !== approvedItem.kk_id)
        if (approvedItem.action_type !== 'HAPUS_KK') {
          allKks.push(newKkObj)
        }
        localStorage.setItem('custom_kks_all_store', JSON.stringify(allKks))

        // 2. custom_kks_[lingkungan_id]
        const rawLing = localStorage.getItem(`custom_kks_${approvedItem.lingkungan_id}`)
        let lingKks: any[] = rawLing ? JSON.parse(rawLing) : []
        lingKks = lingKks.filter(k => k.id !== kkId && k.id !== approvedItem.kk_id)
        if (approvedItem.action_type !== 'HAPUS_KK') {
          lingKks.push(newKkObj)
        }
        localStorage.setItem(`custom_kks_${approvedItem.lingkungan_id}`, JSON.stringify(lingKks))

        // 3. custom_anggota_all_store
        if (Array.isArray(approvedItem.anggota_keluarga) && approvedItem.anggota_keluarga.length > 0) {
          const rawAng = localStorage.getItem('custom_anggota_all_store')
          const angStore = rawAng ? JSON.parse(rawAng) : {}
          angStore[kkId] = approvedItem.anggota_keluarga.map((m, idx) => ({
            id: m.id || `mem-${kkId}-${idx}`,
            kk_id: kkId,
            nama: m.nama,
            peran: m.peran,
            is_kaj: m.is_kaj,
            keterangan: m.keterangan || undefined
          }))
          localStorage.setItem('custom_anggota_all_store', JSON.stringify(angStore))
        }

        // 4. custom_golongan_all_store
        const rawGol = localStorage.getItem('custom_golongan_all_store')
        const golStore = rawGol ? JSON.parse(rawGol) : {}
        golStore[kkId] = {
          id: `gol-${kkId}`,
          kk_id: kkId,
          lingkungan_id: approvedItem.lingkungan_id,
          golongan: adjustedGolongan || approvedItem.golongan,
          kriteria_catatan: adjustedCatatan !== undefined ? adjustedCatatan : approvedItem.kriteria_catatan,
          updated_by_role: 'SEKRETARIS_PAROKI',
          updated_at: new Date().toISOString()
        }
        localStorage.setItem('custom_golongan_all_store', JSON.stringify(golStore))

        window.dispatchEvent(new Event('dafuDataUpdated'))
      }
    } catch (e) {
      console.warn('Error syncing approved DAFU stores:', e)
    }
  }

  // Sync approved item to Supabase kepala_keluarga, anggota_keluarga, and golongan_keluarga tables
  try {
    const item = updated.find(i => i.id === id)
    if (item && item.action_type !== 'HAPUS_KK') {
      const dbUuid = getLingkunganDbUuid(item.lingkungan_id) || item.lingkungan_id
      const kkId = item.kk_id || toDeterministicUuid('kk', `appr-${item.id}`)
      await supabase.from('kepala_keluarga').upsert({
        id: kkId,
        lingkungan_id: dbUuid,
        nama_kk: item.nama_kk,
        alamat: item.alamat || null,
        is_biduk: item.is_biduk
      }, { onConflict: 'id' })

      if (Array.isArray(item.anggota_keluarga) && item.anggota_keluarga.length > 0) {
        const mems = item.anggota_keluarga.map((m, idx) => ({
          id: m.id || toDeterministicUuid('mem', `${kkId}:${idx}`),
          kk_id: kkId,
          nama: m.nama,
          peran: m.peran,
          is_kaj: m.is_kaj,
          keterangan: m.keterangan || null
        }))
        await supabase.from('anggota_keluarga').upsert(mems, { onConflict: 'id' })
      }

      await supabase.from('golongan_keluarga').upsert({
        kk_id: kkId,
        lingkungan_id: dbUuid,
        golongan: adjustedGolongan || item.golongan,
        kriteria_catatan: adjustedCatatan !== undefined ? adjustedCatatan : item.kriteria_catatan,
        updated_by_role: 'SEKRETARIS_PAROKI',
        updated_at: new Date().toISOString()
      }, { onConflict: 'kk_id' })
    } else if (item && item.action_type === 'HAPUS_KK' && item.kk_id) {
      await supabase.from('anggota_keluarga').delete().eq('kk_id', item.kk_id)
      await supabase.from('golongan_keluarga').delete().eq('kk_id', item.kk_id)
      await supabase.from('kepala_keluarga').delete().eq('id', item.kk_id)
    }
  } catch (e) {}

  return true
}

/**
 * Updates approval item to 'REJECTED' directly in Supabase database table `dafu_approvals`.
 */
export async function rejectDafuItem(
  id: string,
  catatan: string,
  reviewedBy: string = 'Sekretaris Paroki'
): Promise<boolean> {
  const supabase = createClient()
  const updatePayload = {
    status: 'REJECTED',
    catatan_paroki: catatan.trim() || 'Perubahan data tidak disetujui.',
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
    is_read: true
  }

  try {
    const { error } = await supabase
      .from('dafu_approvals')
      .update(updatePayload)
      .eq('id', id)

    if (error) {
      console.warn('Supabase reject approval error:', error.message)
    }
  } catch (err) {
    console.warn('Supabase reject exception:', err)
  }

  const current = getDafuApprovals()
  let found = false
  const updated = current.map(item => {
    if (item.id === id) {
      found = true
      return {
        ...item,
        status: 'REJECTED' as const,
        catatan_paroki: updatePayload.catatan_paroki,
        reviewed_by: reviewedBy,
        reviewed_at: updatePayload.reviewed_at,
        is_read: true
      }
    }
    return item
  })

  if (found) {
    saveDafuApprovals(updated)
  }

  return true
}

/**
 * Marks unread approval notifications as read in Supabase and local cache.
 */
export async function markAllApprovalsAsRead(): Promise<void> {
  const supabase = createClient()
  try {
    await supabase.from('dafu_approvals').update({ is_read: true }).eq('is_read', false)
  } catch (err) {}

  const current = getDafuApprovals()
  const updated = current.map(item => ({ ...item, is_read: true }))
  saveDafuApprovals(updated)
}

export function getPendingApprovalCount(): number {
  const current = getDafuApprovals()
  return current.filter(item => item.status === 'PENDING').length
}

/**
 * Permanently removes an approval record from Supabase table `dafu_approvals`
 * and local cache by approval id, kk_id, or family name.
 */
export async function removeDafuApproval(identifier: string, namaKk?: string): Promise<boolean> {
  const supabase = createClient()
  const cleanId = (identifier || '').trim()
  const cleanName = (namaKk || '').trim()

  try {
    const filters: string[] = []
    if (cleanId) {
      filters.push(`id.eq.${cleanId}`)
      filters.push(`kk_id.eq.${cleanId}`)
      const stripped = cleanId.replace('kk-appr-', '')
      if (stripped && stripped !== cleanId) {
        filters.push(`id.eq.${stripped}`)
        filters.push(`kk_id.eq.${stripped}`)
      }
    }
    if (cleanName) {
      filters.push(`nama_kk.eq.${cleanName}`)
    }

    if (filters.length > 0) {
      await supabase.from('dafu_approvals').delete().or(filters.join(','))
    }
  } catch (err) {
    console.warn('Notice removing dafu approval from Supabase:', err)
  }

  // Remove from memory and localStorage
  const current = getDafuApprovals()
  const cleanNameLower = cleanName.toLowerCase()
  const cleanIdLower = cleanId.toLowerCase()
  const filtered = current.filter(item => {
    const itemNamaLower = (item.nama_kk || '').toLowerCase().trim()
    const matchName = cleanNameLower && itemNamaLower === cleanNameLower
    const matchId =
      item.id === cleanId ||
      item.kk_id === cleanId ||
      `kk-appr-${item.id}` === cleanId ||
      item.id.toLowerCase() === cleanIdLower ||
      (item.kk_id && item.kk_id.toLowerCase() === cleanIdLower)
    return !matchName && !matchId
  })

  saveDafuApprovals(filtered)
  return true
}

