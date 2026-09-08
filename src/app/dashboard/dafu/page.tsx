'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  UserRole,
  UserProfile,
  KepalaKeluarga,
  Lingkungan,
  AnggotaKeluarga,
  GolonganKeluarga,
  KategoriGolongan,
  PeranKeluarga,
  KepalaKeluargaWithDetails
} from '@/lib/types'
import { MASTER_LINGKUNGAN_LIST, formatNamaLingkungan } from '@/lib/constants'
import {
  ensureDummyKksForLingkungan,
  getDummyAnggotaForKk,
  getDummyGolonganForKk
} from '@/lib/dummyData'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Users,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Lock,
  Building,
  ChevronDown,
  ChevronRight,
  UserPlus,
  HeartHandshake,
  Layers,
  Sparkles,
  HelpCircle,
  Eye,
  Filter
} from 'lucide-react'

const ROLE_OPTIONS: PeranKeluarga[] = [
  'Kepala Keluarga',
  'Suami',
  'Istri',
  'Anak',
  'Orang Tua',
  'Famili Lain'
]

interface MemberFormItem {
  id?: string
  nama: string
  peran: PeranKeluarga
  is_kaj: boolean
  keterangan: string
}

export default function DafuPage() {
  const supabase = createClient()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [lingkunganId, setLingkunganId] = useState<string | null>(null)
  const [lingkunganName, setLingkunganName] = useState<string>('')
  const [lingkunganList, setLingkunganList] = useState<Lingkungan[]>([])

  // Main Family and Relations State
  const [kkList, setKkList] = useState<KepalaKeluarga[]>([])
  const [anggotaMap, setAnggotaMap] = useState<Record<string, AnggotaKeluarga[]>>({})
  const [golonganMap, setGolonganMap] = useState<Record<string, GolonganKeluarga>>({})
  const [expandedKkIds, setExpandedKkIds] = useState<Set<string>>(new Set())

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [filterGolongan, setFilterGolongan] = useState<'ALL' | KategoriGolongan>('ALL')
  const [filterKaj, setFilterKaj] = useState<'ALL' | 'BIDUK' | 'NON_BIDUK'>('ALL')

  // Pengurus Role State (Synced with Daftar Isian)
  const [ketuaId, setKetuaId] = useState<string | null>(null)
  const [ketuaNama, setKetuaNama] = useState<string>('')
  const [sekretarisId, setSekretarisId] = useState<string | null>(null)
  const [sekretarisNama, setSekretarisNama] = useState<string>('')
  const [bendaharaId, setBendaharaId] = useState<string | null>(null)
  const [bendaharaNama, setBendaharaNama] = useState<string>('')

  // Modal State (Add / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingKk, setEditingKk] = useState<KepalaKeluarga | null>(null)
  const [formNama, setFormNama] = useState('')
  const [formAlamat, setFormAlamat] = useState('')
  const [formIsBiduk, setFormIsBiduk] = useState<boolean>(true)
  const [formGolongan, setFormGolongan] = useState<KategoriGolongan>('MENENGAH')
  const [formKriteriaCatatan, setFormKriteriaCatatan] = useState('')
  const [formAnggotaList, setFormAnggotaList] = useState<MemberFormItem[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Detail Modal State (Read-only view for Bendahara/Paroki/Sekretaris)
  const [viewingKk, setViewingKk] = useState<KepalaKeluarga | null>(null)

  const prepareMasterLingkunganList = (dbList: Lingkungan[]): Lingkungan[] => {
    const map = new Map<string, Lingkungan>()

    dbList.forEach(l => {
      const cleanName = l.nama_lingkungan.replace(/^lingkungan\s+/i, '').trim()
      map.set(cleanName.toLowerCase(), { id: l.id, nama_lingkungan: cleanName })
    })

    MASTER_LINGKUNGAN_LIST.forEach((mName) => {
      const key = mName.toLowerCase().trim()
      if (!map.has(key)) {
        map.set(key, {
          id: `csv-${key.replace(/[^a-z0-9]/g, '-')}`,
          nama_lingkungan: mName
        })
      }
    })

    return Array.from(map.values()).sort((a, b) => a.nama_lingkungan.localeCompare(b.nama_lingkungan))
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const { data } = await supabase.auth.getUser()
        const user = data?.user

        let currentRole: UserRole = 'SEKRETARIS'
        let currentLingkunganId: string | null = null
        let currentLingkunganNama: string | null = null

        if (user) {
          const { data: uData } = await supabase.from('users').select('*, lingkungan:lingkungan_id(nama_lingkungan)').eq('id', user.id).maybeSingle()
          if (uData) {
            setUserProfile(uData)
            currentRole = uData.role
            currentLingkunganId = uData.lingkungan_id
            currentLingkunganNama = uData.lingkungan?.nama_lingkungan || null
          }
        } else {
          const cookies = typeof document !== 'undefined' ? document.cookie : ''
          const getCookieVal = (name: string) => {
            const v = `; ${cookies}`
            const p = v.split(`; ${name}=`)
            if (p.length === 2) return decodeURIComponent(p.pop()!.split(';').shift()!)
            return null
          }

          if (cookies.includes('demo_user_role=BENDAHARA')) {
            currentRole = 'BENDAHARA'
          } else if (cookies.includes('demo_user_role=PAROKI')) {
            currentRole = 'PAROKI'
          } else if (cookies.includes('demo_user_role=SEKRETARIS')) {
            currentRole = 'SEKRETARIS'
          }

          currentLingkunganId = getCookieVal('demo_user_lingkungan_id')
          currentLingkunganNama = getCookieVal('demo_user_lingkungan_nama')

          setUserProfile({
            id: 'demo-user',
            email: `${currentRole.toLowerCase()}@example.com`,
            role: currentRole,
            lingkungan_id: currentRole === 'PAROKI' ? null : currentLingkunganId,
            lingkungan_nama: currentRole === 'PAROKI' ? undefined : (currentLingkunganNama || undefined),
          })
        }

        const { data: allL } = await supabase.from('lingkungan').select('id, nama_lingkungan').order('nama_lingkungan', { ascending: true })
        const masterList = prepareMasterLingkunganList(allL || [])
        setLingkunganList(masterList)

        let targetLingkunganId: string | null = null

        // STRICT SCOPE: Non-PAROKI users are strictly locked to their own assigned Lingkungan!
        if (currentRole !== 'PAROKI' && currentLingkunganId) {
          targetLingkunganId = currentLingkunganId
        } else {
          targetLingkunganId = localStorage.getItem('selected_lingkungan_id')
          if (!targetLingkunganId && masterList.length > 0) {
            targetLingkunganId = masterList[0].id
          }
        }

        if (targetLingkunganId) {
          const matched = masterList.find(l => l.id === targetLingkunganId)
          const lName = matched?.nama_lingkungan || currentLingkunganNama || ''
          if (lName) setLingkunganName(lName)
          setLingkunganId(targetLingkunganId)
          await loadKksAndProfil(targetLingkunganId, lName)
        }
      } catch (err) {
        console.error('Error loading dafu data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [supabase])

  const loadKksAndProfil = async (id: string, lName: string) => {
    // 1. Fetch KK List from Supabase & LocalStorage
    const { data: kks } = await supabase
      .from('kepala_keluarga')
      .select('*')
      .eq('lingkungan_id', id)
      .order('nama_kk', { ascending: true })

    let dbKks = kks || []
    const localSaved = localStorage.getItem(`custom_kks_${id}`)
    if (localSaved) {
      try {
        const parsed: KepalaKeluarga[] = JSON.parse(localSaved)
        const combinedMap = new Map<string, KepalaKeluarga>()
        dbKks.forEach(k => combinedMap.set(k.id, k))
        parsed.forEach(k => combinedMap.set(k.id, k))
        dbKks = Array.from(combinedMap.values())
      } catch (e) {
        console.error(e)
      }
    }
    const allSaved = localStorage.getItem('custom_kks_all_store')
    if (allSaved) {
      try {
        const allParsed: KepalaKeluarga[] = JSON.parse(allSaved)
        const matched = allParsed.filter(k => k.lingkungan_id === id)
        const combinedMap = new Map<string, KepalaKeluarga>()
        dbKks.forEach(k => combinedMap.set(k.id, k))
        matched.forEach(k => combinedMap.set(k.id, k))
        dbKks = Array.from(combinedMap.values())
      } catch (e) {
        console.error(e)
      }
    }

    const finalKks = ensureDummyKksForLingkungan(id, lName || 'Lingkungan', dbKks)
    setKkList(finalKks)

    // 2. Fetch Anggota Keluarga & Golongan from Supabase & LocalStorage
    await loadAnggotaAndGolongan(finalKks, id)

    // 3. Fetch Profil Lingkungan (Pengurus Roles)
    setKetuaId(null)
    setKetuaNama('')
    setSekretarisId(null)
    setSekretarisNama('')
    setBendaharaId(null)
    setBendaharaNama('')

    const { data: profil } = await supabase
      .from('profil_lingkungan')
      .select('ketua_id, sekretaris_id, bendahara_id, ketua_nama, sekretaris_nama, bendahara_nama, ketua:ketua_id(nama_kk), sekretaris:sekretaris_id(nama_kk), bendahara:bendahara_id(nama_kk)')
      .eq('lingkungan_id', id)
      .maybeSingle()

    if (profil) {
      const pAny = profil as any
      if (pAny.ketua_id) setKetuaId(pAny.ketua_id)
      if (pAny.ketua_nama) setKetuaNama(pAny.ketua_nama)
      else if (pAny.ketua) {
        const kObj = Array.isArray(pAny.ketua) ? pAny.ketua[0] : pAny.ketua
        if (kObj?.nama_kk) setKetuaNama(kObj.nama_kk)
      }

      if (pAny.sekretaris_id) setSekretarisId(pAny.sekretaris_id)
      if (pAny.sekretaris_nama) setSekretarisNama(pAny.sekretaris_nama)
      else if (pAny.sekretaris) {
        const sObj = Array.isArray(pAny.sekretaris) ? pAny.sekretaris[0] : pAny.sekretaris
        if (sObj?.nama_kk) setSekretarisNama(sObj.nama_kk)
      }

      if (pAny.bendahara_id) setBendaharaId(pAny.bendahara_id)
      if (pAny.bendahara_nama) setBendaharaNama(pAny.bendahara_nama)
      else if (pAny.bendahara) {
        const bObj = Array.isArray(pAny.bendahara) ? pAny.bendahara[0] : pAny.bendahara
        if (bObj?.nama_kk) setBendaharaNama(bObj.nama_kk)
      }
    }

    // Merge saved local manual entry if any
    const slugKey = (lName || '').toLowerCase().replace(/[^a-z0-9]/g, '-')
    const savedManual = localStorage.getItem(`profil_manual_${id}`) || (slugKey ? localStorage.getItem(`profil_manual_${slugKey}`) : null)
    if (savedManual) {
      try {
        const p = JSON.parse(savedManual)
        if (p.ketuaId) setKetuaId(p.ketuaId)
        if (p.ketuaNama) setKetuaNama(p.ketuaNama)
        if (p.sekretarisId) setSekretarisId(p.sekretarisId)
        if (p.sekretarisNama) setSekretarisNama(p.sekretarisNama)
        if (p.bendaharaId) setBendaharaId(p.bendaharaId)
        if (p.bendaharaNama) setBendaharaNama(p.bendaharaNama)
      } catch (e) {
        console.error(e)
      }
    }
  }

  const loadAnggotaAndGolongan = async (kks: KepalaKeluarga[], lId: string) => {
    const kkIds = kks.map(k => k.id)
    const newAnggotaMap: Record<string, AnggotaKeluarga[]> = {}
    const newGolonganMap: Record<string, GolonganKeluarga> = {}

    // Load from local store first
    let localAnggotaStore: Record<string, AnggotaKeluarga[]> = {}
    let localGolonganStore: Record<string, GolonganKeluarga> = {}
    try {
      const rawA = localStorage.getItem('custom_anggota_all_store')
      if (rawA) localAnggotaStore = JSON.parse(rawA)
      const rawG = localStorage.getItem('custom_golongan_all_store')
      if (rawG) localGolonganStore = JSON.parse(rawG)
    } catch (e) {
      console.error(e)
    }

    // Try fetching from Supabase if table exists
    let supabaseAnggota: AnggotaKeluarga[] = []
    let supabaseGolongan: GolonganKeluarga[] = []

    if (kkIds.length > 0) {
      try {
        const { data: aData } = await supabase
          .from('anggota_keluarga')
          .select('*')
          .in('kk_id', kkIds)
        if (aData) supabaseAnggota = aData
      } catch (e) {
        // Table may be migrating
      }

      try {
        const { data: gData } = await supabase
          .from('golongan_keluarga')
          .select('*')
          .in('kk_id', kkIds)
        if (gData) supabaseGolongan = gData
      } catch (e) {
        // Table may be migrating
      }
    }

    // Assign to state map for each KK
    kks.forEach(kk => {
      // 1. Anggota
      let members = supabaseAnggota.filter(a => a.kk_id === kk.id)
      if (members.length === 0 && localAnggotaStore[kk.id]) {
        members = localAnggotaStore[kk.id]
      }
      if (members.length === 0) {
        // Fallback to generated realistic members
        members = getDummyAnggotaForKk(kk)
      }
      newAnggotaMap[kk.id] = members

      // 2. Golongan
      let gol = supabaseGolongan.find(g => g.kk_id === kk.id)
      if (!gol && localGolonganStore[kk.id]) {
        gol = localGolonganStore[kk.id]
      }
      if (!gol) {
        // Fallback to generated dummy golongan
        gol = getDummyGolonganForKk(kk)
      }
      newGolonganMap[kk.id] = gol
    })

    setAnggotaMap(newAnggotaMap)
    setGolonganMap(newGolonganMap)
  }

  const handleLingkunganChange = async (id: string) => {
    // Only PAROKI can switch between Lingkungan
    if (userProfile?.role !== 'PAROKI') return

    setLingkunganId(id)
    localStorage.setItem('selected_lingkungan_id', id)
    const selected = lingkunganList.find(l => l.id === id)
    const lName = selected?.nama_lingkungan || ''
    if (selected) setLingkunganName(lName)
    await loadKksAndProfil(id, lName)
  }

  const userRole = userProfile?.role || 'SEKRETARIS'
  const canEdit = userRole === 'SEKRETARIS'

  const toggleExpandKk = (id: string) => {
    setExpandedKkIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openAddModal = () => {
    setEditingKk(null)
    setFormNama('')
    setFormAlamat('')
    setFormIsBiduk(true)
    setFormGolongan('MENENGAH')
    setFormKriteriaCatatan('')
    // Default 1 member (the Head of family)
    setFormAnggotaList([
      {
        nama: '',
        peran: 'Kepala Keluarga',
        is_kaj: true,
        keterangan: 'Kepala Keluarga'
      }
    ])
    setIsModalOpen(true)
  }

  const openEditModal = (kk: KepalaKeluarga) => {
    setEditingKk(kk)
    setFormNama(kk.nama_kk)
    setFormAlamat(kk.alamat || '')
    setFormIsBiduk(kk.is_biduk)

    const existingGol = golonganMap[kk.id]
    setFormGolongan(existingGol?.golongan || 'MENENGAH')
    setFormKriteriaCatatan(existingGol?.kriteria_catatan || '')

    const existingMembers = anggotaMap[kk.id] || []
    if (existingMembers.length > 0) {
      setFormAnggotaList(
        existingMembers.map(m => ({
          id: m.id,
          nama: m.nama,
          peran: m.peran,
          is_kaj: m.is_kaj,
          keterangan: m.keterangan || ''
        }))
      )
    } else {
      setFormAnggotaList([
        {
          nama: kk.nama_kk,
          peran: 'Kepala Keluarga',
          is_kaj: kk.is_biduk,
          keterangan: 'Kepala Keluarga'
        }
      ])
    }

    setIsModalOpen(true)
  }

  const handleAddMemberRow = () => {
    setFormAnggotaList(prev => [
      ...prev,
      {
        nama: '',
        peran: 'Anak',
        is_kaj: true,
        keterangan: ''
      }
    ])
  }

  const handleRemoveMemberRow = (index: number) => {
    setFormAnggotaList(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpdateMemberRow = (index: number, field: keyof MemberFormItem, value: any) => {
    setFormAnggotaList(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lingkunganId || !formNama.trim()) return

    setSubmitting(true)
    const kkPayload = {
      lingkungan_id: lingkunganId,
      nama_kk: formNama.trim(),
      alamat: formAlamat.trim() || null,
      is_biduk: formIsBiduk,
    }

    let savedKkId = editingKk?.id

    if (editingKk) {
      const { error } = await supabase.from('kepala_keluarga').update(kkPayload).eq('id', editingKk.id)
      if (error) {
        console.warn('Supabase RLS/DB info:', error.message)
      }
      setKkList(prev => {
        const updated = prev.map(k => k.id === editingKk.id ? { ...k, ...kkPayload } : k)
        localStorage.setItem(`custom_kks_${kkPayload.lingkungan_id}`, JSON.stringify(updated))
        const allSaved = localStorage.getItem('custom_kks_all_store')
        let allList: KepalaKeluarga[] = []
        if (allSaved) {
          try { allList = JSON.parse(allSaved) } catch(e) {}
        }
        allList = allList.filter(k => k.id !== editingKk.id)
        allList.push({ id: editingKk.id, ...kkPayload })
        localStorage.setItem('custom_kks_all_store', JSON.stringify(allList))
        return updated
      })
    } else {
      const { data, error } = await supabase.from('kepala_keluarga').insert(kkPayload).select().single()
      if (error) {
        console.warn('Supabase RLS/DB info:', error.message)
      }
      const newItem: KepalaKeluarga = data || {
        id: 'kk-' + Date.now(),
        lingkungan_id: kkPayload.lingkungan_id,
        nama_kk: kkPayload.nama_kk,
        alamat: kkPayload.alamat,
        is_biduk: kkPayload.is_biduk,
      }
      savedKkId = newItem.id
      setKkList(prev => {
        const updated = [...prev, newItem].sort((a, b) => a.nama_kk.localeCompare(b.nama_kk))
        localStorage.setItem(`custom_kks_${kkPayload.lingkungan_id}`, JSON.stringify(updated))
        const allSaved = localStorage.getItem('custom_kks_all_store')
        let allList: KepalaKeluarga[] = []
        if (allSaved) {
          try { allList = JSON.parse(allSaved) } catch(e) {}
        }
        allList = allList.filter(k => k.id !== newItem.id)
        allList.push(newItem)
        localStorage.setItem('custom_kks_all_store', JSON.stringify(allList))
        return updated
      })
    }

    if (savedKkId) {
      // 1. Save Golongan / Desil (Separate Table)
      const golonganItem: GolonganKeluarga = {
        id: golonganMap[savedKkId]?.id || `gol-${Date.now()}`,
        kk_id: savedKkId,
        lingkungan_id: lingkunganId,
        golongan: formGolongan,
        kriteria_catatan: formKriteriaCatatan.trim() || null,
        updated_by_role: 'SEKRETARIS',
        updated_at: new Date().toISOString()
      }

      try {
        await supabase.from('golongan_keluarga').upsert(golonganItem, { onConflict: 'kk_id' })
      } catch (err) {
        console.warn('Golongan table upsert notice:', err)
      }

      setGolonganMap(prev => {
        const next = { ...prev, [savedKkId!]: golonganItem }
        try {
          const rawG = localStorage.getItem('custom_golongan_all_store')
          const store = rawG ? JSON.parse(rawG) : {}
          store[savedKkId!] = golonganItem
          localStorage.setItem('custom_golongan_all_store', JSON.stringify(store))
        } catch (e) {}
        return next
      })

      // 2. Save Anggota Keluarga (Separate Table)
      // Filter out any completely empty member rows
      const validMembers = formAnggotaList
        .filter(m => m.nama.trim().length > 0)
        .map((m, idx) => ({
          id: m.id || `member-${Date.now()}-${idx}`,
          kk_id: savedKkId!,
          nama: m.nama.trim(),
          peran: m.peran,
          is_kaj: m.is_kaj,
          keterangan: m.keterangan ? m.keterangan.trim() : null
        }))

      // If user left members blank, at least add the KK name
      if (validMembers.length === 0) {
        validMembers.push({
          id: `member-${Date.now()}-0`,
          kk_id: savedKkId,
          nama: formNama.trim(),
          peran: 'Kepala Keluarga',
          is_kaj: formIsBiduk,
          keterangan: 'Kepala Keluarga'
        })
      }

      try {
        await supabase.from('anggota_keluarga').delete().eq('kk_id', savedKkId)
        await supabase.from('anggota_keluarga').insert(validMembers)
      } catch (err) {
        console.warn('Anggota table insert notice:', err)
      }

      setAnggotaMap(prev => {
        const next = { ...prev, [savedKkId!]: validMembers }
        try {
          const rawA = localStorage.getItem('custom_anggota_all_store')
          const store = rawA ? JSON.parse(rawA) : {}
          store[savedKkId!] = validMembers
          localStorage.setItem('custom_anggota_all_store', JSON.stringify(store))
        } catch (e) {}
        return next
      })
    }

    setIsModalOpen(false)
    setSubmitting(false)
  }

  const handleDelete = async (id: string, nama: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus data Kepala Keluarga "${nama}" beserta seluruh anggota keluarga & data golongannya?`)) return

    try {
      await supabase.from('anggota_keluarga').delete().eq('kk_id', id)
      await supabase.from('golongan_keluarga').delete().eq('kk_id', id)
      await supabase.from('kepala_keluarga').delete().eq('id', id)
    } catch (err) {
      console.warn('Supabase delete error:', err)
    }

    setKkList(prev => {
      const updated = prev.filter(k => k.id !== id)
      if (lingkunganId) {
        localStorage.setItem(`custom_kks_${lingkunganId}`, JSON.stringify(updated))
      }
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

  // Filtered List Logic
  const filteredKkList = kkList.filter(k => {
    const members = anggotaMap[k.id] || []
    const golonganObj = golonganMap[k.id]
    const golongan = golonganObj?.golongan || 'MENENGAH'

    // Text search (KK name, address, or member name)
    const matchesSearch =
      k.nama_kk.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (k.alamat && k.alamat.toLowerCase().includes(searchQuery.toLowerCase())) ||
      members.some(m => m.nama.toLowerCase().includes(searchQuery.toLowerCase()))

    // Golongan filter
    const matchesGolongan = filterGolongan === 'ALL' || golongan === filterGolongan

    // KAJ filter
    const matchesKaj =
      filterKaj === 'ALL' ||
      (filterKaj === 'BIDUK' && k.is_biduk) ||
      (filterKaj === 'NON_BIDUK' && !k.is_biduk)

    return matchesSearch && matchesGolongan && matchesKaj
  })

  // Statistics
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
            title={note || 'Golongan Bawah / Pra-sejahtera / Butuh Subsidi'}
            className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full text-xs font-bold"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Miskin (Bawah)
          </span>
        )
      case 'ATAS':
        return (
          <span
            title={note || 'Golongan Atas / Mapan / Donatur Potensial'}
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
            title={note || 'Golongan Menengah / Mandiri'}
            className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full text-xs font-bold"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Menengah
          </span>
        )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
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
              DAFU (Daftar Seluruh Umat & Keluarga)
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">
              Sistem Desil & KAJ
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Basis data seluruh umat, rincian keluarga, & klasifikasi desil lingkungan{' '}
            <span className="text-emerald-700 font-semibold">{formatNamaLingkungan(lingkunganName)}</span>.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Lingkungan Quick Switcher (Paroki only) or Locked Scope (Sekretaris & Bendahara) */}
          <div className="w-full sm:w-64">
            {userRole === 'PAROKI' ? (
              <Select value={lingkunganId || ''} onValueChange={(val) => val && handleLingkunganChange(val)}>
                <SelectTrigger className="bg-white border-slate-300 text-slate-900 rounded-xl focus:ring-emerald-500 font-semibold h-11">
                  <Building className="w-4 h-4 text-emerald-600 mr-2 shrink-0" />
                  <SelectValue placeholder="— Pilih Lingkungan —">
                    {lingkunganName ? formatNamaLingkungan(lingkunganName) : '— Pilih Lingkungan —'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto bg-white border-slate-200 text-slate-900">
                  {lingkunganList.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {formatNamaLingkungan(l.nama_lingkungan)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="bg-slate-100/90 border border-slate-300 text-slate-800 rounded-xl px-3 py-2 flex items-center gap-2 font-bold text-xs h-11 shrink-0 shadow-2xs">
                <Building className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">{lingkunganName ? formatNamaLingkungan(lingkunganName) : 'Lingkungan Anda'}</span>
                <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono ml-auto shrink-0 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Terkunci
                </span>
              </div>
            )}
          </div>

          {canEdit ? (
            <Button
              onClick={openAddModal}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs cursor-pointer h-11 shrink-0"
            >
              <Plus className="w-4 h-4 mr-2 text-emerald-400" />
              Tambah Kepala Keluarga
            </Button>
          ) : userRole === 'BENDAHARA' ? (
            <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2 rounded-xl flex items-center gap-1.5 font-bold shadow-xs shrink-0">
              <Lock className="w-4 h-4 text-amber-600" /> Read-Only (Hak Akses Bendahara)
            </span>
          ) : (
            <span className="text-xs bg-purple-50 text-purple-800 border border-purple-200 px-3 py-2 rounded-xl flex items-center gap-1.5 font-bold shadow-xs shrink-0">
              <Lock className="w-4 h-4 text-purple-600" /> Read-Only (Pengawas Paroki)
            </span>
          )}
        </div>
      </div>

      {/* Role Notice Banner */}
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
            Peran Anda: <b className="text-slate-900">{userRole}</b>
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

                  const isKetua = (ketuaId && kk.id === ketuaId) || (ketuaNama && kk.nama_kk.toLowerCase().trim() === ketuaNama.toLowerCase().trim())
                  const isSekretaris = (sekretarisId && kk.id === sekretarisId) || (sekretarisNama && kk.nama_kk.toLowerCase().trim() === sekretarisNama.toLowerCase().trim())
                  const isBendahara = (bendaharaId && kk.id === bendaharaId) || (bendaharaNama && kk.nama_kk.toLowerCase().trim() === bendaharaNama.toLowerCase().trim())

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

                        {/* Name + Badges + Address */}
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900">{kk.nama_kk}</span>
                              {isKetua && (
                                <span className="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-md">
                                  Ketua Lingkungan
                                </span>
                              )}
                              {isSekretaris && (
                                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                                  Sekretaris
                                </span>
                              )}
                              {isBendahara && (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                  Bendahara
                                </span>
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingKk(kk)}
                            className="h-8 px-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer text-xs"
                            title="Lihat Detail Lengkap"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Detail
                          </Button>

                          {canEdit && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditModal(kk)}
                                className="h-8 w-8 p-0 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                                title="Edit KK & Anggota"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(kk.id, kk.nama_kk)}
                                className="h-8 w-8 p-0 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg cursor-pointer"
                                title="Hapus KK"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
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
                                {canEdit && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEditModal(kk)}
                                    className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer"
                                  >
                                    <Pencil className="w-3 h-3 mr-1" /> Edit Anggota
                                  </Button>
                                )}
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

      {/* MODAL 1: ADD / EDIT KK, GOLONGAN, & BOX ANGGOTA (KHUSUS SEKRETARIS) */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white border-slate-200 text-slate-900 rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-slate-800 font-bold text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              {editingKk ? 'Edit Data Kepala Keluarga & Anggota Umat' : 'Tambah Kepala Keluarga Baru'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 py-2">
            {/* Bagian 1: Data Kepala Keluarga */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-emerald-600" />
                1. Data Kepala Keluarga (Master)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="nama_kk" className="text-xs font-semibold text-slate-700">Nama Kepala Keluarga *</Label>
                  <Input
                    id="nama_kk"
                    value={formNama}
                    onChange={(e) => setFormNama(e.target.value)}
                    placeholder="Contoh: Petrus Sugeng"
                    required
                    className="bg-white border-slate-300 text-slate-900 rounded-xl focus:ring-emerald-500 h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="alamat" className="text-xs font-semibold text-slate-700">Alamat / Blok Rumah</Label>
                  <Input
                    id="alamat"
                    value={formAlamat}
                    onChange={(e) => setFormAlamat(e.target.value)}
                    placeholder="Contoh: Jl. Kasih No. 12"
                    className="bg-white border-slate-300 text-slate-900 rounded-xl focus:ring-emerald-500 h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="is_biduk" className="text-xs font-semibold text-slate-700">Status Terdaftar BIDUK KAJ</Label>
                  <Select value={formIsBiduk ? 'YA' : 'TIDAK'} onValueChange={(val) => setFormIsBiduk(val === 'YA')}>
                    <SelectTrigger id="is_biduk" className="bg-white border-slate-300 text-slate-900 rounded-xl focus:ring-emerald-500 h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 text-slate-900">
                      <SelectItem value="YA">Ya, Terdaftar di BIDUK KAJ</SelectItem>
                      <SelectItem value="TIDAK">Tidak / Belum Terdaftar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Bagian 2: Klasifikasi Golongan / Desil (Tabel Terpisah) */}
            <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-200/80 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  2. Klasifikasi Golongan / Desil (Ditentukan Sekretaris)
                </div>
                <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-semibold">
                  Database Terpisah
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="golongan" className="text-xs font-semibold text-slate-700">Pilih Golongan Keluarga *</Label>
                  <Select value={formGolongan} onValueChange={(val) => setFormGolongan(val as KategoriGolongan)}>
                    <SelectTrigger id="golongan" className="bg-white border-slate-300 text-slate-900 rounded-xl focus:ring-emerald-500 h-10 font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 text-slate-900">
                      <SelectItem value="MISKIN">🔴 Miskin (Bawah / Butuh Bantuan Subsidi)</SelectItem>
                      <SelectItem value="MENENGAH">🟡 Menengah (Standar / Mandiri)</SelectItem>
                      <SelectItem value="ATAS">🟢 Mampu (Atas / Potensial Donatur)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="kriteria" className="text-xs font-semibold text-slate-700">Catatan Kriteria / Alasan Golongan</Label>
                  <Input
                    id="kriteria"
                    value={formKriteriaCatatan}
                    onChange={(e) => setFormKriteriaCatatan(e.target.value)}
                    placeholder="Contoh: Pekerja harian, lansia / Karyawan swasta tetap"
                    className="bg-white border-slate-300 text-slate-900 rounded-xl focus:ring-emerald-500 h-10"
                  />
                </div>
              </div>
            </div>

            {/* Bagian 3: Box Tambah Umat / Anggota Keluarga (Dinamis) */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                    3. Anggota Keluarga (Input Semua Umat di Rumah)
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tambahkan seluruh jiwa yang tinggal (Suami, Istri, Anak, Orang Tua, dll.) baik yang ber-KAJ maupun belum.
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={handleAddMemberRow}
                  variant="outline"
                  size="sm"
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-xl font-bold cursor-pointer text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Tambah Anggota
                </Button>
              </div>

              {/* Dynamic Rows */}
              <div className="space-y-3">
                {formAnggotaList.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center bg-white rounded-xl border border-dashed border-slate-300">
                    Belum ada anggota keluarga. Klik &ldquo;Tambah Anggota&rdquo; di atas.
                  </p>
                ) : (
                  formAnggotaList.map((item, index) => (
                    <div
                      key={index}
                      className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">
                          Anggota #{index + 1}
                        </span>
                        {formAnggotaList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMemberRow(index)}
                            className="text-rose-500 hover:text-rose-700 text-xs flex items-center gap-1 cursor-pointer font-medium"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Hapus
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                        {/* Nama Anggota */}
                        <div className="sm:col-span-5">
                          <Label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                            Nama Anggota Umat *
                          </Label>
                          <Input
                            placeholder="Contoh: Maria Francisca"
                            value={item.nama}
                            onChange={(e) => handleUpdateMemberRow(index, 'nama', e.target.value)}
                            required
                            className="bg-white border-slate-300 text-slate-900 rounded-lg text-xs h-9 focus:ring-emerald-500"
                          />
                        </div>

                        {/* Peran dalam Keluarga */}
                        <div className="sm:col-span-4">
                          <Label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                            Peran Keluarga *
                          </Label>
                          <Select
                            value={item.peran}
                            onValueChange={(val) => handleUpdateMemberRow(index, 'peran', val)}
                          >
                            <SelectTrigger className="bg-white border-slate-300 text-slate-900 rounded-lg text-xs h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-slate-200 text-slate-900">
                              {ROLE_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Status KAJ */}
                        <div className="sm:col-span-3">
                          <Label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                            Status KAJ *
                          </Label>
                          <Select
                            value={item.is_kaj ? 'YA' : 'TIDAK'}
                            onValueChange={(val) => handleUpdateMemberRow(index, 'is_kaj', val === 'YA')}
                          >
                            <SelectTrigger className="bg-white border-slate-300 text-slate-900 rounded-lg text-xs h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-slate-200 text-slate-900">
                              <SelectItem value="YA">Terdaftar KAJ</SelectItem>
                              <SelectItem value="TIDAK">Non-KAJ</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl cursor-pointer"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Data Lengkap'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: DETAIL VIEW (READ-ONLY FOR ALL ROLES) */}
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
                {/* KK General Info */}
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

                {/* Anggota List */}
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
                {canEdit && (
                  <Button
                    type="button"
                    onClick={() => {
                      const target = viewingKk
                      setViewingKk(null)
                      openEditModal(target)
                    }}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl cursor-pointer"
                  >
                    Edit Data Ini
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
