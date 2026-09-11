'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { UserProfile, Aset } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'
import { formatNamaLingkungan, getAllMasterLingkungan, findLingkunganByQuery } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Package,
  Plus,
  Trash2,
  CheckCircle2,
  Boxes,
  Search
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

const YEAR_OPTIONS = Array.from({ length: 15 }, (_, i) => String(2026 - i))

export default function AsetPage() {
  const supabase = createClient()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [lingkunganId, setLingkunganId] = useState<string | null>(null)
  const [lingkunganName, setLingkunganName] = useState('')

  const [asetList, setAsetList] = useState<Aset[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Form State (Persis Gambar 5)
  const [kategori, setKategori] = useState<string>('Inventaris Liturgi dan Ibadat Sabda')
  const [namaBarang, setNamaBarang] = useState<string>('')
  const [tahunBeli, setTahunBeli] = useState<string>('')
  const [jumlah, setJumlah] = useState<number>(1)
  const [hargaSatuanInput, setHargaSatuanInput] = useState<string>('Rp 0')
  const [hargaSatuanNumeric, setHargaSatuanNumeric] = useState<number>(0)

  const [submitting, setSubmitting] = useState(false)
  const [successToast, setSuccessToast] = useState<string | null>(null)

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

        const effectiveEmail = user?.email || (typeof document !== 'undefined' ? (`; ${document.cookie}`).split('; demo_user_email=').pop()?.split(';').shift() : '') || ''
        const effectiveRole = (typeof document !== 'undefined' ? (`; ${document.cookie}`).split('; demo_user_role=').pop()?.split(';').shift() : '') || ''

        let targetLingkunganId: string | null = null
        let targetLingkunganNama: string | null = null

        if (effectiveRole !== 'PAROKI' && effectiveEmail) {
          const matched = findLingkunganByQuery(effectiveEmail)
          if (matched) {
            targetLingkunganId = matched.id
            targetLingkunganNama = matched.nama_lingkungan
          }
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
    try {
      const { data: items } = await supabase
        .from('aset')
        .select('*')
        .eq('lingkungan_id', lId)
        .order('created_at', { ascending: false })

      if (items) list = items
    } catch (e) {}

    // Merge with localStorage custom assets
    try {
      const raw = localStorage.getItem(`custom_aset_${lId}`)
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
      alert('Nama barang wajib diisi!')
      return
    }

    setSubmitting(true)
    const payload = {
      lingkungan_id: lingkunganId || 'default-lingkungan',
      nama_barang: namaBarang.trim(),
      kategori: kategori,
      tahun_beli: tahunBeli ? parseInt(tahunBeli, 10) : 2026,
      jumlah: jumlah || 1,
      harga_satuan: hargaSatuanNumeric
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
      harga_satuan: payload.harga_satuan
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
    setHargaSatuanNumeric(0)
    setHargaSatuanInput('Rp 0')

    setSuccessToast(`Aset "${newAset.nama_barang}" berhasil ditambahkan ke inventaris!`)
    setTimeout(() => setSuccessToast(null), 3500)
  }

  const handleDeleteAset = async (id: string, nama: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus aset "${nama}"?`)) return

    try {
      await supabase.from('aset').delete().eq('id', id)
    } catch (e) {}

    if (lingkunganId) {
      try {
        const raw = localStorage.getItem(`custom_aset_${lingkunganId}`)
        if (raw) {
          const list = JSON.parse(raw).filter((a: any) => a.id !== id)
          localStorage.setItem(`custom_aset_${lingkunganId}`, JSON.stringify(list))
        }
      } catch (e) {}
    }

    setAsetList(prev => prev.filter(a => a.id !== id))
  }

  const filteredAsetList = asetList.filter((a) => {
    const q = searchQuery.toLowerCase()
    return (
      a.nama_barang.toLowerCase().includes(q) ||
      (a.kategori && a.kategori.toLowerCase().includes(q)) ||
      (a.tahun_beli && String(a.tahun_beli).includes(q))
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#18539E]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Toast Notification */}
      {successToast && (
        <div className="p-4 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 text-sm font-bold flex items-center gap-2 shadow-xs transition-all">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          {successToast}
        </div>
      )}

      {/* TOP 2 SUMMARY METRIC CARDS (Persis Gambar 5) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card 1: Total Item Aset */}
        <div className="bg-[#F0F6FE]/70 border border-[#BAE0FD] rounded-2xl p-5 shadow-2xs">
          <div className="text-xs font-semibold text-slate-600">Total Item Aset</div>
          <div className="text-2xl font-black text-[#18539E] mt-1.5">{totalItemCount}</div>
        </div>

        {/* Card 2: Total Nilai Aset */}
        <div className="bg-[#F0F6FE]/70 border border-[#BAE0FD] rounded-2xl p-5 shadow-2xs">
          <div className="text-xs font-semibold text-slate-600">Total Nilai Aset</div>
          <div className="text-2xl font-black text-[#18539E] mt-1.5">{formatRupiah(totalNilaiAset)}</div>
        </div>
      </div>

      {/* FORM: TAMBAH ASET BARU (Persis Gambar 5) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Header Form */}
        <div className="p-5 pb-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-extrabold text-base shrink-0">
            +
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Tambah Aset Baru</h3>
            <p className="text-xs text-slate-500">Isi data barang inventaris</p>
          </div>
        </div>

        <form onSubmit={handleSaveAset} className="p-5 sm:p-6 space-y-4">
          {/* Field 1: Kategori */}
          <div className="space-y-1.5">
            <Label htmlFor="kategori" className="text-xs font-bold text-slate-700">Kategori</Label>
            <Select value={kategori} onValueChange={(val) => setKategori(val || 'Lainnya')}>
              <SelectTrigger id="kategori" className="bg-white border-slate-300 text-slate-900 rounded-xl h-11 text-sm font-medium">
                <SelectValue placeholder="Pilih Kategori" />
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
              placeholder="Contoh: Sound System Portable"
              required
              className="bg-white border-slate-300 text-slate-900 rounded-xl h-11 text-sm focus:ring-blue-500"
            />
          </div>

          {/* Row 3: Tahun Pembelian & Jumlah (Unit) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>

          {/* Field 4: Harga Satuan (Rp) */}
          <div className="space-y-1.5">
            <Label htmlFor="hargaSatuan" className="text-xs font-bold text-slate-700">Harga Satuan (Rp)</Label>
            <Input
              id="hargaSatuan"
              value={hargaSatuanInput}
              onChange={handleHargaChange}
              className="bg-white border-slate-300 text-slate-900 font-bold rounded-xl h-11 text-sm"
            />
          </div>

          {/* Tombol Simpan Aset (Di Pojok Kanan) */}
          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#A9834F] hover:bg-[#967443] text-white font-bold h-11 px-6 rounded-xl text-sm shadow-xs cursor-pointer flex items-center justify-center gap-2 transition-all"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Aset'}
            </Button>
          </div>
        </form>
      </div>

      {/* BOX DAFTAR ASET YANG TELAH DITAMBAHKAN (List Daftar Aset) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden space-y-4 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
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
              placeholder="Cari aset..."
              className="pl-9 bg-slate-50 border-slate-200 text-xs rounded-xl h-9 text-slate-900"
            />
          </div>
        </div>

        {/* Tabel Aset */}
        <div className="border border-slate-200 rounded-xl overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 text-xs font-bold text-slate-700 border-b border-slate-200">
              <TableRow>
                <TableHead className="w-12 text-center font-bold text-slate-800">No</TableHead>
                <TableHead className="font-bold text-slate-800">Nama Barang</TableHead>
                <TableHead className="font-bold text-slate-800">Kategori</TableHead>
                <TableHead className="w-20 text-center font-bold text-slate-800">Tahun</TableHead>
                <TableHead className="w-20 text-center font-bold text-slate-800">Jumlah</TableHead>
                <TableHead className="w-28 text-right font-bold text-slate-800">Harga (Rp)</TableHead>
                <TableHead className="w-32 text-right font-bold text-slate-800">Total Nilai</TableHead>
                <TableHead className="w-16 text-center font-bold text-slate-800">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 text-xs">
              {filteredAsetList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-slate-400">
                    Belum ada barang inventaris aset yang ditambahkan.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAsetList.map((item, idx) => {
                  const qty = Number(item.jumlah) || 1
                  const price = Number(item.harga_satuan) || 0
                  const total = qty * price
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
                      <TableCell className="text-right font-mono text-slate-700">
                        {price > 0 ? price.toLocaleString('id-ID') : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-slate-900">
                        {total > 0 ? total.toLocaleString('id-ID') : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteAset(item.id, item.nama_barang)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Hapus aset"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
