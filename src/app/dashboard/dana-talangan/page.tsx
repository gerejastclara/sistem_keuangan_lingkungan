'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { UserProfile, JurnalTransaksi, KepalaKeluarga } from '@/lib/types'
import { formatRupiah, formatDateIndo, MONTH_NAMES } from '@/lib/utils'
import { formatNamaLingkungan, getAllMasterLingkungan, findLingkunganByQuery, getLingkunganDbUuid } from '@/lib/constants'
import { reconcileJournals } from '@/lib/journalSync'
import { getPengurusForLingkungan, PengurusLingkungan } from '@/lib/pengurusData'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  BookOpen,
  Calendar,
  Download,
  Printer,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Filter
} from 'lucide-react'

interface TalanganMutasiItem {
  id: string
  tanggal: string
  no_bukti: string
  akun_id: string
  nama_akun: string
  keterangan: string
  nama_kk?: string
  sumber_kas: 'KAS' | 'BANK'
  debit: number
  kredit: number
  saldo_setelah: number
}

export default function BukuBesarDanaTalanganPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [lingkunganId, setLingkunganId] = useState<string | null>(null)
  const [lingkunganName, setLingkunganName] = useState('')
  const [pengurus, setPengurus] = useState<PengurusLingkungan | null>(null)

  const [jurnalList, setJurnalList] = useState<JurnalTransaksi[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Filter State
  const [selectedAkun, setSelectedAkun] = useState<'ALL' | '1300' | '1400'>('ALL')
  const [selectedMonth, setSelectedMonth] = useState<number>(0) // 0 = Semua Bulan
  const [selectedYear, setSelectedYear] = useState<number>(2026)

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
          // Load profil for pengurus
          const { data: profil } = await supabase
            .from('profil_lingkungan')
            .select('*')
            .eq('lingkungan_id', targetLingkunganId)
            .maybeSingle()

          const pengurusInfo = getPengurusForLingkungan(targetLingkunganId, targetLingkunganNama, profil)
          setPengurus(pengurusInfo)

          // Load Journals
          let list: JurnalTransaksi[] = []
          const dbUuid = getLingkunganDbUuid(targetLingkunganId)
          let supabaseSuccess = false
          try {
            const { data: journals, error } = await supabase
              .from('jurnal_transaksi')
              .select('*, kepala_keluarga:kk_id(nama_kk)')
              .or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${targetLingkunganId}`)
              .order('tanggal', { ascending: true })

            if (!error && Array.isArray(journals)) {
              supabaseSuccess = true
              list = journals
            }
          } catch (e) {}

          list = reconcileJournals(list, dbUuid, targetLingkunganId, supabaseSuccess).sort(
            (a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime()
          )

          setJurnalList(list)
        }
      } catch (err) {
        console.error('Error loading buku besar dana talangan:', err)
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

  // Filter journals that touch Dana Talangan accounts (1300 and 1400)
  // Akun 1300: Dana talangan Dahar Romo
  // Akun 1400: Dana talangan Santo Yusuf
  const talanganRawJournals = jurnalList.filter((j) => {
    const touches1300 = j.coa_debit === '1300' || j.coa_kredit === '1300'
    const touches1400 = j.coa_debit === '1400' || j.coa_kredit === '1400'
    const touchesTalanganInDesc = (j.keterangan || '').toLowerCase().includes('talangan')

    return touches1300 || touches1400 || touchesTalanganInDesc
  })

  // Build sequential ledger mutasi
  let runningBalance = 0
  const allMutasiItems: TalanganMutasiItem[] = []

  talanganRawJournals.forEach((j, idx) => {
    const is1300 = j.coa_debit === '1300' || j.coa_kredit === '1300' || (j.keterangan || '').toLowerCase().includes('dahar romo')
    const akunId = is1300 ? '1300' : '1400'
    const namaAkun = is1300 ? 'Dana talangan Dahar Romo' : 'Dana talangan Santo Yusuf'

    // Debit pada akun talangan = uang keluar dari kas lingkungan untuk menalangi (saldo talangan bertambah)
    // Kredit pada akun talangan = uang masuk ke kas lingkungan mengganti talangan (saldo talangan berkurang)
    let debit = 0
    let kredit = 0

    if (j.coa_debit === akunId || j.tipe_arus === 'KELUAR') {
      debit = Number(j.nominal) || 0
      runningBalance += debit
    } else if (j.coa_kredit === akunId || j.tipe_arus === 'MASUK') {
      kredit = Number(j.nominal) || 0
      runningBalance -= kredit
    }

    // Format No Bukti
    const isKas = j.sumber_kas === 'KAS' || j.coa_debit === '1200' || j.coa_kredit === '1200'
    const prefix = debit > 0 ? (isKas ? 'BKK' : 'BBK') : (isKas ? 'BKM' : 'BBM')
    const d = new Date(j.tanggal)
    const mStr = String(isNaN(d.getMonth()) ? 9 : d.getMonth() + 1).padStart(2, '0')
    const yStr = isNaN(d.getFullYear()) ? '2026' : String(d.getFullYear())
    const defaultNoBukti = `${prefix}/${String(idx + 1).padStart(3, '0')}/${mStr}/${yStr}`
    const finalNoBukti = j.no_bukti && j.no_bukti.trim() ? j.no_bukti : defaultNoBukti

    allMutasiItems.push({
      id: j.id,
      tanggal: j.tanggal,
      no_bukti: finalNoBukti,
      akun_id: akunId,
      nama_akun: namaAkun,
      keterangan: j.keterangan || (debit > 0 ? 'Penyaluran Dana Talangan' : 'Pelunasan Dana Talangan'),
      nama_kk: j.kepala_keluarga?.nama_kk,
      sumber_kas: isKas ? 'KAS' : 'BANK',
      debit: debit,
      kredit: kredit,
      saldo_setelah: runningBalance
    })
  })

  // Filter based on selected akun, month, year, search
  const filteredMutasiItems = allMutasiItems.filter((item) => {
    const d = new Date(item.tanggal)
    const matchesYear = d.getFullYear() === selectedYear
    const matchesMonth = selectedMonth === 0 ? true : d.getMonth() + 1 === selectedMonth
    const matchesAkun = selectedAkun === 'ALL' ? true : item.akun_id === selectedAkun
    const matchesSearch =
      searchQuery === '' ||
      item.keterangan.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.no_bukti.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.nama_kk && item.nama_kk.toLowerCase().includes(searchQuery.toLowerCase()))

    return matchesYear && matchesMonth && matchesAkun && matchesSearch
  })

  // Summary Metrics
  const totalDebit = filteredMutasiItems.reduce((acc, curr) => acc + curr.debit, 0)
  const totalKredit = filteredMutasiItems.reduce((acc, curr) => acc + curr.kredit, 0)
  const saldoOutstanding = totalDebit - totalKredit

  const handlePrint = () => {
    window.print()
  }

  const handleExportCsv = () => {
    const headers = ['No', 'Tanggal', 'No. Bukti', 'Kode COA', 'Nama Akun', 'Keterangan', 'Umat / KK', 'Media Kas', 'Debit (Rp)', 'Kredit (Rp)', 'Saldo (Rp)']
    const rows = filteredMutasiItems.map((item, idx) => [
      idx + 1,
      item.tanggal,
      `"${item.no_bukti}"`,
      item.akun_id,
      `"${item.nama_akun}"`,
      `"${item.keterangan.replace(/"/g, '""')}"`,
      `"${item.nama_kk || 'Umum'}"`,
      item.sumber_kas,
      item.debit,
      item.kredit,
      item.saldo_setelah
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' +
      [`BUKU BESAR DANA TALANGAN - ${formatNamaLingkungan(lingkunganName || 'Lingkungan')}`,
       `Tahun: ${selectedYear} - Bulan: ${selectedMonth === 0 ? 'Semua Bulan' : MONTH_NAMES[selectedMonth - 1]}`,
       ''].join('\n') + '\n' +
      headers.join(',') + '\n' +
      rows.map(r => r.join(',')).join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Buku_Besar_Dana_Talangan_${selectedYear}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* HEADER MODUL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight font-serif">
              Buku Besar Dana Talangan
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Buku besar khusus pencatatan dana talangan St. Yusuf (COA 1400) dan Dahar Romo (COA 1300) — {formatNamaLingkungan(lingkunganName)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleExportCsv}
            className="border-slate-300 text-slate-700 hover:bg-slate-50 font-bold rounded-xl h-10 px-3.5 text-xs flex items-center gap-1.5 shadow-2xs"
          >
            <Download className="w-4 h-4 text-slate-600" />
            Export CSV
          </Button>
          <Button
            type="button"
            onClick={handlePrint}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl h-10 px-4 text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-white" />
            Cetak PDF (Print)
          </Button>
        </div>
      </div>

      {/* 3 SUMMARY METRIC BOXES */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:hidden">
        {/* Box 1: Total Ditalangkan (Debit) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Dana Ditalangkan (Debit)</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-2 font-mono">
            {formatRupiah(totalDebit)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Uang keluar lingkungan untuk talangan</p>
        </div>

        {/* Box 2: Total Penggantian (Kredit) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Penggantian Masuk (Kredit)</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-2 font-mono">
            {formatRupiah(totalKredit)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Dana talangan yang telah diganti/dilunasi</p>
        </div>

        {/* Box 3: Saldo Belum Terganti (Outstanding) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Sisa Talangan Belum Terganti</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-indigo-900 mt-2 font-mono">
            {formatRupiah(saldoOutstanding)}
          </div>
          <p className="text-[11px] text-indigo-600 font-semibold mt-1">
            {saldoOutstanding > 0 ? 'Masih ada dana talangan aktif' : 'Semua talangan lunas'}
          </p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          {/* Filter Akun Talangan */}
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700">Pilih Akun Talangan</Label>
            <Select value={selectedAkun} onValueChange={(val: any) => setSelectedAkun(val)}>
              <SelectTrigger className="bg-white border-slate-300 text-slate-900 font-bold rounded-xl h-10 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 text-slate-900">
                <SelectItem value="ALL">Semua Akun Talangan (1300 & 1400)</SelectItem>
                <SelectItem value="1300">1300 — Dana talangan Dahar Romo</SelectItem>
                <SelectItem value="1400">1400 — Dana talangan Santo Yusuf</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filter Bulan */}
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700">Bulan Transaksi</Label>
            <Select value={String(selectedMonth)} onValueChange={(val) => setSelectedMonth(parseInt(val || '0', 10))}>
              <SelectTrigger className="bg-white border-slate-300 text-slate-900 font-bold rounded-xl h-10 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 text-slate-900">
                <SelectItem value="0">Semua Bulan ({selectedYear})</SelectItem>
                {MONTH_NAMES.map((m, idx) => (
                  <SelectItem key={idx + 1} value={String(idx + 1)}>
                    {m} {selectedYear}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter Tahun */}
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700">Tahun Buku</Label>
            <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(parseInt(val || '2026', 10))}>
              <SelectTrigger className="bg-white border-slate-300 text-slate-900 font-bold rounded-xl h-10 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 text-slate-900">
                {[2026, 2025, 2024].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search Box */}
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700">Pencarian</Label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari no. bukti, umat, ket..."
                className="pl-9 bg-slate-50 border-slate-200 text-xs text-slate-900 rounded-xl h-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* PRINT HEADER ONLY VISIBLE DURING PRINT */}
      <div className="hidden print:block text-center pb-4 border-b border-slate-300 mb-6">
        <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
          PAROKI BEKASI UTARA - GEREJA SANTA CLARA
        </h2>
        <h3 className="text-base font-bold text-slate-800">
          BUKU BESAR DANA TALANGAN (COA 1300 & 1400)
        </h3>
        <p className="text-xs text-slate-600 mt-1">
          Lingkungan: {formatNamaLingkungan(lingkunganName)} | Tahun: {selectedYear} | Periode: {selectedMonth === 0 ? 'Semua Bulan' : MONTH_NAMES[selectedMonth - 1]}
        </p>
      </div>

      {/* TABEL BUKU BESAR MUTASI */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Daftar Mutasi Transaksi Talangan</h3>
              <p className="text-xs text-slate-400">
                Menampilkan {filteredMutasiItems.length} transaksi pembukuan dana talangan
              </p>
            </div>
          </div>

          <div className="text-xs font-mono font-bold px-3 py-1 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
            Saldo Normal: DEBIT (Kas & Setara Kas)
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80 text-xs font-bold text-slate-700 border-b border-slate-200">
              <TableRow>
                <TableHead className="w-32 text-slate-800 font-bold">No. Bukti / Ref</TableHead>
                <TableHead className="w-24 text-slate-800 font-bold">Tanggal</TableHead>
                <TableHead className="w-32 text-slate-800 font-bold">Akun Talangan</TableHead>
                <TableHead className="text-slate-800 font-bold">Keterangan / Umat Terkait</TableHead>
                <TableHead className="w-20 text-center text-slate-800 font-bold">Media</TableHead>
                <TableHead className="w-32 text-right text-rose-700 font-bold">Ditalangkan (D)</TableHead>
                <TableHead className="w-32 text-right text-emerald-700 font-bold">Diganti (K)</TableHead>
                <TableHead className="w-32 text-right text-slate-900 font-bold">Saldo Akhir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 text-xs">
              {filteredMutasiItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                    <div className="text-sm font-medium text-slate-600">Belum ada transaksi dana talangan</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Catat transaksi pengeluaran atau penerimaan menggunakan COA 1300 / 1400 di menu Jurnal Transaksi.
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredMutasiItems.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/80 transition">
                    <TableCell className="font-mono whitespace-nowrap">
                      <span className="font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                        {item.no_bukti}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-slate-700 whitespace-nowrap">
                      {formatDateIndo(item.tanggal)}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-bold text-slate-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-[11px]">
                        {item.akun_id}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{item.keterangan}</div>
                      {item.nama_kk && (
                        <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                          Umat: <span className="font-medium text-slate-700">{item.nama_kk}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                        {item.sumber_kas}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-rose-700">
                      {item.debit > 0 ? formatRupiah(item.debit) : <span className="text-slate-300 font-normal">—</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-emerald-700">
                      {item.kredit > 0 ? formatRupiah(item.kredit) : <span className="text-slate-300 font-normal">—</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-slate-900">
                      {formatRupiah(item.saldo_setelah)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Tanda Tangan Cetak PDF */}
        <div className="hidden print:grid grid-cols-2 gap-8 pt-12 pb-6 px-6 text-xs text-center border-t border-slate-200 mt-8">
          <div>
            <div className="text-slate-600">Mengetahui,</div>
            <div className="font-bold text-slate-900 mt-1">Ketua Lingkungan</div>
            <div className="h-16"></div>
            <div className="font-bold underline text-slate-900">
              ({pengurus?.ketua_nama || '....................................'})
            </div>
          </div>
          <div>
            <div className="text-slate-600">Bekasi, ........................ 2026</div>
            <div className="font-bold text-slate-900 mt-1">Bendahara Lingkungan</div>
            <div className="h-16"></div>
            <div className="font-bold underline text-slate-900">
              ({pengurus?.bendahara_nama || '....................................'})
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
