'use client'

import React, { useState, useEffect } from 'react'
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
  Info,
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileText,
  HeartHandshake,
  Landmark,
  Scale,
  Check
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
  PEDOMAN_DUPRAS_KAJ_INFO
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
  const [isDetailPedomanOpen, setIsDetailPedomanOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<KriteriaGolonganItem | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Form State
  const [formNama, setFormNama] = useState('')
  const [formSubjudul, setFormSubjudul] = useState('')
  const [formGarisPengeluaran, setFormGarisPengeluaran] = useState('')
  const [formTahapMetode, setFormTahapMetode] = useState('')
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
    setFormGarisPengeluaran('')
    setFormTahapMetode('')
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
    setFormGarisPengeluaran(item.garisPengeluaran || '')
    setFormTahapMetode(item.tahapMetode || '')
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
            garisPengeluaran: formGarisPengeluaran.trim(),
            tahapMetode: formTahapMetode.trim(),
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
        garisPengeluaran: formGarisPengeluaran.trim(),
        tahapMetode: formTahapMetode.trim(),
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
    if (confirm('Kembalikan parameter klasifikasi ke 4 standar baku resmi Pedoman DUPRAS KAJ 2025?')) {
      const def = resetKriteriaGolonganDefault()
      setItems(def)
      setSuccessMessage('Parameter kriteria telah dikembalikan ke 4 standar baku Pedoman DUPRAS KAJ 2025.')
      setTimeout(() => setSuccessMessage(null), 3000)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 px-2 sm:px-4">
      {/* ========================================================================= */}
      {/* KOP ATAS RESMI KEUSKUPAN AGUNG JAKARTA (KAJ)                              */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-900/15 bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#0A0F1D] text-white p-6 sm:p-8 shadow-xl">
        {/* Subtle decorative ornaments */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

        <div className="relative z-10 space-y-5">
          {/* Header Row: Emblems & Institution Identity */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center shrink-0 shadow-inner">
                <Landmark className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <span className="text-[11px] font-black tracking-widest text-amber-400 uppercase font-serif">
                  Keuskupan Agung Jakarta (KAJ)
                </span>
                <p className="text-xs text-slate-300 font-medium">
                  Tim Sinergi Bidang Prioritas 5 & Komisi Pengembangan Sosial Ekonomi (PSE) Tahun 2025
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white/10 border border-white/15 text-slate-200 self-start sm:self-auto backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Modul Sekretariat & Reksa Pastoral Umat</span>
            </div>
          </div>

          {/* Title & Pastoral Theme */}
          <div className="space-y-2">
            <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white font-serif">
              PEDOMAN KONSEP DATA UMAT PRA-SEJAHTERA (DUPRAS)
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-4xl leading-relaxed">
              <strong className="text-amber-300">Arah Dasar KAJ 2022–2026:</strong> Nilai-nilai Ajaran Sosial Gereja — 
              Tema Tahun 2025: <em className="text-slate-100 font-serif">&ldquo;Kepedulian Lebih kepada Saudara yang Lemah dan Miskin&rdquo;</em>.
              Disusun secara terintegrasi dengan <strong className="text-white">BIDUK KAJ</strong> berbasis pendekatan partisipatif lingkungan.
            </p>
          </div>

          {/* Quick Metrics Bar: 4 Official KAJ Standards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-serif">
                Garis Tidak Mampu
              </span>
              <p className="text-sm sm:text-base font-extrabold text-red-400 mt-0.5">
                Rp 850.000 <span className="text-[10px] font-normal text-slate-300">/kapita/bln</span>
              </p>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Susenas BPS DKI (RT: Rp 4.250.000)
              </span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-serif">
                Garis Rentan Tidak Mampu
              </span>
              <p className="text-sm sm:text-base font-extrabold text-amber-400 mt-0.5">
                Rp 1.700.000 <span className="text-[10px] font-normal text-slate-300">/kapita/bln</span>
              </p>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                2x Garis Tidak Mampu (RT: Rp 8.5M)
              </span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-serif">
                Pendataan-1 (Tahap 1)
              </span>
              <p className="text-sm sm:text-base font-bold text-emerald-300 mt-0.5">
                Skrining BIDUK
              </p>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                5 Data Pokok & 5 Tambahan Risiko
              </span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-serif">
                Pendataan-2 (Tahap 2)
              </span>
              <p className="text-sm sm:text-base font-bold text-sky-300 mt-0.5">
                Survei Lapangan
              </p>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Ukur Rasio Z = Y/X (Pengeluaran RT)
              </span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDetailPedomanOpen(!isDetailPedomanOpen)}
              className="bg-white/10 hover:bg-white/20 text-slate-100 border-white/20 rounded-xl text-xs font-semibold cursor-pointer h-9"
            >
              <BookOpen className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
              {isDetailPedomanOpen ? 'Tutup Ringkasan Alur DUPRAS' : 'Lihat Ringkasan Alur 2 Tahap DUPRAS'}
              {isDetailPedomanOpen ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
            </Button>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleResetToDefault}
                variant="outline"
                size="sm"
                className="bg-white/10 hover:bg-white/20 text-slate-200 border-white/20 rounded-xl text-xs font-medium cursor-pointer h-9"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-slate-300" />
                Reset 4 Baku KAJ
              </Button>

              <Button
                onClick={handleOpenAdd}
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs cursor-pointer h-9 px-3.5 shadow-md"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Tambah Kriteria
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* EXPANDABLE PEDOMAN DUPRAS SUMMARY (2 TAHAP PENDATAAN & TOLAK UKUR BPS)   */}
      {/* ========================================================================= */}
      {isDetailPedomanOpen && (
        <Card className="border-amber-200/90 bg-gradient-to-b from-amber-50/60 to-white rounded-3xl shadow-sm animate-in fade-in duration-200">
          <CardHeader className="pb-3 border-b border-amber-100">
            <div className="flex items-center gap-2 text-amber-900 font-serif">
              <Scale className="w-5 h-5 text-amber-700" />
              <CardTitle className="text-base font-black">
                Ringkasan Resmi Metodologi Pendataan DUPRAS Keuskupan Agung Jakarta
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-amber-800/80">
              Disarikan dari Dokumen Resmi &ldquo;Pedoman Konsep Data Umat Pra-Sejahtera (DUPRAS)&rdquo; KAJ 2025
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 sm:p-6 space-y-5 text-xs text-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Alur Pendataan-1 */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs flex items-center justify-center font-bold">1</span>
                  <h4>Pendataan-1: Skrining Awal (Tanpa Harus Kunjungan)</h4>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Dilakukan terhadap semua keluarga di BIDUK oleh Pengurus Lingkungan (Ketua, Seksi Sosial/PSE, & Sekretaris). Menggunakan:
                </p>
                <ul className="space-y-1.5 pl-2 list-none">
                  <li className="flex items-start gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>5 Indikator Data Pokok:</strong> Wilayah kumuh, semi permanen, tempat tinggal bukan milik sendiri, tidak ada pekerjaan tetap, dan pengeluaran RT &lt; Rp 8.500.000,-/bln.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>5 Faktor Data Tambahan:</strong> Disabilitas, risiko balita gizi buruk, risiko stunting, sakit kronis/menahun, dan lansia (&gt;60 th) terlantar/sendiri.</span>
                  </li>
                </ul>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium text-[11px] text-slate-800">
                  ⚡ <strong>Hasil Skrining Tahap 1:</strong> Bila semua dijawab TIDAK &rarr; <strong>Sejahtera</strong>. Bila ada minimal 1 jawaban YA/RAGU &rarr; <strong>Terduga Pra Sejahtera</strong> (wajib lanjut Tahap 2).
                </div>
              </div>

              {/* Alur Pendataan-2 */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs flex items-center justify-center font-bold">2</span>
                  <h4>Pendataan-2: Survei Lapangan & Konfirmasi Langsung</h4>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Hanya dilakukan terhadap keluarga dengan status <strong>Terduga Pra Sejahtera</strong> melalui survei kunjungan langsung by name by address oleh Tim Pengurus Lingkungan.
                </p>
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1 text-[11px]">
                  <span className="font-bold text-amber-950 block">Formula Perhitungan Rasio Pengeluaran Riil (Z):</span>
                  <div className="font-mono font-bold text-xs text-amber-900 bg-white p-2 rounded-lg border border-amber-200 text-center">
                    Z = (Jumlah Pengeluaran RT per Bulan [Y]) / (Jumlah Seluruh ART [X])
                  </div>
                  <ul className="space-y-1 mt-1 text-slate-700">
                    <li>• <strong>Z &ge; Rp 1.700.000,-</strong> &rarr; Tergolong <strong>SEJAHTERA</strong></li>
                    <li>• <strong>Rp 850.000,- &lt; Z &lt; Rp 1.700.000,-</strong> &rarr; Tergolong <strong>RENTAN TIDAK MAMPU</strong></li>
                    <li>• <strong>Z &le; Rp 850.000,-</strong> &rarr; Tergolong <strong>TIDAK MAMPU</strong></li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-3 shadow-xs animate-in fade-in">
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

      {/* DAFU Integration Notice */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-start gap-3.5">
        <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-700 space-y-1">
          <span className="font-bold text-slate-900 block text-sm">
            Sinkronisasi Otomatis dengan Modul DAFU (Data Umat) & Rekapitulasi Lingkungan
          </span>
          <p className="leading-relaxed">
            Keempat kriteria baku KAJ di bawah ini menjadi standar penilaian ekonomi keluarga umat saat Sekretaris Lingkungan 
            mengisi data di <strong>Modul DAFU</strong>. Data penggolongan ini digunakan secara berjenjang di tingkat 
            <strong> Lingkungan, Paroki, hingga Keuskupan Agung Jakarta</strong> untuk penyaluran bantuan sosial PSE, ASAK, SABUK, dan subsidi kas.
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4 CARDS KRITERIA GOLONGAN (SEJAHTERA, TERDUGA, RENTAN, TIDAK MAMPU)       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {items.map((item, idx) => (
          <Card
            key={item.id}
            className="bg-white border-slate-200/90 rounded-3xl shadow-xs hover:shadow-md transition duration-200 flex flex-col justify-between overflow-hidden"
          >
            <div>
              {/* Card Header Color Bar */}
              <div
                className="p-5 border-b flex items-start justify-between gap-3"
                style={{
                  backgroundColor: item.bgLight || '#f8fafc',
                  borderColor: item.borderLight || '#e2e8f0',
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl leading-none">{item.iconEmoji}</span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-black text-slate-900 font-serif">{item.nama}</h3>
                      {item.isDefault && (
                        <span className="text-[10px] bg-white/90 border border-slate-200 px-2 py-0.5 rounded-full font-bold text-slate-700 shadow-2xs">
                          Standar DUPRAS KAJ
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold mt-0.5" style={{ color: item.textColor || '#475569' }}>
                      {item.subjudul}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenEdit(item)}
                    className="h-8 px-2.5 text-xs border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl cursor-pointer font-medium shadow-2xs"
                    title="Ubah rincian kriteria"
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1 text-slate-500" />
                    Edit
                  </Button>
                  {!item.isDefault && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(item.id, item.nama)}
                      className="h-8 px-2 text-xs border-rose-200 bg-white hover:bg-rose-50 text-rose-600 rounded-xl cursor-pointer"
                      title="Hapus kriteria kustom"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <CardContent className="p-5 space-y-4 text-xs text-slate-700">
                {/* Ambang Batas Pengeluaran / Garis Kemiskinan */}
                {item.garisPengeluaran && (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-serif">
                      Tolak Ukur Standar Pengeluaran / Garis DUPRAS:
                    </span>
                    <p className="font-mono font-bold text-xs text-slate-900">
                      {item.garisPengeluaran}
                    </p>
                  </div>
                )}

                {/* Tahap & Metode Penentuan */}
                {item.tahapMetode && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-serif">
                      Tahapan & Metode Pendataan:
                    </span>
                    <p className="text-slate-700 font-semibold">
                      {item.tahapMetode}
                    </p>
                  </div>
                )}

                {/* Indikator Penilaian */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-serif">
                    Indikator Kriteria & Karakteristik Rumah Tangga:
                  </span>
                  <p className="leading-relaxed bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 text-slate-800">
                    {item.indikator || 'Belum ada rincian indikator tertulis.'}
                  </p>
                </div>

                {/* Contoh Kondisi */}
                {item.contohKondisi && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-serif">
                      Contoh Kasus / Profesi Keluarga:
                    </span>
                    <p className="text-slate-600 italic bg-amber-50/30 p-2.5 rounded-xl border border-amber-100/60">
                      &ldquo;{item.contohKondisi}&rdquo;
                    </p>
                  </div>
                )}

                {/* Rekomendasi Kebijakan Bantuan */}
                {item.rekomendasiBantuan && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block font-serif flex items-center gap-1.5">
                      <HeartHandshake className="w-3.5 h-3.5 text-emerald-600" />
                      Rekomendasi Kebijakan & Bantuan Pastoral:
                    </span>
                    <p className="text-slate-800 font-medium leading-relaxed">
                      {item.rekomendasiBantuan}
                    </p>
                  </div>
                )}
              </CardContent>
            </div>

            {/* Card Footer */}
            <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-serif">Prioritas Penanganan #{idx + 1}</span>
              <span className="font-semibold text-emerald-700 flex items-center gap-1">
                Aktif di Modul DAFU <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* DIALOG ADD / EDIT KRITERIA                                                */}
      {/* ========================================================================= */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-xl bg-white border-slate-200 text-slate-900 rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Tolak Ukur Pengeluaran</Label>
                <Input
                  value={formGarisPengeluaran}
                  onChange={(e) => setFormGarisPengeluaran(e.target.value)}
                  placeholder="Contoh: Z ≤ Rp 850.000 / kapita / bln"
                  className="bg-white border-slate-300 text-slate-900 rounded-xl h-10 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Tahapan & Metode</Label>
                <Input
                  value={formTahapMetode}
                  onChange={(e) => setFormTahapMetode(e.target.value)}
                  placeholder="Contoh: Pendataan-2 Survei Lapangan"
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
                className="bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer px-5"
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
