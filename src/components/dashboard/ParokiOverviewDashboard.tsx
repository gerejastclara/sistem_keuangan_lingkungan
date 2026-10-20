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
  ExternalLink
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getAllMasterLingkungan, formatNamaLingkungan, getWilayahForLingkungan, getLingkunganDbUuid } from '@/lib/constants'
import { ensureDummyKksForLingkungan, getLingkunganStats, santaClaraStats } from '@/lib/dummyData'
import { getPengurusForLingkungan } from '@/lib/pengurusData'
import { createClient } from '@/utils/supabase/client'
import { formatRupiah } from '@/lib/utils'

interface ParokiOverviewDashboardProps {
  onSelectLingkungan?: (id: string) => void
}

export function ParokiOverviewDashboard({ onSelectLingkungan }: ParokiOverviewDashboardProps) {
  const supabase = createClient()
  const masterList = getAllMasterLingkungan()
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [profilMap, setProfilMap] = useState<Map<string, any>>(new Map())
  const [lingkunganKasMap, setLingkunganKasMap] = useState<Record<string, number>>({})

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

        // 2. Fetch all journals to calculate aggregate cash balance per lingkungan
        const { data: dbJournals } = await supabase
          .from('jurnal_transaksi')
          .select('lingkungan_id, tipe_arus, nominal, keterangan, no_bukti')

        const kasMap: Record<string, number> = {}

        // Initialize with initial balances from profil_lingkungan
        masterList.forEach(ling => {
          const dbUuid = getLingkunganDbUuid(ling.id)
          const p = pMap.get(dbUuid) || pMap.get(ling.id)
          kasMap[ling.id] = Number(p?.saldo_awal || 0)
        })

        if (dbJournals && Array.isArray(dbJournals)) {
          dbJournals.forEach(j => {
            const nom = Number(j.nominal) || 0
            const matchedLing = masterList.find(m => {
              const u = getLingkunganDbUuid(m.id)
              return m.id === j.lingkungan_id || u === j.lingkungan_id
            })
            const lKey = matchedLing ? matchedLing.id : j.lingkungan_id
            if (!kasMap[lKey]) kasMap[lKey] = 0

            if (j.no_bukti === '[SA/1100]' || (j.keterangan || '').includes('[SALDO_AWAL]')) {
              // already accounted
              return
            }

            if (j.tipe_arus === 'MASUK') {
              kasMap[lKey] += nom
            } else if (j.tipe_arus === 'KELUAR') {
              kasMap[lKey] -= nom
            }
          })
        }

        setLingkunganKasMap(kasMap)
      } catch (err) {
        console.error('Error loading paroki overview data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadParokiOverview()
  }, [])

  // Calculate active pengurus count
  const activePengurusCount = useMemo(() => {
    let count = 0
    masterList.forEach(ling => {
      const dbUuid = getLingkunganDbUuid(ling.id)
      const p = profilMap.get(dbUuid) || profilMap.get(ling.id)
      const pengurus = getPengurusForLingkungan(ling.id, ling.nama_lingkungan, p)
      if (pengurus && (pengurus.status === 'Aktif' || pengurus.ketua_nama || pengurus.bendahara_nama)) {
        count++
      }
    })
    return count
  }, [masterList, profilMap])

  // Total cash accumulated across all 69 lingkungan
  const totalKasParoki = useMemo(() => {
    return Object.values(lingkunganKasMap).reduce((acc, curr) => acc + curr, 0)
  }, [lingkunganKasMap])

  // Filter 69 Lingkungan by search
  const filteredLingkungan = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return masterList
    return masterList.filter(l =>
      l.nama_lingkungan.toLowerCase().includes(q) ||
      getWilayahForLingkungan(l.nama_lingkungan).toLowerCase().includes(q)
    )
  }, [masterList, searchQuery])

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
              Pusat monitoring terpadu seluruh 69 Lingkungan: konsolidasi saldo kas paroki, data riil 2.884 KK & 9.802 Jiwa Umat, susunan pengurus, dan akses cepat ke dashboard per lingkungan.
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
                className="bg-slate-600 hover:bg-slate-700 text-white text-xs rounded-xl font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Monitoring Kas & Setoran</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Lingkungan */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Lingkungan</span>
            <Building2 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">69 Lingkungan</div>
          <p className="text-[11px] text-slate-400">13 Wilayah aktif terdaftar</p>
        </div>

        {/* Card 2: Total KK */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Kepala Keluarga (KK)</span>
            <Home className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {santaClaraStats.totalFamilies.toLocaleString('id-ID')} KK
          </div>
          <p className="text-[11px] text-emerald-700 font-medium">
            {santaClaraStats.totalMembers.toLocaleString('id-ID')} Jiwa terdata resmi
          </p>
        </div>

        {/* Card 3: Konsolidasi Saldo Kas */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Akumulasi Saldo Kas Se-Paroki</span>
            <Wallet className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">
            {formatRupiah(totalKasParoki)}
          </div>
          <p className="text-[11px] text-slate-400">Total kas seluruh lingkungan</p>
        </div>

        {/* Card 4: Pengurus Terdata */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Pengurus Terdata</span>
            <UserCheck className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {activePengurusCount} Lingkungan
          </div>
          <p className="text-[11px] text-sky-700 font-medium">Status Aktif & Masa Bakti Sah</p>
        </div>
      </div>

      {/* Info Callout Bar */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-base">💡</span>
          <span>
            Saat ini Anda berada dalam mode <strong>Seluruh Lingkungan (Paroki Overview)</strong>. Untuk melihat rincian kas, buku jurnal, aset, dan kartu setoran per lingkungan, silakan pilih lingkungan dari dropdown di Navbar atas atau klik tombol <strong>&ldquo;Buka Dashboard Lingkungan&rdquo;</strong> di tabel bawah.
          </span>
        </div>
      </div>

      {/* Tabel Rekapitulasi 69 Lingkungan */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 font-serif">
              Daftar Rekapitulasi 69 Lingkungan
            </h3>
            <p className="text-xs text-slate-400">
              Menampilkan {filteredLingkungan.length} dari 69 lingkungan Paroki St. Clara
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
              {filteredLingkungan.map((l, idx) => {
                const dbUuid = getLingkunganDbUuid(l.id)
                const p = profilMap.get(dbUuid) || profilMap.get(l.id)
                const pengurus = getPengurusForLingkungan(l.id, l.nama_lingkungan, p)
                const stat = lingkunganUmatStats[l.id] || { kkCount: 0, jiwaCount: 0 }
                const kas = lingkunganKasMap[l.id] || 0

                return (
                  <tr key={l.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 text-center text-slate-400 font-mono">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 font-serif">
                        {formatNamaLingkungan(l.nama_lingkungan)}
                      </div>
                      <div className="text-[10px] text-slate-400">{l.slug}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded font-semibold text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                        {getWilayahForLingkungan(l.nama_lingkungan)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={pengurus.ketua_nama ? "font-medium text-slate-800" : "text-slate-400 italic"}>
                        {pengurus.ketua_nama || 'Belum diisi'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={pengurus.bendahara_nama ? "font-medium text-slate-800" : "text-slate-400 italic"}>
                        {pengurus.bendahara_nama || 'Belum diisi'}
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
                        onClick={() => handleSelect(l.id)}
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
    </div>
  )
}
