'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { UserProfile, COA } from '@/lib/types'
import { getAllMasterCOA, saveCustomCOA, deleteCustomCOA, syncAllCoaToDatabase, MasterCOAItem, DEFAULT_MASTER_COA_LIST } from '@/lib/masterCoa'
import { formatRupiah } from '@/lib/utils'
import { findLingkunganByQuery } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import {
  CheckCircle2,
  Lock,
  Plus,
  Search,
  BookOpen,
  Receipt,
  Wallet,
  Coins,
  RefreshCw,
  Database,
  Info,
  Pencil,
  Trash2
} from 'lucide-react'

const MONTH_OPTIONS = [
  { value: '1', label: 'Januari' },
  { value: '2', label: 'Februari' },
  { value: '3', label: 'Maret' },
  { value: '4', label: 'April' },
  { value: '5', label: 'Mei' },
  { value: '6', label: 'Juni' },
  { value: '7', label: 'Juli' },
  { value: '8', label: 'Agustus' },
  { value: '9', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' }
]

export default function CoaSaldoPage() {
  const supabase = createClient()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [lingkunganId, setLingkunganId] = useState<string | null>(null)

  // Saldo Awal Form State
  const [profilId, setProfilId] = useState<string | null>(null)
  const [tahunBuku, setTahunBuku] = useState<string>('2026')
  const [bulanSaldo, setBulanSaldo] = useState<string>('')
  const [saldoAwalInput, setSaldoAwalInput] = useState<string>('Rp 0')
  const [saldoAwalNumeric, setSaldoAwalNumeric] = useState<number>(0)
  const [isLocked, setIsLocked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // COA List & Modal State
  const [coaList, setCoaList] = useState<MasterCOAItem[]>([])
  const [searchCoa, setSearchCoa] = useState('')
  const [filterKategori, setFilterKategori] = useState<'ALL' | 'KAS' | 'PENERIMAAN' | 'PENGELUARAN'>('ALL')

  const [isAddCoaOpen, setIsAddCoaOpen] = useState(false)
  const [newCoaCode, setNewCoaCode] = useState('')
  const [newCoaName, setNewCoaName] = useState('')
  const [newCoaType, setNewCoaType] = useState<'DEBIT' | 'KREDIT'>('KREDIT')
  const [newCoaCat, setNewCoaCat] = useState<'KAS' | 'PENERIMAAN' | 'PENGELUARAN'>('PENERIMAAN')
  const [newCoaDesc, setNewCoaDesc] = useState('')
  const [syncingCoa, setSyncingCoa] = useState(false)

  // Edit COA State
  const [isEditCoaOpen, setIsEditCoaOpen] = useState(false)
  const [editingCoaCode, setEditingCoaCode] = useState('')
  const [editingCoaName, setEditingCoaName] = useState('')
  const [editingCoaType, setEditingCoaType] = useState<'DEBIT' | 'KREDIT'>('DEBIT')
  const [editingCoaCat, setEditingCoaCat] = useState<'KAS' | 'PENERIMAAN' | 'PENGELUARAN'>('PENGELUARAN')
  const [editingCoaDesc, setEditingCoaDesc] = useState('')

  // Format currency helper
  const formatCurrencyString = (val: number): string => {
    if (!val || isNaN(val)) return 'Rp 0'
    return 'Rp ' + val.toLocaleString('id-ID')
  }

  const handleSaldoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    const num = parseInt(raw, 10) || 0
    setSaldoAwalNumeric(num)
    setSaldoAwalInput(formatCurrencyString(num))
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const { data } = await supabase.auth.getUser()
        const user = data?.user

        if (user) {
          const { data: uData } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle()
          if (uData) setUserProfile(uData)
        }

        let rawDemoEmail = typeof document !== 'undefined' ? (`; ${document.cookie}`).split('; demo_user_email=').pop()?.split(';').shift() || '' : ''
        try {
          rawDemoEmail = decodeURIComponent(rawDemoEmail)
        } catch (e) {}
        const effectiveEmail = user?.email || rawDemoEmail || ''
        const effectiveRole = (typeof document !== 'undefined' ? (`; ${document.cookie}`).split('; demo_user_role=').pop()?.split(';').shift() : '') || ''

        let targetLingkunganId: string | null = null

        if (effectiveRole !== 'PAROKI' && effectiveEmail) {
          const matched = findLingkunganByQuery(effectiveEmail)
          if (matched) {
            targetLingkunganId = matched.id
          }
        }

        if (!targetLingkunganId) {
          targetLingkunganId = localStorage.getItem('selected_lingkungan_id')
        }
        if (!targetLingkunganId) {
          const { data: lData } = await supabase.from('lingkungan').select('id').limit(1).maybeSingle()
          if (lData) {
            targetLingkunganId = lData.id
          }
        }

        setLingkunganId(targetLingkunganId)

        // Load master COA (Default + Custom localStorage + Supabase)
        const masterList = getAllMasterCOA()
        setCoaList(masterList)

        // Auto-sync COA ke database Supabase agar akun seperti 1200, 1300, 1400 selalu ada di DB
        syncAllCoaToDatabase(supabase).catch(() => {})

        if (targetLingkunganId) {
          // Fetch Profil Lingkungan
          const { data: profil } = await supabase
            .from('profil_lingkungan')
            .select('*')
            .eq('lingkungan_id', targetLingkunganId)
            .maybeSingle()

          if (profil) {
            setProfilId(profil.id)
            const num = Number(profil.saldo_awal || 0)
            setSaldoAwalNumeric(num)
            setSaldoAwalInput(formatCurrencyString(num))
            setTahunBuku(profil.tahun_buku || '2026')
            setBulanSaldo(profil.bulan_saldo ? String(profil.bulan_saldo) : '')
          } else {
            // Check localStorage fallback for profil
            const savedProfil = localStorage.getItem(`profil_manual_${targetLingkunganId}`)
            if (savedProfil) {
              try {
                const parsed = JSON.parse(savedProfil)
                if (parsed.saldoAwal !== undefined) {
                  const num = Number(parsed.saldoAwal || 0)
                  setSaldoAwalNumeric(num)
                  setSaldoAwalInput(formatCurrencyString(num))
                }
                if (parsed.bulanSaldo) setBulanSaldo(String(parsed.bulanSaldo))
                if (parsed.tahunBuku) setTahunBuku(parsed.tahunBuku)
              } catch (e) {}
            }
          }

          // Check if any journal is posted
          const { data: postedJurnals } = await supabase
            .from('jurnal_transaksi')
            .select('is_posted')
            .eq('lingkungan_id', targetLingkunganId)
            .eq('is_posted', true)
            .limit(1)

          if (postedJurnals && postedJurnals.length > 0) {
            setIsLocked(true)
          }
        }
      } catch (err) {
        console.error('Error loading COA & Saldo:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [supabase])

  const handleSaveSaldoAwal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lingkunganId || isLocked) return

    setSaving(true)
    setSuccessMsg(null)

    const payload = {
      lingkungan_id: lingkunganId,
      saldo_awal: saldoAwalNumeric,
      tahun_buku: tahunBuku,
      bulan_saldo: bulanSaldo ? parseInt(bulanSaldo, 10) : 1
    }

    let err = null
    try {
      if (profilId) {
        const { error } = await supabase.from('profil_lingkungan').update(payload).eq('id', profilId)
        err = error
      } else {
        const { error } = await supabase.from('profil_lingkungan').insert(payload)
        err = error
      }
    } catch (e) {
      // Ignored for offline fallback
    }

    // Always update localStorage store so it syncs immediately
    try {
      const existing = localStorage.getItem(`profil_manual_${lingkunganId}`)
      const obj = existing ? JSON.parse(existing) : {}
      obj.saldoAwal = saldoAwalNumeric
      obj.tahunBuku = tahunBuku
      obj.bulanSaldo = bulanSaldo ? parseInt(bulanSaldo, 10) : 1
      localStorage.setItem(`profil_manual_${lingkunganId}`, JSON.stringify(obj))
      window.dispatchEvent(new Event('storage'))
      window.dispatchEvent(new Event('lingkunganChanged'))
    } catch (e) {}

    setSaving(false)
    setSuccessMsg('Saldo awal berhasil disimpan dan diperbarui!')
    setTimeout(() => setSuccessMsg(null), 3500)
  }

  const handleAddCOA = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCoaCode.trim() || !newCoaName.trim()) {
      alert('Kode akun dan nama akun wajib diisi!')
      return
    }

    const newCoa: MasterCOAItem = {
      id: newCoaCode.trim(),
      nama_akun: newCoaName.trim(),
      tipe: newCoaType,
      kategori: newCoaCat,
      keterangan: newCoaDesc.trim() || undefined
    }

    // 1. Save to local storage
    const updated = saveCustomCOA(newCoa)
    setCoaList(updated)

    // 2. Upsert ke Supabase
    try {
      await supabase.from('coa').upsert({
        id: newCoa.id,
        nama_akun: newCoa.nama_akun,
        tipe: newCoa.tipe
      }, { onConflict: 'id' })
    } catch (e) {}

    setIsAddCoaOpen(false)
    setNewCoaCode('')
    setNewCoaName('')
    setNewCoaDesc('')
    setSuccessMsg(`COA baru ${newCoa.id} - ${newCoa.nama_akun} berhasil ditambahkan dan disinkronkan ke database!`)
    setTimeout(() => setSuccessMsg(null), 3500)
  }

  const handleOpenEditCOA = (item: MasterCOAItem) => {
    setEditingCoaCode(item.id)
    setEditingCoaName(item.nama_akun)
    setEditingCoaType(item.tipe)
    setEditingCoaCat(item.kategori)
    setEditingCoaDesc(item.keterangan || '')
    setIsEditCoaOpen(true)
  }

  const handleSaveEditCOA = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCoaCode || !editingCoaName.trim()) {
      alert('Nama akun COA wajib diisi!')
      return
    }

    const updatedItem: MasterCOAItem = {
      id: editingCoaCode,
      nama_akun: editingCoaName.trim(),
      tipe: editingCoaType,
      kategori: editingCoaCat,
      keterangan: editingCoaDesc.trim() || undefined
    }

    // 1. Simpan ke local storage
    const updatedList = saveCustomCOA(updatedItem)
    setCoaList(updatedList)

    // 2. Upsert ke Supabase
    try {
      await supabase.from('coa').upsert({
        id: updatedItem.id,
        nama_akun: updatedItem.nama_akun,
        tipe: updatedItem.tipe
      }, { onConflict: 'id' })
    } catch (err) {}

    setIsEditCoaOpen(false)
    setSuccessMsg(`Akun COA ${updatedItem.id} - ${updatedItem.nama_akun} berhasil diperbarui!`)
    setTimeout(() => setSuccessMsg(null), 3500)
  }

  const handleDeleteCOA = async (id: string, nama: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus akun COA ${id} - ${nama}?\n\nPerhatian: Pastikan akun ini belum pernah dipakai di jurnal transaksi!`)) {
      return
    }

    // 1. Hapus dari local storage
    const updatedList = deleteCustomCOA(id)
    setCoaList(updatedList)

    // 2. Hapus dari Supabase
    try {
      await supabase.from('coa').delete().eq('id', id)
    } catch (err) {}

    setSuccessMsg(`Akun COA ${id} - ${nama} berhasil dihapus!`)
    setTimeout(() => setSuccessMsg(null), 3500)
  }

  const handleSyncCoaDatabase = async () => {
    setSyncingCoa(true)
    const result = await syncAllCoaToDatabase(supabase)
    setSyncingCoa(false)
    if (result.success) {
      setSuccessMsg(`Berhasil menyinkronkan ${result.count} akun COA ke Database Supabase!`)
    } else {
      setSuccessMsg(`Sinkronisasi lokal berhasil. Database: ${result.error || 'cek koneksi'}`)
    }
    setTimeout(() => setSuccessMsg(null), 4000)
  }

  const filteredCoaList = coaList.filter((item) => {
    const matchSearch =
      item.id.toLowerCase().includes(searchCoa.toLowerCase()) ||
      item.nama_akun.toLowerCase().includes(searchCoa.toLowerCase()) ||
      (item.keterangan && item.keterangan.toLowerCase().includes(searchCoa.toLowerCase()))

    if (filterKategori === 'ALL') return matchSearch
    return matchSearch && item.kategori === filterKategori
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* SUCCESS NOTIFICATION */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 text-sm font-bold flex items-center gap-2 shadow-xs transition-all">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* SECTION 1: ISIAN SALDO AWAL (Persis sesuai Gambar 1) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Header Isian Saldo Awal */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-[#E6F4EA] text-[#137333] rounded-xl flex items-center justify-center">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Isian Saldo Awal</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Masukkan saldo rekening/kas saat pertama kali mulai mencatat
              </p>
            </div>
          </div>

          {isLocked && (
            <span className="text-xs bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1 rounded-full font-bold flex items-center gap-1.5 shrink-0">
              <Lock className="w-3.5 h-3.5 text-amber-600" /> Terkunci (Posted)
            </span>
          )}
        </div>

        <div className="p-6 space-y-5">
          {/* Form Fields */}
          <form onSubmit={handleSaveSaldoAwal} className="space-y-5">
            {/* Row 1: Tahun Buku & Bulan Saldo Awal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="tahun" className="text-xs font-bold text-slate-700">Tahun Buku</Label>
                <Input
                  id="tahun"
                  value={tahunBuku}
                  onChange={(e) => setTahunBuku(e.target.value)}
                  disabled={isLocked}
                  className="bg-white border-slate-300 text-slate-900 rounded-xl h-11 text-sm font-medium focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bulan" className="text-xs font-bold text-slate-700">
                  Bulan Saldo Awal <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={bulanSaldo}
                  onValueChange={(val) => setBulanSaldo(val || '')}
                  disabled={isLocked}
                >
                  <SelectTrigger id="bulan" className="bg-white border-slate-300 text-slate-900 rounded-xl h-11 text-sm">
                    <SelectValue placeholder="— Pilih bulan saldo awal —" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-slate-900">
                    {MONTH_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Inner Box: COA 1100 - Bank (Kotak Biru Sesuai Gambar 1) */}
            <div className="border border-blue-200 bg-[#F0F6FE]/70 rounded-xl p-4 sm:p-5 space-y-3.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-slate-900">COA 1100 — Bank</div>
                  <div className="text-xs text-slate-500 mt-0.5">Saldo rekening bank lingkungan</div>
                </div>
                <span className="bg-[#18539E] text-white text-[11px] font-bold px-3 py-1 rounded-full shrink-0 shadow-2xs">
                  Kas & Setara Kas
                </span>
              </div>

              <div className="space-y-1.5 pt-1">
                <Label htmlFor="saldoBank" className="text-xs font-bold text-slate-700">
                  Saldo Awal Bank (Rp) <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="saldoBank"
                  value={saldoAwalInput}
                  onChange={handleSaldoChange}
                  disabled={isLocked}
                  className="bg-white border-slate-300 text-slate-900 font-bold text-base rounded-xl h-11 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-500 italic mt-1">
                  Isi sesuai saldo rekening bank pada bulan mulai pembukuan (lihat buku tabungan atau rekening koran)
                </p>
              </div>
            </div>

            {/* Tombol Simpan Saldo Awal (Di Pojok Kanan) */}
            {!isLocked && (
              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-slate-700 hover:bg-slate-800 text-white font-bold h-11 px-6 rounded-xl text-sm shadow-xs cursor-pointer flex items-center justify-center gap-2 transition-all"
                >
                  <span>✓</span>
                  {saving ? 'Menyimpan Saldo Awal...' : 'Simpan Saldo Awal'}
                </Button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* SECTION 2: MASTER CHART OF ACCOUNTS (COA) DENGAN OPSI TAMBAH COA */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900 font-serif">Daftar Master COA (Bagan Akun)</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Standar bagan akun pembukuan paroki sesuai MASTER LAP AKTIVITAS ({coaList.length} Akun)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Tombol Sinkronisasi ke Database Supabase */}
            <Button
              type="button"
              variant="outline"
              onClick={handleSyncCoaDatabase}
              disabled={syncingCoa}
              className="border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold px-3.5 py-2.5 rounded-xl shrink-0 cursor-pointer flex items-center gap-1.5 shadow-xs transition-all"
              title="Kirim dan sinkronkan semua COA ke tabel database Supabase"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${syncingCoa ? 'animate-spin' : ''}`} />
              {syncingCoa ? 'Menyinkronkan...' : 'Sinkronkan ke Database'}
            </Button>

            {/* Tombol Tambahkan COA Baru */}
            <Button
              type="button"
              onClick={() => setIsAddCoaOpen(true)}
              className="bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl shrink-0 cursor-pointer flex items-center gap-1.5 shadow-xs transition-all"
            >
              <Plus className="w-4 h-4 text-white" />
              Tambah COA Baru
            </Button>
          </div>
        </div>

        {/* Search & Kategori Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchCoa}
              onChange={(e) => setSearchCoa(e.target.value)}
              placeholder="Cari kode atau nama akun COA..."
              className="pl-9 bg-slate-50 border-slate-200 text-xs text-slate-900 rounded-xl h-10"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <Button
              type="button"
              variant={filterKategori === 'ALL' ? 'default' : 'outline'}
              onClick={() => setFilterKategori('ALL')}
              className={`text-xs h-9 rounded-xl font-bold ${filterKategori === 'ALL' ? 'bg-slate-900 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            >
              Semua
            </Button>
            <Button
              type="button"
              variant={filterKategori === 'KAS' ? 'default' : 'outline'}
              onClick={() => setFilterKategori('KAS')}
              className={`text-xs h-9 rounded-xl font-bold ${filterKategori === 'KAS' ? 'bg-slate-900 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            >
              Kas & Bank
            </Button>
            <Button
              type="button"
              variant={filterKategori === 'PENERIMAAN' ? 'default' : 'outline'}
              onClick={() => setFilterKategori('PENERIMAAN')}
              className={`text-xs h-9 rounded-xl font-bold ${filterKategori === 'PENERIMAAN' ? 'bg-slate-900 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            >
              Penerimaan (4xxx)
            </Button>
            <Button
              type="button"
              variant={filterKategori === 'PENGELUARAN' ? 'default' : 'outline'}
              onClick={() => setFilterKategori('PENGELUARAN')}
              className={`text-xs h-9 rounded-xl font-bold ${filterKategori === 'PENGELUARAN' ? 'bg-slate-900 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            >
              Pengeluaran (5xxx)
            </Button>
          </div>
        </div>

        {/* Tabel COA */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50/90 text-slate-700 text-xs font-bold border-b border-slate-200">
              <TableRow>
                <TableHead className="w-28 text-slate-800 font-bold">Kode Akun</TableHead>
                <TableHead className="text-slate-800 font-bold">Nama Akun COA</TableHead>
                <TableHead className="text-slate-800 font-bold">Kategori / Klasifikasi</TableHead>
                <TableHead className="w-28 text-center text-slate-800 font-bold">Saldo Normal</TableHead>
                <TableHead className="w-24 text-center text-slate-800 font-bold">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 text-xs">
              {filteredCoaList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                    Tidak ada akun COA yang cocok dengan pencarian.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCoaList.map((c) => (
                  <TableRow key={c.id} className="hover:bg-slate-50/80 transition">
                    <TableCell className="font-mono font-bold text-blue-900 text-sm">{c.id}</TableCell>
                    <TableCell>
                      <div className="font-bold text-slate-900">{c.nama_akun}</div>
                      {c.keterangan && <div className="text-[11px] text-slate-500 mt-0.5">{c.keterangan}</div>}
                    </TableCell>
                    <TableCell>
                      {c.kategori === 'KAS' && (
                        <span className="bg-slate-100 text-slate-700 text-xs font-medium px-2.5 py-0.5 rounded-md border border-slate-200">
                          Kas & Bank
                        </span>
                      )}
                      {c.kategori === 'PENERIMAAN' && (
                        <span className="bg-slate-100 text-slate-700 text-xs font-medium px-2.5 py-0.5 rounded-md border border-slate-200">
                          Penerimaan
                        </span>
                      )}
                      {c.kategori === 'PENGELUARAN' && (
                        <span className="bg-slate-100 text-slate-700 text-xs font-medium px-2.5 py-0.5 rounded-md border border-slate-200">
                          Pengeluaran
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs font-mono font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-md">
                        {c.tipe}
                      </span>
                    </TableCell>
                    <TableCell className="text-center flex justify-center items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEditCOA(c)}
                        className="h-7 px-2 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer border border-slate-200 shadow-2xs"
                        title="Edit data akun COA ini"
                      >
                        <Pencil className="w-3.5 h-3.5 text-slate-500" />
                        <span>Edit</span>
                      </Button>

                      {!DEFAULT_MASTER_COA_LIST.some(defaultItem => defaultItem.id === c.id) && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteCOA(c.id, c.nama_akun)}
                          className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer border border-rose-200 shadow-2xs"
                          title="Hapus akun COA ini"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          <span>Hapus</span>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* MODAL / DIALOG TAMBAH COA BARU */}
      <Dialog open={isAddCoaOpen} onOpenChange={setIsAddCoaOpen}>
        <DialogContent className="sm:max-w-lg bg-white border-slate-200 text-slate-900 rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-bold text-lg flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-600" />
              Tambah COA (Bagan Akun) Baru
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Tambahkan kode akun baru ke dalam daftar master untuk pencatatan transaksi kas lingkungan.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddCOA} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="newCode" className="text-xs font-bold text-slate-700">Kode Akun (Contoh: 4950 / 5360) *</Label>
                <Input
                  id="newCode"
                  value={newCoaCode}
                  onChange={(e) => setNewCoaCode(e.target.value)}
                  placeholder="Misal: 4950"
                  required
                  className="bg-white border-slate-300 font-mono font-bold rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="newCat" className="text-xs font-bold text-slate-700">Kategori Akun *</Label>
                <Select
                  value={newCoaCat}
                  onValueChange={(val: any) => {
                    setNewCoaCat(val)
                    if (val === 'PENERIMAAN') setNewCoaType('KREDIT')
                    else setNewCoaType('DEBIT')
                  }}
                >
                  <SelectTrigger id="newCat" className="bg-white border-slate-300 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-slate-900">
                    <SelectItem value="PENERIMAAN">Penerimaan (Pendapatan)</SelectItem>
                    <SelectItem value="PENGELUARAN">Pengeluaran (Biaya/Beban)</SelectItem>
                    <SelectItem value="KAS">Kas & Setara Kas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newName" className="text-xs font-bold text-slate-700">Nama Akun Transaksi *</Label>
              <Input
                id="newName"
                value={newCoaName}
                onChange={(e) => setNewCoaName(e.target.value)}
                placeholder="Misal: Sumbangan Khusus Bencana Alam"
                required
                className="bg-white border-slate-300 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="newType" className="text-xs font-bold text-slate-700">Saldo Normal Akun *</Label>
                  <span className="text-[10px] text-slate-400">Otomatis diisi sistem</span>
                </div>
                <Select value={newCoaType} onValueChange={(val: any) => setNewCoaType(val)}>
                  <SelectTrigger id="newType" className="bg-white border-slate-300 rounded-xl font-bold text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-slate-900">
                    <SelectItem value="KREDIT">KREDIT (Standar Akun Penerimaan / Uang Masuk)</SelectItem>
                    <SelectItem value="DEBIT">DEBIT (Standar Akun Pengeluaran / Biaya & Kas)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="newDesc" className="text-xs font-bold text-slate-700">Keterangan Tambahan</Label>
                <Input
                  id="newDesc"
                  value={newCoaDesc}
                  onChange={(e) => setNewCoaDesc(e.target.value)}
                  placeholder="Keterangan singkat..."
                  className="bg-white border-slate-300 rounded-xl text-xs"
                />
              </div>
            </div>

            {/* Kotak Panduan Ramah Awam (User Friendly Helper) */}
            <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-start gap-2.5 text-[11px] text-blue-900 leading-relaxed">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-blue-950">Panduan Akuntansi Standar Paroki:</strong>
                <div className="text-slate-600 mt-0.5 space-y-0.5">
                  <div>• <strong>Penerimaan / Iuran / Kolekte (4xxx):</strong> Saldo normal bertambah di <strong>KREDIT</strong>.</div>
                  <div>• <strong>Pengeluaran / Biaya Operasional (5xxx):</strong> Saldo normal bertambah di <strong>DEBIT</strong>.</div>
                  <div>• <strong>Kas & Rekening Bank (1xxx):</strong> Saldo normal uang ada di <strong>DEBIT</strong> (saat uang masuk didebit, saat uang keluar dikredit).</div>
                  <div className="text-[10px] text-blue-700 italic pt-0.5">* Pilihan saldo normal di atas sudah otomatis disesuaikan dengan Kategori Akun yang Anda pilih.</div>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddCoaOpen(false)}
                className="border-slate-300 text-slate-700 rounded-xl cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="submit"
                className="bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl px-5 h-10 cursor-pointer transition-all"
              >
                Simpan COA Baru
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL / DIALOG EDIT COA */}
      <Dialog open={isEditCoaOpen} onOpenChange={setIsEditCoaOpen}>
        <DialogContent className="sm:max-w-lg bg-white border-slate-200 text-slate-900 rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-bold text-lg flex items-center gap-2">
              <Pencil className="w-5 h-5 text-slate-700" />
              Edit Akun COA ({editingCoaCode})
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Perbarui nama akun, klasifikasi, saldo normal, atau keterangan COA ini.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEditCOA} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="editCode" className="text-xs font-bold text-slate-700">Kode Akun</Label>
                <Input
                  id="editCode"
                  value={editingCoaCode}
                  disabled
                  className="bg-slate-100 border-slate-300 font-mono font-bold text-sm text-slate-700 cursor-not-allowed rounded-xl"
                />
                <p className="text-[10px] text-slate-400">Kode akun dikunci agar integritas jurnal tetap terjaga</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editCat" className="text-xs font-bold text-slate-700">Kategori / Klasifikasi *</Label>
                <Select
                  value={editingCoaCat}
                  onValueChange={(val: any) => {
                    setEditingCoaCat(val)
                    if (val === 'PENERIMAAN') setEditingCoaType('KREDIT')
                    else if (val === 'PENGELUARAN' || val === 'KAS') setEditingCoaType('DEBIT')
                  }}
                >
                  <SelectTrigger id="editCat" className="bg-white border-slate-300 rounded-xl font-bold text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-slate-900">
                    <SelectItem value="KAS">Kas & Bank (1xxx)</SelectItem>
                    <SelectItem value="PENERIMAAN">Penerimaan (4xxx)</SelectItem>
                    <SelectItem value="PENGELUARAN">Pengeluaran (5xxx)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editName" className="text-xs font-bold text-slate-700">Nama Akun COA *</Label>
              <Input
                id="editName"
                value={editingCoaName}
                onChange={(e) => setEditingCoaName(e.target.value)}
                placeholder="Contoh: Kolekte yg disetor ke Paroki"
                className="bg-white border-slate-300 rounded-xl font-medium text-xs text-slate-900"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="editType" className="text-xs font-bold text-slate-700">Saldo Normal Akun *</Label>
                <Select value={editingCoaType} onValueChange={(val: any) => setEditingCoaType(val)}>
                  <SelectTrigger id="editType" className="bg-white border-slate-300 rounded-xl font-bold text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-slate-900">
                    <SelectItem value="KREDIT">KREDIT (Standar Penerimaan)</SelectItem>
                    <SelectItem value="DEBIT">DEBIT (Standar Pengeluaran & Kas)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editDesc" className="text-xs font-bold text-slate-700">Keterangan Tambahan</Label>
                <Input
                  id="editDesc"
                  value={editingCoaDesc}
                  onChange={(e) => setEditingCoaDesc(e.target.value)}
                  placeholder="Keterangan singkat..."
                  className="bg-white border-slate-300 rounded-xl text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditCoaOpen(false)}
                className="border-slate-300 text-slate-700 rounded-xl cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="submit"
                className="bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl px-5 h-10 cursor-pointer transition-all"
              >
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
