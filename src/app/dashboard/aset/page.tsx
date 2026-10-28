'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { UserProfile, Aset } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'
import { formatNamaLingkungan, getAllMasterLingkungan, findLingkunganByQuery, getLingkunganDbUuid, getNamaLingkunganFromAnyIdentifier } from '@/lib/constants'
import { getPengurusForLingkungan, PengurusLingkungan } from '@/lib/pengurusData'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import {
  Package,
  Plus,
  Trash2,
  Pencil,
  Printer,
  Download,
  CheckCircle2,
  Boxes,
  Search,
  Check,
  AlertTriangle
} from 'lucide-react'

const KATEGORI_ASET_OPTIONS = [
  'Inventaris Liturgi dan Ibadat Sabda',
  'Peralatan Elektronik & Sound System',
  'Perlengkapan Ruang Rapat & Pertemuan',
  'Inventaris Dapur & Konsumsi',
  'Perlengkapan BIA / BIR / OMK',
  'Inventaris Musik & Koor',
  'Lainnya'
]

const KONDISI_OPTIONS = [
  { value: 'Baik', label: 'Baik (Siap Pakai)', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  { value: 'Rusak Ringan', label: 'Rusak Ringan (Perlu Servis)', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  { value: 'Rusak Berat', label: 'Rusak Berat (Tidak Layak)', color: 'bg-rose-50 text-rose-800 border-rose-200' }
]

const YEAR_OPTIONS = Array.from({ length: 15 }, (_, i) => String(2026 - i))

export default function AsetPage() {
  const supabase = createClient()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [lingkunganId, setLingkunganId] = useState<string | null>(null)
  const [lingkunganName, setLingkunganName] = useState('')
  const [pengurus, setPengurus] = useState<PengurusLingkungan | null>(null)

  const [asetList, setAsetList] = useState<Aset[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Form State Tambah Aset
  const [kategori, setKategori] = useState<string>('Inventaris Liturgi dan Ibadat Sabda')
  const [namaBarang, setNamaBarang] = useState<string>('')
  const [tahunBeli, setTahunBeli] = useState<string>('')
  const [jumlah, setJumlah] = useState<number>(1)
  const [kondisi, setKondisi] = useState<string>('Baik')
  const [hargaSatuanInput, setHargaSatuanInput] = useState<string>('Rp 0')
  const [hargaSatuanNumeric, setHargaSatuanNumeric] = useState<number>(0)

  // Edit / Update Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingAset, setEditingAset] = useState<Aset | null>(null)
  const [editNama, setEditNama] = useState('')
  const [editKategori, setEditKategori] = useState('')
  const [editTahun, setEditTahun] = useState('')
  const [editJumlah, setEditJumlah] = useState(1)
  const [editKondisi, setEditKondisi] = useState('Baik')
  const [editHargaInput, setEditHargaInput] = useState('Rp 0')
  const [editHargaNumeric, setEditHargaNumeric] = useState(0)

  const [submitting, setSubmitting] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [successToast, setSuccessToast] = useState<string | null>(null)
  const [deleteAsetModalItem, setDeleteAsetModalItem] = useState<{ id: string; nama: string } | null>(null)
  const [systemNoticeMsg, setSystemNoticeMsg] = useState<string | null>(null)

  // Currency helper
  const formatCurrency = (val: number): string => {
    if (!val || isNaN(val)) return 'Rp 0'
    return 'Rp ' + val.toLocaleString('id-ID')
  }

  const handleHargaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    const num = parseInt(raw, 10) || 0
    setHargaSatuanNumeric(num)
    setHargaSatuanInput(formatCurrency(num))
  }

  const handleEditHargaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    const num = parseInt(raw, 10) || 0
    setEditHargaNumeric(num)
    setEditHargaInput(formatCurrency(num))
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

        const cookieRole = (typeof document !== 'undefined' ? (`; ${document.cookie}`).split('; demo_user_role=').pop()?.split(';').shift() : '') || ''
        const cookieLingId = (typeof document !== 'undefined' ? (`; ${document.cookie}`).split('; demo_user_lingkungan_id=').pop()?.split(';').shift() : '') || ''
        let cookieLingNama = (typeof document !== 'undefined' ? (`; ${document.cookie}`).split('; demo_user_lingkungan_nama=').pop()?.split(';').shift() : '') || ''
        try { cookieLingNama = decodeURIComponent(cookieLingNama) } catch (e) {}

        const cookieUsername = (typeof document !== 'undefined' ? (`; ${document.cookie}`).split('; demo_user_username=').pop()?.split(';').shift() : '') || ''
        let rawDemoEmail = typeof document !== 'undefined' ? (`; ${document.cookie}`).split('; demo_user_email=').pop()?.split(';').shift() || '' : ''
        try {
          rawDemoEmail = decodeURIComponent(rawDemoEmail)
        } catch (e) {}
        const effectiveEmail = user?.email || rawDemoEmail || cookieUsername || ''
        const effectiveRole = cookieRole || ''

        let targetLingkunganId: string | null = null
        let targetLingkunganNama: string | null = null

        if (effectiveRole !== 'PAROKI' && effectiveEmail) {
          const matched = findLingkunganByQuery(effectiveEmail)
          if (matched) {
            targetLingkunganId = matched.id
            targetLingkunganNama = matched.nama_lingkungan
          }
        }

        if (!targetLingkunganId && effectiveRole !== 'PAROKI' && cookieLingId) {
          targetLingkunganId = cookieLingId
          targetLingkunganNama = cookieLingNama || null
        }

        if (!targetLingkunganId) {
          targetLingkunganId = localStorage.getItem('selected_lingkungan_id')
        }
        if (!targetLingkunganId) {
          const { data: lData } = await supabase.from('lingkungan').select('id, nama_lingkungan').limit(1).maybeSingle()
          if (lData) {
            targetLingkunganId = lData.id
            targetLingkunganNama = lData.nama_lingkungan
          }
        }

        if (targetLingkunganNama) {
          setLingkunganName(targetLingkunganNama)
        } else if (targetLingkunganId) {
          const allM = getAllMasterLingkungan()
          const found = allM.find(l => l.id === targetLingkunganId)
          if (found) setLingkunganName(found.nama_lingkungan)
        }

        setLingkunganId(targetLingkunganId)

        if (targetLingkunganId) {
          const dbUuid = getLingkunganDbUuid(targetLingkunganId)
          // Load profil for officers info
          const { data: profil } = await supabase
            .from('profil_lingkungan')
            .select('*')
            .or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${targetLingkunganId}`)
            .maybeSingle()

          const pengurusInfo = getPengurusForLingkungan(targetLingkunganId, targetLingkunganNama, profil)
          setPengurus(pengurusInfo)

          await fetchAset(targetLingkunganId)
        }
      } catch (err) {
        console.error('Error loading aset data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()

    const handleSync = () => {
      loadData()
    }
    window.addEventListener('storage', handleSync)
    window.addEventListener('lingkunganChanged', handleSync)

    return () => {
      window.removeEventListener('storage', handleSync)
      window.removeEventListener('lingkunganChanged', handleSync)
    }
  }, [supabase])

  const fetchAset = async (lId: string) => {
    let list: Aset[] = []
    const dbUuid = getLingkunganDbUuid(lId)
    try {
      const { data: items } = await supabase
        .from('aset')
        .select('*')
        .or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${lId}`)
        .order('created_at', { ascending: false })

      if (items) list = items
    } catch (e) {}

    // Merge with localStorage custom assets
    try {
      const raw = localStorage.getItem(`custom_aset_${lId}`) || (dbUuid ? localStorage.getItem(`custom_aset_${dbUuid}`) : null)
      if (raw) {
        const localList: Aset[] = JSON.parse(raw)
        const map = new Map<string, Aset>()
        list.forEach(a => map.set(a.id, a))
        localList.forEach(a => map.set(a.id, a))
        list = Array.from(map.values())
      }
    } catch (e) {}

    setAsetList(list)
  }

  // Calculate totals
  const totalItemCount = asetList.reduce((acc, curr) => acc + (Number(curr.jumlah) || 1), 0)
  const totalNilaiAset = asetList.reduce((acc, curr) => acc + ((Number(curr.jumlah) || 1) * (Number(curr.harga_satuan) || 0)), 0)

  const handleSaveAset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!namaBarang.trim()) {
      setSystemNoticeMsg('Nama barang wajib diisi!')
      return
    }

    setSubmitting(true)
    const dbLingkunganId = getLingkunganDbUuid(lingkunganId) || lingkunganId || 'default-lingkungan'
    const payload = {
      lingkungan_id: dbLingkunganId,
      nama_barang: namaBarang.trim(),
      kategori: kategori,
      tahun_beli: tahunBeli ? parseInt(tahunBeli, 10) : 2026,
      jumlah: jumlah || 1,
      harga_satuan: hargaSatuanNumeric,
      kondisi: kondisi || 'Baik'
    }

    let createdId = 'aset-' + Date.now()
    try {
      const { data: createdData } = await supabase
        .from('aset')
        .insert(payload)
        .select()
        .single()

      if (createdData?.id) createdId = createdData.id
    } catch (e) {}

    const newAset: Aset = {
      id: createdId,
      lingkungan_id: payload.lingkungan_id,
      nama_barang: payload.nama_barang,
      kategori: payload.kategori,
      tahun_beli: payload.tahun_beli,
      jumlah: payload.jumlah,
      harga_satuan: payload.harga_satuan,
      kondisi: payload.kondisi
    }

    // Save to local storage
    if (lingkunganId) {
      try {
        const existing = localStorage.getItem(`custom_aset_${lingkunganId}`)
        const list = existing ? JSON.parse(existing) : []
        list.unshift(newAset)
        localStorage.setItem(`custom_aset_${lingkunganId}`, JSON.stringify(list))
        window.dispatchEvent(new Event('storage'))
      } catch (e) {}
    }

    setAsetList(prev => [newAset, ...prev])
    setSubmitting(false)

    // Reset Form
    setNamaBarang('')
    setTahunBeli('')
    setJumlah(1)
    setKondisi('Baik')
    setHargaSatuanNumeric(0)
    setHargaSatuanInput('Rp 0')

    setSuccessToast(`Aset "${newAset.nama_barang}" berhasil ditambahkan ke inventaris!`)
    setTimeout(() => setSuccessToast(null), 3500)
  }

  // Open Edit Modal
  const handleOpenEdit = (item: Aset) => {
    setEditingAset(item)
    setEditNama(item.nama_barang)
    setEditKategori(item.kategori || KATEGORI_ASET_OPTIONS[0])
    setEditTahun(item.tahun_beli ? String(item.tahun_beli) : '')
    setEditJumlah(Number(item.jumlah) || 1)
    setEditKondisi(item.kondisi || 'Baik')
    const price = Number(item.harga_satuan) || 0
    setEditHargaNumeric(price)
    setEditHargaInput(formatCurrency(price))
    setIsEditModalOpen(true)
  }

  // Save Edit / Update
  const handleUpdateAset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAset || !editNama.trim()) {
      setSystemNoticeMsg('Nama barang wajib diisi!')
      return
    }

    setUpdating(true)
    const updatedFields = {
      nama_barang: editNama.trim(),
      kategori: editKategori,
      tahun_beli: editTahun ? parseInt(editTahun, 10) : 2026,
      jumlah: editJumlah || 1,
      harga_satuan: editHargaNumeric,
      kondisi: editKondisi || 'Baik'
    }

    try {
      await supabase
        .from('aset')
        .update(updatedFields)
        .eq('id', editingAset.id)
    } catch (e) {}

    const updatedAset: Aset = {
      ...editingAset,
      ...updatedFields
    }

    // Update in state
    setAsetList(prev => prev.map(a => a.id === editingAset.id ? updatedAset : a))

    // Update in localStorage
    if (lingkunganId) {
      try {
        const raw = localStorage.getItem(`custom_aset_${lingkunganId}`)
        if (raw) {
          const list: Aset[] = JSON.parse(raw)
          const newList = list.map(a => a.id === editingAset.id ? updatedAset : a)
          localStorage.setItem(`custom_aset_${lingkunganId}`, JSON.stringify(newList))
          window.dispatchEvent(new Event('storage'))
        }
      } catch (e) {}
    }

    setUpdating(false)
    setIsEditModalOpen(false)
    setEditingAset(null)
    setSuccessToast(`Data aset "${updatedAset.nama_barang}" berhasil diperbarui!`)
    setTimeout(() => setSuccessToast(null), 3500)
  }

  const handleDeleteAset = (id: string, nama: string) => {
    setDeleteAsetModalItem({ id, nama })
  }

  const handleConfirmDeleteAset = async () => {
    if (!deleteAsetModalItem) return
    const { id, nama } = deleteAsetModalItem

    try {
      await supabase.from('aset').delete().eq('id', id)
    } catch (e) {}

    if (lingkunganId) {
      try {
        const raw = localStorage.getItem(`custom_aset_${lingkunganId}`)
        if (raw) {
          const list = JSON.parse(raw).filter((a: any) => a.id !== id)
          localStorage.setItem(`custom_aset_${lingkunganId}`, JSON.stringify(list))
          window.dispatchEvent(new Event('storage'))
        }
      } catch (e) {}
    }

    setAsetList(prev => prev.filter(a => a.id !== id))
    setDeleteAsetModalItem(null)
    setSuccessToast(`Aset "${nama}" berhasil dihapus dari inventaris!`)
    setTimeout(() => setSuccessToast(null), 3500)
  }

  const handlePrint = () => {
    window.print()
  }

  const filteredAsetList = asetList.filter((item) =>
    item.nama_barang.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.kategori && item.kategori.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (item.kondisi && item.kondisi.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* HEADER MODUL & ACTION BUTTONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-[#18539E]" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight font-serif">
              Daftar Aset & Inventaris
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manajemen inventaris aset milik lingkungan {formatNamaLingkungan(lingkunganName)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={handlePrint}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl h-10 px-4 text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-white" />
            Cetak Daftar Aset (PDF)
          </Button>
        </div>
      </div>

      {/* 2 SUMMARY METRIC BOXES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:hidden">
        {/* Box 1: Total Unit Barang */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Total Unit Barang Inventaris</div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 font-mono">
            {totalItemCount} <span className="text-sm font-normal text-slate-500">Unit</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Dari {asetList.length} jenis barang inventaris</p>
        </div>

        {/* Box 2: Total Nilai Aset */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Total Nilai Estimasi Aset</div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 font-mono">
            {formatRupiah(totalNilaiAset)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Akumulasi seluruh barang inventaris lingkungan</p>
        </div>
      </div>

      {/* FORM INPUT ASET BARU */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden print:hidden">
        <div className="p-5 pb-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#F0F5FD] text-[#18539E] flex items-center justify-center font-extrabold text-base shrink-0">
            +
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Input Data Aset Baru</h3>
            <p className="text-xs text-slate-500">Catat inventaris barang baru milik lingkungan</p>
          </div>
        </div>

        <form onSubmit={handleSaveAset} className="p-5 sm:p-6 space-y-4">
          {/* Field 1: Kategori */}
          <div className="space-y-1.5">
            <Label htmlFor="kategori" className="text-xs font-bold text-slate-700">Kategori Inventaris *</Label>
            <Select value={kategori} onValueChange={(val) => setKategori(val || '')}>
              <SelectTrigger id="kategori" className="bg-white border-slate-300 text-slate-900 rounded-xl h-11 text-sm font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 text-slate-900">
                {KATEGORI_ASET_OPTIONS.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Field 2: Nama Barang * */}
          <div className="space-y-1.5">
            <Label htmlFor="namaBarang" className="text-xs font-bold text-slate-700">
              Nama Barang <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="namaBarang"
              value={namaBarang}
              onChange={(e) => setNamaBarang(e.target.value)}
              placeholder="Contoh: Sound System Portable / Lilin Perarakan"
              required
              className="bg-white border-slate-300 text-slate-900 rounded-xl h-11 text-sm focus:ring-blue-500"
            />
          </div>

          {/* Row 3: Tahun Pembelian, Jumlah, & Kondisi */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="tahunBeli" className="text-xs font-bold text-slate-700">Tahun Pembelian</Label>
              <Select value={tahunBeli} onValueChange={(val) => setTahunBeli(val || '')}>
                <SelectTrigger id="tahunBeli" className="bg-white border-slate-300 text-slate-900 rounded-xl h-11 text-sm font-medium">
                  <SelectValue placeholder="-- Pilih Tahun --" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900">
                  {YEAR_OPTIONS.map((yr) => (
                    <SelectItem key={yr} value={yr}>
                      {yr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="jumlah" className="text-xs font-bold text-slate-700">Jumlah (Unit)</Label>
              <Input
                id="jumlah"
                type="number"
                min="1"
                value={jumlah}
                onChange={(e) => setJumlah(parseInt(e.target.value, 10) || 1)}
                className="bg-white border-slate-300 text-slate-900 font-bold rounded-xl h-11 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="kondisi" className="text-xs font-bold text-slate-700">Kondisi Aset *</Label>
              <Select value={kondisi} onValueChange={(val) => setKondisi(val || 'Baik')}>
                <SelectTrigger id="kondisi" className="bg-white border-slate-300 text-slate-900 rounded-xl h-11 text-sm font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900">
                  {KONDISI_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Field 4: Harga Satuan (Rp) */}
          <div className="space-y-1.5">
            <Label htmlFor="hargaSatuan" className="text-xs font-bold text-slate-700">Harga Satuan (Rp)</Label>
            <Input
              id="hargaSatuan"
              value={hargaSatuanInput}
              onChange={handleHargaChange}
              placeholder="Rp 0"
              className="bg-white border-slate-300 text-slate-900 font-bold rounded-xl h-11 text-sm"
            />
          </div>

          {/* Tombol Simpan Aset (Di Pojok Kanan) */}
          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-slate-700 hover:bg-slate-800 text-white font-bold h-11 px-6 rounded-xl text-sm shadow-xs cursor-pointer flex items-center justify-center gap-2 transition-all"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Aset'}
            </Button>
          </div>
        </form>
      </div>

      {/* HEADER CETAK PDF (Hanya Tampil Saat Print) */}
      <div className="hidden print:block text-center pb-4 border-b-2 border-slate-800 mb-6">
        <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
          PAROKI BEKASI UTARA — GEREJA SANTA CLARA
        </h2>
        <h3 className="text-base font-bold text-slate-800">
          DAFTAR INVENTARIS & ASET LINGKUNGAN
        </h3>
        <p className="text-xs text-slate-600 mt-1">
          Lingkungan: <strong>{formatNamaLingkungan(lingkunganName)}</strong> | Dicetak per: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* BOX DAFTAR ASET YANG TELAH DITAMBAHKAN */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden space-y-4 p-5 sm:p-6 print:border-none print:p-0 print:shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#18539E] flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Daftar Inventaris Aset</h3>
              <p className="text-xs text-slate-500">
                Inventaris barang {formatNamaLingkungan(lingkunganName)} ({filteredAsetList.length} Barang)
              </p>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, kategori, kondisi..."
              className="pl-9 bg-slate-50 border-slate-200 text-xs rounded-xl h-9 text-slate-900"
            />
          </div>
        </div>

        {/* Tabel Aset */}
        <div className="border border-slate-200 rounded-xl overflow-x-auto print:border-slate-400">
          <Table>
            <TableHeader className="bg-slate-50 text-xs font-bold text-slate-700 border-b border-slate-200 print:bg-slate-100 print:text-black">
              <TableRow>
                <TableHead className="w-12 text-center font-bold text-slate-800">No</TableHead>
                <TableHead className="font-bold text-slate-800">Nama Barang</TableHead>
                <TableHead className="font-bold text-slate-800">Kategori</TableHead>
                <TableHead className="w-20 text-center font-bold text-slate-800">Tahun</TableHead>
                <TableHead className="w-20 text-center font-bold text-slate-800">Jumlah</TableHead>
                <TableHead className="w-28 text-center font-bold text-slate-800">Kondisi</TableHead>
                <TableHead className="w-28 text-right font-bold text-slate-800">Harga (Rp)</TableHead>
                <TableHead className="w-32 text-right font-bold text-slate-800">Total Nilai</TableHead>
                <TableHead className="w-20 text-center font-bold text-slate-800 print:hidden">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 text-xs print:divide-slate-300">
              {filteredAsetList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-slate-400">
                    Belum ada barang inventaris aset yang ditambahkan.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAsetList.map((item, idx) => {
                  const qty = Number(item.jumlah) || 1
                  const price = Number(item.harga_satuan) || 0
                  const total = qty * price
                  const itemKondisi = item.kondisi || 'Baik'

                  return (
                    <TableRow key={item.id} className="hover:bg-slate-50/70 transition">
                      <TableCell className="text-center font-mono text-slate-500">{idx + 1}</TableCell>
                      <TableCell className="font-bold text-slate-900">{item.nama_barang}</TableCell>
                      <TableCell>
                        <span className="bg-slate-100 text-slate-700 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                          {item.kategori || 'Inventaris'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-mono text-slate-600">
                        {item.tahun_beli || '—'}
                      </TableCell>
                      <TableCell className="text-center font-bold text-slate-900">
                        {qty} Unit
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          itemKondisi === 'Baik'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : itemKondisi === 'Rusak Ringan'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}>
                          {itemKondisi}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-slate-700">
                        {price > 0 ? price.toLocaleString('id-ID') : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-slate-900">
                        {total > 0 ? total.toLocaleString('id-ID') : '—'}
                      </TableCell>
                      <TableCell className="text-center print:hidden">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="Edit / Update aset"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAset(item.id, item.nama_barang)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Hapus aset"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Tanda Tangan Cetak PDF */}
        <div className="hidden print:grid grid-cols-2 gap-8 pt-12 pb-6 px-6 text-xs text-center border-t border-slate-300 mt-8">
          <div>
            <div className="text-slate-600">Mengetahui,</div>
            <div className="font-bold text-slate-900 mt-1">Ketua Lingkungan</div>
            <div className="h-16"></div>
            <div className="font-bold underline text-slate-900">
              ({pengurus?.ketua_nama || '....................................'})
            </div>
          </div>
          <div>
            <div className="text-slate-600">Bekasi, ........................ 2026</div>
            <div className="font-bold text-slate-900 mt-1">Bendahara Lingkungan</div>
            <div className="h-16"></div>
            <div className="font-bold underline text-slate-900">
              ({pengurus?.bendahara_nama || '....................................'})
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DIALOG UPDATE / EDIT ASET */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-lg bg-white border-slate-200 text-slate-900 rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-bold text-lg flex items-center gap-2">
              <Pencil className="w-5 h-5 text-blue-600" />
              Update / Edit Data Aset
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Perbarui informasi barang inventaris, jumlah unit, dan kondisi kelayakan barang.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateAset} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Nama Barang *</Label>
              <Input
                value={editNama}
                onChange={(e) => setEditNama(e.target.value)}
                required
                className="bg-white border-slate-300 text-slate-900 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Kategori Inventaris *</Label>
              <Select value={editKategori} onValueChange={(val) => setEditKategori(val || '')}>
                <SelectTrigger className="bg-white border-slate-300 text-slate-900 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900">
                  {KATEGORI_ASET_OPTIONS.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Tahun Pembelian</Label>
                <Select value={editTahun} onValueChange={(val) => setEditTahun(val || '')}>
                  <SelectTrigger className="bg-white border-slate-300 text-slate-900 rounded-xl">
                    <SelectValue placeholder="-- Tahun --" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-slate-900">
                    {YEAR_OPTIONS.map((yr) => (
                      <SelectItem key={yr} value={yr}>
                        {yr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Jumlah (Unit)</Label>
                <Input
                  type="number"
                  min="1"
                  value={editJumlah}
                  onChange={(e) => setEditJumlah(parseInt(e.target.value, 10) || 1)}
                  className="bg-white border-slate-300 text-slate-900 font-bold rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Kondisi Barang *</Label>
                <Select value={editKondisi} onValueChange={(val) => setEditKondisi(val || 'Baik')}>
                  <SelectTrigger className="bg-white border-slate-300 text-slate-900 rounded-xl font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-slate-900">
                    {KONDISI_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Harga Satuan (Rp)</Label>
              <Input
                value={editHargaInput}
                onChange={handleEditHargaChange}
                className="bg-white border-slate-300 text-slate-900 font-bold rounded-xl"
              />
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-xl border-slate-300 text-slate-700"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={updating}
                className="bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl"
              >
                {updating ? 'Menyimpan...' : 'Perbarui Aset'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Hapus Aset (Sistem Pop-up) */}
      <Dialog open={!!deleteAsetModalItem} onOpenChange={(o) => !o && setDeleteAsetModalItem(null)}>
        <DialogContent className="sm:max-w-md bg-white text-slate-900 border-slate-200 rounded-2xl p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#F6F2F2] border border-[#E3D8D8] flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4 text-[#6B5353]" />
              </div>
              Hapus Aset Inventaris
            </DialogTitle>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Apakah Anda yakin ingin menghapus aset <strong className="text-slate-900">{deleteAsetModalItem?.nama}</strong> dari daftar inventaris?
            </p>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteAsetModalItem(null)}
              className="text-xs font-semibold text-slate-700 border-slate-300 rounded-xl cursor-pointer px-4"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmDeleteAset}
              className="bg-[#7A5C5C] hover:bg-[#6B5353] text-white font-semibold text-xs rounded-xl cursor-pointer px-4"
            >
              Ya, Hapus Aset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Pemberitahuan Sistem */}
      <Dialog open={!!systemNoticeMsg} onOpenChange={(o) => !o && setSystemNoticeMsg(null)}>
        <DialogContent className="sm:max-w-md bg-white text-slate-900 border-slate-200 rounded-2xl p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">Pemberitahuan Sistem</DialogTitle>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">{systemNoticeMsg}</p>
          </DialogHeader>
          <DialogFooter className="pt-3">
            <Button
              type="button"
              size="sm"
              onClick={() => setSystemNoticeMsg(null)}
              className="bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-xl cursor-pointer px-5"
            >
              Mengerti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
