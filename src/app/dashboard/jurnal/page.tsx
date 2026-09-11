'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { UserProfile, JurnalTransaksi, KepalaKeluarga, COA } from '@/lib/types'
import { ensureDummyKksForLingkungan } from '@/lib/dummyData'
import { getAllMasterCOA, MasterCOAItem } from '@/lib/masterCoa'
import { formatRupiah, formatDateIndo, MONTH_NAMES } from '@/lib/utils'
import { formatNamaLingkungan, getAllMasterLingkungan, findLingkunganByQuery } from '@/lib/constants'
import { getPengurusForLingkungan, PengurusLingkungan } from '@/lib/pengurusData'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  Plus,
  Lock,
  Unlock,
  Trash2,
  CheckCircle2,
  FileSpreadsheet,
  BookOpen,
  Calendar,
  AlertCircle,
  HelpCircle,
  ChevronRight
} from 'lucide-react'

// Standard options from Image 5 for Uang Masuk
const PENERIMAAN_OPTIONS = [
  { code: '4100', name: 'Iuran Kas Lingkungan' },
  { code: '4110', name: 'Kolekte Ibadat Sabda' },
  { code: '4120', name: 'Sumbangan Dahar Romo' },
  { code: '4200', name: 'Sumbangan ASAK' },
  { code: '4300', name: 'Iuran Dana Kematian/St. Yusuf' },
  { code: '4400', name: 'Kolekte Misa Lingkungan' },
  { code: '4500', name: 'Sumbangan Umat' },
  { code: '4600', name: 'Bantuan dari Paroki' },
  { code: '4700', name: 'Dana APP' },
  { code: '4800', name: 'Dana Aksi Natal' },
  { code: '4900', name: 'Penerimaan Lainnya' }
]

// Standard options from MASTER LAP for Uang Keluar
const PENGELUARAN_OPTIONS = [
  { code: '5100', name: 'Misa' },
  { code: '5110', name: 'Ibadat Sabda' },
  { code: '5120', name: 'Rosario' },
  { code: '5130', name: 'Koor' },
  { code: '5140', name: 'Stipendium/ Iura stolae' },
  { code: '5150', name: 'Bina iman' },
  { code: '5160', name: 'Pendalaman kitab suci' },
  { code: '5170', name: 'Kepemudaan' },
  { code: '5180', name: 'Kerasulan keluarga' },
  { code: '5190', name: 'Pendidikan calon imam' },
  { code: '5200', name: 'Rapat / pertemuan lingkungan' },
  { code: '5210', name: 'Perayaan (Natal / Paskah / HUT)' },
  { code: '5220', name: 'Inventaris (Pembelian / Pemeliharaan)' },
  { code: '5230', name: 'Administrasi' },
  { code: '5240', name: 'Kegiatan rohani lain (retret, rekoleksi, dsb)' },
  { code: '5250', name: 'Bantuan Sosial Internal (umat lingkungan)' },
  { code: '5260', name: 'Bantuan Sosial Eksternal (umat luar lingkungan)' },
  { code: '5270', name: 'Pastoran (dahar Romo)' },
  { code: '5280', name: 'Sumbangan kematian/St. Yusuf' },
  { code: '5290', name: 'Sumbangan Dana ASAK' },
  { code: '5300', name: 'Sumbangan Dana Pastoran' },
  { code: '5310', name: 'Sumbangan Dana APP' },
  { code: '5320', name: 'Sumbangan Dana Aksi Natal' },
  { code: '5340', name: 'Sumbangan Dana PPG' },
  { code: '5350', name: 'Pengeluaran lainnya' }
]

export default function JurnalPage() {
  const supabase = createClient()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [lingkunganId, setLingkunganId] = useState<string | null>(null)
  const [lingkunganName, setLingkunganName] = useState('')
  const [pengurus, setPengurus] = useState<PengurusLingkungan | null>(null)

  const [kkList, setKkList] = useState<KepalaKeluarga[]>([])
  const [coaList, setCoaList] = useState<MasterCOAItem[]>([])
  const [jurnalList, setJurnalList] = useState<JurnalTransaksi[]>([])
  const [saldoAwalBank, setSaldoAwalBank] = useState<number>(0)

  // Filter State: Month & Year (Default to September 2026 as per design mockup)
  const [selectedMonth, setSelectedMonth] = useState<number>(9)
  const [selectedYear, setSelectedYear] = useState<number>(2026)
  const [filterArusView, setFilterArusView] = useState<'ALL' | 'MASUK' | 'KELUAR'>('ALL')

  // Sequential Step-by-Step Form State
  // Step 1: Uang Masuk / Uang Keluar
  const [step1Arus, setStep1Arus] = useState<'MASUK' | 'KELUAR' | null>(null)

  // Step 2: Jenis Transaksi
  const [step2Jenis, setStep2Jenis] = useState<string>('')
  const [step2ManualJenis, setStep2ManualJenis] = useState<string>('')

  // Step 3: KK
  const [step3KkId, setStep3KkId] = useState<string>('')

  // Step 4: Tanggal & Jumlah
  const [step4Tanggal, setStep4Tanggal] = useState<string>('2026-09-01')
  const [step4NominalNumeric, setStep4NominalNumeric] = useState<number>(0)
  const [step4NominalInput, setStep4NominalInput] = useState<string>('Rp 0')

  // Step 5: Keterangan
  const [step5Keterangan, setStep5Keterangan] = useState<string>('')

  const [submitting, setSubmitting] = useState(false)
  const [successToast, setSuccessToast] = useState<string | null>(null)

  // Double Entry Modal & Posting Modal
  const [isDeModalOpen, setIsDeModalOpen] = useState(false)
  const [postingLoading, setPostingLoading] = useState(false)

  // Currency Formatter
  const formatCurrency = (val: number): string => {
    if (!val || isNaN(val)) return 'Rp 0'
    return 'Rp ' + val.toLocaleString('id-ID')
  }

  const handleNominalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    const num = parseInt(raw, 10) || 0
    setStep4NominalNumeric(num)
    setStep4NominalInput(formatCurrency(num))
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

        // Load COA
        const allCoas = getAllMasterCOA()
        setCoaList(allCoas)

        if (targetLingkunganId) {
          // Fetch KK list from DB + localStorage (which Sekretaris edits)
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

          const finalKks = ensureDummyKksForLingkungan(targetLingkunganId, targetLingkunganNama || 'Lingkungan', dbKks)
          setKkList(finalKks)

          // Load Profil for Saldo Awal and Officers
          const { data: profil } = await supabase
            .from('profil_lingkungan')
            .select('*')
            .eq('lingkungan_id', targetLingkunganId)
            .maybeSingle()

          let sa = Number(profil?.saldo_awal || 0)
          if (sa === 0) {
            const savedManual = localStorage.getItem(`profil_manual_${targetLingkunganId}`)
            if (savedManual) {
              try {
                const parsed = JSON.parse(savedManual)
                if (parsed.saldoAwal) sa = Number(parsed.saldoAwal)
              } catch (e) {}
            }
          }
          setSaldoAwalBank(sa)

          const pengurusInfo = getPengurusForLingkungan(targetLingkunganId, targetLingkunganNama, profil)
          setPengurus(pengurusInfo)

          // Load Journals
          await fetchJournals(targetLingkunganId)
        }
      } catch (err) {
        console.error('Error loading journal:', err)
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
    window.addEventListener('coaDataUpdated', handleSync)

    return () => {
      window.removeEventListener('dafuDataUpdated', handleSync)
      window.removeEventListener('storage', handleSync)
      window.removeEventListener('lingkunganChanged', handleSync)
      window.removeEventListener('coaDataUpdated', handleSync)
    }
  }, [supabase])

  const fetchJournals = async (lId: string) => {
    let list: JurnalTransaksi[] = []
    try {
      const { data: journals } = await supabase
        .from('jurnal_transaksi')
        .select('*, kepala_keluarga:kk_id(nama_kk)')
        .eq('lingkungan_id', lId)
        .order('tanggal', { ascending: false })

      if (journals) list = journals
    } catch (e) {}

    // Merge with localStorage custom journals
    try {
      const raw = localStorage.getItem(`custom_journals_${lId}`)
      if (raw) {
        const localList: JurnalTransaksi[] = JSON.parse(raw)
        const map = new Map<string, JurnalTransaksi>()
        list.forEach(j => map.set(j.id, j))
        localList.forEach(j => map.set(j.id, j))
        list = Array.from(map.values()).sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())
      }
    } catch (e) {}

    setJurnalList(list)
  }

  // Filter journals by selected month and year
  const filteredJournals = jurnalList.filter((j) => {
    const d = new Date(j.tanggal)
    return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear
  })

  // Calculate Metrics for selected month
  let totalBulanMasuk = 0
  let totalBulanKeluar = 0
  filteredJournals.forEach((j) => {
    const nom = Number(j.nominal) || 0
    if (j.tipe_arus === 'MASUK') totalBulanMasuk += nom
    else totalBulanKeluar += nom
  })
  const saldoBulanAkhir = saldoAwalBank + totalBulanMasuk - totalBulanKeluar

  // Check if current month is posted
  const isMonthPosted = filteredJournals.length > 0 && filteredJournals.every(j => j.is_posted)

  // Current COA code and description mapping
  const resolveCoaDetails = (code: string) => {
    const found = coaList.find(c => c.id === code)
    if (found) return found
    const allP = [...PENERIMAAN_OPTIONS, ...PENGELUARAN_OPTIONS]
    const fallback = allP.find(p => p.code === code)
    return {
      id: code,
      nama_akun: fallback?.name || (code === '1100' ? 'Bank' : 'Akun Transaksi'),
      tipe: (code.startsWith('4') ? 'KREDIT' : 'DEBIT') as 'DEBIT' | 'KREDIT'
    }
  }

  // Double entry accounting accounts for current selection
  const currentDebitAccount = step1Arus === 'MASUK' ? '1100' : (step2Jenis || '5100')
  const currentKreditAccount = step1Arus === 'MASUK' ? (step2Jenis || '4100') : '1100'

  const currentDebitName = step1Arus === 'MASUK' ? 'Bank' : (step2Jenis === '5350' && step2ManualJenis ? step2ManualJenis : resolveCoaDetails(step2Jenis).nama_akun)
  const currentKreditName = step1Arus === 'MASUK' ? (step2Jenis === '4900' && step2ManualJenis ? step2ManualJenis : resolveCoaDetails(step2Jenis).nama_akun) : 'Bank'

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!step1Arus) {
      alert('Pilih Uang Masuk atau Uang Keluar pada Langkah 1.')
      return
    }
    if (!step2Jenis) {
      alert('Pilih jenis transaksi pada Langkah 2.')
      return
    }
    if (step4NominalNumeric <= 0) {
      alert('Masukkan jumlah uang yang valid (> 0) pada Langkah 4.')
      return
    }

    setSubmitting(true)
    const coaDebit = currentDebitAccount
    const coaKredit = currentKreditAccount

    const kkObj = kkList.find(k => k.id === step3KkId)
    const displayKet = step5Keterangan.trim() || (step2ManualJenis ? step2ManualJenis : resolveCoaDetails(step2Jenis).nama_akun)

    const payload = {
      lingkungan_id: lingkunganId || 'default-lingkungan',
      kk_id: (step3KkId && step3KkId !== 'umum') ? step3KkId : null,
      tanggal: step4Tanggal,
      tipe_arus: step1Arus,
      coa_debit: coaDebit,
      coa_kredit: coaKredit,
      nominal: step4NominalNumeric,
      keterangan: displayKet,
      is_posted: false
    }

    let createdId = 'jurnal-' + Date.now()
    try {
      const { data: createdData } = await supabase
        .from('jurnal_transaksi')
        .insert(payload)
        .select('*, kepala_keluarga:kk_id(nama_kk)')
        .single()

      if (createdData?.id) createdId = createdData.id
    } catch (e) {}

    const newTx: JurnalTransaksi = {
      id: createdId,
      lingkungan_id: payload.lingkungan_id,
      kk_id: payload.kk_id,
      tanggal: payload.tanggal,
      tipe_arus: payload.tipe_arus,
      coa_debit: payload.coa_debit,
      coa_kredit: payload.coa_kredit,
      nominal: payload.nominal,
      keterangan: payload.keterangan,
      is_posted: false,
      kepala_keluarga: kkObj ? { id: kkObj.id, lingkungan_id: payload.lingkungan_id, nama_kk: kkObj.nama_kk, alamat: kkObj.alamat, is_biduk: kkObj.is_biduk } : undefined
    }

    // Save to local storage cache for immediate persistence
    if (lingkunganId) {
      try {
        const existing = localStorage.getItem(`custom_journals_${lingkunganId}`)
        const list = existing ? JSON.parse(existing) : []
        list.unshift(newTx)
        localStorage.setItem(`custom_journals_${lingkunganId}`, JSON.stringify(list))
        window.dispatchEvent(new Event('storage'))
      } catch (e) {}
    }

    setJurnalList(prev => [newTx, ...prev])
    setSubmitting(false)

    // Reset Form for next transaction
    setStep1Arus(null)
    setStep2Jenis('')
    setStep2ManualJenis('')
    setStep3KkId('')
    setStep4NominalNumeric(0)
    setStep4NominalInput('Rp 0')
    setStep5Keterangan('')

    setSuccessToast('Transaksi kas berhasil dicatat dan masuk ke jurnal!')
    setTimeout(() => setSuccessToast(null), 3500)
  }

  const handleDeleteTransaction = async (id: string, isPosted: boolean) => {
    if (isPosted) {
      alert('Transaksi ini sudah dikunci (Posted) dan tidak dapat dihapus!')
      return
    }

    if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini dari jurnal?')) return

    try {
      await supabase.from('jurnal_transaksi').delete().eq('id', id)
    } catch (e) {}

    if (lingkunganId) {
      try {
        const raw = localStorage.getItem(`custom_journals_${lingkunganId}`)
        if (raw) {
          const list = JSON.parse(raw).filter((j: any) => j.id !== id)
          localStorage.setItem(`custom_journals_${lingkunganId}`, JSON.stringify(list))
        }
      } catch (e) {}
    }

    setJurnalList(prev => prev.filter(j => j.id !== id))
  }

  // Export transactions to Excel (CSV)
  const handleExportExcel = () => {
    if (filteredJournals.length === 0) {
      alert('Tidak ada transaksi di bulan ini untuk diekspor.')
      return
    }

    const headers = ['No', 'Tanggal', 'Tipe Arus', 'Jenis Transaksi', 'Keterangan', 'Nama KK / Umat', 'Akun Debit', 'Akun Kredit', 'Nominal (Rp)', 'Status']
    const rows = filteredJournals.map((j, idx) => [
      idx + 1,
      j.tanggal,
      j.tipe_arus,
      j.keterangan || (j.tipe_arus === 'MASUK' ? 'Penerimaan' : 'Pengeluaran'),
      `"${(j.keterangan || '').replace(/"/g, '""')}"`,
      `"${(j.kepala_keluarga?.nama_kk || 'Umum / Kolektif').replace(/"/g, '""')}"`,
      j.coa_debit,
      j.coa_kredit,
      j.nominal,
      j.is_posted ? 'POSTED' : 'DRAFT'
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Jurnal_${formatNamaLingkungan(lingkunganName || 'Lingkungan').replace(/\s+/g, '_')}_${MONTH_NAMES[selectedMonth - 1]}_${selectedYear}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Filtered transactions for the table list
  const displayedTableJournals = filteredJournals.filter(j => {
    if (filterArusView === 'ALL') return true
    return j.tipe_arus === filterArusView
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Toast Notification */}
      {successToast && (
        <div className="p-4 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 text-sm font-bold flex items-center gap-2 shadow-xs transition-all">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          {successToast}
        </div>
      )}

      {/* 4 SUMMARY METRIC BOXES (Estetik & Bersih Tanpa Warna Neon) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Box 1: Saldo Awal (A) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Saldo Awal (A)</div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{formatRupiah(saldoAwalBank)}</div>
        </div>

        {/* Box 2: Total Uang Masuk (B) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Total Uang Masuk (B)</div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{formatRupiah(totalBulanMasuk)}</div>
        </div>

        {/* Box 3: Total Uang Keluar (C) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Total Uang Keluar (C)</div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{formatRupiah(totalBulanKeluar)}</div>
        </div>

        {/* Box 4: Saldo Akhir (A+B-C) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Saldo Akhir (A+B-C)</div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{formatRupiah(saldoBulanAkhir)}</div>
        </div>
      </div>

      {/* SELECT MONTH BAR & ACTION BUTTONS (Persis Gambar 2) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1 flex-1 max-w-sm">
            <Label className="text-xs font-bold text-slate-700">Pilih Bulan Transaksi</Label>
            <Select
              value={String(selectedMonth)}
              onValueChange={(val) => setSelectedMonth(parseInt(val || '9', 10))}
            >
              <SelectTrigger className="bg-white border-slate-300 text-slate-900 font-bold rounded-xl h-11 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 text-slate-900">
                {MONTH_NAMES.map((m, idx) => (
                  <SelectItem key={idx + 1} value={String(idx + 1)}>
                    {m} {selectedYear}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 pt-2 sm:pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeModalOpen(true)}
              className="border-slate-300 text-slate-700 hover:bg-slate-100 font-bold rounded-xl h-11 px-4 text-xs cursor-pointer shadow-2xs"
            >
              Jurnal DE
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleExportExcel}
              className="border-slate-300 text-slate-700 hover:bg-slate-100 font-bold rounded-xl h-11 px-4 text-xs cursor-pointer shadow-2xs"
            >
              Excel
            </Button>
          </div>
        </div>

        {/* Status Badge */}
        <div className="pt-1 flex items-center gap-2">
          {isMonthPosted ? (
            <span className="inline-flex items-center gap-1.5 text-xs bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 rounded-full font-bold">
              <Lock className="w-3.5 h-3.5 text-amber-700" />
              POSTED — Bulan ini telah dikunci
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs bg-[#EAF7EE] text-[#137333] border border-[#B7E4C7] px-3.5 py-1 rounded-full font-medium">
              <span className="font-extrabold text-[#0D6539]">DRAFT</span> Transaksi masih bisa ditambah/dihapus
            </span>
          )}
        </div>
      </div>

      {/* FORM: CATAT TRANSAKSI BARU (Persis Gambar 2, 3, 4) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-5 pb-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#F0F5FD] text-[#18539E] flex items-center justify-center font-extrabold text-base shrink-0">
            +
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Catat Transaksi Baru</h3>
            <p className="text-xs text-slate-500">Ikuti langkah secara berurutan</p>
          </div>
        </div>

        <form onSubmit={handleSaveTransaction} className="p-5 sm:p-6 space-y-6">
          {/* LANGKAH 1 - Uang masuk atau keluar? */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-[#18539E]">
              LANGKAH 1 - Uang masuk atau keluar?
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep1Arus('MASUK')
                  setStep2Jenis('')
                  setStep2ManualJenis('')
                }}
                className={`py-3.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center cursor-pointer ${
                  step1Arus === 'MASUK'
                    ? 'border-2 border-[#137333] bg-[#EAF7EE] text-[#0D6539] shadow-2xs'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Uang Masuk
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep1Arus('KELUAR')
                  setStep2Jenis('')
                  setStep2ManualJenis('')
                }}
                className={`py-3.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center cursor-pointer ${
                  step1Arus === 'KELUAR'
                    ? 'border-2 border-[#C5221F] bg-[#FDF0ED] text-[#A51D24] shadow-2xs'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Uang Keluar
              </button>
            </div>
          </div>

          {/* LANGKAH 2 - Jenis transaksi apa? (Muncul setelah Langkah 1 dipilih, Persis Gambar 3 & 5) */}
          {step1Arus && (
            <div className="space-y-2 animate-fadeIn">
              <div className="text-xs font-bold text-[#18539E]">
                LANGKAH 2 - Jenis transaksi apa?
              </div>
              <Select
                value={step2Jenis}
                onValueChange={(val) => {
                  setStep2Jenis(val || '')
                  if (val !== '4900' && val !== '5350') {
                    setStep2ManualJenis('')
                  }
                }}
              >
                <SelectTrigger className="bg-white border-slate-300 text-slate-900 rounded-xl h-11 text-sm font-medium">
                  <SelectValue placeholder="-- Pilih jenis --" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900 max-h-64">
                  {step1Arus === 'MASUK' ? (
                    PENERIMAAN_OPTIONS.map((item) => (
                      <SelectItem key={item.code} value={item.code}>
                        {item.name}
                      </SelectItem>
                    ))
                  ) : (
                    PENGELUARAN_OPTIONS.map((item) => (
                      <SelectItem key={item.code} value={item.code}>
                        {item.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {/* Input Manual jika memilih Penerimaan Lainnya atau Pengeluaran Lainnya */}
              {(step2Jenis === '4900' || step2Jenis === '5350') && (
                <div className="pt-1 animate-fadeIn">
                  <Input
                    value={step2ManualJenis}
                    onChange={(e) => setStep2ManualJenis(e.target.value)}
                    placeholder="Tuliskan jenis transaksi spesifik secara manual..."
                    className="bg-amber-50/40 border-amber-300 text-slate-900 rounded-xl h-10 text-xs font-semibold focus:ring-amber-500"
                  />
                  <p className="text-[11px] text-amber-800 mt-1">
                    * Jenis transaksi manual akan dicatat ke kode COA {step2Jenis}.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* LANGKAH 3 - Nama Kepala Keluarga (KK) (Muncul setelah Langkah 2 dipilih, Persis Gambar 3) */}
          {step1Arus && step2Jenis && (
            <div className="space-y-1.5 animate-fadeIn">
              <div className="text-xs font-bold text-[#18539E]">
                LANGKAH 3 - Nama Kepala Keluarga (KK) <span className="text-rose-500">*</span>
              </div>
              <Select value={step3KkId} onValueChange={(val) => setStep3KkId(val || '')}>
                <SelectTrigger className="bg-white border-slate-300 text-slate-900 rounded-xl h-11 text-sm">
                  <SelectValue placeholder="-- Pilih nama KK / umat --" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900 max-h-60">
                  <SelectItem value="umum">-- Tidak spesifik / umum (Kolektif) --</SelectItem>
                  {kkList.map((kk) => (
                    <SelectItem key={kk.id} value={kk.id}>
                      {kk.nama_kk} {kk.alamat ? `(${kk.alamat})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-500 italic leading-relaxed pt-0.5">
                Pilih nama KK yang menyetor uang (untuk penerimaan) atau yang bertanggung jawab (untuk pengeluaran). Pilih &ldquo;Tidak spesifik / umum&rdquo; untuk transaksi kolektif.
              </p>
            </div>
          )}

          {/* LANGKAH 4 - Tanggal dan jumlah uang (Muncul setelah Langkah 3 dipilih, Persis Gambar 3) */}
          {step1Arus && step2Jenis && step3KkId && (
            <div className="space-y-2 animate-fadeIn">
              <div className="text-xs font-bold text-[#18539E]">
                LANGKAH 4 - Tanggal dan jumlah uang
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="tgl" className="text-xs font-bold text-slate-700">
                    Tanggal <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="tgl"
                    type="date"
                    value={step4Tanggal}
                    onChange={(e) => setStep4Tanggal(e.target.value)}
                    required
                    className="bg-white border-slate-300 text-slate-900 rounded-xl h-11 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="jml" className="text-xs font-bold text-slate-700">
                    Jumlah (Rp) <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="jml"
                    value={step4NominalInput}
                    onChange={handleNominalChange}
                    required
                    className="bg-white border-slate-300 text-slate-900 font-bold text-base rounded-xl h-11"
                  />
                </div>
              </div>
            </div>
          )}

          {/* LANGKAH 5 - Keterangan singkat & PRATINJAU JURNAL (Muncul setelah nominal diisi, Persis Gambar 4) */}
          {step1Arus && step2Jenis && step3KkId && step4NominalNumeric > 0 && (
            <div className="space-y-5 animate-fadeIn">
              {/* Langkah 5 Input */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-[#18539E]">
                  LANGKAH 5 - Keterangan singkat
                </div>
                <Input
                  value={step5Keterangan}
                  onChange={(e) => setStep5Keterangan(e.target.value)}
                  placeholder="Contoh: Iuran KL Juli 2026"
                  className="bg-white border-slate-300 text-slate-900 rounded-xl h-11 text-sm"
                />
              </div>

              {/* PRATINJAU JURNAL AKUNTANSI (otomatis) (Kotak Ungu Persis Gambar 4) */}
              <div className="bg-[#EEF1FF] border border-[#D0D9FF] rounded-xl p-4 sm:p-5 space-y-3">
                <div className="text-xs font-bold text-[#3B4C9B] uppercase tracking-wider">
                  PRATINJAU JURNAL AKUNTANSI (otomatis)
                </div>

                <div className="grid grid-cols-12 text-xs font-bold pb-1 border-b border-indigo-200/80">
                  <div className="col-span-8 text-slate-700">Akun</div>
                  <div className="col-span-2 text-right text-rose-700">Debit</div>
                  <div className="col-span-2 text-right text-emerald-700">Kredit</div>
                </div>

                {/* Double Entry Row 1 (Debit) */}
                <div className="grid grid-cols-12 text-xs font-semibold py-1">
                  <div className="col-span-8 text-slate-900 font-mono">
                    {currentDebitAccount} -- {currentDebitName}
                  </div>
                  <div className="col-span-2 text-right font-mono font-bold text-rose-700">
                    {formatCurrency(step4NominalNumeric)}
                  </div>
                  <div className="col-span-2 text-right font-mono text-slate-400">
                    Rp --
                  </div>
                </div>

                {/* Double Entry Row 2 (Kredit) */}
                <div className="grid grid-cols-12 text-xs font-semibold py-1">
                  <div className="col-span-8 text-slate-900 font-mono pl-5">
                    {currentKreditAccount} -- {currentKreditName}
                  </div>
                  <div className="col-span-2 text-right font-mono text-slate-400">
                    Rp --
                  </div>
                  <div className="col-span-2 text-right font-mono font-bold text-emerald-700">
                    {formatCurrency(step4NominalNumeric)}
                  </div>
                </div>
              </div>

              {/* Tombol Simpan Transaksi */}
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#F6EFE2] hover:bg-[#EDE3D0] text-[#5A4423] border border-[#5A4423]/40 font-bold h-12 rounded-xl text-sm shadow-xs cursor-pointer flex items-center justify-center gap-2 transition-all"
              >
                {submitting ? 'Menyimpan Transaksi...' : 'Simpan Transaksi'}
              </Button>
            </div>
          )}
        </form>
      </div>

      {/* BOX: DAFTAR TRANSAKSI (Riwayat Transaksi yang Telah Dijurnal, Persis Gambar 4) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Header Daftar Transaksi */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Daftar Transaksi</h3>
              <p className="text-xs text-slate-400">{filteredJournals.length} transaksi di bulan ini</p>
            </div>
          </div>

          {/* Filter Arus View Buttons */}
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant={filterArusView === 'ALL' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterArusView('ALL')}
              className={`rounded-lg text-xs h-8 font-bold ${filterArusView === 'ALL' ? 'bg-slate-900 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
            >
              Semua
            </Button>
            <Button
              type="button"
              variant={filterArusView === 'MASUK' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterArusView('MASUK')}
              className={`rounded-lg text-xs h-8 font-bold ${filterArusView === 'MASUK' ? 'bg-slate-900 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
            >
              Uang Masuk
            </Button>
            <Button
              type="button"
              variant={filterArusView === 'KELUAR' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterArusView('KELUAR')}
              className={`rounded-lg text-xs h-8 font-bold ${filterArusView === 'KELUAR' ? 'bg-slate-900 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
            >
              Uang Keluar
            </Button>
          </div>
        </div>

        {/* Content Table or Empty State (Persis Gambar 4) */}
        <div className="p-0">
          {displayedTableJournals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
              <div className="text-3xl font-extralight text-slate-400">&gt;</div>
              <div className="text-sm font-medium text-slate-600">Belum ada transaksi di bulan ini</div>
              <div className="text-xs text-slate-400">Gunakan form di atas untuk mulai mencatat transaksi jurnal</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80 text-xs font-bold text-slate-700 border-b border-slate-200">
                  <TableRow>
                    <TableHead className="w-28 text-slate-800 font-bold">Tanggal</TableHead>
                    <TableHead className="w-28 text-slate-800 font-bold">Arus</TableHead>
                    <TableHead className="text-slate-800 font-bold">Umat / KK</TableHead>
                    <TableHead className="text-slate-800 font-bold">Keterangan / Jenis</TableHead>
                    <TableHead className="w-36 text-slate-800 font-bold">Jurnal DE</TableHead>
                    <TableHead className="w-32 text-right text-slate-800 font-bold">Nominal</TableHead>
                    <TableHead className="w-16 text-center text-slate-800 font-bold">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100 text-xs">
                  {displayedTableJournals.map((j) => (
                    <TableRow key={j.id} className="hover:bg-slate-50/80 transition">
                      <TableCell className="font-mono text-slate-700 whitespace-nowrap">
                        {formatDateIndo(j.tanggal)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                            j.tipe_arus === 'MASUK'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          {j.tipe_arus === 'MASUK' ? 'Uang Masuk' : 'Uang Keluar'}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900">
                        {j.kepala_keluarga?.nama_kk || (
                          <span className="text-slate-500 italic">Umum / Kolektif</span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-800 font-medium">
                        {j.keterangan}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-slate-600">
                        <div>D: {j.coa_debit}</div>
                        <div>K: {j.coa_kredit}</div>
                      </TableCell>
                      <TableCell className={`text-right font-mono font-bold text-sm ${j.tipe_arus === 'MASUK' ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {j.tipe_arus === 'MASUK' ? '+' : '-'} {formatRupiah(Number(j.nominal))}
                      </TableCell>
                      <TableCell className="text-center">
                        {!j.is_posted && (
                          <button
                            type="button"
                            onClick={() => handleDeleteTransaction(j.id, j.is_posted)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Hapus transaksi"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DIALOG: JURNAL DOUBLE ENTRY DETAIL */}
      <Dialog open={isDeModalOpen} onOpenChange={setIsDeModalOpen}>
        <DialogContent className="sm:max-w-3xl bg-white border-slate-200 text-slate-900 rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-bold text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              Buku Jurnal Double Entry — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Format buku besar akuntansi berpasangan (Double Entry Ledger) untuk audit paroki.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto border border-slate-200 rounded-xl my-2">
            <Table>
              <TableHeader className="bg-slate-50 text-slate-800 font-bold text-xs">
                <TableRow>
                  <TableHead className="w-24">Tanggal</TableHead>
                  <TableHead>Keterangan & Akun</TableHead>
                  <TableHead className="w-20 text-center">Ref</TableHead>
                  <TableHead className="w-28 text-right">Debit (Rp)</TableHead>
                  <TableHead className="w-28 text-right">Kredit (Rp)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100 text-xs">
                {filteredJournals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-slate-400">
                      Belum ada transaksi pada bulan ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredJournals.map((j) => (
                    <React.Fragment key={j.id}>
                      {/* Debit row */}
                      <TableRow className="bg-white hover:bg-slate-50">
                        <TableCell className="font-mono text-[11px] align-top">{j.tanggal}</TableCell>
                        <TableCell className="font-bold text-slate-900">
                          {j.coa_debit} — {resolveCoaDetails(j.coa_debit).nama_akun}
                          <div className="text-[11px] font-normal text-slate-500 mt-0.5">{j.keterangan}</div>
                        </TableCell>
                        <TableCell className="text-center font-mono text-[11px]">{j.coa_debit}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-rose-700">
                          {formatRupiah(Number(j.nominal))}
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-300">-</TableCell>
                      </TableRow>
                      {/* Kredit row */}
                      <TableRow className="bg-white hover:bg-slate-50 border-b border-slate-200">
                        <TableCell></TableCell>
                        <TableCell className="font-bold text-slate-800 pl-8">
                          {j.coa_kredit} — {resolveCoaDetails(j.coa_kredit).nama_akun}
                        </TableCell>
                        <TableCell className="text-center font-mono text-[11px]">{j.coa_kredit}</TableCell>
                        <TableCell className="text-right font-mono text-slate-300">-</TableCell>
                        <TableCell className="text-right font-mono font-bold text-emerald-700">
                          {formatRupiah(Number(j.nominal))}
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              onClick={() => setIsDeModalOpen(false)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FOOTER INFORMASI LINGKUNGAN */}
      <div className="text-center text-xs text-slate-400 pt-6">
        © {selectedYear} Gereja St Clara, Paroki Bekasi Utara — {pengurus?.bendahara_nama || 'FX Wisnu Ardianto'} (Bendahara {formatNamaLingkungan(lingkunganName)})
      </div>
    </div>
  )
}
