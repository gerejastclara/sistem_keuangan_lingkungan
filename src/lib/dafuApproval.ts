'use client'

import { KepalaKeluarga, AnggotaKeluarga, GolonganKeluarga, KategoriGolongan } from './types'

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
  reviewed_by?: string
  created_at: string
  reviewed_at?: string
  is_read?: boolean
}

const STORAGE_KEY = 'dafu_approvals_store'

const INITIAL_APPROVAL_SEED: DafuApprovalItem[] = [
  {
    id: 'appr-padrepio1-01',
    lingkungan_id: 'da1b6d3b-db10-48cc-8159-b211dffc3c22',
    nama_lingkungan: 'Padre Pio 1',
    kk_id: null,
    action_type: 'TAMBAH_KK',
    nama_kk: 'Keluarga FX Sudirman & Maria Fransisca',
    alamat: 'Taman Harapan Baru Blok D5 No. 12',
    is_biduk: true,
    golongan: 'Sejahtera',
    kriteria_catatan: 'Keluarga mandiri, kedua orang tua bekerja tetap, memiliki rumah pribadi dan kendaraan layak.',
    anggota_keluarga: [
      { nama: 'FX Sudirman', peran: 'Kepala Keluarga', is_kaj: true, keterangan: 'Kepala Keluarga' },
      { nama: 'Maria Fransisca', peran: 'Istri', is_kaj: true, keterangan: 'Istri' },
      { nama: 'Benedictus Bryan', peran: 'Anak', is_kaj: true, keterangan: 'Anak Pertama' }
    ],
    status: 'PENDING',
    catatan_paroki: null,
    submitted_by: 'sekretaris_padrepio1',
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago
    is_read: false
  },
  {
    id: 'appr-stcatarina1-02',
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
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(), // 3 hours ago
    is_read: false
  }
]

export function getDafuApprovals(): DafuApprovalItem[] {
  if (typeof window === 'undefined') return INITIAL_APPROVAL_SEED

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_APPROVAL_SEED))
      return INITIAL_APPROVAL_SEED
    }
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
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
    window.dispatchEvent(new Event('storage'))
  } catch (e) {
    console.warn('Failed to save dafu approvals to localStorage:', e)
  }
}

export function createDafuApproval(payload: {
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
}): DafuApprovalItem {
  const current = getDafuApprovals()
  const newItem: DafuApprovalItem = {
    id: `appr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    lingkungan_id: payload.lingkungan_id,
    nama_lingkungan: payload.nama_lingkungan,
    kk_id: payload.kk_id || null,
    action_type: payload.action_type,
    nama_kk: payload.nama_kk,
    alamat: payload.alamat,
    is_biduk: payload.is_biduk,
    golongan: payload.golongan,
    kriteria_catatan: payload.kriteria_catatan,
    anggota_keluarga: payload.anggota_keluarga,
    status: 'PENDING',
    catatan_paroki: null,
    submitted_by: payload.submitted_by || 'Sekretaris Lingkungan',
    created_at: new Date().toISOString(),
    is_read: false
  }

  const updated = [newItem, ...current]
  saveDafuApprovals(updated)
  return newItem
}

export function approveDafuItem(
  id: string,
  reviewedBy: string = 'Sekretaris Paroki',
  adjustedGolongan?: KategoriGolongan,
  adjustedCatatan?: string
): boolean {
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
        reviewed_at: new Date().toISOString(),
        is_read: true
      }
    }
    return item
  })

  if (found) {
    saveDafuApprovals(updated)
  }
  return found
}

export function rejectDafuItem(id: string, catatan: string, reviewedBy: string = 'Sekretaris Paroki'): boolean {
  const current = getDafuApprovals()
  let found = false

  const updated = current.map(item => {
    if (item.id === id) {
      found = true
      return {
        ...item,
        status: 'REJECTED' as const,
        catatan_paroki: catatan.trim() || 'Perubahan data tidak disetujui.',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        is_read: true
      }
    }
    return item
  })

  if (found) {
    saveDafuApprovals(updated)
  }
  return found
}

export function markAllApprovalsAsRead() {
  const current = getDafuApprovals()
  const updated = current.map(item => ({ ...item, is_read: true }))
  saveDafuApprovals(updated)
}

export function getPendingApprovalCount(): number {
  const current = getDafuApprovals()
  return current.filter(item => item.status === 'PENDING').length
}
