'use client'

import React, { useState, useEffect, Suspense } from 'react'
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
import { MASTER_LINGKUNGAN_LIST, formatNamaLingkungan, getAllMasterLingkungan, findLingkunganByQuery } from '@/lib/constants'
import {
  ensureDummyKksForLingkungan,
  getDummyAnggotaForKk,
  getDummyGolonganForKk
} from '@/lib/dummyData'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
  AlertCircle
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
  const [formGolongan, setFormGolongan] = useState<KategoriGolongan>('MENENGAH')
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
            email: demoEmail || `${currentRole.toLowerCase()}@example.com`,
            role: currentRole,
            lingkungan_id: currentRole === 'PAROKI' ? null : currentLingkunganId,
            lingkungan_nama: currentRole === 'PAROKI' ? undefined : (currentLingkunganNama || undefined),
          })
        }

        const effectiveEmail = user?.email || (typeof document !== 'undefined' ? (`; ${document.cookie}`).split('; demo_user_email=').pop()?.split(';').shift() : '') || ''
        
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
    setFormGolongan(gol?.golongan || 'MENENGAH')
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
    setFormGolongan('MENENGAH')
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
    setFormGolongan('MENENGAH')
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
          <p className="text-sm text-slate-500 mt-1">
            Input langsung seluruh anggota keluarga, peran, dan klasifikasi desil lingkungan{' '}
            <span className="text-emerald-700 font-semibold">{formatNamaLingkungan(lingkunganName)}</span>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Locked Lingkungan Indicator */}
          <div className="bg-slate-100/90 border border-slate-300 text-slate-800 rounded-xl px-3.5 py-2 flex items-center gap-2 font-bold text-xs h-11 shrink-0 shadow-2xs">
            <Building className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">{formatNamaLingkungan(lingkunganName)}</span>
            <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono ml-auto shrink-0 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" /> Terkunci
            </span>
          </div>

          <Link href="/dashboard">
            <Button variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold rounded-xl h-11 cursor-pointer">
              <LayoutDashboard className="w-4 h-4 mr-1.5 text-slate-600" />
              Lihat di Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Success Alert */}
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
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 font-serif">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  2. KLASIFIKASI GOLONGAN / DESIL (DITENTUKAN SEKRETARIS)
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="golongan" className="text-xs font-semibold text-slate-700">Pilih Golongan Keluarga *</Label>
                  <Select value={formGolongan} onValueChange={(val) => setFormGolongan(val as KategoriGolongan)}>
                    <SelectTrigger id="golongan" className="bg-white border-slate-300 text-slate-900 rounded-xl focus:ring-emerald-500 h-11 font-bold text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 text-slate-900 min-w-[340px] sm:min-w-[440px] shadow-lg rounded-xl p-1.5 z-50">
                      <SelectItem value="MISKIN" className="cursor-pointer py-2.5 px-3 rounded-lg">
                        <div className="flex items-center gap-2.5">
                          <span className="text-base leading-none">🔴</span>
                          <span className="font-bold text-slate-900">MISKIN</span>
                          <span className="text-xs text-slate-500 font-normal">
                            (Bawah / Butuh Bantuan Subsidi)
                          </span>
                        </div>
                      </SelectItem>
                      <SelectItem value="MENENGAH" className="cursor-pointer py-2.5 px-3 rounded-lg">
                        <div className="flex items-center gap-2.5">
                          <span className="text-base leading-none">🟡</span>
                          <span className="font-bold text-slate-900">MENENGAH</span>
                          <span className="text-xs text-slate-500 font-normal">
                            (Standar / Mandiri)
                          </span>
                        </div>
                      </SelectItem>
                      <SelectItem value="ATAS" className="cursor-pointer py-2.5 px-3 rounded-lg">
                        <div className="flex items-center gap-2.5">
                          <span className="text-base leading-none">🟢</span>
                          <span className="font-bold text-slate-900">ATAS</span>
                          <span className="text-xs text-slate-500 font-normal">
                            (Mampu / Potensial Donatur)
                          </span>
                        </div>
                      </SelectItem>
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
                    className="bg-white border-slate-300 text-slate-900 rounded-xl focus:ring-emerald-500 h-11 text-sm"
                  />
                </div>
              </div>
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
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl h-11 px-6 shadow-md cursor-pointer w-full sm:w-auto"
              >
                <Save className="w-4 h-4 mr-2 text-emerald-400" />
                {submitting ? 'Menyimpan...' : 'Simpan Data Lengkap'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* RECENT FAMILIES LIST BELOW THE FORM */}
      <Card className="bg-white border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <CardHeader className="bg-slate-50/70 border-b border-slate-100 p-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-slate-800">
              Daftar Keluarga di {formatNamaLingkungan(lingkunganName)} ({kkList.length} KK)
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Klik &ldquo;Edit&rdquo; untuk memuat data ke formulir di atas
            </CardDescription>
          </div>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="text-xs text-emerald-700 font-bold hover:bg-emerald-50">
              Buka Semua di Dashboard →
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 text-slate-700 font-bold text-xs border-b border-slate-200">
              <TableRow>
                <TableHead className="w-10 text-center">No</TableHead>
                <TableHead>Nama Kepala Keluarga</TableHead>
                <TableHead>Golongan</TableHead>
                <TableHead>Jumlah Jiwa</TableHead>
                <TableHead className="text-center">Status KAJ</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 text-xs">
              {kkList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                    Belum ada data keluarga di lingkungan ini. Silakan input pada formulir di atas.
                  </TableCell>
                </TableRow>
              ) : (
                kkList.map((kk, idx) => {
                  const members = anggotaMap[kk.id] || []
                  const gol = golonganMap[kk.id]?.golongan || 'MENENGAH'

                  return (
                    <TableRow key={kk.id} className="hover:bg-slate-50">
                      <TableCell className="text-center font-mono text-slate-400">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="font-bold text-slate-900">{kk.nama_kk}</div>
                        <div className="text-[11px] text-slate-400">{kk.alamat || '-'}</div>
                      </TableCell>
                      <TableCell>
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200">
                          {gol}
                        </span>
                      </TableCell>
                      <TableCell>{members.length} Jiwa</TableCell>
                      <TableCell className="text-center">
                        {kk.is_biduk ? (
                          <span className="text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md">
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
                          className="h-7 px-2 text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                        >
                          <Pencil className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(kk.id, kk.nama_kk)}
                          className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
