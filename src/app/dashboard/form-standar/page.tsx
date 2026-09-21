'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  FileText,
  Printer,
  FileCheck,
  Award,
  ScrollText,
  Building,
  CheckCircle2,
  Calendar,
  User,
  ShieldCheck,
  Stamp,
  Download,
  RotateCcw,
  Sparkles,
  Pencil,
  Search,
  ExternalLink,
  Users,
  BookOpen,
  Info,
  Check,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatNamaLingkungan, getAllMasterLingkungan } from '@/lib/constants'
import { getPengurusForLingkungan } from '@/lib/pengurusData'
import { createClient } from '@/utils/supabase/client'
import { KepalaKeluarga, AnggotaKeluarga } from '@/lib/types'
import { ensureDummyKksForLingkungan, getDummyAnggotaForKk } from '@/lib/dummyData'
import { KOP_SURAT_FORMS, FormItemDef, FormCategory } from '@/lib/kopSuratForms'

export default function FormStandarPage() {
  const supabase = createClient()

  // Lingkungan & Profile State
  const [lingkunganId, setLingkunganId] = useState<string>('')
  const [lingkunganName, setLingkunganName] = useState<string>('')
  const [kkList, setKkList] = useState<KepalaKeluarga[]>([])
  const [anggotaMap, setAnggotaMap] = useState<Record<string, AnggotaKeluarga[]>>({})

  // Form selection & Category Filter
  const [selectedCategory, setSelectedCategory] = useState<FormCategory>('SEMUA')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFormId, setSelectedFormId] = useState<string>('FORM10A')

  // Active form definition
  const currentFormDef = useMemo(() => {
    return KOP_SURAT_FORMS.find((f) => f.id === selectedFormId) || KOP_SURAT_FORMS[0]
  }, [selectedFormId])

  // Kop Surat Style Selection ('PAROKI' | 'LINGKUNGAN' | 'KATEKESE')
  const [kopType, setKopType] = useState<'PAROKI' | 'LINGKUNGAN' | 'KATEKESE'>('LINGKUNGAN')

  // Form field dynamic values
  const [formValues, setFormValues] = useState<Record<string, string>>({})

  // Reset/sync form values when selected form changes
  useEffect(() => {
    const initVals: Record<string, string> = {}
    currentFormDef.fields.forEach((fld) => {
      initVals[fld.key] = fld.defaultValue || ''
    })
    setFormValues(initVals)
    setKopType(currentFormDef.defaultKopType)
  }, [selectedFormId, currentFormDef])

  // Load Lingkungan & Data
  useEffect(() => {
    async function init() {
      let savedLId = typeof window !== 'undefined' ? localStorage.getItem('selected_lingkungan_id') : null
      const cookies = typeof document !== 'undefined' ? document.cookie : ''
      const getCookieVal = (name: string) => {
        const v = `; ${cookies}`
        const p = v.split(`; ${name}=`)
        if (p.length === 2) return decodeURIComponent(p.pop()!.split(';').shift()!)
        return null
      }

      let effId = savedLId || getCookieVal('demo_user_lingkungan_id') || 'lingkungan-1'
      let effNama = getCookieVal('demo_user_lingkungan_nama') || 'St. Maria'

      const master = getAllMasterLingkungan()
      const matched = master.find((m) => m.id === effId)
      if (matched) {
        effNama = matched.nama_lingkungan
      }

      setLingkunganId(effId)
      setLingkunganName(effNama)

      // Load KK and members for autofill
      try {
        const { data: dbKks } = await supabase.from('kepala_keluarga').select('*').eq('lingkungan_id', effId)
        let finalKks = dbKks && dbKks.length > 0 ? dbKks : ensureDummyKksForLingkungan(effId, effNama, [])
        setKkList(finalKks)

        const { data: dbAnggota } = await supabase.from('anggota_keluarga').select('*').in('kk_id', finalKks.map((k) => k.id))
        const aMap: Record<string, AnggotaKeluarga[]> = {}
        finalKks.forEach((k) => {
          let mems = dbAnggota?.filter((a) => a.kk_id === k.id) || []
          if (mems.length === 0) mems = getDummyAnggotaForKk(k)
          aMap[k.id] = mems
        })
        setAnggotaMap(aMap)
      } catch (err) {
        const dummyKks = ensureDummyKksForLingkungan(effId, effNama, [])
        setKkList(dummyKks)
      }
    }

    init()
  }, [])

  // Pengurus Info
  const pengurus = useMemo(() => {
    return getPengurusForLingkungan(lingkunganId || 'default', lingkunganName)
  }, [lingkunganId, lingkunganName])

  // Flat members list for applicant selector
  const allMembers = useMemo(() => {
    const list: {
      id: string
      nama: string
      nama_kk: string
      peran?: string
      alamat?: string
      nik?: string
      tgl_lahir?: string
    }[] = []

    kkList.forEach((kk) => {
      const kkExt = kk as KepalaKeluarga & { nomor_kk?: string }
      if (kk.nama_kk) {
        list.push({
          id: `kk-${kk.id}`,
          nama: kk.nama_kk,
          nama_kk: kk.nama_kk,
          peran: 'Kepala Keluarga',
          alamat: kk.alamat || undefined,
          nik: kkExt.nomor_kk || undefined,
        })
      }
      const mems = anggotaMap[kk.id] || []
      mems.forEach((m) => {
        const mExt = m as AnggotaKeluarga & { nik?: string; tanggal_lahir?: string }
        if (m.nama && m.nama !== kk.nama_kk) {
          list.push({
            id: m.id,
            nama: m.nama,
            nama_kk: kk.nama_kk,
            peran: m.peran,
            alamat: kk.alamat || undefined,
            nik: mExt.nik || undefined,
            tgl_lahir: mExt.tanggal_lahir || undefined,
          })
        }
      })
    })
    return list.sort((a, b) => a.nama.localeCompare(b.nama))
  }, [kkList, anggotaMap])

  // Filtered forms list
  const filteredForms = useMemo(() => {
    return KOP_SURAT_FORMS.filter((form) => {
      const matchCat = selectedCategory === 'SEMUA' || form.category === selectedCategory
      const matchQuery =
        !searchQuery ||
        form.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        form.shortTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        form.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        form.description.toLowerCase().includes(searchQuery.toLowerCase())
      return matchCat && matchQuery
    })
  }, [selectedCategory, searchQuery])

  // Handle autofill when selecting member
  const handleAutofillMember = (memberId: string) => {
    const mem = allMembers.find((m) => m.id === memberId)
    if (!mem) return

    setFormValues((prev) => {
      const updated = { ...prev }
      currentFormDef.fields.forEach((fld) => {
        if (fld.autoFillKey === 'nama' && !updated[fld.key]) {
          updated[fld.key] = mem.nama
        }
        if (fld.autoFillKey === 'nama_kk' && !updated[fld.key]) {
          updated[fld.key] = mem.nama_kk
        }
        if (fld.autoFillKey === 'alamat' && mem.alamat && !updated[fld.key]) {
          updated[fld.key] = mem.alamat
        }
        if (fld.autoFillKey === 'nik' && mem.nik && !updated[fld.key]) {
          updated[fld.key] = mem.nik
        }
        if (fld.autoFillKey === 'tgl_lahir' && mem.tgl_lahir && !updated[fld.key]) {
          updated[fld.key] = mem.tgl_lahir
        }
        if (fld.autoFillKey === 'nama_ayah' && !updated[fld.key]) {
          updated[fld.key] = mem.nama_kk
        }
      })
      return updated
    })
  }

  const handlePrint = () => {
    window.print()
  }

  const handleFieldChange = (key: string, val: string) => {
    setFormValues((prev) => ({ ...prev, [key]: val }))
  }

  const currentDateFormatted = useMemo(() => {
    const d = new Date()
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ]
    return `Bekasi, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
  }, [])

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* CSS KHUSUS PRINT A4 CLEAN */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-document-area, #print-document-area * {
            visibility: visible;
          }
          #print-document-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 24px;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs no-print">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F6EFE2] text-[#5A4423] border border-[#A9834F]/30 font-serif">
            <Stamp className="w-3.5 h-3.5 text-[#A9834F]" />
            Sekretariat Gereja Santa Clara — Paroki Bekasi Utara
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 font-serif">
            <FileText className="w-6 h-6 text-emerald-600" />
            Modul Formulir & Kop Surat Standar Sekretariat
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Koleksi 21 format formulir resmi Keuskupan Agung Jakarta & Paroki Santa Clara, siap isi otomatis dan cetak format A4
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {currentFormDef.pdfFileName && (
            <a
              href={`/kop-surat-asli/${encodeURIComponent(currentFormDef.pdfFileName)}`}
              download={currentFormDef.pdfFileName}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs transition"
              title="Unduh blanko PDF asli yang ada di folder Kop Surat"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Blanko PDF Asli</span>
            </a>
          )}
          <Button
            onClick={handlePrint}
            size="sm"
            className="bg-[#16233F] hover:bg-[#22335A] text-white rounded-xl text-xs font-bold cursor-pointer h-10 px-4 shadow-sm flex items-center gap-2"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            Cetak Dokumen Resmi (PDF / A4)
          </Button>
        </div>
      </div>

      {/* Category Pills & Form Quick Filter (No Print) */}
      <div className="space-y-3 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedCategory('SEMUA')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                selectedCategory === 'SEMUA'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Semua ({KOP_SURAT_FORMS.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('PENGANTAR')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 ${
                selectedCategory === 'PENGANTAR'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              Surat Pengantar & Lingkungan
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('SAKRAMEN')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 ${
                selectedCategory === 'SAKRAMEN'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              Pelayanan Sakramen
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('DATA_KK')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 ${
                selectedCategory === 'DATA_KK'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Kependudukan & BIDUK
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('LITURGI_INTERNAL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 ${
                selectedCategory === 'LITURGI_INTERNAL'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <ScrollText className="w-3.5 h-3.5" />
              Liturgi & Internal
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari jenis formulir..."
              className="h-9 pl-9 text-xs bg-white border-slate-300 rounded-xl"
            />
          </div>
        </div>

        {/* Horizontal Form Carousel / Grid */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {filteredForms.map((form) => {
            const isSelected = form.id === selectedFormId
            return (
              <button
                key={form.id}
                type="button"
                onClick={() => setSelectedFormId(form.id)}
                className={`text-left p-2.5 rounded-xl border transition cursor-pointer shrink-0 w-60 sm:w-64 ${
                  isSelected
                    ? 'bg-emerald-50/80 border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {form.code.split('---')[0].trim()}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
                <div className="font-bold text-xs text-slate-900 truncate" title={form.title}>
                  {form.shortTitle}
                </div>
                <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                  {form.description}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* MAIN TWO-COLUMN WORKSPACE: LEFT EDITOR, RIGHT LIVE PREVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: FORM SETTINGS & CONTROLS (NO-PRINT) */}
        <div className="lg:col-span-5 space-y-4 no-print">
          {/* Form Header Info Card */}
          <Card className="bg-white border-slate-200 rounded-2xl shadow-xs">
            <CardHeader className="p-4 border-b border-slate-100">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="text-[10px] font-mono font-bold text-emerald-700 uppercase tracking-wider">
                    {currentFormDef.code}
                  </div>
                  <CardTitle className="text-sm font-bold text-slate-900 leading-snug">
                    {currentFormDef.title}
                  </CardTitle>
                </div>
              </div>
              <CardDescription className="text-xs text-slate-500 pt-1">
                {currentFormDef.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5 text-xs">
              {/* Kop Surat Header Type Toggle */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                  <span>Format Kop Surat:</span>
                  <span className="text-[10px] text-slate-400 font-normal">Sesuai file kop surat asli</span>
                </Label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setKopType('LINGKUNGAN')}
                    className={`p-2 rounded-lg text-center text-[11px] font-bold border transition ${
                      kopType === 'LINGKUNGAN'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Kop Lingkungan
                  </button>
                  <button
                    type="button"
                    onClick={() => setKopType('PAROKI')}
                    className={`p-2 rounded-lg text-center text-[11px] font-bold border transition ${
                      kopType === 'PAROKI'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Kop Paroki
                  </button>
                  <button
                    type="button"
                    onClick={() => setKopType('KATEKESE')}
                    className={`p-2 rounded-lg text-center text-[11px] font-bold border transition ${
                      kopType === 'KATEKESE'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Kop Katekese
                  </button>
                </div>
              </div>

              {/* Auto-fill from Lingkungan database */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5">
                <Label className="text-[11px] font-bold text-amber-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Isi Cepat dari Basis Data Umat {formatNamaLingkungan(lingkunganName)}:
                </Label>
                <Select onValueChange={(val) => { if (val) handleAutofillMember(String(val)) }}>
                  <SelectTrigger className="h-8 text-xs bg-white border-amber-300 text-slate-800">
                    <SelectValue placeholder="-- Pilih nama warga lingkungan --" />
                  </SelectTrigger>
                  <SelectContent className="bg-white text-slate-900 border-slate-200 max-h-56">
                    {allMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nama} ({m.peran || 'Umat'} • KK: {m.nama_kk})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-amber-800/80">
                  Memilih umat akan otomatis mengisi nama, alamat, orang tua, tgl lahir, dan KK ke formulir.
                </p>
              </div>

              {/* Dynamic Form Input Fields */}
              <div className="space-y-3 pt-1">
                <div className="font-bold text-slate-800 text-[11px] border-b border-slate-100 pb-1">
                  Data Isian Dokumen:
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {currentFormDef.fields.map((fld) => {
                    const val = formValues[fld.key] ?? ''
                    const spanClass = fld.gridSpan === 2 ? 'col-span-2' : 'col-span-1'

                    if (fld.type === 'textarea') {
                      return (
                        <div key={fld.key} className={`${spanClass} space-y-1`}>
                          <Label className="text-[11px] font-semibold text-slate-700">{fld.label}</Label>
                          <textarea
                            rows={3}
                            value={val}
                            onChange={(e) => handleFieldChange(fld.key, e.target.value)}
                            placeholder={fld.placeholder}
                            className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed font-sans"
                          />
                        </div>
                      )
                    }

                    if (fld.type === 'select' && fld.options) {
                      return (
                        <div key={fld.key} className={`${spanClass} space-y-1`}>
                          <Label className="text-[11px] font-semibold text-slate-700">{fld.label}</Label>
                          <Select
                            value={val}
                            onValueChange={(newVal) => newVal && handleFieldChange(fld.key, newVal)}
                          >
                            <SelectTrigger className="h-8 text-xs bg-white border-slate-300 font-medium">
                              <SelectValue placeholder="Pilih opsi..." />
                            </SelectTrigger>
                            <SelectContent className="bg-white text-slate-900 border-slate-200">
                              {fld.options.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )
                    }

                    return (
                      <div key={fld.key} className={`${spanClass} space-y-1`}>
                        <Label className="text-[11px] font-semibold text-slate-700">{fld.label}</Label>
                        <Input
                          value={val}
                          onChange={(e) => handleFieldChange(fld.key, e.target.value)}
                          placeholder={fld.placeholder}
                          className="h-8 text-xs bg-white border-slate-300"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Syarat & Lampiran info box */}
              {currentFormDef.syarat && currentFormDef.syarat.length > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="font-bold text-[11px] text-slate-800 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-600" />
                    Ketentuan & Syarat Lampiran Berkas:
                  </div>
                  <ul className="list-disc list-inside text-[10px] text-slate-600 space-y-0.5">
                    {currentFormDef.syarat.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: LIVE PREVIEW & OFFICIAL PRINT SHEET (A4 FORMAT) */}
        <div className="lg:col-span-7">
          <div
            id="print-document-area"
            className="bg-white rounded-2xl border border-slate-200/90 shadow-lg p-8 sm:p-12 space-y-5 text-slate-900 font-serif min-h-[850px]"
          >
            {/* KOP SURAT RESMI PAROKI / LINGKUNGAN / KATEKESE (SESUAI FILE PDF ASLI) */}
            <div className="border-b-2 border-black pb-2 mb-4">
              <div className="flex items-center gap-4">
                {/* Logo Paroki Asli */}
                <div className="shrink-0 w-20 h-20 flex items-center justify-center">
                  <img
                    src="/logo-kop-paroki.png"
                    alt="Logo Paroki Santa Clara"
                    className="max-h-20 max-w-20 object-contain"
                    onError={(e) => {
                      // Fallback to high-res JPG if needed
                      ;(e.currentTarget as HTMLImageElement).src = '/logo-st-clara.jpg'
                    }}
                  />
                </div>

                {/* Header Text Berdasarkan Format Kop Resmi */}
                <div className="flex-1">
                  {kopType === 'KATEKESE' ? (
                    <div>
                      <div className="text-sm sm:text-base font-black tracking-wider uppercase text-slate-900 font-sans">
                        S E K S I &nbsp;&nbsp; S A N T A &nbsp; C L A R A
                      </div>
                      <div className="text-base sm:text-lg font-black tracking-widest uppercase text-slate-950 font-sans">
                        K A T E K E S E
                      </div>
                      <div className="text-[11px] text-slate-800 font-sans leading-tight pt-1">
                        Pastoran &amp; Sekretariat : Jl. Lingkar Utara RT 03 RW 06 Kel. Harapan Baru Bekasi Utara
                      </div>
                      <div className="text-[10px] text-slate-700 font-sans leading-tight">
                        Narahubung : Whatsapp : Sekretariat 0819-1188-9980 / Katekese : 0851-8310-4061
                      </div>
                    </div>
                  ) : kopType === 'LINGKUNGAN' ? (
                    <div>
                      <div className="text-xs sm:text-sm font-black tracking-normal uppercase text-slate-900 font-sans">
                        PENGURUS GEREJA DAN DANA PAPA SANTA CLARA
                      </div>
                      <div className="text-sm sm:text-base font-black tracking-wide uppercase text-slate-950 font-sans">
                        DEWAN PENGURUS {formatNamaLingkungan(lingkunganName).toUpperCase()}
                      </div>
                      <div className="text-[11px] text-slate-800 font-sans leading-tight pt-1">
                        Pastoran &amp; Sekretariat : Jl. Lingkar Utara RT 03 RW 06 Kel. Harapan Baru Bekasi Utara
                      </div>
                      <div className="text-[10px] text-slate-700 font-sans leading-tight">
                        Telp. 021-8870327, e-mail : parokisantaklara@gmail.com
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm sm:text-base font-black tracking-normal uppercase text-slate-900 font-sans">
                        Pengurus Gereja dan Dana Papa SANTA CLARA
                      </div>
                      <div className="text-sm sm:text-base font-black tracking-normal uppercase text-slate-900 font-sans">
                        Pengurus Dewan Paroki
                      </div>
                      <div className="text-[11px] text-slate-800 font-sans leading-tight pt-1">
                        Pastoran &amp; Sekretariat : Jl. Lingkar Utara RT 03 RW 06 Kel. Harapan Baru Bekasi Utara
                      </div>
                      <div className="text-[10px] text-slate-700 font-sans leading-tight">
                        Telp. 021-8870327, e-mail : parokisantaklara@gmail.com
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* DOCUMENT TITLE & OFFICIAL CODE */}
            <div className="text-center space-y-1 pb-2">
              <h2 className="text-sm sm:text-base font-black uppercase tracking-wide font-sans underline">
                {currentFormDef.title}
              </h2>
              <div className="text-[10px] sm:text-[11px] font-sans text-slate-700 font-semibold tracking-tight">
                {currentFormDef.code} --- Paroki : Bekasi Utara - St. Clara
              </div>
              {formValues.nomor_surat && (
                <div className="text-xs font-mono font-bold text-slate-900 pt-0.5">
                  Nomor : {formValues.nomor_surat}
                </div>
              )}
            </div>

            {/* DOKUMEN RENDERER BERDASARKAN JENIS FORMULIR */}

            {/* 1. KASUS SURAT DINAS BEBAS */}
            {selectedFormId === 'SURAT_DINAS' && (
              <div className="space-y-5 text-xs text-slate-900 font-sans pt-1">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div>
                      <span className="font-semibold w-20 inline-block font-serif">Nomor</span>: {formValues.nomor_surat || '018/SKR-LKG/SC/IX/2026'}
                    </div>
                    <div>
                      <span className="font-semibold w-20 inline-block font-serif">Lampiran</span>: {formValues.lampiran || '1 (Satu) Berkas'}
                    </div>
                    <div>
                      <span className="font-semibold w-20 inline-block font-serif">Perihal</span>:{' '}
                      <span className="font-bold underline">{formValues.perihal}</span>
                    </div>
                  </div>
                  <div className="text-right italic font-medium">{currentDateFormatted}</div>
                </div>

                <div className="space-y-1 pt-2">
                  <div className="font-semibold font-serif">Kepada Yth.</div>
                  <div className="whitespace-pre-line leading-relaxed font-bold text-slate-900">
                    {formValues.tujuan}
                  </div>
                </div>

                <div className="pt-2 whitespace-pre-line leading-relaxed text-justify text-slate-800 text-[13px]">
                  {formValues.isi_naskah}
                </div>

                <div className="pt-10 grid grid-cols-2 text-center gap-8">
                  <div className="space-y-16">
                    <div className="font-bold font-serif">
                      Ketua {formatNamaLingkungan(lingkunganName)}
                    </div>
                    <div className="space-y-0.5">
                      <div className="font-bold underline text-slate-950 text-sm">
                        {pengurus.ketua_nama || 'FX Wisnu Ardianto'}
                      </div>
                      <div className="text-[11px] text-slate-500 font-sans">Ketua Lingkungan</div>
                    </div>
                  </div>

                  <div className="space-y-16">
                    <div className="font-bold font-serif">Sekretaris Lingkungan</div>
                    <div className="space-y-0.5">
                      <div className="font-bold underline text-slate-950 text-sm">
                        {pengurus.sekretaris_nama || 'Ignatius Sugeng'}
                      </div>
                      <div className="text-[11px] text-slate-500 font-sans">Sekretaris Lingkungan</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. KASUS BERITA ACARA */}
            {selectedFormId === 'BERITA_ACARA' && (
              <div className="space-y-4 text-xs text-slate-900 font-sans pt-1">
                <p className="leading-relaxed text-justify text-slate-800">
                  Pada hari ini <strong>{formValues.hari_tanggal || 'Minggu, 20 September 2026'}</strong>, bertempat di <strong>{formValues.tempat || 'Gereja Santa Clara'}</strong>, 
                  telah diselenggarakan acara resmi <strong>{formValues.jenis_acara}</strong> untuk 
                  <strong> {formatNamaLingkungan(lingkunganName)}</strong>, Paroki Santa Clara Bekasi Utara, oleh dan antara:
                </p>

                <div className="space-y-2 border border-slate-300 rounded-lg p-3 bg-slate-50/60">
                  <div className="grid grid-cols-3 gap-1">
                    <span className="font-bold text-slate-700">1. PIHAK PERTAMA</span>
                    <span className="col-span-2 font-bold text-slate-950">: {formValues.pihak1_nama} ({formValues.pihak1_jabatan})</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="font-bold text-slate-700">2. PIHAK KEDUA</span>
                    <span className="col-span-2 font-bold text-slate-950">: {formValues.pihak2_nama} ({formValues.pihak2_jabatan})</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="font-bold text-slate-900 font-serif">POIN KESEPAKATAN DAN PUTUSAN:</div>
                  <div className="p-3 bg-white border border-slate-300 rounded-lg whitespace-pre-line leading-relaxed text-slate-800">
                    {formValues.poin_keputusan}
                  </div>
                </div>

                <p className="leading-relaxed text-justify text-slate-600 text-[11px] italic">
                  Demikian Berita Acara ini dibuat dan ditandatangani dengan penuh kesadaran dan tanggung jawab demi 
                  kemuliaan Tuhan dan pelayanan umat di Lingkungan Santa Clara.
                </p>

                <div className="pt-4 grid grid-cols-2 text-center gap-6">
                  <div className="space-y-12">
                    <div className="font-bold">Pihak Pertama</div>
                    <div className="font-bold underline text-slate-950">{formValues.pihak1_nama}</div>
                  </div>
                  <div className="space-y-12">
                    <div className="font-bold">Pihak Kedua</div>
                    <div className="font-bold underline text-slate-950">{formValues.pihak2_nama}</div>
                  </div>
                </div>

                <div className="pt-2 grid grid-cols-2 text-center gap-6 border-t border-slate-200">
                  <div className="space-y-12">
                    <div className="font-bold">Saksi I (Sekretaris)</div>
                    <div className="font-bold underline text-slate-800">{formValues.saksi1}</div>
                  </div>
                  <div className="space-y-12">
                    <div className="font-bold">Saksi II (Bendahara)</div>
                    <div className="font-bold underline text-slate-800">{formValues.saksi2}</div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. KASUS FORMULIR UMUM / SAKRAMEN / BIDUK / PERUBAHAN KK */}
            {selectedFormId !== 'SURAT_DINAS' && selectedFormId !== 'BERITA_ACARA' && (
              <div className="space-y-4 text-xs text-slate-900 font-sans pt-1">
                {/* Intro statement for pengantar/keterangan */}
                {selectedFormId === 'FORM10A' && (
                  <div className="space-y-1 text-slate-800">
                    <div className="flex justify-between pb-1">
                      <span>Nama Ketua Lingkungan : <strong>{pengurus.ketua_nama || 'FX Wisnu Ardianto'}</strong></span>
                      <span>Lingkungan/Wilayah : <strong>{formatNamaLingkungan(lingkunganName)}</strong></span>
                    </div>
                    <p className="text-justify pt-1">
                      Menerangkan dengan sesungguhnya bahwa :
                    </p>
                  </div>
                )}

                {selectedFormId === 'FORM09' && (
                  <p className="leading-relaxed text-justify text-slate-800">
                    Salam Damai Kristus,<br />
                    Dengan ini kami, Ketua/Pengurus <strong>{formatNamaLingkungan(lingkunganName)}</strong>, Paroki Santa Clara Bekasi Utara menerangkan bahwa Saudara/i kami ini bermaksud ingin melangsungkan pernikahan secara Gereja Katolik:
                  </p>
                )}

                {selectedFormId === 'FORM10' && (
                  <div className="space-y-1 text-slate-800">
                    <div className="flex justify-between pb-1">
                      <span>Ketua Lingkungan : <strong>{pengurus.ketua_nama || 'FX Wisnu Ardianto'}</strong></span>
                      <span>Lingkungan / Wilayah : <strong>{formatNamaLingkungan(lingkunganName)}</strong></span>
                    </div>
                    <p className="text-justify pt-1">
                      Menerangkan dengan sesungguhnya bahwa :
                    </p>
                  </div>
                )}

                {(selectedFormId === 'FORM05' || selectedFormId === 'FORM05A') && (
                  <p className="leading-relaxed text-justify text-slate-800">
                    Yang bertanda tangan di bawah ini :
                  </p>
                )}

                {/* Render field table cleanly */}
                <div className="border border-slate-300 rounded-lg overflow-hidden divide-y divide-slate-200">
                  {currentFormDef.fields.map((fld) => {
                    const val = formValues[fld.key]
                    if (!val && fld.type === 'textarea') return null

                    return (
                      <div key={fld.key} className="grid grid-cols-12 p-2.5 bg-white items-start text-[11px]">
                        <div className="col-span-4 font-semibold text-slate-700">
                          {fld.label}
                        </div>
                        <div className="col-span-8 text-slate-900 font-medium whitespace-pre-line">
                          : {val || '—'}
                        </div>
                      </div>
                    )
                  })}

                  <div className="grid grid-cols-12 p-2.5 bg-slate-50 items-start text-[11px]">
                    <div className="col-span-4 font-semibold text-slate-700">
                      Lingkungan / Paroki
                    </div>
                    <div className="col-span-8 text-slate-900 font-medium">
                      : {formatNamaLingkungan(lingkunganName)} — Paroki Santa Clara Bekasi Utara
                    </div>
                  </div>
                </div>

                {/* Formal concluding statement */}
                {selectedFormId === 'FORM10A' && (
                  <p className="leading-relaxed text-justify text-slate-700 pt-1 text-[11px]">
                    Demikianlah surat pengantar ini kami buat untuk permintaan surat keterangan/pengantar dari Paroki Bekasi Utara dan untuk dipakai sebagaimana mestinya. Atas perhatian dan kerja samanya kami ucapkan terima kasih.
                  </p>
                )}

                {selectedFormId === 'FORM09' && (
                  <p className="leading-relaxed text-justify text-slate-700 pt-1 text-[11px]">
                    Maka kami mohon kesediaan Pastor untuk memberikan pelayanan Penyelidikan Kanonik dan persiapan perkawinan yang bersangkutan. Atas bantuan dan kerja sama Pastor kami ucapkan banyak terima kasih.
                  </p>
                )}

                {/* Signature Blocks */}
                <div className="pt-6">
                  <div className="text-right italic text-[11px] mb-4">
                    {currentDateFormatted}
                  </div>

                  <div className="grid grid-cols-3 text-center gap-4 text-[11px]">
                    <div className="space-y-14">
                      <div>Pemohon / Yang Bersangkutan</div>
                      <div className="font-bold underline text-slate-950">
                        {formValues.nama_lengkap || formValues.nama_calon || formValues.nama_anak || formValues.nama_kk || formValues.nama_mempelai || formValues.nama_ortu || formValues.penanggung_jawab || 'Pemohon'}
                      </div>
                    </div>

                    <div className="space-y-14">
                      <div>
                        Ketua {formatNamaLingkungan(lingkunganName)}
                      </div>
                      <div className="font-bold underline text-slate-950">
                        {pengurus.ketua_nama || 'FX Wisnu Ardianto'}
                      </div>
                    </div>

                    <div className="space-y-14">
                      <div>
                        Mengetahui,<br />Sekretariat / Pastor Paroki
                      </div>
                      <div className="font-bold underline text-slate-950">
                        Paroki Santa Clara
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
