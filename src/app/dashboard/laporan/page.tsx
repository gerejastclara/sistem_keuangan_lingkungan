'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { JurnalTransaksi, ProfilLingkungan } from '@/lib/types'
import { getAllMasterCOA, MasterCOAItem } from '@/lib/masterCoa'
import { formatRupiah, MONTH_NAMES } from '@/lib/utils'
import { formatNamaLingkungan, getAllMasterLingkungan, findLingkunganByQuery, getLingkunganDbUuid } from '@/lib/constants'
import { getPengurusForLingkungan, PengurusLingkungan } from '@/lib/pengurusData'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Calendar,
  Download,
  Printer,
  FileSpreadsheet,
  CheckCircle2
} from 'lucide-react'

interface PenerimaanGroup {
  groupName?: string
  items: { code: string; name: string }[]
}

interface PengeluaranGroup {
  groupName?: string
  items: { code: string; name: string }[]
}

// Group structure matching Images 2 and 3
const PENERIMAAN_STRUCTURE: PenerimaanGroup[] = [
  {
    groupName: 'Iuran Lingkungan',
    items: [
      { code: '4100', name: 'Iuran Kas Lingkungan' },
      { code: '4110', name: 'Kolekte Ibadat Sabda' },
      { code: '4120', name: 'Sumbangan Dahar Romo' },
      { code: '4200', name: 'Sumbangan ASAK' },
      { code: '4300', name: 'Iuran Dana Kematian / St. Yusuf' },
      { code: '4400', name: 'Kolekte Misa Lingkungan' },
      { code: '4500', name: 'Sumbangan Umat' },
      { code: '4600', name: 'Bantuan Paroki' },
      { code: '4700', name: 'Dana APP' },
      { code: '4800', name: 'Dana Aksi Natal' },
      { code: '4900', name: 'Penerimaan Lainnya' }
    ]
  }
]

const PENGELUARAN_STRUCTURE: PengeluaranGroup[] = [
  {
    groupName: 'Liturgi / Ibadat',
    items: [
      { code: '5100', name: 'Misa' },
      { code: '5110', name: 'Ibadat Sabda' },
      { code: '5120', name: 'Rosario' },
      { code: '5130', name: 'Koor' },
      { code: '5140', name: 'Stipendium / Iura Stolae' }
    ]
  },
  {
    groupName: 'Pewartaan / Katekese',
    items: [
      { code: '5150', name: 'Bina Iman' }
    ]
  },
  {
    groupName: 'Kitab Suci',
    items: [
      { code: '5160', name: 'Pendalaman Kitab Suci' }
    ]
  },
  {
    items: [
      { code: '5170', name: 'Kepemudaan' },
      { code: '5180', name: 'Kerasulan Keluarga' }
    ]
  },
  {
    groupName: 'Panggilan',
    items: [
      { code: '5190', name: 'Pendidikan Calon Imam' }
    ]
  },
  {
    items: [
      { code: '5200', name: 'Rapat / Pertemuan Lingkungan' },
      { code: '5210', name: 'Perayaan (Natal / Paskah / HUT)' },
      { code: '5220', name: 'Inventaris (Pembelian / Pemeliharaan)' },
      { code: '5230', name: 'Administrasi' },
      { code: '5240', name: 'Kegiatan Rohani Lain (retret, rekoleksi, dsb)' }
    ]
  },
  {
    groupName: 'Bantuan Sosial',
    items: [
      { code: '5250', name: 'Internal (umat lingkungan)' },
      { code: '5260', name: 'Eksternal (umat luar lingkungan)' },
      { code: '5270', name: 'Pastoran (dahar Romo)' },
      { code: '5280', name: 'Sumbangan kematian / St. Yusuf' },
      { code: '5290', name: 'Sumbangan Dana ASAK' },
      { code: '5300', name: 'Sumbangan Dana Pastoran' },
      { code: '5310', name: 'Sumbangan Dana APP' },
      { code: '5320', name: 'Sumbangan Dana Aksi Natal' },
      { code: '5340', name: 'Sumbangan Dana PPG' },
      { code: '5350', name: 'Kolekte yg disetor ke Paroki' },
      { code: '5900', name: 'Pengeluaran lainnya' }
    ]
  }
]

export default function LaporanPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [lingkunganId, setLingkunganId] = useState<string | null>(null)
  const [lingkunganName, setLingkunganName] = useState<string>('')
  const [pengurus, setPengurus] = useState<PengurusLingkungan | null>(null)

  // Period: Default to September 2026 as per mockup in Images 2, 3, 4
  const [selectedMonth, setSelectedMonth] = useState<string>('9')
  const [selectedYear, setSelectedYear] = useState<number>(2026)

  const [saldoAwalBank, setSaldoAwalBank] = useState<number>(0)
  const [jurnalList, setJurnalList] = useState<JurnalTransaksi[]>([])
  const [allCoas, setAllCoas] = useState<MasterCOAItem[]>([])

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const { data } = await supabase.auth.getUser()
        const user = data?.user

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

        // Load COA
        const coas = getAllMasterCOA()
        setAllCoas(coas)

        if (targetLingkunganId) {
          // Fetch Saldo Awal & Profil
          const { data: profil } = await supabase
            .from('profil_lingkungan')
            .select('*')
            .eq('lingkungan_id', targetLingkunganId)
            .maybeSingle()

          let sa = Number(profil?.saldo_awal || 0)
          if (sa === 0) {
            const savedManual = localStorage.getItem(`profil_manual_${targetLingkunganId}`)
            if (savedManual) {
              try {
                const parsed = JSON.parse(savedManual)
                if (parsed.saldoAwal) sa = Number(parsed.saldoAwal)
              } catch (e) {}
            }
          }
          setSaldoAwalBank(sa)

          const pInfo = getPengurusForLingkungan(targetLingkunganId, targetLingkunganNama, profil)
          setPengurus(pInfo)

          // Load Journals from DB + localStorage
          let journals: JurnalTransaksi[] = []
          const dbUuid = getLingkunganDbUuid(targetLingkunganId)
          try {
            const { data: dbJournals } = await supabase
              .from('jurnal_transaksi')
              .select('*')
              .or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${targetLingkunganId}`)

            if (dbJournals && dbJournals.length > 0) journals = dbJournals
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

          const map = new Map<string, JurnalTransaksi>()
          journals.forEach(j => map.set(j.id, j))
          localList.forEach(j => {
            if (!map.has(j.id)) map.set(j.id, j)
          })
          journals = Array.from(map.values())

          setJurnalList(journals)
        }
      } catch (err) {
        console.error('Error loading report:', err)
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
    window.addEventListener('coaDataUpdated', handleSync)
    window.addEventListener('pengurusUpdated', handleSync)

    return () => {
      window.removeEventListener('customJournalsUpdated', handleSync)
      window.removeEventListener('storage', handleSync)
      window.removeEventListener('lingkunganChanged', handleSync)
      window.removeEventListener('coaDataUpdated', handleSync)
      window.removeEventListener('pengurusUpdated', handleSync)
    }
  }, [supabase])

  // Filter journals for selected month and year (or all year)
  const isYearly = selectedMonth === 'ALL'
  const filteredJournals = jurnalList.filter((j) => {
    const d = new Date(j.tanggal)
    if (d.getFullYear() !== selectedYear) return false
    if (isYearly) return true
    return d.getMonth() + 1 === parseInt(selectedMonth, 10)
  })

  // Calculate sum for a specific COA code in the period
  const getCoaAmount = (code: string): number => {
    let total = 0
    filteredJournals.forEach((j) => {
      // Check if credit matches (revenue) or debit matches (expense)
      if (j.coa_kredit === code || j.coa_debit === code) {
        total += Number(j.nominal) || 0
      }
    })
    return total
  }

  // Calculate Total Penerimaan (B)
  const totalPenerimaan = filteredJournals
    .filter(j => j.tipe_arus === 'MASUK')
    .reduce((sum, j) => sum + (Number(j.nominal) || 0), 0)

  // Calculate Total Pengeluaran (C)
  const totalPengeluaran = filteredJournals
    .filter(j => j.tipe_arus === 'KELUAR')
    .reduce((sum, j) => sum + (Number(j.nominal) || 0), 0)

  // Kenaikan / Penurunan Kas (B - C)
  const surplusDefisit = totalPenerimaan - totalPengeluaran

  // Saldo Akhir Kas (A + B - C)
  const saldoAkhir = saldoAwalBank + surplusDefisit

  // Format report amount: if 0 display '—', if > 0 format with thousands separator
  const formatCellAmount = (amt: number): string => {
    if (!amt || amt === 0) return '—'
    return amt.toLocaleString('id-ID')
  }

  const monthNum = parseInt(selectedMonth, 10)
  const selectedMonthName = isYearly ? 'Tahun Penuh' : (MONTH_NAMES[monthNum - 1] || '')
  const displayPeriodeTitle = isYearly 
    ? `Periode 1 Tahun Penuh (Januari - Desember ${selectedYear})` 
    : `Periode ${selectedMonthName} ${selectedYear}`
  const tablePeriodHeader = isYearly ? `Tahun ${selectedYear} (Rp)` : `${selectedMonthName} (Rp)`

  // Export to Excel (CSV)
  const handleExportExcel = () => {
    const periodLabel = isYearly ? `1 Tahun Penuh (Januari - Desember ${selectedYear})` : `${selectedMonthName} ${selectedYear}`
    const columnLabel = isYearly ? `Tahun ${selectedYear} (Rp)` : `${selectedMonthName} (Rp)`
    const fileSuffix = isYearly ? `1_Tahun_${selectedYear}` : `${selectedMonthName}_${selectedYear}`

    const rows = [
      ['GEREJA ST CLARA - PAROKI BEKASI UTARA'],
      ['LAPORAN AKTIVITAS'],
      [`Periode ${periodLabel}`],
      [`Lingkungan: ${formatNamaLingkungan(lingkunganName)}`],
      ['(Disajikan dalam Rupiah kecuali dinyatakan lain)'],
      [''],
      ['COA', 'Uraian', columnLabel],
      ['', 'Saldo Awal (A)', saldoAwalBank || 0],
      ['', 'Penerimaan terdiri dari :'],
      ['', '  Iuran Lingkungan']
    ]

    PENERIMAAN_STRUCTURE.forEach(group => {
      group.items.forEach(item => {
        const amt = getCoaAmount(item.code)
        rows.push([item.code, `  ${item.name}`, String(amt || 0)])
      })
    })

    rows.push(['', 'Jumlah Penerimaan (B)', String(totalPenerimaan)])
    rows.push(['', 'Pengeluaran terdiri dari :'])

    PENGELUARAN_STRUCTURE.forEach(group => {
      if (group.groupName) rows.push(['', `  ${group.groupName}`])
      group.items.forEach(item => {
        const amt = getCoaAmount(item.code)
        rows.push([item.code, `  ${item.name}`, String(amt || 0)])
      })
    })

    rows.push(['', 'Jumlah Pengeluaran (C)', String(totalPengeluaran)])
    rows.push(['', 'Kenaikan (Penurunan) Kas (B - C)', String(surplusDefisit)])
    rows.push(['', 'Saldo Akhir Kas (A + B - C)', String(saldoAkhir)])
    rows.push([''])
    rows.push(['', 'Mengetahui,', 'Dibuat Oleh,'])
    rows.push(['', `Ketua: ${pengurus?.ketua_nama || '-'}`, `Bendahara: ${pengurus?.bendahara_nama || '-'}`])

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Laporan_Aktivitas_${formatNamaLingkungan(lingkunganName).replace(/\s+/g, '_')}_${fileSuffix}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Trigger Print / PDF
  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#18539E]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* CSS KHUSUS CETAK RESMI (A4 PRINT / PDF CLEAN) */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* CARD 1: PILIH PERIODE LAPORAN (Persis Gambar 4) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4 no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F0F6FE] text-[#18539E] flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Pilih Periode Laporan</h2>
            <p className="text-xs text-slate-500">Pilih tahun dan bulan yang ingin ditampilkan</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="tahun" className="text-xs font-bold text-slate-700">Tahun</Label>
            <Input
              id="tahun"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10) || 2026)}
              className="bg-white border-slate-300 text-slate-900 font-bold rounded-xl h-11 text-sm focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bulan" className="text-xs font-bold text-slate-700">Periode / Bulan</Label>
            <Select
              value={selectedMonth}
              onValueChange={(val) => setSelectedMonth(val || '9')}
            >
              <SelectTrigger id="bulan" className="bg-white border-slate-300 text-slate-900 font-bold rounded-xl h-11 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 text-slate-900">
                <SelectItem value="ALL" className="font-bold text-[#18539E]">
                  📅 1 Tahun Penuh (Januari - Desember {selectedYear})
                </SelectItem>
                {MONTH_NAMES.map((m, idx) => (
                  <SelectItem key={idx + 1} value={String(idx + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Buttons: Ekspor Excel & Cetak/PDF (Persis Gambar 4) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <Button
            type="button"
            onClick={handleExportExcel}
            className="bg-slate-700 hover:bg-slate-800 text-white font-bold h-11 rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all"
          >
            <Download className="w-4 h-4 text-white" />
            Ekspor Excel
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handlePrint}
            className="bg-white border-slate-300 hover:bg-slate-50 text-slate-800 font-bold h-11 rounded-xl text-xs flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            Cetak / PDF
          </Button>
        </div>
      </div>

      {/* CARD 2: LAPORAN AKTIVITAS SHEET (Persis Gambar 2, 3, 4) */}
      <div
        id="print-area"
        className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6 overflow-hidden"
      >
        {/* Centered Document Header (Persis Gambar 2 & 4) */}
        <div className="text-center space-y-1">
          <div className="text-xs font-bold text-slate-800 tracking-wider uppercase">
            GEREJA ST CLARA - PAROKI BEKASI UTARA
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            LAPORAN AKTIVITAS
          </h1>
          <div className="text-slate-400 text-sm font-semibold">—</div>
          <div className="text-xs font-semibold text-slate-700">
            {displayPeriodeTitle}
          </div>
          <div className="text-[11px] text-slate-500 italic">
            (Disajikan dalam Rupiah kecuali dinyatakan lain)
          </div>
          <div className="text-[11px] text-slate-600 font-semibold pt-1">
            {formatNamaLingkungan(lingkunganName)}
          </div>
        </div>

        {/* Separator Line */}
        <div className="border-t-2 border-slate-800 my-2"></div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-slate-800">
            <thead>
              <tr className="font-bold border-b border-slate-200 text-slate-900">
                <th className="w-20 text-left py-2 font-bold">COA</th>
                <th className="text-left py-2 font-bold">Uraian</th>
                <th className="w-36 text-right py-2 font-bold">{tablePeriodHeader}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* SECTION: SALDO AWAL (Persis Baris Biru Muda Gambar 2) */}
              <tr className="bg-[#EBF2FC] text-[#18539E] font-bold">
                <td className="py-2.5"></td>
                <td className="py-2.5 pl-4 font-extrabold text-slate-900">Saldo Awal (A)</td>
                <td className="py-2.5 text-right font-mono font-bold text-slate-900 pr-2">
                  {saldoAwalBank > 0 ? saldoAwalBank.toLocaleString('id-ID') : '—'}
                </td>
              </tr>

              {/* SECTION: PENERIMAAN TERDIRI DARI (Persis Baris Hijau Muda Gambar 2) */}
              <tr className="bg-[#EAF5ED] text-[#137333] font-extrabold">
                <td className="py-2"></td>
                <td colSpan={2} className="py-2 pl-2">
                  Penerimaan terdiri dari :
                </td>
              </tr>

              {/* Penerimaan Items */}
              {PENERIMAAN_STRUCTURE.map((group, gIdx) => (
                <React.Fragment key={gIdx}>
                  {group.groupName && (
                    <tr>
                      <td></td>
                      <td colSpan={2} className="py-1 pl-6 italic text-slate-600 font-semibold">
                        {group.groupName}
                      </td>
                    </tr>
                  )}
                  {group.items.map((item) => {
                    const amt = getCoaAmount(item.code)
                    return (
                      <tr key={item.code} className="hover:bg-slate-50/60 transition">
                        <td className="py-1 font-mono text-slate-600">{item.code}</td>
                        <td className="py-1 pl-6 text-slate-800">{item.name}</td>
                        <td className="py-1 text-right font-mono pr-2">
                          {formatCellAmount(amt)}
                        </td>
                      </tr>
                    )
                  })}
                </React.Fragment>
              ))}

              {/* Jumlah Penerimaan (B) (Persis Baris Hijau Penutup Gambar 2) */}
              <tr className="bg-[#EAF5ED] text-[#137333] font-black border-t border-b border-emerald-200/80">
                <td className="py-2"></td>
                <td className="py-2 pl-4 text-slate-900 font-extrabold">Jumlah Penerimaan (B)</td>
                <td className="py-2 text-right font-mono font-black text-slate-900 pr-2">
                  {totalPenerimaan > 0 ? totalPenerimaan.toLocaleString('id-ID') : '—'}
                </td>
              </tr>

              {/* SECTION: PENGELUARAN TERDIRI DARI (Persis Baris Krem/Coklat Muda Gambar 3) */}
              <tr className="bg-[#FEF6E7] text-[#7A4B04] font-extrabold">
                <td className="py-2"></td>
                <td colSpan={2} className="py-2 pl-2">
                  Pengeluaran terdiri dari :
                </td>
              </tr>

              {/* Pengeluaran Items */}
              {PENGELUARAN_STRUCTURE.map((group, gIdx) => (
                <React.Fragment key={gIdx}>
                  {group.groupName && (
                    <tr>
                      <td></td>
                      <td colSpan={2} className="py-1 pl-6 italic text-slate-600 font-semibold">
                        {group.groupName}
                      </td>
                    </tr>
                  )}
                  {group.items.map((item) => {
                    const amt = getCoaAmount(item.code)
                    return (
                      <tr key={item.code} className="hover:bg-slate-50/60 transition">
                        <td className="py-1 font-mono text-slate-600">{item.code}</td>
                        <td className="py-1 pl-6 text-slate-800">{item.name}</td>
                        <td className="py-1 text-right font-mono pr-2">
                          {formatCellAmount(amt)}
                        </td>
                      </tr>
                    )
                  })}
                </React.Fragment>
              ))}

              {/* Jumlah Pengeluaran (C) */}
              <tr className="bg-[#FEF6E7] text-[#7A4B04] font-black border-t border-b border-amber-200/80">
                <td className="py-2"></td>
                <td className="py-2 pl-4 text-slate-900 font-extrabold">Jumlah Pengeluaran (C)</td>
                <td className="py-2 text-right font-mono font-black text-slate-900 pr-2">
                  {totalPengeluaran > 0 ? totalPengeluaran.toLocaleString('id-ID') : '—'}
                </td>
              </tr>

              {/* SUMMARY: Kenaikan (Penurunan) Kas (B - C) */}
              <tr className="bg-slate-50 font-bold border-t border-slate-200">
                <td className="py-2"></td>
                <td className="py-2 pl-4 text-slate-900">Kenaikan (Penurunan) Kas (B - C)</td>
                <td className={`py-2 text-right font-mono font-extrabold pr-2 ${surplusDefisit >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
                  {surplusDefisit !== 0 ? surplusDefisit.toLocaleString('id-ID') : '—'}
                </td>
              </tr>

              {/* SUMMARY: Saldo Akhir Kas (A + B - C) */}
              <tr className="bg-[#EBF2FC] text-slate-900 font-black border-t-2 border-b-2 border-slate-300">
                <td className="py-2.5"></td>
                <td className="py-2.5 pl-4 font-black">Saldo Akhir Kas (A + B - C)</td>
                <td className="py-2.5 text-right font-mono font-black text-base pr-2 text-[#18539E]">
                  {saldoAkhir > 0 ? saldoAkhir.toLocaleString('id-ID') : (saldoAkhir === 0 ? '—' : saldoAkhir.toLocaleString('id-ID'))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tanda Tangan Pengurus Lingkungan */}
        <div className="pt-10 grid grid-cols-3 gap-4 text-center text-xs text-slate-700">
          <div className="space-y-16">
            <div>Ketua Lingkungan</div>
            <div className={`border-t border-slate-300 pt-1 font-bold ${
              !pengurus?.ketua_nama || pengurus.ketua_nama === 'Susunan pengurus belum ditentukan'
                ? 'text-slate-400 italic text-[11px]'
                : 'text-slate-900'
            }`}>
              {pengurus?.ketua_nama && pengurus.ketua_nama !== 'Susunan pengurus belum ditentukan'
                ? pengurus.ketua_nama
                : 'Susunan pengurus belum ditentukan'}
            </div>
          </div>

          <div className="space-y-16">
            <div>Sekretaris Lingkungan</div>
            <div className={`border-t border-slate-300 pt-1 font-bold ${
              !pengurus?.sekretaris_nama || pengurus.sekretaris_nama === 'Susunan pengurus belum ditentukan'
                ? 'text-slate-400 italic text-[11px]'
                : 'text-slate-900'
            }`}>
              {pengurus?.sekretaris_nama && pengurus.sekretaris_nama !== 'Susunan pengurus belum ditentukan'
                ? pengurus.sekretaris_nama
                : 'Susunan pengurus belum ditentukan'}
            </div>
          </div>

          <div className="space-y-16">
            <div>Bendahara Lingkungan</div>
            <div className={`border-t border-slate-300 pt-1 font-bold ${
              !pengurus?.bendahara_nama || pengurus.bendahara_nama === 'Susunan pengurus belum ditentukan'
                ? 'text-slate-400 italic text-[11px]'
                : 'text-slate-900'
            }`}>
              {pengurus?.bendahara_nama && pengurus.bendahara_nama !== 'Susunan pengurus belum ditentukan'
                ? pengurus.bendahara_nama
                : 'Susunan pengurus belum ditentukan'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
