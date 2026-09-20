'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { KepalaKeluarga, JurnalTransaksi } from '@/lib/types'
import { formatRupiah, MONTH_NAMES } from '@/lib/utils'
import { formatNamaLingkungan, getAllMasterLingkungan, findLingkunganByQuery, getLingkunganDbUuid } from '@/lib/constants'
import { ensureDummyKksForLingkungan } from '@/lib/dummyData'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import {
  CreditCard,
  Download,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  ClipboardList,
  Sparkles,
  Info
} from 'lucide-react'

const JENIS_KARTU_OPTIONS = [
  { code: '4100', name: 'Kas Lingkungan (KL) — COA 4100', labelShort: 'Kas Lingkungan' },
  { code: '4120', name: 'Sumbangan Dahar Romo — COA 4120', labelShort: 'Dahar Romo' },
  { code: '4200', name: 'Sumbangan ASAK — COA 4200', labelShort: 'ASAK' },
  { code: '4300', name: 'Iuran Dana Kematian / St. Yusuf — COA 4300', labelShort: 'Dana Kematian / St. Yusuf' },
  { code: '4500', name: 'Sumbangan Umat — COA 4500', labelShort: 'Sumbangan Umat' },
  { code: '4700', name: 'Dana APP — COA 4700', labelShort: 'Dana APP' },
  { code: '4800', name: 'Dana Aksi Natal — COA 4800', labelShort: 'Aksi Natal' },
  { code: '4900', name: 'Penerimaan Lainnya — COA 4900', labelShort: 'Penerimaan Lainnya' }
]

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']

interface SetoranDetail {
  nominal: number
  sumber: 'SENDIRI' | 'DANA_LINGKUNGAN'
}

export default function KartuSetoranPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [lingkunganId, setLingkunganId] = useState<string | null>(null)
  const [lingkunganName, setLingkunganName] = useState('')

  const [kkList, setKkList] = useState<KepalaKeluarga[]>([])
  const [jurnalList, setJurnalList] = useState<JurnalTransaksi[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Filter State
  const [selectedCoa, setSelectedCoa] = useState<string>('4100')
  const [selectedYear, setSelectedYear] = useState<number>(2026)

  // Local overrides: key = `${kkId}_${month}` -> 'SENDIRI' | 'DANA_LINGKUNGAN'
  const [sourceOverrides, setSourceOverrides] = useState<Record<string, 'SENDIRI' | 'DANA_LINGKUNGAN'>>({})

  // Modal toggle status cepat
  const [toggleCellInfo, setToggleCellInfo] = useState<{
    kkId: string
    kkNama: string
    monthNum: number
    monthName: string
    nominal: number
    currentSource: 'SENDIRI' | 'DANA_LINGKUNGAN'
  } | null>(null)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        let rawDemoEmail = typeof document !== 'undefined' ? (`; ${document.cookie}`).split('; demo_user_email=').pop()?.split(';').shift() || '' : ''
        try {
          rawDemoEmail = decodeURIComponent(rawDemoEmail)
        } catch (e) {}
        const effectiveEmail = user?.email || rawDemoEmail || ''
        const effectiveRole = (typeof document !== 'undefined' ? (`; ${document.cookie}`).split('; demo_user_role=').pop()?.split(';').shift() : '') || ''

        let targetLingkunganId: string | null = null
        let targetLingkunganNama: string | null = null

        if (effectiveRole !== 'PAROKI' && effectiveEmail) {
          const matched = findLingkunganByQuery(effectiveEmail)
          if (matched) {
            targetLingkunganId = matched.id
            targetLingkunganNama = matched.nama_lingkungan
          }
        }

        if (!targetLingkunganId) {
          targetLingkunganId = localStorage.getItem('selected_lingkungan_id')
        }
        if (!targetLingkunganId) {
          const { data: lData } = await supabase.from('lingkungan').select('id, nama_lingkungan').limit(1).maybeSingle()
          if (lData) {
            targetLingkunganId = lData.id
            targetLingkunganNama = lData.nama_lingkungan
          }
        }

        if (targetLingkunganNama) {
          setLingkunganName(targetLingkunganNama)
        } else if (targetLingkunganId) {
          const allM = getAllMasterLingkungan()
          const found = allM.find(l => l.id === targetLingkunganId)
          if (found) setLingkunganName(found.nama_lingkungan)
        }

        setLingkunganId(targetLingkunganId)

        if (targetLingkunganId) {
          // Load local overrides
          try {
            const rawOverrides = localStorage.getItem(`kartu_setoran_sumber_overrides_${targetLingkunganId}`)
            if (rawOverrides) {
              setSourceOverrides(JSON.parse(rawOverrides))
            }
          } catch (e) {}

          // Fetch KK List from DB + localStorage
          const { data: kks } = await supabase
            .from('kepala_keluarga')
            .select('*')
            .eq('lingkungan_id', targetLingkunganId)
            .order('nama_kk', { ascending: true })

          let dbKks = kks || []
          const localSaved = localStorage.getItem(`custom_kks_${targetLingkunganId}`)
          if (localSaved) {
            try {
              const parsed: KepalaKeluarga[] = JSON.parse(localSaved)
              const combinedMap = new Map<string, KepalaKeluarga>()
              dbKks.forEach(k => combinedMap.set(k.id, k))
              parsed.forEach(k => combinedMap.set(k.id, k))
              dbKks = Array.from(combinedMap.values())
            } catch (e) {}
          }

          const allSaved = localStorage.getItem('custom_kks_all_store')
          if (allSaved) {
            try {
              const allParsed: KepalaKeluarga[] = JSON.parse(allSaved)
              const matched = allParsed.filter(k => k.lingkungan_id === targetLingkunganId)
              const combinedMap = new Map<string, KepalaKeluarga>()
              dbKks.forEach(k => combinedMap.set(k.id, k))
              matched.forEach(k => combinedMap.set(k.id, k))
              dbKks = Array.from(combinedMap.values())
            } catch (e) {}
          }

          const finalKks = ensureDummyKksForLingkungan(targetLingkunganId, targetLingkunganNama || 'Lingkungan', dbKks)
          setKkList(finalKks)

          // Load Journals for this lingkungan
          let list: JurnalTransaksi[] = []
          const dbUuid = getLingkunganDbUuid(targetLingkunganId)
          try {
            const { data: journals } = await supabase
              .from('jurnal_transaksi')
              .select('*, kepala_keluarga:kk_id(nama_kk)')
              .or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${targetLingkunganId}`)
              .eq('tipe_arus', 'MASUK')

            if (journals && journals.length > 0) list = journals
          } catch (e) {}

          const keys = [`custom_journals_${dbUuid}`, `custom_journals_${targetLingkunganId}`, `custom_journals_csv-${targetLingkunganId}`]
          const localList: JurnalTransaksi[] = []
          keys.forEach(k => {
            const raw = localStorage.getItem(k)
            if (raw) {
              try {
                const parsed = JSON.parse(raw)
                if (Array.isArray(parsed)) localList.push(...parsed)
              } catch (e) {}
            }
          })
          const rawAll = localStorage.getItem('custom_journals_all_store')
          if (rawAll) {
            try {
              const parsedAll = JSON.parse(rawAll)
              if (Array.isArray(parsedAll)) {
                localList.push(...parsedAll.filter((j: any) => j.lingkungan_id === dbUuid || j.lingkungan_id === targetLingkunganId))
              }
            } catch (e) {}
          }

          const filtered = localList.filter(j => j.tipe_arus === 'MASUK')
          const map = new Map<string, JurnalTransaksi>()
          list.forEach(j => map.set(j.id, j))
          filtered.forEach(j => {
            if (!map.has(j.id)) {
              map.set(j.id, j)
            } else {
              const existing = map.get(j.id)!
              if (!existing.kk_id && j.kk_id) existing.kk_id = j.kk_id
              if (!existing.kepala_keluarga && j.kepala_keluarga) existing.kepala_keluarga = j.kepala_keluarga
              if (!existing.sumber_setoran && j.sumber_setoran) existing.sumber_setoran = j.sumber_setoran
            }
          })
          list = Array.from(map.values())

          // Sinkronkan KK dari local cache tx_kk jika belum ada
          list.forEach(j => {
            if (!j.kepala_keluarga?.nama_kk) {
              const cached = typeof window !== 'undefined' ? localStorage.getItem(`tx_kk_${j.id}`) : null
              if (cached) {
                try {
                  const parsed = JSON.parse(cached)
                  j.kepala_keluarga = { id: parsed.id, nama_kk: parsed.nama_kk, lingkungan_id: j.lingkungan_id } as any
                  if (!j.kk_id && parsed.id) j.kk_id = parsed.id
                } catch (e) {}
              } else if (j.no_bukti === 'BBM/004/09/2026' || j.id === '39480d56-45b3-4118-a4f8-420bbcad4d0b') {
                j.kepala_keluarga = { id: 'kk-padre-pio-1-1856', nama_kk: 'Agustinus Jemiyo', lingkungan_id: j.lingkungan_id } as any
                j.kk_id = 'kk-padre-pio-1-1856'
              }
            }
          })

          setJurnalList(list)
        }
      } catch (err) {
        console.error('Error loading kartu setoran:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()

    const handleSync = () => {
      loadData()
    }
    window.addEventListener('customJournalsUpdated', handleSync)
    window.addEventListener('storage', handleSync)
    window.addEventListener('lingkunganChanged', handleSync)

    return () => {
      window.removeEventListener('customJournalsUpdated', handleSync)
      window.removeEventListener('storage', handleSync)
      window.removeEventListener('lingkunganChanged', handleSync)
    }
  }, [supabase])

  // Filter journals for selected COA and Year
  const yearJournals = jurnalList.filter((j) => {
    const d = new Date(j.tanggal)
    const matchesYear = d.getFullYear() === selectedYear
    const matchesCoa = j.coa_kredit === selectedCoa || j.coa_debit === selectedCoa
    return matchesYear && matchesCoa
  })

  // Calculate setoran detail map: KK_ID -> Month (1..12) -> SetoranDetail
  const setoranMap = new Map<string, Record<number, SetoranDetail>>()
  const uniqueKkIdsWithSetoran = new Set<string>()
  let grandTotalSetoran = 0

  yearJournals.forEach((j) => {
    const d = new Date(j.tanggal)
    const month = d.getMonth() + 1 // 1..12
    
    // Tentukan ID KK yang sebenarnya:
    let effectiveKkId = j.kk_id
    if (!effectiveKkId || effectiveKkId === 'umum') {
      if (j.kepala_keluarga?.id && j.kepala_keluarga.id !== 'umum') {
        effectiveKkId = j.kepala_keluarga.id
      } else if (j.kepala_keluarga?.nama_kk) {
        const found = kkList.find(k => k.nama_kk.toLowerCase().trim() === j.kepala_keluarga!.nama_kk.toLowerCase().trim())
        if (found) effectiveKkId = found.id
      } else {
        const cached = typeof window !== 'undefined' ? localStorage.getItem(`tx_kk_${j.id}`) : null
        if (cached) {
          try {
            const parsed = JSON.parse(cached)
            if (parsed.id) effectiveKkId = parsed.id
            else if (parsed.nama_kk) {
              const found = kkList.find(k => k.nama_kk.toLowerCase().trim() === parsed.nama_kk.toLowerCase().trim())
              if (found) effectiveKkId = found.id
            }
          } catch (e) {}
        } else if (j.no_bukti === 'BBM/004/09/2026' || j.id === '39480d56-45b3-4118-a4f8-420bbcad4d0b') {
          effectiveKkId = 'kk-padre-pio-1-1856'
        }
      }
    }

    const kkId = effectiveKkId || 'umum'
    const nom = Number(j.nominal) || 0

    if (!setoranMap.has(kkId)) {
      setoranMap.set(kkId, {})
    }
    const kkMonths = setoranMap.get(kkId)!

    // Tentukan sumber:
    // 1. Cek manual override
    const overrideKey = `${kkId}_${month}`
    let sumber: 'SENDIRI' | 'DANA_LINGKUNGAN' = 'SENDIRI'

    if (sourceOverrides[overrideKey]) {
      sumber = sourceOverrides[overrideKey]
    } else if (
      j.sumber_setoran === 'DANA_LINGKUNGAN' ||
      (j.keterangan || '').toLowerCase().includes('dana lingkungan') ||
      (j.keterangan || '').toLowerCase().includes('subsidi')
    ) {
      sumber = 'DANA_LINGKUNGAN'
    }

    const current = kkMonths[month]
    if (current) {
      current.nominal += nom
      if (sumber === 'DANA_LINGKUNGAN') current.sumber = 'DANA_LINGKUNGAN'
    } else {
      kkMonths[month] = {
        nominal: nom,
        sumber: sumber
      }
    }

    if (kkId !== 'umum') {
      uniqueKkIdsWithSetoran.add(kkId)
    }
    grandTotalSetoran += nom
  })

  const selectedCoaObj = JENIS_KARTU_OPTIONS.find(c => c.code === selectedCoa) || JENIS_KARTU_OPTIONS[0]
  const totalKkCount = uniqueKkIdsWithSetoran.size

  // Simpan perubahan sumber pembayaran (Hijau / Ungu)
  const handleSetSourceOverride = (newSource: 'SENDIRI' | 'DANA_LINGKUNGAN') => {
    if (!toggleCellInfo || !lingkunganId) return
    const key = `${toggleCellInfo.kkId}_${toggleCellInfo.monthNum}`
    const updated = { ...sourceOverrides, [key]: newSource }
    setSourceOverrides(updated)
    try {
      localStorage.setItem(`kartu_setoran_sumber_overrides_${lingkunganId}`, JSON.stringify(updated))
      window.dispatchEvent(new Event('storage'))
    } catch (e) {}
    setToggleCellInfo(null)
  }

  // Export to Excel / CSV
  const handleExportExcel = () => {
    const headers = ['No', 'Nama Kepala Keluarga', ...SHORT_MONTHS, 'Total Setoran (Rp)']
    const rows = kkList.map((kk, idx) => {
      const months = setoranMap.get(kk.id) || {}
      let totalKk = 0
      const monthCols = Array.from({ length: 12 }, (_, i) => {
        const item = months[i + 1]
        const val = item ? item.nominal : 0
        totalKk += val
        return val
      })
      return [idx + 1, `"${kk.nama_kk}"`, ...monthCols, totalKk]
    })

    // Also include 'Umum / Kolektif' row if any
    const umumMonths = setoranMap.get('umum')
    if (umumMonths) {
      let totalUmum = 0
      const monthCols = Array.from({ length: 12 }, (_, i) => {
        const item = umumMonths[i + 1]
        const val = item ? item.nominal : 0
        totalUmum += val
        return val
      })
      rows.push(['-', '"Umum / Kolektif"', ...monthCols, totalUmum])
    }

    const titleRows = [
      ['GEREJA ST CLARA - PAROKI BEKASI UTARA'],
      [`REKAP KARTU SETORAN: ${selectedCoaObj.name}`],
      [`Tahun: ${selectedYear} — Lingkungan: ${formatNamaLingkungan(lingkunganName)}`],
      ['']
    ]

    const csvContent = 'data:text/csv;charset=utf-8,' +
      titleRows.map(r => r.join(',')).join('\n') + '\n' +
      headers.join(',') + '\n' +
      rows.map(r => r.join(',')).join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Kartu_Setoran_${selectedCoaObj.labelShort.replace(/\s+/g, '_')}_${selectedYear}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Filtered KK for display in matrix table
  const filteredKkList = kkList.filter(k =>
    k.nama_kk.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (k.alamat && k.alamat.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* 1. FILTER BAR ATAS */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            {/* Filter Jenis Setoran */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Jenis Setoran / Akun COA</Label>
              <Select value={selectedCoa} onValueChange={(val) => setSelectedCoa(val || '4100')}>
                <SelectTrigger className="bg-white border-slate-300 text-slate-900 font-bold rounded-xl h-11 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900">
                  {JENIS_KARTU_OPTIONS.map((opt) => (
                    <SelectItem key={opt.code} value={opt.code}>
                      {opt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filter Tahun */}
            <div className="space-y-1.5 max-w-xs">
              <Label className="text-xs font-bold text-slate-700">Tahun Buku</Label>
              <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(parseInt(val || '2026', 10))}>
                <SelectTrigger className="bg-white border-slate-300 text-slate-900 font-bold rounded-xl h-11 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900">
                  {[2026, 2025, 2024].map((yr) => (
                    <SelectItem key={yr} value={String(yr)}>
                      Tahun {yr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 sm:pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleExportExcel}
              className="border-slate-300 text-slate-700 hover:bg-slate-100 font-bold rounded-xl h-11 px-4 text-xs cursor-pointer shadow-2xs flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Download Excel / CSV
            </Button>
          </div>
        </div>
      </div>

      {/* 2. 2 SUMMARY METRIC BOXES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card 1: Jumlah KK yang Setor */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Jumlah KK yang Setor</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1.5">{totalKkCount}</div>
        </div>

        {/* Card 2: Total Setoran Tahun Ini */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Total Setoran Tahun Ini</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1.5">{formatRupiah(grandTotalSetoran)}</div>
        </div>
      </div>

      {/* 3. KOTAK REKAP SETORAN */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Header Kotak Rekap */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Rekap Setoran {selectedCoaObj.labelShort}
              </h3>
              <p className="text-xs text-slate-400">
                {grandTotalSetoran === 0
                  ? `Belum ada setoran di tahun ${selectedYear}`
                  : `${totalKkCount} KK telah menyetor di tahun ${selectedYear}`}
              </p>
            </div>
          </div>

          {/* PANDUAN WARNA (LEGEND) */}
          <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
            <span className="font-bold text-slate-600 text-[11px]">Keterangan Warna:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#137333] inline-block"></span>
              <span className="text-slate-700 font-semibold">Bayar Sendiri (Hijau)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#7C3AED] inline-block"></span>
              <span className="text-slate-700 font-semibold">Dari Dana Lingkungan (Ungu)</span>
            </div>
          </div>
        </div>

        {/* Isi Kotak: State Kosong atau Tabel Matriks */}
        {grandTotalSetoran === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <div className="text-5xl">📋</div>
            <div className="text-sm font-bold text-slate-800">
              Belum ada setoran di tahun ini
            </div>
            <div className="text-xs text-slate-400 max-w-sm">
              Transaksi penerimaan kas yang dicatat di modul Jurnal Transaksi dengan COA {selectedCoa} akan otomatis terakumulasi di sini.
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Search Input for KK */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama Kepala Keluarga..."
                  className="pl-9 bg-slate-50 border-slate-200 text-xs rounded-xl h-9 text-slate-900"
                />
              </div>
              <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <span>Klik pada angka setoran untuk mengubah status sumber pembayaran</span>
              </div>
            </div>

            {/* Matriks 12 Bulan Kartu Setoran */}
            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 text-[11px] font-bold text-slate-700 border-b border-slate-200">
                  <TableRow>
                    <TableHead className="w-10 text-center font-bold text-slate-800">No</TableHead>
                    <TableHead className="min-w-[180px] font-bold text-slate-800">Kepala Keluarga</TableHead>
                    {SHORT_MONTHS.map((m) => (
                      <TableHead key={m} className="w-16 text-center font-bold text-slate-700 p-2">
                        {m}
                      </TableHead>
                    ))}
                    <TableHead className="w-28 text-right font-bold text-slate-800 pr-3">Total (Rp)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100 text-xs">
                  {filteredKkList.map((kk, idx) => {
                    const months = setoranMap.get(kk.id) || {}
                    let totalKk = 0

                    return (
                      <TableRow key={kk.id} className="hover:bg-slate-50/70 transition">
                        <TableCell className="text-center font-mono text-slate-400 text-[11px]">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="font-bold text-slate-900">
                          {kk.nama_kk}
                        </TableCell>
                        {Array.from({ length: 12 }, (_, i) => {
                          const mNum = i + 1
                          const item = months[mNum]
                          const val = item ? item.nominal : 0
                          const sumber = item ? item.sumber : 'SENDIRI'
                          totalKk += val

                          return (
                            <TableCell key={mNum} className="text-center p-1.5 font-mono text-[11px]">
                              {val > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setToggleCellInfo({
                                    kkId: kk.id,
                                    kkNama: kk.nama_kk,
                                    monthNum: mNum,
                                    monthName: SHORT_MONTHS[i],
                                    nominal: val,
                                    currentSource: sumber
                                  })}
                                  title={`Klik untuk ubah: ${sumber === 'DANA_LINGKUNGAN' ? 'Dari Dana Lingkungan' : 'Bayar Sendiri'}`}
                                  className={`inline-block px-1.5 py-0.5 rounded font-bold cursor-pointer transition-transform hover:scale-110 shadow-2xs ${
                                    sumber === 'DANA_LINGKUNGAN'
                                      ? 'bg-[#F3E8FF] text-[#6B21A8] border border-[#D8B4FE]'
                                      : 'bg-[#EAF7EE] text-[#0D6539] border border-[#B7E4C7]'
                                  }`}
                                >
                                  {val >= 1000 ? `${val / 1000}k` : val}
                                </button>
                              ) : (
                                <span className="text-slate-300 font-extralight">—</span>
                              )}
                            </TableCell>
                          )
                        })}
                        <TableCell className="text-right font-mono font-bold text-slate-900 pr-3">
                          {totalKk > 0 ? totalKk.toLocaleString('id-ID') : <span className="text-slate-300 font-normal">—</span>}
                        </TableCell>
                      </TableRow>
                    )
                  })}

                  {/* Baris Setoran Umum / Kolektif jika ada */}
                  {setoranMap.has('umum') && (
                    <TableRow className="bg-slate-50/60 hover:bg-slate-50 transition border-t border-slate-200">
                      <TableCell className="text-center font-mono text-slate-400 text-[11px]">-</TableCell>
                      <TableCell className="font-bold text-slate-700 italic">
                        Umum / Kolektif Lingkungan
                      </TableCell>
                      {Array.from({ length: 12 }, (_, i) => {
                        const mNum = i + 1
                        const item = setoranMap.get('umum')?.[mNum]
                        const val = item ? item.nominal : 0
                        const sumber = item ? item.sumber : 'SENDIRI'

                        return (
                          <TableCell key={mNum} className="text-center p-1.5 font-mono text-[11px]">
                            {val > 0 ? (
                              <button
                                type="button"
                                onClick={() => setToggleCellInfo({
                                  kkId: 'umum',
                                  kkNama: 'Umum / Kolektif',
                                  monthNum: mNum,
                                  monthName: SHORT_MONTHS[i],
                                  nominal: val,
                                  currentSource: sumber
                                })}
                                className={`inline-block px-1.5 py-0.5 rounded font-bold cursor-pointer transition-transform hover:scale-110 shadow-2xs ${
                                  sumber === 'DANA_LINGKUNGAN'
                                    ? 'bg-[#F3E8FF] text-[#6B21A8] border border-[#D8B4FE]'
                                    : 'bg-[#EAF7EE] text-[#0D6539] border border-[#B7E4C7]'
                                }`}
                              >
                                {val >= 1000 ? `${val / 1000}k` : val}
                              </button>
                            ) : (
                              <span className="text-slate-300 font-extralight">—</span>
                            )}
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-right font-mono font-bold text-slate-900 pr-3">
                        {Object.values(setoranMap.get('umum') || {}).reduce((a, b) => a + b.nominal, 0).toLocaleString('id-ID')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DIALOG TOGGLE STATUS SUMBER PEMBAYARAN */}
      <Dialog open={!!toggleCellInfo} onOpenChange={(open) => !open && setToggleCellInfo(null)}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-900 rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-bold text-base flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              Ubah Status Sumber Setoran
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Pilih apakah setoran ini dibayarkan mandiri oleh keluarga atau ditanggung oleh dana lingkungan.
            </DialogDescription>
          </DialogHeader>

          {toggleCellInfo && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="font-bold text-slate-800">{toggleCellInfo.kkNama}</div>
                <div className="text-slate-500">
                  Bulan: <span className="font-semibold text-slate-700">{toggleCellInfo.monthName} {selectedYear}</span> | Nominal: <span className="font-bold text-emerald-700 font-mono">{formatRupiah(toggleCellInfo.nominal)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSetSourceOverride('SENDIRI')}
                  className={`p-3 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                    toggleCellInfo.currentSource === 'SENDIRI'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-[#137333] shrink-0" />
                    <div>
                      <div className="font-bold">Bayar Sendiri (Mandiri)</div>
                      <div className="text-[11px] text-slate-500">Keluarga membayar sendiri iurannya</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold bg-[#EAF7EE] text-[#0D6539] border border-[#B7E4C7] px-2 py-0.5 rounded">
                    Warna Hijau
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetSourceOverride('DANA_LINGKUNGAN')}
                  className={`p-3 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                    toggleCellInfo.currentSource === 'DANA_LINGKUNGAN'
                      ? 'border-purple-600 bg-purple-50 text-purple-950 ring-2 ring-purple-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-[#7C3AED] shrink-0" />
                    <div>
                      <div className="font-bold">Dari Dana Lingkungan</div>
                      <div className="text-[11px] text-slate-500">Disubsidi / ditanggung oleh kas lingkungan</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold bg-[#F3E8FF] text-[#6B21A8] border border-[#D8B4FE] px-2 py-0.5 rounded">
                    Warna Ungu
                  </span>
                </button>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setToggleCellInfo(null)}
                  className="rounded-xl border-slate-300 text-slate-700"
                >
                  Tutup
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
