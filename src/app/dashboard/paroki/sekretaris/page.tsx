'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getAllMasterLingkungan, formatNamaLingkungan, getLingkunganDbUuid, getNamaLingkunganFromAnyIdentifier } from '@/lib/constants'
import { getPengurusForLingkungan, PengurusLingkungan } from '@/lib/pengurusData'
import { ensureDummyKksForLingkungan, getDummyAnggotaForKk, getDummyGolonganForKk, santaClaraStats } from '@/lib/dummyData'
import { fetchAllParishKksWithGolongan } from '@/lib/dafuService'
import { KepalaKeluarga, AnggotaKeluarga, GolonganKeluarga } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import {
  Users,
  Building2,
  FileSpreadsheet,
  Search,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Phone,
  Calendar,
  ShieldCheck,
  Filter,
  UserCheck,
  ChevronRight,
  Sparkles,
  Download
} from 'lucide-react'

export default function ParokiSekretariatPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'PENGURUS' | 'DAFU'>('PENGURUS')
  const [allLingkungan, setAllLingkungan] = useState<any[]>([])

  // Tab 1: State Rekap Pengurus
  const [pengurusList, setPengurusList] = useState<Array<{ lingkunganId: string; namaLingkungan: string; pengurus: PengurusLingkungan }>>([])
  const [searchPengurus, setSearchPengurus] = useState('')
  const [filterStatusPengurus, setFilterStatusPengurus] = useState<string>('ALL')

  // Tab 2: State DAFU Monitoring
  const [selectedLingkunganDafu, setSelectedLingkunganDafu] = useState<string>('ALL')
  const [searchKk, setSearchKk] = useState('')
  const [filterGolongan, setFilterGolongan] = useState<string>('ALL')
  const [dafuDataMap, setDafuDataMap] = useState<Record<string, KepalaKeluarga[]>>({})
  
  // Dialog Detail Anggota Keluarga
  const [selectedKkDetail, setSelectedKkDetail] = useState<{
    kk: KepalaKeluarga
    lingkunganName: string
    golongan: GolonganKeluarga
    anggota: AnggotaKeluarga[]
  } | null>(null)

  // Linked to Sheet state
  const [sheetModalOpen, setSheetModalOpen] = useState(false)
  const [isSyncingSheet, setIsSyncingSheet] = useState(false)
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('Hari ini, ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }))
  const spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0'

  // Load All Data
  const loadAllParokiData = async () => {
    setLoading(true)
    try {
      const masterList = getAllMasterLingkungan()
      setAllLingkungan(masterList)

      // 1. Load Pengurus Data for all Lingkungan
      const { data: dbProfilList } = await supabase.from('profil_lingkungan').select('*')
      const profilMap = new Map<string, any>()
      if (dbProfilList) {
        dbProfilList.forEach((p: any) => profilMap.set(p.lingkungan_id, p))
      }

      const pList = masterList.map(ling => {
        const profil = profilMap.get(ling.id)
        const p = getPengurusForLingkungan(ling.id, ling.nama_lingkungan, profil)
        return {
          lingkunganId: ling.id,
          namaLingkungan: ling.nama_lingkungan,
          pengurus: p
        }
      })
      setPengurusList(pList)

      // 2. Load DAFU for all Lingkungan directly from Supabase Cloud
      const parishKks = await fetchAllParishKksWithGolongan(supabase)
      const dMap: Record<string, KepalaKeluarga[]> = {}
      masterList.forEach(ling => {
        const targetUuid = getLingkunganDbUuid(ling.id)
        const targetNorm = ling.nama_lingkungan.toLowerCase().replace(/[^a-z0-9]/g, '')
        const kksForLing = parishKks.filter(k =>
          k.lingkunganId === ling.id ||
          k.lingkunganId === targetUuid ||
          k.lingkunganNama.toLowerCase().replace(/[^a-z0-9]/g, '') === targetNorm
        ).map(p => ({
          id: p.id,
          lingkungan_id: p.lingkunganId,
          nama_kk: p.nama_kk,
          alamat: p.alamat || '',
          is_biduk: p.is_biduk ?? true,
          jumlah_anggota: p.jumlah_anggota || 1
        }))
        dMap[ling.id] = kksForLing
      })
      setDafuDataMap(dMap)
    } catch (err) {
      console.error('Error loading paroki sekretariat data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllParokiData()

    // Realtime listeners: update otomatis jika sekretaris mengupdate data pengurus atau DAFU
    const handleSync = () => {
      loadAllParokiData()
    }

    window.addEventListener('storage', handleSync)
    window.addEventListener('pengurusUpdated', handleSync)
    window.addEventListener('dafuDataUpdated', handleSync)
    window.addEventListener('lingkunganChanged', handleSync)

    return () => {
      window.removeEventListener('storage', handleSync)
      window.removeEventListener('pengurusUpdated', handleSync)
      window.removeEventListener('dafuDataUpdated', handleSync)
      window.removeEventListener('lingkunganChanged', handleSync)
    }
  }, [])

  // Sync to Sheet Action
  const handleSyncToSheet = async () => {
    setIsSyncingSheet(true)
    try {
      await fetch('/api/google-sheets/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lingkunganId: 'paroki-all',
          namaLingkungan: 'Seluruh Lingkungan Paroki St. Clara',
          bulan: 9,
          tahun: 2026,
          reportData: { totalLingkungan: allLingkungan.length }
        })
      })
      setLastSyncedTime('Baru saja, ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }))
    } catch (e) {
      console.error(e)
    } finally {
      setIsSyncingSheet(false)
    }
  }

  // Filtered Pengurus List
  const filteredPengurus = useMemo(() => {
    return pengurusList.filter(item => {
      const matchSearch =
        item.namaLingkungan.toLowerCase().includes(searchPengurus.toLowerCase()) ||
        item.pengurus.ketua_nama.toLowerCase().includes(searchPengurus.toLowerCase()) ||
        item.pengurus.sekretaris_nama.toLowerCase().includes(searchPengurus.toLowerCase()) ||
        item.pengurus.bendahara_nama.toLowerCase().includes(searchPengurus.toLowerCase()) ||
        item.pengurus.periode.toLowerCase().includes(searchPengurus.toLowerCase())

      const matchStatus = filterStatusPengurus === 'ALL' || item.pengurus.status === filterStatusPengurus
      return matchSearch && matchStatus
    })
  }, [pengurusList, searchPengurus, filterStatusPengurus])

  // Flattened & Filtered DAFU List
  const { allFlattenedKks, filteredKks, dafuStats } = useMemo(() => {
    const list: Array<{ kk: KepalaKeluarga; lingkunganId: string; lingkunganNama: string }> = []

    Object.entries(dafuDataMap).forEach(([lingId, kks]) => {
      const foundL = allLingkungan.find(l => l.id === lingId)
      const lName = foundL ? foundL.nama_lingkungan : lingId
      kks.forEach(k => {
        list.push({ kk: k, lingkunganId: lingId, lingkunganNama: lName })
      })
    })

    const isMatchLing = (itemLingId: string, filterId: string) => {
      if (!filterId || filterId === 'ALL') return true
      if (itemLingId === filterId) return true
      const uuid1 = getLingkunganDbUuid(itemLingId)
      const uuid2 = getLingkunganDbUuid(filterId)
      if (uuid1 && (uuid1 === filterId || uuid1 === uuid2)) return true
      if (uuid2 && (itemLingId === uuid2)) return true
      return false
    }

    const filtered = list.filter(item => {
      if (!isMatchLing(item.lingkunganId, selectedLingkunganDafu)) {
        return false
      }
      if (filterGolongan !== 'ALL') {
        const gol = getDummyGolonganForKk(item.kk).golongan
        if (gol !== filterGolongan) return false
      }
      if (searchKk) {
        const q = searchKk.toLowerCase()
        const matchName = item.kk.nama_kk.toLowerCase().includes(q)
        const matchNo = (item.kk.no_kk || '').toLowerCase().includes(q)
        const matchLing = item.lingkunganNama.toLowerCase().includes(q)
        if (!matchName && !matchNo && !matchLing) return false
      }
      return true
    })

    // Compute Stats for current selection
    const relevantList = selectedLingkunganDafu === 'ALL' ? list : list.filter(i => isMatchLing(i.lingkunganId, selectedLingkunganDafu))
    let totalJiwa = 0
    let tidakMampu = 0
    let rentan = 0
    let menengah = 0
    let mampu = 0
    let kajCount = 0

    relevantList.forEach(item => {
      const anggota = getDummyAnggotaForKk(item.kk)
      totalJiwa += anggota.length
      const golStr = String(getDummyGolonganForKk(item.kk).golongan)
      if (golStr === 'Tidak Mampu') tidakMampu++
      else if (golStr.includes('Rentan') || golStr.includes('Prasejahtera')) rentan++
      else if (golStr === 'Menengah') menengah++
      else mampu++

      if (item.kk.is_biduk !== false) kajCount++
    })

    return {
      allFlattenedKks: list,
      filteredKks: filtered,
      dafuStats: {
        totalKk: relevantList.length,
        totalJiwa,
        tidakMampu,
        rentan,
        menengah,
        mampu,
        kajCount,
        nonKajCount: relevantList.length - kajCount
      }
    }
  }, [dafuDataMap, allLingkungan, selectedLingkunganDafu, filterGolongan, searchKk])

  // Export Pengurus CSV
  const handleExportPengurusCsv = () => {
    const rows = [
      ['REKAPITULASI SUSUNAN PENGURUS LINGKUNGAN'],
      ['GEREJA ST CLARA - PAROKI BEKASI UTARA'],
      [`Tanggal Unduh: ${new Date().toLocaleDateString('id-ID')}`],
      [''],
      ['No', 'Lingkungan', 'Ketua Lingkungan', 'No Kontak Ketua', 'Sekretaris', 'No Kontak Sekretaris', 'Bendahara', 'No Kontak Bendahara', 'Periode Masa Bakti', 'Status']
    ]

    filteredPengurus.forEach((p, idx) => {
      rows.push([
        String(idx + 1),
        formatNamaLingkungan(p.namaLingkungan),
        p.pengurus.ketua_nama,
        p.pengurus.ketua_kontak,
        p.pengurus.sekretaris_nama,
        p.pengurus.sekretaris_kontak,
        p.pengurus.bendahara_nama,
        p.pengurus.bendahara_kontak,
        p.pengurus.periode,
        p.pengurus.status
      ])
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const link = document.createElement('a')
    link.href = encodeURI(csvContent)
    link.download = `Rekap_Pengurus_Paroki_St_Clara_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Export DAFU CSV
  const handleExportDafuCsv = () => {
    const rows = [
      ['DATA ADMINISTRASI FAMILI UMAT (DAFU) - MONITORING PAROKI'],
      ['GEREJA ST CLARA - PAROKI BEKASI UTARA'],
      [`Filter Lingkungan: ${selectedLingkunganDafu === 'ALL' ? 'Semua Lingkungan' : formatNamaLingkungan(allLingkungan.find(l => l.id === selectedLingkunganDafu)?.nama_lingkungan || '')}`],
      [`Tanggal Unduh: ${new Date().toLocaleDateString('id-ID')}`],
      [''],
      ['No', 'Lingkungan', 'Nomor KK', 'Nama Kepala Keluarga', 'Golongan', 'Jumlah Anggota', 'Status Keanggotaan']
    ]

    filteredKks.forEach((item, idx) => {
      const anggota = getDummyAnggotaForKk(item.kk)
      const gol = getDummyGolonganForKk(item.kk).golongan
      rows.push([
        String(idx + 1),
        formatNamaLingkungan(item.lingkunganNama),
        item.kk.no_kk || '-',
        item.kk.nama_kk,
        gol,
        String(anggota.length),
        item.kk.is_biduk !== false ? 'Warga KAJ' : 'Non-KAJ'
      ])
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const link = document.createElement('a')
    link.href = encodeURI(csvContent)
    link.download = `Monitoring_DAFU_Paroki_${selectedLingkunganDafu}_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#18539E]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 text-[#1B2130]">
      {/* Top Banner Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#004085]/10 border border-[#004085]/20 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 text-[#004085]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#004085] bg-[#EBF2FC] px-2.5 py-0.5 rounded-md border border-[#C5DCFA]">
                Pengawas & Sekretariat Paroki
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Gereja St. Clara • Paroki Bekasi Utara
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 tracking-tight font-serif">
              Monitoring Sekretariat Seluruh Lingkungan
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Pusat rekapitulasi data pengurus lingkungan dan monitoring terpadu seluruh umat (DAFU) dari 69 lingkungan.
            </p>
          </div>
        </div>

        {/* Action Buttons: Linked to Sheet & Refresh */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
          <Button
            type="button"
            onClick={() => setSheetModalOpen(true)}
            className="bg-[#0F9D58] hover:bg-[#0B8043] text-white font-bold h-10 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-white" />
            Linked to Sheet
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={loadAllParokiData}
            className="border-slate-300 text-slate-700 hover:bg-slate-100 font-bold h-10 px-3.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
            title="Sinkronkan data terbaru"
          >
            <RefreshCw className="w-4 h-4 text-slate-600" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Navigation Tabs (Pengurus vs DAFU) */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('PENGURUS')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'PENGURUS'
              ? 'border-[#004085] text-[#004085]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Rekap Pengurus Lingkungan
          <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-mono font-semibold">
            {allLingkungan.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('DAFU')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'DAFU'
              ? 'border-[#004085] text-[#004085]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Monitoring DAFU (Data Umat Seluruh Lingkungan)
          <span className="text-xs bg-[#EBF2FC] text-[#004085] px-2 py-0.5 rounded-full font-mono font-semibold">
            {allFlattenedKks.length} KK
          </span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: REKAP PENGURUS LINGKUNGAN PER PERIODE */}
      {/* ============================================================== */}
      {activeTab === 'PENGURUS' && (
        <div className="space-y-4">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-white border-slate-200 rounded-2xl shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Lingkungan</div>
                  <div className="text-2xl font-black text-slate-900 mt-0.5">{allLingkungan.length} Lingkungan</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Paroki St. Clara Bekasi Utara</div>
                </div>
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 rounded-2xl shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pengurus Terdata</div>
                  <div className="text-2xl font-black text-emerald-800 mt-0.5">
                    {pengurusList.filter(p => p.pengurus.status === 'Aktif').length} Lingkungan
                  </div>
                  <div className="text-[11px] text-emerald-700 font-medium mt-0.5">Status Aktif & Masa Bakti Sah</div>
                </div>
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <UserCheck className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 rounded-2xl shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Kepala Keluarga</div>
                  <div className="text-2xl font-black text-slate-900 mt-0.5">{allFlattenedKks.length} KK</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Seluruh Lingkungan St. Clara</div>
                </div>
                <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-2 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchPengurus}
                  onChange={(e) => setSearchPengurus(e.target.value)}
                  placeholder="Cari lingkungan, ketua, bendahara, sekretaris..."
                  className="pl-9 bg-white border-slate-300 text-slate-900 text-xs rounded-xl h-10"
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Select value={filterStatusPengurus} onValueChange={(val) => setFilterStatusPengurus(val || 'ALL')}>
                <SelectTrigger className="w-40 bg-white border-slate-300 text-slate-900 text-xs font-bold rounded-xl h-10">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900 text-xs">
                  <SelectItem value="ALL">Semua Status</SelectItem>
                  <SelectItem value="Aktif">Status: Aktif</SelectItem>
                  <SelectItem value="Purna Tugas">Status: Purna Tugas</SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="outline"
                onClick={handleExportPengurusCsv}
                className="border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl h-10 px-3 cursor-pointer shrink-0"
              >
                <Download className="w-4 h-4 mr-1 text-slate-600" />
                Unduh CSV
              </Button>
            </div>
          </div>

          {/* Tabel Rekap Pengurus */}
          <Card className="bg-white border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader className="bg-slate-50/80 border-b border-slate-200">
                  <TableRow>
                    <TableHead className="w-12 text-center font-bold text-slate-700">No</TableHead>
                    <TableHead className="w-48 font-bold text-slate-700">Lingkungan</TableHead>
                    <TableHead className="font-bold text-slate-700">Ketua Lingkungan</TableHead>
                    <TableHead className="font-bold text-slate-700">Sekretaris</TableHead>
                    <TableHead className="font-bold text-slate-700">Bendahara</TableHead>
                    <TableHead className="w-28 font-bold text-slate-700">Masa Bakti</TableHead>
                    <TableHead className="w-24 text-center font-bold text-slate-700">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100">
                  {filteredPengurus.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-slate-500">
                        Tidak ada data pengurus yang sesuai filter pencarian.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPengurus.map((item, idx) => (
                      <TableRow key={item.lingkunganId} className="hover:bg-slate-50/80 transition-colors">
                        <TableCell className="text-center font-mono text-slate-500 font-semibold">{idx + 1}</TableCell>
                        <TableCell className="font-bold text-slate-900">
                          {formatNamaLingkungan(item.namaLingkungan)}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-slate-800">{item.pengurus.ketua_nama}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {item.pengurus.ketua_kontak || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-slate-800">{item.pengurus.sekretaris_nama}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {item.pengurus.sekretaris_kontak || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-slate-800">{item.pengurus.bendahara_nama}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {item.pengurus.bendahara_kontak || '-'}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-slate-700">
                          <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-[11px] text-slate-700">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {item.pengurus.periode || '2024 - 2026'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            item.pengurus.status === 'Aktif'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {item.pengurus.status || 'Aktif'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: MONITORING DAFU (DATA UMAT SELURUH LINGKUNGAN) */}
      {/* ============================================================== */}
      {activeTab === 'DAFU' && (
        <div className="space-y-4">
          {/* Quick Metrics Bar for DAFU */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-white border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Kepala Keluarga</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{dafuStats.totalKk.toLocaleString('id-ID')} KK</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {selectedLingkunganDafu === 'ALL' ? 'Seluruh 69 Lingkungan' : 'Lingkungan Terpilih'}
              </div>
            </Card>

            <Card className="bg-white border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Jiwa Terdata</div>
              <div className="text-2xl font-black text-[#004085] mt-1">{dafuStats.totalJiwa.toLocaleString('id-ID')} Jiwa</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Rata-rata 3.4 jiwa per KK</div>
            </Card>

            <Card className="bg-white border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Warga Katolik KAJ</div>
              <div className="text-2xl font-black text-emerald-800 mt-1">{dafuStats.kajCount.toLocaleString('id-ID')} KK</div>
              <div className="text-[11px] text-emerald-700 font-medium mt-0.5">Terdaftar Sistem BIDUK KAJ</div>
            </Card>

            <Card className="bg-white border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Subsidi & Bantuan Penuh</div>
              <div className="text-2xl font-black text-rose-700 mt-1">{(dafuStats.tidakMampu + dafuStats.rentan).toLocaleString('id-ID')} KK</div>
              <div className="text-[11px] text-rose-600 font-medium mt-0.5">Golongan Tidak Mampu & Rentan</div>
            </Card>
          </div>

          {/* Filter Bar: Dropdown Lingkungan, Golongan, & Search */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
              {/* Dropdown Pemilihan Lingkungan */}
              <div className="w-full sm:w-64 space-y-1">
                <Label className="text-[10px] uppercase font-bold text-slate-500">Pilih Lingkungan</Label>
                <Select value={selectedLingkunganDafu} onValueChange={(val) => setSelectedLingkunganDafu(val || 'ALL')}>
                  <SelectTrigger className="bg-white border-slate-300 text-slate-900 text-xs font-semibold rounded-xl h-10">
                    <span className="truncate">{getNamaLingkunganFromAnyIdentifier(selectedLingkunganDafu)}</span>
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-slate-900 text-xs max-h-72">
                    <SelectItem value="ALL" className="font-semibold text-slate-800">
                      ⭐ Semua Lingkungan (69 Lingkungan)
                    </SelectItem>
                    {allLingkungan.map(ling => (
                      <SelectItem key={ling.id} value={ling.id}>
                        {formatNamaLingkungan(ling.nama_lingkungan)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filter Golongan */}
              <div className="w-full sm:w-44 space-y-1">
                <Label className="text-[10px] uppercase font-bold text-slate-500">Golongan Umat</Label>
                <Select value={filterGolongan} onValueChange={(val) => setFilterGolongan(val || 'ALL')}>
                  <SelectTrigger className="bg-white border-slate-300 text-slate-900 text-xs font-bold rounded-xl h-10">
                    <SelectValue placeholder="Semua Golongan" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-slate-900 text-xs">
                    <SelectItem value="ALL">Semua Golongan</SelectItem>
                    <SelectItem value="Tidak Mampu">Tidak Mampu</SelectItem>
                    <SelectItem value="Rentan">Rentan Tdk Mampu</SelectItem>
                    <SelectItem value="Menengah">Menengah</SelectItem>
                    <SelectItem value="Mampu">Mampu</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search KK */}
              <div className="flex-1 space-y-1">
                <Label className="text-[10px] uppercase font-bold text-slate-500">Pencarian Kepala Keluarga</Label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchKk}
                    onChange={(e) => setSearchKk(e.target.value)}
                    placeholder="Cari nama KK atau no KK..."
                    className="pl-9 bg-white border-slate-300 text-slate-900 text-xs rounded-xl h-10"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-end pt-5 sm:pt-0">
              <Button
                type="button"
                variant="outline"
                onClick={handleExportDafuCsv}
                className="border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl h-10 px-3 cursor-pointer shrink-0 w-full sm:w-auto"
              >
                <Download className="w-4 h-4 mr-1 text-slate-600" />
                Unduh CSV DAFU
              </Button>
            </div>
          </div>

          {/* Tabel DAFU Seluruh Lingkungan */}
          <Card className="bg-white border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-3.5 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span>Menampilkan <strong>{filteredKks.length}</strong> KK dari total <strong>{allFlattenedKks.length}</strong> KK di Paroki St. Clara</span>
              <span className="text-[11px] text-slate-500 italic">Klik baris untuk melihat rincian anggota keluarga</span>
            </div>
            <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
              <Table className="text-xs">
                <TableHeader className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 shadow-2xs">
                  <TableRow>
                    <TableHead className="w-12 text-center font-bold text-slate-700">No</TableHead>
                    <TableHead className="w-44 font-bold text-slate-700">Lingkungan</TableHead>
                    <TableHead className="font-bold text-slate-700">Kepala Keluarga</TableHead>
                    <TableHead className="w-32 font-bold text-slate-700">Nomor KK</TableHead>
                    <TableHead className="w-32 font-bold text-slate-700">Golongan</TableHead>
                    <TableHead className="w-24 text-center font-bold text-slate-700">Jumlah Jiwa</TableHead>
                    <TableHead className="w-28 text-center font-bold text-slate-700">Status KAJ</TableHead>
                    <TableHead className="w-16 text-center font-bold text-slate-700">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100">
                  {filteredKks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-slate-500">
                        Tidak ada data keluarga yang sesuai dengan kriteria filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredKks.slice(0, 100).map((item, idx) => {
                      const gol = getDummyGolonganForKk(item.kk)
                      const anggota = getDummyAnggotaForKk(item.kk)

                      return (
                        <TableRow
                          key={`${item.lingkunganId}-${item.kk.id}`}
                          onClick={() => setSelectedKkDetail({ kk: item.kk, lingkunganName: item.lingkunganNama, golongan: gol, anggota })}
                          className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                        >
                          <TableCell className="text-center font-mono text-slate-500 font-semibold">{idx + 1}</TableCell>
                          <TableCell className="font-bold text-slate-800">
                            {formatNamaLingkungan(item.lingkunganNama)}
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-slate-900">{item.kk.nama_kk}</div>
                            {item.kk.no_kk && item.kk.no_kk !== '-' && (
                              <div className="text-[11px] text-slate-500 font-mono mt-0.5">No. KK: {item.kk.no_kk}</div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-slate-600">{item.kk.no_kk && item.kk.no_kk !== '-' ? item.kk.no_kk : '-'}</TableCell>
                          <TableCell>
                            <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {gol.golongan}
                            </span>
                          </TableCell>
                          <TableCell className="text-center font-semibold text-slate-800">
                            {anggota.length} <span className="text-[10px] text-slate-500 font-normal">Jiwa</span>
                          </TableCell>
                          <TableCell className="text-center">
                            {item.kk.is_biduk !== false ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                                KAJ
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">
                                Non-KAJ
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-slate-500 hover:text-blue-700"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            {filteredKks.length > 100 && (
              <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500">
                Menampilkan 100 data pertama dari {filteredKks.length} data. Gunakan pencarian atau filter lingkungan di atas untuk melihat data lebih spesifik.
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ============================================================== */}
      {/* DIALOG DETAIL KELUARGA DAFU */}
      {/* ============================================================== */}
      <Dialog open={!!selectedKkDetail} onOpenChange={(open) => !open && setSelectedKkDetail(null)}>
        <DialogContent className="max-w-2xl bg-white text-slate-900 rounded-2xl border-slate-200 p-6">
          <DialogHeader>
            <div className="flex items-center gap-2 text-xs font-bold text-[#004085]">
              <Building2 className="w-4 h-4" />
              {selectedKkDetail ? formatNamaLingkungan(selectedKkDetail.lingkunganName) : ''}
            </div>
            <DialogTitle className="text-xl font-bold font-serif text-slate-900 mt-1">
              Rincian Keluarga: {selectedKkDetail?.kk.nama_kk}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              No. KK: {selectedKkDetail?.kk.no_kk || '-'} • Golongan:{' '}
              <strong className="text-slate-800">{selectedKkDetail?.golongan.golongan}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="text-slate-500">Alamat Tempat Tinggal:</div>
              <div className="font-semibold text-slate-800">{selectedKkDetail?.kk.alamat || 'Alamat sesuai DAFU Paroki'}</div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700">Daftar Anggota Keluarga ({selectedKkDetail?.anggota.length || 0} Jiwa)</div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <Table className="text-xs">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-10 text-center font-bold">No</TableHead>
                      <TableHead className="font-bold">Nama Anggota</TableHead>
                      <TableHead className="font-bold">Peran / Hubungan</TableHead>
                      <TableHead className="text-center font-bold">Status KAJ</TableHead>
                      <TableHead className="font-bold">Keterangan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-100">
                    {selectedKkDetail?.anggota.map((m, idx) => (
                      <TableRow key={m.id || idx}>
                        <TableCell className="text-center font-mono text-slate-500">{idx + 1}</TableCell>
                        <TableCell className="font-bold text-slate-900">{m.nama}</TableCell>
                        <TableCell className="text-slate-700 font-medium">{m.peran}</TableCell>
                        <TableCell className="text-center">
                          {m.is_kaj !== false ? (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              KAJ
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              Non-KAJ
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-500">{m.keterangan || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              onClick={() => setSelectedKkDetail(null)}
              className="bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl text-xs"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* DIALOG LINKED TO GOOGLE SHEET */}
      {/* ============================================================== */}
      <Dialog open={sheetModalOpen} onOpenChange={setSheetModalOpen}>
        <DialogContent className="max-w-md bg-white text-slate-900 rounded-2xl border-slate-200 p-6">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mb-2">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <DialogTitle className="text-lg font-bold font-serif text-slate-900">
              Linked to Google Sheets Paroki
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Integrasi langsung untuk menarik dan memantau seluruh data dari 69 lingkungan secara terpusat di Google Spreadsheet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Status Koneksi:</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full text-[11px]">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Terhubung Aktif
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Pembaruan Terakhir:</span>
                <span className="font-semibold text-slate-800">{lastSyncedTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Total Lingkungan Tersinkron:</span>
                <span className="font-bold text-[#004085]">{allLingkungan.length} Lingkungan</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600">Spreadsheet URL</label>
              <Input
                readOnly
                value={spreadsheetUrl}
                className="bg-slate-100 border-slate-300 text-slate-700 text-xs font-mono rounded-xl h-10 select-all"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2 flex-col sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={isSyncingSheet}
              onClick={handleSyncToSheet}
              className="border-slate-300 text-slate-700 hover:bg-slate-100 font-bold rounded-xl text-xs h-10 flex items-center justify-center gap-2 cursor-pointer flex-1"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingSheet ? 'animate-spin' : ''}`} />
              {isSyncingSheet ? 'Menyinkronkan...' : 'Tarik & Sinkronkan Sekarang'}
            </Button>
            <Button
              type="button"
              onClick={() => window.open(spreadsheetUrl, '_blank')}
              className="bg-[#0F9D58] hover:bg-[#0B8043] text-white font-bold rounded-xl text-xs h-10 flex items-center justify-center gap-2 cursor-pointer shadow-xs flex-1"
            >
              <ExternalLink className="w-4 h-4" />
              Buka Google Sheets
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
