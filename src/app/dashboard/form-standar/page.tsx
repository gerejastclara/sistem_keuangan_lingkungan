'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  FileText,
  Printer,
  Stamp,
  Download,
  Sparkles,
  Search,
  Users,
  Building,
  Award,
  ScrollText,
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

// Dotted Line field component matching official Indonesian church forms
function DottedField({
  label,
  value,
  suffix,
  className = '',
}: {
  label: string
  value?: string
  suffix?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-baseline gap-1 text-[11px] leading-relaxed text-black ${className}`}>
      <span className="shrink-0">{label}</span>
      <span className="shrink-0">:</span>
      <div className="flex-1 relative flex items-baseline overflow-hidden border-b border-dotted border-black min-h-[17px] mx-1">
        <span className="font-semibold text-black px-1 z-10 bg-white whitespace-pre-wrap">
          {value || ''}
        </span>
        {!value && (
          <span className="text-transparent select-none">.</span>
        )}
      </div>
      {suffix && <span className="shrink-0">{suffix}</span>}
    </div>
  )
}

// Underline field with solid line for Katekumen style
function UnderlineField({
  label,
  value,
  suffix,
  className = '',
}: {
  label: string
  value?: string
  suffix?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-baseline gap-1.5 text-[11px] leading-relaxed text-black ${className}`}>
      <span className="shrink-0 font-medium">{label}</span>
      <span className="shrink-0">:</span>
      <div className="flex-1 relative flex items-baseline overflow-hidden border-b border-black min-h-[17px] mx-1">
        <span className="font-semibold text-black px-1 z-10 bg-white whitespace-pre-wrap">
          {value || ''}
        </span>
      </div>
      {suffix && <span className="shrink-0">{suffix}</span>}
    </div>
  )
}

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
  const [selectedFormId, setSelectedFormId] = useState<string>('FORM01')

  // Active form definition
  const currentFormDef = useMemo(() => {
    return KOP_SURAT_FORMS.find((f) => f.id === selectedFormId) || KOP_SURAT_FORMS[0]
  }, [selectedFormId])

  // Kop Surat Style Selection ('PAROKI' | 'LINGKUNGAN' | 'KATEKESE')
  const [kopType, setKopType] = useState<'PAROKI' | 'LINGKUNGAN' | 'KATEKESE'>('PAROKI')

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
        if ((fld.autoFillKey === 'nama' || fld.key === 'nama_sendiri' || fld.key === 'nama_anak' || fld.key === 'nama_calon') && !updated[fld.key]) {
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
        if ((fld.key === 'wilayah_lingkungan' || fld.key === 'lingkungan') && !updated[fld.key]) {
          updated[fld.key] = formatNamaLingkungan(lingkunganName)
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
      {/* CSS KHUSUS PRINT A4 BERSIH TANPA MARGIN / SHADOW */}
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
            padding: 15px;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header Banner - Abu-abu soft & neutral */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs no-print">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <Stamp className="w-3.5 h-3.5 text-slate-600" />
            Sekretariat Gereja Santa Clara — Paroki Bekasi Utara
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-slate-700" />
            Modul Formulir Standar Sekretariat
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Format kop surat resmi dan 21 dokumen standar Keuskupan Agung Jakarta &amp; Paroki Santa Clara
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {currentFormDef.pdfFileName && (
            <a
              href={`/kop-surat-asli/${encodeURIComponent(currentFormDef.pdfFileName)}`}
              download={currentFormDef.pdfFileName}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition"
              title="Unduh blanko PDF asli dari sekretariat paroki"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Blanko PDF Asli</span>
            </a>
          )}
          <Button
            onClick={handlePrint}
            size="sm"
            className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer h-9 px-4 shadow-sm flex items-center gap-2"
          >
            <Printer className="w-4 h-4 text-slate-200" />
            Cetak Dokumen Resmi (PDF / A4)
          </Button>
        </div>
      </div>

      {/* Category Pills & Form Quick Filter (No Print) */}
      <div className="space-y-3 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Category Tabs - Soft Gray & Slate */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedCategory('SEMUA')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
                selectedCategory === 'SEMUA'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              Semua ({KOP_SURAT_FORMS.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('PENGANTAR')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 flex items-center gap-1.5 ${
                selectedCategory === 'PENGANTAR'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              Surat Pengantar &amp; Lingkungan
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('SAKRAMEN')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 flex items-center gap-1.5 ${
                selectedCategory === 'SAKRAMEN'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              Pelayanan Sakramen
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('DATA_KK')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 flex items-center gap-1.5 ${
                selectedCategory === 'DATA_KK'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Kependudukan &amp; BIDUK
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('LITURGI_INTERNAL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 flex items-center gap-1.5 ${
                selectedCategory === 'LITURGI_INTERNAL'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <ScrollText className="w-3.5 h-3.5" />
              Liturgi &amp; Internal
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari formulir..."
              className="h-9 pl-9 text-xs bg-white border-slate-300 rounded-xl focus:border-slate-400 focus:ring-slate-300"
            />
          </div>
        </div>

        {/* Horizontal Form Carousel - Soft Gray Styling */}
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
                    ? 'bg-slate-100 border-slate-400 text-slate-900 shadow-xs ring-1 ring-slate-400'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 border border-slate-300">
                    {form.code.split('---')[0].trim()}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-slate-800" />}
                </div>
                <div className="font-bold text-xs text-slate-900 truncate" title={form.title}>
                  {form.shortTitle}
                </div>
                <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                  {form.description}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* MAIN TWO-COLUMN WORKSPACE: LEFT CONTROLS, RIGHT PREVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: FORM SETTINGS (NO-PRINT) */}
        <div className="lg:col-span-5 space-y-4 no-print">
          <Card className="bg-white border-slate-200 rounded-2xl shadow-xs">
            <CardHeader className="p-4 border-b border-slate-100">
              <div className="space-y-0.5">
                <div className="text-[10px] font-mono font-semibold text-slate-600 uppercase tracking-wider">
                  {currentFormDef.code}
                </div>
                <CardTitle className="text-sm font-bold text-slate-900 leading-snug">
                  {currentFormDef.title}
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500 pt-1">
                {currentFormDef.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5 text-xs">
              {/* Kop Surat Header Type Toggle - Soft Gray buttons */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                  <span>Format Kop Surat:</span>
                  <span className="text-[10px] text-slate-400 font-normal">Sesuai file kop surat asli</span>
                </Label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setKopType('LINGKUNGAN')}
                    className={`p-2 rounded-lg text-center text-[11px] font-medium border transition ${
                      kopType === 'LINGKUNGAN'
                        ? 'bg-slate-200 text-slate-900 border-slate-400 font-bold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Kop Lingkungan
                  </button>
                  <button
                    type="button"
                    onClick={() => setKopType('PAROKI')}
                    className={`p-2 rounded-lg text-center text-[11px] font-medium border transition ${
                      kopType === 'PAROKI'
                        ? 'bg-slate-200 text-slate-900 border-slate-400 font-bold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Kop Paroki
                  </button>
                  <button
                    type="button"
                    onClick={() => setKopType('KATEKESE')}
                    className={`p-2 rounded-lg text-center text-[11px] font-medium border transition ${
                      kopType === 'KATEKESE'
                        ? 'bg-slate-200 text-slate-900 border-slate-400 font-bold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Kop Katekese
                  </button>
                </div>
              </div>

              {/* Auto-fill from Lingkungan database - Soft Gray styling */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <Label className="text-[11px] font-semibold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-slate-500" />
                  Isi Cepat dari Basis Data Umat {formatNamaLingkungan(lingkunganName)}:
                </Label>
                <Select onValueChange={(val) => { if (val) handleAutofillMember(String(val)) }}>
                  <SelectTrigger className="h-8 text-xs bg-white border-slate-300 text-slate-800">
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
                <p className="text-[10px] text-slate-500">
                  Memilih nama akan mengisi kolom yang bersangkutan ke dalam dokumen.
                </p>
              </div>

              {/* Dynamic Form Input Fields */}
              <div className="space-y-3 pt-1">
                <div className="font-semibold text-slate-800 text-[11px] border-b border-slate-100 pb-1">
                  Data Isian Dokumen:
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {currentFormDef.fields.map((fld) => {
                    const val = formValues[fld.key] ?? ''
                    const spanClass = fld.gridSpan === 2 ? 'col-span-2' : 'col-span-1'

                    if (fld.type === 'textarea') {
                      return (
                        <div key={fld.key} className={`${spanClass} space-y-1`}>
                          <Label className="text-[11px] font-medium text-slate-700">{fld.label}</Label>
                          <textarea
                            rows={3}
                            value={val}
                            onChange={(e) => handleFieldChange(fld.key, e.target.value)}
                            placeholder={fld.placeholder}
                            className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 leading-relaxed font-sans"
                          />
                        </div>
                      )
                    }

                    if (fld.type === 'select' && fld.options) {
                      return (
                        <div key={fld.key} className={`${spanClass} space-y-1`}>
                          <Label className="text-[11px] font-medium text-slate-700">{fld.label}</Label>
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
                        <Label className="text-[11px] font-medium text-slate-700">{fld.label}</Label>
                        <Input
                          value={val}
                          onChange={(e) => handleFieldChange(fld.key, e.target.value)}
                          placeholder={fld.placeholder}
                          className="h-8 text-xs bg-white border-slate-300 focus:border-slate-400 focus:ring-slate-300"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Syarat & Lampiran info box */}
              {currentFormDef.syarat && currentFormDef.syarat.length > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="font-semibold text-[11px] text-slate-800 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-slate-600" />
                    Ketentuan &amp; Syarat Lampiran Berkas:
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

        {/* RIGHT COLUMN: LIVE PREVIEW & PRINT SHEET - 100% PERSIS DOKUMEN ASLI */}
        <div className="lg:col-span-7">
          <div
            id="print-document-area"
            className="bg-white rounded-none sm:rounded-lg border border-slate-300 shadow-md p-6 sm:p-10 text-black font-sans min-h-[900px]"
          >
            {/* 1. KOP SURAT RESMI GEREJA SANTA CLARA (SAMA PERSIS DENGAN DOKUMEN ASLI) */}
            <div className="pb-1">
              <div className="flex items-start justify-between gap-3">
                {/* Logo Paroki Santa Clara */}
                <div className="shrink-0 w-24 h-24 flex items-center justify-center pt-1">
                  <img
                    src="/logo-kop-paroki.png"
                    alt="Logo Santa Clara"
                    className="max-h-24 max-w-24 object-contain"
                    onError={(e) => {
                      ;(e.currentTarget as HTMLImageElement).src = '/logo-st-clara.jpg'
                    }}
                  />
                </div>

                {/* Header Text Tengah */}
                <div className="flex-1 pt-1">
                  {selectedFormId === 'FORM02' || kopType === 'KATEKESE' ? (
                    <div>
                      <div className="text-base sm:text-lg font-sans font-bold tracking-[0.3em] uppercase text-black">
                        S E K S I
                      </div>
                      <div className="border-b-2 border-black my-0.5 w-full"></div>
                      <div className="text-base sm:text-lg font-sans font-bold tracking-[0.3em] uppercase text-black">
                        K A T E K E S E
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-black font-sans leading-tight pt-1">
                        Pastoran &amp; Sekretariat &nbsp;&nbsp;: &nbsp;Jl. Lingkar Utara RT 03 RW 06 Kel. Harapan Baru Bekasi Utara
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-black font-sans leading-tight">
                        Narahubung &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: &nbsp;Whatsapp : Sekretariat 0819-1188-9980 / Katekese : 0851-8310-4061
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-base sm:text-lg font-serif font-bold text-black leading-tight">
                        Pengurus Gereja dan Dana Papa
                      </div>
                      <div className="border-b border-black my-0.5 w-full"></div>
                      <div className="text-base sm:text-lg font-serif font-bold text-black leading-tight">
                        {kopType === 'LINGKUNGAN'
                          ? `Dewan Pengurus ${formatNamaLingkungan(lingkunganName).toUpperCase()}`
                          : 'Pengurus Dewan Paroki'}
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-black font-sans leading-tight pt-1">
                        Pastoran &amp; Sekretariat &nbsp;&nbsp;: &nbsp;Jl. Lingkar Utara RT 03 RW 06 Kel. Harapan Baru Bekasi Utara
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-black font-sans leading-tight">
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Telp. 021-8870327, e-mail : parokisantaklara@gmail.com
                      </div>
                    </div>
                  )}
                </div>

                {/* SANTA CLARA Biru Tebal di sebelah kanan persis seperti dokumen asli */}
                <div className="shrink-0 text-right pt-2 pl-2">
                  <span className="text-2xl sm:text-3xl font-serif font-black tracking-wider text-[#0000EE] uppercase">
                    SANTA CLARA
                  </span>
                </div>
              </div>

              {/* Garis Ganda Pembatas Kop Surat */}
              <div className="border-t-2 border-b border-black h-1.5 my-2"></div>
            </div>

            {/* 2. BODY FORMULIR DALAM BINGKAI PERSEGI HITAM (SAMA PERSIS DOKUMEN ASLI) */}
            <div className="border border-black p-4 sm:p-5 space-y-3 text-black">
              {/* KHUSUS FORM 02: PENDAFTARAN CALON KATEKUMEN (SAMA PERSIS DOKUMEN ASLI) */}
              {selectedFormId === 'FORM02' ? (
                <div className="space-y-3 text-[11px]">
                  {/* Top Header Row with Title Box & No. Berkas Box */}
                  <div className="flex items-stretch gap-2 pb-1">
                    <div className="flex-1 border border-black p-2.5 text-center flex items-center justify-center">
                      <div className="font-bold text-sm sm:text-base uppercase tracking-wide">
                        FORMULIR PENDAFTARAN CALON KATEKUMEN
                      </div>
                    </div>
                    <div className="w-24 sm:w-28 border border-black p-1.5 text-center flex flex-col justify-center shrink-0">
                      <div className="font-bold text-xs leading-tight">No.</div>
                      <div className="font-bold text-xs leading-tight">Berkas</div>
                      <div className="font-mono text-[10px] font-semibold text-slate-800 pt-0.5">
                        {formValues.no_berkas || '..................'}
                      </div>
                    </div>
                  </div>

                  {/* 4-Column Checklist Table matching Image 1 */}
                  <div className="space-y-1">
                    <div className="font-serif italic font-bold text-[11px]">
                      Silakan centang pada pilihan yang sesuai:
                    </div>
                    <div className="border border-black overflow-hidden">
                      <table className="w-full text-[10px] border-collapse">
                        <thead>
                          <tr className="border-b border-black bg-slate-50 text-center font-bold">
                            <th className="border-r border-black p-1.5 w-1/4">Usia</th>
                            <th className="border-r border-black p-1.5 w-1/4">Status Perkawinan</th>
                            <th className="border-r border-black p-1.5 w-1/4">Agama Sebelumnya</th>
                            <th className="p-1.5 w-1/4">Domisili Asal</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="align-top">
                            {/* Usia */}
                            <td className="border-r border-black p-2 space-y-1">
                              {['7 – 10 Tahun', '11 – 14 Tahun', '15 – 17 Tahun', '18 – 59 Tahun', '60 Tahun ke atas'].map((u) => (
                                <div key={u} className="flex items-center gap-1.5">
                                  <span className="w-3.5 h-3.5 border border-black inline-flex items-center justify-center text-[10px] font-bold">
                                    {formValues.usia_kategori === u ? '✓' : ''}
                                  </span>
                                  <span>{u}</span>
                                </div>
                              ))}
                            </td>

                            {/* Status Perkawinan */}
                            <td className="border-r border-black p-2 space-y-1">
                              {['Lajang', 'Menikah', 'Cerai Hidup', 'Cerai Mati'].map((s) => (
                                <div key={s} className="flex items-center gap-1.5">
                                  <span className="w-3.5 h-3.5 border border-black inline-flex items-center justify-center text-[10px] font-bold">
                                    {formValues.status_perkawinan === s ? '✓' : ''}
                                  </span>
                                  <span>{s}</span>
                                </div>
                              ))}
                            </td>

                            {/* Agama Sebelumnya */}
                            <td className="border-r border-black p-2 space-y-3">
                              <div className="flex items-center gap-1.5">
                                <span className="w-3.5 h-3.5 border border-black inline-flex items-center justify-center text-[10px] font-bold">
                                  {formValues.agama_sebelumnya === 'Kristen Protestan' ? '✓' : ''}
                                </span>
                                <span>Kristen Protestan</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-3.5 h-3.5 border border-black inline-flex items-center justify-center text-[10px] font-bold">
                                  {formValues.agama_sebelumnya !== 'Kristen Protestan' ? '✓' : ''}
                                </span>
                                <span>Selain Kristen Protestan</span>
                              </div>
                            </td>

                            {/* Domisili Asal */}
                            <td className="p-2 space-y-3">
                              <div className="flex items-start gap-1.5">
                                <span className="w-3.5 h-3.5 border border-black inline-flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                                  {formValues.domisili_asal?.includes('Santa Clara') ? '✓' : ''}
                                </span>
                                <span className="leading-tight">Paroki Bekasi Utara – Gereja Santa Clara</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-3.5 h-3.5 border border-black inline-flex items-center justify-center text-[10px] font-bold">
                                  {formValues.domisili_asal === 'Luar Paroki' ? '✓' : ''}
                                </span>
                                <span>Luar Paroki</span>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* CATATAN Box matching Image 1 */}
                  <div className="border border-black p-2.5 text-[10px] leading-relaxed space-y-1">
                    <div className="font-bold">CATATAN</div>
                    <ul className="list-disc list-inside pl-1 space-y-0.5">
                      <li>Bagi calon katekumen usia 7 – 10 tahun akan menerima Sakramen Baptis; usia 11 – 14 tahun akan menerima Sakramen Baptis dan Komuni Pertama</li>
                      <li>Bagi yang sudah menikah dan perkawinannya belum diteguhkan secara Katolik, silakan mengisi formulir Pemberesan Perkawinan.</li>
                      <li>Mohon diisi dengan tulisan yang jelas dan jujur.</li>
                    </ul>
                  </div>

                  {/* DATA KATEKUMEN */}
                  <div className="space-y-1 pt-1">
                    <div className="font-bold text-xs">DATA KATEKUMEN</div>
                    <UnderlineField label="1. Nama Lengkap" value={formValues.nama_calon} />
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-8">
                        <UnderlineField label="2. Tempat, tanggal lahir" value={formValues.tempat_tgl_lahir} />
                      </div>
                      <div className="col-span-4">
                        <UnderlineField label="3. Usia saat mendaftar" value={formValues.usia_saat_daftar} />
                      </div>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-6">
                        <UnderlineField label="4. No. HP (Telepon & WA)" value={formValues.telepon_wa} />
                      </div>
                      <div className="col-span-6">
                        <UnderlineField label="5. Pekerjaan" value={formValues.pekerjaan} />
                      </div>
                    </div>
                    <UnderlineField label="6. Agama sebelumnya" value={formValues.agama_asal_detail || formValues.agama_sebelumnya} />

                    {/* Sub-section Protestant */}
                    <div className="pl-4 space-y-1 pt-0.5">
                      <div className="font-medium text-[10px]">o Bagi yang dari Kristen Protestan</div>
                      <UnderlineField label="▪ Nama Gereja tempat dibaptis" value={formValues.nama_gereja_protestan} />
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-6">
                          <UnderlineField label="▪ Tanggal dibaptis" value={formValues.tgl_baptis_protestan} />
                        </div>
                        <div className="col-span-6">
                          <UnderlineField label="▪ Nama Pendeta yang membaptis" value={formValues.nama_pendeta} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* DATA PERKAWINAN */}
                  <div className="space-y-1 pt-1 border-t border-black">
                    <div className="font-bold text-xs">DATA PERKAWINAN – Coret yang tidak sesuai</div>
                    <UnderlineField label="7. Status Perkawinan" value={formValues.status_perkawinan} />
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-6">
                        <UnderlineField label="9. Nama Lengkap Pasangan" value={formValues.nama_pasangan} />
                      </div>
                      <div className="col-span-6">
                        <UnderlineField label="10. Agama Pasangan" value={formValues.agama_pasangan} />
                      </div>
                    </div>
                  </div>

                  {/* DATA DOMISILI KATEKUMEN */}
                  <div className="space-y-1 pt-1 border-t border-black">
                    <div className="font-bold text-xs">DATA DOMISILI KATEKUMEN</div>
                    <UnderlineField label="14. Alamat lengkap" value={formValues.alamat} />
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-6">
                        <UnderlineField label="15. Nomor NIK sesuai KTP/KK" value={formValues.nik} />
                      </div>
                      <div className="col-span-6">
                        <UnderlineField label="16. Nama Lingkungan" value={formValues.lingkungan || formatNamaLingkungan(lingkunganName)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-6">
                        <UnderlineField label="17. Nama Paroki sesuai domisili" value={formValues.paroki_domisili || 'Paroki Santa Clara Bekasi Utara'} />
                      </div>
                      <div className="col-span-6">
                        <UnderlineField label="18. No. KK Katolik (jika ada)" value={formValues.no_kk_katolik} />
                      </div>
                    </div>
                  </div>

                  {/* DATA ORANG TUA KANDUNG */}
                  <div className="space-y-1 pt-1 border-t border-black">
                    <div className="font-bold text-xs">DATA ORANG TUA KANDUNG</div>
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-8">
                        <UnderlineField label="19. Nama Lengkap Ayah" value={formValues.nama_ayah} />
                      </div>
                      <div className="col-span-4">
                        <UnderlineField label="20. Agama Ayah" value={formValues.agama_ayah} />
                      </div>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-8">
                        <UnderlineField label="21. Nama Lengkap Ibu" value={formValues.nama_ibu} />
                      </div>
                      <div className="col-span-4">
                        <UnderlineField label="22. Agama Ibu" value={formValues.agama_ibu} />
                      </div>
                    </div>
                  </div>

                  {/* ALASAN MASUK KATOLIK */}
                  <div className="space-y-1 pt-1 border-t border-black">
                    <div className="font-bold text-xs">ALASAN MASUK KATOLIK :</div>
                    <div className="border border-black p-2 min-h-[50px] whitespace-pre-wrap leading-relaxed">
                      {formValues.alasan_masuk || ''}
                    </div>
                  </div>

                  {/* TANDA TANGAN PENDAFTAR & KETUA LINGKUNGAN */}
                  <div className="pt-2">
                    <div className="text-right italic text-[10px] pb-1">
                      {currentDateFormatted}
                    </div>
                    <div className="grid grid-cols-2 gap-6 text-center text-[10px]">
                      <div className="space-y-14">
                        <div>
                          Tanda tangan dan nama jelas<br />
                          <strong>Pendaftar</strong>
                        </div>
                        <div className="font-bold underline">
                          ( {formValues.nama_calon || '...........................................'} )
                        </div>
                      </div>

                      <div className="space-y-14">
                        <div>
                          Mengetahui,<br />
                          <strong>Ketua Lingkungan {formatNamaLingkungan(lingkunganName)}</strong>
                        </div>
                        <div className="font-bold underline">
                          ( {pengurus.ketua_nama || '...........................................'} )
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* DOKUMEN YANG DILAMPIRKAN CHECKLIST */}
                  <div className="pt-2 border-t border-black text-[9px] space-y-1">
                    <div className="font-bold text-[10px]">Dokumen yang dilampirkan (dicentang oleh sekretariat Paroki) :</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <div>[ &nbsp; ] Fotokopi Akta Kelahiran</div>
                      <div>[ &nbsp; ] Fotokopi surat baptis dari Gereja asal (khusus Kristen)</div>
                      <div>[ &nbsp; ] Fotokopi KTP</div>
                      <div>[ &nbsp; ] Fotokopi KK Pemerintah</div>
                      <div>[ &nbsp; ] Fotokopi Surat Nikah agama</div>
                      <div>[ &nbsp; ] Fotokopi Surat Nikah sipil</div>
                      <div className="col-span-2">[ &nbsp; ] Surat pernyataan dari orang tua bagi yang berusia di bawah 17 tahun dan atau salah satu orang tua bukan beragama Katolik.</div>
                    </div>
                  </div>
                </div>
              ) : (
                /* FORM 01 & FORMULIR LAINNYA */
                <div className="space-y-3 text-[11px]">
                  {/* Form Title & Official Code */}
                  <div className="text-center space-y-0.5 pb-1">
                    <div className="font-serif italic font-bold text-base sm:text-lg leading-tight">
                      {currentFormDef.title}
                    </div>
                    <div className="font-sans font-bold text-xs sm:text-sm tracking-tight">
                      {currentFormDef.code} --- Paroki : Bekasi Utara – St. Clara
                    </div>
                  </div>

                  {/* FORM 01: SAKRAMEN BAPTIS BAYI / ANAK */}
                  {selectedFormId === 'FORM01' && (
                    <div className="space-y-3 text-[11px]">
                      {/* Syarat & Lampiran Box */}
                      <div className="border border-black p-2.5 text-[10px] leading-relaxed space-y-1">
                        <div><strong>Syarat :</strong></div>
                        <ul className="list-disc list-inside pl-1 space-y-0.5">
                          <li>Anak berusia maksimal 7 tahun.</li>
                          <li>Kedua orang tua dan wali baptis wajib mengikuti rekoleksi persiapan pada waktu yang ditentukan.</li>
                        </ul>
                        <div className="pt-0.5"><strong>Syarat wali baptis :</strong></div>
                        <ul className="list-disc list-inside pl-1 space-y-0.5">
                          <li>Seorang katolik yang berusia dewasa dan telah menerima Sakramen Inisiasi (Baptis, Komuni dan Penguatan)</li>
                          <li>Bukan ayah/ibu/kakek/nenek calon Baptis</li>
                        </ul>
                        <div className="pt-0.5"><strong>Hal yang perlu dilampirkan :</strong></div>
                        <ul className="list-disc list-inside pl-1 space-y-0.5">
                          <li>Fotocopy akte kelahiran/surat tanda lahir</li>
                          <li>Fotocopy KK Gereja</li>
                          <li>Fotocopy akte perkawinan agama</li>
                          <li>Fotocopy akte perkawinan sipil</li>
                          <li>Fotocopy surat baptis wali baptis <em>(dipilih sesuai gender/jenis kelamin anak)</em>; Jika di surat baptis belum tercatatkan Sakramen Penguatan maka dilampirkan juga fotocopy sertifikat penerimaan Sakramen Penguatan</li>
                          <li>Surat Pengantar Pastor Paroki, jika dari luar Paroki ........................................</li>
                          <li>Surat Pernyataan Memberi Izin Anak Untuk Dibaptis <em>(apabila salah satu orang tua bukan Katolik)</em></li>
                        </ul>
                      </div>

                      {/* DATA CALON BAPTIS */}
                      <div className="space-y-1">
                        <div className="font-bold text-xs">DATA CALON BAPTIS .</div>
                        <DottedField
                          label="1. Nama Baptis"
                          value={formValues.nama_baptis_anak}
                          suffix={<span className="ml-2 font-medium">({formValues.jenis_kelamin || 'L / P'})</span>}
                        />
                        <DottedField label="2. Nama Sendiri" value={formValues.nama_sendiri} />
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-8">
                            <DottedField label="3. Tempat, tgl. Lahir" value={formValues.tempat_tgl_lahir} />
                          </div>
                          <div className="col-span-4">
                            <DottedField label="Usia" value={formValues.usia_anak} />
                          </div>
                        </div>
                        <DottedField
                          label="4. Pembaptisan"
                          value={formValues.tgl_rencana_baptis ? `tanggal ${formValues.tgl_rencana_baptis}` : ''}
                          suffix={<span className="ml-1 text-[10px]">( rencana )</span>}
                        />
                        <DottedField label="5. Nomor Induk Kependudukan (NIK) Anak" value={formValues.nik_anak} />
                      </div>

                      {/* DATA ORANG TUA KANDUNG */}
                      <div className="space-y-1 pt-1">
                        <div className="font-bold text-xs">DATA ORANG TUA KANDUNG <em>( lengkap dengan nama baptis )</em></div>
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-8">
                            <DottedField label="1. Nama Ayah" value={formValues.nama_ayah} />
                          </div>
                          <div className="col-span-4">
                            <DottedField label="Agama" value={formValues.agama_ayah || 'Katolik'} />
                          </div>
                        </div>
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-8">
                            <DottedField label="2. Nama Ibu" value={formValues.nama_ibu} />
                          </div>
                          <div className="col-span-4">
                            <DottedField label="Agama" value={formValues.agama_ibu || 'Katolik'} />
                          </div>
                        </div>
                        <DottedField label="3. Alamat" value={formValues.alamat} />
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-6">
                            <DottedField label="4. Telepon" value={formValues.telepon_rumah} />
                          </div>
                          <div className="col-span-6">
                            <DottedField label="HP" value={formValues.hp} />
                          </div>
                        </div>
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-6">
                            <DottedField label="5. No. KK. gereja" value={formValues.no_kk_gereja} />
                          </div>
                          <div className="col-span-6">
                            <DottedField label="Wilayah / Lingkungan" value={formValues.wilayah_lingkungan || formatNamaLingkungan(lingkunganName)} />
                          </div>
                        </div>
                      </div>

                      {/* WALI BAPTIS */}
                      <div className="space-y-1 pt-1">
                        <div className="font-bold text-xs">WALI BAPTIS <em>( lengkap dengan nama baptis )</em></div>
                        <DottedField label="1. Nama Lengkap" value={formValues.wali_baptis} />
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-6">
                            <DottedField label="2. Wilayah/Lingkungan" value={formValues.wali_wilayah_lingkungan} />
                          </div>
                          <div className="col-span-6">
                            <DottedField label="Paroki" value={formValues.paroki_wali || 'Paroki Santa Clara Bekasi Utara'} />
                          </div>
                        </div>
                      </div>

                      {/* Tanda Tangan 4 Kolom */}
                      <div className="pt-2">
                        <div className="text-right italic text-[10px] pb-1">
                          {currentDateFormatted}
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-center text-[10px] items-stretch">
                          {/* Box Sekretariat */}
                          <div className="border border-black p-2 text-left space-y-1">
                            <div className="font-bold">Diterima pihak sekretariat</div>
                            <div>Tanggal : ....................</div>
                            <div>Oleh &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ....................</div>
                          </div>

                          {/* Orang Tua */}
                          <div className="flex flex-col justify-between py-1">
                            <div>Orangtua,</div>
                            <div className="pt-10 font-bold underline">
                              ( {formValues.nama_ayah || formValues.nama_ibu || '..............................'} )
                            </div>
                          </div>

                          {/* Sie. Katekese */}
                          <div className="flex flex-col justify-between py-1">
                            <div>
                              Mengetahui,<br />Sie. Katekese Lingkungan
                            </div>
                            <div className="pt-10 font-bold underline">
                              ( .............................. )
                            </div>
                          </div>

                          {/* Ketua Lingkungan */}
                          <div className="flex flex-col justify-between py-1">
                            <div>
                              Mengetahui<br />Ketua Lingkungan {formatNamaLingkungan(lingkunganName)}
                            </div>
                            <div className="pt-10 font-bold underline">
                              ( {pengurus.ketua_nama || '..............................'} )
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Catatan & Petugas Sekretariat */}
                      <div className="pt-1 border-t border-black text-[9px] leading-relaxed space-y-1">
                        <div>
                          <strong>Catatan:</strong> Formulir dan hal-hal yang dilampirkan diserahkan setelah lengkap ke sekretariat maksimal batas tanggal yang telah ditentukan/diumumkan. Lewat dari tanggal penutupan tanggal pendaftaran maka ikut periode baptisan selanjutnya.
                        </div>
                        <div className="pt-0.5">
                          <strong>Diisi oleh petugas Sekretariat Paroki :</strong><br />
                          Dibaptis pada Tgl. ........................................ Jam .................... Oleh ................................................................
                        </div>
                      </div>
                    </div>
                  )}

                  {/* FORM 10A: SURAT PENGANTAR LINGKUNGAN UMUM */}
                  {selectedFormId === 'FORM10A' && (
                    <div className="space-y-3 text-[11px]">
                      <div className="space-y-1">
                        <DottedField label="Nama Ketua Lingkungan" value={pengurus.ketua_nama || formValues.nama_ketua_lingkungan} />
                        <DottedField label="Lingkungan/Wilayah" value={formatNamaLingkungan(lingkunganName)} />
                      </div>

                      <div className="pt-1">Menerangkan dengan sesungguhnya bahwa :</div>

                      <div className="space-y-1">
                        <DottedField label="Nama (lengkap)" value={formValues.nama_lengkap} />
                        <DottedField label="Tempat, tgl. Lahir" value={formValues.tempat_tgl_lahir} />
                        <DottedField label="Alamat tinggal" value={formValues.alamat} />
                        <DottedField label="Nama Orangtua" value={formValues.nama_ortu} />
                      </div>

                      <div className="pt-1">
                        <DottedField label="Adalah benar berdomisili di lingkungan" value={formatNamaLingkungan(lingkunganName)} />
                      </div>

                      <div className="space-y-1 pt-1">
                        <div>Umat tersebut mohon dibantu untuk dibuatkan surat keterangan/ pengantar mengenai :</div>
                        <div className="border border-black p-2 min-h-[70px] whitespace-pre-wrap font-medium">
                          {formValues.keperluan || 'Pengurusan administrasi gerejawi / rekomendasi ke Sekretariat Paroki Santa Clara Bekasi Utara.'}
                        </div>
                      </div>

                      <div className="text-justify leading-relaxed pt-1">
                        Demikianlah surat pengantar ini kami buat untuk permintaan surat keterangan/pengantar dari Paroki Bekasi Utara dan untuk dipakai sebagaimana mestinya. Atas perhatian dan kerja samanya kami ucapkan terima kasih.
                      </div>

                      <div className="pt-6 flex justify-end text-center">
                        <div className="w-64 space-y-14">
                          <div>
                            {currentDateFormatted}<br />
                            Ketua Lingkungan {formatNamaLingkungan(lingkunganName)}
                          </div>
                          <div className="font-bold underline text-black">
                            ( {pengurus.ketua_nama || '.........................................'} )
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* FORMULIR LAINNYA (DOKUMEN STANDAR SESUAI ASLINYA) */}
                  {selectedFormId !== 'FORM01' && selectedFormId !== 'FORM10A' && selectedFormId !== 'FORM02' && (
                    <div className="space-y-3 text-[11px]">
                      {/* Syarat box bila ada */}
                      {currentFormDef.syarat && currentFormDef.syarat.length > 0 && (
                        <div className="border border-black p-2 text-[10px] leading-relaxed">
                          <div className="font-bold">Syarat &amp; Hal yang perlu dilampirkan:</div>
                          <ul className="list-disc list-inside pl-1 space-y-0.5">
                            {currentFormDef.syarat.map((s, idx) => (
                              <li key={idx}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Render fields with dotted lines */}
                      <div className="space-y-1.5 pt-1">
                        {currentFormDef.fields.map((fld) => {
                          const val = formValues[fld.key]
                          if (fld.type === 'textarea') {
                            return (
                              <div key={fld.key} className="space-y-0.5 pt-1">
                                <div className="font-semibold">{fld.label} :</div>
                                <div className="border border-black p-2 whitespace-pre-wrap min-h-[50px]">
                                  {val || ''}
                                </div>
                              </div>
                            )
                          }
                          return (
                            <DottedField
                              key={fld.key}
                              label={fld.label}
                              value={val}
                            />
                          )
                        })}
                      </div>

                      {/* Standard Signature Block */}
                      <div className="pt-8">
                        <div className="text-right italic text-[10px] pb-2">
                          {currentDateFormatted}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                          <div className="space-y-14">
                            <div>Pemohon / Yang Bersangkutan</div>
                            <div className="font-bold underline">
                              ( {formValues.nama_lengkap || formValues.nama_calon || formValues.nama_sendiri || formValues.nama_kk || formValues.nama_ayah || '..............................'} )
                            </div>
                          </div>

                          <div className="space-y-14">
                            <div>Ketua {formatNamaLingkungan(lingkunganName)}</div>
                            <div className="font-bold underline">
                              ( {pengurus.ketua_nama || '..............................'} )
                            </div>
                          </div>

                          <div className="space-y-14">
                            <div>Mengetahui Sekretariat / Pastor Paroki</div>
                            <div className="font-bold underline">
                              ( Paroki Santa Clara )
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
