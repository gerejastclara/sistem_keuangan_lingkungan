'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Users,
  Building2,
  Home,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  Save,
  SlidersHorizontal,
  FileText
} from 'lucide-react'
import {
  DafuApprovalItem,
  DafuMemberItem,
  editAndApproveDafuItem,
  updateDafuApproval
} from '@/lib/dafuApproval'
import { KategoriGolongan } from '@/lib/types'

interface EditDafuApprovalModalProps {
  item: DafuApprovalItem | null
  open: boolean
  onClose: () => void
  onSuccess: (msg: string) => void
  userRole?: 'SEKRETARIS_PAROKI' | 'SEKRETARIS_LINGKUNGAN' | string
}

export function EditDafuApprovalModal({
  item,
  open,
  onClose,
  onSuccess,
  userRole = 'SEKRETARIS_PAROKI'
}: EditDafuApprovalModalProps) {
  const isParoki = userRole === 'SEKRETARIS_PAROKI' || userRole === 'PAROKI'

  const [namaKk, setNamaKk] = useState('')
  const [alamat, setAlamat] = useState('')
  const [isBiduk, setIsBiduk] = useState(true)
  const [golongan, setGolongan] = useState<KategoriGolongan>('Sejahtera')
  const [kriteriaCatatan, setKriteriaCatatan] = useState('')
  const [catatanParoki, setCatatanParoki] = useState('')
  const [anggotaList, setAnggotaList] = useState<DafuMemberItem[]>([])
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (item && open) {
      setNamaKk(item.nama_kk || '')
      setAlamat(item.alamat || '')
      setIsBiduk(item.is_biduk !== false)
      setGolongan(item.golongan || 'Sejahtera')
      setKriteriaCatatan(item.kriteria_catatan || '')
      setCatatanParoki(item.catatan_paroki || '')

      if (Array.isArray(item.anggota_keluarga) && item.anggota_keluarga.length > 0) {
        setAnggotaList(
          item.anggota_keluarga.map(m => ({
            id: m.id,
            nama: m.nama || '',
            peran: m.peran || 'Kepala Keluarga',
            is_kaj: m.is_kaj !== false,
            keterangan: m.keterangan || ''
          }))
        )
      } else {
        setAnggotaList([
          {
            nama: item.nama_kk || '',
            peran: 'Kepala Keluarga',
            is_kaj: item.is_biduk !== false,
            keterangan: 'Kepala Keluarga'
          }
        ])
      }
      setErrorMsg(null)
    }
  }, [item, open])

  if (!item) return null

  const handleAddMember = () => {
    setAnggotaList(prev => [
      ...prev,
      {
        id: `mem-new-${Date.now()}-${prev.length}`,
        nama: '',
        peran: 'Anak',
        is_kaj: true,
        keterangan: ''
      }
    ])
  }

  const handleRemoveMember = (idx: number) => {
    setAnggotaList(prev => prev.filter((_, i) => i !== idx))
  }

  const handleUpdateMember = (idx: number, field: keyof DafuMemberItem, val: any) => {
    setAnggotaList(prev => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], [field]: val }
      return copy
    })
  }

  const handleSave = async () => {
    if (!namaKk.trim()) {
      setErrorMsg('Nama Kepala Keluarga wajib diisi!')
      return
    }

    const cleanMembers = anggotaList
      .filter(m => m.nama.trim().length > 0)
      .map(m => ({
        id: m.id,
        nama: m.nama.trim(),
        peran: m.peran || 'Anggota',
        is_kaj: Boolean(m.is_kaj),
        keterangan: m.keterangan?.trim() || undefined
      }))

    if (cleanMembers.length === 0) {
      cleanMembers.push({
        id: undefined,
        nama: namaKk.trim(),
        peran: 'Kepala Keluarga',
        is_kaj: isBiduk,
        keterangan: 'Kepala Keluarga'
      })
    }

    setSaving(true)
    setErrorMsg(null)

    try {
      if (isParoki) {
        // SEKRETARIS PAROKI: Edit and Approve in one clean step
        await editAndApproveDafuItem(
          item.id,
          {
            nama_kk: namaKk.trim(),
            alamat: alamat.trim() || null,
            is_biduk: isBiduk,
            golongan,
            kriteria_catatan: kriteriaCatatan.trim() || null,
            anggota_keluarga: cleanMembers,
            catatan_paroki: catatanParoki.trim() || null
          },
          'Sekretaris Paroki'
        )
        onSuccess(`Data keluarga "${namaKk.trim()}" berhasil disesuaikan dan disetujui oleh Sekretaris Paroki!`)
      } else {
        // SEKRETARIS LINGKUNGAN: Update pending submission
        await updateDafuApproval(item.id, {
          nama_kk: namaKk.trim(),
          alamat: alamat.trim() || null,
          is_biduk: isBiduk,
          golongan,
          kriteria_catatan: kriteriaCatatan.trim() || null,
          anggota_keluarga: cleanMembers
        })
        onSuccess(`Pengajuan data keluarga "${namaKk.trim()}" berhasil diperbarui!`)
      }
      onClose()
    } catch (e: any) {
      console.error('Error saving approval edit:', e)
      setErrorMsg(e?.message || 'Gagal menyimpan perubahan. Silakan coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-white text-slate-900 border-slate-200 rounded-2xl p-6 shadow-xl">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              {item.nama_lingkungan}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200/80 text-slate-800">
              {isParoki ? 'Mode Edit & Persetujuan Paroki' : 'Edit Pengajuan Umat'}
            </span>
          </div>
          <DialogTitle className="text-lg font-bold text-slate-900 font-serif">
            {isParoki ? 'Penyesuaian & Approval Data Umat' : 'Edit Pengajuan Data Umat'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {isParoki
              ? 'Sekretaris Paroki dapat menyesuaikan data KK, susunan anggota, status BIDUK, maupun golongan secara langsung sebelum menyetujui. Perubahan akan tercatat dan dapat dilihat oleh Sekretaris Lingkungan.'
              : 'Perbarui data usulan keluarga yang sedang menunggu persetujuan Sekretaris Paroki.'}
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        <div className="py-2 space-y-4 text-xs">
          {/* Section 1: Data Kepala Keluarga */}
          <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wide flex items-center gap-1.5">
              <Home className="w-3.5 h-3.5 text-slate-500" />
              <span>Informasi Kepala Keluarga & Domisili</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Nama Kepala Keluarga *</label>
                <Input
                  value={namaKk}
                  onChange={(e) => setNamaKk(e.target.value)}
                  placeholder="Contoh: Petrus Sugeng Santoso"
                  className="h-9 text-xs bg-white border-slate-300 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Status Database KAJ</label>
                <Select value={isBiduk ? 'true' : 'false'} onValueChange={(val) => setIsBiduk(val === 'true')}>
                  <SelectTrigger className="h-9 text-xs bg-white border-slate-300 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-xs">
                    <SelectItem value="true">🟢 BIDUK KAJ (Tercatat)</SelectItem>
                    <SelectItem value="false">⚪ Non-BIDUK (Belum Tercatat)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="font-semibold text-slate-700">Alamat Lengkap</label>
                <Input
                  value={alamat}
                  onChange={(e) => setAlamat(e.target.value)}
                  placeholder="Jl. Mawar No. 12, RT 01/RW 04"
                  className="h-9 text-xs bg-white border-slate-300 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Golongan & Catatan */}
          <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wide flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Klasifikasi Golongan & Catatan Kondisi</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">
                  {isParoki ? 'Status Golongan (Ditetapkan Paroki)' : 'Usulan Status Golongan'}
                </label>
                <Select value={golongan} onValueChange={(val) => setGolongan(val as KategoriGolongan)}>
                  <SelectTrigger className="h-9 text-xs bg-white border-slate-300 rounded-xl font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-xs">
                    <SelectItem value="Sejahtera">🟢 Sejahtera</SelectItem>
                    <SelectItem value="Terduga Pra Sejahtera">🟡 Terduga Pra Sejahtera</SelectItem>
                    <SelectItem value="Rentan Tidak Mampu">🟠 Rentan Tidak Mampu</SelectItem>
                    <SelectItem value="Tidak Mampu">🔴 Tidak Mampu</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Catatan Kondisi / Kriteria Usulan</label>
                <Input
                  value={kriteriaCatatan}
                  onChange={(e) => setKriteriaCatatan(e.target.value)}
                  placeholder="Kondisi ekonomi, lansia, sakit, dll..."
                  className="h-9 text-xs bg-white border-slate-300 rounded-xl"
                />
              </div>

              {isParoki && (
                <div className="sm:col-span-2 space-y-1 pt-1">
                  <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>Catatan Penyesuaian dari Sekretaris Paroki (Akan tampil di Sekretaris Lingkungan)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={catatanParoki}
                    onChange={(e) => setCatatanParoki(e.target.value)}
                    placeholder="Contoh: Disetujui dengan penyesuaian status BIDUK dan ejaan nama sesuai KTP..."
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:ring-slate-400 focus:border-slate-400 bg-white"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Susunan Anggota Keluarga */}
          <div className="space-y-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wide flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span>Susunan Anggota Keluarga ({anggotaList.length} Jiwa)</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddMember}
                className="h-7 px-2.5 text-[11px] font-semibold bg-white border-slate-300 rounded-lg hover:bg-slate-100 text-slate-700 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Tambah Anggota</span>
              </Button>
            </div>

            <div className="space-y-2">
              {anggotaList.map((member, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-white border border-slate-200 grid grid-cols-12 gap-2 items-center text-xs"
                >
                  <div className="col-span-4 sm:col-span-4">
                    <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Nama Lengkap</label>
                    <Input
                      value={member.nama}
                      onChange={(e) => handleUpdateMember(idx, 'nama', e.target.value)}
                      placeholder="Nama anggota"
                      className="h-8 text-xs bg-slate-50 border-slate-200 rounded-lg"
                    />
                  </div>

                  <div className="col-span-3 sm:col-span-3">
                    <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Peran</label>
                    <Select
                      value={member.peran}
                      onValueChange={(val) => handleUpdateMember(idx, 'peran', val)}
                    >
                      <SelectTrigger className="h-8 text-[11px] bg-slate-50 border-slate-200 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200 text-xs">
                        <SelectItem value="Kepala Keluarga">Kepala Keluarga</SelectItem>
                        <SelectItem value="Istri">Istri</SelectItem>
                        <SelectItem value="Anak">Anak</SelectItem>
                        <SelectItem value="Orang Tua">Orang Tua</SelectItem>
                        <SelectItem value="Famili Lain">Famili Lain</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2 sm:col-span-2">
                    <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">KAJ</label>
                    <Select
                      value={member.is_kaj ? 'true' : 'false'}
                      onValueChange={(val) => handleUpdateMember(idx, 'is_kaj', val === 'true')}
                    >
                      <SelectTrigger className="h-8 text-[11px] bg-slate-50 border-slate-200 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200 text-xs">
                        <SelectItem value="true">KAJ</SelectItem>
                        <SelectItem value="false">Non</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2 sm:col-span-2">
                    <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Ket.</label>
                    <Input
                      value={member.keterangan || ''}
                      onChange={(e) => handleUpdateMember(idx, 'keterangan', e.target.value)}
                      placeholder="Ket"
                      className="h-8 text-xs bg-slate-50 border-slate-200 rounded-lg"
                    />
                  </div>

                  <div className="col-span-1 flex items-end justify-center pt-3">
                    {anggotaList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(idx)}
                        className="text-slate-400 hover:text-rose-600 transition p-1 cursor-pointer"
                        title="Hapus baris ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={saving}
            className="w-full sm:w-auto text-xs font-semibold text-slate-700 border-slate-300 rounded-xl"
          >
            Batal
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl flex items-center justify-center gap-1.5 shadow-xs"
          >
            {saving ? (
              <span>Menyimpan...</span>
            ) : isParoki ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Simpan Perubahan & Setujui Data</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Simpan Perubahan Pengajuan</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
