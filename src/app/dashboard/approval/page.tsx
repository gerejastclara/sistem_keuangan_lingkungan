'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Users,
  Building2,
  AlertTriangle,
  ArrowRight,
  Eye,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
  SlidersHorizontal,
  Home,
  UserCheck,
  FileText
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  getDafuApprovals,
  fetchDafuApprovals,
  approveDafuItem,
  markAllApprovalsAsRead,
  DafuApprovalItem
} from '@/lib/dafuApproval'
import { getAllMasterLingkungan, formatNamaLingkungan, getWilayahForLingkungan, getLingkunganDbUuid } from '@/lib/constants'
import { EditDafuApprovalModal } from '@/components/dafu/EditDafuApprovalModal'
import { DafuComparisonModal } from '@/components/dafu/DafuComparisonModal'

export default function DafuApprovalPage() {
  const router = useRouter()
  const [userRole, setUserRole] = useState<string | null>(null)
  const [checkingRole, setCheckingRole] = useState(true)
  const [approvals, setApprovals] = useState<DafuApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED'>('ALL')
  const [selectedLingkunganId, setSelectedLingkunganId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Modal States
  const [editModalItem, setEditModalItem] = useState<DafuApprovalItem | null>(null)
  const [comparisonModalItem, setComparisonModalItem] = useState<DafuApprovalItem | null>(null)
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null)

  const masterLingkunganList = getAllMasterLingkungan()

  const resolveMasterLingkungan = (idOrName: string | null) => {
    if (!idOrName || idOrName === 'all' || idOrName === 'ALL') return null
    return masterLingkunganList.find(l =>
      l.id === idOrName ||
      l.nama_lingkungan.toLowerCase().trim() === idOrName.toLowerCase().trim() ||
      l.nama_lingkungan.toLowerCase().replace(/[^a-z0-9]/g, '') === idOrName.toLowerCase().replace(/[^a-z0-9]/g, '')
    ) || null
  }

  const currentMasterLingkungan = useMemo(() => {
    return resolveMasterLingkungan(selectedLingkunganId)
  }, [selectedLingkunganId, masterLingkunganList])

  const resolveLingkunganLabel = (id: string | null): string => {
    if (!id || id === 'all' || id === 'ALL' || id === '') return '🌐 Seluruh Lingkungan (69)'
    const resolved = resolveMasterLingkungan(id)
    if (resolved) return formatNamaLingkungan(resolved.nama_lingkungan)
    return 'Pilih Lingkungan'
  }

  const loadData = async () => {
    // Show cached immediately to prevent UI flicker
    const cached = getDafuApprovals()
    if (cached && cached.length > 0) {
      setApprovals(cached)
    }
    try {
      const list = await fetchDafuApprovals()
      setApprovals(list)
    } catch (e) {
      console.warn('Failed loading approvals from DB:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterLingkunganChange = (val: string | null) => {
    const nextVal = val || 'all'
    setSelectedLingkunganId(nextVal)
    localStorage.setItem('selected_lingkungan_approval', nextVal)
  }

  useEffect(() => {
    const cookies = typeof document !== 'undefined' ? document.cookie : ''
    const getCookieVal = (name: string) => {
      const v = `; ${cookies}`
      const p = v.split(`; ${name}=`)
      if (p.length === 2) return decodeURIComponent(p.pop()!.split(';').shift()!)
      return null
    }
    const demoRole = getCookieVal('demo_user_role') || ''
    const demoEmail = getCookieVal('demo_user_email') || getCookieVal('demo_user_username') || ''

    let resolvedRole = 'BENDAHARA'
    if (
      demoRole === 'SEKRETARIS_PAROKI' ||
      ((demoEmail.includes('sekretaris') || demoEmail.includes('sekertaris')) && demoEmail.includes('paroki'))
    ) {
      resolvedRole = 'SEKRETARIS_PAROKI'
    } else if (demoRole === 'PAROKI' || demoEmail.includes('paroki')) {
      resolvedRole = 'PAROKI'
    } else if (demoRole === 'SEKRETARIS' || demoEmail.includes('sekretaris') || demoEmail.includes('sekertaris')) {
      resolvedRole = 'SEKRETARIS'
    }

    setUserRole(resolvedRole)
    setCheckingRole(false)

    // Strict access control: Only SEKRETARIS_PAROKI can access Approval DAFU module
    if (resolvedRole !== 'SEKRETARIS_PAROKI') {
      router.replace('/dashboard')
      return
    }

    loadData()
    markAllApprovalsAsRead()

    const readStoredLingkungan = () => {
      // For Paroki approval module, always default to 'all' so Paroki sees submissions from all 69 lingkungan
      const stored = localStorage.getItem('selected_lingkungan_approval') || 'all'
      setSelectedLingkunganId(stored)
    }
    readStoredLingkungan()

    const handleUpdate = () => loadData()
    window.addEventListener('dafuApprovalUpdated', handleUpdate)
    window.addEventListener('storage', handleUpdate)

    return () => {
      window.removeEventListener('dafuApprovalUpdated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [router])

  // Scope approvals based on selected lingkungan (all vs specific lingkungan)
  const scopedApprovals = useMemo(() => {
    if (!selectedLingkunganId || selectedLingkunganId === 'all' || selectedLingkunganId === 'ALL') {
      return approvals
    }
    const targetUuid = getLingkunganDbUuid(selectedLingkunganId)
    const targetMaster = resolveMasterLingkungan(selectedLingkunganId)
    const targetNorm = (targetMaster?.nama_lingkungan || selectedLingkunganId).toLowerCase().replace(/[^a-z0-9]/g, '')

    return approvals.filter(item => {
      const itemUuid = getLingkunganDbUuid(item.lingkungan_id)
      const itemNorm = (item.nama_lingkungan || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      return (
        item.lingkungan_id === selectedLingkunganId ||
        (targetUuid && itemUuid && targetUuid === itemUuid) ||
        (targetNorm && itemNorm && (targetNorm === itemNorm || targetNorm.includes(itemNorm) || itemNorm.includes(targetNorm)))
      )
    })
  }, [approvals, selectedLingkunganId])

  const pendingList = useMemo(() => scopedApprovals.filter(a => a.status === 'PENDING'), [scopedApprovals])
  const approvedList = useMemo(() => scopedApprovals.filter(a => a.status === 'APPROVED'), [scopedApprovals])
  const editedList = useMemo(() => scopedApprovals.filter(a => a.status === 'APPROVED' && (a.is_edited_by_paroki || a.data_sebelum_edit)), [scopedApprovals])

  const filteredApprovals = useMemo(() => {
    return scopedApprovals.filter(item => {
      const matchStatus = statusFilter === 'ALL' || item.status === statusFilter
      const q = searchQuery.toLowerCase().trim()
      const matchSearch =
        !q ||
        item.nama_kk.toLowerCase().includes(q) ||
        (item.alamat && item.alamat.toLowerCase().includes(q)) ||
        item.nama_lingkungan.toLowerCase().includes(q) ||
        item.submitted_by.toLowerCase().includes(q)

      return matchStatus && matchSearch
    })
  }, [scopedApprovals, statusFilter, searchQuery])

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const [selectedGolonganMap, setSelectedGolonganMap] = useState<Record<string, any>>({})

  const handleApprove = async (item: DafuApprovalItem) => {
    const verifiedGolongan = selectedGolonganMap[item.id] || item.golongan
    const ok = await approveDafuItem(item.id, 'Sekretaris Paroki', verifiedGolongan)
    if (ok) {
      if (item.action_type === 'HAPUS_KK') {
        setActionSuccessMsg(`Permohonan penghapusan "${item.nama_kk}" dari ${item.nama_lingkungan} telah BERHASIL DISETUJUI! Data telah dihapus dari DAFU Sekretaris, Bendahara, & Paroki, dan otomatis berstatus "Pindah" di Kartu Setoran.`)
      } else {
        setActionSuccessMsg(`Permohonan "${item.nama_kk}" dari ${item.nama_lingkungan} telah BERHASIL DISETUJUI dengan Status Golongan "${verifiedGolongan}"! Data tersimpan di database.`)
      }
      await loadData()
      setTimeout(() => setActionSuccessMsg(null), 5000)
    }
  }

  if (checkingRole || userRole !== 'SEKRETARIS_PAROKI') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
          <Clock className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-sm font-semibold text-slate-700">Memverifikasi hak akses...</p>
        <p className="text-xs text-slate-400">Modul ini khusus untuk Sekretaris Paroki. Mengalihkan ke Dashboard...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-[#F8F9FA] text-slate-900 p-6 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white border border-slate-300 text-slate-700 text-xs font-semibold uppercase tracking-wider shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
              Sekretariat Paroki St. Clara
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-serif text-slate-900">
              Modul Approval DAFU (Perubahan Data Umat)
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
              Pusat kendali verifikasi & persetujuan perubahan atau penambahan data Kartu Keluarga (KK) yang diajukan oleh Sekretaris Lingkungan dari seluruh 69 Lingkungan.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link href="/dashboard">
              <Button
                variant="outline"
                size="sm"
                className="bg-white hover:bg-slate-100 text-slate-700 border-slate-300 text-xs rounded-xl font-semibold cursor-pointer shadow-2xs"
              >
                Dashboard Lingkungan
              </Button>
            </Link>
            <Link href="/dashboard/kriteria-golongan">
              <Button
                size="sm"
                className="bg-slate-600 hover:bg-slate-700 text-white text-xs rounded-xl font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Kriteria Golongan
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Action Success Alert - Soft Neutral */}
      {actionSuccessMsg && (
        <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 text-slate-800 text-xs font-semibold flex items-center justify-between gap-3 animate-fadeIn shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-500 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button
            onClick={() => setActionSuccessMsg(null)}
            className="text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Metric Cards - Soft Grey & Uniform Neutral Styling */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Pengajuan */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Pengajuan</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{scopedApprovals.length}</div>
          <p className="text-[11px] text-slate-500">
            {currentMasterLingkungan ? `Permohonan ${formatNamaLingkungan(currentMasterLingkungan.nama_lingkungan)}` : 'Seluruh permohonan DAFU tercatat'}
          </p>
        </div>

        {/* Metric 2: Menunggu Persetujuan */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Menunggu Approval</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{pendingList.length}</div>
          <p className="text-[11px] text-slate-500">Butuh review & konfirmasi Paroki</p>
        </div>

        {/* Metric 3: Disetujui */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Telah Disetujui</span>
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{approvedList.length}</div>
          <p className="text-[11px] text-slate-500">Data aktif tersimpan di database</p>
        </div>

        {/* Metric 4: Disesuaikan Paroki */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Disesuaikan Paroki</span>
            <Sparkles className="w-4 h-4 text-[#A9834F]" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{editedList.length}</div>
          <p className="text-[11px] text-slate-500">Diedit sebelum persetujuan</p>
        </div>
      </div>

      {/* Filter & Search Bar - Soft Segmented Palette */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer shrink-0 ${
                statusFilter === 'ALL'
                  ? 'bg-[#16233F] text-white shadow-2xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
            >
              Semua ({scopedApprovals.length})
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                statusFilter === 'PENDING'
                  ? 'bg-[#16233F] text-white shadow-2xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Menunggu Approval ({pendingList.length})
            </button>
            <button
              onClick={() => setStatusFilter('APPROVED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                statusFilter === 'APPROVED'
                  ? 'bg-[#16233F] text-white shadow-2xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
              Disetujui ({approvedList.length})
            </button>
          </div>

          {/* Search & Lingkungan Select */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Cari KK / alamat / pemohon..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 h-9 text-xs rounded-xl bg-slate-50 border-slate-200 text-slate-900"
              />
            </div>

            <div className="w-full sm:w-56">
              <Select value={selectedLingkunganId || 'all'} onValueChange={handleFilterLingkunganChange}>
                <SelectTrigger className="h-9 bg-slate-50 border-slate-200 text-xs text-slate-900 rounded-xl font-medium">
                  <span className="truncate">{resolveLingkunganLabel(selectedLingkunganId)}</span>
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto bg-white border-slate-200 text-xs">
                  <SelectItem value="all">🌐 Seluruh Lingkungan (69)</SelectItem>
                  {masterLingkunganList.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {formatNamaLingkungan(l.nama_lingkungan)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Main List of Approval Requests */}
      <div className="space-y-4">
        {filteredApprovals.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="text-base font-bold text-slate-700">Tidak ada pengajuan yang sesuai filter</div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Saat ini tidak ada permohonan perubahan atau penambahan data umat yang memerlukan tindakan pada kriteria ini.
            </p>
          </div>
        ) : (
          filteredApprovals.map((item) => {
            const isExpanded = expandedIds.has(item.id)
            const isPending = item.status === 'PENDING'
            const isApproved = item.status === 'APPROVED'
            const isRejected = item.status === 'REJECTED'

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 transition-all duration-200 shadow-xs overflow-hidden hover:border-slate-300"
              >
                {/* Top Card Bar - Soft Grey */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#F8F9FA] border-b border-slate-200/80">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Lingkungan Badge */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#16233F] text-white font-semibold text-xs shadow-2xs">
                      <Building2 className="w-3.5 h-3.5 text-[#A9834F]" />
                      <span>{item.nama_lingkungan}</span>
                    </div>

                    {/* Wilayah Badge */}
                    <span className="text-[11px] px-2 py-0.5 rounded-md font-medium bg-slate-200/70 text-slate-700 border border-slate-300/50">
                      {getWilayahForLingkungan(item.nama_lingkungan)}
                    </span>

                    {/* Action Type Badge */}
                    <span className="text-[11px] px-2.5 py-0.5 rounded-md font-medium border border-slate-200 bg-white text-slate-700 shadow-2xs">
                      {item.action_type === 'TAMBAH_KK' ? '+ Penambahan KK Baru' : item.action_type === 'UBAH_KK' ? '✎ Perubahan Data KK' : '✕ Hapus KK'}
                    </span>

                    {/* Status Badge - Soft Neutral */}
                    <span className="text-[11px] px-2.5 py-0.5 rounded-md font-medium flex items-center gap-1.5 border border-slate-200 bg-white text-slate-700 shadow-2xs">
                      {isPending && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                      {isApproved && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />}
                      {isPending ? 'Menunggu Approval' : 'Disetujui'}
                    </span>

                    {/* Paroki Edit Badge if edited */}
                    {isApproved && (item.is_edited_by_paroki || item.data_sebelum_edit) && (
                      <span className="text-[11px] px-2.5 py-0.5 rounded-md font-semibold flex items-center gap-1 border border-amber-200 bg-amber-50 text-amber-800 shadow-2xs">
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        <span>Disesuaikan Paroki</span>
                      </span>
                    )}
                  </div>

                  {/* Submission Meta */}
                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                    <span>Diajukan oleh: <strong className="text-slate-700 font-semibold">{item.submitted_by}</strong></span>
                    <span>•</span>
                    <span>{new Date(item.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Col 1: Detail KK */}
                    <div className="space-y-1.5 md:col-span-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 font-serif">
                          {item.nama_kk}
                        </h3>
                        {item.is_biduk ? (
                          <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            BIDUK KAJ
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-500 border border-slate-200">
                            Non-BIDUK
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 flex items-start gap-1.5">
                        <Home className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <span>{item.alamat || 'Alamat belum dilengkapi'}</span>
                      </div>
                    </div>

                    {/* Col 2: Golongan & Kriteria Catatan (Bisa Disesuaikan Oleh Sekretaris Paroki) */}
                    <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div className="flex flex-col">
                          <span className="text-[11px] text-slate-500 font-semibold uppercase">Golongan Keluarga:</span>
                          {isPending && item.golongan && (
                            <span className="text-[10px] text-slate-500">
                              Usulan Lingkungan: <strong className="text-slate-800">{item.golongan}</strong>
                            </span>
                          )}
                        </div>
                        {isPending ? (
                          <Select
                            value={selectedGolonganMap[item.id] || item.golongan}
                            onValueChange={(val) => {
                              setSelectedGolonganMap(prev => ({ ...prev, [item.id]: val }))
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs font-semibold bg-white border-slate-300 rounded-lg w-full sm:w-56 text-slate-900 shadow-2xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-slate-200 text-xs">
                              <SelectItem value="Sejahtera">🟢 Sejahtera</SelectItem>
                              <SelectItem value="Terduga Pra Sejahtera">🟡 Terduga Pra Sejahtera</SelectItem>
                              <SelectItem value="Rentan Tidak Mampu">🟠 Rentan Tidak Mampu</SelectItem>
                              <SelectItem value="Tidak Mampu">🔴 Tidak Mampu</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="px-2 py-0.5 rounded font-medium text-[11px] bg-slate-200/80 text-slate-800 border border-slate-300/60">
                            {item.golongan}
                          </span>
                        )}
                      </div>
                      {isPending && (
                        <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-[#A9834F]" />
                          <span>Status golongan dapat disesuaikan langsung oleh Sekretaris Paroki</span>
                        </div>
                      )}
                      {item.kriteria_catatan && (
                        <p className="text-[11px] text-slate-600 italic leading-relaxed pt-1 border-t border-slate-200/60 mt-1">
                          Usulan Catatan: &ldquo;{item.kriteria_catatan}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Anggota Keluarga Section (Collapsible) */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleExpand(item.id)}
                      className="w-full p-2.5 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between text-xs font-semibold text-slate-700 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-500" />
                        <span>Daftar Anggota Keluarga ({item.anggota_keluarga?.length || 0} Jiwa)</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <span>{isExpanded ? 'Sembunyikan' : 'Tampilkan Detail'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-3 bg-white space-y-2 text-xs">
                        {item.anggota_keluarga && item.anggota_keluarga.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {item.anggota_keluarga.map((member, idx) => (
                              <div key={idx} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-0.5">
                                <div className="font-bold text-slate-900 truncate">{member.nama}</div>
                                <div className="flex items-center justify-between text-[11px] text-slate-500">
                                  <span>{member.peran}</span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                    {member.is_kaj ? 'KAJ' : 'Non-KAJ'}
                                  </span>
                                </div>
                                {member.keterangan && (
                                  <div className="text-[10px] text-slate-400 italic truncate pt-0.5">
                                    {member.keterangan}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-400 italic">Belum ada rincian anggota keluarga.</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Reject Note if Rejected */}
                  {isRejected && item.catatan_paroki && (
                    <div className="p-3 bg-slate-100 border border-slate-300 rounded-xl text-xs text-slate-800 space-y-0.5">
                      <div className="font-semibold flex items-center gap-1.5 text-slate-800">
                        <AlertTriangle className="w-3.5 h-3.5 text-slate-500" />
                        <span>Catatan Penolakan oleh Sekretaris Paroki:</span>
                      </div>
                      <p className="italic pl-5">{item.catatan_paroki}</p>
                    </div>
                  )}

                  {/* Approval / Rejection Audit Info */}
                  {!isPending && item.reviewed_at && (
                    <div className="text-[11px] text-slate-500 pt-1 flex items-center justify-between border-t border-slate-100">
                      <span>Ditinjau oleh: <strong className="text-slate-800">{item.reviewed_by || 'Sekretaris Paroki'}</strong></span>
                      <span>Pada: {new Date(item.reviewed_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                  )}
                </div>

                {/* Footer Actions (Only for Pending) */}
                {isPending && (
                  <div className="p-4 bg-[#F8F9FA] border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-end gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditModalItem(item)}
                      className="w-full sm:w-auto h-9 px-4 text-xs font-semibold text-slate-800 hover:text-slate-900 bg-white hover:bg-slate-100 border-slate-300 rounded-xl cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
                      <span>Edit &amp; Sesuaikan Data Umat</span>
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleApprove(item)}
                      className="w-full sm:w-auto h-9 px-5 text-xs font-semibold text-white bg-slate-700 hover:bg-slate-800 rounded-xl cursor-pointer shadow-2xs flex items-center justify-center gap-1.5 transition"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Setujui Langsung (Approve)</span>
                    </Button>
                  </div>
                )}

                {/* For Approved items with Paroki Edits */}
                {isApproved && (item.is_edited_by_paroki || item.data_sebelum_edit) && (
                  <div className="p-3.5 bg-amber-50/50 border-t border-amber-200/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-amber-900 font-medium">
                      <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Data pengajuan ini telah disesuaikan sebelum disetujui.</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setComparisonModalItem(item)}
                      className="h-8 px-3 text-xs font-semibold bg-white border-amber-300 text-amber-900 hover:bg-amber-100/80 rounded-xl cursor-pointer shadow-2xs flex items-center gap-1.5"
                    >
                      <span>Lihat Sebelum &amp; Sesudah Edit</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Edit Dafu Approval Modal for Sekretaris Paroki */}
      <EditDafuApprovalModal
        item={editModalItem}
        open={!!editModalItem}
        onClose={() => setEditModalItem(null)}
        onSuccess={(msg) => {
          setActionSuccessMsg(msg)
          loadData()
          setTimeout(() => setActionSuccessMsg(null), 4000)
        }}
        userRole="SEKRETARIS_PAROKI"
      />

      {/* Comparison Modal (Sebelum vs Sesudah Edit) */}
      <DafuComparisonModal
        item={comparisonModalItem}
        open={!!comparisonModalItem}
        onClose={() => setComparisonModalItem(null)}
      />
    </div>
  )
}
