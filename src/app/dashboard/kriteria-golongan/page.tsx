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
import { createClient } from '@/utils/supabase/client'
import { UserRole } from '@/lib/types'

const COLOR_PRESETS = [
  { name: 'Hijau (Mandiri)', badgeColor: '#16a34a', bgLight: '#f0fdf4', borderLight: '#bbf7d0', textColor: '#15803d', iconEmoji: '🟢' },
  { name: 'Kuning (Perhatian)', badgeColor: '#eab308', bgLight: '#fefce8', borderLight: '#fef08a', textColor: '#a16207', iconEmoji: '🟡' },
  { name: 'Oranye (Rentan)', badgeColor: '#ea580c', bgLight: '#fff7ed', borderLight: '#fed7aa', textColor: '#c2410c', iconEmoji: '🟠' },
  { name: 'Merah (Bantuan Penuh)', badgeColor: '#dc2626', bgLight: '#fef2f2', borderLight: '#fecaca', textColor: '#b91c1c', iconEmoji: '🔴' },
  { name: 'Biru (Khusus)', badgeColor: '#2563eb', bgLight: '#eff6ff', borderLight: '#bfdbfe', textColor: '#1d4ed8', iconEmoji: '🔵' },
  { name: 'Ungu (Prioritas)', badgeColor: '#9333ea', bgLight: '#faf5ff', borderLight: '#e9d5ff', textColor: '#7e22ce', iconEmoji: '🟣' },
]

function parseIndikatorPoints(text: string): string[] {
  if (!text) return []
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length > 1) {
    return lines.map((l) => l.replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean)
  }

  if (text.includes('•')) {
    const parts = text.split('•').map((s) => s.trim()).filter(Boolean)
    if (parts.length > 1) return parts
  }

  if (text.includes('(1)') && text.includes('(2)')) {
    const parts = text.split(/(?=\(\d+\))/g).map((s) => s.trim()).filter(Boolean)
    return parts
  }

  return [text]
}

function renderFormattedText(rawText: string) {
  const parts = rawText.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-bold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export default function KriteriaGolonganPage() {
  const [items, setItems] = useState<KriteriaGolonganItem[]>([])
  const [userRole, setUserRole] = useState<UserRole>('SEKRETARIS')
  const isParoki = userRole === 'PAROKI'

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

  // Load items & check role
  useEffect(() => {
    setItems(getKriteriaGolonganList())

    const handleUpdate = () => {
      setItems(getKriteriaGolonganList())
    }
    window.addEventListener('kriteriaGolonganChanged', handleUpdate)
    window.addEventListener('storage', handleUpdate)

    async function checkRole() {
      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getUser()
        const user = data?.user
        if (user) {
          const { data: uData } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
          if (uData?.role) {
            setUserRole(uData.role)
            return
          }
        }
      } catch (err) {
        console.error('Error fetching user role:', err)
      }

      const cookies = typeof document !== 'undefined' ? document.cookie : ''
      const getCookieVal = (name: string) => {
        const v = `; ${cookies}`
        const p = v.split(`; ${name}=`)
        if (p.length === 2) return decodeURIComponent(p.pop()!.split(';').shift()!)
        return null
      }
      const demoRole = getCookieVal('demo_user_role') || ''
      const demoEmail = getCookieVal('demo_user_email') || getCookieVal('demo_user_username') || ''
      if (demoRole === 'PAROKI' || demoEmail.includes('paroki')) {
        setUserRole('PAROKI')
      } else if (demoRole === 'BENDAHARA' || demoEmail.includes('bendahara')) {
        setUserRole('BENDAHARA')
      } else {
        setUserRole('SEKRETARIS')
      }
    }

    checkRole()

    return () => {
      window.removeEventListener('kriteriaGolonganChanged', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  const handleOpenAdd = () => {
    if (!isParoki) return
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
    if (!isParoki) return
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
    if (!isParoki) {
      alert('Akses ditolak: Hanya akun Paroki yang berwenang mengubah kriteria golongan.')
      return
    }
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
    if (!isParoki) {
      alert('Akses ditolak: Hanya akun Paroki yang berwenang menghapus kriteria golongan.')
      return
    }
    if (confirm(`Hapus parameter klasifikasi golongan "${nama}"?`)) {
      const updatedList = items.filter((it) => it.id !== id)
      saveKriteriaGolonganList(updatedList)
      setItems(updatedList)
      setSuccessMessage(`Parameter golongan "${nama}" telah dihapus.`)
      setTimeout(() => setSuccessMessage(null), 3000)
    }
  }

  const handleResetToDefault = () => {
    if (!isParoki) {
      alert('Akses ditolak: Hanya akun Paroki yang berwenang mereset kriteria golongan.')
      return
    }
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
      {/* KOP ATAS RESMI KEUSKUPAN AGUNG JAKARTA (KAJ) - SESUAI SAMPUL ASLI DUPRAS  */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-300 rounded-2xl shadow-xs overflow-hidden">
        <div className="py-10 px-6 sm:px-12 text-center space-y-7">
          <div>
            <h2 className="text-sm sm:text-base font-bold tracking-widest text-slate-900 uppercase">
              PEDOMAN KONSEP
            </h2>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              DATA UMAT PRA-SEJAHTERA
            </h1>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              (DUPRAS)
            </h1>
          </div>

          <div>
            <h3 className="text-base sm:text-xl font-bold tracking-wide text-slate-900 uppercase">
              KEUSKUPAN AGUNG JAKARTA
            </h3>
          </div>

          <div className="pt-8 max-w-md mx-auto text-xs sm:text-sm font-medium text-slate-800 space-y-1 leading-relaxed">
            <p>Tim Sinergi Bidang Prioritas 5 dan</p>
            <p>Komisi Pengembangan Sosial Ekonomi</p>
            <p className="font-semibold text-slate-900">Tahun 2025</p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsDetailPedomanOpen(!isDetailPedomanOpen)}
            className="border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer h-9"
          >
            <BookOpen className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
            {isDetailPedomanOpen ? 'Tutup Ringkasan Alur' : 'Lihat Ringkasan Alur 2 Tahap DUPRAS'}
            {isDetailPedomanOpen ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
          </Button>

          {isParoki ? (
            <div className="flex items-center gap-2">
              <Button
                onClick={handleResetToDefault}
                variant="outline"
                size="sm"
                className="border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer h-9"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                Reset 4 Baku KAJ
              </Button>

              <Button
                onClick={handleOpenAdd}
                size="sm"
                className="bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer h-9 px-4 shadow-xs transition-all"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Tambah Kriteria
              </Button>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Akses Sekretaris: <strong>Hanya Lihat</strong> (Edit parameter hanya melalui akun Paroki)</span>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* EXPANDABLE PEDOMAN DUPRAS SUMMARY (2 TAHAP PENDATAAN & TOLAK UKUR BPS)   */}
      {/* ========================================================================= */}
      {isDetailPedomanOpen && (
        <Card className="border-slate-300 bg-white rounded-2xl shadow-xs animate-in fade-in duration-150">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-slate-900">
              <Scale className="w-4 h-4 text-slate-700" />
              <CardTitle className="text-sm sm:text-base font-bold text-slate-900">
                Ringkasan Resmi Metodologi Pendataan DUPRAS Keuskupan Agung Jakarta
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500">
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
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 text-[11px]">
                  <span className="font-bold text-amber-950 block">Patokan Standar Pengeluaran Keluarga:</span>
                  <ul className="space-y-1.5 text-slate-700">
                    <li className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span><strong>Di atas Rp 8.500.000,- / bln</strong> (atau &gt; Rp 1,7 jt/orang) &rarr; <strong className="text-emerald-800">SEJAHTERA</strong></span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      <span><strong>Rp 4.250.000 - Rp 8.500.000 / bln</strong> (Rp 850rb - Rp 1,7 jt/orang) &rarr; <strong className="text-amber-800">RENTAN TIDAK MAMPU</strong></span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                      <span><strong>Di bawah Rp 4.250.000,- / bln</strong> (&lt; Rp 850rb/orang) &rarr; <strong className="text-rose-800">TIDAK MAMPU</strong></span>
                    </li>
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

      {/* Read-Only Notice for non-PAROKI */}
      {!isParoki && (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-start gap-3.5">
          <ShieldAlert className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-700 space-y-1">
            <span className="font-bold text-slate-900 block text-sm">
              Hak Akses Sekretaris: Mode Baca (Read-Only)
            </span>
            <p className="leading-relaxed">
              Pengubahan parameter dan kriteria baku penggolongan ekonomi hanya dapat dilakukan melalui <strong>Akun Pengawas Paroki</strong>. 
              Sekretaris Lingkungan menggunakan parameter ini sebagai pedoman dan acuan saat menentukan golongan keluarga umat pada <strong>Modul DAFU</strong>.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4 CARDS KRITERIA GOLONGAN (SEJAHTERA, TERDUGA, RENTAN, TIDAK MAMPU)       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {items.map((item, idx) => {
          const points = parseIndikatorPoints(item.indikator)
          return (
            <Card
              key={item.id}
              className="bg-white border-slate-200/90 rounded-3xl shadow-xs hover:shadow-md transition duration-200 flex flex-col justify-between overflow-hidden h-full"
            >
              <div className="flex-1 flex flex-col">
                {/* Card Header Color Bar */}
                <div
                  className="p-5 border-b flex items-start justify-between gap-3 min-h-[96px]"
                  style={{
                    backgroundColor: item.bgLight || '#f8fafc',
                    borderColor: item.borderLight || '#e2e8f0',
                  }}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-3xl leading-none shrink-0">{item.iconEmoji}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-black text-slate-900 font-serif leading-tight">{item.nama}</h3>
                        {item.isDefault && (
                          <span className="text-[10px] bg-white/95 border border-slate-200 px-2 py-0.5 rounded-full font-bold text-slate-700 shadow-2xs shrink-0">
                            Standar DUPRAS KAJ
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold mt-1 leading-snug" style={{ color: item.textColor || '#475569' }}>
                        {item.subjudul}
                      </p>
                    </div>
                  </div>

                  {isParoki ? (
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
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-500 bg-white/90 border border-slate-200 px-2.5 py-1 rounded-xl shadow-2xs shrink-0 flex items-center gap-1">
                      <Check className="w-3 h-3 text-slate-400" /> Acuan Standar
                    </span>
                  )}
                </div>

                {/* Card Body */}
                <CardContent className="p-5 flex-1 flex flex-col justify-between gap-4 text-xs text-slate-700">
                  {/* Ambang Batas Pengeluaran / Garis Kemiskinan */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 min-h-[76px] flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-serif mb-1">
                      Tolak Ukur Standar Pengeluaran / Garis DUPRAS:
                    </span>
                    <p className="font-mono font-bold text-xs text-slate-900 leading-tight">
                      {item.garisPengeluaran || '-'}
                    </p>
                  </div>

                  {/* Tahap & Metode Penentuan */}
                  <div className="p-3 rounded-2xl bg-slate-50/70 border border-slate-100 min-h-[64px] flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-serif mb-0.5">
                      Tahapan & Metode Pendataan:
                    </span>
                    <p className="text-slate-800 font-semibold text-xs leading-snug">
                      {item.tahapMetode || '-'}
                    </p>
                  </div>

                  {/* Indikator Penilaian (Per Point Inti) */}
                  <div className="flex-1 flex flex-col space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-serif">
                      Indikator Kriteria & Karakteristik Rumah Tangga:
                    </span>
                    <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 flex-1 flex flex-col justify-start min-h-[310px]">
                      <ul className="space-y-2.5 text-xs">
                        {points.map((pt, pIdx) => (
                          <li key={pIdx} className="flex items-start gap-2.5 leading-relaxed">
                            <span
                              className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                              style={{ backgroundColor: item.badgeColor || '#16a34a' }}
                            />
                            <span className="text-[11.5px] text-slate-700 leading-snug">
                              {renderFormattedText(pt)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Contoh Kondisi */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-serif">
                      Contoh Kasus / Profesi Keluarga:
                    </span>
                    <div className="bg-amber-50/35 p-3 rounded-2xl border border-amber-100/70 min-h-[72px] flex items-center">
                      <p className="text-slate-700 italic text-xs leading-snug">
                        &ldquo;{item.contohKondisi || 'Belum ada contoh kasus spesifik.'}&rdquo;
                      </p>
                    </div>
                  </div>

                  {/* Rekomendasi Kebijakan Bantuan */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl min-h-[96px] flex flex-col justify-center space-y-1">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block font-serif flex items-center gap-1.5">
                      <HeartHandshake className="w-3.5 h-3.5 text-emerald-600" />
                      Rekomendasi Kebijakan & Bantuan Pastoral:
                    </span>
                    <p className="text-slate-800 font-medium text-xs leading-snug">
                      {item.rekomendasiBantuan || '-'}
                    </p>
                  </div>
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
          )
        })}
      </div>

      {/* ========================================================================= */}
      {/* DIALOG ADD / EDIT KRITERIA (HANYA UNTUK PAROKI)                           */}
      {/* ========================================================================= */}
      <Dialog open={isParoki && isModalOpen} onOpenChange={(open) => isParoki && setIsModalOpen(open)}>
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
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-700">
                  Indikator Kriteria Penilaian (Per Point Inti) *
                </Label>
                <span className="text-[10px] text-slate-400">Gunakan baris baru atau • untuk tiap point</span>
              </div>
              <textarea
                value={formIndikator}
                onChange={(e) => setFormIndikator(e.target.value)}
                placeholder="• **Judul Point:** Keterangan point indikator..."
                rows={6}
                required
                className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
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
