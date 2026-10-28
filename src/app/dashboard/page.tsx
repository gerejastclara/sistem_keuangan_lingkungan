'use client'

import React, { useState, useEffect, useMemo } from 'react'
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
  getDummyGolonganForKk,
  isUuid
} from '@/lib/dummyData'
import { formatRupiah, formatDateIndo } from '@/lib/utils'
import { formatNamaLingkungan, getAllMasterLingkungan, findLingkunganByQuery, getWilayahForLingkungan, getLingkunganDbUuid } from '@/lib/constants'
import { reconcileJournals } from '@/lib/journalSync'
import { getPengurusForLingkungan, PengurusLingkungan } from '@/lib/pengurusData'
import { SearchableMemberSelect } from '@/components/ui/SearchableMemberSelect'
import { SekretarisParokiDashboard } from '@/components/dashboard/SekretarisParokiDashboard'
import { ParokiOverviewDashboard } from '@/components/dashboard/ParokiOverviewDashboard'
import { fetchDafuApprovals, removeDafuApproval, createDafuApproval, type DafuApprovalItem } from '@/lib/dafuApproval'
import { DafuComparisonModal } from '@/components/dafu/DafuComparisonModal'
import { EditDafuApprovalModal } from '@/components/dafu/EditDafuApprovalModal'
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
  ShieldCheck,
  UserCheck,
  Phone,
  Calendar,
  CreditCard,
  Clock,
  Database,
  CloudUpload,
  AlertTriangle,
  SlidersHorizontal
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

  // Pengurus State (Ketua Lingkungan, Bendahara, Sekretaris)
  const [pengurus, setPengurus] = useState<PengurusLingkungan>({
    ketua_nama: 'Susunan pengurus belum ditentukan',
    ketua_kontak: '-',
    bendahara_nama: 'Susunan pengurus belum ditentukan',
    bendahara_kontak: '-',
    sekretaris_nama: 'Susunan pengurus belum ditentukan',
    sekretaris_kontak: '-',
    periode: 'Belum ditentukan',
    status: 'Belum Ditentukan'
  })

  // Financial State (for Bendahara & Paroki)
  const [totalKasMasuk, setTotalKasMasuk] = useState(0)
  const [totalKasKeluar, setTotalKasKeluar] = useState(0)
  const [saldoAwal, setSaldoAwal] = useState(0)
  const [totalNilaiAset, setTotalNilaiAset] = useState(0)
  const [recentTransactions, setRecentTransactions] = useState<JurnalTransaksi[]>([])
  const [latestTransactionDate, setLatestTransactionDate] = useState<string | null>(null)
  const [daysSinceLastTx, setDaysSinceLastTx] = useState<number | null>(null)

  // Family & Umat State (for Sekretaris & Paroki overview)
  const [kkList, setKkList] = useState<KepalaKeluarga[]>([])
  const [anggotaMap, setAnggotaMap] = useState<Record<string, AnggotaKeluarga[]>>({})
  const [golonganMap, setGolonganMap] = useState<Record<string, GolonganKeluarga>>({})
  const [expandedKkIds, setExpandedKkIds] = useState<Set<string>>(new Set())
  const [pendingApprovals, setPendingApprovals] = useState<DafuApprovalItem[]>([])
  const [lingkunganApprovals, setLingkunganApprovals] = useState<DafuApprovalItem[]>([])
  const [approvalTabFilter, setApprovalTabFilter] = useState<'ALL' | 'PENDING' | 'APPROVED'>('PENDING')
  const [comparisonModalItem, setComparisonModalItem] = useState<DafuApprovalItem | null>(null)
  const [editApprovalModalItem, setEditApprovalModalItem] = useState<DafuApprovalItem | null>(null)
  const [deleteApprovalItem, setDeleteApprovalItem] = useState<DafuApprovalItem | null>(null)
  const [deletingApproval, setDeletingApproval] = useState(false)
  const [deleteKkModalItem, setDeleteKkModalItem] = useState<{ id: string; nama: string; alamat?: string | null } | null>(null)
  const [deletingKk, setDeletingKk] = useState(false)


  // Edit Pengurus Modal State (Khusus Sekretaris & Paroki)
  const [isEditPengurusOpen, setIsEditPengurusOpen] = useState(false)
  const [pengurusForm, setPengurusForm] = useState({
    ketuaNama: '',
    teleponKetua: '',
    bendaharaNama: '',
    teleponBendahara: '',
    sekretarisNama: '',
    teleponSekretaris: '',
    periodeMasaBakti: '2024 - 2026',
    status: 'Aktif'
  })
  const [savingPengurus, setSavingPengurus] = useState(false)
  const [pengurusSuccessMsg, setPengurusSuccessMsg] = useState<string | null>(null)

  // Seluruh nama anggota keluarga & KK di lingkungan ini untuk dropdown pengurus
  const allLingkunganMembers = useMemo(() => {
    const list: { id: string; nama: string; peran?: string; telepon?: string; nama_kk?: string }[] = []
    const seenNames = new Set<string>()

    kkList.forEach((kk) => {
      if (kk.nama_kk && !seenNames.has(kk.nama_kk.trim().toLowerCase())) {
        seenNames.add(kk.nama_kk.trim().toLowerCase())
        list.push({
          id: `kk-${kk.id}`,
          nama: kk.nama_kk.trim(),
          peran: 'Kepala Keluarga',
          telepon: kk.telepon || undefined,
          nama_kk: kk.nama_kk,
        })
      }

      const members = anggotaMap[kk.id] || []
      members.forEach((m) => {
        if (m.nama && !seenNames.has(m.nama.trim().toLowerCase())) {
          seenNames.add(m.nama.trim().toLowerCase())
          list.push({
            id: m.id || `mem-${Math.random()}`,
            nama: m.nama.trim(),
            peran: m.peran || 'Anggota',
            telepon: kk.telepon || undefined,
            nama_kk: kk.nama_kk,
          })
        }
      })
    })

    return list
  }, [kkList, anggotaMap])

  const toggleExpandKk = (id: string) => {
    setExpandedKkIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleOpenEditPengurus = () => {
    const isDefaultUnset = pengurus.ketua_nama === 'Susunan pengurus belum ditentukan'
    setPengurusForm({
      ketuaNama: isDefaultUnset ? '' : (pengurus.ketua_nama || ''),
      teleponKetua: pengurus.ketua_kontak === '-' ? '' : (pengurus.ketua_kontak || ''),
      bendaharaNama: isDefaultUnset ? '' : (pengurus.bendahara_nama || ''),
      teleponBendahara: pengurus.bendahara_kontak === '-' ? '' : (pengurus.bendahara_kontak || ''),
      sekretarisNama: isDefaultUnset ? '' : (pengurus.sekretaris_nama || ''),
      teleponSekretaris: pengurus.sekretaris_kontak === '-' ? '' : (pengurus.sekretaris_kontak || ''),
      periodeMasaBakti: pengurus.periode === 'Belum ditentukan' ? '2024 - 2026' : (pengurus.periode || '2024 - 2026'),
      status: pengurus.status === 'Belum Ditentukan' ? 'Aktif' : (pengurus.status || 'Aktif')
    })
    setIsEditPengurusOpen(true)
  }

  const handleSavePengurus = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingPengurus(true)

    const targetId = lingkunganId || 'default'
    const dbUuid = getLingkunganDbUuid(targetId)

    const updated = {
      ketuaNama: pengurusForm.ketuaNama.trim() || 'Susunan pengurus belum ditentukan',
      teleponKetua: pengurusForm.teleponKetua.trim() || '-',
      bendaharaNama: pengurusForm.bendaharaNama.trim() || 'Susunan pengurus belum ditentukan',
      teleponBendahara: pengurusForm.teleponBendahara.trim() || '-',
      sekretarisNama: pengurusForm.sekretarisNama.trim() || 'Susunan pengurus belum ditentukan',
      teleponSekretaris: pengurusForm.teleponSekretaris.trim() || '-',
      periodeMasaBakti: pengurusForm.periodeMasaBakti.trim() || '2024 - 2026',
      status: pengurusForm.status || 'Aktif'
    }

    try {
      const existing = localStorage.getItem(`profil_manual_${targetId}`) || localStorage.getItem(`profil_manual_${dbUuid}`)
      const obj = existing ? JSON.parse(existing) : {}
      const fullUpdated = { ...obj, ...updated }

      localStorage.setItem(`profil_manual_${targetId}`, JSON.stringify(fullUpdated))
      localStorage.setItem(`profil_manual_${dbUuid}`, JSON.stringify(fullUpdated))

      if (lingkunganName) {
        const cleanN = lingkunganName.replace(/^lingkungan\s+/i, '').trim()
        if (cleanN) {
          localStorage.setItem(`profil_manual_${cleanN}`, JSON.stringify(fullUpdated))
          localStorage.setItem(`profil_manual_${cleanN.toLowerCase().replace(/\s+/g, '')}`, JSON.stringify(fullUpdated))
          localStorage.setItem(`profil_manual_${cleanN.toLowerCase().replace(/[^a-z0-9]/g, '')}`, JSON.stringify(fullUpdated))
        }
      }

      window.dispatchEvent(new CustomEvent('pengurusUpdated', { detail: { targetId, dbUuid, updated: fullUpdated } }))
      window.dispatchEvent(new Event('storage'))
      window.dispatchEvent(new Event('lingkunganChanged'))
      window.dispatchEvent(new Event('dafuDataUpdated'))
    } catch (err) {}

    try {
      const payload = {
        ketua_nama: updated.ketuaNama,
        telepon_ketua: updated.teleponKetua,
        bendahara_nama: updated.bendaharaNama,
        telepon_bendahara: updated.teleponBendahara,
        sekretaris_nama: updated.sekretarisNama,
        telepon_sekretaris: updated.teleponSekretaris,
        periode_masa_bakti: updated.periodeMasaBakti,
        status: updated.status
      }

      const { data: existingProfil } = await supabase
        .from('profil_lingkungan')
        .select('id')
        .or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${targetId}`)
        .maybeSingle()

      if (existingProfil?.id) {
        await supabase.from('profil_lingkungan').update(payload).eq('id', existingProfil.id)
      } else {
        await supabase.from('profil_lingkungan').insert({ ...payload, lingkungan_id: dbUuid })
      }
    } catch (err) {
      console.log('Notice: profil_lingkungan save error', err)
    }

    setPengurus({
      ketua_nama: updated.ketuaNama,
      ketua_kontak: updated.teleponKetua,
      bendahara_nama: updated.bendaharaNama,
      bendahara_kontak: updated.teleponBendahara,
      sekretaris_nama: updated.sekretarisNama,
      sekretaris_kontak: updated.teleponSekretaris,
      periode: updated.periodeMasaBakti,
      status: updated.status
    })

    setSavingPengurus(false)
    setIsEditPengurusOpen(false)
    setPengurusSuccessMsg('Susunan pengurus lingkungan berhasil disimpan!')
    setTimeout(() => setPengurusSuccessMsg(null), 4000)
  }

  // Filters & Search for Family Data
  const [searchQuery, setSearchQuery] = useState('')
  const [filterGolongan, setFilterGolongan] = useState<'ALL' | KategoriGolongan>('ALL')
  const [filterKaj, setFilterKaj] = useState<'ALL' | 'BIDUK' | 'NON_BIDUK'>('ALL')
  const [statusApprovalKkFilter, setStatusApprovalKkFilter] = useState<'ALL' | 'PENDING' | 'APPROVED'>('ALL')

  // Detail Modal for Family
  const [viewingKk, setViewingKk] = useState<KepalaKeluarga | null>(null)

  useEffect(() => {
    async function loadDashboardData(showSpinner: boolean = true) {
      if (showSpinner) {
        setLoading(true)
      }

      try {
        // Pre-fetch latest approved DAFU items from Supabase database
        const latestApprovals = await fetchDafuApprovals().catch(() => [])

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

          const demoEmail = getCookieVal('demo_user_email') || getCookieVal('demo_user_username') || ''
          const demoRole = getCookieVal('demo_user_role') || ''

          if (
            demoRole === 'SEKRETARIS_PAROKI' ||
            ((demoEmail.includes('sekretaris') || demoEmail.includes('sekertaris')) && demoEmail.includes('paroki'))
          ) {
            role = 'SEKRETARIS_PAROKI'
          } else if (
            demoRole === 'SEKRETARIS' || 
            demoEmail.includes('sekretaris') || 
            demoEmail.includes('sekertaris')
          ) {
            role = 'SEKRETARIS'
          } else if (demoRole === 'PAROKI' || demoEmail.includes('paroki')) {
            role = 'PAROKI'
          } else {
            role = 'BENDAHARA'
          }

          currentLId = getCookieVal('demo_user_lingkungan_id')
          currentLNama = getCookieVal('demo_user_lingkungan_nama')

          const isGlobalScope = role === 'PAROKI' || role === 'SEKRETARIS_PAROKI'

          setUserProfile({
            id: 'demo-user',
            username: demoEmail || role.toLowerCase(),
            email: demoEmail || `${role.toLowerCase()}@example.com`,
            role: role,
            lingkungan_id: isGlobalScope ? null : currentLId,
            lingkungan_nama: isGlobalScope ? undefined : (currentLNama || undefined),
          })
        }

        let rawDemoEmail = typeof document !== 'undefined' ? (`; ${document.cookie}`).split('; demo_user_email=').pop()?.split(';').shift() || '' : ''
        let rawDemoUsername = typeof document !== 'undefined' ? (`; ${document.cookie}`).split('; demo_user_username=').pop()?.split(';').shift() || '' : ''
        try {
          rawDemoEmail = decodeURIComponent(rawDemoEmail)
          rawDemoUsername = decodeURIComponent(rawDemoUsername)
        } catch (e) {}
        const effectiveEmail = user?.email || rawDemoEmail || rawDemoUsername || ''
        
        const isGlobalScope = role === 'PAROKI' || role === 'SEKRETARIS_PAROKI'

        // Strictly match Lingkungan from user email/username if non-PAROKI / non-SEKRETARIS_PAROKI
        if (!isGlobalScope && effectiveEmail) {
          const matchedByEmail =
            findLingkunganByQuery(effectiveEmail) ||
            findLingkunganByQuery(effectiveEmail.replace(/\s+/g, '_')) ||
            findLingkunganByQuery(effectiveEmail.replace(/_/g, ' '))
          if (matchedByEmail) {
            currentLId = matchedByEmail.id
            currentLNama = matchedByEmail.nama_lingkungan
          }
        }

        setUserRole(role)

        // For SEKRETARIS_PAROKI, hand off immediately to SekretarisParokiDashboard
        if (role === 'SEKRETARIS_PAROKI') {
          setLoading(false)
          return
        }

        // 2. Resolve Target Lingkungan
        let targetLingkunganId: string | null = null
        if (!isGlobalScope && currentLId) {
          targetLingkunganId = currentLId
          if (typeof window !== 'undefined') {
            localStorage.setItem('selected_lingkungan_id', currentLId)
          }
        } else {
          targetLingkunganId = localStorage.getItem('selected_lingkungan_id')
          if (!targetLingkunganId) {
            targetLingkunganId = isGlobalScope ? 'all' : getAllMasterLingkungan()[0].id
          }
        }

        // Fetch Lingkungan Name
        const allM = getAllMasterLingkungan()
        const matchedM = allM.find(m => m.id === targetLingkunganId || getLingkunganDbUuid(m.id) === targetLingkunganId)
        const lName = targetLingkunganId === 'all'
          ? 'Seluruh Lingkungan'
          : (matchedM?.nama_lingkungan || currentLNama || 'Lingkungan')
        setLingkunganName(lName)
        setLingkunganId(targetLingkunganId)

        if (targetLingkunganId && targetLingkunganId !== 'all') {
          // 3. Fetch DAFU & Anggota Data (Essential for Sekretaris & useful for all)
          const dbUuid = getLingkunganDbUuid(targetLingkunganId)
          const { data: kks } = await supabase
            .from('kepala_keluarga')
            .select('*')
            .or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${targetLingkunganId}`)
            .order('nama_kk', { ascending: true })

            const dbKks = (kks || []).filter((k: any) => k && !k.id.startsWith('dummy-') && !k.id.includes('dummy'))
            const finalKks = ensureDummyKksForLingkungan(targetLingkunganId, lName, dbKks, latestApprovals)

            // Filter approvals for this lingkungan
            const lNorm = (lName || '').toLowerCase().replace(/[^a-z0-9]/g, '')
            const matchedApprovals = (latestApprovals || []).filter((a: any) => {
              const aUuid = getLingkunganDbUuid(a.lingkungan_id)
              const aNorm = (a.nama_lingkungan || '').toLowerCase().replace(/[^a-z0-9]/g, '')
              return (
                targetLingkunganId === 'all' ||
                a.lingkungan_id === targetLingkunganId ||
                (dbUuid && aUuid && dbUuid === aUuid) ||
                (lNorm && aNorm && (lNorm === aNorm || lNorm.includes(aNorm) || aNorm.includes(lNorm)))
              )
            })
            setLingkunganApprovals(matchedApprovals)
            const pending = matchedApprovals.filter(a => a.status === 'PENDING')
            setPendingApprovals(pending)

          // Load Anggota & Golongan first, then commit finalKks together so stats don't flash 0
          await loadAnggotaAndGolongan(finalKks, targetLingkunganId, latestApprovals)
          setKkList(finalKks)

          // Load Profil & Pengurus Lingkungan directly from Supabase (sole source of truth)
          const { data: profil } = await supabase
            .from('profil_lingkungan')
            .select('*')
            .or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${targetLingkunganId}`)
            .maybeSingle()

          const pInfo = getPengurusForLingkungan(targetLingkunganId, lName, profil)
          setPengurus(pInfo)

          // 4. If Bendahara or Paroki, also load financial data
          if (role !== 'SEKRETARIS') {
            let combinedJournals: any[] = []
            let supabaseSuccess = false

            // 1. Fetch from Supabase
            try {
              const { data: journals, error } = await supabase
                .from('jurnal_transaksi')
                .select('*, kepala_keluarga:kk_id(nama_kk)')
                .or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${targetLingkunganId}`)
                .order('tanggal', { ascending: false })

              if (!error && Array.isArray(journals)) {
                supabaseSuccess = true
                combinedJournals = journals
              }
            } catch (e) {}

            // 2. Reconcile with localStorage journals (covers offline cache and prunes deleted cloud entries)
            combinedJournals = reconcileJournals(combinedJournals, dbUuid, targetLingkunganId, supabaseSuccess)

            const saTx = combinedJournals.find(j => j.no_bukti === '[SA/1100]' || (j.keterangan || '').includes('[SALDO_AWAL]'))
            const sa = saTx ? Number(saTx.nominal || 0) : Number(profil?.saldo_awal || 0)
            setSaldoAwal(sa)

            let masuk = 0
            let keluar = 0
            combinedJournals.forEach((j) => {
              if (j.no_bukti === '[SA/1100]' || (j.keterangan || '').includes('[SALDO_AWAL]')) return
              const nom = Number(j.nominal) || 0
              if (j.tipe_arus === 'MASUK') masuk += nom
              else keluar += nom
            })
            setTotalKasMasuk(masuk)
            setTotalKasKeluar(keluar)
            setRecentTransactions(combinedJournals.slice(0, 5))

            // Calculate latest regular transaction & inactivity days
            const regularTxs = combinedJournals.filter(
              j => j.no_bukti !== '[SA/1100]' && !(j.keterangan || '').includes('[SALDO_AWAL]')
            )

            if (regularTxs.length > 0) {
              const sorted = [...regularTxs].sort((a, b) => {
                const dateA = new Date(a.tanggal || a.created_at).getTime()
                const dateB = new Date(b.tanggal || b.created_at).getTime()
                return dateB - dateA
              })
              const latest = sorted[0].tanggal || sorted[0].created_at || null
              setLatestTransactionDate(latest)
              if (latest) {
                const diffMs = Date.now() - new Date(latest).getTime()
                const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
                setDaysSinceLastTx(diffDays)
              } else {
                setDaysSinceLastTx(null)
              }
            } else {
              setLatestTransactionDate(null)
              setDaysSinceLastTx(null)
            }

            const { data: asetList } = await supabase
              .from('aset')
              .select('jumlah, harga_satuan')
              .eq('lingkungan_id', dbUuid)

            if (asetList) {
              const totalVal = asetList.reduce((acc: number, curr: any) => acc + (Number(curr.jumlah || 0) * Number(curr.harga_satuan || 0)), 0)
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

    loadDashboardData(true)

    const handleSync = () => {
      loadDashboardData(false)
    }
    window.addEventListener('dafuDataUpdated', handleSync)
    window.addEventListener('dafuApprovalUpdated', handleSync)
    window.addEventListener('pengurusUpdated', handleSync)
    window.addEventListener('customJournalsUpdated', handleSync)
    window.addEventListener('lingkunganChanged', handleSync)

    return () => {
      window.removeEventListener('dafuDataUpdated', handleSync)
      window.removeEventListener('dafuApprovalUpdated', handleSync)
      window.removeEventListener('pengurusUpdated', handleSync)
      window.removeEventListener('customJournalsUpdated', handleSync)
      window.removeEventListener('lingkunganChanged', handleSync)
    }
  }, [])

  const loadAnggotaAndGolongan = async (kks: KepalaKeluarga[], lId: string, preloadedApprovals?: any[]) => {
    const kkIds = kks.map(k => k.id)
    const validUuidKkIds = kkIds.filter(isUuid)
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

    if (validUuidKkIds.length > 0) {
      try {
        const { data: aData, error: aErr } = await supabase.from('anggota_keluarga').select('*').in('kk_id', validUuidKkIds)
        if (aData) supabaseAnggota = aData
        if (aErr) console.warn('Supabase anggota fetch warning:', aErr)
      } catch (e) {}

      try {
        const { data: gData, error: gErr } = await supabase.from('golongan_keluarga').select('*').in('kk_id', validUuidKkIds)
        if (gData) supabaseGolongan = gData
        if (gErr) console.warn('Supabase golongan fetch warning:', gErr)
      } catch (e) {}
    }

    kks.forEach(kk => {
      let members = supabaseAnggota.filter(a => a.kk_id === kk.id)
      if (members.length === 0 && localAnggotaStore[kk.id]) members = localAnggotaStore[kk.id]
      if (members.length === 0) members = getDummyAnggotaForKk(kk, preloadedApprovals)
      newAnggotaMap[kk.id] = members

      let gol = supabaseGolongan.find(g => g.kk_id === kk.id)
      if (!gol && localGolonganStore[kk.id]) gol = localGolonganStore[kk.id]
      if (!gol) gol = getDummyGolonganForKk(kk, preloadedApprovals)
      newGolonganMap[kk.id] = gol
    })

    setAnggotaMap(newAnggotaMap)
    setGolonganMap(newGolonganMap)
  }

  const handleDeleteKk = (id: string, nama: string) => {
    const found = kkList.find(k => k.id === id || (k.nama_kk || '').toLowerCase().trim() === (nama || '').toLowerCase().trim())
    setDeleteKkModalItem({
      id,
      nama,
      alamat: found?.alamat || null
    })
  }

  const handleConfirmDeleteKk = async () => {
    if (!deleteKkModalItem) return
    setDeletingKk(true)

    const cleanId = (deleteKkModalItem.id || '').trim()
    const cleanName = (deleteKkModalItem.nama || '').trim()
    const existingAlamat = (deleteKkModalItem.alamat || '').trim()
    const dbUuid = getLingkunganDbUuid(lingkunganId)

    if (userRole === 'SEKRETARIS') {
      try {
        const foundKk = kkList.find(k => k.id === cleanId || (k.nama_kk || '').toLowerCase().trim() === cleanName.toLowerCase())
        const existingMembers = anggotaMap[cleanId] || (foundKk ? getDummyAnggotaForKk(foundKk) : [])
        const existingGol = golonganMap[cleanId]?.golongan || (foundKk ? getDummyGolonganForKk(foundKk).golongan : 'Sejahtera')

        await createDafuApproval({
          lingkungan_id: lingkunganId || '',
          nama_lingkungan: lingkunganName || 'Lingkungan',
          kk_id: cleanId,
          action_type: 'HAPUS_KK',
          nama_kk: cleanName,
          alamat: existingAlamat || null,
          is_biduk: foundKk?.is_biduk ?? true,
          golongan: existingGol,
          kriteria_catatan: 'Pengajuan Hapus / Pindah Anggota Keluarga',
          anggota_keluarga: existingMembers.map(m => ({
            id: m.id,
            nama: m.nama,
            peran: m.peran,
            is_kaj: m.is_kaj,
            keterangan: m.keterangan || undefined
          })),
          submitted_by: `Sekretaris ${formatNamaLingkungan(lingkunganName || '')}`
        })

        const latest = await fetchDafuApprovals()
        const targetUuid = getLingkunganDbUuid(lingkunganId || '')
        const lNorm = (lingkunganName || '').toLowerCase().replace(/[^a-z0-9]/g, '')
        const matched = (latest || []).filter(a => {
          const aUuid = getLingkunganDbUuid(a.lingkungan_id)
          const aNorm = (a.nama_lingkungan || '').toLowerCase().replace(/[^a-z0-9]/g, '')
          return (
            lingkunganId === 'all' ||
            a.lingkungan_id === lingkunganId ||
            (targetUuid && aUuid && targetUuid === aUuid) ||
            (lNorm && aNorm && (lNorm === aNorm || lNorm.includes(aNorm) || aNorm.includes(lNorm)))
          )
        })
        setLingkunganApprovals(matched)
        setPendingApprovals(matched.filter(a => a.status === 'PENDING'))
        setApprovalTabFilter('PENDING')
      } catch (e) {}

      setDeletingKk(false)
      setDeleteKkModalItem(null)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dafuApprovalUpdated'))
        window.dispatchEvent(new Event('storage'))
      }
      return
    }

    if (typeof window !== 'undefined') {
      try {
        const rawAll = localStorage.getItem('custom_kks_deleted_store')
        const list: string[] = rawAll ? JSON.parse(rawAll) : []
        const toAdd = [
          cleanId,
          cleanId.toLowerCase(),
          cleanName,
          cleanName.toLowerCase(),
          cleanId.replace('kk-appr-', ''),
          `kk-appr-${cleanId}`
        ]
        toAdd.forEach(item => {
          if (item && !list.includes(item)) list.push(item)
        })
        localStorage.setItem('custom_kks_deleted_store', JSON.stringify(list))
        if (lingkunganId) localStorage.setItem(`custom_kks_deleted_${lingkunganId}`, JSON.stringify(list))
        if (dbUuid) localStorage.setItem(`custom_kks_deleted_${dbUuid}`, JSON.stringify(list))

        const markStatus = (key: string) => {
          const rawS = localStorage.getItem(key)
          const mapS = rawS ? JSON.parse(rawS) : {}
          mapS[cleanId] = 'PINDAH'
          mapS[cleanName.toLowerCase()] = 'PINDAH'
          localStorage.setItem(key, JSON.stringify(mapS))
        }
        if (lingkunganId) markStatus(`kartu_setoran_umat_status_${lingkunganId}`)
        if (dbUuid) markStatus(`kartu_setoran_umat_status_${dbUuid}`)
      } catch (e) {}
    }

    await removeDafuApproval(cleanId, cleanName)

    try {
      const stripped = cleanId.replace('kk-appr-', '')
      const newAlamat = existingAlamat.toLowerCase().includes('[pindah]')
        ? existingAlamat
        : `${existingAlamat} [PINDAH]`.trim()

      await supabase.from('kepala_keluarga').update({ alamat: newAlamat }).eq('id', cleanId)
      if (stripped !== cleanId) {
        await supabase.from('kepala_keluarga').update({ alamat: newAlamat }).eq('id', stripped)
      }
      if (cleanName && dbUuid) {
        await supabase.from('kepala_keluarga').update({ alamat: newAlamat }).eq('lingkungan_id', dbUuid).ilike('nama_kk', cleanName)
      }
    } catch (err) {}

    setKkList(prev => {
      const updated = prev.filter(k =>
        k.id !== cleanId &&
        k.id !== `kk-appr-${cleanId}` &&
        (k.nama_kk || '').toLowerCase().trim() !== cleanName.toLowerCase()
      )
      if (lingkunganId) localStorage.setItem(`custom_kks_${lingkunganId}`, JSON.stringify(updated))
      if (dbUuid) localStorage.setItem(`custom_kks_${dbUuid}`, JSON.stringify(updated))
      return updated
    })

    setDeletingKk(false)
    setDeleteKkModalItem(null)

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('dafuDataUpdated'))
      window.dispatchEvent(new Event('storage'))
    }
  }

  // Approval count & sets for indicators
  const pendingApprovalsCount = useMemo(() => {
    return lingkunganApprovals.filter(a => a.status === 'PENDING').length
  }, [lingkunganApprovals])

  const approvedApprovalsCount = useMemo(() => {
    return lingkunganApprovals.filter(a => a.status === 'APPROVED').length
  }, [lingkunganApprovals])

  const pendingKkNameSet = useMemo(() => {
    const set = new Set<string>()
    lingkunganApprovals
      .filter((a) => a.status === 'PENDING')
      .forEach((a) => {
        if (a.nama_kk) set.add(a.nama_kk.toLowerCase().trim())
        if (a.kk_id) set.add(a.kk_id)
        if (a.id) {
          set.add(a.id)
          set.add(`kk-appr-${a.id}`)
        }
      })
    return set
  }, [lingkunganApprovals])

  const approvedKkMap = useMemo(() => {
    const map = new Map<string, DafuApprovalItem>()
    lingkunganApprovals
      .filter((a) => a.status === 'APPROVED')
      .forEach((a) => {
        if (a.nama_kk) map.set(a.nama_kk.toLowerCase().trim(), a)
        if (a.kk_id) map.set(a.kk_id, a)
        if (a.id) {
          map.set(a.id, a)
          map.set(`kk-appr-${a.id}`, a)
        }
      })
    return map
  }, [lingkunganApprovals])

  const handleConfirmDeleteApproval = async () => {
    if (!deleteApprovalItem) return
    setDeletingApproval(true)
    try {
      await removeDafuApproval(deleteApprovalItem.id, deleteApprovalItem.kk_id)
      setLingkunganApprovals(prev => prev.filter(a => a.id !== deleteApprovalItem.id))
      setPendingApprovals(prev => prev.filter(a => a.id !== deleteApprovalItem.id))
      setDeleteApprovalItem(null)
      window.dispatchEvent(new Event('dafuApprovalUpdated'))
      window.dispatchEvent(new Event('dafuDataUpdated'))
    } catch (err) {
      console.error('Failed to delete approval:', err)
    } finally {
      setDeletingApproval(false)
    }
  }

  // Filtered KK list for table
  const filteredKkList = kkList.filter(k => {
    if (!k || k.id.startsWith('dummy-') || k.id.includes('dummy')) return false
    const members = anggotaMap[k.id] || []
    const gol = golonganMap[k.id]?.golongan || 'MENENGAH'
    const kNorm = k.nama_kk.toLowerCase().trim()
    const isPending = pendingKkNameSet.has(k.id) || pendingKkNameSet.has(kNorm)
    const isApproved = approvedKkMap.has(k.id) || approvedKkMap.has(kNorm)

    const matchesSearch =
      k.nama_kk.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (k.alamat && k.alamat.toLowerCase().includes(searchQuery.toLowerCase())) ||
      members.some(m => m.nama.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesGolongan =
      filterGolongan === 'ALL' ||
      gol === filterGolongan ||
      (filterGolongan === 'Terduga Prasejahtera' && (gol === 'Terduga Prasejahtera' || gol === 'Terduga Pra Sejahtera')) ||
      (filterGolongan === 'Terduga Pra Sejahtera' && (gol === 'Terduga Prasejahtera' || gol === 'Terduga Pra Sejahtera'))
    const matchesKaj =
      filterKaj === 'ALL' ||
      (filterKaj === 'BIDUK' && k.is_biduk) ||
      (filterKaj === 'NON_BIDUK' && !k.is_biduk)

    const matchesApprovalFilter =
      statusApprovalKkFilter === 'ALL' ||
      (statusApprovalKkFilter === 'PENDING' && isPending) ||
      (statusApprovalKkFilter === 'APPROVED' && isApproved)

    return matchesSearch && matchesGolongan && matchesKaj && matchesApprovalFilter
  })

  // Statistics calculation
  const totalKK = kkList.length
  let totalJiwa = 0
  let totalJiwaKaj = 0
  let totalJiwaNonKaj = 0
  let countTidakMampu = 0
  let countRentan = 0
  let countTerduga = 0
  let countSejahtera = 0

  kkList.forEach(k => {
    const members = anggotaMap[k.id] || []
    totalJiwa += members.length > 0 ? members.length : 1
    members.forEach(m => {
      if (m.is_kaj) totalJiwaKaj++
      else totalJiwaNonKaj++
    })

    const gol = (golonganMap[k.id]?.golongan || 'Sejahtera') as string
    if (gol === 'Tidak Mampu') countTidakMampu++
    else if (gol === 'Rentan Tidak Mampu') countRentan++
    else if (gol === 'Terduga Prasejahtera' || gol === 'Terduga Pra Sejahtera') countTerduga++
    else countSejahtera++
  })

  const getGolonganBadge = (gol?: KategoriGolongan | string | null, note?: string | null) => {
    const displayGol = (gol as KategoriGolongan) || 'Sejahtera'
    return (
      <span
        title={note || `Keluarga ${displayGol}`}
        className="inline-block px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
      >
        {displayGol}
      </span>
    )
  }

  const saldoKasAkhir = saldoAwal + totalKasMasuk - totalKasKeluar

  const renderDetailDialog = () => (
    <Dialog open={!!viewingKk} onOpenChange={(open) => !open && setViewingKk(null)}>
      <DialogContent className="sm:max-w-xl bg-white border-slate-200 text-slate-900 rounded-2xl p-6">
        {viewingKk && (
          <>
            <DialogHeader>
              <DialogTitle className="text-slate-900 font-bold text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                Detail Kepala Keluarga & Anggota
              </DialogTitle>
              <p className="text-xs text-slate-500">
                Informasi detail KK dan daftar seluruh anggota jiwa keluarga.
              </p>
            </DialogHeader>

            <div className="space-y-4 pt-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <div className="text-xs font-bold text-slate-800">{viewingKk.nama_kk}</div>
                <div className="text-xs text-slate-500">{viewingKk.alamat || 'Alamat belum diisi'}</div>
                <div className="text-xs text-slate-500">
                  Wilayah {viewingKk.wilayah || getWilayahForLingkungan(lingkunganName || '')} • Lingkungan {formatNamaLingkungan(lingkunganName)}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-slate-700 mb-2">
                  Daftar Anggota Jiwa ({(anggotaMap[viewingKk.id] || []).length} Orang)
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {(anggotaMap[viewingKk.id] || []).map((m, i) => (
                    <div
                      key={m.id || i}
                      className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{m.nama}</div>
                        <div className="text-[11px] text-slate-500">Peran: {m.peran}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {m.is_kaj ? (
                          <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded font-medium">
                            KAJ
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-50 text-slate-500 border border-slate-200 px-2 py-0.5 rounded font-medium">
                            Non-KAJ
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )

  const isUnsetPengurus = (name: string) => !name || name === 'Susunan pengurus belum ditentukan'

  const renderPengurusCard = (canEdit: boolean) => (
    <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Susunan Pengurus {formatNamaLingkungan(lingkunganName)}</h3>
            <p className="text-xs text-slate-500">Masa Bakti: {pengurus.periode === 'Belum ditentukan' ? 'Belum ditentukan' : (pengurus.periode || 'Belum ditentukan')} • Paroki Bekasi Utara</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] bg-slate-100 text-slate-700 border border-slate-200 font-bold px-3 py-1 rounded-full w-fit flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
            Status: {pengurus.status || 'Belum Ditentukan'}
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={handleOpenEditPengurus}
              className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg shadow-xs transition cursor-pointer"
              title="Khusus Sekretaris: Tentukan susunan Ketua, Bendahara, dan Sekretaris Lingkungan"
            >
              <Pencil className="w-3.5 h-3.5" />
              Atur Pengurus
            </button>
          )}
        </div>
      </div>

      {pengurusSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          {pengurusSuccessMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Ketua Lingkungan */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-100 text-amber-900 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ketua Lingkungan</div>
            {isUnsetPengurus(pengurus.ketua_nama) ? (
              <div className="text-xs font-semibold text-slate-500 italic mt-0.5">Susunan pengurus belum ditentukan</div>
            ) : (
              <div className="text-sm font-extrabold text-slate-900 truncate mt-0.5">{pengurus.ketua_nama}</div>
            )}
            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
              <span>📞</span> {pengurus.ketua_kontak && pengurus.ketua_kontak !== '-' ? pengurus.ketua_kontak : '-'}
            </div>
          </div>
        </div>

        {/* Bendahara Lingkungan */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-100 text-amber-900 shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bendahara Lingkungan</div>
            {isUnsetPengurus(pengurus.bendahara_nama) ? (
              <div className="text-xs font-semibold text-slate-500 italic mt-0.5">Susunan pengurus belum ditentukan</div>
            ) : (
              <div className="text-sm font-extrabold text-slate-900 truncate mt-0.5">{pengurus.bendahara_nama}</div>
            )}
            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
              <span>📞</span> {pengurus.bendahara_kontak && pengurus.bendahara_kontak !== '-' ? pengurus.bendahara_kontak : '-'}
            </div>
          </div>
        </div>

        {/* Sekretaris Lingkungan */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-100 text-amber-900 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sekretaris Lingkungan</div>
            {isUnsetPengurus(pengurus.sekretaris_nama) ? (
              <div className="text-xs font-semibold text-slate-500 italic mt-0.5">Susunan pengurus belum ditentukan</div>
            ) : (
              <div className="text-sm font-extrabold text-slate-900 truncate mt-0.5">{pengurus.sekretaris_nama}</div>
            )}
            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
              <span>📞</span> {pengurus.sekretaris_kontak && pengurus.sekretaris_kontak !== '-' ? pengurus.sekretaris_kontak : '-'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderEditPengurusDialog = () => (
    <Dialog open={isEditPengurusOpen} onOpenChange={setIsEditPengurusOpen}>
      <DialogContent className="sm:max-w-lg bg-white border-slate-200 text-slate-900 rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="text-slate-800 font-bold text-base flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#A9834F]" />
            Atur Susunan Pengurus Lingkungan
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-1">
            Khusus Sekretaris: Tentukan data nama dan kontak resmi pengurus {formatNamaLingkungan(lingkunganName)}.
          </p>
        </DialogHeader>

        <form onSubmit={handleSavePengurus} className="space-y-4 pt-2">
          {/* Ketua Lingkungan */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
              Ketua Lingkungan
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Nama Lengkap Ketua</label>
                <div className="mt-1">
                  <SearchableMemberSelect
                    members={allLingkunganMembers}
                    value={pengurusForm.ketuaNama}
                    onChange={(nama, member) => {
                      setPengurusForm(prev => ({
                        ...prev,
                        ketuaNama: nama,
                        teleponKetua: member?.telepon && (!prev.teleponKetua || prev.teleponKetua === '-') ? member.telepon : prev.teleponKetua
                      }))
                    }}
                    placeholder="Pilih/cari nama Ketua Lingkungan..."
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">No. WhatsApp / Telepon</label>
                <Input
                  value={pengurusForm.teleponKetua}
                  onChange={(e) => setPengurusForm({ ...pengurusForm, teleponKetua: e.target.value })}
                  placeholder="Contoh: 0812-8921-3341"
                  className="h-9 text-xs bg-white mt-1 text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Bendahara Lingkungan */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-emerald-700" />
              Bendahara Lingkungan
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Nama Lengkap Bendahara</label>
                <div className="mt-1">
                  <SearchableMemberSelect
                    members={allLingkunganMembers}
                    value={pengurusForm.bendaharaNama}
                    onChange={(nama, member) => {
                      setPengurusForm(prev => ({
                        ...prev,
                        bendaharaNama: nama,
                        teleponBendahara: member?.telepon && (!prev.teleponBendahara || prev.teleponBendahara === '-') ? member.telepon : prev.teleponBendahara
                      }))
                    }}
                    placeholder="Pilih/cari nama Bendahara..."
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">No. WhatsApp / Telepon</label>
                <Input
                  value={pengurusForm.teleponBendahara}
                  onChange={(e) => setPengurusForm({ ...pengurusForm, teleponBendahara: e.target.value })}
                  placeholder="Contoh: 0813-1456-7890"
                  className="h-9 text-xs bg-white mt-1 text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Sekretaris Lingkungan */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-700" />
              Sekretaris Lingkungan
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Nama Lengkap Sekretaris</label>
                <div className="mt-1">
                  <SearchableMemberSelect
                    members={allLingkunganMembers}
                    value={pengurusForm.sekretarisNama}
                    onChange={(nama, member) => {
                      setPengurusForm(prev => ({
                        ...prev,
                        sekretarisNama: nama,
                        teleponSekretaris: member?.telepon && (!prev.teleponSekretaris || prev.teleponSekretaris === '-') ? member.telepon : prev.teleponSekretaris
                      }))
                    }}
                    placeholder="Pilih/cari nama Sekretaris..."
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">No. WhatsApp / Telepon</label>
                <Input
                  value={pengurusForm.teleponSekretaris}
                  onChange={(e) => setPengurusForm({ ...pengurusForm, teleponSekretaris: e.target.value })}
                  placeholder="Contoh: 0815-9988-2234"
                  className="h-9 text-xs bg-white mt-1 text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Periode & Status */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-[11px] font-semibold text-slate-600">Periode Masa Bakti</label>
              <Input
                value={pengurusForm.periodeMasaBakti}
                onChange={(e) => setPengurusForm({ ...pengurusForm, periodeMasaBakti: e.target.value })}
                placeholder="2024 - 2026"
                className="h-9 text-xs bg-white mt-1 text-slate-900"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600">Status Kepengurusan</label>
              <Select
                value={pengurusForm.status}
                onValueChange={(val) => val && setPengurusForm({ ...pengurusForm, status: val })}
              >
                <SelectTrigger className="h-9 text-xs bg-white mt-1 text-slate-900 border-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900">
                  <SelectItem value="Aktif">Aktif</SelectItem>
                  <SelectItem value="Purna Tugas">Purna Tugas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2 flex sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditPengurusOpen(false)}
              className="h-9 text-xs border-slate-300 text-slate-700"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={savingPengurus}
              className="h-9 text-xs bg-slate-700 hover:bg-slate-800 text-white font-bold cursor-pointer rounded-xl"
            >
              {savingPengurus ? 'Menyimpan...' : 'Simpan Susunan Pengurus'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )

  const renderMigrationModal = () => null
  const renderMigrationBanner = () => null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  // ==========================================
  // VIEW KHUSUS SEKRETARIS PAROKI: DASHBOARD SELURUH LINGKUNGAN
  // ==========================================
  if (userRole === 'SEKRETARIS_PAROKI') {
    return (
      <div className="space-y-4 max-w-7xl mx-auto">
        {renderMigrationBanner()}
        <SekretarisParokiDashboard />
        {renderMigrationModal()}
      </div>
    )
  }

  // ==========================================
  // VIEW KHUSUS PAROKI KETIKA MODE 'SELURUH LINGKUNGAN' (AWAL LOGIN)
  // ==========================================
  if (userRole === 'PAROKI' && (!lingkunganId || lingkunganId === 'all')) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto">
        {renderMigrationBanner()}
        <ParokiOverviewDashboard
          onSelectLingkungan={(selectedId) => {
            setLingkunganId(selectedId)
            const allM = getAllMasterLingkungan()
            const matchedM = allM.find(m => m.id === selectedId)
            if (matchedM) setLingkunganName(matchedM.nama_lingkungan)
          }}
        />
        {renderMigrationModal()}
      </div>
    )
  }

  // ==========================================
  // VIEW KHUSUS SEKRETARIS LINGKUNGAN: DASHBOARD DATA UMAT (GAMBAR 1)
  // ==========================================
  if (userRole === 'SEKRETARIS') {
    if (loading) {
      return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-pulse">
          {/* Top Header Skeleton */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="h-8 w-72 bg-slate-200 rounded-lg" />
              <div className="h-4 w-96 max-w-full bg-slate-200 rounded" />
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="h-11 w-48 bg-slate-200 rounded-xl" />
              <div className="h-11 w-36 bg-slate-200 rounded-xl" />
            </div>
          </div>

          {/* Summary Cards Grid Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-white border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between pb-3">
                <div className="h-3 w-28 bg-slate-200 rounded" />
                <div className="w-8 h-8 bg-slate-100 rounded-xl" />
              </div>
              <div className="h-8 w-36 bg-slate-200 rounded" />
            </Card>
            <Card className="bg-white border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between pb-3">
                <div className="h-3 w-28 bg-slate-200 rounded" />
                <div className="w-8 h-8 bg-slate-100 rounded-xl" />
              </div>
              <div className="h-8 w-24 bg-slate-200 rounded" />
            </Card>
            <Card className="bg-white border-slate-200 rounded-2xl p-4 shadow-xs sm:col-span-2">
              <div className="flex items-center justify-between pb-3">
                <div className="h-3 w-40 bg-slate-200 rounded" />
                <div className="w-8 h-8 bg-slate-100 rounded-xl" />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 bg-slate-100 rounded-lg" />
                ))}
              </div>
            </Card>
          </div>

          {/* Susunan Pengurus Skeleton */}
          <Card className="bg-white border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4">
              <div className="h-5 w-64 bg-slate-200 rounded" />
              <div className="h-8 w-28 bg-slate-200 rounded-lg" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2.5">
                  <div className="h-3 w-24 bg-slate-200 rounded" />
                  <div className="h-5 w-40 bg-slate-200 rounded" />
                  <div className="h-3 w-20 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          </Card>

          {/* Table Skeleton */}
          <Card className="bg-white border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-2">
              <div className="h-5 w-56 bg-slate-200 rounded" />
              <div className="h-9 w-64 bg-slate-200 rounded-lg" />
            </div>
            <div className="space-y-3 pt-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-12 w-full bg-slate-100 rounded-lg" />
              ))}
            </div>
          </Card>
        </div>
      )
    }

    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[#1B2130] tracking-tight font-serif">
                Dashboard Data Umat & Keluarga
              </h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Rangkuman data seluruh umat, rincian keluarga, & klasifikasi golongan keluarga lingkungan{' '}
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
              <Button className="bg-slate-700 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs cursor-pointer h-11 shrink-0 w-full sm:w-auto transition-all">
                <Plus className="w-4 h-4 mr-2 text-white" />
                Input Data di DAFU
              </Button>
            </Link>

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
                <span className="text-2xl font-extrabold text-slate-900">{totalJiwa}</span>
                <span className="text-sm font-semibold text-slate-500">Jiwa Umat</span>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Status Terdaftar KAJ */}
          <Card className="bg-white border-slate-200 rounded-2xl p-1 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Terdaftar BIDUK KAJ</CardTitle>
              <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-extrabold text-slate-900">
                  {totalJiwaKaj} <span className="text-sm font-semibold text-slate-500">Jiwa</span>
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  {totalJiwaNonKaj} Jiwa Belum KAJ
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Klasifikasi Golongan */}
          <Card className="bg-white border-slate-200 rounded-2xl p-1 shadow-xs sm:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Klasifikasi Golongan Keluarga
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                {/* Tidak Mampu */}
                <div className="bg-[#FAF5F5] border border-[#EDDCDC] rounded-xl p-2.5 flex flex-col justify-between transition-colors">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#9F3A3A] shrink-0" />
                    <span className="text-[11px] font-semibold text-[#802E2E] truncate">Tidak Mampu</span>
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 mt-1 font-serif">
                    {countTidakMampu} <span className="text-xs font-normal text-slate-500 font-sans">KK</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                    Bantuan Penuh
                  </div>
                </div>

                {/* Rentan Tidak Mampu */}
                <div className="bg-[#FFF9F3] border border-[#F3E8D5] rounded-xl p-2.5 flex flex-col justify-between transition-colors">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#B45309] shrink-0" />
                    <span className="text-[11px] font-semibold text-[#8C4E09] truncate">Rentan Tdk Mampu</span>
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 mt-1 font-serif">
                    {countRentan} <span className="text-xs font-normal text-slate-500 font-sans">KK</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                    Prioritas Subsidi
                  </div>
                </div>

                {/* Terduga Prasejahtera */}
                <div className="bg-[#F6F8FA] border border-[#DDE3EA] rounded-xl p-2.5 flex flex-col justify-between transition-colors">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#526B83] shrink-0" />
                    <span className="text-[11px] font-semibold text-[#334155] truncate">Terduga Prasejahtera</span>
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 mt-1 font-serif">
                    {countTerduga} <span className="text-xs font-normal text-slate-500 font-sans">KK</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                    Perlu Ditinjau
                  </div>
                </div>

                {/* Sejahtera */}
                <div className="bg-[#F4F9F6] border border-[#D5E8DC] rounded-xl p-2.5 flex flex-col justify-between transition-colors">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F] shrink-0" />
                    <span className="text-[11px] font-semibold text-[#22543D] truncate">Sejahtera</span>
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 mt-1 font-serif">
                    {countSejahtera} <span className="text-xs font-normal text-slate-500 font-sans">KK</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                    Keluarga Mandiri
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Susunan Pengurus Lingkungan & Form Edit untuk Sekretaris */}
        {renderPengurusCard(true)}

        {/* Box Status Pengajuan Data Umat & Perubahan KK */}
        {lingkunganApprovals.length > 0 && (
          <Card className="bg-white border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <CardTitle className="text-sm font-bold text-slate-800">
                    Daftar Pengajuan Data Umat Baru &amp; Perubahan KK
                  </CardTitle>
                  <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-full">
                    Total {lingkunganApprovals.length} Usulan
                  </span>
                </div>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  Pengajuan data keluarga dari {formatNamaLingkungan(lingkunganName)} ditinjau Sekretaris Paroki untuk sinkronisasi master DAFU.
                </CardDescription>
              </div>

              {/* Option Click Filter Tabs */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setApprovalTabFilter('PENDING')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      approvalTabFilter === 'PENDING'
                        ? 'bg-slate-200 text-slate-800 border border-slate-300 font-bold shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>Dalam Pengajuan ({pendingApprovalsCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setApprovalTabFilter('APPROVED')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      approvalTabFilter === 'APPROVED'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-emerald-800 hover:bg-emerald-50'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Sudah Disetujui ({approvedApprovalsCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setApprovalTabFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      approvalTabFilter === 'ALL'
                        ? 'bg-slate-800 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    Semua ({lingkunganApprovals.length})
                  </button>
                </div>

                <Link href="/dashboard/dafu">
                  <Button size="sm" variant="outline" className="text-xs font-bold rounded-xl border-slate-300 text-slate-700 hover:bg-slate-100 h-8">
                    Buka DAFU →
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 text-slate-700 font-bold text-xs border-b border-slate-200">
                  <TableRow>
                    <TableHead className="w-12 text-center">No</TableHead>
                    <TableHead>Nama Kepala Keluarga &amp; Alamat</TableHead>
                    <TableHead>Status Pengajuan</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Usulan Golongan</TableHead>
                    <TableHead>Anggota</TableHead>
                    <TableHead>Waktu Pengajuan</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100 text-xs">
                  {(() => {
                    const displayed = lingkunganApprovals.filter(item => {
                      if (approvalTabFilter === 'PENDING') return item.status === 'PENDING'
                      if (approvalTabFilter === 'APPROVED') return item.status === 'APPROVED'
                      return true
                    })

                    if (displayed.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                            Tidak ada data pengajuan dalam tab ini.
                          </TableCell>
                        </TableRow>
                      )
                    }

                    return displayed.map((item, idx) => {
                      const isPending = item.status === 'PENDING'
                      const isEditedByParoki = item.is_edited_by_paroki || !!item.data_sebelum_edit

                      return (
                        <TableRow key={item.id} className="hover:bg-slate-50 transition">
                          <TableCell className="text-center font-bold text-slate-600">{idx + 1}</TableCell>
                          <TableCell>
                            <div className="font-bold text-slate-900">{item.nama_kk}</div>
                            <div className="text-[11px] text-slate-500">{item.alamat || 'Alamat belum diisi'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 items-start">
                              {isPending ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full">
                                  <Clock className="w-2.5 h-2.5 text-slate-500" />
                                  Dalam Pengajuan
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#F2F5F3] text-[#4E6358] border border-[#DCE5DF] px-2 py-0.5 rounded-full">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-[#4E6358]" />
                                  Sudah Disetujui
                                </span>
                              )}
                              {isEditedByParoki && (
                                <button
                                  type="button"
                                  onClick={() => setComparisonModalItem(item)}
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/90 px-2 py-0.5 rounded-full cursor-pointer transition shadow-2xs"
                                  title="Klik untuk melihat sebelum dan sesudah edit oleh Paroki"
                                >
                                  <Sparkles className="w-2.5 h-2.5 text-slate-500" />
                                  <span>Diedit Paroki (Lihat Perubahan)</span>
                                </button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                              item.action_type === 'TAMBAH_KK'
                                ? 'bg-[#F2F5F3] text-[#4E6358] border-[#DCE5DF] font-bold'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {item.action_type === 'TAMBAH_KK' ? '+ Tambah KK' : '✎ Ubah KK'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-slate-800 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-xs">
                              {item.golongan}
                            </span>
                          </TableCell>
                          <TableCell className="font-semibold text-slate-700">
                            {item.anggota_keluarga?.length || 1} Jiwa
                          </TableCell>
                          <TableCell className="text-slate-500 text-[11px]">
                            {new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {isPending ? (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditApprovalModalItem(item)}
                                  className="h-7 px-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                                  title="Edit Usulan Pengajuan"
                                >
                                  <Pencil className="w-3.5 h-3.5 mr-1 text-slate-600" />
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteApprovalItem(item)}
                                  className="h-7 px-2 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg cursor-pointer"
                                  title="Hapus Usulan Pengajuan"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                                  Hapus
                                </Button>
                              </div>
                            ) : isEditedByParoki ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setComparisonModalItem(item)}
                                className="h-7 px-2 text-[11px] font-semibold bg-white border-slate-200/90 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer shadow-2xs"
                              >
                                Sebelum vs Sesudah
                              </Button>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Disetujui</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  })()}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Search & Filter Toolbar */}
        <Card className="bg-white border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <CardHeader className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span className="text-base font-bold text-slate-800">
                  Daftar Umat & Keluarga ({filteredKkList.length} dari {kkList.length} KK)
                </span>
              </div>

              {/* Option Click Filter Status Approval */}
              <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200 text-xs w-fit">
                <button
                  type="button"
                  onClick={() => setStatusApprovalKkFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    statusApprovalKkFilter === 'ALL'
                      ? 'bg-slate-200/90 text-slate-800 border border-slate-300/80 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  Semua KK
                </button>
                <button
                  type="button"
                  onClick={() => setStatusApprovalKkFilter('PENDING')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                    statusApprovalKkFilter === 'PENDING'
                      ? 'bg-slate-200/90 text-slate-800 border border-slate-300/80 font-bold shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>Dalam Pengajuan ({pendingApprovalsCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusApprovalKkFilter('APPROVED')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                    statusApprovalKkFilter === 'APPROVED'
                      ? 'bg-[#F2F5F3] text-[#4E6358] border border-[#DCE5DF] font-bold shadow-2xs'
                      : 'text-[#4E6358] hover:bg-[#F2F5F3]/60'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Sudah Disetujui ({approvedApprovalsCount})</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Golongan Filter */}
              <div className="w-full sm:w-48">
                <Select value={filterGolongan} onValueChange={(val) => setFilterGolongan(val as any)}>
                  <SelectTrigger className="bg-white border-slate-200 text-slate-800 rounded-xl text-xs h-10">
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-slate-900">
                    <SelectItem value="ALL">Semua Status</SelectItem>
                    <SelectItem value="Tidak Mampu">Tidak Mampu</SelectItem>
                    <SelectItem value="Rentan Tidak Mampu">Rentan Tidak Mampu</SelectItem>
                    <SelectItem value="Terduga Prasejahtera">Terduga Prasejahtera</SelectItem>
                    <SelectItem value="Sejahtera">Sejahtera</SelectItem>
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
                    <SelectItem value="BIDUK">Sudah KAJ</SelectItem>
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
                  <TableHead className="text-slate-800 font-bold">Golongan</TableHead>
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
                    const kNorm = kk.nama_kk.toLowerCase().trim()
                    const isKkPending = pendingKkNameSet.has(kk.id) || pendingKkNameSet.has(kNorm)
                    const approvedItem = approvedKkMap.get(kk.id) || approvedKkMap.get(kNorm)

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
                                <ChevronDown className="w-4 h-4 text-slate-700" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              )}
                            </button>
                          </TableCell>

                          {/* Number */}
                          <TableCell className="text-center font-mono text-xs text-slate-500">
                            {idx + 1}
                          </TableCell>

                          {/* Name + Address + Approval Badges */}
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-bold text-slate-900">{kk.nama_kk}</span>
                                {isKkPending && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5 text-slate-500" />
                                    Dalam Pengajuan
                                  </span>
                                )}
                                {approvedItem && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                    Disetujui Paroki
                                  </span>
                                )}
                                {approvedItem && (approvedItem.is_edited_by_paroki || approvedItem.data_sebelum_edit) && (
                                  <button
                                    type="button"
                                    onClick={() => setComparisonModalItem(approvedItem)}
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 flex items-center gap-1 transition cursor-pointer shadow-2xs"
                                    title="Klik untuk melihat sebelum dan sesudah edit oleh Paroki"
                                  >
                                    <Sparkles className="w-2.5 h-2.5 text-blue-600" />
                                    <span>Diedit Paroki (Lihat Perubahan)</span>
                                  </button>
                                )}
                              </div>
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
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 px-2.5 py-1 rounded-xl shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                            >
                              <Users className="w-3.5 h-3.5 text-slate-600" />
                              <span>{members.length} Jiwa</span>
                              <span className="text-[11px] text-slate-400">
                                ({isExpanded ? 'Sembunyikan' : 'Rincian'})
                              </span>
                            </button>
                          </TableCell>

                          {/* KAJ Status */}
                          <TableCell className="text-center">
                            {kk.is_biduk ? (
                              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold px-2.5 py-0.5 rounded-md">
                                <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" /> KAJ
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-500 border border-slate-200 text-xs font-medium px-2.5 py-0.5 rounded-md">
                                <XCircle className="w-3.5 h-3.5 text-slate-400" /> Non-KAJ
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
                                <Pencil className="w-3.5 h-3.5 mr-1 text-slate-600" />
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
                          </TableCell>
                        </TableRow>

                        {/* Expanded Subtable (Exact DAFU Gambar 2 style) */}
                        {isExpanded && (
                          <TableRow className="bg-slate-50/90 border-b-2 border-slate-200">
                            <TableCell colSpan={7} className="p-3 sm:p-4">
                              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-slate-100 text-slate-700 rounded-lg">
                                      <Users className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                                        <span>Susunan Anggota Keluarga:</span>
                                        <span className="text-slate-900 font-extrabold">{kk.nama_kk}</span>
                                      </div>
                                      <div className="text-[11px] text-slate-500">
                                        Alamat: {kk.alamat || '-'}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-full">
                                      Total {members.length} Anggota Jiwa
                                    </span>
                                    <Link href={`/dashboard/dafu?edit=${kk.id}`}>
                                      <Button
                                        size="sm"
                                        className="h-7 text-[11px] bg-slate-700 hover:bg-slate-800 text-white font-medium rounded-lg cursor-pointer inline-flex items-center gap-1 transition-all"
                                      >
                                        <Pencil className="w-3 h-3" />
                                        Edit Anggota
                                      </Button>
                                    </Link>
                                  </div>
                                </div>

                                {/* Detailed Table of Family Members */}
                                <div className="overflow-x-auto rounded-lg border border-slate-200">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-700 font-bold text-[11px] border-b border-slate-200">
                                      <tr>
                                        <th className="py-2 px-3 w-10 text-center">No</th>
                                        <th className="py-2 px-3">Nama Lengkap Anggota</th>
                                        <th className="py-2 px-3">Hubungan / Peran</th>
                                        <th className="py-2 px-3 text-center">Status KAJ</th>
                                        <th className="py-2 px-3">Keterangan</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {members.length === 0 ? (
                                        <tr>
                                          <td colSpan={5} className="py-3 text-center text-slate-400">
                                            Tidak ada data rincian anggota keluarga.
                                          </td>
                                        </tr>
                                      ) : (
                                        members.map((m, mIdx) => (
                                          <tr key={m.id || mIdx} className="hover:bg-slate-50/80">
                                            <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">{mIdx + 1}</td>
                                            <td className="py-2 px-3 font-bold text-slate-900">{m.nama}</td>
                                            <td className="py-2 px-3">
                                              <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-medium ${
                                                m.peran === 'Kepala Keluarga'
                                                  ? 'bg-slate-100 text-slate-800 border border-slate-200 font-semibold'
                                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                                              }`}>
                                                {m.peran}
                                              </span>
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                              {m.is_kaj ? (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                                                  <CheckCircle2 className="w-3 h-3 text-slate-600" /> KAJ
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                                                  <XCircle className="w-3 h-3 text-slate-400" /> Non-KAJ
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3 text-slate-500 text-[11px]">
                                              {m.keterangan || m.peran}
                                            </td>
                                          </tr>
                                        ))
                                      )}
                                    </tbody>
                                  </table>
                                </div>
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
        {renderDetailDialog()}

        {/* Dialog Atur Pengurus Lingkungan Khusus Sekretaris */}
        {renderEditPengurusDialog()}

        {/* Local Storage Migration Modal */}
        {renderMigrationModal()}
      </div>
    )
  }

  // ==========================================
  // VIEW UNTUK BENDAHARA & PAROKI: DASHBOARD KEUANGAN & IKHTISAR
  // ==========================================
  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-pulse">
        {/* Banner Skeleton */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-slate-200 shrink-0" />
            <div className="space-y-2">
              <div className="h-4 w-32 bg-slate-200 rounded" />
              <div className="h-7 w-64 bg-slate-200 rounded" />
            </div>
          </div>
          <div className="h-9 w-40 bg-slate-200 rounded-xl" />
        </div>

        {/* 4 Financial Stat Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-white border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-3 w-24 bg-slate-200 rounded" />
                <div className="w-8 h-8 bg-slate-100 rounded-xl" />
              </div>
              <div className="h-8 w-36 bg-slate-200 rounded" />
            </Card>
          ))}
        </div>

        {/* Recent Transactions Skeleton */}
        <Card className="bg-white border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="h-5 w-48 bg-slate-200 rounded" />
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 w-full bg-slate-100 rounded-lg" />
            ))}
          </div>
        </Card>
      </div>
    )
  }

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
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 tracking-tight">
              {userRole === 'PAROKI'
                ? 'Ringkasan Keuangan & Umat Paroki'
                : 'Ringkasan Keuangan Lingkungan'}
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              Pantau arus kas, posisi saldo bank, data penerimaan dan pengeluaran secara akurat.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5 shrink-0">
          {userRole === 'PAROKI' ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('selected_lingkungan_id', 'all')
                    window.dispatchEvent(new Event('lingkunganChanged'))
                    window.dispatchEvent(new Event('storage'))
                  }
                  setLingkunganId('all')
                  setLingkunganName('Seluruh Lingkungan')
                }}
                className="bg-white hover:bg-slate-100 text-slate-700 border-slate-300 font-bold px-3 py-2 rounded-xl shadow-2xs cursor-pointer transition-all text-xs"
              >
                ← Seluruh Lingkungan
              </Button>
              <Link href="/dashboard/paroki/sekretaris">
                <Button className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold px-3.5 py-2.5 rounded-xl shadow-2xs cursor-pointer transition-all text-xs">
                  <Users className="w-4 h-4 mr-1.5 text-slate-600" />
                  Sekretariat Paroki
                </Button>
              </Link>
              <Link href="/dashboard/paroki/bendahara">
                <Button className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold px-3.5 py-2.5 rounded-xl shadow-2xs cursor-pointer transition-all text-xs">
                  <CreditCard className="w-4 h-4 mr-1.5 text-slate-600" />
                  Monitoring Kas & Setoran
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/dashboard/jurnal">
                <Button className="bg-slate-700 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs cursor-pointer transition-all text-xs">
                  <Receipt className="w-4 h-4 mr-2 text-white" />
                  Input Jurnal
                </Button>
              </Link>
              <Link href="/dashboard/laporan">
                <Button variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold rounded-xl cursor-pointer text-xs">
                  <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />
                  Laporan
                </Button>
              </Link>
            </>
          )}

        </div>
      </div>

      {/* ALERT KEAKTIFAN TRANSAKSI BENDAHARA LINGKUNGAN (Soft Grey Theme) */}
      {userRole !== 'PAROKI' && (
        daysSinceLastTx === null ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-slate-200/80 text-slate-700 rounded-xl shrink-0 mt-0.5">
                <Clock className="w-5 h-5 text-slate-700" />
              </div>
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 font-serif">
                    Pemberitahuan: Belum Ada Transaksi Tercatat
                  </h4>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 border border-slate-300">
                    Perlu Input Mutasi Kas
                  </span>
                </div>
                <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                  Lingkungan <strong className="text-slate-800">{formatNamaLingkungan(lingkunganName)}</strong> belum memiliki riwayat transaksi penerimaan maupun pengeluaran kas. Silakan mulai membukukan iuran umat, kolekte, atau mutasi operasional lingkungan Anda.
                </p>
              </div>
            </div>

            <Link href="/dashboard/jurnal" className="shrink-0">
              <Button
                size="sm"
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl px-4 py-2 cursor-pointer shadow-xs transition flex items-center gap-1.5"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Input Transaksi Pertama →</span>
              </Button>
            </Link>
          </div>
        ) : daysSinceLastTx >= 7 ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-slate-200/80 text-slate-700 rounded-xl shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5 text-slate-700" />
              </div>
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 font-serif">
                    Peringatan: Belum Ada Transaksi Baru Selama {daysSinceLastTx} Hari
                  </h4>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 border border-slate-300">
                    Tidak Aktif {daysSinceLastTx} Hari
                  </span>
                </div>
                <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                  Transaksi kas terakhir tercatat pada tanggal <strong className="text-slate-800">{latestTransactionDate ? formatDateIndo(latestTransactionDate) : '-'}</strong> ({daysSinceLastTx} hari yang lalu). Harap periksa dan catat mutasi kas atau setoran terbaru agar pembukuan tetap tertib dan mutakhir.
                </p>
              </div>
            </div>

            <Link href="/dashboard/jurnal" className="shrink-0">
              <Button
                size="sm"
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl px-4 py-2 cursor-pointer shadow-xs transition flex items-center gap-1.5"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Catat Transaksi Sekarang →</span>
              </Button>
            </Link>
          </div>
        ) : null
      )}

      {/* STRUKTUR PENGURUS LINGKUNGAN */}
      {renderPengurusCard(userRole === 'PAROKI')}

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
              <CardTitle className="text-sm font-bold text-slate-800">Akses Cepat Bendahara</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-1">
              <Link href="/dashboard/coa-saldo" className="p-2.5 rounded-xl flex items-center justify-between hover:bg-slate-50 transition text-slate-700 group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">COA & Saldo Awal</div>
                    <div className="text-[11px] text-slate-400">Pengaturan saldo awal & bagan akun</div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-700" />
              </Link>

              <Link href="/dashboard/jurnal" className="p-2.5 rounded-xl flex items-center justify-between hover:bg-slate-50 transition text-slate-700 group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">Jurnal Transaksi</div>
                    <div className="text-[11px] text-slate-400">Catat penerimaan & pengeluaran kas</div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-700" />
              </Link>

              <Link href="/dashboard/laporan" className="p-2.5 rounded-xl flex items-center justify-between hover:bg-slate-50 transition text-slate-700 group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-50 text-purple-700">
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

      {/* SEKSI INTEGRASI DATA UMAT & GOLONGAN DARI SEKRETARIS */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-semibold tracking-wide">
                {formatNamaLingkungan(lingkunganName)}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-800 mt-1 font-serif">Data Keluarga & Klasifikasi Golongan Umat</h2>
            <p className="text-xs text-slate-500">
              Data seluruh KK, anggota keluarga, dan status golongan yang diinput oleh Sekretaris Lingkungan tersinkronisasi otomatis ke Bendahara dan Paroki.
            </p>
          </div>
        </div>

        {/* 4 Golongan Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Tidak Mampu
              </div>
              <div className="text-2xl font-extrabold text-slate-900">{countTidakMampu} <span className="text-xs font-normal text-slate-500">KK</span></div>
            </div>
            <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-1 rounded-md font-medium border border-slate-200">
              Bantuan Penuh
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Rentan Tdk Mampu
              </div>
              <div className="text-2xl font-extrabold text-slate-900">{countRentan} <span className="text-xs font-normal text-slate-500">KK</span></div>
            </div>
            <span className="text-[11px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-medium border border-slate-200">
              Prioritas Subsidi
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Terduga Prasejahtera
              </div>
              <div className="text-2xl font-extrabold text-slate-900">{countTerduga} <span className="text-xs font-normal text-slate-500">KK</span></div>
            </div>
            <span className="text-[11px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-medium border border-slate-200">
              Perlu Perhatian
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Sejahtera
              </div>
              <div className="text-2xl font-extrabold text-slate-900">{countSejahtera} <span className="text-xs font-normal text-slate-500">KK</span></div>
            </div>
            <span className="text-[11px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-medium border border-slate-200">
              Keluarga Mandiri
            </span>
          </div>
        </div>

        {/* Data Keluarga List Table for Bendahara */}
        <Card className="bg-white border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <CardHeader className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                Daftar Keluarga ({filteredKkList.length} KK)
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Klik tombol panah atau baris untuk melihat seluruh anggota keluarga yang diinput Sekretaris
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari KK / Alamat..."
                  className="pl-8 bg-slate-50 border-slate-200 text-xs rounded-xl h-9 text-slate-900"
                />
              </div>

              <Select value={filterGolongan} onValueChange={(val) => setFilterGolongan(val as any)}>
                <SelectTrigger className="w-[140px] bg-slate-50 border-slate-200 text-xs rounded-xl h-9 text-slate-900">
                  <SelectValue placeholder="Semua Golongan" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900">
                  <SelectItem value="ALL">Semua Golongan</SelectItem>
                  <SelectItem value="Tidak Mampu">Tidak Mampu</SelectItem>
                  <SelectItem value="Rentan Tidak Mampu">Rentan Tidak Mampu</SelectItem>
                  <SelectItem value="Terduga Prasejahtera">Terduga Prasejahtera</SelectItem>
                  <SelectItem value="Sejahtera">Sejahtera</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="w-10 text-center"></TableHead>
                  <TableHead className="w-12 text-center font-bold text-xs text-slate-700">No</TableHead>
                  <TableHead className="font-bold text-xs text-slate-700">Kepala Keluarga</TableHead>
                  <TableHead className="font-bold text-xs text-slate-700">Alamat</TableHead>
                  <TableHead className="font-bold text-xs text-slate-700">Status KAJ</TableHead>
                  <TableHead className="font-bold text-xs text-slate-700">Golongan</TableHead>
                  <TableHead className="font-bold text-xs text-slate-700">Total Jiwa</TableHead>
                  <TableHead className="text-right font-bold text-xs text-slate-700">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {filteredKkList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-400 text-xs">
                      Tidak ada data keluarga yang sesuai kriteria pencarian.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredKkList.map((k, idx) => {
                    const members = anggotaMap[k.id] || []
                    const gol = golonganMap[k.id]
                    const isExpanded = expandedKkIds.has(k.id)

                    return (
                      <React.Fragment key={k.id}>
                        <TableRow className={`hover:bg-slate-50/80 transition ${isExpanded ? 'bg-slate-50/60' : ''}`}>
                          <TableCell className="text-center p-2 w-10">
                            <button
                              type="button"
                              onClick={() => toggleExpandKk(k.id)}
                              className="p-1 rounded hover:bg-slate-200 text-slate-500 transition cursor-pointer"
                              title={isExpanded ? 'Tutup rincian anggota keluarga' : 'Buka rincian anggota keluarga'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-slate-700" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="text-center text-xs font-semibold text-slate-500 w-12">{idx + 1}</TableCell>
                          <TableCell>
                            <div className="cursor-pointer select-none" onClick={() => toggleExpandKk(k.id)}>
                              <div className="font-bold text-slate-900 text-xs hover:text-emerald-700 flex items-center gap-1.5">
                                <span>{k.nama_kk}</span>
                                <span className="text-[10px] font-semibold text-slate-400">
                                  ({members.length} Jiwa)
                                </span>
                              </div>
                              {members.length > 0 && !isExpanded && (
                                <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                                  {members.map(m => `${m.nama} (${m.peran})`).join(', ')}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">{k.alamat || '-'}</TableCell>
                          <TableCell>
                            {k.is_biduk ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                                <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" /> KAJ
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                                <XCircle className="w-3.5 h-3.5 text-slate-400" /> Non-KAJ
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {getGolonganBadge(gol?.golongan, gol?.kriteria_catatan)}
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-slate-900 text-xs">{members.length || 1}</span>{' '}
                            <span className="text-[10px] text-slate-400">Jiwa</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewingKk(k)}
                              className="text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 h-8 px-2.5 rounded-lg cursor-pointer"
                              title="Lihat Detail"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              Detail
                            </Button>
                          </TableCell>
                        </TableRow>

                        {/* Expandable Dropdown Row (Exact DAFU Gambar 2 style) */}
                        {isExpanded && (
                          <TableRow className="bg-slate-50/90 border-b-2 border-slate-200">
                            <TableCell colSpan={8} className="p-3 sm:p-4">
                              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-slate-100 text-slate-700 rounded-lg">
                                      <Users className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                                        <span>Susunan Anggota Keluarga:</span>
                                        <span className="text-slate-900 font-extrabold">{k.nama_kk}</span>
                                      </div>
                                      <div className="text-[11px] text-slate-500">
                                        Alamat: {k.alamat || '-'} • Wilayah {k.wilayah || getWilayahForLingkungan(lingkunganName || '')}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-full">
                                      Total {members.length} Anggota Jiwa
                                    </span>
                                      <Link href={`/dashboard/dafu?edit=${k.id}`}>
                                        <Button size="sm" className="h-7 text-[11px] bg-slate-700 hover:bg-slate-800 text-white font-medium rounded-lg cursor-pointer inline-flex items-center gap-1 transition-all">
                                          <Pencil className="w-3 h-3 mr-1" />
                                          Edit Anggota
                                        </Button>
                                      </Link>
                                  </div>
                                </div>

                                {/* Detailed Table of Family Members */}
                                <div className="overflow-x-auto rounded-lg border border-slate-200">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-700 font-bold text-[11px] border-b border-slate-200">
                                      <tr>
                                        <th className="py-2 px-3 w-10 text-center">No</th>
                                        <th className="py-2 px-3">Nama Lengkap Anggota</th>
                                        <th className="py-2 px-3">Hubungan / Peran</th>
                                        <th className="py-2 px-3 text-center">Status KAJ</th>
                                        <th className="py-2 px-3">Keterangan</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {members.length === 0 ? (
                                        <tr>
                                          <td colSpan={5} className="py-3 text-center text-slate-400">
                                            Tidak ada data rincian anggota keluarga.
                                          </td>
                                        </tr>
                                      ) : (
                                        members.map((m, mIdx) => (
                                          <tr key={m.id || mIdx} className="hover:bg-slate-50/80">
                                            <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">{mIdx + 1}</td>
                                            <td className="py-2 px-3 font-bold text-slate-900">{m.nama}</td>
                                            <td className="py-2 px-3">
                                              <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-medium ${
                                                m.peran === 'Kepala Keluarga'
                                                  ? 'bg-slate-100 text-slate-800 border border-slate-200 font-semibold'
                                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                                              }`}>
                                                {m.peran}
                                              </span>
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                              {m.is_kaj ? (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                                                  <CheckCircle2 className="w-3 h-3 text-slate-600" /> KAJ
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                                                  <XCircle className="w-3 h-3 text-slate-400" /> Non-KAJ
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3 text-slate-500 text-[11px]">
                                              {m.keterangan || m.peran}
                                            </td>
                                          </tr>
                                        ))
                                      )}
                                    </tbody>
                                  </table>
                                </div>
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
      </div>

      {/* Dialog Atur Pengurus Lingkungan */}
      {renderEditPengurusDialog()}

      {/* Detail Dialog for Bendahara & Paroki */}
      {renderDetailDialog()}

      {/* Local Storage Migration Modal */}
      {renderMigrationModal()}

      {/* Edit Pending Approval Modal for Sekretaris Lingkungan */}
      <EditDafuApprovalModal
        item={editApprovalModalItem}
        open={!!editApprovalModalItem}
        onClose={() => setEditApprovalModalItem(null)}
        onSuccess={async (msg) => {
          setEditApprovalModalItem(null)
          const latest = await fetchDafuApprovals()
          const targetUuid = getLingkunganDbUuid(lingkunganId || '')
          const lNorm = (lingkunganName || '').toLowerCase().replace(/[^a-z0-9]/g, '')
          const matched = (latest || []).filter(a => {
            const aUuid = getLingkunganDbUuid(a.lingkungan_id)
            const aNorm = (a.nama_lingkungan || '').toLowerCase().replace(/[^a-z0-9]/g, '')
            return (
              lingkunganId === 'all' ||
              a.lingkungan_id === lingkunganId ||
              (targetUuid && aUuid && targetUuid === aUuid) ||
              (lNorm && aNorm && (lNorm === aNorm || lNorm.includes(aNorm) || aNorm.includes(lNorm)))
            )
          })
          setLingkunganApprovals(matched)
          setPendingApprovals(matched.filter(a => a.status === 'PENDING'))
        }}
        userRole="SEKRETARIS_LINGKUNGAN"
      />

      {/* Comparison Modal (Sebelum vs Sesudah Edit) */}
      <DafuComparisonModal
        item={comparisonModalItem}
        open={!!comparisonModalItem}
        onClose={() => setComparisonModalItem(null)}
      />

      {/* Dialog Konfirmasi Hapus Pengajuan Umat */}
      <Dialog open={!!deleteApprovalItem} onOpenChange={(o) => !o && setDeleteApprovalItem(null)}>
        <DialogContent className="sm:max-w-md bg-white text-slate-900 border-slate-200 rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              Hapus Pengajuan Data Umat
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-1">
              Apakah Anda yakin ingin menghapus atau membatalkan usulan pengajuan keluarga{' '}
              <strong>{deleteApprovalItem?.nama_kk}</strong>? Pengajuan ini akan dihapus dari antrean persetujuan Paroki.
            </p>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteApprovalItem(null)}
              disabled={deletingApproval}
              className="text-xs font-semibold text-slate-700 border-slate-300 rounded-xl cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmDeleteApproval}
              disabled={deletingApproval}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl cursor-pointer"
            >
              {deletingApproval ? 'Menghapus...' : 'Ya, Hapus Pengajuan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Hapus Anggota / Kepala Keluarga */}
      <Dialog open={!!deleteKkModalItem} onOpenChange={(o) => !o && !deletingKk && setDeleteKkModalItem(null)}>
        <DialogContent className="sm:max-w-md bg-white text-slate-900 border-slate-200 rounded-2xl p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#F6F2F2] border border-[#E3D8D8] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-[#6B5353]" />
              </div>
              {(userRole as string) === 'SEKRETARIS' ? 'Ajukan Penghapusan Anggota / KK' : 'Hapus Anggota / Kepala Keluarga'}
            </DialogTitle>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Apakah Anda yakin ingin {(userRole as string) === 'SEKRETARIS' ? 'mengajukan penghapusan' : 'menghapus'} anggota / Kepala Keluarga{' '}
              <strong className="text-slate-900">{deleteKkModalItem?.nama}</strong>?
            </p>
            <div className="mt-2.5 p-3 rounded-xl bg-[#F6F2F2] border border-[#E3D8D8] text-[11px] text-[#6B5353] leading-relaxed">
              {(userRole as string) === 'SEKRETARIS' ? (
                <>
                  Sesuai alur sistem, pengajuan penghapusan ini akan dikirim ke <strong>Sekretaris Paroki</strong> untuk disetujui terlebih dahulu. Setelah disetujui (Approved), data akan otomatis terhapus dari <strong>DAFU Sekretaris</strong>, <strong>DAFU Bendahara</strong>, dan <strong>DAFU Paroki</strong>, serta tetap tercatat di <strong>Kartu Setoran</strong> dengan status <strong>Pindah</strong>.
                </>
              ) : (
                <>
                  Data ini akan langsung terhapus dari <strong>DAFU Sekretaris</strong>, <strong>DAFU Bendahara</strong>, dan <strong>DAFU Paroki</strong>, namun riwayatnya tetap tersimpan di <strong>Kartu Setoran</strong> dengan tanda status <strong>Pindah</strong>.
                </>
              )}
            </div>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteKkModalItem(null)}
              disabled={deletingKk}
              className="text-xs font-semibold text-slate-700 border-slate-300 rounded-xl cursor-pointer px-4"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmDeleteKk}
              disabled={deletingKk}
              className="bg-[#7A5C5C] hover:bg-[#6B5353] text-white font-semibold text-xs rounded-xl cursor-pointer px-4"
            >
              {deletingKk
                ? 'Memproses...'
                : ((userRole as string) === 'SEKRETARIS' ? 'Ya, Ajukan Hapus ke Paroki' : 'Ya, Hapus Anggota')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
