'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  FileText,
  Building2,
  Users,
  Home,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Calendar,
  UserCheck,
  AlertCircle
} from 'lucide-react'
import { DafuApprovalItem } from '@/lib/dafuApproval'

interface DafuComparisonModalProps {
  item: DafuApprovalItem | null
  open: boolean
  onClose: () => void
}

export function DafuComparisonModal({ item, open, onClose }: DafuComparisonModalProps) {
  if (!item) return null

  const sebelum = item.data_sebelum_edit
  const isEdited = Boolean(sebelum || item.is_edited_by_paroki)

  // Compare field values to highlight changed items
  const nameChanged = sebelum && sebelum.nama_kk !== item.nama_kk
  const alamatChanged = sebelum && (sebelum.alamat || '') !== (item.alamat || '')
  const bidukChanged = sebelum && sebelum.is_biduk !== item.is_biduk
  const golChanged = sebelum && sebelum.golongan !== item.golongan
  const catatanChanged = sebelum && (sebelum.kriteria_catatan || '') !== (item.kriteria_catatan || '')

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto bg-white text-slate-900 border-slate-200 rounded-2xl p-6 shadow-xl">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              {item.nama_lingkungan}
            </span>
            {isEdited ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/90">
                <Sparkles className="w-3 h-3 text-slate-500" />
                Disesuaikan oleh Sekretaris Paroki
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F2F5F3] text-[#4E6358] border border-[#DCE5DF]">
                <CheckCircle2 className="w-3 h-3 text-[#4E6358]" />
                Disetujui Sesuai Usulan
              </span>
            )}
          </div>
          <DialogTitle className="text-lg font-bold text-slate-900 font-serif">
            Riwayat Perubahan Data: {item.nama_kk}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 flex flex-wrap items-center gap-3 pt-1">
            <span>Diajukan oleh: <strong className="text-slate-700">{item.submitted_by}</strong></span>
            <span>•</span>
            <span>Ditinjau oleh: <strong className="text-slate-700">{item.reviewed_by || 'Sekretaris Paroki'}</strong></span>
            {item.reviewed_at && (
              <>
                <span>•</span>
                <span>{new Date(item.reviewed_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 space-y-4 text-xs">
          {/* Note from Paroki */}
          {item.catatan_paroki && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px] uppercase tracking-wide">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                Catatan Penyesuaian Sekretaris Paroki:
              </div>
              <p className="text-slate-700 italic leading-relaxed pl-5">
                &ldquo;{item.catatan_paroki}&rdquo;
              </p>
            </div>
          )}

          {sebelum ? (
            <div className="space-y-3">
              {/* Comparison Header */}
              <div className="grid grid-cols-2 gap-3 pb-1">
                <div className="p-2.5 rounded-xl bg-slate-50 text-slate-600 font-semibold text-xs flex items-center gap-2 border border-slate-200/80">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span>Sebelum Diedit (Usulan Lingkungan)</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100/90 text-slate-800 font-semibold text-xs flex items-center gap-2 border border-slate-200/90">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#4E6358]" />
                  <span>Sesudah Diedit (Penetapan Paroki)</span>
                </div>
              </div>

              {/* Row 1: Nama Kepala Keluarga */}
              <div className={`p-3 rounded-xl border ${nameChanged ? 'border-slate-200/90 bg-slate-50/60' : 'border-slate-200/80 bg-white'}`}>
                <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase">
                  <span>Nama Kepala Keluarga</span>
                  {nameChanged && <span className="text-[10px] text-slate-600 font-semibold bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md">Diperbarui</span>}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="font-medium text-slate-600 line-through decoration-slate-400">
                    {sebelum.nama_kk}
                  </div>
                  <div className="font-bold text-slate-800">
                    {item.nama_kk}
                  </div>
                </div>
              </div>

              {/* Row 2: Status BIDUK */}
              <div className={`p-3 rounded-xl border ${bidukChanged ? 'border-slate-200/90 bg-slate-50/60' : 'border-slate-200/80 bg-white'}`}>
                <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase">
                  <span>Status BIDUK KAJ</span>
                  {bidukChanged && <span className="text-[10px] text-slate-600 font-semibold bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md">Diperbarui</span>}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200/70">
                      {sebelum.is_biduk ? 'BIDUK KAJ' : 'Non-BIDUK'}
                    </span>
                  </div>
                  <div>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200/90">
                      {item.is_biduk ? 'BIDUK KAJ' : 'Non-BIDUK'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 3: Alamat */}
              <div className={`p-3 rounded-xl border ${alamatChanged ? 'border-slate-200/90 bg-slate-50/60' : 'border-slate-200/80 bg-white'}`}>
                <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase">
                  <span>Alamat Lengkap</span>
                  {alamatChanged && <span className="text-[10px] text-slate-600 font-semibold bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md">Diperbarui</span>}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="text-slate-600">
                    {sebelum.alamat || 'Belum diisi'}
                  </div>
                  <div className="text-slate-800 font-semibold">
                    {item.alamat || 'Belum diisi'}
                  </div>
                </div>
              </div>

              {/* Row 4: Status Golongan */}
              <div className={`p-3 rounded-xl border ${golChanged ? 'border-slate-200/90 bg-slate-50/60' : 'border-slate-200/80 bg-white'}`}>
                <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase">
                  <span>Klasifikasi Golongan Keluarga</span>
                  {golChanged && <span className="text-[10px] text-slate-600 font-semibold bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md">Penyesuaian Paroki</span>}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white text-slate-600 border border-slate-200/80">
                      {sebelum.golongan}
                    </span>
                  </div>
                  <div>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200/90">
                      {item.golongan}
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 5: Catatan Kriteria */}
              <div className={`p-3 rounded-xl border ${catatanChanged ? 'border-slate-200/90 bg-slate-50/60' : 'border-slate-200/80 bg-white'}`}>
                <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase">
                  <span>Catatan Kondisi / Kriteria</span>
                  {catatanChanged && <span className="text-[10px] text-slate-600 font-semibold bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md">Diperbarui</span>}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="text-slate-600 italic">
                    {sebelum.kriteria_catatan || '-'}
                  </div>
                  <div className="text-slate-800 italic font-medium">
                    {item.kriteria_catatan || '-'}
                  </div>
                </div>
              </div>

              {/* Row 6: Anggota Keluarga Comparison */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                <div className="font-semibold text-slate-700 text-[11px] uppercase pb-1 border-b border-slate-100">
                  Susunan Anggota Keluarga
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* Sebelum */}
                  <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200/70">
                    <div className="font-semibold text-slate-500 text-[10px] uppercase">
                      Usulan Lingkungan ({sebelum.anggota_keluarga?.length || 0} Jiwa):
                    </div>
                    {sebelum.anggota_keluarga?.map((m, idx) => (
                      <div key={idx} className="p-1.5 bg-white rounded border border-slate-200 text-[11px]">
                        <div className="font-bold text-slate-800">{m.nama}</div>
                        <div className="text-[10px] text-slate-500 flex items-center justify-between">
                          <span>{m.peran}</span>
                          <span>{m.is_kaj ? 'KAJ' : 'Non-KAJ'}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Sesudah */}
                  <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200/70">
                    <div className="font-semibold text-slate-800 text-[10px] uppercase">
                      Ditetapkan Paroki ({item.anggota_keluarga?.length || 0} Jiwa):
                    </div>
                    {item.anggota_keluarga?.map((m, idx) => (
                      <div key={idx} className="p-1.5 bg-white rounded border border-slate-200 text-[11px]">
                        <div className="font-bold text-slate-900">{m.nama}</div>
                        <div className="text-[10px] text-slate-500 flex items-center justify-between">
                          <span>{m.peran}</span>
                          <span className="font-semibold text-slate-700">{m.is_kaj ? 'KAJ' : 'Non-KAJ'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* If approved without edits */
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-[#F2F5F3] text-[#4E6358] border border-[#DCE5DF] mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="font-bold text-slate-800 text-sm">Disetujui Sesuai Pengajuan Asli</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Pengajuan data keluarga <strong>{item.nama_kk}</strong> disetujui langsung oleh Sekretaris Paroki tanpa perubahan data. Data resmi aktif pada status golongan <strong>{item.golongan}</strong>.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs font-semibold text-slate-700 border-slate-300 rounded-xl"
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
