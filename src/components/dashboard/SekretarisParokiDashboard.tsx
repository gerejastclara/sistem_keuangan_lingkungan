'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Building2,
  Users,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Search,
  ArrowRight,
  SlidersHorizontal,
  Home,
  UserCheck,
  AlertTriangle,
  FileText,
  Sparkles,
  ChevronRight,
  Layers,
  HeartHandshake,
  FileSpreadsheet
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { getAllMasterLingkungan, formatNamaLingkungan, getWilayahForLingkungan } from '@/lib/constants'
import { getDafuApprovals, fetchDafuApprovals, DafuApprovalItem } from '@/lib/dafuApproval'
import { ensureDummyKksForLingkungan, getDummyAnggotaForKk, getDummyGolonganForKk, santaClaraStats } from '@/lib/dummyData'

export function SekretarisParokiDashboard() {
  const [approvals, setApprovals] = useState<DafuApprovalItem[]>([])
  const [searchLingkungan, setSearchLingkungan] = useState('')
  const [selectedLingkunganId, setSelectedLingkunganId] = useState<string>('all')

  const masterList = getAllMasterLingkungan()

  // Real aggregate KK and Jiwa counts per Lingkungan from Santa Clara dataset
  const lingkunganUmatStats = useMemo(() => {
    const map: Record<string, { kkCount: number; jiwaCount: number }> = {}
    masterList.forEach(ling => {
      const kks = ensureDummyKksForLingkungan(ling.id, ling.nama_lingkungan, [], undefined, true)
      let jiwa = 0
      kks.forEach(k => {
        const anggota = getDummyAnggotaForKk(k)
        jiwa += (anggota && anggota.length > 0) ? anggota.length : (k.jumlah_anggota || 1)
      })
      map[ling.id] = { kkCount: kks.length, jiwaCount: jiwa }
    })
    return map
  }, [masterList])

  const loadApprovals = async () => {
    const cached = getDafuApprovals()
    if (cached && cached.length > 0) {
      setApprovals(cached)
    }
    try {
      const list = await fetchDafuApprovals()
      setApprovals(list)
    } catch (e) {}
  }

  // Update Status Golongan Modal State (Khusus Sekretaris Paroki)
  const [isUpdateGolonganOpen, setIsUpdateGolonganOpen] = useState(false)
  const [golonganKkSearch, setGolonganKkSearch] = useState('')
  const [selectedKkForGolongan, setSelectedKkForGolongan] = useState<any | null>(null)
  const [targetGolongan, setTargetGolongan] = useState<string>('Sejahtera')
  const [golonganCatatan, setGolonganCatatan] = useState<string>('')
  const [golonganUpdateSuccess, setGolonganUpdateSuccess] = useState<string | null>(null)

  // Pre-load all 2.884 KKs for quick search & update
  const allParishKks = useMemo(() => {
    const list: Array<{
      id: string
      nama_kk: string
      alamat?: string
      lingkunganId: string
      lingkunganNama: string
      golongan: string
    }> = []

    masterList.forEach((ling) => {
      const kks = ensureDummyKksForLingkungan(ling.id, ling.nama_lingkungan, [], undefined, true)
      kks.forEach((k) => {
        let currentGol = 'Sejahtera'
        try {
          const rawStore = localStorage.getItem('custom_golongan_all_store')
          if (rawStore) {
            const s = JSON.parse(rawStore)
            if (s[k.id]?.golongan) currentGol = s[k.id].golongan
          }
        } catch (e) {}
        if (currentGol === 'Sejahtera') {
          const defaultG = getDummyGolonganForKk(k)
          currentGol = defaultG.golongan
        }

        list.push({
          id: k.id,
          nama_kk: k.nama_kk,
          alamat: k.alamat || undefined,
          lingkunganId: ling.id,
          lingkunganNama: ling.nama_lingkungan,
          golongan: currentGol,
        })
      })
    })

    return list
  }, [masterList])

  const filteredKksForGolongan = useMemo(() => {
    const q = golonganKkSearch.toLowerCase().trim()
    if (!q) return allParishKks.slice(0, 8)
    return allParishKks
      .filter((k) => k.nama_kk.toLowerCase().includes(q) || k.lingkunganNama.toLowerCase().includes(q))
      .slice(0, 15)
  }, [allParishKks, golonganKkSearch])

  const handleSaveGolonganUpdate = () => {
    if (!selectedKkForGolongan) return
    try {
      const rawG = localStorage.getItem('custom_golongan_all_store')
      const store = rawG ? JSON.parse(rawG) : {}
      store[selectedKkForGolongan.id] = {
        id: `gol-${Date.now()}`,
        kk_id: selectedKkForGolongan.id,
        lingkungan_id: selectedKkForGolongan.lingkunganId,
        golongan: targetGolongan,
        kriteria_catatan: golonganCatatan.trim() || 'Ditetapkan & Diperbarui oleh Sekretaris Paroki',
        updated_by_role: 'SEKRETARIS_PAROKI',
        updated_at: new Date().toISOString(),
      }
      localStorage.setItem('custom_golongan_all_store', JSON.stringify(store))
      window.dispatchEvent(new Event('storage'))
      window.dispatchEvent(new Event('dafuApprovalUpdated'))
      setGolonganUpdateSuccess(`Status Golongan "${selectedKkForGolongan.nama_kk}" (${selectedKkForGolongan.lingkunganNama}) berhasil diperbarui menjadi "${targetGolongan}" oleh Sekretaris Paroki!`)
      setTimeout(() => setGolonganUpdateSuccess(null), 4000)
      setIsUpdateGolonganOpen(false)
      setSelectedKkForGolongan(null)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadApprovals()
    const readStoredLingkungan = () => {
      const val = localStorage.getItem('selected_lingkungan_id') || 'all'
      setSelectedLingkunganId(val)
    }
    readStoredLingkungan()

    window.addEventListener('dafuApprovalUpdated', loadApprovals)
    window.addEventListener('lingkunganChanged', readStoredLingkungan)
    window.addEventListener('storage', readStoredLingkungan)
    return () => {
      window.removeEventListener('dafuApprovalUpdated', loadApprovals)
      window.removeEventListener('lingkunganChanged', readStoredLingkungan)
      window.removeEventListener('storage', readStoredLingkungan)
    }
  }, [])

  const pendingApprovals = useMemo(() => approvals.filter(a => a.status === 'PENDING'), [approvals])
  const pendingCount = pendingApprovals.length

  const isAllLingkungan = !selectedLingkunganId || selectedLingkunganId === 'all' || selectedLingkunganId === 'ALL'

  const currentSelectedLingkungan = useMemo(() => {
    if (isAllLingkungan) return null
    return masterList.find(l =>
      l.id === selectedLingkunganId ||
      l.nama_lingkungan.toLowerCase().trim() === selectedLingkunganId.toLowerCase().trim() ||
      l.nama_lingkungan.toLowerCase().replace(/[^a-z0-9]/g, '') === selectedLingkunganId.toLowerCase().replace(/[^a-z0-9]/g, '')
    ) || null
  }, [masterList, selectedLingkunganId, isAllLingkungan])

  // Filter master lingkungan by search & selectedLingkunganId from Navbar
  const filteredLingkungan = useMemo(() => {
    let list = masterList
    if (currentSelectedLingkungan) {
      list = [currentSelectedLingkungan]
    }
    const q = searchLingkungan.toLowerCase().trim()
    if (!q) return list
    return list.filter(l =>
      l.nama_lingkungan.toLowerCase().includes(q) ||
      getWilayahForLingkungan(l.nama_lingkungan).toLowerCase().includes(q)
    )
  }, [masterList, currentSelectedLingkungan, searchLingkungan])

  // Scope approvals based on selected lingkungan
  const scopedApprovals = useMemo(() => {
    if (!currentSelectedLingkungan) return approvals
    const targetNorm = currentSelectedLingkungan.nama_lingkungan.toLowerCase().replace(/[^a-z0-9]/g, '')
    return approvals.filter(item => {
      const itemNorm = item.nama_lingkungan.toLowerCase().replace(/[^a-z0-9]/g, '')
      return item.lingkungan_id === currentSelectedLingkungan.id || itemNorm === targetNorm
    })
  }, [approvals, currentSelectedLingkungan])

  const pendingApprovalsForScope = useMemo(() => scopedApprovals.filter(a => a.status === 'PENDING'), [scopedApprovals])
  const approvedApprovalsForScope = useMemo(() => scopedApprovals.filter(a => a.status === 'APPROVED'), [scopedApprovals])

  // Scoped KKs and Jiwa
  const scopedKks = useMemo(() => {
    if (!currentSelectedLingkungan) return allParishKks
    return allParishKks.filter(k => k.lingkunganId === currentSelectedLingkungan.id)
  }, [allParishKks, currentSelectedLingkungan])

  const scopedTotalJiwa = useMemo(() => {
    if (!currentSelectedLingkungan) return 9802
    const stat = lingkunganUmatStats[currentSelectedLingkungan.id]
    return stat ? stat.jiwaCount : scopedKks.length * 3
  }, [currentSelectedLingkungan, lingkunganUmatStats, scopedKks])

  const scopedGolonganCounts = useMemo(() => {
    const total = scopedKks.length
    let sejahtera = 0
    let prasejahtera = 0
    let rentan = 0
    scopedKks.forEach(k => {
      if (k.golongan === 'Terduga Prasejahtera') prasejahtera++
      else if (k.golongan === 'Rentan Tidak Mampu') rentan++
      else sejahtera++
    })
    const pct = (c: number) => total > 0 ? ((c / total) * 100).toFixed(1) : '0.0'
    return {
      total,
      sejahtera,
      sejahteraPct: pct(sejahtera),
      prasejahtera,
      prasejahteraPct: pct(prasejahtera),
      rentan,
      rentanPct: pct(rentan),
    }
  }, [scopedKks])

  // Map pending approvals per lingkungan
  const pendingPerLingkungan = useMemo(() => {
    const map: Record<string, number> = {}
    pendingApprovals.forEach(a => {
      const key = a.nama_lingkungan.toLowerCase().trim()
      map[key] = (map[key] || 0) + 1
    })
    return map
  }, [pendingApprovals])

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header Banner */}
      <div className="bg-[#F8F9FA] text-slate-900 p-6 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white border border-slate-300 text-slate-700 text-xs font-semibold uppercase tracking-wider shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
              Sekretariat Paroki St. Clara
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-serif text-slate-900">
              {currentSelectedLingkungan
                ? `Dashboard ${formatNamaLingkungan(currentSelectedLingkungan.nama_lingkungan)}`
                : 'Dashboard Seluruh Lingkungan'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
              {currentSelectedLingkungan
                ? `Pemantauan data umat, persebaran ${scopedKks.length} Kepala Keluarga, klasifikasi golongan DUPRAS, dan verifikasi approval DAFU khusus untuk ${formatNamaLingkungan(currentSelectedLingkungan.nama_lingkungan)} (Wilayah ${getWilayahForLingkungan(currentSelectedLingkungan.nama_lingkungan)}).`
                : 'Pemantauan terpusat data umat, persebaran Kepala Keluarga, klasifikasi golongan, dan verifikasi approval DAFU untuk seluruh 69 Lingkungan Paroki St. Clara.'}
            </p>
            {currentSelectedLingkungan && (
              <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs font-semibold shadow-2xs">
                <span>Lingkungan Terpilih: <strong>{formatNamaLingkungan(currentSelectedLingkungan.nama_lingkungan)}</strong> ({getWilayahForLingkungan(currentSelectedLingkungan.nama_lingkungan)})</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link href="/dashboard/matching-excel">
              <Button
                variant="outline"
                size="sm"
                className="bg-white hover:bg-slate-50 text-slate-700 border-slate-300 text-xs rounded-xl font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                <span>Matching Data Excel</span>
              </Button>
            </Link>
            <Link href="/dashboard/approval">
              <Button
                size="sm"
                className="bg-slate-600 hover:bg-slate-700 text-white text-xs rounded-xl font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Modul Approval</span>
                {pendingApprovalsForScope.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold animate-pulse">
                    {pendingApprovalsForScope.length}
                  </span>
                )}
              </Button>
            </Link>
            <Link href="/dashboard/kriteria-golongan">
              <Button
                variant="outline"
                size="sm"
                className="bg-white hover:bg-slate-50 text-slate-700 border-slate-300 text-xs rounded-xl font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Kriteria Golongan</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Pending Approval Callout Banner if any */}
      {pendingApprovalsForScope.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 font-bold shadow-2xs">
              <Clock className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900">
                {currentSelectedLingkungan
                  ? `Ada ${pendingApprovalsForScope.length} Permohonan Approval DAFU Menunggu Persetujuan (${formatNamaLingkungan(currentSelectedLingkungan.nama_lingkungan)})`
                  : `Ada ${pendingApprovalsForScope.length} Permohonan Approval DAFU Menunggu Persetujuan`}
              </h4>
              <p className="text-xs text-slate-600">
                {currentSelectedLingkungan
                  ? `Sekretaris ${formatNamaLingkungan(currentSelectedLingkungan.nama_lingkungan)} telah mengajukan penambahan atau perubahan data umat. Segera tinjau untuk memperbarui basis data.`
                  : 'Sekretaris Lingkungan telah mengajukan penambahan atau perubahan data umat. Segera tinjau untuk memperbarui basis data paroki.'}
              </p>
            </div>
          </div>

          <Link href="/dashboard/approval" className="shrink-0">
            <Button
              size="sm"
              className="w-full sm:w-auto bg-slate-600 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <span>Tinjau Sekarang</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      )}

      {/* 4 Global Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Lingkungan / Lingkungan Terpilih */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>{currentSelectedLingkungan ? 'Lingkungan Terpilih' : 'Total Lingkungan'}</span>
            <Building2 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 truncate">
            {currentSelectedLingkungan ? formatNamaLingkungan(currentSelectedLingkungan.nama_lingkungan) : '69 Lingkungan'}
          </div>
          <p className="text-[11px] text-slate-400">
            {currentSelectedLingkungan ? `Wilayah ${getWilayahForLingkungan(currentSelectedLingkungan.nama_lingkungan)}` : '13 Wilayah terintegrasi aktif'}
          </p>
        </div>

        {/* Card 2: Total KK Terdata */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>{currentSelectedLingkungan ? 'Kepala Keluarga (KK)' : 'Total Kepala Keluarga (KK)'}</span>
            <Home className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {currentSelectedLingkungan ? `${scopedKks.length} KK` : '2.884 KK'}
          </div>
          <p className="text-[11px] text-emerald-700 font-medium">
            {currentSelectedLingkungan ? `Terdata aktif di ${formatNamaLingkungan(currentSelectedLingkungan.nama_lingkungan)}` : 'Rata-rata 42 KK / lingkungan'}
          </p>
        </div>

        {/* Card 3: Total Jiwa / Umat */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Jiwa / Umat</span>
            <Users className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {currentSelectedLingkungan ? `${scopedTotalJiwa} Jiwa` : '9.802 Jiwa'}
          </div>
          <p className="text-[11px] text-sky-700 font-medium">
            {currentSelectedLingkungan ? 'Terdaftar BIDUK & sensus lingkungan' : '94% Terdaftar BIDUK KAJ'}
          </p>
        </div>

        {/* Card 4: Status Approval */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Status Approval DAFU</span>
            <ShieldCheck className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {pendingApprovalsForScope.length} <span className="text-xs font-bold text-slate-600">Pending</span>
          </div>
          <p className="text-[11px] text-slate-400">
            {approvedApprovalsForScope.length} Permohonan disetujui {currentSelectedLingkungan ? '' : '(Seluruh Paroki)'}
          </p>
        </div>
      </div>

      {/* Golongan Summary Overview Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 font-serif">
              <SlidersHorizontal className="w-4 h-4 text-slate-600" />
              {currentSelectedLingkungan
                ? `Distribusi Kategori Golongan Umat — ${formatNamaLingkungan(currentSelectedLingkungan.nama_lingkungan)}`
                : 'Distribusi Kategori Golongan Umat (Seluruh Paroki)'}
            </h3>
            <p className="text-xs text-slate-500">
              {currentSelectedLingkungan
                ? `Klasifikasi kondisi sosial ekonomi ${scopedKks.length} keluarga di ${formatNamaLingkungan(currentSelectedLingkungan.nama_lingkungan)} berbasis pedoman DUPRAS KAJ.`
                : 'Klasifikasi kondisi sosial ekonomi keluarga berbasis pedoman DUPRAS KAJ (Kewenangan penetapan & update: Sekretaris Paroki).'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => setIsUpdateGolonganOpen(true)}
              className="bg-slate-600 hover:bg-slate-700 text-white text-xs rounded-xl font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Update Status Golongan KK</span>
            </Button>
            <Link href="/dashboard/kriteria-golongan">
              <Button
                variant="outline"
                size="sm"
                className="bg-white hover:bg-slate-50 text-slate-700 border-slate-300 text-xs rounded-xl font-semibold flex items-center gap-1 cursor-pointer shadow-2xs"
              >
                <span>Atur Kriteria →</span>
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-1">
            <div className="text-xs font-bold text-emerald-800 flex items-center justify-between">
              <span>Keluarga Sejahtera</span>
              <span className="text-sm">🟢</span>
            </div>
            <div className="text-xl font-extrabold text-emerald-950">
              {scopedGolonganCounts.sejahtera} KK ({scopedGolonganCounts.sejahteraPct}%)
            </div>
            <p className="text-[11px] text-emerald-700">Mandiri, mampu berswacita & bergotong royong</p>
          </div>

          <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 space-y-1">
            <div className="text-xs font-bold text-amber-800 flex items-center justify-between">
              <span>Terduga Prasejahtera</span>
              <span className="text-sm">🟡</span>
            </div>
            <div className="text-xl font-extrabold text-amber-950">
              {scopedGolonganCounts.prasejahtera} KK ({scopedGolonganCounts.prasejahteraPct}%)
            </div>
            <p className="text-[11px] text-amber-700">Perlu pendampingan & pemantauan berkala</p>
          </div>

          <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60 space-y-1">
            <div className="text-xs font-bold text-rose-800 flex items-center justify-between">
              <span>Rentan Tidak Mampu</span>
              <span className="text-sm">🔴</span>
            </div>
            <div className="text-xl font-extrabold text-rose-950">
              {scopedGolonganCounts.rentan} KK ({scopedGolonganCounts.rentanPct}%)
            </div>
            <p className="text-[11px] text-rose-700">Prioritas bantuan talangan & subsidi paroki</p>
          </div>
        </div>
      </div>

      {/* Tabel Rekapitulasi Data Umat 69 Lingkungan */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 font-serif">
              Rekapitulasi DAFU 69 Lingkungan
            </h3>
            <p className="text-xs text-slate-400">
              Menampilkan {filteredLingkungan.length} dari 69 lingkungan aktif
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Cari nama lingkungan / wilayah..."
              value={searchLingkungan}
              onChange={(e) => setSearchLingkungan(e.target.value)}
              className="pl-8 pr-3 h-9 text-xs rounded-xl bg-slate-50 border-slate-200 text-slate-900"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Nama Lingkungan</th>
                <th className="py-3 px-4">Wilayah</th>
                <th className="py-3 px-4 text-center">Estimasi KK</th>
                <th className="py-3 px-4 text-center">Estimasi Jiwa</th>
                <th className="py-3 px-4 text-center">Status Approval</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLingkungan.map((l, idx) => {
                const pendingForThis = pendingPerLingkungan[l.nama_lingkungan.toLowerCase().trim()] || 0
                const stat = lingkunganUmatStats[l.id] || { kkCount: 0, jiwaCount: 0 }

                return (
                  <tr key={l.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 text-center text-slate-400 font-mono">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 font-serif">
                        {formatNamaLingkungan(l.nama_lingkungan)}
                      </div>
                      <div className="text-[10px] text-slate-400">ID: {l.id}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded font-semibold text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                        {getWilayahForLingkungan(l.nama_lingkungan)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                      {stat.kkCount} KK
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-600">
                      {stat.jiwaCount} Jiwa
                    </td>
                    <td className="py-3 px-4 text-center">
                      {pendingForThis > 0 ? (
                        <Link href="/dashboard/approval">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 animate-pulse cursor-pointer">
                            <Clock className="w-3 h-3" />
                            {pendingForThis} Permohonan
                          </span>
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Terverifikasi
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link href="/dashboard/approval">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2.5 text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                        >
                          Tinjau →
                        </Button>
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog Modal Pembaruan Status Golongan Umat (Khusus Sekretaris Paroki) */}
      <Dialog open={isUpdateGolonganOpen} onOpenChange={(open) => !open && setIsUpdateGolonganOpen(false)}>
        <DialogContent className="sm:max-w-xl bg-white text-slate-900 border-slate-200 rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2 font-serif">
              <ShieldCheck className="w-5 h-5 text-slate-600" />
              Pembaruan Status Golongan Umat (DUPRAS)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Sebagai Sekretaris Paroki, Anda berwenang menetapkan dan memperbarui status golongan keluarga dari seluruh 69 Lingkungan Paroki St. Clara.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Step 1: Search & Pick KK */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">1. Cari Nama Kepala Keluarga atau Lingkungan:</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Ketik nama keluarga (misal: FX Sudirman, Antonius...)"
                  value={golonganKkSearch}
                  onChange={(e) => setGolonganKkSearch(e.target.value)}
                  className="pl-8 pr-3 h-9 text-xs rounded-xl bg-slate-50 border-slate-300 text-slate-900"
                />
              </div>

              {/* Suggestions List */}
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50">
                {filteredKksForGolongan.map((kk) => {
                  const isSelected = selectedKkForGolongan?.id === kk.id
                  return (
                    <div
                      key={kk.id}
                      onClick={() => {
                        setSelectedKkForGolongan(kk)
                        setTargetGolongan(kk.golongan)
                      }}
                      className={`p-2.5 flex items-center justify-between cursor-pointer transition ${
                        isSelected ? 'bg-[#16233F] text-white' : 'hover:bg-slate-100/80 text-slate-800'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-xs">{kk.nama_kk}</div>
                        <div className={`text-[10px] ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                          {kk.lingkunganNama} • {kk.alamat || 'Alamat terdaftar'}
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                        isSelected ? 'bg-white/10 text-white border-white/20' : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {kk.golongan}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Step 2: Selected Family & Target Golongan */}
            {selectedKkForGolongan ? (
              <div className="p-3.5 rounded-xl border border-slate-200 bg-[#F8F9FA] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 text-slate-700">
                  <span className="font-semibold">Keluarga Terpilih:</span>
                  <span className="font-bold text-slate-900">{selectedKkForGolongan.nama_kk}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Status Golongan Baru *</label>
                    <Select value={targetGolongan} onValueChange={(val: any) => setTargetGolongan(val || 'Sejahtera')}>
                      <SelectTrigger className="h-9 bg-white border-slate-300 text-xs rounded-xl font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200 text-xs">
                        <SelectItem value="Sejahtera">🟢 Keluarga Sejahtera</SelectItem>
                        <SelectItem value="Terduga Prasejahtera">🟡 Terduga Prasejahtera</SelectItem>
                        <SelectItem value="Rentan Tidak Mampu">🔴 Rentan Tidak Mampu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Catatan Verifikasi Paroki</label>
                    <Input
                      type="text"
                      placeholder="Alasan penyesuaian (misal: hasil verifikasi DUPRAS)"
                      value={golonganCatatan}
                      onChange={(e) => setGolonganCatatan(e.target.value)}
                      className="h-9 bg-white border-slate-300 text-xs rounded-xl"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-center italic text-xs">
                Pilih salah satu keluarga dari daftar di atas untuk memperbarui status golongannya.
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsUpdateGolonganOpen(false)}
              className="text-xs font-medium text-slate-700 border-slate-300 rounded-xl"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!selectedKkForGolongan}
              onClick={handleSaveGolonganUpdate}
              className="bg-slate-600 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl shadow-2xs"
            >
              Simpan Pembaruan Status Golongan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
