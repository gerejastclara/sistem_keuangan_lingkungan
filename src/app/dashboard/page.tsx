'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import {
  JurnalTransaksi,
  KepalaKeluarga,
  UserRole,
  UserProfile,
  AnggotaKeluarga,
  GolonganKeluarga,
  KategoriGolongan,
  Lingkungan
} from '@/lib/types'
import {
  ensureDummyKksForLingkungan,
  getDummyAnggotaForKk,
  getDummyGolonganForKk
} from '@/lib/dummyData'
import { formatRupiah, formatDateIndo } from '@/lib/utils'
import { formatNamaLingkungan, getAllMasterLingkungan } from '@/lib/constants'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  Package,
  ArrowRight,
  ClipboardEdit,
  Receipt,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Lock,
  Building,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Layers,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Search,
  ShieldCheck
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

export default function DashboardOverviewPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [userRole, setUserRole] = useState<UserRole>('BENDAHARA')
  const [lingkunganId, setLingkunganId] = useState<string | null>(null)
  const [lingkunganName, setLingkunganName] = useState<string>('')

  // Financial State (for Bendahara & Paroki)
  const [totalKasMasuk, setTotalKasMasuk] = useState(0)
  const [totalKasKeluar, setTotalKasKeluar] = useState(0)
  const [saldoAwal, setSaldoAwal] = useState(0)
  const [totalNilaiAset, setTotalNilaiAset] = useState(0)
  const [recentTransactions, setRecentTransactions] = useState<JurnalTransaksi[]>([])

  // Family & Umat State (for Sekretaris & Paroki overview)
  const [kkList, setKkList] = useState<KepalaKeluarga[]>([])
  const [anggotaMap, setAnggotaMap] = useState<Record<string, AnggotaKeluarga[]>>({})
  const [golonganMap, setGolonganMap] = useState<Record<string, GolonganKeluarga>>({})
  const [expandedKkIds, setExpandedKkIds] = useState<Set<string>>(new Set())

  // Filters & Search for Family Data
  const [searchQuery, setSearchQuery] = useState('')
  const [filterGolongan, setFilterGolongan] = useState<'ALL' | KategoriGolongan>('ALL')
  const [filterKaj, setFilterKaj] = useState<'ALL' | 'BIDUK' | 'NON_BIDUK'>('ALL')

  // Detail Modal for Family
  const [viewingKk, setViewingKk] = useState<KepalaKeluarga | null>(null)

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true)

      try {
        // 1. Get user profile & role
        const { data } = await supabase.auth.getUser()
        const user = data?.user

        let role: UserRole = 'BENDAHARA'
        let currentLId: string | null = null
        let currentLNama: string | null = null

        if (user) {
          const { data: uData } = await supabase.from('users').select('*, lingkungan:lingkungan_id(nama_lingkungan)').eq('id', user.id).maybeSingle()
          if (uData) {
            setUserProfile(uData)
            role = uData.role
            currentLId = uData.lingkungan_id
            currentLNama = uData.lingkungan?.nama_lingkungan || null
          }
        } else {
          // Check demo cookie
          const cookies = typeof document !== 'undefined' ? document.cookie : ''
          const getCookieVal = (name: string) => {
            const v = `; ${cookies}`
            const p = v.split(`; ${name}=`)
            if (p.length === 2) return decodeURIComponent(p.pop()!.split(';').shift()!)
            return null
          }

          if (cookies.includes('demo_user_role=SEKRETARIS') || cookies.includes('sekretaris')) {
            role = 'SEKRETARIS'
          } else if (cookies.includes('demo_user_role=PAROKI') || cookies.includes('paroki')) {
            role = 'PAROKI'
          } else {
            role = 'BENDAHARA'
          }

          currentLId = getCookieVal('demo_user_lingkungan_id')
          currentLNama = getCookieVal('demo_user_lingkungan_nama')

          setUserProfile({
            id: 'demo-user',
            email: `${role.toLowerCase()}@example.com`,
            role: role,
            lingkungan_id: role === 'PAROKI' ? null : currentLId,
            lingkungan_nama: role === 'PAROKI' ? undefined : (currentLNama || undefined),
          })
        }

        setUserRole(role)

        // 2. Resolve Target Lingkungan
        let targetLingkunganId: string | null = null
        if (role !== 'PAROKI' && currentLId) {
          targetLingkunganId = currentLId
        } else {
          targetLingkunganId = localStorage.getItem('selected_lingkungan_id')
          if (!targetLingkunganId) {
            const allM = getAllMasterLingkungan()
            targetLingkunganId = allM[0].id
          }
        }

        // Fetch Lingkungan Name
        const allM = getAllMasterLingkungan()
        const matchedM = allM.find(m => m.id === targetLingkunganId)
        const lName = matchedM?.nama_lingkungan || currentLNama || 'Lingkungan'
        setLingkunganName(lName)
        setLingkunganId(targetLingkunganId)

        if (targetLingkunganId) {
          // 3. Fetch DAFU & Anggota Data (Essential for Sekretaris & useful for all)
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

          const finalKks = ensureDummyKksForLingkungan(targetLingkunganId, lName, dbKks)
          setKkList(finalKks)

          // Load Anggota & Golongan
          await loadAnggotaAndGolongan(finalKks, targetLingkunganId)

          // 4. If Bendahara or Paroki, also load financial data
          if (role !== 'SEKRETARIS') {
            const { data: profil } = await supabase
              .from('profil_lingkungan')
              .select('saldo_awal')
              .eq('lingkungan_id', targetLingkunganId)
              .maybeSingle()

            const sa = Number(profil?.saldo_awal || 0)
            setSaldoAwal(sa)

            const { data: journals } = await supabase
              .from('jurnal_transaksi')
              .select('*, kepala_keluarga:kk_id(nama_kk)')
              .eq('lingkungan_id', targetLingkunganId)
              .order('tanggal', { ascending: false })

            if (journals) {
              let masuk = 0
              let keluar = 0
              journals.forEach((j) => {
                const nom = Number(j.nominal) || 0
                if (j.tipe_arus === 'MASUK') masuk += nom
                else keluar += nom
              })
              setTotalKasMasuk(masuk)
              setTotalKasKeluar(keluar)
              setRecentTransactions(journals.slice(0, 5))
            }

            const { data: asetList } = await supabase
              .from('aset')
              .select('jumlah, harga_satuan')
              .eq('lingkungan_id', targetLingkunganId)

            if (asetList) {
              const totalVal = asetList.reduce((acc, curr) => acc + (Number(curr.jumlah || 0) * Number(curr.harga_satuan || 0)), 0)
              setTotalNilaiAset(totalVal)
            }
          }
        }
      } catch (err) {
        console.error('Error loading dashboard overview:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [supabase])

  const loadAnggotaAndGolongan = async (kks: KepalaKeluarga[], lId: string) => {
    const kkIds = kks.map(k => k.id)
    const newAnggotaMap: Record<string, AnggotaKeluarga[]> = {}
    const newGolonganMap: Record<string, GolonganKeluarga> = {}

    let localAnggotaStore: Record<string, AnggotaKeluarga[]> = {}
    let localGolonganStore: Record<string, GolonganKeluarga> = {}
    try {
      const rawA = localStorage.getItem('custom_anggota_all_store')
      if (rawA) localAnggotaStore = JSON.parse(rawA)
      const rawG = localStorage.getItem('custom_golongan_all_store')
      if (rawG) localGolonganStore = JSON.parse(rawG)
    } catch (e) {}

    let supabaseAnggota: AnggotaKeluarga[] = []
    let supabaseGolongan: GolonganKeluarga[] = []

    if (kkIds.length > 0) {
      try {
        const { data: aData } = await supabase.from('anggota_keluarga').select('*').in('kk_id', kkIds)
        if (aData) supabaseAnggota = aData
      } catch (e) {}

      try {
        const { data: gData } = await supabase.from('golongan_keluarga').select('*').in('kk_id', kkIds)
        if (gData) supabaseGolongan = gData
      } catch (e) {}
    }

    kks.forEach(kk => {
      let members = supabaseAnggota.filter(a => a.kk_id === kk.id)
      if (members.length === 0 && localAnggotaStore[kk.id]) members = localAnggotaStore[kk.id]
      if (members.length === 0) members = getDummyAnggotaForKk(kk)
      newAnggotaMap[kk.id] = members

      let gol = supabaseGolongan.find(g => g.kk_id === kk.id)
      if (!gol && localGolonganStore[kk.id]) gol = localGolonganStore[kk.id]
      if (!gol) gol = getDummyGolonganForKk(kk)
      newGolonganMap[kk.id] = gol
    })

    setAnggotaMap(newAnggotaMap)
    setGolonganMap(newGolonganMap)
  }

  const toggleExpandKk = (id: string) => {
    setExpandedKkIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDeleteKk = async (id: string, nama: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus data Kepala Keluarga "${nama}"?`)) return

    try {
      await supabase.from('anggota_keluarga').delete().eq('kk_id', id)
      await supabase.from('golongan_keluarga').delete().eq('kk_id', id)
      await supabase.from('kepala_keluarga').delete().eq('id', id)
    } catch (err) {}

    setKkList(prev => {
      const updated = prev.filter(k => k.id !== id)
      if (lingkunganId) localStorage.setItem(`custom_kks_${lingkunganId}`, JSON.stringify(updated))
      return updated
    })

    setAnggotaMap(prev => {
      const next = { ...prev }
      delete next[id]
      try {
        const rawA = localStorage.getItem('custom_anggota_all_store')
        if (rawA) {
          const store = JSON.parse(rawA)
          delete store[id]
          localStorage.setItem('custom_anggota_all_store', JSON.stringify(store))
        }
      } catch (e) {}
      return next
    })

    setGolonganMap(prev => {
      const next = { ...prev }
      delete next[id]
      try {
        const rawG = localStorage.getItem('custom_golongan_all_store')
        if (rawG) {
          const store = JSON.parse(rawG)
          delete store[id]
          localStorage.setItem('custom_golongan_all_store', JSON.stringify(store))
        }
      } catch (e) {}
      return next
    })
  }

  // Filtered KK list for table
  const filteredKkList = kkList.filter(k => {
    const members = anggotaMap[k.id] || []
    const gol = golonganMap[k.id]?.golongan || 'MENENGAH'

    const matchesSearch =
      k.nama_kk.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (k.alamat && k.alamat.toLowerCase().includes(searchQuery.toLowerCase())) ||
      members.some(m => m.nama.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesGolongan = filterGolongan === 'ALL' || gol === filterGolongan
    const matchesKaj =
      filterKaj === 'ALL' ||
      (filterKaj === 'BIDUK' && k.is_biduk) ||
      (filterKaj === 'NON_BIDUK' && !k.is_biduk)

    return matchesSearch && matchesGolongan && matchesKaj
  })

  // Statistics calculation
  const totalKK = kkList.length
  let totalJiwa = 0
  let totalJiwaKaj = 0
  let totalJiwaNonKaj = 0
  let countMiskin = 0
  let countMenengah = 0
  let countAtas = 0

  kkList.forEach(k => {
    const members = anggotaMap[k.id] || []
    totalJiwa += members.length > 0 ? members.length : 1
    members.forEach(m => {
      if (m.is_kaj) totalJiwaKaj++
      else totalJiwaNonKaj++
    })

    const gol = golonganMap[k.id]?.golongan || 'MENENGAH'
    if (gol === 'MISKIN') countMiskin++
    else if (gol === 'ATAS') countAtas++
    else countMenengah++
  })

  const getGolonganBadge = (gol: KategoriGolongan = 'MENENGAH', note?: string | null) => {
    switch (gol) {
      case 'MISKIN':
        return (
          <span
            title={note || 'Golongan Bawah / Pra-sejahtera'}
            className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full text-xs font-bold"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Miskin (Bawah)
          </span>
        )
      case 'ATAS':
        return (
          <span
            title={note || 'Golongan Atas / Mampu'}
            className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-bold"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Mampu (Atas)
          </span>
        )
      case 'MENENGAH':
      default:
        return (
          <span
            title={note || 'Golongan Menengah'}
            className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full text-xs font-bold"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Menengah
          </span>
        )
    }
  }

  const saldoKasAkhir = saldoAwal + totalKasMasuk - totalKasKeluar

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  // ==========================================
  // VIEW KHUSUS SEKRETARIS: DASHBOARD DATA UMAT (GAMBAR 1)
  // ==========================================
  if (userRole === 'SEKRETARIS') {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[#1B2130] tracking-tight font-serif">
                Dashboard Data Umat & Keluarga
              </h1>
              <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                Sistem Desil & KAJ
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Rangkuman data seluruh umat, rincian keluarga, & klasifikasi desil lingkungan{' '}
              <span className="text-emerald-700 font-semibold">{formatNamaLingkungan(lingkunganName)}</span>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Locked Lingkungan Indicator */}
            <div className="bg-slate-100/90 border border-slate-300 text-slate-800 rounded-xl px-3.5 py-2 flex items-center gap-2 font-bold text-xs h-11 shrink-0 shadow-2xs">
              <Building className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">{formatNamaLingkungan(lingkunganName)}</span>
              <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono ml-auto shrink-0 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Terkunci
              </span>
            </div>

            {/* Direct Link to DAFU Input Module */}
            <Link href="/dashboard/dafu">
              <Button className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs cursor-pointer h-11 shrink-0 w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2 text-emerald-400" />
                Input Data di DAFU
              </Button>
            </Link>
          </div>
        </div>

        {/* Notice Banner */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100/70 text-emerald-800 rounded-xl">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-800">Database Terpisah & Klasifikasi Mandiri:</span> Data Kepala Keluarga, Anggota Umat, dan Kriteria Desil/Golongan disimpan dalam tabel independen. Klasifikasi ekonomi ditentukan langsung oleh <b>Sekretaris</b> untuk evaluasi lingkungan.
            </div>
          </div>
          <div className="flex items-center gap-2 self-end md:self-center">
            <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-slate-600 font-medium">
              Peran Anda: <b className="text-slate-900">SEKRETARIS</b>
            </span>
          </div>
        </div>

        {/* Summary Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total KK & Total Jiwa */}
          <Card className="bg-white border-slate-200 rounded-2xl p-1 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Total KK & Total Jiwa</CardTitle>
              <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                <Users className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-slate-900">{totalKK}</span>
                <span className="text-sm font-semibold text-slate-500">KK</span>
                <span className="text-xs text-slate-400">/</span>
                <span className="text-2xl font-extrabold text-blue-600">{totalJiwa}</span>
                <span className="text-sm font-semibold text-slate-500">Jiwa Umat</span>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Status Terdaftar KAJ */}
          <Card className="bg-emerald-50/50 border-emerald-200 rounded-2xl p-1 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-800">Terdaftar BIDUK KAJ</CardTitle>
              <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-extrabold text-emerald-950">
                  {totalJiwaKaj} <span className="text-xs font-normal text-emerald-700">Jiwa</span>
                </div>
                <div className="text-xs text-slate-500">
                  {totalJiwaNonKaj} Jiwa Belum KAJ
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Klasifikasi Desil / Golongan */}
          <Card className="bg-white border-slate-200 rounded-2xl p-1 shadow-xs sm:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Klasifikasi Golongan Keluarga (Sistem Desil Sekretaris)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-rose-50/80 border border-rose-200/80 rounded-xl p-2">
                  <div className="text-xs font-bold text-rose-700">Miskin (Bawah)</div>
                  <div className="text-xl font-extrabold text-rose-900 mt-0.5">{countMiskin} <span className="text-xs font-normal">KK</span></div>
                </div>
                <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-2">
                  <div className="text-xs font-bold text-amber-800">Menengah</div>
                  <div className="text-xl font-extrabold text-amber-950 mt-0.5">{countMenengah} <span className="text-xs font-normal">KK</span></div>
                </div>
                <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-2">
                  <div className="text-xs font-bold text-emerald-800">Mampu (Atas)</div>
                  <div className="text-xl font-extrabold text-emerald-950 mt-0.5">{countAtas} <span className="text-xs font-normal">KK</span></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filter Toolbar */}
        <Card className="bg-white border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <CardHeader className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <span className="text-base font-bold text-slate-800">
                Daftar Umat & Keluarga ({filteredKkList.length} dari {kkList.length} KK)
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Golongan Filter */}
              <div className="w-full sm:w-44">
                <Select value={filterGolongan} onValueChange={(val) => setFilterGolongan(val as any)}>
                  <SelectTrigger className="bg-white border-slate-200 text-slate-800 rounded-xl text-xs h-10">
                    <SelectValue placeholder="Semua Golongan" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-slate-900">
                    <SelectItem value="ALL">Semua Golongan</SelectItem>
                    <SelectItem value="MISKIN">Miskin (Bawah)</SelectItem>
                    <SelectItem value="MENENGAH">Menengah</SelectItem>
                    <SelectItem value="ATAS">Mampu (Atas)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* KAJ Status Filter */}
              <div className="w-full sm:w-40">
                <Select value={filterKaj} onValueChange={(val) => setFilterKaj(val as any)}>
                  <SelectTrigger className="bg-white border-slate-200 text-slate-800 rounded-xl text-xs h-10">
                    <SelectValue placeholder="Status KAJ" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-slate-900">
                    <SelectItem value="ALL">Semua Status KAJ</SelectItem>
                    <SelectItem value="BIDUK">Terdaftar KAJ</SelectItem>
                    <SelectItem value="NON_BIDUK">Belum KAJ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search Input */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <Input
                  placeholder="Cari nama KK, anggota, alamat..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-white border-slate-200 text-slate-900 rounded-xl text-xs h-10 focus:ring-emerald-500"
                />
              </div>
            </div>
          </CardHeader>

          {/* Interactive Expandable Table */}
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80 text-slate-700 font-bold border-b border-slate-200 text-xs">
                <TableRow>
                  <TableHead className="w-10 text-center"></TableHead>
                  <TableHead className="w-12 text-center text-slate-700 font-bold">No</TableHead>
                  <TableHead className="text-slate-800 font-bold">Nama Kepala Keluarga & Peran</TableHead>
                  <TableHead className="text-slate-800 font-bold">Golongan (Desil)</TableHead>
                  <TableHead className="text-slate-800 font-bold">Anggota Keluarga (Jiwa)</TableHead>
                  <TableHead className="text-center text-slate-800 font-bold">Status KAJ</TableHead>
                  <TableHead className="text-right text-slate-800 font-bold">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {filteredKkList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-slate-400 text-sm">
                      Tidak ada data Kepala Keluarga yang cocok dengan pencarian atau filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredKkList.map((kk, idx) => {
                    const isExpanded = expandedKkIds.has(kk.id)
                    const members = anggotaMap[kk.id] || []
                    const golObj = golonganMap[kk.id]
                    const gol = golObj?.golongan || 'MENENGAH'

                    return (
                      <React.Fragment key={kk.id}>
                        <TableRow className={`hover:bg-slate-50/80 transition ${isExpanded ? 'bg-slate-50/50' : ''}`}>
                          {/* Expand Button */}
                          <TableCell className="text-center p-2">
                            <button
                              type="button"
                              onClick={() => toggleExpandKk(kk.id)}
                              className="p-1 rounded hover:bg-slate-200 text-slate-500 transition cursor-pointer"
                              title={isExpanded ? 'Tutup rincian anggota keluarga' : 'Buka rincian anggota keluarga'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          </TableCell>

                          {/* Number */}
                          <TableCell className="text-center font-mono text-xs text-slate-500">
                            {idx + 1}
                          </TableCell>

                          {/* Name + Address */}
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-slate-900">{kk.nama_kk}</span>
                              <span className="text-xs text-slate-500">{kk.alamat || 'Alamat belum diisi'}</span>
                            </div>
                          </TableCell>

                          {/* Golongan Badge */}
                          <TableCell>
                            <div className="flex flex-col gap-1 items-start">
                              {getGolonganBadge(gol, golObj?.kriteria_catatan)}
                              {golObj?.kriteria_catatan && (
                                <span className="text-[11px] text-slate-500 line-clamp-1 max-w-xs italic">
                                  &ldquo;{golObj.kriteria_catatan}&rdquo;
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Anggota Summary Button */}
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => toggleExpandKk(kk.id)}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:border-emerald-300 px-2.5 py-1 rounded-xl shadow-2xs hover:bg-emerald-50/40 transition cursor-pointer"
                            >
                              <Users className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{members.length} Jiwa</span>
                              <span className="text-[11px] text-slate-400">
                                ({isExpanded ? 'Sembunyikan' : 'Rincian'})
                              </span>
                            </button>
                          </TableCell>

                          {/* KAJ Status */}
                          <TableCell className="text-center">
                            {kk.is_biduk ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold px-2.5 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Terdaftar KAJ
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                <XCircle className="w-3.5 h-3.5" /> Belum KAJ
                              </span>
                            )}
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right space-x-1 whitespace-nowrap">
                            <Link href={`/dashboard/dafu?edit=${kk.id}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer text-xs"
                                title="Edit di DAFU"
                              >
                                <Pencil className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                                Edit
                              </Button>
                            </Link>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewingKk(kk)}
                              className="h-8 px-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer text-xs"
                              title="Lihat Detail"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              Detail
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteKk(kk.id, kk.nama_kk)}
                              className="h-8 w-8 p-0 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Hapus KK"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Subtable (List of all members in this KK) */}
                        {isExpanded && (
                          <TableRow className="bg-slate-50/70 border-b border-slate-200">
                            <TableCell colSpan={7} className="p-4 pl-12">
                              <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs">
                                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                                  <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-emerald-600" />
                                    <span className="text-xs font-bold text-slate-800">
                                      Daftar Anggota Keluarga ({kk.nama_kk})
                                    </span>
                                  </div>
                                  <Link href={`/dashboard/dafu?edit=${kk.id}`}>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer"
                                    >
                                      <Pencil className="w-3 h-3 mr-1" /> Edit di DAFU
                                    </Button>
                                  </Link>
                                </div>

                                {members.length === 0 ? (
                                  <p className="text-xs text-slate-400 py-2">
                                    Belum ada rincian anggota keluarga yang diinput untuk KK ini.
                                  </p>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                    {members.map((m, mIdx) => (
                                      <div
                                        key={m.id || mIdx}
                                        className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between"
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div>
                                            <div className="text-xs font-bold text-slate-900">{m.nama}</div>
                                            <div className="text-[11px] font-medium text-emerald-700 mt-0.5">
                                              Peran: {m.peran}
                                            </div>
                                          </div>
                                          {m.is_kaj ? (
                                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-md shrink-0">
                                              KAJ
                                            </span>
                                          ) : (
                                            <span className="text-[10px] bg-slate-200 text-slate-600 font-medium px-1.5 py-0.5 rounded-md shrink-0">
                                              Non-KAJ
                                            </span>
                                          )}
                                        </div>
                                        {m.keterangan && (
                                          <div className="text-[10px] text-slate-500 mt-1 italic">
                                            {m.keterangan}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={!!viewingKk} onOpenChange={(open) => !open && setViewingKk(null)}>
          <DialogContent className="sm:max-w-xl bg-white border-slate-200 text-slate-900 rounded-2xl p-6">
            {viewingKk && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-slate-800 font-bold text-lg flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-600" />
                    Rincian Kartu Keluarga Umat
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2 text-sm">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-slate-500 font-medium">Nama Kepala Keluarga:</span>
                        <div className="text-base font-bold text-slate-900">{viewingKk.nama_kk}</div>
                      </div>
                      <div>
                        {getGolonganBadge(
                          golonganMap[viewingKk.id]?.golongan,
                          golonganMap[viewingKk.id]?.kriteria_catatan
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 font-medium">Alamat Rumah:</span>
                      <div className="text-slate-700">{viewingKk.alamat || '-'}</div>
                    </div>
                    {golonganMap[viewingKk.id]?.kriteria_catatan && (
                      <div className="pt-1 border-t border-slate-200/80 text-xs text-slate-600">
                        <span className="font-semibold">Catatan Kriteria Sekretaris:</span>{' '}
                        &ldquo;{golonganMap[viewingKk.id]?.kriteria_catatan}&rdquo;
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      Daftar Anggota Keluarga ({anggotaMap[viewingKk.id]?.length || 0} Jiwa)
                    </div>
                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                      {(anggotaMap[viewingKk.id] || []).map((m, idx) => (
                        <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-50">
                          <div>
                            <div className="font-bold text-slate-900 text-xs">{m.nama}</div>
                            <div className="text-[11px] text-emerald-700">Peran: {m.peran}</div>
                          </div>
                          <div>
                            {m.is_kaj ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3" /> Terdaftar KAJ
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                                <XCircle className="w-3 h-3" /> Non-KAJ
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setViewingKk(null)}
                    className="border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl"
                  >
                    Tutup
                  </Button>
                  <Link href={`/dashboard/dafu?edit=${viewingKk.id}`}>
                    <Button
                      type="button"
                      className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl cursor-pointer"
                    >
                      Edit di DAFU
                    </Button>
                  </Link>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ==========================================
  // VIEW UNTUK BENDAHARA & PAROKI: DASHBOARD KEUANGAN & IKHTISAR
  // ==========================================
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src="/logo-st-clara.jpg"
            alt="Logo St. Clara"
            className="w-12 h-12 rounded-full object-cover border border-amber-400/50 bg-white shrink-0 shadow-md"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
                {formatNamaLingkungan(lingkunganName) || 'Lingkungan'}
              </span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Gereja St. Clara
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tracking-tight">Ringkasan Keuangan Lingkungan</h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              Pantau arus kas, posisi saldo bank, data umat (DAFU), dan inventaris aset secara akurat.
            </p>
          </div>
        </div>

        <div className="flex gap-2.5 shrink-0">
          <Link href="/dashboard/jurnal">
            <Button className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs cursor-pointer">
              <Receipt className="w-4 h-4 mr-2 text-emerald-400" />
              Input Jurnal
            </Button>
          </Link>
          <Link href="/dashboard/laporan">
            <Button variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold rounded-xl cursor-pointer">
              <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />
              Laporan
            </Button>
          </Link>
        </div>
      </div>

      {/* Top 4 Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Saldo Kas */}
        <Card className="bg-white border-slate-200 rounded-2xl p-1 shadow-xs hover:border-slate-300 transition">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Saldo Akhir Kas & Bank</CardTitle>
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-700">
              <Wallet className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">{formatRupiah(saldoKasAkhir)}</div>
            <p className="text-[11px] text-slate-400 mt-1">
              Termasuk saldo awal {formatRupiah(saldoAwal)}
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Kas Masuk */}
        <Card className="bg-white border-slate-200 rounded-2xl p-1 shadow-xs hover:border-slate-300 transition">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Kas Masuk</CardTitle>
            <div className="p-2 bg-blue-50 rounded-xl text-blue-700">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-blue-900 tracking-tight">{formatRupiah(totalKasMasuk)}</div>
            <p className="text-[11px] text-slate-400 mt-1">Akumulasi iuran, kolekte & derma</p>
          </CardContent>
        </Card>

        {/* Card 3: Kas Keluar */}
        <Card className="bg-white border-slate-200 rounded-2xl p-1 shadow-xs hover:border-slate-300 transition">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Kas Keluar</CardTitle>
            <div className="p-2 bg-rose-50 rounded-xl text-rose-700">
              <TrendingDown className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-rose-900 tracking-tight">{formatRupiah(totalKasKeluar)}</div>
            <p className="text-[11px] text-slate-400 mt-1">Kegiatan, operasional & sosial</p>
          </CardContent>
        </Card>

        {/* Card 4: Data KK & Umat */}
        <Card className="bg-white border-slate-200 rounded-2xl p-1 shadow-xs hover:border-slate-300 transition">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Total KK & Jiwa Umat</CardTitle>
            <div className="p-2 bg-purple-50 rounded-xl text-purple-700">
              <Users className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">{totalKK} <span className="text-sm font-normal text-slate-500">KK ({totalJiwa} Jiwa)</span></div>
            <p className="text-[11px] text-slate-400 mt-1">
              {totalJiwaKaj} Jiwa Terdaftar KAJ
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Transactions */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-white border-slate-200 rounded-2xl shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <CardTitle className="text-base font-bold text-slate-800">Transaksi Kas Terakhir</CardTitle>
                <CardDescription className="text-slate-400 text-xs">Aktivitas penerimaan & pengeluaran kas lingkungan</CardDescription>
              </div>
              <Link href="/dashboard/jurnal" className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1">
                Buka Jurnal <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {recentTransactions.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">
                  Belum ada transaksi jurnal kas yang tercatat.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentTransactions.map((tx) => (
                    <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${tx.tipe_arus === 'MASUK' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          {tx.tipe_arus === 'MASUK' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-800">{tx.keterangan || (tx.tipe_arus === 'MASUK' ? 'Penerimaan Kas' : 'Pengeluaran Kas')}</div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {formatDateIndo(tx.tanggal)} {tx.kepala_keluarga ? `• Dari: ${tx.kepala_keluarga.nama_kk}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-extrabold ${tx.tipe_arus === 'MASUK' ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {tx.tipe_arus === 'MASUK' ? '+' : '-'} {formatRupiah(Number(tx.nominal))}
                        </div>
                        <span className="text-[10px] bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded">
                          {tx.tipe_arus === 'MASUK' ? 'Kas Masuk' : 'Kas Keluar'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Shortcut Links */}
        <div className="space-y-4">
          <Card className="bg-white border-slate-200 rounded-2xl shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-800">Akses Modul Cepat</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-1">
              <Link href="/dashboard/dafu" className="p-2.5 rounded-xl flex items-center justify-between hover:bg-slate-50 transition text-slate-700 group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-50 text-purple-700">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">Input Data Umat (DAFU)</div>
                    <div className="text-[11px] text-slate-400">Kelola KK & klasifikasi desil</div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-700" />
              </Link>

              <Link href="/dashboard/daftar-isian" className="p-2.5 rounded-xl flex items-center justify-between hover:bg-slate-50 transition text-slate-700 group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
                    <ClipboardEdit className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">Daftar Isian Lingkungan</div>
                    <div className="text-[11px] text-slate-400">Profil pengurus & rekening bank</div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-700" />
              </Link>

              <Link href="/dashboard/laporan" className="p-2.5 rounded-xl flex items-center justify-between hover:bg-slate-50 transition text-slate-700 group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">Laporan Aktivitas Kas</div>
                    <div className="text-[11px] text-slate-400">Arus kas & cetak PDF resmi</div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-700" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
