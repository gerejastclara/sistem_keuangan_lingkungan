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
  HeartHandshake
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getAllMasterLingkungan, formatNamaLingkungan, getWilayahForLingkungan } from '@/lib/constants'
import { getDafuApprovals, DafuApprovalItem } from '@/lib/dafuApproval'
import { ensureDummyKksForLingkungan, getDummyAnggotaForKk, santaClaraStats } from '@/lib/dummyData'

export function SekretarisParokiDashboard() {
  const [approvals, setApprovals] = useState<DafuApprovalItem[]>([])
  const [searchLingkungan, setSearchLingkungan] = useState('')
  const [selectedLingkunganId, setSelectedLingkunganId] = useState<string>('all')

  const masterList = getAllMasterLingkungan()

  // Real aggregate KK and Jiwa counts per Lingkungan from Santa Clara dataset
  const lingkunganUmatStats = useMemo(() => {
    const map: Record<string, { kkCount: number; jiwaCount: number }> = {}
    masterList.forEach(ling => {
      const kks = ensureDummyKksForLingkungan(ling.id, ling.nama_lingkungan, [])
      let jiwa = 0
      kks.forEach(k => {
        const anggota = getDummyAnggotaForKk(k)
        jiwa += (anggota && anggota.length > 0) ? anggota.length : (k.jumlah_anggota || 1)
      })
      map[ling.id] = { kkCount: kks.length, jiwaCount: jiwa }
    })
    return map
  }, [masterList])

  const loadApprovals = () => {
    setApprovals(getDafuApprovals())
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

  // Filter master lingkungan by search & selectedLingkunganId from Navbar
  const filteredLingkungan = useMemo(() => {
    let list = masterList
    if (selectedLingkunganId && selectedLingkunganId !== 'all') {
      const matched = list.filter(l => l.id === selectedLingkunganId)
      if (matched.length > 0) list = matched
    }
    const q = searchLingkungan.toLowerCase().trim()
    if (!q) return list
    return list.filter(l =>
      l.nama_lingkungan.toLowerCase().includes(q) ||
      getWilayahForLingkungan(l.nama_lingkungan).toLowerCase().includes(q)
    )
  }, [masterList, selectedLingkunganId, searchLingkungan])

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
              <ShieldCheck className="w-3.5 h-3.5 text-[#A9834F]" />
              Sekretariat Paroki St. Clara
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-serif text-slate-900">
              Dashboard Seluruh Lingkungan
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
              Pemantauan terpusat data umat, persebaran Kepala Keluarga, klasifikasi golongan, dan verifikasi approval DAFU untuk seluruh 69 Lingkungan Paroki St. Clara.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link href="/dashboard/approval">
              <Button
                size="sm"
                className="bg-[#A9834F] hover:bg-[#8e6d3e] text-white text-xs rounded-xl font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Modul Approval</span>
                {pendingCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold animate-pulse">
                    {pendingCount}
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

      {/* Pending Approval Callout Banner if any - Soft Grey Aesthetic */}
      {pendingCount > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 font-bold shadow-2xs">
              <Clock className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900">
                Ada {pendingCount} Permohonan Approval DAFU Menunggu Persetujuan
              </h4>
              <p className="text-xs text-slate-600">
                Sekretaris Lingkungan telah mengajukan penambahan atau perubahan data umat. Segera tinjau untuk memperbarui basis data paroki.
              </p>
            </div>
          </div>

          <Link href="/dashboard/approval" className="shrink-0">
            <Button
              size="sm"
              className="w-full sm:w-auto bg-[#A9834F] hover:bg-[#8e6d3e] text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <span>Tinjau Sekarang</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      )}

      {/* 4 Global Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Lingkungan */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Lingkungan</span>
            <Building2 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">69 Lingkungan</div>
          <p className="text-[11px] text-slate-400">13 Wilayah terintegrasi aktif</p>
        </div>

        {/* Card 2: Total KK Terdata */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Kepala Keluarga (KK)</span>
            <Home className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">2.884 KK</div>
          <p className="text-[11px] text-emerald-700 font-medium">Rata-rata 42 KK / lingkungan</p>
        </div>

        {/* Card 3: Total Jiwa / Umat */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Jiwa / Umat</span>
            <Users className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">9.802 Jiwa</div>
          <p className="text-[11px] text-sky-700 font-medium">94% Terdaftar BIDUK KAJ</p>
        </div>

        {/* Card 4: Status Approval */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Status Approval DAFU</span>
            <ShieldCheck className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {pendingCount} <span className="text-xs font-bold text-amber-700">Pending</span>
          </div>
          <p className="text-[11px] text-slate-400">
            {approvals.filter(a => a.status === 'APPROVED').length} Permohonan disetujui
          </p>
        </div>
      </div>

      {/* Golongan Summary Overview Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 font-serif">
              <SlidersHorizontal className="w-4 h-4 text-[#A9834F]" />
              Distribusi Kategori Golongan Umat (Seluruh Paroki)
            </h3>
            <p className="text-xs text-slate-500">
              Klasifikasi kondisi sosial ekonomi keluarga berbasis pedoman DUPRAS KAJ.
            </p>
          </div>
          <Link href="/dashboard/kriteria-golongan">
            <span className="text-xs text-[#A9834F] font-bold hover:underline flex items-center gap-1 cursor-pointer">
              Atur Kriteria →
            </span>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-1">
            <div className="text-xs font-bold text-emerald-800 flex items-center justify-between">
              <span>Keluarga Sejahtera</span>
              <span className="text-sm">🟢</span>
            </div>
            <div className="text-xl font-extrabold text-emerald-950">2.328 KK (80.7%)</div>
            <p className="text-[11px] text-emerald-700">Mandiri, mampu berswacita & bergotong royong</p>
          </div>

          <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 space-y-1">
            <div className="text-xs font-bold text-amber-800 flex items-center justify-between">
              <span>Terduga Prasejahtera</span>
              <span className="text-sm">🟡</span>
            </div>
            <div className="text-xl font-extrabold text-amber-950">438 KK (15.2%)</div>
            <p className="text-[11px] text-amber-700">Perlu pendampingan & pemantauan berkala</p>
          </div>

          <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60 space-y-1">
            <div className="text-xs font-bold text-rose-800 flex items-center justify-between">
              <span>Rentan Tidak Mampu</span>
              <span className="text-sm">🔴</span>
            </div>
            <div className="text-xl font-extrabold text-rose-950">118 KK (4.1%)</div>
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
            {selectedLingkunganId && selectedLingkunganId !== 'all' && (
              <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-semibold">
                <span>Filter Aktif: {formatNamaLingkungan(filteredLingkungan[0]?.nama_lingkungan || '')}</span>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('selected_lingkungan_id', 'all')
                    setSelectedLingkunganId('all')
                    window.dispatchEvent(new Event('lingkunganChanged'))
                    window.dispatchEvent(new Event('storage'))
                  }}
                  className="hover:text-indigo-950 font-bold ml-1 cursor-pointer underline"
                  title="Kembali ke Seluruh Lingkungan"
                >
                  ✕ Tampilkan Semua 69
                </button>
              </div>
            )}
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
                          className="h-7 px-2.5 text-[11px] font-bold text-[#A9834F] hover:text-[#8e6d3e] hover:bg-[#A9834F]/10 rounded-lg cursor-pointer"
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
    </div>
  )
}
