'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { KepalaKeluarga, JurnalTransaksi } from '@/lib/types'
import { formatRupiah, MONTH_NAMES } from '@/lib/utils'
import { formatNamaLingkungan, getAllMasterLingkungan, findLingkunganByQuery } from '@/lib/constants'
import { ensureDummyKksForLingkungan } from '@/lib/dummyData'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  CreditCard,
  Download,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  ClipboardList
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

export default function KartuSetoranPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [lingkunganId, setLingkunganId] = useState<string | null>(null)
  const [lingkunganName, setLingkunganName] = useState('')

  const [kkList, setKkList] = useState<KepalaKeluarga[]>([])
  const [jurnalList, setJurnalList] = useState<JurnalTransaksi[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Filter State (Persis Screenshot)
  const [selectedCoa, setSelectedCoa] = useState<string>('4100')
  const [selectedYear, setSelectedYear] = useState<number>(2026)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const effectiveEmail = user?.email || (typeof document !== 'undefined' ? (`; ${document.cookie}`).split('; demo_user_email=').pop()?.split(';').shift() : '') || ''
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
          try {
            const { data: journals } = await supabase
              .from('jurnal_transaksi')
              .select('*, kepala_keluarga:kk_id(nama_kk)')
              .eq('lingkungan_id', targetLingkunganId)
              .eq('tipe_arus', 'MASUK')

            if (journals) list = journals
          } catch (e) {}

          const raw = localStorage.getItem(`custom_journals_${targetLingkunganId}`)
          if (raw) {
            try {
              const localList: JurnalTransaksi[] = JSON.parse(raw)
              const filtered = localList.filter(j => j.tipe_arus === 'MASUK')
              const map = new Map<string, JurnalTransaksi>()
              list.forEach(j => map.set(j.id, j))
              filtered.forEach(j => map.set(j.id, j))
              list = Array.from(map.values())
            } catch (e) {}
          }

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
    window.addEventListener('storage', handleSync)
    window.addEventListener('lingkunganChanged', handleSync)

    return () => {
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

  // Calculate setoran map: KK_ID -> Month (1..12) -> total nominal
  const setoranMap = new Map<string, Record<number, number>>()
  const uniqueKkIdsWithSetoran = new Set<string>()
  let grandTotalSetoran = 0

  yearJournals.forEach((j) => {
    const d = new Date(j.tanggal)
    const month = d.getMonth() + 1 // 1..12
    const kkId = j.kk_id || 'umum'
    const nom = Number(j.nominal) || 0

    if (!setoranMap.has(kkId)) {
      setoranMap.set(kkId, {})
    }
    const kkMonths = setoranMap.get(kkId)!
    kkMonths[month] = (kkMonths[month] || 0) + nom

    if (kkId !== 'umum') {
      uniqueKkIdsWithSetoran.add(kkId)
    }
    grandTotalSetoran += nom
  })

  const selectedCoaObj = JENIS_KARTU_OPTIONS.find(c => c.code === selectedCoa) || JENIS_KARTU_OPTIONS[0]
  const totalKkCount = uniqueKkIdsWithSetoran.size

  // Export to Excel
  const handleExportExcel = () => {
    const headers = ['No', 'Nama Kepala Keluarga', ...SHORT_MONTHS, 'Total Setoran (Rp)']
    const rows = kkList.map((kk, idx) => {
      const months = setoranMap.get(kk.id) || {}
      let totalKk = 0
      const monthCols = Array.from({ length: 12 }, (_, i) => {
        const val = months[i + 1] || 0
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
        const val = umumMonths[i + 1] || 0
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#18539E]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* 1. FILTER CARD: Jenis Kartu, Tahun, Ekspor Excel */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Field 1: Jenis Kartu */}
          <div className="md:col-span-7 space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Jenis Kartu</Label>
            <Select value={selectedCoa} onValueChange={(val) => setSelectedCoa(val || '4100')}>
              <SelectTrigger className="bg-white border-slate-300 text-slate-900 rounded-xl h-11 text-sm font-medium">
                <SelectValue placeholder="Pilih Jenis Kartu" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 text-slate-900 max-h-60">
                {JENIS_KARTU_OPTIONS.map((opt) => (
                  <SelectItem key={opt.code} value={opt.code}>
                    {opt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Field 2: Tahun */}
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Tahun</Label>
            <Input
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10) || 2026)}
              className="bg-white border-slate-300 text-slate-900 font-bold rounded-xl h-11 text-sm text-center"
            />
          </div>

          {/* Field 3: Tombol Ekspor Excel */}
          <div className="md:col-span-3">
            <Button
              type="button"
              onClick={handleExportExcel}
              className="w-full bg-[#F6EFE2] hover:bg-[#EDE3D0] text-[#5A4423] border border-[#5A4423]/40 font-bold rounded-xl h-11 text-xs shadow-2xs cursor-pointer flex items-center justify-center gap-2 transition-all"
            >
              <Download className="w-4 h-4 text-[#5A4423]" />
              Ekspor Excel
            </Button>
          </div>
        </div>
      </div>

      {/* 2. DUA KARTU RINGKASAN METRIK (Bersih & Estetik Tanpa Warna Neon) */}
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
        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
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

        {/* Isi Kotak: State Kosong (Persis Screenshot) atau Tabel Matriks */}
        {grandTotalSetoran === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            {/* Ikon Clipboard Kartu */}
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
            <div className="flex items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama Kepala Keluarga..."
                  className="pl-9 bg-slate-50 border-slate-200 text-xs rounded-xl h-9 text-slate-900"
                />
              </div>
              <div className="text-xs text-slate-500 font-medium">
                Menampilkan <span className="font-bold text-slate-800">{filteredKkList.length}</span> KK
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
                          const val = months[mNum] || 0
                          totalKk += val
                          return (
                            <TableCell key={mNum} className="text-center p-1.5 font-mono text-[11px]">
                              {val > 0 ? (
                                <span className="inline-block bg-[#EAF7EE] text-[#0D6539] border border-[#B7E4C7] px-1.5 py-0.5 rounded font-bold">
                                  {val >= 1000 ? `${val / 1000}k` : val}
                                </span>
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
                        const val = setoranMap.get('umum')?.[mNum] || 0
                        return (
                          <TableCell key={mNum} className="text-center p-1.5 font-mono text-[11px]">
                            {val > 0 ? (
                              <span className="inline-block bg-[#EAF7EE] text-[#0D6539] border border-[#B7E4C7] px-1.5 py-0.5 rounded font-bold">
                                {val >= 1000 ? `${val / 1000}k` : val}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-extralight">—</span>
                            )}
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-right font-mono font-bold text-slate-900 pr-3">
                        {Object.values(setoranMap.get('umum') || {}).reduce((a, b) => a + b, 0).toLocaleString('id-ID')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
