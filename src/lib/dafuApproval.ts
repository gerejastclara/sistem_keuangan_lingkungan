'use client'

import { createClient } from '@/utils/supabase/client'
import { KategoriGolongan } from './types'

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

const INITIAL_APPROVAL_SEED: DafuApprovalItem[] = [
  {
    id: '35fb2279-43d5-424d-b349-d95313d9901e',
    lingkungan_id: 'da1b6d3b-db10-48cc-8159-b211dffc3c22',
    nama_lingkungan: 'Padre Pio 1',
    kk_id: null,
    action_type: 'TAMBAH_KK',
    nama_kk: 'Keluarga FX Sudirman & Maria Fransisca',
    alamat: 'Taman Harapan Baru Blok D5 No. 12',
    is_biduk: true,
    golongan: 'Sejahtera',
    kriteria_catatan: 'Keluarga mandiri, kedua orang tua bekerja tetap, memiliki rumah pribadi.',
    anggota_keluarga: [
      { nama: 'FX Sudirman', peran: 'Kepala Keluarga', is_kaj: true, keterangan: 'Kepala Keluarga' },
      { nama: 'Maria Fransisca', peran: 'Istri', is_kaj: true, keterangan: 'Istri' },
      { nama: 'Benedictus Bryan', peran: 'Anak', is_kaj: true, keterangan: 'Anak Pertama' }
    ],
    status: 'PENDING',
    catatan_paroki: null,
    submitted_by: 'sekretaris_padrepio1',
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    is_read: false
  },
  {
    id: 'ca43092a-537d-4604-b5ad-dbfb35de5c91',
    lingkungan_id: 'lingkungan-st-catarina-1',
    nama_lingkungan: 'St. Catarina 1',
    kk_id: null,
    action_type: 'TAMBAH_KK',
    nama_kk: 'Keluarga Antonius Wijaya',
    alamat: 'Pesona Anggrek Harapan Blok B2 No. 8',
    is_biduk: true,
    golongan: 'Terduga Prasejahtera',
    kriteria_catatan: 'Kepala keluarga baru mengalami PHK bulan lalu, saat ini mengandalkan usaha toko kelontong kecil.',
    anggota_keluarga: [
      { nama: 'Antonius Wijaya', peran: 'Kepala Keluarga', is_kaj: true, keterangan: 'Kepala Keluarga' },
      { nama: 'Theresia Linda', peran: 'Istri', is_kaj: true, keterangan: 'Istri' }
    ],
    status: 'PENDING',
    catatan_paroki: null,
    submitted_by: 'sekretaris_stcatarina1',
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    is_read: false
  },
  {
    id: '7ac5b273-c7a4-4176-a7d4-2658a8b892a1',
    lingkungan_id: '835a6f75-e179-4bf4-b91a-6f130e10f815',
    nama_lingkungan: 'Padre Pio 2',
    kk_id: null,
    action_type: 'TAMBAH_KK',
    nama_kk: 'Keluarga Yohanes Kristianto & Agnes Wijaya',
    alamat: 'Taman Harapan Baru Blok F2 No. 15',
    is_biduk: true,
    golongan: 'Sejahtera',
    kriteria_catatan: 'Keluarga baru pindahan dari Paroki Kramat, berkas baptis dan perkawinan lengkap.',
    anggota_keluarga: [
      { nama: 'Yohanes Kristianto', peran: 'Kepala Keluarga', is_kaj: true, keterangan: 'Kepala Keluarga' },
      { nama: 'Agnes Wijaya', peran: 'Istri', is_kaj: true, keterangan: 'Istri' },
      { nama: 'Gabriella Clarissa', peran: 'Anak', is_kaj: true, keterangan: 'Anak Pertama' }
    ],
    status: 'PENDING',
    catatan_paroki: null,
    submitted_by: 'sekretaris_padrepio2',
    created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    is_read: false
  }
]

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
      return parsed
    }
  } catch (e) {
    console.warn('Failed to parse dafu approvals from localStorage:', e)
  }

  return INITIAL_APPROVAL_SEED
}

export function saveDafuApprovals(list: DafuApprovalItem[]) {
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
  }

  // If approved and has kk_id, optionally sync to golongan_keluarga table
  try {
    const item = current.find(i => i.id === id)
    if (item?.kk_id) {
      await supabase.from('golongan_keluarga').upsert({
        kk_id: item.kk_id,
        lingkungan_id: item.lingkungan_id,
        golongan: adjustedGolongan || item.golongan,
        kriteria_catatan: adjustedCatatan !== undefined ? adjustedCatatan : item.kriteria_catatan,
        updated_by_role: 'SEKRETARIS_PAROKI',
        updated_at: new Date().toISOString()
      }, { onConflict: 'kk_id' })
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
