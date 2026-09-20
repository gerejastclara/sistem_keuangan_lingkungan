'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  SlidersHorizontal,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
  Users,
  Info
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  getKriteriaGolonganList,
  saveKriteriaGolonganList,
  resetKriteriaGolonganDefault,
  KriteriaGolonganItem,
  DEFAULT_KRITERIA_GOLONGAN
} from '@/lib/kriteriaGolonganData'

const COLOR_PRESETS = [
  { name: 'Hijau (Mandiri)', badgeColor: '#16a34a', bgLight: '#f0fdf4', borderLight: '#bbf7d0', textColor: '#15803d', iconEmoji: '🟢' },
  { name: 'Kuning (Perhatian)', badgeColor: '#eab308', bgLight: '#fefce8', borderLight: '#fef08a', textColor: '#a16207', iconEmoji: '🟡' },
  { name: 'Oranye (Rentan)', badgeColor: '#ea580c', bgLight: '#fff7ed', borderLight: '#fed7aa', textColor: '#c2410c', iconEmoji: '🟠' },
  { name: 'Merah (Bantuan Penuh)', badgeColor: '#dc2626', bgLight: '#fef2f2', borderLight: '#fecaca', textColor: '#b91c1c', iconEmoji: '🔴' },
  { name: 'Biru (Khusus)', badgeColor: '#2563eb', bgLight: '#eff6ff', borderLight: '#bfdbfe', textColor: '#1d4ed8', iconEmoji: '🔵' },
  { name: 'Ungu (Prioritas)', badgeColor: '#9333ea', bgLight: '#faf5ff', borderLight: '#e9d5ff', textColor: '#7e22ce', iconEmoji: '🟣' },
]

export default function KriteriaGolonganPage() {
  const [items, setItems] = useState<KriteriaGolonganItem[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<KriteriaGolonganItem | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Form State
  const [formNama, setFormNama] = useState('')
  const [formSubjudul, setFormSubjudul] = useState('')
  const [formIndikator, setFormIndikator] = useState('')
  const [formContohKondisi, setFormContohKondisi] = useState('')
  const [formRekomendasiBantuan, setFormRekomendasiBantuan] = useState('')
  const [selectedColorIndex, setSelectedColorIndex] = useState(0)

  // Load items
  useEffect(() => {
    setItems(getKriteriaGolonganList())

    const handleUpdate = () => {
      setItems(getKriteriaGolonganList())
    }
    window.addEventListener('kriteriaGolonganChanged', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('kriteriaGolonganChanged', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  const handleOpenAdd = () => {
    setEditingItem(null)
    setFormNama('')
    setFormSubjudul('')
    setFormIndikator('')
    setFormContohKondisi('')
    setFormRekomendasiBantuan('')
    setSelectedColorIndex(0)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (item: KriteriaGolonganItem) => {
    setEditingItem(item)
    setFormNama(item.nama)
    setFormSubjudul(item.subjudul)
    setFormIndikator(item.indikator)
    setFormContohKondisi(item.contohKondisi)
    setFormRekomendasiBantuan(item.rekomendasiBantuan)

    const foundIdx = COLOR_PRESETS.findIndex((c) => c.badgeColor === item.badgeColor)
    setSelectedColorIndex(foundIdx >= 0 ? foundIdx : 0)
    setIsModalOpen(true)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formNama.trim()) return

    const colorConfig = COLOR_PRESETS[selectedColorIndex] || COLOR_PRESETS[0]

    let updatedList: KriteriaGolonganItem[] = []

    if (editingItem) {
      updatedList = items.map((it) => {
        if (it.id === editingItem.id) {
          return {
            ...it,
            nama: formNama.trim(),
            subjudul: formSubjudul.trim() || 'Kriteria Lingkungan',
            indikator: formIndikator.trim(),
            contohKondisi: formContohKondisi.trim(),
            rekomendasiBantuan: formRekomendasiBantuan.trim(),
            badgeColor: colorConfig.badgeColor,
            bgLight: colorConfig.bgLight,
            borderLight: colorConfig.borderLight,
            textColor: colorConfig.textColor,
            iconEmoji: colorConfig.iconEmoji,
          }
        }
        return it
      })
      setSuccessMessage(`Parameter golongan "${formNama.trim()}" berhasil diperbarui.`)
    } else {
      const newItem: KriteriaGolonganItem = {
        id: `gol-custom-${Date.now()}`,
        nama: formNama.trim(),
        subjudul: formSubjudul.trim() || 'Kriteria Baru Lingkungan',
        indikator: formIndikator.trim(),
        contohKondisi: formContohKondisi.trim(),
        rekomendasiBantuan: formRekomendasiBantuan.trim(),
        badgeColor: colorConfig.badgeColor,
        bgLight: colorConfig.bgLight,
        borderLight: colorConfig.borderLight,
        textColor: colorConfig.textColor,
        iconEmoji: colorConfig.iconEmoji,
        urutan: items.length + 1,
        isDefault: false,
      }
      updatedList = [...items, newItem]
      setSuccessMessage(`Parameter golongan baru "${formNama.trim()}" berhasil ditambahkan.`)
    }

    saveKriteriaGolonganList(updatedList)
    setItems(updatedList)
    setIsModalOpen(false)

    setTimeout(() => {
      setSuccessMessage(null)
    }, 4000)
  }

  const handleDelete = (id: string, nama: string) => {
    if (confirm(`Hapus parameter klasifikasi golongan "${nama}"?`)) {
      const updatedList = items.filter((it) => it.id !== id)
      saveKriteriaGolonganList(updatedList)
      setItems(updatedList)
      setSuccessMessage(`Parameter golongan "${nama}" telah dihapus.`)
      setTimeout(() => setSuccessMessage(null), 3000)
    }
  }

  const handleResetToDefault = () => {
    if (confirm('Kembalikan parameter klasifikasi ke 4 standar baku Keuskupan Agung Jakarta / Paroki?')) {
      const def = resetKriteriaGolonganDefault()
      setItems(def)
      setSuccessMessage('Parameter kriteria telah dikembalikan ke 4 standar default.')
      setTimeout(() => setSuccessMessage(null), 3000)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F6EFE2] text-[#5A4423] border border-[#A9834F]/30 font-serif">
            <Sparkles className="w-3.5 h-3.5 text-[#A9834F]" />
            Modul Sekretariat & Paroki
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 font-serif">
            <SlidersHorizontal className="w-6 h-6 text-emerald-600" />
            Parameter & Kriteria Klasifikasi Golongan Umat
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Kustomisasi indikator ekonomi dan kebijakan bantuan keluarga umat agar selaras dengan kondisi warga lingkungan
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <Button
            onClick={handleResetToDefault}
            variant="outline"
            size="sm"
            className="border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer h-10"
          >
            <RotateCcw className="w-4 h-4 mr-1.5 text-slate-500" />
            Reset Default Paroki
          </Button>

          <Button
            onClick={handleOpenAdd}
            size="sm"
            className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer h-10 px-4 shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Tambah Kriteria Golongan
          </Button>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <Link href="/dashboard/dafu">
            <Button size="sm" variant="ghost" className="text-xs text-emerald-700 hover:bg-emerald-100/50 font-bold">
              Buka DAFU Sekarang &rarr;
            </Button>
          </Link>
        </div>
      )}

      {/* Info Card: Cara Kerja Parameter */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3.5">
        <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-700 space-y-1">
          <span className="font-bold text-slate-900 block text-sm">
            Sinkronisasi Otomatis dengan Modul DAFU (Input Data Umat)
          </span>
          <p className="leading-relaxed">
            Setiap perubahan atau penambahan parameter di modul ini akan langsung muncul pada pilihan dropdown 
            <strong> &ldquo;Pilih Golongan Keluarga&rdquo;</strong> dan filter tabel di halaman DAFU. Sekretaris Lingkungan 
            dapat menyesuaikan kriteria indikator ekonomi sesuai panduan pastoral terkini.
          </p>
        </div>
      </div>

      {/* Cards List of Kriteria */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {items.map((item, idx) => (
          <Card
            key={item.id}
            className="bg-white border-slate-200/90 rounded-2xl shadow-xs hover:shadow-md transition duration-200 flex flex-col justify-between overflow-hidden"
          >
            <div>
              {/* Card Header Color Bar */}
              <div
                className="p-4 border-b flex items-center justify-between"
                style={{
                  backgroundColor: item.bgLight || '#f8fafc',
                  borderColor: item.borderLight || '#e2e8f0',
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl leading-none">{item.iconEmoji}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{item.nama}</h3>
                      {item.isDefault && (
                        <span className="text-[10px] bg-white/80 border border-slate-200 px-1.5 py-0.5 rounded font-medium text-slate-600">
                          Baku Paroki
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold" style={{ color: item.textColor || '#475569' }}>
                      {item.subjudul}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenEdit(item)}
                    className="h-8 px-2.5 text-xs border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg cursor-pointer font-medium"
                    title="Ubah kriteria"
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1 text-slate-500" />
                    Edit
                  </Button>
                  {!item.isDefault && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(item.id, item.nama)}
                      className="h-8 px-2 text-xs border-rose-200 bg-white hover:bg-rose-50 text-rose-600 rounded-lg cursor-pointer"
                      title="Hapus kriteria kustom"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <CardContent className="p-5 space-y-3.5 text-xs text-slate-700">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block font-serif">
                    Indikator Kriteria / Kemampuan:
                  </span>
                  <p className="leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 text-slate-800">
                    {item.indikator || 'Belum ada rincian indikator tertulis.'}
                  </p>
                </div>

                {item.contohKondisi && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block font-serif">
                      Contoh Kondisi Keluarga:
                    </span>
                    <p className="text-slate-600 italic">
                      &ldquo;{item.contohKondisi}&rdquo;
                    </p>
                  </div>
                )}

                {item.rekomendasiBantuan && (
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-serif flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-slate-400" />
                      Rekomendasi Kebijakan / Subsidi:
                    </span>
                    <p className="text-slate-800 font-medium leading-relaxed">
                      {item.rekomendasiBantuan}
                    </p>
                  </div>
                )}
              </CardContent>
            </div>

            {/* Card Footer */}
            <div className="px-5 py-3 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>Urutan Prioritas #{idx + 1}</span>
              <span className="font-semibold text-emerald-700 flex items-center gap-1">
                Aktif Digunakan <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Dialog Add / Edit Kriteria */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-xl bg-white border-slate-200 text-slate-900 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2 font-serif">
              <SlidersHorizontal className="w-5 h-5 text-emerald-600" />
              {editingItem ? 'Edit Parameter Kriteria Golongan' : 'Tambah Parameter Golongan Baru'}
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-1">
              Atur nama golongan, indikator kriteria ekonomi, serta tema warna tampilan di modul DAFU
            </p>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Nama Golongan *</Label>
                <Input
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  placeholder="Contoh: Rentan Khusus Lansia"
                  required
                  className="bg-white border-slate-300 text-slate-900 rounded-xl h-10 text-xs font-semibold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Subjudul / Label Singkat</Label>
                <Input
                  value={formSubjudul}
                  onChange={(e) => setFormSubjudul(e.target.value)}
                  placeholder="Contoh: Butuh Bantuan Bulanan"
                  className="bg-white border-slate-300 text-slate-900 rounded-xl h-10 text-xs"
                />
              </div>
            </div>

            {/* Theme / Badge Color Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Pilih Warna Badge & Icon</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {COLOR_PRESETS.map((preset, pIdx) => (
                  <button
                    key={pIdx}
                    type="button"
                    onClick={() => setSelectedColorIndex(pIdx)}
                    className={`p-2 rounded-xl border text-left flex items-center gap-2 cursor-pointer transition text-xs ${
                      selectedColorIndex === pIdx
                        ? 'border-slate-800 ring-2 ring-slate-800/20 font-bold bg-white'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                    }`}
                  >
                    <span className="text-base">{preset.iconEmoji}</span>
                    <span className="truncate text-[11px] text-slate-800">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Indikator Kriteria */}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">
                Indikator Kriteria Penilaian *
              </Label>
              <textarea
                value={formIndikator}
                onChange={(e) => setFormIndikator(e.target.value)}
                placeholder="Jelaskan kondisi ekonomi, pekerjaan, kepemilikan rumah, atau kesehatan yang menjadi tolak ukur..."
                rows={3}
                required
                className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Contoh Kondisi */}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Contoh Kasus / Profesi</Label>
              <Input
                value={formContohKondisi}
                onChange={(e) => setFormContohKondisi(e.target.value)}
                placeholder="Contoh: Lansia tinggal sendiri, buruh lepas harian"
                className="bg-white border-slate-300 text-slate-900 rounded-xl h-10 text-xs"
              />
            </div>

            {/* Rekomendasi Bantuan */}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">
                Rekomendasi Kebijakan Bantuan / Subsidi Lingkungan
              </Label>
              <Input
                value={formRekomendasiBantuan}
                onChange={(e) => setFormRekomendasiBantuan(e.target.value)}
                placeholder="Contoh: Pembebasan iuran kas & santunan sembako hari raya"
                className="bg-white border-slate-300 text-slate-900 rounded-xl h-10 text-xs"
              />
            </div>

            <DialogFooter className="pt-3 gap-2 flex sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border-slate-300 text-xs cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="submit"
                className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer px-5"
              >
                {editingItem ? 'Simpan Perubahan' : 'Tambah Parameter'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
