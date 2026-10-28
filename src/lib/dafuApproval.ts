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

export interface DafuDataSnapshot {
  nama_kk: string
  alamat?: string | null
  is_biduk: boolean
  golongan: KategoriGolongan
  kriteria_catatan?: string | null
  anggota_keluarga: DafuMemberItem[]
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
  data_sebelum_edit?: DafuDataSnapshot | null
  is_edited_by_paroki?: boolean
}

const STORAGE_KEY = 'dafu_approvals_store'

const INITIAL_APPROVAL_SEED: DafuApprovalItem[] = []

function mapDbRowToApprovalItem(item: any): DafuApprovalItem {
  let dataSebelumEdit: DafuDataSnapshot | null = item.data_sebelum_edit || null
  let catatanParoki = item.catatan_paroki ? String(item.catatan_paroki) : null

  // If dataSebelumEdit is embedded in catatan_paroki
  if (!dataSebelumEdit && catatanParoki && catatanParoki.includes('[DATA_SEBELUM_EDIT]:')) {
    try {
      const parts = catatanParoki.split('[DATA_SEBELUM_EDIT]:')
      catatanParoki = parts[0].trim() || null
      dataSebelumEdit = JSON.parse(parts[1])
    } catch (e) {}
  }

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
    catatan_paroki: catatanParoki,
    data_sebelum_edit: dataSebelumEdit,
    is_edited_by_paroki: Boolean(dataSebelumEdit || item.is_edited_by_paroki),
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
 * Helper to sync an approved DAFU item into localStorage stores and Supabase database tables.
 */
async function syncApprovedItemToStoresAndDb(
  item: DafuApprovalItem,
  finalGolongan?: KategoriGolongan,
  finalCatatan?: string
): Promise<void> {
  const supabase = createClient()
  const kkId = item.kk_id || `kk-appr-${item.id}`
  const cleanId = (item.kk_id || kkId || '').trim()
  const cleanName = (item.nama_kk || '').trim()
  const dbUuid = getLingkunganDbUuid(item.lingkungan_id) || item.lingkungan_id
  const targetGol = finalGolongan || item.golongan
  const targetCatatan = finalCatatan !== undefined ? finalCatatan : item.kriteria_catatan

  // 1. Sync to browser localStorage caches
  try {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('cached_parish_kks')

      if (item.action_type === 'HAPUS_KK') {
        // Tandai di custom_kks_deleted_store agar langsung hilang dari DAFU Sekretaris, Bendahara, & Paroki
        const rawDel = localStorage.getItem('custom_kks_deleted_store')
        const delList: string[] = rawDel ? JSON.parse(rawDel) : []
        const toAdd = [
          cleanId,
          cleanId.toLowerCase(),
          kkId,
          kkId.toLowerCase(),
          cleanName,
          cleanName.toLowerCase(),
          cleanId.replace('kk-appr-', ''),
          `kk-appr-${cleanId}`
        ]
        toAdd.forEach(entry => {
          if (entry && !delList.includes(entry)) delList.push(entry)
        })
        localStorage.setItem('custom_kks_deleted_store', JSON.stringify(delList))
        if (item.lingkungan_id) localStorage.setItem(`custom_kks_deleted_${item.lingkungan_id}`, JSON.stringify(delList))
        if (dbUuid) localStorage.setItem(`custom_kks_deleted_${dbUuid}`, JSON.stringify(delList))

        // Tandai status Pindah di Kartu Setoran
        const markPindah = (key: string) => {
          const rawS = localStorage.getItem(key)
          const mapS = rawS ? JSON.parse(rawS) : {}
          if (cleanId) mapS[cleanId] = 'PINDAH'
          if (kkId) mapS[kkId] = 'PINDAH'
          if (cleanName) mapS[cleanName.toLowerCase()] = 'PINDAH'
          localStorage.setItem(key, JSON.stringify(mapS))
        }
        if (item.lingkungan_id) markPindah(`kartu_setoran_umat_status_${item.lingkungan_id}`)
        if (dbUuid) markPindah(`kartu_setoran_umat_status_${dbUuid}`)
      }

      const newKkObj = {
        id: kkId,
        lingkungan_id: item.lingkungan_id,
        nama_kk: item.nama_kk,
        alamat: item.alamat || '',
        is_biduk: item.is_biduk,
        jumlah_anggota: Array.isArray(item.anggota_keluarga) && item.anggota_keluarga.length > 0 ? item.anggota_keluarga.length : 1
      }

      const filterOutKk = (k: any) =>
        k &&
        k.id !== kkId &&
        k.id !== item.kk_id &&
        (k.nama_kk || '').toLowerCase().trim() !== cleanName.toLowerCase()

      // custom_kks_all_store
      const rawAll = localStorage.getItem('custom_kks_all_store')
      let allKks: any[] = rawAll ? JSON.parse(rawAll) : []
      allKks = allKks.filter(filterOutKk)
      if (item.action_type !== 'HAPUS_KK') {
        allKks.push(newKkObj)
      }
      localStorage.setItem('custom_kks_all_store', JSON.stringify(allKks))

      // custom_kks_[lingkungan_id]
      const rawLing = localStorage.getItem(`custom_kks_${item.lingkungan_id}`)
      let lingKks: any[] = rawLing ? JSON.parse(rawLing) : []
      lingKks = lingKks.filter(filterOutKk)
      if (item.action_type !== 'HAPUS_KK') {
        lingKks.push(newKkObj)
      }
      localStorage.setItem(`custom_kks_${item.lingkungan_id}`, JSON.stringify(lingKks))

      if (dbUuid && dbUuid !== item.lingkungan_id) {
        const rawUuid = localStorage.getItem(`custom_kks_${dbUuid}`)
        let uuidKks: any[] = rawUuid ? JSON.parse(rawUuid) : []
        uuidKks = uuidKks.filter(filterOutKk)
        if (item.action_type !== 'HAPUS_KK') {
          uuidKks.push(newKkObj)
        }
        localStorage.setItem(`custom_kks_${dbUuid}`, JSON.stringify(uuidKks))
      }

      // custom_anggota_all_store
      if (item.action_type !== 'HAPUS_KK' && Array.isArray(item.anggota_keluarga) && item.anggota_keluarga.length > 0) {
        const rawAng = localStorage.getItem('custom_anggota_all_store')
        const angStore = rawAng ? JSON.parse(rawAng) : {}
        angStore[kkId] = item.anggota_keluarga.map((m, idx) => ({
          id: m.id || `mem-${kkId}-${idx}`,
          kk_id: kkId,
          nama: m.nama,
          peran: m.peran,
          is_kaj: m.is_kaj,
          keterangan: m.keterangan || undefined
        }))
        localStorage.setItem('custom_anggota_all_store', JSON.stringify(angStore))
      }

      // custom_golongan_all_store
      if (item.action_type !== 'HAPUS_KK') {
        const rawGol = localStorage.getItem('custom_golongan_all_store')
        const golStore = rawGol ? JSON.parse(rawGol) : {}
        golStore[kkId] = {
          id: `gol-${kkId}`,
          kk_id: kkId,
          lingkungan_id: item.lingkungan_id,
          golongan: targetGol,
          kriteria_catatan: targetCatatan,
          updated_by_role: 'SEKRETARIS_PAROKI',
          updated_at: new Date().toISOString()
        }
        localStorage.setItem('custom_golongan_all_store', JSON.stringify(golStore))
      }

      window.dispatchEvent(new Event('dafuDataUpdated'))
      window.dispatchEvent(new Event('storage'))
    }
  } catch (e) {
    console.warn('Error syncing approved DAFU stores:', e)
  }

  // 2. Sync to Supabase PostgreSQL database tables
  try {
    if (item.action_type !== 'HAPUS_KK') {
      const dbKkId = item.kk_id || toDeterministicUuid('kk', `appr-${item.id}`)

      await supabase.from('kepala_keluarga').upsert({
        id: dbKkId,
        lingkungan_id: dbUuid,
        nama_kk: item.nama_kk,
        alamat: item.alamat || null,
        is_biduk: item.is_biduk
      }, { onConflict: 'id' })

      if (Array.isArray(item.anggota_keluarga) && item.anggota_keluarga.length > 0) {
        const mems = item.anggota_keluarga.map((m, idx) => ({
          id: m.id || toDeterministicUuid('mem', `${dbKkId}:${idx}`),
          kk_id: dbKkId,
          nama: m.nama,
          peran: m.peran,
          is_kaj: m.is_kaj,
          keterangan: m.keterangan || null
        }))
        await supabase.from('anggota_keluarga').upsert(mems, { onConflict: 'id' })
      }

      await supabase.from('golongan_keluarga').upsert({
        kk_id: dbKkId,
        lingkungan_id: dbUuid,
        golongan: targetGol,
        kriteria_catatan: targetCatatan,
        updated_by_role: 'SEKRETARIS_PAROKI',
        updated_at: new Date().toISOString()
      }, { onConflict: 'kk_id' })
    } else if (item.action_type === 'HAPUS_KK') {
      // Tandai kepala_keluarga di Supabase dengan [PINDAH] agar hilang dari DAFU Sekretaris, Bendahara, & Paroki
      // namun tetap muncul di Kartu Setoran dengan status Pindah (dan riwayat jurnal_transaksi tetap terjaga)
      const existingAlamat = (item.alamat || '').trim()
      const newAlamat = existingAlamat.toLowerCase().includes('[pindah]')
        ? existingAlamat
        : `${existingAlamat} [PINDAH]`.trim()

      const isUuidStr = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
      if (cleanId && isUuidStr(cleanId)) {
        await supabase.from('kepala_keluarga').update({ alamat: newAlamat }).eq('id', cleanId)
      }
      if (cleanName && dbUuid) {
        await supabase.from('kepala_keluarga').update({ alamat: newAlamat }).eq('lingkungan_id', dbUuid).ilike('nama_kk', cleanName)
      }
    }
  } catch (e) {
    console.warn('Error syncing approved DAFU item to database:', e)
  }
}

/**
 * Updates a pending approval item (used by Sekretaris Lingkungan to edit pending submissions).
 */
export async function updateDafuApproval(
  id: string,
  updates: {
    nama_kk?: string
    alamat?: string | null
    is_biduk?: boolean
    golongan?: KategoriGolongan
    kriteria_catatan?: string | null
    anggota_keluarga?: DafuMemberItem[]
  }
): Promise<boolean> {
  const supabase = createClient()
  try {
    const { error } = await supabase
      .from('dafu_approvals')
      .update(updates)
      .eq('id', id)
    if (error) {
      console.warn('Supabase updateDafuApproval warning:', error.message)
    }
  } catch (e) {
    console.warn('Exception updating dafu approval in Supabase:', e)
  }

  const current = getDafuApprovals()
  const updated = current.map(item => {
    if (item.id === id) {
      return {
        ...item,
        ...updates
      }
    }
    return item
  })
  saveDafuApprovals(updated)
  return true
}

/**
 * Updates approval item with edits made by Sekretaris Paroki and marks it APPROVED.
 * Automatically saves data_sebelum_edit and is_edited_by_paroki for transparent audit.
 */
export async function editAndApproveDafuItem(
  id: string,
  edited: {
    nama_kk: string
    alamat?: string | null
    is_biduk: boolean
    golongan: KategoriGolongan
    kriteria_catatan?: string | null
    anggota_keluarga: DafuMemberItem[]
    catatan_paroki?: string | null
  },
  reviewedBy: string = 'Sekretaris Paroki'
): Promise<boolean> {
  const current = getDafuApprovals()
  const existing = current.find(i => i.id === id)

  let dataSebelumEdit: DafuDataSnapshot | null = null
  let isEdited = false

  if (existing) {
    const nameDiff = existing.nama_kk !== edited.nama_kk
    const alamatDiff = (existing.alamat || '') !== (edited.alamat || '')
    const bidukDiff = existing.is_biduk !== edited.is_biduk
    const golDiff = existing.golongan !== edited.golongan
    const catatanDiff = (existing.kriteria_catatan || '') !== (edited.kriteria_catatan || '')
    const membersDiff = JSON.stringify(existing.anggota_keluarga || []) !== JSON.stringify(edited.anggota_keluarga || [])

    if (nameDiff || alamatDiff || bidukDiff || golDiff || catatanDiff || membersDiff) {
      isEdited = true
      // Preserve prior original snapshot if it was already edited before, otherwise snapshot existing
      dataSebelumEdit = existing.data_sebelum_edit || {
        nama_kk: existing.nama_kk,
        alamat: existing.alamat || null,
        is_biduk: existing.is_biduk,
        golongan: existing.golongan,
        kriteria_catatan: existing.kriteria_catatan || null,
        anggota_keluarga: existing.anggota_keluarga || []
      }
    } else if (existing.data_sebelum_edit) {
      dataSebelumEdit = existing.data_sebelum_edit
      isEdited = true
    }
  }

  const supabase = createClient()
  const reviewedAt = new Date().toISOString()

  let finalCatatanParoki = edited.catatan_paroki ? edited.catatan_paroki.trim() : null
  if (isEdited && dataSebelumEdit) {
    const prefix = finalCatatanParoki ? `${finalCatatanParoki}\n` : ''
    finalCatatanParoki = `${prefix}[DATA_SEBELUM_EDIT]:${JSON.stringify(dataSebelumEdit)}`
  }

  const updatePayload: Record<string, any> = {
    nama_kk: edited.nama_kk,
    alamat: edited.alamat || null,
    is_biduk: edited.is_biduk,
    golongan: edited.golongan,
    kriteria_catatan: edited.kriteria_catatan || null,
    anggota_keluarga: edited.anggota_keluarga,
    status: 'APPROVED',
    catatan_paroki: finalCatatanParoki,
    reviewed_by: reviewedBy,
    reviewed_at: reviewedAt,
    is_read: true
  }

  if (dataSebelumEdit) {
    updatePayload.data_sebelum_edit = dataSebelumEdit
    updatePayload.is_edited_by_paroki = true
  }

  try {
    const { error } = await supabase
      .from('dafu_approvals')
      .update(updatePayload)
      .eq('id', id)

    if (error) {
      console.warn('Supabase update approval with data_sebelum_edit notice:', error.message)
      // Retry without newly added columns in case DB hasn't run the migration yet
      delete updatePayload.data_sebelum_edit
      delete updatePayload.is_edited_by_paroki
      await supabase.from('dafu_approvals').update(updatePayload).eq('id', id)
    }
  } catch (err) {
    console.warn('Supabase update dafu approval exception:', err)
  }

  // Update local cache
  const updated = current.map(item => {
    if (item.id === id) {
      return {
        ...item,
        nama_kk: edited.nama_kk,
        alamat: edited.alamat || null,
        is_biduk: edited.is_biduk,
        golongan: edited.golongan,
        kriteria_catatan: edited.kriteria_catatan || null,
        anggota_keluarga: edited.anggota_keluarga,
        status: 'APPROVED' as const,
        catatan_paroki: edited.catatan_paroki ? edited.catatan_paroki.trim() : null,
        data_sebelum_edit: dataSebelumEdit,
        is_edited_by_paroki: isEdited,
        reviewed_by: reviewedBy,
        reviewed_at: reviewedAt,
        is_read: true
      }
    }
    return item
  })
  saveDafuApprovals(updated)

  // Sync to active KK / anggota / golongan stores & Supabase tables
  const approvedItem = updated.find(i => i.id === id)
  if (approvedItem) {
    await syncApprovedItemToStoresAndDb(approvedItem, edited.golongan, edited.kriteria_catatan || undefined)
  }

  return true
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
  const current = getDafuApprovals()
  const existing = current.find(i => i.id === id)

  if (existing) {
    return editAndApproveDafuItem(
      id,
      {
        nama_kk: existing.nama_kk,
        alamat: existing.alamat || null,
        is_biduk: existing.is_biduk,
        golongan: adjustedGolongan || existing.golongan,
        kriteria_catatan: adjustedCatatan !== undefined ? adjustedCatatan : existing.kriteria_catatan,
        anggota_keluarga: existing.anggota_keluarga || [],
        catatan_paroki: existing.catatan_paroki || null
      },
      reviewedBy
    )
  }

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
    await supabase.from('dafu_approvals').update(updatePayload).eq('id', id)
  } catch (err) {}

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
export async function removeDafuApproval(identifier: string, namaKk?: string | null): Promise<boolean> {
  const supabase = createClient()
  const cleanId = (identifier || '').trim()
  const cleanName = (namaKk || '').trim()

  try {
    const isUuidStr = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
    if (cleanId) {
      const stripped = cleanId.replace('kk-appr-', '')
      if (isUuidStr(cleanId)) {
        await supabase.from('dafu_approvals').delete().eq('id', cleanId)
      }
      await supabase.from('dafu_approvals').delete().eq('kk_id', cleanId)
      if (stripped && stripped !== cleanId) {
        if (isUuidStr(stripped)) {
          await supabase.from('dafu_approvals').delete().eq('id', stripped)
        }
        await supabase.from('dafu_approvals').delete().eq('kk_id', stripped)
      }
    }
    if (cleanName) {
      await supabase.from('dafu_approvals').delete().eq('nama_kk', cleanName)
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

