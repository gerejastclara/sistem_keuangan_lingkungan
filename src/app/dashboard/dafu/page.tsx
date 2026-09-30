'use client'

import React, { useState, useEffect, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import {
  UserRole,
  UserProfile,
  KepalaKeluarga,
  AnggotaKeluarga,
  GolonganKeluarga,
  KategoriGolongan,
  PeranKeluarga,
  Lingkungan
} from '@/lib/types'
import { MASTER_LINGKUNGAN_LIST, formatNamaLingkungan, getAllMasterLingkungan, findLingkunganByQuery, getWilayahForLingkungan } from '@/lib/constants'
import {
  ensureDummyKksForLingkungan,
  getDummyAnggotaForKk,
  getDummyGolonganForKk
} from '@/lib/dummyData'
import { getPengurusForLingkungan, PengurusLingkungan } from '@/lib/pengurusData'
import { getKriteriaGolonganList, KriteriaGolonganItem } from '@/lib/kriteriaGolonganData'
import { SearchableMemberSelect } from '@/components/ui/SearchableMemberSelect'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Plus,
  Trash2,
  Users,
  CheckCircle2,
  XCircle,
  Lock,
  Building,
  Sparkles,
  UserPlus,
  ArrowLeft,
  LayoutDashboard,
  Save,
  RotateCcw,
  Pencil,
  AlertCircle,
  Search,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Wallet,
  UserCheck
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

function parseIndikatorPoints(text: string): string[] {
  if (!text) return []
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length > 1) {
    return lines.map((l) => l.replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean)
  }

  if (text.includes('•')) {
    const parts = text.split('•').map((s) => s.trim()).filter(Boolean)
    if (parts.length > 1) return parts
  }

  if (text.includes('(1)') && text.includes('(2)')) {
    const parts = text.split(/(?=\(\d+\))/g).map((s) => s.trim()).filter(Boolean)
    return parts
  }

  return [text]
}

function renderFormattedText(rawText: string) {
  const parts = rawText.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-bold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function DafuFormContent() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const editParamId = searchParams.get('edit')

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [lingkunganId, setLingkunganId] = useState<string | null>(null)
  const [lingkunganName, setLingkunganName] = useState<string>('')

  // Families state for listing & editing
  const [kkList, setKkList] = useState<KepalaKeluarga[]>([])
  const [anggotaMap, setAnggotaMap] = useState<Record<string, AnggotaKeluarga[]>>({})
  const [golonganMap, setGolonganMap] = useState<Record<string, GolonganKeluarga>>({})

  // Form State (Direct on-page, NOT a popup modal!)
  const [editingKk, setEditingKk] = useState<KepalaKeluarga | null>(null)
  const [formNama, setFormNama] = useState('')
  const [formAlamat, setFormAlamat] = useState('')
  const [formIsBiduk, setFormIsBiduk] = useState<boolean>(true)
  const [formGolongan, setFormGolongan] = useState<KategoriGolongan>('Sejahtera')
  const [formKriteriaCatatan, setFormKriteriaCatatan] = useState('')
  const [formAnggotaList, setFormAnggotaList] = useState<MemberFormItem[]>([
    {
      nama: '',
      peran: 'Kepala Keluarga',
      is_kaj: true,
      keterangan: 'Kepala Keluarga'
    }
  ])
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterGolongan, setFilterGolongan] = useState<'ALL' | KategoriGolongan>('ALL')
  const [expandedKkIds, setExpandedKkIds] = useState<Set<string>>(new Set())

  // Edit Pengurus Modal State (Khusus Sekretaris)
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
  const [kriteriaList, setKriteriaList] = useState<KriteriaGolonganItem[]>(() => getKriteriaGolonganList())
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)

  // Sinkronisasi data kriteria golongan secara real-time dari modul kriteria
  useEffect(() => {
    const handleUpdate = () => {
      setKriteriaList(getKriteriaGolonganList())
    }
    window.addEventListener('kriteriaGolonganChanged', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('kriteriaGolonganChanged', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

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
          telepon: (kk as any).telepon || undefined,
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
            telepon: (kk as any).telepon || undefined,
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
    const targetId = lingkunganId || 'default'
    const pInfo = getPengurusForLingkungan(targetId, lingkunganName)
    const isDefaultUnset = pInfo.ketua_nama === 'Susunan pengurus belum ditentukan'

    setPengurusForm({
      ketuaNama: isDefaultUnset ? '' : (pInfo.ketua_nama || ''),
      teleponKetua: pInfo.ketua_kontak === '-' ? '' : (pInfo.ketua_kontak || ''),
      bendaharaNama: isDefaultUnset ? '' : (pInfo.bendahara_nama || ''),
      teleponBendahara: pInfo.bendahara_kontak === '-' ? '' : (pInfo.bendahara_kontak || ''),
      sekretarisNama: isDefaultUnset ? '' : (pInfo.sekretaris_nama || ''),
      teleponSekretaris: pInfo.sekretaris_kontak === '-' ? '' : (pInfo.sekretaris_kontak || ''),
      periodeMasaBakti: pInfo.periode === 'Belum ditentukan' ? '2024 - 2026' : (pInfo.periode || '2024 - 2026'),
      status: pInfo.status === 'Belum Ditentukan' ? 'Aktif' : (pInfo.status || 'Aktif')
    })
    setIsEditPengurusOpen(true)
  }

  const handleSavePengurus = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingPengurus(true)

    const targetId = lingkunganId || 'default'

    try {
      const existing = localStorage.getItem(`profil_manual_${targetId}`)
      const obj = existing ? JSON.parse(existing) : {}
      const updated = {
        ...obj,
        ketuaNama: pengurusForm.ketuaNama.trim() || 'Susunan pengurus belum ditentukan',
        teleponKetua: pengurusForm.teleponKetua.trim() || '-',
        bendaharaNama: pengurusForm.bendaharaNama.trim() || 'Susunan pengurus belum ditentukan',
        teleponBendahara: pengurusForm.teleponBendahara.trim() || '-',
        sekretarisNama: pengurusForm.sekretarisNama.trim() || 'Susunan pengurus belum ditentukan',
        teleponSekretaris: pengurusForm.teleponSekretaris.trim() || '-',
        periodeMasaBakti: pengurusForm.periodeMasaBakti.trim() || '2024 - 2026',
        status: pengurusForm.status || 'Aktif'
      }
      localStorage.setItem(`profil_manual_${targetId}`, JSON.stringify(updated))

      if (lingkunganName) {
        const cleanN = lingkunganName.replace(/^lingkungan\s+/i, '').trim()
        if (cleanN) {
          localStorage.setItem(`profil_manual_${cleanN}`, JSON.stringify(updated))
          localStorage.setItem(`profil_manual_${cleanN.toLowerCase().replace(/\s+/g, '')}`, JSON.stringify(updated))
          localStorage.setItem(`profil_manual_${cleanN.toLowerCase().replace(/[^a-z0-9]/g, '')}`, JSON.stringify(updated))
        }
      }

      window.dispatchEvent(new CustomEvent('pengurusUpdated', { detail: { targetId, updated } }))
      window.dispatchEvent(new Event('storage'))
      window.dispatchEvent(new Event('lingkunganChanged'))
      window.dispatchEvent(new Event('dafuDataUpdated'))
    } catch (err) {}

    try {
      await supabase.from('profil_lingkungan').upsert({
        lingkungan_id: targetId,
        telepon_bendahara: pengurusForm.teleponBendahara.trim(),
        periode_masa_bakti: pengurusForm.periodeMasaBakti.trim(),
      }, { onConflict: 'lingkungan_id' })
    } catch (err) {}

    setSavingPengurus(false)
    setIsEditPengurusOpen(false)
    setPengurusSuccessMsg('Susunan pengurus lingkungan berhasil diperbarui!')
    setTimeout(() => setPengurusSuccessMsg(null), 4000)
  }

  const filteredKkList = kkList.filter(k => {
    if (!k || k.id.startsWith('dummy-') || k.id.includes('dummy')) return false
    const q = searchQuery.toLowerCase().trim()
    const matchesSearch = !q || (
      k.nama_kk.toLowerCase().includes(q) ||
      (k.alamat && k.alamat.toLowerCase().includes(q))
    )
    const gol = golonganMap[k.id]?.golongan || 'Sejahtera'
    const matchesGolongan =
      filterGolongan === 'ALL' ||
      gol === filterGolongan ||
      (filterGolongan === 'Terduga Prasejahtera' && (gol === 'Terduga Prasejahtera' || gol === 'Terduga Pra Sejahtera')) ||
      (filterGolongan === 'Terduga Pra Sejahtera' && (gol === 'Terduga Prasejahtera' || gol === 'Terduga Pra Sejahtera'))

    return matchesSearch && matchesGolongan
  })

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

          const demoEmail = getCookieVal('demo_user_email') || ''
          const demoRole = getCookieVal('demo_user_role') || ''

          if (demoRole === 'BENDAHARA' || demoEmail.includes('bendahara')) currentRole = 'BENDAHARA'
          else if (demoRole === 'PAROKI' || demoEmail.includes('paroki')) currentRole = 'PAROKI'
          else currentRole = 'SEKRETARIS'

          currentLingkunganId = getCookieVal('demo_user_lingkungan_id')
          currentLingkunganNama = getCookieVal('demo_user_lingkungan_nama')

          setUserProfile({
            id: 'demo-user',
            username: demoEmail || currentRole.toLowerCase(),
            email: demoEmail || `${currentRole.toLowerCase()}@example.com`,
            role: currentRole,
            lingkungan_id: currentRole === 'PAROKI' ? null : currentLingkunganId,
            lingkungan_nama: currentRole === 'PAROKI' ? undefined : (currentLingkunganNama || undefined),
          })
        }

        let rawDemoEmail = typeof document !== 'undefined' ? (`; ${document.cookie}`).split('; demo_user_email=').pop()?.split(';').shift() || '' : ''
        try {
          rawDemoEmail = decodeURIComponent(rawDemoEmail)
        } catch (e) {}
        const effectiveEmail = user?.email || rawDemoEmail || ''
        
        // Strictly match Lingkungan from user email if non-PAROKI
        if (currentRole !== 'PAROKI' && effectiveEmail) {
          const matchedByEmail = findLingkunganByQuery(effectiveEmail)
          if (matchedByEmail) {
            currentLingkunganId = matchedByEmail.id
            currentLingkunganNama = matchedByEmail.nama_lingkungan
          }
        }

        // Target Lingkungan
        if (currentRole === 'BENDAHARA') {
          router.replace('/dashboard')
          return
        }

        let targetLingkunganId: string | null = null
        if (currentRole !== 'PAROKI' && currentLingkunganId) {
          targetLingkunganId = currentLingkunganId
          if (typeof window !== 'undefined') {
            localStorage.setItem('selected_lingkungan_id', currentLingkunganId)
          }
        } else {
          targetLingkunganId = localStorage.getItem('selected_lingkungan_id')
          if (!targetLingkunganId) {
            const allM = getAllMasterLingkungan()
            targetLingkunganId = allM[0].id
          }
        }

        const allM = getAllMasterLingkungan()
        const matched = allM.find(l => l.id === targetLingkunganId)
        const lName = matched?.nama_lingkungan || currentLingkunganNama || 'Lingkungan'
        setLingkunganName(lName)
        setLingkunganId(targetLingkunganId)

        if (targetLingkunganId) {
          await loadKks(targetLingkunganId, lName)
        }
      } catch (err) {
        console.error('Error loading dafu form page:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [supabase])

  const loadKks = async (targetLingkunganId: string, lName: string) => {
    const { data: kks } = await supabase
      .from('kepala_keluarga')
      .select('*')
      .eq('lingkungan_id', targetLingkunganId)
      .order('nama_kk', { ascending: true })

    // Purge any legacy dummy entries from localStorage
    if (typeof window !== 'undefined') {
      try {
        const keysToClean = ['custom_kks_all_store', 'custom_anggota_all_store', 'custom_golongan_all_store']
        keysToClean.forEach(k => {
          const raw = localStorage.getItem(k)
          if (raw && (raw.includes('dummy-') || raw.includes('Anastasia Gunawan') || raw.includes('Petrus Sugeng'))) {
            localStorage.removeItem(k)
          }
        })
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (k && (k.startsWith('custom_kks_') || k.startsWith('custom_anggota_') || k.startsWith('custom_golongan_'))) {
            const val = localStorage.getItem(k)
            if (val && (val.includes('dummy-') || val.includes('Anastasia Gunawan') || val.includes('Petrus Sugeng'))) {
              localStorage.removeItem(k)
            }
          }
        }
      } catch (e) {}
    }

    let dbKks = (kks || []).filter(k => k && !k.id.startsWith('dummy-') && !k.id.includes('dummy'))
    const localSaved = localStorage.getItem(`custom_kks_${targetLingkunganId}`)
    if (localSaved) {
      try {
        const parsed: KepalaKeluarga[] = JSON.parse(localSaved)
        const combinedMap = new Map<string, KepalaKeluarga>()
        dbKks.forEach(k => combinedMap.set(k.id, k))
        parsed.filter(k => k && !k.id.startsWith('dummy-') && !k.id.includes('dummy')).forEach(k => combinedMap.set(k.id, k))
        dbKks = Array.from(combinedMap.values())
      } catch (e) {}
    }

    const allSaved = localStorage.getItem('custom_kks_all_store')
    if (allSaved) {
      try {
        const allParsed: KepalaKeluarga[] = JSON.parse(allSaved)
        const matched = allParsed.filter(k => k.lingkungan_id === targetLingkunganId && !k.id.startsWith('dummy-') && !k.id.includes('dummy'))
        const combinedMap = new Map<string, KepalaKeluarga>()
        dbKks.forEach(k => combinedMap.set(k.id, k))
        matched.forEach(k => combinedMap.set(k.id, k))
        dbKks = Array.from(combinedMap.values())
      } catch (e) {}
    }

    const finalKks = ensureDummyKksForLingkungan(targetLingkunganId, lName, dbKks)
    setKkList(finalKks)

    // Load Anggota & Golongan
    const kkIds = finalKks.map(k => k.id)
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

    finalKks.forEach(kk => {
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

    // Check if editParamId is set
    if (editParamId) {
      const targetKk = finalKks.find(k => k.id === editParamId)
      if (targetKk) {
        populateFormForEdit(targetKk, newAnggotaMap[targetKk.id], newGolonganMap[targetKk.id])
      }
    }
  }

  const populateFormForEdit = (kk: KepalaKeluarga, members?: AnggotaKeluarga[], gol?: GolonganKeluarga) => {
    setEditingKk(kk)
    setFormNama(kk.nama_kk)
    setFormAlamat(kk.alamat || '')
    setFormIsBiduk(kk.is_biduk)
    setFormGolongan(gol?.golongan || 'Sejahtera')
    setFormKriteriaCatatan(gol?.kriteria_catatan || '')

    if (members && members.length > 0) {
      setFormAnggotaList(
        members.map(m => ({
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

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleResetForm = () => {
    setEditingKk(null)
    setFormNama('')
    setFormAlamat('')
    setFormIsBiduk(true)
    setFormGolongan('Sejahtera')
    setFormKriteriaCatatan('')
    setFormAnggotaList([
      {
        nama: '',
        peran: 'Kepala Keluarga',
        is_kaj: true,
        keterangan: 'Kepala Keluarga'
      }
    ])
    setSuccessMessage(null)
    setFormErrorMessage(null)
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
    if (!lingkunganId) return

    if (!formNama.trim()) {
      setFormErrorMessage('Nama Kepala Keluarga wajib diisi!')
      return
    }

    if (!formKriteriaCatatan.trim()) {
      setFormErrorMessage('Catatan Kriteria / Alasan penetapan golongan keluarga wajib diisi sebelum menyimpan data!')
      return
    }

    setFormErrorMessage(null)
    setSubmitting(true)
    setSuccessMessage(null)

    const kkPayload = {
      lingkungan_id: lingkunganId,
      nama_kk: formNama.trim(),
      alamat: formAlamat.trim() || null,
      is_biduk: formIsBiduk,
    }

    let savedKkId = editingKk?.id

    if (editingKk) {
      const { error } = await supabase.from('kepala_keluarga').update(kkPayload).eq('id', editingKk.id)
      if (error) console.warn('Supabase DB info:', error.message)

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
      if (error) console.warn('Supabase DB info:', error.message)

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
      } catch (err) {}

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
      } catch (err) {}

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

      // Notify other tabs and components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dafuDataUpdated'))
        window.dispatchEvent(new Event('storage'))
      }
    }

    setSubmitting(false)
    setSuccessMessage(`Data keluarga "${formNama.trim()}" berhasil disimpan ke sistem!`)
    setEditingKk(null)
    setFormNama('')
    setFormAlamat('')
    setFormIsBiduk(true)
    setFormGolongan('Sejahtera')
    setFormKriteriaCatatan('')
    setFormAnggotaList([
      {
        nama: '',
        peran: 'Kepala Keluarga',
        is_kaj: true,
        keterangan: 'Kepala Keluarga'
      }
    ])
  }

  const handleDelete = async (id: string, nama: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus data Kepala Keluarga "${nama}"?`)) return

    try {
      await supabase.from('anggota_keluarga').delete().eq('kk_id', id)
      await supabase.from('golongan_keluarga').delete().eq('kk_id', id)
      await supabase.from('kepala_keluarga').delete().eq('id', id)
    } catch (err) {}

    setKkList(prev => {
      const updated = prev.filter(k => k.id !== id)
      if (lingkunganId) localStorage.setItem(`custom_kks_${lingkunganId}`, JSON.stringify(updated))
      try {
        const allSaved = localStorage.getItem('custom_kks_all_store')
        if (allSaved) {
          const list = JSON.parse(allSaved).filter((k: any) => k.id !== id)
          localStorage.setItem('custom_kks_all_store', JSON.stringify(list))
        }
      } catch(e) {}
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dafuDataUpdated'))
        window.dispatchEvent(new Event('storage'))
      }
      return updated
    })
  }

  const userRole = userProfile?.role || 'SEKRETARIS'
  const canEdit = userRole === 'SEKRETARIS'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#1B2130] tracking-tight font-serif">
              DAFU - Formulir Input Data Umat & Keluarga
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Locked Lingkungan Indicator */}
          <div className="bg-slate-100/90 border border-slate-300 text-slate-800 rounded-xl px-3.5 py-2 flex items-center gap-2 font-bold text-xs h-11 shrink-0 shadow-2xs">
            <Building className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">{formatNamaLingkungan(lingkunganName)}</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">
              Wilayah {getWilayahForLingkungan(lingkunganName)}
            </span>
            <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono ml-auto shrink-0 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" /> Terkunci
            </span>
          </div>

          {canEdit && (
            <Button
              type="button"
              onClick={handleOpenEditPengurus}
              className="bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl h-11 px-4 cursor-pointer shadow-xs"
              title="Khusus Sekretaris: Tentukan Susunan Ketua, Bendahara, dan Sekretaris Lingkungan"
            >
              <ShieldCheck className="w-4 h-4 mr-1.5" />
              Atur Pengurus
            </Button>
          )}

          <Link href="/dashboard">
            <Button variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold rounded-xl h-11 cursor-pointer">
              <LayoutDashboard className="w-4 h-4 mr-1.5 text-slate-600" />
              Lihat di Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Success Alert Pengurus */}
      {pengurusSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2 text-sm font-bold shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{pengurusSuccessMsg}</span>
        </div>
      )}

      {/* Success Alert Umat */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2 text-sm font-bold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold cursor-pointer">
                Buka Dashboard
              </Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={() => setSuccessMessage(null)} className="text-xs text-slate-500">
              Tutup
            </Button>
          </div>
        </div>
      )}

      {/* Editing State Banner */}
      {editingKk && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between text-xs font-bold shadow-2xs">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-amber-700" />
            <span>Mode Edit: Sedang mengubah data keluarga &ldquo;{editingKk.nama_kk}&rdquo;</span>
          </div>
          <Button size="sm" variant="outline" onClick={handleResetForm} className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100 rounded-md">
            Batalkan Edit (Input Baru)
          </Button>
        </div>
      )}

      {/* Error Alert Umat */}
      {formErrorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2 text-sm font-bold">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{formErrorMessage}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setFormErrorMessage(null)}
            className="text-xs text-rose-600 hover:bg-rose-100/60 rounded-lg cursor-pointer"
          >
            Tutup
          </Button>
        </div>
      )}

      {/* FORMULIR INPUT LANGSUNG DI MODUL (GAMBAR 2 - BUKAN POPUP!) */}
      <Card className="bg-white border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <CardHeader className="bg-slate-50/70 border-b border-slate-100 p-5">
          <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2 font-serif">
            <Users className="w-5 h-5 text-emerald-600" />
            {editingKk ? 'Edit Data Kepala Keluarga & Anggota Umat' : 'Tambah Kepala Keluarga Baru'}
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Pastikan seluruh anggota keluarga yang tinggal di rumah didaftarkan lengkap beserta perannya
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Bagian 1: Data Kepala Keluarga */}
            <div className="bg-slate-50/70 p-5 rounded-xl border border-slate-200 space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 font-serif">
                <Building className="w-4 h-4 text-emerald-600" />
                1. DATA KEPALA KELUARGA (MASTER)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="nama_kk" className="text-xs font-semibold text-slate-700">Nama Kepala Keluarga *</Label>
                  <Input
                    id="nama_kk"
                    value={formNama}
                    onChange={(e) => setFormNama(e.target.value)}
                    placeholder="Contoh: Petrus Sugeng"
                    required
                    className="bg-white border-slate-300 text-slate-900 rounded-xl focus:ring-emerald-500 h-11 text-sm font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="alamat" className="text-xs font-semibold text-slate-700">Alamat / Blok Rumah</Label>
                  <Input
                    id="alamat"
                    value={formAlamat}
                    onChange={(e) => setFormAlamat(e.target.value)}
                    placeholder="Contoh: Jl. Kasih No. 12"
                    className="bg-white border-slate-300 text-slate-900 rounded-xl focus:ring-emerald-500 h-11 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="is_biduk" className="text-xs font-semibold text-slate-700">Status Terdaftar BIDUK KAJ</Label>
                  <Select value={formIsBiduk ? 'YA' : 'TIDAK'} onValueChange={(val) => setFormIsBiduk(val === 'YA')}>
                    <SelectTrigger id="is_biduk" className="bg-white border-slate-300 text-slate-900 rounded-xl focus:ring-emerald-500 h-11 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 text-slate-900">
                      <SelectItem value="YA">YA (Terdaftar di BIDUK KAJ)</SelectItem>
                      <SelectItem value="TIDAK">TIDAK (Belum Terdaftar)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Bagian 2: Klasifikasi Golongan / Desil */}
            <div className="bg-slate-50/70 p-5 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 font-serif">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  2. KLASIFIKASI GOLONGAN (DITENTUKAN SEKRETARIS)
                </div>
                <Link
                  href="/dashboard/kriteria-golongan"
                  className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold underline underline-offset-2 flex items-center gap-1"
                >
                  {userProfile?.role === 'PAROKI' ? 'Kelola Parameter Kriteria Golongan →' : 'Lihat Parameter Kriteria Golongan →'}
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="golongan" className="text-xs font-semibold text-slate-700">Pilih Golongan Keluarga *</Label>
                  <Select value={formGolongan} onValueChange={(val) => setFormGolongan(val as KategoriGolongan)}>
                    <SelectTrigger id="golongan" className="bg-white border-slate-300 text-slate-900 rounded-xl focus:ring-emerald-500 h-11 font-bold text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 text-slate-900 min-w-[340px] sm:min-w-[440px] shadow-lg rounded-xl p-1.5 z-50">
                      {kriteriaList.map((item) => (
                        <SelectItem key={item.id} value={item.nama} className="cursor-pointer py-2.5 px-3 rounded-lg">
                          <div className="flex items-center gap-2.5">
                            <span className="text-base leading-none">{item.iconEmoji || '🏷️'}</span>
                            <span className="font-bold text-slate-900">{item.nama}</span>
                            <span className="text-xs text-slate-500 font-normal">
                              ({item.subjudul})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="kriteria" className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Catatan Kriteria / Alasan Golongan <span className="text-rose-500 font-bold">* (Wajib Diisi)</span></span>
                  </Label>
                  <Input
                    id="kriteria"
                    value={formKriteriaCatatan}
                    onChange={(e) => {
                      setFormKriteriaCatatan(e.target.value)
                      if (formErrorMessage) setFormErrorMessage(null)
                    }}
                    placeholder="Contoh: Pekerja harian, lansia / Karyawan swasta tetap"
                    required
                    className={`bg-white text-slate-900 rounded-xl focus:ring-emerald-500 h-11 text-sm ${
                      !formKriteriaCatatan.trim() ? 'border-amber-300 focus:border-rose-500' : 'border-slate-300'
                    }`}
                  />
                </div>
              </div>

              {/* Panduan Indikator Kriteria Terpilih (Per Poin Inti) */}
              {(() => {
                const activeKriteria = kriteriaList.find((k) => k.nama === formGolongan)
                if (!activeKriteria) return null
                const points = parseIndikatorPoints(activeKriteria.indikator)
                return (
                  <div
                    className="p-4 rounded-2xl border text-xs space-y-3 transition-all shadow-xs"
                    style={{
                      backgroundColor: activeKriteria.bgLight || '#f8fafc',
                      borderColor: activeKriteria.borderLight || '#e2e8f0',
                    }}
                  >
                    <div
                      className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b"
                      style={{ borderColor: activeKriteria.borderLight || '#e2e8f0' }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl leading-none">{activeKriteria.iconEmoji}</span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-slate-900 font-serif">
                            Panduan Kriteria: {activeKriteria.nama}
                          </span>
                          <span
                            className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/90 border shadow-2xs"
                            style={{
                              color: activeKriteria.textColor || '#475569',
                              borderColor: activeKriteria.borderLight || '#e2e8f0',
                            }}
                          >
                            {activeKriteria.subjudul}
                          </span>
                        </div>
                      </div>

                      {activeKriteria.garisPengeluaran && (
                        <span className="text-[11px] font-bold text-slate-700 bg-white/95 px-3 py-1 rounded-xl border border-slate-200 shadow-2xs">
                          {activeKriteria.garisPengeluaran}
                        </span>
                      )}
                    </div>

                    {/* Poin-Poin Inti Indikator */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-serif">
                        Poin Indikator Penilaian:
                      </span>
                      <ul className="space-y-2 bg-white/95 p-3 rounded-xl border border-slate-200/80">
                        {points.map((pt, pIdx) => (
                          <li key={pIdx} className="flex items-start gap-2.5 leading-relaxed">
                            <span
                              className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                              style={{ backgroundColor: activeKriteria.badgeColor || '#16a34a' }}
                            />
                            <span className="text-[11.5px] text-slate-700 leading-snug">
                              {renderFormattedText(pt)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {activeKriteria.contohKondisi && (
                      <div className="text-[11px] text-slate-600 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/70 flex items-start gap-1.5">
                        <span className="font-bold text-slate-800 shrink-0">Contoh Kasus:</span>
                        <span className="italic">&ldquo;{activeKriteria.contohKondisi}&rdquo;</span>
                      </div>
                    )}

                    {activeKriteria.rekomendasiBantuan && (
                      <div
                        className="pt-2 border-t flex items-start gap-1.5 text-[11px] text-slate-600"
                        style={{ borderColor: activeKriteria.borderLight || '#e2e8f0' }}
                      >
                        <span className="font-bold text-slate-800 shrink-0">Rekomendasi Kebijakan:</span>
                        <span>{activeKriteria.rekomendasiBantuan}</span>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Bagian 3: Anggota Keluarga */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 font-serif">
                    <UserPlus className="w-4 h-4 text-emerald-600" />
                    3. ANGGOTA KELUARGA (INPUT SEMUA UMAT DI RUMAH)
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Tambahkan seluruh jiwa yang tinggal (Suami, Istri, Anak, Orang Tua, dll.) baik yang ber-KAJ maupun belum.
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={handleAddMemberRow}
                  variant="outline"
                  size="sm"
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-xl font-bold cursor-pointer text-xs h-9"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Tambah Anggota
                </Button>
              </div>

              {/* Dynamic Rows */}
              <div className="space-y-3">
                {formAnggotaList.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center bg-white rounded-xl border border-dashed border-slate-300">
                    Belum ada anggota keluarga. Klik &ldquo;Tambah Anggota&rdquo; di atas.
                  </p>
                ) : (
                  formAnggotaList.map((item, index) => (
                    <div
                      key={index}
                      className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3"
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

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
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

            {/* Form Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={handleResetForm}
                className="border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl h-11 px-5 w-full sm:w-auto"
              >
                <RotateCcw className="w-4 h-4 mr-1.5" />
                Reset Form
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl h-11 px-6 shadow-xs cursor-pointer w-full sm:w-auto transition-all"
              >
                <Save className="w-4 h-4 mr-2 text-white" />
                {submitting ? 'Menyimpan...' : 'Simpan Data Lengkap'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* RECENT FAMILIES LIST BELOW THE FORM */}
      <Card className="bg-white border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <CardHeader className="bg-slate-50/70 border-b border-slate-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-bold text-slate-800">
                Daftar Keluarga di {formatNamaLingkungan(lingkunganName)} ({kkList.length} KK)
              </CardTitle>
              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                Wilayah {getWilayahForLingkungan(lingkunganName)}
              </span>
            </div>
            <CardDescription className="text-xs text-slate-400 mt-0.5">
              Data riil umat Paroki Santa Clara. Klik &ldquo;Edit&rdquo; untuk mengubah susunan anggota keluarga
            </CardDescription>
          </div>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="text-xs text-emerald-700 font-bold hover:bg-emerald-50">
              Buka Semua di Dashboard →
            </Button>
          </Link>
        </CardHeader>

        {/* Search Bar & Golongan Filter */}
        <div className="p-3 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama KK atau alamat..."
                className="pl-9 bg-white border-slate-200 text-xs h-9 rounded-xl focus:ring-emerald-500"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={filterGolongan} onValueChange={(val) => setFilterGolongan(val as any)}>
                <SelectTrigger className="bg-white border-slate-200 text-slate-800 rounded-xl text-xs h-9">
                  <SelectValue placeholder="Semua Golongan" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900">
                  <SelectItem value="ALL">Semua Golongan</SelectItem>
                  {kriteriaList.map((item) => (
                    <SelectItem key={item.id} value={item.nama}>
                      <span className="mr-1.5">{item.iconEmoji}</span>
                      {item.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
            Menampilkan <span className="font-bold text-slate-800">{filteredKkList.length}</span> dari {kkList.length} Keluarga
          </div>
        </div>

        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 text-slate-700 font-bold text-xs border-b border-slate-200">
              <TableRow>
                <TableHead className="w-10 text-center"></TableHead>
                <TableHead className="w-12 text-center text-slate-700 font-bold">No</TableHead>
                <TableHead>Nama Kepala Keluarga & Alamat</TableHead>
                <TableHead>Golongan</TableHead>
                <TableHead>Susunan Jiwa</TableHead>
                <TableHead className="text-center">Status KAJ</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 text-xs">
              {filteredKkList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                    {searchQuery ? 'Tidak ada keluarga yang cocok dengan kata kunci pencarian.' : 'Belum ada data keluarga di lingkungan ini.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredKkList.map((kk, idx) => {
                  const members = anggotaMap[kk.id] || []
                  const gol = (golonganMap[kk.id]?.golongan || 'Sejahtera') as KategoriGolongan
                  const isExpanded = expandedKkIds.has(kk.id)

                  return (
                    <React.Fragment key={kk.id}>
                      <TableRow className={`hover:bg-slate-50 transition ${isExpanded ? 'bg-slate-50/60' : ''}`}>
                        {/* Tombol Dropdown Dashboard Style */}
                        <TableCell className="text-center p-2 w-10">
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
                        <TableCell className="text-center font-mono text-slate-500 text-xs w-12">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="cursor-pointer select-none" onClick={() => toggleExpandKk(kk.id)}>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{kk.nama_kk}</span>
                              <span className="text-[10px] font-semibold text-slate-400">
                                ({members.length} Jiwa)
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{kk.alamat || '-'}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="inline-block px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {gol}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-slate-800">{members.length} Jiwa</div>
                          <div className="text-[10px] text-slate-500 mt-0.5 flex flex-wrap gap-1">
                            {members.map(m => m.peran).reduce((acc: string[], role) => {
                              const count = members.filter(m => m.peran === role).length
                              const label = count > 1 ? `${count} ${role}` : role
                              if (!acc.includes(label)) acc.push(label)
                              return acc
                            }, []).slice(0, 3).join(', ')}
                            {members.length > 3 ? '...' : ''}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {kk.is_biduk ? (
                            <span className="text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md">
                              KAJ
                            </span>
                          ) : (
                            <span className="text-xs font-medium bg-slate-50 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-md">
                              Non-KAJ
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => populateFormForEdit(kk, anggotaMap[kk.id], golonganMap[kk.id])}
                            className="h-7 px-2 text-slate-700 hover:text-emerald-700 hover:bg-slate-100 rounded cursor-pointer"
                            title="Edit data keluarga"
                          >
                            <Pencil className="w-3 h-3 mr-1" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(kk.id, kk.nama_kk)}
                            className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                            title="Hapus KK"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>

                      {/* Expandable Dropdown Row Muncul di Bawahnya */}
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
                                  <Button
                                    size="sm"
                                    onClick={() => populateFormForEdit(kk, anggotaMap[kk.id], golonganMap[kk.id])}
                                    className="h-7 text-[11px] bg-slate-700 hover:bg-slate-800 text-white font-medium rounded-lg cursor-pointer inline-flex items-center gap-1 transition-all"
                                  >
                                    <Pencil className="w-3 h-3" />
                                    Edit Anggota
                                  </Button>
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

      {/* Dialog Atur Pengurus Lingkungan Khusus Sekretaris */}
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
    </div>
  )
}

export default function DafuPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    }>
      <DafuFormContent />
    </Suspense>
  )
}
