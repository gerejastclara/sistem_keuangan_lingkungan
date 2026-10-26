'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Building2,
  Users,
  CreditCard,
  Search,
  ArrowRight,
  UserCheck,
  CheckCircle2,
  SlidersHorizontal,
  Wallet,
  Home,
  Clock,
  Sparkles,
  ExternalLink,
  AlertTriangle,
  Bell,
  Filter,
  MessageCircle,
  Activity,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getAllMasterLingkungan, formatNamaLingkungan, getWilayahForLingkungan, getLingkunganDbUuid } from '@/lib/constants'
import { ensureDummyKksForLingkungan, getLingkunganStats, santaClaraStats } from '@/lib/dummyData'
import { getPengurusForLingkungan } from '@/lib/pengurusData'
import { createClient } from '@/utils/supabase/client'
import { formatRupiah, formatDateIndo } from '@/lib/utils'

interface ParokiOverviewDashboardProps {
  onSelectLingkungan?: (id: string) => void
}

type StatusKeaktifan = 'AKTIF' | 'PERHATIAN' | 'PASIF' | 'BELUM_ADA_DATA'

interface LingkunganActivityInfo {
  totalTransaksi: number
  totalMasuk: number
  totalKeluar: number
  saldoKas: number
  lastTxDate: string | null
  daysInactive: number | null
  statusKeaktifan: StatusKeaktifan
}

export function ParokiOverviewDashboard({ onSelectLingkungan }: ParokiOverviewDashboardProps) {
  const supabase = createClient()
  const masterList = getAllMasterLingkungan()

  const [activeTab, setActiveTab] = useState<'CAPAIAN' | 'DIREKTORI'>('CAPAIAN')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NEED_ATTENTION' | StatusKeaktifan>('ALL')
  const [sortBy, setSortBy] = useState<'INACTIVE_DESC' | 'ACTIVE_DESC' | 'SALDO_DESC' | 'TX_DESC' | 'NAME_ASC'>('INACTIVE_DESC')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [profilMap, setProfilMap] = useState<Map<string, any>>(new Map())
  const [activityMap, setActivityMap] = useState<Record<string, LingkunganActivityInfo>>({})

  // Instant O(1) KK and Jiwa counts per Lingkungan from the pre-calculated Santa Clara dataset
  const lingkunganUmatStats = useMemo(() => {
    const map: Record<string, { kkCount: number; jiwaCount: number }> = {}
    masterList.forEach(ling => {
      map[ling.id] = getLingkunganStats(ling.id, ling.nama_lingkungan)
    })
    return map
  }, [masterList])

  useEffect(() => {
    const loadParokiOverview = async () => {
      setLoading(true)
      try {
        // 1. Fetch profil_lingkungan for all Lingkungan
        const { data: dbProfilList } = await supabase.from('profil_lingkungan').select('*')
        const pMap = new Map<string, any>()
        if (dbProfilList) {
          dbProfilList.forEach((p: any) => {
            pMap.set(p.lingkungan_id, p)
          })
        }
        setProfilMap(pMap)

        // 2. Fetch all journals to calculate aggregate cash balance & activity per lingkungan
        const { data: dbJournals } = await supabase
          .from('jurnal_transaksi')
          .select('lingkungan_id, tipe_arus, nominal, keterangan, no_bukti, tanggal, created_at')

        const actMap: Record<string, LingkunganActivityInfo> = {}

        masterList.forEach(ling => {
          const dbUuid = getLingkunganDbUuid(ling.id)
          const p = pMap.get(dbUuid) || pMap.get(ling.id)
          const initialSaldo = Number(p?.saldo_awal || 0)

          let txCount = 0
          let masuk = 0
          let keluar = 0
          let latestDateStr: string | null = null

          if (dbJournals && Array.isArray(dbJournals)) {
            dbJournals.forEach(j => {
              const matchedLing = masterList.find(m => {
                const u = getLingkunganDbUuid(m.id)
                return m.id === j.lingkungan_id || u === j.lingkungan_id
              })
              const lKey = matchedLing ? matchedLing.id : j.lingkungan_id
              if (lKey !== ling.id) return

              if (j.no_bukti === '[SA/1100]' || (j.keterangan || '').includes('[SALDO_AWAL]')) {
                return
              }

              txCount++
              const nom = Number(j.nominal) || 0
              if (j.tipe_arus === 'MASUK') masuk += nom
              else if (j.tipe_arus === 'KELUAR') keluar += nom

              const dt = j.tanggal || j.created_at
              if (dt) {
                if (!latestDateStr || new Date(dt) > new Date(latestDateStr)) {
                  latestDateStr = dt
                }
              }
            })
          }

          let daysInactive: number | null = null
          let status: StatusKeaktifan = 'BELUM_ADA_DATA'

          if (latestDateStr) {
            const diffMs = Date.now() - new Date(latestDateStr).getTime()
            daysInactive = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
            if (daysInactive <= 7) status = 'AKTIF'
            else if (daysInactive <= 14) status = 'PERHATIAN'
            else status = 'PASIF'
          }

          actMap[ling.id] = {
            totalTransaksi: txCount,
            totalMasuk: masuk,
            totalKeluar: keluar,
            saldoKas: initialSaldo + masuk - keluar,
            lastTxDate: latestDateStr,
            daysInactive,
            statusKeaktifan: status
          }
        })

        setActivityMap(actMap)
      } catch (err) {
        console.error('Error loading paroki overview data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadParokiOverview()
  }, [])

  // Calculate stats for Paroki
  const statsCapaian = useMemo(() => {
    let aktif = 0
    let perhatian = 0
    let pasif = 0
    let belumAdaData = 0
    let totalSaldo = 0

    Object.values(activityMap).forEach(info => {
      totalSaldo += info.saldoKas
      if (info.statusKeaktifan === 'AKTIF') aktif++
      else if (info.statusKeaktifan === 'PERHATIAN') perhatian++
      else if (info.statusKeaktifan === 'PASIF') pasif++
      else if (info.statusKeaktifan === 'BELUM_ADA_DATA') belumAdaData++
    })

    const needAttention = perhatian + pasif + belumAdaData
    const kepatuhanPct = masterList.length > 0 ? Math.round((aktif / masterList.length) * 100) : 0

    return {
      aktif,
      perhatian,
      pasif,
      belumAdaData,
      needAttention,
      kepatuhanPct,
      totalSaldo
    }
  }, [activityMap, masterList])

  // Helper for WhatsApp reminder
  const getWaReminderLink = (
    bendaharaNama: string,
    bendaharaKontak: string,
    ketuaNama: string,
    ketuaKontak: string,
    namaLingkungan: string,
    daysInactive: number | null
  ) => {
    const phone = (bendaharaKontak && bendaharaKontak !== '-' && !bendaharaKontak.includes('belum'))
      ? bendaharaKontak
      : (ketuaKontak && ketuaKontak !== '-' && !ketuaKontak.includes('belum') ? ketuaKontak : null)

    if (!phone) return null
    const clean = phone.replace(/[^0-9]/g, '')
    if (!clean || clean.length < 8) return null
    const waNum = clean.startsWith('0') ? '62' + clean.slice(1) : clean
    const targetNama = (bendaharaNama && !bendaharaNama.includes('belum'))
      ? bendaharaNama
      : (ketuaNama && !ketuaNama.includes('belum') ? ketuaNama : 'Pengurus')
    const cleanLingkungan = formatNamaLingkungan(namaLingkungan)

    const ket = daysInactive === null
      ? 'tercatat belum memiliki riwayat pengisian data transaksi kas'
      : `tercatat belum ada aktivitas pembaruan transaksi selama ${daysInactive} hari terakhir`

    const msg = `Salam damai Kristus Bapak/Ibu ${targetNama} (${cleanLingkungan}).\n\nKami dari Sekretariat / Pengurus Keuangan Paroki St. Clara ingin menginformasikan bahwa pembukuan Lingkungan ${cleanLingkungan} ${ket}.\n\nMohon bantuannya untuk memeriksa dan memperbarui pencatatan kas lingkungan melalui Sistem Keuangan Paroki agar laporan konsolidasi tetap tertib dan mutakhir.\n\nTerima kasih atas pelayanan dan kerja samanya. Tuhan memberkati.`

    return `https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`
  }

  // Filter & Sort Capaian List
  const processedCapaianList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    let list = masterList.map(l => {
      const dbUuid = getLingkunganDbUuid(l.id)
      const p = profilMap.get(dbUuid) || profilMap.get(l.id)
      const pengurus = getPengurusForLingkungan(l.id, l.nama_lingkungan, p)
      const act = activityMap[l.id] || {
        totalTransaksi: 0,
        totalMasuk: 0,
        totalKeluar: 0,
        saldoKas: 0,
        lastTxDate: null,
        daysInactive: null,
        statusKeaktifan: 'BELUM_ADA_DATA' as StatusKeaktifan
      }
      return {
        ...l,
        wilayah: getWilayahForLingkungan(l.nama_lingkungan),
        pengurus,
        act
      }
    })

    // Filter search
    if (q) {
      list = list.filter(item =>
        item.nama_lingkungan.toLowerCase().includes(q) ||
        item.wilayah.toLowerCase().includes(q) ||
        (item.pengurus.ketua_nama && item.pengurus.ketua_nama.toLowerCase().includes(q)) ||
        (item.pengurus.bendahara_nama && item.pengurus.bendahara_nama.toLowerCase().includes(q))
      )
    }

    // Filter status
    if (statusFilter === 'NEED_ATTENTION') {
      list = list.filter(item => item.act.statusKeaktifan !== 'AKTIF')
    } else if (statusFilter !== 'ALL') {
      list = list.filter(item => item.act.statusKeaktifan === statusFilter)
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'INACTIVE_DESC') {
        const aDays = a.act.daysInactive ?? 9999
        const bDays = b.act.daysInactive ?? 9999
        return bDays - aDays
      }
      if (sortBy === 'ACTIVE_DESC') {
        const aDays = a.act.daysInactive ?? 9999
        const bDays = b.act.daysInactive ?? 9999
        return aDays - bDays
      }
      if (sortBy === 'SALDO_DESC') {
        return b.act.saldoKas - a.act.saldoKas
      }
      if (sortBy === 'TX_DESC') {
        return b.act.totalTransaksi - a.act.totalTransaksi
      }
      return a.nama_lingkungan.localeCompare(b.nama_lingkungan)
    })

    return list
  }, [masterList, profilMap, activityMap, searchQuery, statusFilter, sortBy])

  const handleSelect = (lingId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('selected_lingkungan_id', lingId)
      window.dispatchEvent(new Event('lingkunganChanged'))
      window.dispatchEvent(new Event('storage'))
    }
    if (onSelectLingkungan) {
      onSelectLingkungan(lingId)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner - Soft Grey Theme */}
      <div className="bg-[#F8F9FA] text-slate-900 p-6 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white border border-slate-300 text-slate-700 text-xs font-semibold uppercase tracking-wider shadow-2xs">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              Gereja St. Clara • Paroki Bekasi Utara
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-serif text-slate-900">
              Ringkasan Eksekutif Paroki (Seluruh 69 Lingkungan)
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
              Pusat monitoring terpadu seluruh 69 Lingkungan: analisis capaian keuangan, pemantauan keaktifan pembukuan, konsolidasi kas paroki, dan kontak pengurus lingkungan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link href="/dashboard/paroki/sekretaris">
              <Button
                variant="outline"
                size="sm"
                className="bg-white hover:bg-slate-50 text-slate-700 border-slate-300 text-xs rounded-xl font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Users className="w-3.5 h-3.5 text-slate-600" />
                <span>Sekretariat Paroki</span>
              </Button>
            </Link>
            <Link href="/dashboard/paroki/bendahara">
              <Button
                size="sm"
                className="bg-slate-700 hover:bg-slate-800 text-white text-xs rounded-xl font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Monitoring Kas & Setoran</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* NOTIFIKASI MONITORING KEAKTIFAN UNTUK PAROKI (Soft Amber Theme - NO NEON) */}
      {statsCapaian.needAttention > 0 && (
        <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4 sm:p-5 text-slate-800 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-amber-100/90 text-amber-800 rounded-xl shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5 text-amber-800" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-amber-950 font-serif">
                    Pemberitahuan Pengawasan: {statsCapaian.needAttention} Lingkungan Memerlukan Tindak Lanjut
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900 border border-amber-300/60">
                    {statsCapaian.needAttention} Perlu Perhatian
                  </span>
                </div>
                <p className="text-xs text-amber-900/80 max-w-3xl leading-relaxed">
                  Terdapat <strong>{statsCapaian.needAttention} dari 69 lingkungan</strong> yang belum memiliki aktivitas transaksi baru dalam 7 hari terakhir atau belum menginput transaksi kas (misal: Santo Padre Pio 1 dkk). Anda dapat memfilter daftar capaian di bawah dan langsung mengirim pesan pengingat WhatsApp ke bendahara terkait.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => {
                  setActiveTab('CAPAIAN')
                  setStatusFilter(prev => prev === 'NEED_ATTENTION' ? 'ALL' : 'NEED_ATTENTION')
                }}
                className={`text-xs font-semibold rounded-xl px-3.5 py-2 cursor-pointer transition shadow-2xs ${
                  statusFilter === 'NEED_ATTENTION'
                    ? 'bg-slate-800 hover:bg-slate-900 text-white'
                    : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-300'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
                {statusFilter === 'NEED_ATTENTION' ? 'Tampilkan Semua (69)' : `Filter Perlu Diingatkan (${statsCapaian.needAttention})`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Status Keaktifan */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Status Keaktifan</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {statsCapaian.aktif} <span className="text-sm font-semibold text-slate-500">/ 69 Aktif</span>
          </div>
          <p className="text-[11px] text-amber-700 font-medium">
            {statsCapaian.needAttention} lingkungan pasif / belum ada data
          </p>
        </div>

        {/* Card 2: Tingkat Kepatuhan */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Kepatuhan Pembukuan</span>
            <Clock className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {statsCapaian.kepatuhanPct}%
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Transaksi aktif dalam 7 hari terakhir
          </p>
        </div>

        {/* Card 3: Konsolidasi Saldo Kas */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Akumulasi Saldo Kas Se-Paroki</span>
            <Wallet className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">
            {formatRupiah(statsCapaian.totalSaldo)}
          </div>
          <p className="text-[11px] text-slate-400">Total kas seluruh lingkungan</p>
        </div>

        {/* Card 4: Total KK & Jiwa */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Umat Resmi</span>
            <Home className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {santaClaraStats.totalFamilies.toLocaleString('id-ID')} KK
          </div>
          <p className="text-[11px] text-indigo-700 font-medium">
            {santaClaraStats.totalMembers.toLocaleString('id-ID')} Jiwa terdata resmi
          </p>
        </div>
      </div>

      {/* TAB NAVIGATION: ANALISIS CAPAIAN vs DIREKTORI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('CAPAIAN')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'CAPAIAN'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-slate-600" />
            <span>Analisis Capaian & Keaktifan Lingkungan</span>
            {statsCapaian.needAttention > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                {statsCapaian.needAttention}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('DIREKTORI')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'DIREKTORI'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-slate-600" />
            <span>Direktori Wilayah & Rekapitulasi Kas</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
              69
            </span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="text-[11px] font-medium text-slate-500">Status Keaktifan:</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            ● Aktif (&le;7 hr)
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            ▲ Perhatian (8-14 hr)
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            ■ Pasif (&gt;14 hr)
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            ○ Belum Ada Data
          </span>
        </div>
      </div>

      {/* VIEW TAB 1: ANALISIS CAPAIAN & KEAKTIFAN */}
      {activeTab === 'CAPAIAN' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-serif">
                Matriks Analisis Capaian & Keaktifan 69 Lingkungan
              </h3>
              <p className="text-xs text-slate-400">
                Menampilkan {processedCapaianList.length} dari 69 lingkungan • Pantau keteraturan input kas dan tindak lanjuti bendahara yang pasif
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Filter Status Keaktifan */}
              <div className="w-full sm:w-52">
                <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as any)}>
                  <SelectTrigger className="h-9 text-xs bg-slate-50 border-slate-200 text-slate-900 rounded-xl">
                    <SelectValue placeholder="Filter Keaktifan" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-slate-900">
                    <SelectItem value="ALL">Semua Status (69)</SelectItem>
                    <SelectItem value="NEED_ATTENTION">⚠️ Perlu Diingatkan ({statsCapaian.needAttention})</SelectItem>
                    <SelectItem value="AKTIF">● Aktif (&le; 7 Hari) ({statsCapaian.aktif})</SelectItem>
                    <SelectItem value="PERHATIAN">▲ Perlu Perhatian (8-14 Hari) ({statsCapaian.perhatian})</SelectItem>
                    <SelectItem value="PASIF">■ Pasif (&gt; 14 Hari) ({statsCapaian.pasif})</SelectItem>
                    <SelectItem value="BELUM_ADA_DATA">○ Belum Ada Transaksi ({statsCapaian.belumAdaData})</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort By */}
              <div className="w-full sm:w-48">
                <Select value={sortBy} onValueChange={(val) => setSortBy(val as any)}>
                  <SelectTrigger className="h-9 text-xs bg-slate-50 border-slate-200 text-slate-900 rounded-xl">
                    <SelectValue placeholder="Urutkan" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-slate-900">
                    <SelectItem value="INACTIVE_DESC">Paling Lama Tidak Aktif</SelectItem>
                    <SelectItem value="ACTIVE_DESC">Paling Baru Transaksi</SelectItem>
                    <SelectItem value="SALDO_DESC">Saldo Kas Tertinggi</SelectItem>
                    <SelectItem value="TX_DESC">Transaksi Terbanyak</SelectItem>
                    <SelectItem value="NAME_ASC">Nama Lingkungan (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Cari lingkungan / pengurus..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 h-9 text-xs rounded-xl bg-slate-50 border-slate-200 text-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Lingkungan &amp; Wilayah</th>
                  <th className="py-3 px-4">Status Keaktifan</th>
                  <th className="py-3 px-4">Terakhir Transaksi</th>
                  <th className="py-3 px-4">Capaian Transaksi</th>
                  <th className="py-3 px-4 text-right">Saldo Kas Akhir</th>
                  <th className="py-3 px-4">Bendahara / Kontak</th>
                  <th className="py-3 px-4 text-center">Aksi / Pengingat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {processedCapaianList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      Tidak ada lingkungan yang sesuai dengan filter atau kata kunci pencarian.
                    </td>
                  </tr>
                ) : (
                  processedCapaianList.map((item, idx) => {
                    const waLink = getWaReminderLink(
                      item.pengurus.bendahara_nama,
                      item.pengurus.bendahara_kontak,
                      item.pengurus.ketua_nama,
                      item.pengurus.ketua_kontak,
                      item.nama_lingkungan,
                      item.act.daysInactive
                    )

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 text-center text-slate-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 font-serif">
                            {formatNamaLingkungan(item.nama_lingkungan)}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="px-1.5 py-0.2 rounded font-semibold text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                              {item.wilayah}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {lingkunganUmatStats[item.id]?.kkCount || 0} KK
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {item.act.statusKeaktifan === 'AKTIF' && (
                            <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80 inline-flex items-center gap-1.5 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                              Aktif ({item.act.daysInactive === 0 ? 'Hari ini' : `${item.act.daysInactive} hr lalu`})
                            </span>
                          )}
                          {item.act.statusKeaktifan === 'PERHATIAN' && (
                            <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 inline-flex items-center gap-1.5 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                              Perhatian ({item.act.daysInactive} hr lalu)
                            </span>
                          )}
                          {item.act.statusKeaktifan === 'PASIF' && (
                            <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200/80 inline-flex items-center gap-1.5 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                              Pasif ({item.act.daysInactive} hr lalu)
                            </span>
                          )}
                          {item.act.statusKeaktifan === 'BELUM_ADA_DATA' && (
                            <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/80 inline-flex items-center gap-1.5 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              Belum Ada Data
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {item.act.lastTxDate ? (
                            <div>
                              <div className="font-semibold text-slate-800">
                                {formatDateIndo(item.act.lastTxDate)}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {item.act.daysInactive === 0 ? 'Hari ini' : `${item.act.daysInactive} hari lalu`}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Belum pernah mengisi</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800">
                            {item.act.totalTransaksi} transaksi
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Masuk: {formatRupiah(item.act.totalMasuk)}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Keluar: {formatRupiah(item.act.totalKeluar)}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {formatRupiah(item.act.saldoKas)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800 truncate max-w-[130px]">
                            {item.pengurus.bendahara_nama || item.pengurus.ketua_nama || 'Belum diisi'}
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <span>📞</span> {item.pengurus.bendahara_kontak && item.pengurus.bendahara_kontak !== '-' ? item.pengurus.bendahara_kontak : (item.pengurus.ketua_kontak || '-')}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {waLink ? (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition shadow-2xs cursor-pointer"
                                title="Kirim pesan WhatsApp pengingat ke Bendahara Lingkungan"
                              >
                                <MessageCircle className="w-3.5 h-3.5 text-slate-600" />
                                <span>Ingatkan</span>
                              </a>
                            ) : (
                              <button
                                disabled
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 text-slate-300 border border-slate-200 cursor-not-allowed"
                                title="Nomor kontak pengurus belum tersedia"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>Ingatkan</span>
                              </button>
                            )}

                            <Button
                              size="sm"
                              onClick={() => handleSelect(item.id)}
                              className="h-7 px-2.5 text-xs font-semibold bg-slate-700 hover:bg-slate-800 text-white rounded-lg cursor-pointer transition shadow-2xs"
                              title="Buka dashboard detail lingkungan ini"
                            >
                              Dashboard →
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW TAB 2: DIREKTORI UMUM & REKAPITULASI KAS (ORIGINAL FULL DIRECTORY) */}
      {activeTab === 'DIREKTORI' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-serif">
                Daftar Rekapitulasi 69 Lingkungan &amp; Pengurus
              </h3>
              <p className="text-xs text-slate-400">
                Menampilkan {processedCapaianList.length} dari 69 lingkungan Paroki St. Clara
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Cari nama lingkungan / wilayah..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
                  <th className="py-3 px-4">Ketua Lingkungan</th>
                  <th className="py-3 px-4">Bendahara</th>
                  <th className="py-3 px-4 text-center">Jumlah KK</th>
                  <th className="py-3 px-4 text-center">Jumlah Jiwa</th>
                  <th className="py-3 px-4 text-right">Saldo Kas</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {processedCapaianList.map((item, idx) => {
                  const stat = lingkunganUmatStats[item.id] || { kkCount: 0, jiwaCount: 0 }
                  const kas = item.act.saldoKas

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 font-serif">
                          {formatNamaLingkungan(item.nama_lingkungan)}
                        </div>
                        <div className="text-[10px] text-slate-400">{item.slug}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded font-semibold text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                          {item.wilayah}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={item.pengurus.ketua_nama ? "font-medium text-slate-800" : "text-slate-400 italic"}>
                          {item.pengurus.ketua_nama || 'Belum diisi'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={item.pengurus.bendahara_nama ? "font-medium text-slate-800" : "text-slate-400 italic"}>
                          {item.pengurus.bendahara_nama || 'Belum diisi'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                        {stat.kkCount} KK
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-600">
                        {stat.jiwaCount} Jiwa
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatRupiah(kas)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          size="sm"
                          onClick={() => handleSelect(item.id)}
                          className="h-7 px-2.5 text-[11px] font-semibold bg-slate-100 hover:bg-slate-600 text-slate-700 hover:text-white border border-slate-200 rounded-lg cursor-pointer transition shadow-2xs"
                        >
                          Buka Dashboard →
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
