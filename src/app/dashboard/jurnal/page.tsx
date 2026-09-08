'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { UserProfile, JurnalTransaksi, KepalaKeluarga, COA } from '@/lib/types'
import { ensureDummyKksForLingkungan } from '@/lib/dummyData'
import { TRANSACTION_TYPES, getDoubleEntryMapping } from '@/lib/doubleEntryRules'
import { formatRupiah, formatDateIndo, MONTH_NAMES } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Lock, Unlock, TrendingUp, TrendingDown, Receipt, Trash2, CheckCircle2, AlertCircle } from 'lucide-react'

export default function JurnalPage() {
  const supabase = createClient()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [lingkunganId, setLingkunganId] = useState<string | null>(null)
  const [lingkunganName, setLingkunganName] = useState('')

  const [kkList, setKkList] = useState<KepalaKeluarga[]>([])
  const [coaList, setCoaList] = useState<COA[]>([])
  const [jurnalList, setJurnalList] = useState<JurnalTransaksi[]>([])

  // Filter State
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear())

  // Modal Input Form State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [tipeArus, setTipeArus] = useState<'MASUK' | 'KELUAR'>('MASUK')
  const [jenisCode, setJenisCode] = useState<string>('4100')
  const [coaDebit, setCoaDebit] = useState<string>('1100')
  const [coaKredit, setCoaKredit] = useState<string>('4100')
  const [kkId, setKkId] = useState<string>('')
  const [tanggal, setTanggal] = useState<string>(new Date().toISOString().split('T')[0])
  const [nominal, setNominal] = useState<number>(0)
  const [keterangan, setKeterangan] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  // Posting State
  const [postingLoading, setPostingLoading] = useState(false)

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

        let targetLingkunganId = localStorage.getItem('selected_lingkungan_id')
        if (!targetLingkunganId) {
          const { data: lData } = await supabase.from('lingkungan').select('id, nama_lingkungan').limit(1).maybeSingle()
          if (lData) {
            targetLingkunganId = lData.id
            setLingkunganName(lData.nama_lingkungan)
          }
        } else {
          const { data: lData } = await supabase.from('lingkungan').select('nama_lingkungan').eq('id', targetLingkunganId).maybeSingle()
          if (lData) setLingkunganName(lData.nama_lingkungan)
        }

        setLingkunganId(targetLingkunganId)

        // Fetch COA
        const { data: coas } = await supabase.from('coa').select('*').order('id', { ascending: true })
        if (coas) setCoaList(coas)

        if (targetLingkunganId) {
          // Fetch KK List with DB + localStorage + Dummy fallback
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

          const finalKks = ensureDummyKksForLingkungan(targetLingkunganId, lingkunganName || 'Lingkungan', dbKks)
          setKkList(finalKks)

          // Fetch Journals for environment
          await fetchJournals(targetLingkunganId)
        }
      } catch (err) {
        console.error('Error loading jurnal data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()

    const handleSync = () => {
      loadData()
    }
    window.addEventListener('dafuDataUpdated', handleSync)
    window.addEventListener('storage', handleSync)
    window.addEventListener('lingkunganChanged', handleSync)

    return () => {
      window.removeEventListener('dafuDataUpdated', handleSync)
      window.removeEventListener('storage', handleSync)
      window.removeEventListener('lingkunganChanged', handleSync)
    }
  }, [supabase])

  const fetchJournals = async (lId: string) => {
    const { data: journals } = await supabase
      .from('jurnal_transaksi')
      .select('*, kepala_keluarga:kk_id(nama_kk)')
      .eq('lingkungan_id', lId)
      .order('tanggal', { ascending: false })

    if (journals) setJurnalList(journals)
  }

  const isBendahara = userProfile?.role === 'BENDAHARA'

  // Update double entry mapping when Tipe Arus or Jenis changes
  const handleArusChange = (arus: 'MASUK' | 'KELUAR') => {
    setTipeArus(arus)
    const firstOption = TRANSACTION_TYPES.find(t => t.category === arus)
    if (firstOption) {
      setJenisCode(firstOption.code)
      setCoaDebit(firstOption.defaultCoaDebit)
      setCoaKredit(firstOption.defaultCoaKredit)
    }
  }

  const handleJenisChange = (code: string) => {
    setJenisCode(code)
    const mapping = getDoubleEntryMapping(code, tipeArus)
    setCoaDebit(mapping.coaDebit)
    setCoaKredit(mapping.coaKredit)
  }

  const openNewJournalModal = () => {
    setTipeArus('MASUK')
    handleJenisChange('4100')
    setKkId('')
    setTanggal(new Date().toISOString().split('T')[0])
    setNominal(0)
    setKeterangan('')
    setIsModalOpen(true)
  }

  const handleSaveJournal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lingkunganId || nominal <= 0) {
      alert('Masukkan nominal transaksi yang valid (> 0).')
      return
    }

    setSubmitting(true)
    const payload = {
      lingkungan_id: lingkunganId,
      kk_id: kkId || null,
      tanggal,
      tipe_arus: tipeArus,
      coa_debit: coaDebit,
      coa_kredit: coaKredit,
      nominal,
      keterangan: keterangan.trim() || null,
      is_posted: false,
    }

    const { data: createdData, error } = await supabase.from('jurnal_transaksi').insert(payload).select('*, kepala_keluarga:kk_id(nama_kk)').single()
    setSubmitting(false)

    if (error) {
      console.warn('Supabase RLS/DB info:', error.message)
      const newTx: JurnalTransaksi = {
        id: 'jurnal-' + Date.now(),
        lingkungan_id: payload.lingkungan_id,
        kk_id: payload.kk_id,
        tanggal: payload.tanggal,
        tipe_arus: payload.tipe_arus,
        coa_debit: payload.coa_debit,
        coa_kredit: payload.coa_kredit,
        nominal: payload.nominal,
        keterangan: payload.keterangan,
        is_posted: false,
        kepala_keluarga: kkId ? { id: kkId, lingkungan_id: payload.lingkungan_id, nama_kk: kkList.find(k => k.id === kkId)?.nama_kk || '', alamat: null, is_biduk: false } : undefined,
      }
      setJurnalList(prev => [newTx, ...prev])
    } else if (createdData) {
      setJurnalList(prev => [createdData, ...prev])
    }
    setIsModalOpen(false)
  }

  const handleDeleteJournal = async (id: string, isPosted: boolean) => {
    if (isPosted) {
      alert('Transaksi ini sudah dikunci (Posted) dan tidak dapat dihapus!')
      return
    }

    if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) return

    const { error } = await supabase.from('jurnal_transaksi').delete().eq('id', id)
    if (error) {
      alert('Gagal menghapus transaksi: ' + error.message)
    } else {
      setJurnalList(prev => prev.filter(j => j.id !== id))
    }
  }

  // Filter journals by selected month and year
  const filteredJournals = jurnalList.filter((j) => {
    const d = new Date(j.tanggal)
    return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear
  })

  // Check if current filtered month is posted
  const isMonthPosted = filteredJournals.length > 0 && filteredJournals.every(j => j.is_posted)

  // Handle Posting (Kunci Bulan)
  const handleLockMonth = async () => {
    if (!lingkunganId || filteredJournals.length === 0) return

    if (!confirm(`Kunci semua ${filteredJournals.length} transaksi di bulan ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}? Transaksi yang dikunci tidak akan bisa diubah atau dihapus lagi.`)) {
      return
    }

    setPostingLoading(true)
    const idsToLock = filteredJournals.map(j => j.id)

    const { error } = await supabase
      .from('jurnal_transaksi')
      .update({ is_posted: true })
      .in('id', idsToLock)

    setPostingLoading(false)

    if (error) {
      alert('Gagal mengunci transaksi: ' + error.message)
    } else {
      alert(`Berhasil mengunci bulan ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}!`)
      if (lingkunganId) fetchJournals(lingkunganId)
    }
  }

  // Totals for filtered month
  const monthKasMasuk = filteredJournals.filter(j => j.tipe_arus === 'MASUK').reduce((a, b) => a + Number(b.nominal), 0)
  const monthKasKeluar = filteredJournals.filter(j => j.tipe_arus === 'KELUAR').reduce((a, b) => a + Number(b.nominal), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2130] tracking-tight font-serif">Jurnal Transaksi Kas Lingkungan</h1>

          <p className="text-sm text-[#5C6478] mt-1">
            Pencatatan kas masuk & kas keluar harian Lingkungan <span className="text-[#A9834F] font-semibold">{lingkunganName}</span>.
          </p>
        </div>

        {isBendahara && (
          <Button onClick={openNewJournalModal} className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs cursor-pointer">
            <Plus className="w-4 h-4 mr-2 text-emerald-400" />
            Input Jurnal Transaksi
          </Button>
        )}
      </div>

      {/* Filter & Posting Toolbar Card */}
      <Card className="bg-white border-slate-200 rounded-2xl shadow-xs">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-40">
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Bulan Transaksi</Label>
              <Select value={selectedMonth.toString()} onValueChange={(v) => v && setSelectedMonth(parseInt(v))}>
                <SelectTrigger className="h-9 bg-white border-slate-300 text-slate-900 rounded-xl focus:ring-emerald-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900">
                  {MONTH_NAMES.map((m, idx) => (
                    <SelectItem key={idx} value={(idx + 1).toString()}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-28">
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Tahun</Label>
              <Select value={selectedYear.toString()} onValueChange={(v) => v && setSelectedYear(parseInt(v))}>
                <SelectTrigger className="h-9 bg-white border-slate-300 text-slate-900 rounded-xl focus:ring-emerald-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900">
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-5 flex items-center gap-3 text-xs font-bold">
              <span className="text-emerald-900 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                Masuk: {formatRupiah(monthKasMasuk)}
              </span>
              <span className="text-rose-900 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
                Keluar: {formatRupiah(monthKasKeluar)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isMonthPosted ? (
              <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-xl border border-amber-200">
                <Lock className="w-4 h-4 text-amber-600" />
                Bulan Ini Dikunci (Posted)
              </span>
            ) : (
              isBendahara && (
                <Button
                  onClick={handleLockMonth}
                  disabled={postingLoading || filteredJournals.length === 0}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 mr-1.5" />
                  {postingLoading ? 'Mengunci...' : 'Kunci Bulan (Posting)'}
                </Button>
              )
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table Card */}
      <Card className="bg-white border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-800">
              Jurnal {MONTH_NAMES[selectedMonth - 1]} {selectedYear} ({filteredJournals.length} Transaksi)
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <TableRow>
                <TableHead className="w-28 text-slate-700 font-bold">Tanggal</TableHead>
                <TableHead className="w-24 text-slate-700 font-bold">Arus</TableHead>
                <TableHead className="text-slate-800 font-bold">Keterangan & Penyetor</TableHead>
                <TableHead className="w-32 text-center text-slate-800 font-bold">Debet (COA)</TableHead>
                <TableHead className="w-32 text-center text-slate-800 font-bold">Kredit (COA)</TableHead>
                <TableHead className="text-right text-slate-800 font-bold">Nominal (Rp)</TableHead>
                <TableHead className="w-20 text-center text-slate-800 font-bold">Status</TableHead>
                {isBendahara && <TableHead className="w-16 text-right text-slate-800 font-bold">Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100">
              {filteredJournals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isBendahara ? 8 : 7} className="text-center py-8 text-slate-400">
                    Tidak ada transaksi jurnal recorded untuk bulan {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.
                  </TableCell>
                </TableRow>
              ) : (
                filteredJournals.map((j) => (
                  <TableRow key={j.id} className="hover:bg-slate-50 transition">
                    <TableCell className="font-mono text-xs font-semibold text-slate-600">
                      {formatDateIndo(j.tanggal)}
                    </TableCell>
                    <TableCell>
                      {j.tipe_arus === 'MASUK' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <TrendingUp className="w-3 h-3" /> MASUK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-full">
                          <TrendingDown className="w-3 h-3" /> KELUAR
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-slate-900 text-sm">{j.keterangan || '-'}</p>
                      {j.kepala_keluarga?.nama_kk && (
                        <p className="text-xs text-slate-500 mt-0.5">Penyetor: {j.kepala_keluarga.nama_kk}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 rounded">
                      {j.coa_debit}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded">
                      {j.coa_kredit}
                    </TableCell>
                    <TableCell
                      className={`text-right font-extrabold font-mono text-sm ${
                        j.tipe_arus === 'MASUK' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {j.tipe_arus === 'MASUK' ? '+' : '-'} {formatRupiah(Number(j.nominal))}
                    </TableCell>
                    <TableCell className="text-center">
                      {j.is_posted ? (
                        <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 font-bold px-2 py-0.5 rounded">
                          POSTED
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 font-medium px-2 py-0.5 rounded">
                          DRAFT
                        </span>
                      )}
                    </TableCell>
                    {isBendahara && (
                      <TableCell className="text-right">
                        {!j.is_posted && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteJournal(j.id, j.is_posted)}
                            className="h-7 w-7 p-0 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Input Journal Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg bg-white border-slate-200 text-slate-900 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-slate-800 font-bold flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600" /> Input Transaksi Jurnal Baru
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveJournal} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">1. Tipe Arus Kas *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={tipeArus === 'MASUK' ? 'default' : 'outline'}
                    onClick={() => handleArusChange('MASUK')}
                    className={tipeArus === 'MASUK' ? 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl' : 'border-slate-300 text-slate-700 rounded-xl'}
                  >
                    Kas Masuk
                  </Button>
                  <Button
                    type="button"
                    variant={tipeArus === 'KELUAR' ? 'default' : 'outline'}
                    onClick={() => handleArusChange('KELUAR')}
                    className={tipeArus === 'KELUAR' ? 'bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl' : 'border-slate-300 text-slate-700 rounded-xl'}
                  >
                    Kas Keluar
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tanggal" className="text-xs font-semibold text-slate-700">Tanggal Transaksi *</Label>
                <Input
                  id="tanggal"
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  required
                  className="bg-white border-slate-300 text-slate-900 rounded-xl focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="jenis" className="text-xs font-semibold text-slate-700">2. Jenis Transaksi (Auto-COA) *</Label>
              <Select value={jenisCode} onValueChange={(val) => val && handleJenisChange(val)}>
                <SelectTrigger id="jenis" className="bg-white border-slate-300 text-slate-900 rounded-xl focus:ring-emerald-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto bg-white border-slate-200 text-slate-900">
                  {TRANSACTION_TYPES.filter(t => t.category === tipeArus).map((t) => (
                    <SelectItem key={t.code} value={t.code}>
                      [{t.code}] {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Double Entry Automatic Mapping Display */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block">Akun DEBIT:</span>
                <span className="font-mono font-bold text-blue-700">
                  [{coaDebit}] {coaList.find(c => c.id === coaDebit)?.nama_akun || ''}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Akun KREDIT:</span>
                <span className="font-mono font-bold text-emerald-700">
                  [{coaKredit}] {coaList.find(c => c.id === coaKredit)?.nama_akun || ''}
                </span>
              </div>
            </div>

            {tipeArus === 'MASUK' && (
              <div className="space-y-1.5">
                <Label htmlFor="kk_id" className="text-xs font-semibold text-slate-700">Kepala Keluarga / Penyetor (Opsional)</Label>
                <Select value={kkId} onValueChange={(val) => setKkId(val || '')}>
                  <SelectTrigger id="kk_id" className="bg-white border-slate-300 text-slate-900 rounded-xl focus:ring-emerald-500">
                    <SelectValue placeholder="-- Pilih Kepala Keluarga --" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56 overflow-y-auto bg-white border-slate-200 text-slate-900">
                    {kkList.map((kk) => (
                      <SelectItem key={kk.id} value={kk.id}>{kk.nama_kk}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="nominal" className="text-xs font-semibold text-slate-700">Nominal Transaksi (Rp) *</Label>
              <Input
                id="nominal"
                type="number"
                value={nominal || ''}
                onChange={(e) => setNominal(Number(e.target.value))}
                placeholder="0"
                required
                className="bg-white border-slate-300 text-slate-900 rounded-xl focus:ring-emerald-500 font-mono text-base font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="keterangan" className="text-xs font-semibold text-slate-700">Keterangan / Uraian (Opsional)</Label>
              <Input
                id="keterangan"
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Contoh: Kolekte Misa Lingkungan Minggu I"
                className="bg-white border-slate-300 text-slate-900 rounded-xl focus:ring-emerald-500"
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl">
                Batal
              </Button>
              <Button type="submit" disabled={submitting} className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl cursor-pointer">
                {submitting ? 'Menyimpan...' : 'Simpan Transaksi'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

