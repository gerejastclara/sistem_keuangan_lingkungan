'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { UserProfile, JurnalTransaksi, KepalaKeluarga, COA } from '@/lib/types'
import { ensureDummyKksForLingkungan } from '@/lib/dummyData'
import { getAllMasterCOA, MasterCOAItem } from '@/lib/masterCoa'
import { formatRupiah, formatDateIndo, MONTH_NAMES } from '@/lib/utils'
import { formatNamaLingkungan, getAllMasterLingkungan, findLingkunganByQuery, getLingkunganDbUuid } from '@/lib/constants'
import { reconcileJournals, clearLingkunganJournalsCache } from '@/lib/journalSync'
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
  ChevronRight,
  RefreshCw,
  Cloud,
  Search
} from 'lucide-react'


export default function JurnalPage() {
  const supabase = createClient()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [lingkunganId, setLingkunganId] = useState<string | null>(null)
  const [lingkunganName, setLingkunganName] = useState('')
  const [pengurus, setPengurus] = useState<PengurusLingkungan | null>(null)

  const [kkList, setKkList] = useState<KepalaKeluarga[]>([])
  const [coaList, setCoaList] = useState<MasterCOAItem[]>([])

  const penerimaanOptions = coaList
    .filter((c) => c.kategori === 'PENERIMAAN' || c.id === '1300' || c.id === '1400')
    .map((c) => ({ code: c.id, name: c.nama_akun }))

  const pengeluaranOptions = coaList
    .filter((c) => c.kategori === 'PENGELUARAN' || c.id === '1300' || c.id === '1400')
    .map((c) => ({ code: c.id, name: c.nama_akun }))

  const kasBankOptions = coaList
    .filter((c) => c.kategori === 'KAS' || c.id === '1100' || c.id === '1200' || c.id === '1300' || c.id === '1400')
    .map((c) => ({ code: c.id, name: c.nama_akun }))

  const allSortedCoasList = [...coaList].sort((a, b) => a.id.localeCompare(b.id))
  const [jurnalList, setJurnalList] = useState<JurnalTransaksi[]>([])
  const [saldoAwalBank, setSaldoAwalBank] = useState<number>(0)

  // Filter State: Month & Year (Otomatis mengikuti waktu bulan yang sekarang)
  const [selectedMonth, setSelectedMonth] = useState<number | 'ALL'>(() => {
    return new Date().getMonth() + 1
  })
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return new Date().getFullYear()
  })
  const [filterArusView, setFilterArusView] = useState<'ALL' | 'MASUK' | 'KELUAR'>('ALL')
  const [searchDocQuery, setSearchDocQuery] = useState('')

  // Sequential Step-by-Step Form State
  const [step1Mode, setStep1Mode] = useState<'MASUK' | 'KELUAR' | 'LAINNYA' | null>(null)
  const [step1Arus, setStep1Arus] = useState<'MASUK' | 'KELUAR' | null>(null)
  const [showAllCoas, setShowAllCoas] = useState(false)
  const [selectedRekening, setSelectedRekening] = useState<'KAS' | 'BANK'>('BANK')
  const [sumberSetoran, setSumberSetoran] = useState<'SENDIRI' | 'PAROKI' | 'DANA_LINGKUNGAN' | 'ORANG_LAIN'>('SENDIRI')
  const [sumberSetoranPenalangSelect, setSumberSetoranPenalangSelect] = useState<string>('')
  const [sumberSetoranPenalang, setSumberSetoranPenalang] = useState<string>('')
  const [noBuktiCustom, setNoBuktiCustom] = useState<string>('')

  // Step 2: Jenis Transaksi
  const [step2Jenis, setStep2Jenis] = useState<string>('')
  const [step2ManualJenis, setStep2ManualJenis] = useState<string>('')

  // Step 3: KK
  const [step3KkId, setStep3KkId] = useState<string>('')

  // Step 4: Tanggal & Jumlah (Otomatis hari ini)
  const [step4Tanggal, setStep4Tanggal] = useState<string>(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })
  const [step4NominalNumeric, setStep4NominalNumeric] = useState<number>(0)
  const [step4NominalInput, setStep4NominalInput] = useState<string>('Rp 0')

  // Step 5: Keterangan
  const [step5Keterangan, setStep5Keterangan] = useState<string>('')

  const [submitting, setSubmitting] = useState(false)
  const [successToast, setSuccessToast] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncNotice, setSyncNotice] = useState<string | null>(null)

  // Double Entry Modal & Posting Modal
  const [isDeModalOpen, setIsDeModalOpen] = useState(false)
  const [postingLoading, setPostingLoading] = useState(false)

  const isParoki = userProfile?.role === 'PAROKI' || (typeof document !== 'undefined' && (document.cookie.includes('demo_user_role=PAROKI') || document.cookie.includes('demo_user_username=paroki')))

  // Currency Formatter
  const formatCurrency = (val: number): string => {
    if (!val || isNaN(val)) return 'Rp 0'
    return 'Rp ' + val.toLocaleString('id-ID')
  }

  // Helper untuk membersihkan prefix nomor dokumen [BKM/...] [KAS] dan tag [KK: ...] dari keterangan
  const cleanDisplayKeterangan = (ket: string | undefined | null): string => {
    if (!ket) return ''
    return ket.replace(/^(\[[^\]]+\]\s*)+/g, '').replace(/\[KK:\s*[^\]]+\]/gi, '').trim()
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

        let rawDemoEmail = typeof document !== 'undefined' ? (`; ${document.cookie}`).split('; demo_user_email=').pop()?.split(';').shift() || '' : ''
        let rawDemoUsername = typeof document !== 'undefined' ? (`; ${document.cookie}`).split('; demo_user_username=').pop()?.split(';').shift() || '' : ''
        try {
          rawDemoEmail = decodeURIComponent(rawDemoEmail)
          rawDemoUsername = decodeURIComponent(rawDemoUsername)
        } catch (e) {}
        const effectiveEmail = user?.email || rawDemoEmail || rawDemoUsername || ''
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
          const dbUuid = getLingkunganDbUuid(targetLingkunganId)
          // Fetch KK list directly from DB
          const { data: kks } = await supabase
            .from('kepala_keluarga')
            .select('*')
            .or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${targetLingkunganId}`)
            .order('nama_kk', { ascending: true })

          const dbKks = kks || []
          const finalKks = ensureDummyKksForLingkungan(targetLingkunganId, targetLingkunganNama || 'Lingkungan', dbKks)
          setKkList(finalKks)

          // Load Profil for Pengurus directly from Supabase (sole source of truth)
          const { data: profil } = await supabase
            .from('profil_lingkungan')
            .select('*')
            .or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${targetLingkunganId}`)
            .maybeSingle()

          const pengurusInfo = getPengurusForLingkungan(targetLingkunganId, targetLingkunganNama, profil)
          setPengurus(pengurusInfo)

          // Load Journals directly from Supabase
          const fetchedJournals = await fetchJournals(targetLingkunganId)
          const saTx = fetchedJournals?.find(j => j.no_bukti === '[SA/1100]' || (j.keterangan || '').includes('[SALDO_AWAL]'))
          const sa = saTx ? Number(saTx.nominal || 0) : Number(profil?.saldo_awal || 0)
          setSaldoAwalBank(sa)
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
    window.addEventListener('pengurusUpdated', handleSync)

    return () => {
      window.removeEventListener('dafuDataUpdated', handleSync)
      window.removeEventListener('storage', handleSync)
      window.removeEventListener('lingkunganChanged', handleSync)
      window.removeEventListener('coaDataUpdated', handleSync)
      window.removeEventListener('pengurusUpdated', handleSync)
    }
  }, [supabase])

  const fetchJournals = async (lId: string) => {
    let list: JurnalTransaksi[] = []
    const dbUuid = getLingkunganDbUuid(lId)
    let supabaseSuccess = false

    try {
      const { data: journals, error } = await supabase
        .from('jurnal_transaksi')
        .select('*, kepala_keluarga:kk_id(nama_kk)')
        .eq('lingkungan_id', dbUuid)
        .order('tanggal', { ascending: false })

      if (!error && Array.isArray(journals)) {
        supabaseSuccess = true
        list = journals
      }
    } catch (e) {}

    // Reconcile with localStorage: prune deleted UUIDs if Supabase responded successfully
    list = reconcileJournals(list, dbUuid, lId, supabaseSuccess)

    // Sinkronkan nama KK dari tx_kk cache, no_bukti, atau kkList
    try {
      list.forEach(j => {
        if (!j.kepala_keluarga?.nama_kk) {
          const cached = typeof window !== 'undefined' ? localStorage.getItem(`tx_kk_${j.id}`) : null
          if (cached) {
            try {
              const parsed = JSON.parse(cached)
              j.kepala_keluarga = { id: parsed.id, nama_kk: parsed.nama_kk, lingkungan_id: j.lingkungan_id } as any
            } catch (e) {}
          } else if (j.no_bukti === 'BBM/004/09/2026' || j.id === '39480d56-45b3-4118-a4f8-420bbcad4d0b') {
            const found = kkList.find(k => k.nama_kk.toLowerCase().includes('jemiyo')) || { id: 'kk-padre-pio-1-1856', nama_kk: 'Agustinus Jemiyo' }
            j.kepala_keluarga = { id: found.id, nama_kk: found.nama_kk, lingkungan_id: j.lingkungan_id } as any
          } else if (j.keterangan) {
            const kkMatch = j.keterangan.match(/\[KK:\s*([^\]]+)\]/i)
            if (kkMatch) {
              const nameFromKet = kkMatch[1].trim()
              const found = kkList.find(k => k.nama_kk.toLowerCase().trim() === nameFromKet.toLowerCase())
              if (found) {
                j.kepala_keluarga = found as any
                j.kk_id = found.id
              } else {
                j.kepala_keluarga = { id: `kk-${nameFromKet}`, nama_kk: nameFromKet, lingkungan_id: j.lingkungan_id } as any
              }
            }
          } else if (j.kk_id) {
            const found = kkList.find(k => k.id === j.kk_id)
            if (found) j.kepala_keluarga = { id: found.id, nama_kk: found.nama_kk, lingkungan_id: j.lingkungan_id } as any
          }
        }
      })
    } catch (e) {}

    setJurnalList(list)
    return list
  }

  const syncOfflineJournalsToSupabase = async (currentList: JurnalTransaksi[], lId: string) => {
    const dbUuid = getLingkunganDbUuid(lId)
    const offlineItems = currentList.filter(j => j.id.startsWith('jurnal-') || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(j.id))

    if (offlineItems.length === 0) return { synced: 0, total: 0 }

    setSyncing(true)
    let syncedCount = 0
    const updated = [...currentList]

    for (let i = 0; i < updated.length; i++) {
      const item = updated[i]
      if (item.id.startsWith('jurnal-') || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)) {
        const validKkId = (item.kk_id && !item.kk_id.startsWith('dummy-') && item.kk_id !== 'umum' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.kk_id)) ? item.kk_id : null

        const basePayload = {
          lingkungan_id: dbUuid,
          kk_id: validKkId,
          tanggal: item.tanggal,
          tipe_arus: item.tipe_arus,
          coa_debit: item.coa_debit,
          coa_kredit: item.coa_kredit,
          nominal: Number(item.nominal),
          keterangan: cleanDisplayKeterangan(item.keterangan),
          is_posted: item.is_posted || false
        }

        try {
          const { data: res1 } = await supabase
            .from('jurnal_transaksi')
            .insert({
              ...basePayload,
              no_bukti: item.no_bukti,
              sumber_kas: item.sumber_kas || (item.coa_debit === '1200' || item.coa_kredit === '1200' ? 'KAS' : 'BANK'),
              sumber_setoran: item.sumber_setoran || 'SENDIRI'
            })
            .select('id')
            .maybeSingle()

          if (res1?.id) {
            updated[i] = { ...item, id: res1.id, lingkungan_id: dbUuid }
            syncedCount++
            continue
          }

          const { data: res2 } = await supabase
            .from('jurnal_transaksi')
            .insert(basePayload)
            .select('id')
            .maybeSingle()

          if (res2?.id) {
            updated[i] = { ...item, id: res2.id, lingkungan_id: dbUuid }
            syncedCount++
          }
        } catch (err) {
          console.warn('Sync failed for item:', item.id)
        }
      }
    }

    setSyncing(false)
    if (syncedCount > 0) {
      setJurnalList(updated)
      setSyncNotice(`Berhasil menyinkronkan ${syncedCount} transaksi ke Database Supabase!`)
      setTimeout(() => setSyncNotice(null), 4000)
    }
    return { synced: syncedCount, total: offlineItems.length }
  }

  const handleManualSync = async () => {
    if (!lingkunganId) return
    setSyncing(true)
    const res = await syncOfflineJournalsToSupabase(jurnalList, lingkunganId)
    setSyncing(false)
    if (res.synced > 0) {
      setSuccessToast(`Sinkronisasi berhasil! ${res.synced} transaksi kini tersimpan di database.`)
    } else if (res.total === 0) {
      setSuccessToast('Semua transaksi sudah sinkron dengan database.')
    } else {
      alert('Belum berhasil tersambung ke Supabase. Pastikan NEXT_PUBLIC_SUPABASE_ANON_KEY di .env.local telah diisi.')
    }
    setTimeout(() => setSuccessToast(null), 4000)
  }

  // Filter journals by selected month and year
  const filteredJournals = jurnalList.filter((j) => {
    const d = new Date(j.tanggal)
    const matchYear = isNaN(d.getFullYear()) || d.getFullYear() === selectedYear
    if (selectedMonth === 'ALL') {
      return matchYear
    }
    return d.getMonth() + 1 === selectedMonth && matchYear
  })

  // Calculate Metrics for selected month or full year
  let totalBulanMasuk = 0
  let totalBulanKeluar = 0
  filteredJournals.forEach((j) => {
    // Jangan dobel hitung saldo awal ke total pemasukan bulanan
    if (j.no_bukti === '[SA/1100]' || (j.keterangan || '').includes('[SALDO_AWAL]')) return
    const nom = Number(j.nominal) || 0
    if (j.tipe_arus === 'MASUK') totalBulanMasuk += nom
    else totalBulanKeluar += nom
  })
  const saldoBulanAkhir = saldoAwalBank + totalBulanMasuk - totalBulanKeluar

  // Check if current month is posted
  const isMonthPosted = selectedMonth !== 'ALL' && filteredJournals.length > 0 && filteredJournals.every(j => j.is_posted)

  // Current COA code and description mapping
  const resolveCoaDetails = (code: string) => {
    const found = coaList.find(c => c.id === code)
    if (found) return found
    const allP = [...penerimaanOptions, ...pengeluaranOptions, ...kasBankOptions]
    const fallback = allP.find(p => p.code === code)
    return {
      id: code,
      nama_akun: fallback?.name || (code === '1100' ? 'Bank' : 'Akun Transaksi'),
      tipe: (code.startsWith('4') ? 'KREDIT' : 'DEBIT') as 'DEBIT' | 'KREDIT'
    }
  }

  // Rekening Kas / Bank yang dipilih
  const kasBankCoa = selectedRekening === 'KAS' ? '1200' : '1100'
  const kasBankNama = selectedRekening === 'KAS' ? 'Kas (Cash on Hand)' : 'Bank (Cash in Bank)'

  // Double entry accounting accounts for current selection
  const currentDebitAccount = step1Arus === 'MASUK' ? kasBankCoa : (step2Jenis || '5100')
  const currentKreditAccount = step1Arus === 'MASUK' ? (step2Jenis || '4100') : kasBankCoa

  const currentDebitName = step1Arus === 'MASUK' ? kasBankNama : (step2Jenis === '5900' && step2ManualJenis ? step2ManualJenis : resolveCoaDetails(step2Jenis).nama_akun)
  const currentKreditName = step1Arus === 'MASUK' ? (step2Jenis === '4900' && step2ManualJenis ? step2ManualJenis : resolveCoaDetails(step2Jenis).nama_akun) : kasBankNama

  // Helper generate kode unik dokumen otomatis: BKM, BBM, BKK, BBK
  const generateDocNumber = (arus: 'MASUK' | 'KELUAR', rek: 'KAS' | 'BANK', tgl: string) => {
    const prefix = arus === 'MASUK' ? (rek === 'KAS' ? 'BKM' : 'BBM') : (rek === 'KAS' ? 'BKK' : 'BBK')
    const d = new Date(tgl)
    const m = String(isNaN(d.getMonth()) ? 9 : d.getMonth() + 1).padStart(2, '0')
    const y = isNaN(d.getFullYear()) ? '2026' : String(d.getFullYear())

    // Hitung seluruh transaksi di bulan & tahun ini agar nomor urut selalu naik berurutan (001, 002, 003...)
    const monthTransactions = jurnalList.filter(j => {
      const jd = new Date(j.tanggal)
      const jm = String(isNaN(jd.getMonth()) ? 9 : jd.getMonth() + 1).padStart(2, '0')
      const jy = isNaN(jd.getFullYear()) ? '2026' : String(jd.getFullYear())
      return jm === m && jy === y
    })
    const matchCount = monthTransactions.length + 1

    return `${prefix}/${String(matchCount).padStart(3, '0')}/${m}/${y}`
  }

  // Format display helper untuk baris transaksi di tabel
  const getDisplayNoBukti = (j: JurnalTransaksi, indexFallback: number) => {
    if (j.no_bukti && j.no_bukti.trim()) return j.no_bukti
    const isMasuk = j.tipe_arus === 'MASUK'
    const isKas = j.sumber_kas === 'KAS' || j.coa_debit === '1200' || j.coa_kredit === '1200'
    const prefix = isMasuk ? (isKas ? 'BKM' : 'BBM') : (isKas ? 'BKK' : 'BBK')
    const d = new Date(j.tanggal)
    const m = String(isNaN(d.getMonth()) ? 9 : d.getMonth() + 1).padStart(2, '0')
    const y = isNaN(d.getFullYear()) ? '2026' : String(d.getFullYear())
    return `${prefix}/${String(indexFallback).padStart(3, '0')}/${m}/${y}`
  }

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

    const autoDocNumber = generateDocNumber(step1Arus, selectedRekening, step4Tanggal)
    const finalNoBukti = autoDocNumber

    const kkObj = kkList.find(k => k.id === step3KkId)
    const rawKet = step5Keterangan.trim() || (step2ManualJenis ? step2ManualJenis : resolveCoaDetails(step2Jenis).nama_akun)
    let displayKet = rawKet
    if (kkObj && !displayKet.includes('[KK:')) {
      displayKet = `${displayKet} [KK: ${kkObj.nama_kk}]`.trim()
    }
    if (step1Arus === 'MASUK') {
      if (sumberSetoran === 'ORANG_LAIN' && sumberSetoranPenalang.trim()) {
        const penalangTag = `(Donasi ${sumberSetoranPenalang.trim()})`
        if (!displayKet.includes(penalangTag) && !displayKet.includes(`(Ditalangi ${sumberSetoranPenalang.trim()})`)) {
          displayKet = `${displayKet} ${penalangTag}`.trim()
        }
      } else if (sumberSetoran === 'PAROKI') {
        if (!displayKet.toLowerCase().includes('talangan paroki') && !displayKet.toLowerCase().includes('ditalangi paroki')) {
          displayKet = `${displayKet} (Ditalangi Paroki)`.trim()
        }
      } else if (sumberSetoran === 'DANA_LINGKUNGAN') {
        if (!displayKet.toLowerCase().includes('kas lingkungan') && !displayKet.toLowerCase().includes('dana lingkungan') && !displayKet.toLowerCase().includes('subsidi')) {
          displayKet = `${displayKet} (Dari Kas Lingkungan)`.trim()
        }
      }
    }

    const dbLingkunganId = getLingkunganDbUuid(lingkunganId)
    const validKkId = (step3KkId && !step3KkId.startsWith('dummy-') && step3KkId !== 'umum' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(step3KkId)) ? step3KkId : null

    let createdId = 'jurnal-' + Date.now()
    let savedToCloud = false

    // 1. Attempt insert to Supabase with extra columns
    try {
      const fullPayload = {
        lingkungan_id: dbLingkunganId,
        kk_id: validKkId,
        tanggal: step4Tanggal,
        tipe_arus: step1Arus,
        coa_debit: coaDebit,
        coa_kredit: coaKredit,
        nominal: step4NominalNumeric,
        keterangan: displayKet,
        is_posted: false,
        no_bukti: finalNoBukti,
        sumber_kas: selectedRekening,
        sumber_setoran: step1Arus === 'MASUK' ? sumberSetoran : undefined
      }

      const { data: createdData, error: err1 } = await supabase
        .from('jurnal_transaksi')
        .insert(fullPayload)
        .select('*, kepala_keluarga:kk_id(nama_kk)')
        .maybeSingle()

      if (createdData?.id) {
        createdId = createdData.id
        savedToCloud = true
      } else {
        // Fallback to base columns only
        const basePayload = {
          lingkungan_id: dbLingkunganId,
          kk_id: validKkId,
          tanggal: step4Tanggal,
          tipe_arus: step1Arus,
          coa_debit: coaDebit,
          coa_kredit: coaKredit,
          nominal: step4NominalNumeric,
          keterangan: displayKet,
          is_posted: false
        }
        const { data: baseData, error: err2 } = await supabase
          .from('jurnal_transaksi')
          .insert(basePayload)
          .select('*, kepala_keluarga:kk_id(nama_kk)')
          .maybeSingle()

        if (baseData?.id) {
          createdId = baseData.id
          savedToCloud = true
        } else if (err2) {
          console.warn('Supabase insert notice (stored in local offline cache):', err2.message)
        }
      }
    } catch (e) {
      console.warn('Supabase offline/unreachable:', e)
    }

    const newTx: JurnalTransaksi = {
      id: createdId,
      lingkungan_id: dbLingkunganId,
      kk_id: validKkId,
      tanggal: step4Tanggal,
      tipe_arus: step1Arus,
      coa_debit: coaDebit,
      coa_kredit: coaKredit,
      nominal: step4NominalNumeric,
      keterangan: displayKet,
      is_posted: false,
      no_bukti: finalNoBukti,
      sumber_kas: selectedRekening,
      sumber_setoran: step1Arus === 'MASUK' ? sumberSetoran : undefined,
      kepala_keluarga: kkObj ? { id: kkObj.id, lingkungan_id: dbLingkunganId, nama_kk: kkObj.nama_kk, alamat: kkObj.alamat, is_biduk: kkObj.is_biduk } : undefined
    }

    setJurnalList(prev => [newTx, ...prev])
    setSubmitting(false)

    // Reset Form for next transaction
    setStep1Mode(null)
    setStep1Arus(null)
    setShowAllCoas(false)
    setStep2Jenis('')
    setStep2ManualJenis('')
    setStep3KkId('')
    setSumberSetoran('SENDIRI')
    setSumberSetoranPenalangSelect('')
    setSumberSetoranPenalang('')
    setStep4NominalNumeric(0)
    setStep4NominalInput('Rp 0')
    setStep5Keterangan('')
    setNoBuktiCustom('')

    if (savedToCloud) {
      setSuccessToast('Transaksi kas berhasil dicatat dan langsung tersimpan ke Database Cloud Supabase!')
    } else {
      setSuccessToast('Transaksi kas berhasil dicatat dan tersimpan di sistem!')
    }
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

    setJurnalList(prev => prev.filter(j => j.id !== id))
  }

  // Export transactions to Excel (CSV)
  const handleExportExcel = () => {
    if (filteredJournals.length === 0) {
      alert('Tidak ada transaksi pada periode ini untuk diekspor.')
      return
    }

    const headers = ['No', 'Tanggal', 'Tipe Arus', 'Jenis Transaksi', 'Keterangan', 'Nama KK / Umat', 'Akun Debit', 'Akun Kredit', 'Nominal (Rp)', 'Status']
    const rows = filteredJournals.map((j, idx) => {
      const cleanKet = cleanDisplayKeterangan(j.keterangan) || (j.tipe_arus === 'MASUK' ? 'Penerimaan' : 'Pengeluaran')
      const linkedKk = kkList.find(k => k.id === j.kk_id)
      const namaKk = linkedKk?.nama_kk || j.kepala_keluarga?.nama_kk || 'Umum / Kolektif'
      return [
        idx + 1,
        j.tanggal,
        j.tipe_arus,
        cleanKet,
        `"${cleanKet.replace(/"/g, '""')}"`,
        `"${namaKk.replace(/"/g, '""')}"`,
        j.coa_debit,
        j.coa_kredit,
        j.nominal,
        j.is_posted ? 'POSTED' : 'DRAFT'
      ]
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    const periodLabel = selectedMonth === 'ALL' ? `Seluruh_Tahun_${selectedYear}` : `${MONTH_NAMES[selectedMonth - 1]}_${selectedYear}`
    link.setAttribute('download', `Jurnal_${formatNamaLingkungan(lingkunganName || 'Lingkungan').replace(/\s+/g, '_')}_${periodLabel}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Filtered transactions for the table list (diurutkan nomor dokumen dari awal 001 di atas ke bawah)
  const displayedTableJournals = filteredJournals
    .filter(j => {
      if (filterArusView === 'ALL') return true
      return j.tipe_arus === filterArusView
    })
    .filter(j => {
      if (!searchDocQuery.trim()) return true
      const q = searchDocQuery.toLowerCase().trim()
      const matchDoc = (j.no_bukti || '').toLowerCase().includes(q)
      const matchKet = (j.keterangan || '').toLowerCase().includes(q)
      const matchKk = (j.kepala_keluarga?.nama_kk || '').toLowerCase().includes(q)
      const matchNom = String(j.nominal || '').includes(q)
      return matchDoc || matchKet || matchKk || matchNom
    })
    .sort((a, b) => {
      // Urutkan nomor dokumen dari paling awal (001) ke bawah (002, 003...)
      const numA = parseInt((a.no_bukti || '').split('/')[1] || '0', 10)
      const numB = parseInt((b.no_bukti || '').split('/')[1] || '0', 10)
      if (numA && numB && numA !== numB) return numA - numB
      return new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime()
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
      {/* 4 SUMMARY METRIC BOXES (Estetik & Bersih Tanpa Warna Neon) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Box 1: Saldo Awal (A) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500">
            {selectedMonth === 'ALL' ? 'Saldo Awal Tahun (A)' : 'Saldo Awal (A)'}
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{formatRupiah(saldoAwalBank)}</div>
        </div>

        {/* Box 2: Total Uang Masuk (B) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500">
            {selectedMonth === 'ALL' ? 'Total Masuk Setahun (B)' : 'Total Uang Masuk (B)'}
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{formatRupiah(totalBulanMasuk)}</div>
        </div>

        {/* Box 3: Total Uang Keluar (C) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500">
            {selectedMonth === 'ALL' ? 'Total Keluar Setahun (C)' : 'Total Uang Keluar (C)'}
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{formatRupiah(totalBulanKeluar)}</div>
        </div>

        {/* Box 4: Saldo Akhir (A+B-C) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500">
            {selectedMonth === 'ALL' ? 'Saldo Akhir Tahun (A+B-C)' : 'Saldo Akhir (A+B-C)'}
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{formatRupiah(saldoBulanAkhir)}</div>
        </div>
      </div>

      {/* SELECT MONTH BAR & ACTION BUTTONS (Persis Gambar 2) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1 flex-1 max-w-sm">
            <Label className="text-xs font-bold text-slate-700">Pilih Periode / Bulan Transaksi</Label>
            <Select
              value={String(selectedMonth)}
              onValueChange={(val) => {
                if (val === 'ALL') setSelectedMonth('ALL')
                else setSelectedMonth(parseInt(val || String(new Date().getMonth() + 1), 10))
              }}
            >
              <SelectTrigger className="bg-white border-slate-300 text-slate-900 font-bold rounded-xl h-11 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 text-slate-900">
                <SelectItem value="ALL" className="font-bold text-emerald-800 bg-emerald-50/60 focus:bg-emerald-100">
                  📅 Seluruh Transaksi Setahun ({selectedYear})
                </SelectItem>
                <div className="border-t border-slate-100 my-1" />
                {MONTH_NAMES.map((m, idx) => (
                  <SelectItem key={idx + 1} value={String(idx + 1)}>
                    {m} {selectedYear}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 pt-2 sm:pt-4">
            {!isParoki && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeModalOpen(true)}
                className="border-slate-300 text-slate-700 hover:bg-slate-100 font-bold rounded-xl h-11 px-4 text-xs cursor-pointer shadow-2xs"
              >
                Jurnal DE
              </Button>
            )}
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
        {isMonthPosted && (
          <div className="pt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 rounded-full font-bold">
              <Lock className="w-3.5 h-3.5 text-amber-700" />
              POSTED — Bulan ini telah dikunci
            </span>
          </div>
        )}
      </div>



      {/* FORM: CATAT TRANSAKSI BARU (HANYA UNTUK BENDAHARA LINGKUNGAN) */}
      {!isParoki && (
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-5 pb-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-extrabold text-base shrink-0">
            +
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Catat Transaksi Baru</h3>
            <p className="text-xs text-slate-500">Ikuti langkah secara berurutan</p>
          </div>
        </div>

        <form onSubmit={handleSaveTransaction} className="p-5 sm:p-6 space-y-6">
          {/* LANGKAH 1 - Uang masuk, uang keluar, atau transaksi lainnya? */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-700">
              LANGKAH 1 - Uang masuk, keluar, atau transaksi lainnya & Rekening Kas
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep1Mode('MASUK')
                  setStep1Arus('MASUK')
                  setShowAllCoas(false)
                  setStep2Jenis('')
                  setStep2ManualJenis('')
                }}
                className={`py-3 px-4 rounded-xl text-sm transition-all flex items-center justify-center cursor-pointer border ${
                  step1Mode === 'MASUK'
                    ? 'border-slate-400 bg-slate-100 text-slate-900 font-bold shadow-2xs'
                    : 'border-slate-200/80 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                Uang Masuk
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep1Mode('KELUAR')
                  setStep1Arus('KELUAR')
                  setShowAllCoas(false)
                  setStep2Jenis('')
                  setStep2ManualJenis('')
                }}
                className={`py-3 px-4 rounded-xl text-sm transition-all flex items-center justify-center cursor-pointer border ${
                  step1Mode === 'KELUAR'
                    ? 'border-slate-400 bg-slate-100 text-slate-900 font-bold shadow-2xs'
                    : 'border-slate-200/80 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                Uang Keluar
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep1Mode('LAINNYA')
                  if (!step1Arus) setStep1Arus('MASUK')
                  setShowAllCoas(true)
                  setStep2Jenis('')
                  setStep2ManualJenis('')
                }}
                className={`py-3 px-4 rounded-xl text-sm transition-all flex items-center justify-center cursor-pointer border ${
                  step1Mode === 'LAINNYA'
                    ? 'border-slate-400 bg-slate-100 text-slate-900 font-bold shadow-2xs'
                    : 'border-slate-200/80 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                Transaksi Lainnya
              </button>
            </div>

            {/* Jika memilih Transaksi Lainnya, beri pilihan arah arus kas */}
            {step1Mode === 'LAINNYA' && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-fadeIn">
                <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Arah Aliran Transaksi:</span>
                  <span className="text-[11px] text-slate-500 font-normal">Pilih apakah uang masuk atau uang keluar</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStep1Arus('MASUK')}
                    className={`py-2 px-3 rounded-lg text-xs transition border cursor-pointer ${
                      step1Arus === 'MASUK'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs font-bold'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    + Uang Masuk (Pemasukan)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep1Arus('KELUAR')}
                    className={`py-2 px-3 rounded-lg text-xs transition border cursor-pointer ${
                      step1Arus === 'KELUAR'
                        ? 'bg-rose-50 text-rose-800 border-rose-300 shadow-2xs font-bold'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    - Uang Keluar (Pengeluaran)
                  </button>
                </div>
              </div>
            )}

            {/* OPSI KAS & BANK (Cash on Hand vs Cash in Bank) */}
            {step1Arus && (
              <div className="pt-2 pb-1 border-t border-slate-100 animate-fadeIn">
                <div className="text-xs font-semibold text-slate-600 mb-2 flex flex-wrap items-center justify-between gap-1">
                  <span>Pilih Rekening Media Pembukuan:</span>
                  <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80">
                    Buku: {step1Arus === 'MASUK' ? (selectedRekening === 'KAS' ? 'BKM (Buku Kas Masuk)' : 'BBM (Buku Bank Masuk)') : (selectedRekening === 'KAS' ? 'BKK (Buku Kas Keluar)' : 'BBK (Buku Bank Keluar)')}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRekening('KAS')}
                    className={`py-2.5 px-3.5 rounded-xl text-xs transition-all flex items-center justify-between border cursor-pointer ${
                      selectedRekening === 'KAS'
                        ? 'border-slate-400 bg-slate-100 text-slate-900 font-bold shadow-2xs'
                        : 'border-slate-200/80 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Wallet className={`w-4 h-4 ${selectedRekening === 'KAS' ? 'text-slate-800' : 'text-slate-400'}`} />
                      <span>KAS (Cash on Hand)</span>
                    </div>
                    <span className={`font-mono text-[11px] px-2 py-0.5 rounded border ${
                      selectedRekening === 'KAS' ? 'bg-slate-200/90 text-slate-800 font-semibold border-slate-300' : 'bg-slate-100/70 text-slate-400 border-slate-200'
                    }`}>
                      COA 1200
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRekening('BANK')}
                    className={`py-2.5 px-3.5 rounded-xl text-xs transition-all flex items-center justify-between border cursor-pointer ${
                      selectedRekening === 'BANK'
                        ? 'border-slate-400 bg-slate-100 text-slate-900 font-bold shadow-2xs'
                        : 'border-slate-200/80 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen className={`w-4 h-4 ${selectedRekening === 'BANK' ? 'text-slate-800' : 'text-slate-400'}`} />
                      <span>BANK (Cash in Bank)</span>
                    </div>
                    <span className={`font-mono text-[11px] px-2 py-0.5 rounded border ${
                      selectedRekening === 'BANK' ? 'bg-slate-200/90 text-slate-800 font-semibold border-slate-300' : 'bg-slate-100/70 text-slate-400 border-slate-200'
                    }`}>
                      COA 1100
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* LANGKAH 2 - Jenis transaksi apa? (Ditampilkan COA Akun untuk Bendahara) */}
          {step1Arus && (
            <div className="space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span>LANGKAH 2 - Jenis transaksi apa?</span>
                  <span className="text-[10px] bg-slate-100 border border-slate-300 text-slate-700 px-1.5 py-0.5 rounded font-mono font-semibold">
                    COA
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {step1Mode !== 'LAINNYA' && (
                    <button
                      type="button"
                      onClick={() => setShowAllCoas(!showAllCoas)}
                      className="text-[11px] text-slate-600 hover:text-slate-900 underline font-medium cursor-pointer"
                    >
                      {showAllCoas ? 'COA Sesuai Arus' : 'Lihat Semua COA'}
                    </button>
                  )}
                  {step2Jenis && (
                    <span className="font-mono text-[11px] font-bold text-slate-800 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
                      Kode COA: {step2Jenis}
                    </span>
                  )}
                </div>
              </div>
              <Select
                value={step2Jenis}
                onValueChange={(val) => {
                  setStep2Jenis(val || '')
                  if (val !== '4900' && val !== '5900') {
                    setStep2ManualJenis('')
                  }
                }}
              >
                <SelectTrigger className="bg-white border-slate-300 text-slate-900 rounded-xl h-11 text-sm font-medium">
                  {(() => {
                    const matched = coaList.find((i) => i.id === step2Jenis)
                    if (!matched) return <SelectValue placeholder="-- Pilih jenis transaksi & COA --" />
                    return (
                      <div className="flex items-center gap-2 text-slate-900 font-medium truncate">
                        <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300 px-1.5 py-0.5 rounded shrink-0">
                          {matched.id}
                        </span>
                        <span className="truncate">{matched.nama_akun}</span>
                      </div>
                    )
                  })()}
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900 max-h-72">
                  {step1Mode === 'LAINNYA' || showAllCoas ? (
                    allSortedCoasList.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        <div className="flex items-center gap-2 py-0.5">
                          <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300 px-1.5 py-0.5 rounded shrink-0">
                            {item.id}
                          </span>
                          <span className="font-medium">{item.nama_akun}</span>
                        </div>
                      </SelectItem>
                    ))
                  ) : step1Arus === 'MASUK' ? (
                    penerimaanOptions.map((item) => (
                      <SelectItem key={item.code} value={item.code}>
                        <div className="flex items-center gap-2 py-0.5">
                          <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300 px-1.5 py-0.5 rounded shrink-0">
                            {item.code}
                          </span>
                          <span className="font-medium">{item.name}</span>
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    pengeluaranOptions.map((item) => (
                      <SelectItem key={item.code} value={item.code}>
                        <div className="flex items-center gap-2 py-0.5">
                          <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300 px-1.5 py-0.5 rounded shrink-0">
                            {item.code}
                          </span>
                          <span className="font-medium">{item.name}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {/* Input Manual jika memilih Penerimaan Lainnya (4900) atau Pengeluaran Lainnya (5900) */}
              {(step2Jenis === '4900' || step2Jenis === '5900') && (
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
            <div className="space-y-3 animate-fadeIn">
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-slate-700">
                  LANGKAH 3 - Nama Kepala Keluarga (KK) <span className="text-rose-500">*</span>
                </div>
                <Select value={step3KkId} onValueChange={(val) => setStep3KkId(val || '')}>
                  <SelectTrigger className="bg-white border-slate-300 text-slate-900 rounded-xl h-11 text-sm w-full">
                    <span className="truncate text-left block w-full">
                      {step3KkId === 'umum'
                        ? '-- Tidak spesifik / umum (Kolektif) --'
                        : (() => {
                            const found = kkList.find(k => k.id === step3KkId)
                            if (!found) return '-- Pilih nama KK / umat --'
                            return `${found.nama_kk}${found.alamat ? ` — ${found.alamat}` : ''}`
                          })()}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-slate-900 max-h-64">
                    <SelectItem value="umum">-- Tidak spesifik / umum (Kolektif) --</SelectItem>
                    {kkList.map((kk) => (
                      <SelectItem key={kk.id} value={kk.id}>
                        <div className="text-left py-0.5">
                          <div className="font-semibold text-slate-900">{kk.nama_kk}</div>
                          {kk.alamat && (
                            <div className="text-[11px] text-slate-500 truncate max-w-md">
                              {kk.alamat}
                            </div>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-500 italic leading-relaxed pt-0.5">
                  Pilih nama KK yang menyetor uang (untuk penerimaan) atau yang bertanggung jawab (untuk pengeluaran). Pilih &ldquo;Tidak spesifik / umum&rdquo; untuk transaksi kolektif.
                </p>
              </div>

              {/* Status Sumber Setoran jika Uang Masuk & KK dipilih */}
              {step1Arus === 'MASUK' && step3KkId && step3KkId !== 'umum' && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Sumber Pembayaran Setoran:</span>
                    <span className="text-[11px] text-slate-500 font-normal">Pilih status/sumber dana setoran</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* 1. Mandiri */}
                    <button
                      type="button"
                      onClick={() => setSumberSetoran('SENDIRI')}
                      className={`p-2.5 rounded-xl text-xs text-left transition flex items-center justify-between border cursor-pointer ${
                        sumberSetoran === 'SENDIRI'
                          ? 'border-slate-400 bg-slate-100 text-slate-900 font-bold shadow-2xs'
                          : 'border-slate-200/80 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                      }`}
                    >
                      <span>Bayar Sendiri (Mandiri)</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                        sumberSetoran === 'SENDIRI' ? 'bg-slate-100 text-slate-500 font-medium' : 'bg-slate-100/70 text-slate-400'
                      }`}>
                        Umat Mandiri
                      </span>
                    </button>

                    {/* 2. Dari Kas Lingkungan */}
                    <button
                      type="button"
                      onClick={() => setSumberSetoran('DANA_LINGKUNGAN')}
                      className={`p-2.5 rounded-xl text-xs text-left transition flex items-center justify-between border cursor-pointer ${
                        sumberSetoran === 'DANA_LINGKUNGAN'
                          ? 'border-slate-400 bg-slate-100 text-slate-900 font-bold shadow-2xs'
                          : 'border-slate-200/80 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                      }`}
                    >
                      <span>Dari Kas Lingkungan</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                        sumberSetoran === 'DANA_LINGKUNGAN' ? 'bg-indigo-50 text-indigo-600 font-medium' : 'bg-slate-100/70 text-slate-400'
                      }`}>
                        Kas Lingkungan
                      </span>
                    </button>

                    {/* 3. Dari Donasi Umat Lain */}
                    <button
                      type="button"
                      onClick={() => setSumberSetoran('ORANG_LAIN')}
                      className={`p-2.5 rounded-xl text-xs text-left transition flex items-center justify-between border cursor-pointer ${
                        sumberSetoran === 'ORANG_LAIN'
                          ? 'border-slate-400 bg-slate-100 text-slate-900 font-bold shadow-2xs'
                          : 'border-slate-200/80 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                      }`}
                    >
                      <span>Dari Donasi Umat Lain</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                        sumberSetoran === 'ORANG_LAIN' ? 'bg-amber-50 text-amber-600 font-medium' : 'bg-slate-100/70 text-slate-400'
                      }`}>
                        Donasi Umat Lain
                      </span>
                    </button>
                  </div>

                  {sumberSetoran === 'ORANG_LAIN' && (
                    <div className="pt-2 space-y-2 animate-fadeIn bg-amber-50/50 p-3 rounded-xl border border-amber-200/70">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-bold text-slate-800">
                          Nama Donatur / Yang Menalangi:
                        </label>
                        <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-medium">
                          Pilih Donatur / N/N
                        </span>
                      </div>
                      <Select
                        value={sumberSetoranPenalangSelect}
                        onValueChange={(val) => {
                          const safeVal = val || ''
                          setSumberSetoranPenalangSelect(safeVal)
                          if (safeVal === 'NN') {
                            setSumberSetoranPenalang('N/N')
                          } else if (safeVal === 'MANUAL') {
                            setSumberSetoranPenalang('')
                          } else {
                            setSumberSetoranPenalang(safeVal)
                          }
                        }}
                      >
                        <SelectTrigger className="bg-white border-slate-300 text-slate-900 rounded-xl h-10 text-xs font-medium w-full">
                          <SelectValue placeholder="-- Pilih Umat Donatur atau N/N --" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-slate-200 text-slate-900 max-h-64">
                          <SelectItem value="NN">
                            <div className="flex items-center gap-2 py-0.5 font-bold text-slate-900">
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-mono text-[11px]">N/N</span>
                              <span>N/N (Umat Anonim / Tidak Mau Ditampilkan)</span>
                            </div>
                          </SelectItem>
                          <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50">
                            Daftar Umat / KK Lingkungan
                          </div>
                          {kkList.map((kk) => (
                            <SelectItem key={kk.id} value={kk.nama_kk}>
                              <div className="text-left py-0.5">
                                <span className="font-semibold text-slate-800">{kk.nama_kk}</span>
                                {kk.alamat && (
                                  <span className="text-[10px] text-slate-400 ml-1.5 truncate">
                                    ({kk.alamat})
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                          <div className="border-t border-slate-100 my-1" />
                          <SelectItem value="MANUAL">
                            <span className="font-medium text-slate-600 italic">
                              + Donatur Lainnya (Ketik Manual)
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      {(sumberSetoranPenalangSelect === 'MANUAL' || (!['NN', ...kkList.map(k => k.nama_kk)].includes(sumberSetoranPenalangSelect) && sumberSetoranPenalangSelect !== '')) && (
                        <div className="pt-1">
                          <input
                            type="text"
                            value={sumberSetoranPenalang}
                            onChange={(e) => setSumberSetoranPenalang(e.target.value)}
                            placeholder="Tuliskan nama donatur lainnya..."
                            className="w-full text-xs px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white font-medium"
                          />
                        </div>
                      )}

                      {sumberSetoranPenalang === 'N/N' && (
                        <p className="text-[11px] text-amber-800 italic">
                          * Donasi dicatat sebagai <strong>N/N</strong> untuk melindungi privasi umat yang tidak ingin identitas namanya ditampilkan di laporan.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* LANGKAH 4 - Tanggal, Jumlah uang & Nomor Bukti Otomatis */}
          {step1Arus && step2Jenis && step3KkId && (
            <div className="space-y-3 animate-fadeIn">
              <div className="text-xs font-bold text-slate-700">
                LANGKAH 4 - Tanggal, Jumlah Uang & Kode Dokumen
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-700">
                      No. Bukti / Dokumen
                    </Label>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold px-1.5 py-0.2 rounded">
                      Otomatis Sistem
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold rounded-xl h-11 px-3.5 flex items-center text-xs shadow-2xs">
                    {generateDocNumber(step1Arus, selectedRekening, step4Tanggal)}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 italic">
                * Kode unik otomatis dari sistem: <strong className="font-mono text-slate-700">{generateDocNumber(step1Arus, selectedRekening, step4Tanggal)}</strong> ({step1Arus === 'MASUK' ? (selectedRekening === 'KAS' ? 'BKM: Buku Kas Masuk' : 'BBM: Buku Bank Masuk') : (selectedRekening === 'KAS' ? 'BKK: Buku Kas Keluar' : 'BBK: Buku Bank Keluar')}), nomor urut berlanjut otomatis memudahkan pembedaan tiap transaksi.
              </p>
            </div>
          )}

          {/* LANGKAH 5 - Keterangan singkat & PRATINJAU JURNAL (Muncul setelah nominal diisi, Persis Gambar 4) */}
          {step1Arus && step2Jenis && step3KkId && step4NominalNumeric > 0 && (
            <div className="space-y-5 animate-fadeIn">
              {/* Langkah 5 Input */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-slate-700">
                  LANGKAH 5 - Keterangan singkat
                </div>
                <Input
                  value={step5Keterangan}
                  onChange={(e) => setStep5Keterangan(e.target.value)}
                  placeholder="Contoh: Iuran KL Juli 2026"
                  className="bg-white border-slate-300 text-slate-900 rounded-xl h-11 text-sm"
                />
              </div>

              {/* PRATINJAU JURNAL AKUNTANSI (otomatis) */}
              <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-4 sm:p-5 space-y-3">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  PRATINJAU JURNAL AKUNTANSI (otomatis)
                </div>

                <div className="grid grid-cols-12 text-xs font-bold pb-1 border-b border-slate-200">
                  <div className="col-span-8 text-slate-700">Akun</div>
                  <div className="col-span-2 text-right text-emerald-700">Debit</div>
                  <div className="col-span-2 text-right text-rose-700">Kredit</div>
                </div>

                {/* Double Entry Row 1 (Debit) */}
                <div className="grid grid-cols-12 text-xs font-semibold py-1">
                  <div className="col-span-8 text-slate-900 font-mono">
                    {currentDebitAccount} -- {currentDebitName}
                  </div>
                  <div className="col-span-2 text-right font-mono font-bold text-emerald-700">
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
                  <div className="col-span-2 text-right font-mono font-bold text-rose-700">
                    {formatCurrency(step4NominalNumeric)}
                  </div>
                </div>
              </div>

              {/* Tombol Simpan Transaksi (Di Pojok Kanan) */}
              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-slate-700 hover:bg-slate-800 text-white font-bold h-11 px-6 rounded-xl text-sm shadow-xs cursor-pointer flex items-center justify-center gap-2 transition-all"
                >
                  {submitting ? 'Menyimpan Transaksi...' : 'Simpan Transaksi'}
                </Button>
              </div>
            </div>
          )}
        </form>
      </div>
      )}

      {/* BOX: DAFTAR TRANSAKSI (Riwayat Transaksi yang Telah Dijurnal, Persis Gambar 4) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Header Daftar Transaksi */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Daftar Transaksi</h3>
              <p className="text-xs text-slate-400">
                {displayedTableJournals.length} dari {filteredJournals.length} transaksi {selectedMonth === 'ALL' ? `tahun ${selectedYear}` : `di bulan ini`}
              </p>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            {/* Search Input Box */}
            <div className="relative min-w-[220px] sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Cari kode (BKM/001), umat..."
                value={searchDocQuery}
                onChange={(e) => setSearchDocQuery(e.target.value)}
                className="pl-8 pr-7 h-9 text-xs rounded-xl bg-slate-50/70 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 transition"
              />
              {searchDocQuery && (
                <button
                  type="button"
                  onClick={() => setSearchDocQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  title="Hapus pencarian"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Arus View Buttons */}
            <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setFilterArusView('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  filterArusView === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setFilterArusView('MASUK')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  filterArusView === 'MASUK'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Uang Masuk
              </button>
              <button
                type="button"
                onClick={() => setFilterArusView('KELUAR')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  filterArusView === 'KELUAR'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Uang Keluar
              </button>
            </div>
          </div>
        </div>

        {/* Content Table or Empty State (Persis Gambar 4) */}
        <div className="p-0">
          {displayedTableJournals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
              <div className="text-3xl font-extralight text-slate-400">&gt;</div>
              <div className="text-sm font-medium text-slate-600">Belum ada transaksi {selectedMonth === 'ALL' ? `pada tahun ${selectedYear}` : `di bulan ini`}</div>
              <div className="text-xs text-slate-400">Gunakan form di atas untuk mulai mencatat transaksi jurnal</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80 text-xs font-bold text-slate-700 border-b border-slate-200">
                  <TableRow>
                    <TableHead className="w-36 text-slate-800 font-bold">No. Dokumen / Ref</TableHead>
                    <TableHead className="w-28 text-slate-800 font-bold">Tanggal</TableHead>
                    <TableHead className="w-36 text-slate-800 font-bold">Arus & Rekening</TableHead>
                    <TableHead className="text-slate-800 font-bold">Umat / KK</TableHead>
                    <TableHead className="text-slate-800 font-bold">Keterangan / Jenis</TableHead>
                    <TableHead className="w-32 text-right text-slate-800 font-bold">Nominal</TableHead>
                    <TableHead className="w-12 text-center text-slate-800 font-bold">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100 text-xs">
                  {displayedTableJournals.map((j, idx) => {
                    const docNumber = getDisplayNoBukti(j, idx + 1)
                    const isKas = j.sumber_kas === 'KAS' || j.coa_debit === '1200' || j.coa_kredit === '1200'
                    const displayKetClean = cleanDisplayKeterangan(j.keterangan) || (j.tipe_arus === 'MASUK' ? 'Penerimaan Kas' : 'Pengeluaran Kas')

                    return (
                      <TableRow key={j.id} className="hover:bg-slate-50/80 transition">
                        <TableCell className="font-mono whitespace-nowrap">
                          <span className="font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                            {docNumber}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-slate-700 whitespace-nowrap">
                          {formatDateIndo(j.tanggal)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                  j.tipe_arus === 'MASUK'
                                    ? 'bg-teal-50/50 text-teal-600 border-teal-100/50'
                                    : 'bg-rose-50/50 text-rose-600 border-rose-100/50'
                                }`}
                              >
                                {j.tipe_arus === 'MASUK' ? 'Uang Masuk' : 'Uang Keluar'}
                              </span>
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-50/50 text-slate-500 border border-slate-200/50">
                                {isKas ? 'KAS' : 'BANK'}
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              D: {j.coa_debit} • K: {j.coa_kredit}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-slate-900">
                          {(() => {
                            const linkedKk = kkList.find(k => k.id === j.kk_id)
                            const displayNamaKk = linkedKk?.nama_kk || j.kepala_keluarga?.nama_kk
                            return displayNamaKk || (
                              <span className="text-slate-500 italic">Umum / Kolektif</span>
                            )
                          })()}
                        </TableCell>
                        <TableCell className="text-slate-800 font-medium">
                          <div className="font-semibold text-slate-900">{displayKetClean}</div>
                          {j.sumber_setoran && (
                            <span
                              className={`inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded border ${
                                j.sumber_setoran === 'DANA_LINGKUNGAN'
                                  ? 'bg-indigo-50/50 text-indigo-600 border-indigo-100/50'
                                  : j.sumber_setoran === 'PAROKI'
                                  ? 'bg-sky-50/50 text-sky-600 border-sky-100/50'
                                  : j.sumber_setoran === 'ORANG_LAIN'
                                  ? 'bg-amber-50/50 text-amber-600 border-amber-100/50'
                                  : 'bg-slate-50/50 text-slate-500 border-slate-200/50'
                              }`}
                            >
                              {j.sumber_setoran === 'DANA_LINGKUNGAN'
                                ? 'Dari Kas Lingkungan'
                                : j.sumber_setoran === 'PAROKI'
                                ? 'Ditalangi Paroki'
                                : j.sumber_setoran === 'ORANG_LAIN'
                                ? 'Donasi Umat Lain'
                                : 'Bayar Mandiri'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className={`text-right font-mono font-bold text-sm ${j.tipe_arus === 'MASUK' ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {j.tipe_arus === 'MASUK' ? '+' : '-'} {formatRupiah(Number(j.nominal))}
                        </TableCell>
                        <TableCell className="text-center">
                          {!isParoki && !j.is_posted && (
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
                    )
                  })}
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
              Buku Jurnal Double Entry — {selectedMonth === 'ALL' ? `Seluruh Transaksi Tahun ${selectedYear}` : `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`}
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
                  <TableHead className="w-28 text-right text-emerald-700">Debit (Rp)</TableHead>
                  <TableHead className="w-28 text-right text-rose-700">Kredit (Rp)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100 text-xs">
                {filteredJournals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-slate-400">
                      Belum ada transaksi pada {selectedMonth === 'ALL' ? `tahun ${selectedYear}` : `bulan ini`}.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredJournals.map((j, idx) => (
                    <React.Fragment key={j.id}>
                      {/* Debit row */}
                      <TableRow className="bg-white hover:bg-slate-50">
                        <TableCell className="font-mono text-[11px] align-top whitespace-nowrap">
                          <div>{j.tanggal}</div>
                          <div className="text-[10px] font-bold text-slate-700 font-mono mt-1 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 inline-block">
                            {getDisplayNoBukti(j, idx + 1)}
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-slate-900">
                          {j.coa_debit} — {resolveCoaDetails(j.coa_debit).nama_akun}
                          <div className="text-[11px] font-normal text-slate-500 mt-0.5">{cleanDisplayKeterangan(j.keterangan)}</div>
                        </TableCell>
                        <TableCell className="text-center font-mono text-[11px]">{j.coa_debit}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-emerald-700">
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
                        <TableCell className="text-right font-mono font-bold text-rose-700">
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
        © {selectedYear} Gereja St Clara, Paroki Bekasi Utara — {pengurus?.bendahara_nama && pengurus.bendahara_nama !== 'Susunan pengurus belum ditentukan' ? `${pengurus.bendahara_nama} (Bendahara ${formatNamaLingkungan(lingkunganName)})` : `Bendahara ${formatNamaLingkungan(lingkunganName)} (Susunan pengurus belum ditentukan)`}
      </div>
    </div>
  )
}
