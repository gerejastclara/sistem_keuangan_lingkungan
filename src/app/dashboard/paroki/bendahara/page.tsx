'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getAllMasterLingkungan, formatNamaLingkungan, getLingkunganDbUuid, getNamaLingkunganFromAnyIdentifier, getWilayahForLingkungan } from '@/lib/constants'
import { ensureDummyKksForLingkungan, getDummyGolonganForKk, getLingkunganStats } from '@/lib/dummyData'
import { fetchAllParishKksWithGolongan } from '@/lib/dafuService'
import { isStandardUuid } from '@/lib/journalSync'
import { KepalaKeluarga, JurnalTransaksi, GolonganKeluarga } from '@/lib/types'
import { formatRupiah, MONTH_NAMES } from '@/lib/utils'
import { getAllMasterCOA } from '@/lib/masterCoa'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import {
  CreditCard,
  Building2,
  FileSpreadsheet,
  Search,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Coins,
  TrendingUp,
  Percent,
  Download,
  Filter,
  Users,
  Check,
  X,
  Clock,
  HeartHandshake,
  ArrowUpDown,
  ChevronRight,
  Info
} from 'lucide-react'

// Iuran Bulanan Standar Kas Lingkungan (COA 4100)
const STANDAR_IURAN_PER_BULAN = 20000
const BULAN_BERJALAN_CURRENT = 9 // September
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']

type SumberSetoranType = 'SENDIRI' | 'PAROKI' | 'DANA_LINGKUNGAN' | 'ORANG_LAIN'

interface SetoranDetail {
  nominal: number
  sumber: SumberSetoranType
  penalangNama?: string
}

const JENIS_KARTU_OPTIONS = [
  { code: '4100', name: 'Kas Lingkungan (KL) — COA 4100', labelShort: 'Iuran Kas Lingkungan' },
  { code: '4110', name: 'Kolekte Ibadat Sabda — COA 4110', labelShort: 'Kolekte Ibadat Sabda' },
  { code: '4120', name: 'Sumbangan Dahar Romo — COA 4120', labelShort: 'Dahar Romo' },
  { code: '4200', name: 'Sumbangan ASAK — COA 4200', labelShort: 'ASAK' },
  { code: '4300', name: 'Iuran Dana Kematian / St. Yusuf — COA 4300', labelShort: 'Dana Kematian / St. Yusuf' },
  { code: '4400', name: 'Kolekte Misa Lingkungan — COA 4400', labelShort: 'Kolekte Misa Lingkungan' },
  { code: '4500', name: 'Sumbangan Umat — COA 4500', labelShort: 'Sumbangan Umat' },
  { code: '4600', name: 'Bantuan dari Paroki — COA 4600', labelShort: 'Bantuan dari Paroki' },
  { code: '4700', name: 'Dana APP — COA 4700', labelShort: 'Dana APP' },
  { code: '4800', name: 'Dana Aksi Natal — COA 4800', labelShort: 'Aksi Natal' },
  { code: '4900', name: 'Penerimaan Lainnya — COA 4900', labelShort: 'Penerimaan Lainnya' }
]

function getDynamicJenisKartuOptions(): Array<{ code: string; name: string; labelShort: string }> {
  try {
    const master = getAllMasterCOA()
    const penerimaanList = master.filter(c => c.kategori === 'PENERIMAAN')
    if (penerimaanList.length > 0) {
      return penerimaanList.map(c => ({
        code: c.id,
        name: `${c.nama_akun} — COA ${c.id}`,
        labelShort: c.id === '4100' ? 'Iuran Kas Lingkungan' : c.nama_akun
      }))
    }
  } catch (e) {}
  return JENIS_KARTU_OPTIONS
}

export default function ParokiBendaharaPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [allLingkungan, setAllLingkungan] = useState<any[]>([])

  // Active View Tab ('REKAP' = Rekap Kas Lingkungan, 'KARTU' = Kartu Setoran)
  const [activeTab, setActiveTab] = useState<'REKAP' | 'KARTU'>('REKAP')

  // Rekapitulasi Lingkungan Filter & Sort State
  const [rekapFilterKategori, setRekapFilterKategori] = useState<'ALL' | 'BUTUH_PERHATIAN' | 'PERLU_FOLLOWUP' | 'TERTIB'>('ALL')
  const [rekapSearchText, setRekapSearchText] = useState('')
  const [rekapSortBy, setRekapSortBy] = useState<'ATTENTION_FIRST' | 'PERCENT_ASC' | 'PERCENT_DESC' | 'NOMINAL_DESC' | 'NAME_ASC'>('ATTENTION_FIRST')

  // Selection & Filters for Kartu Setoran
  const [selectedYear, setSelectedYear] = useState<number>(2026)
  const [selectedCoa, setSelectedCoa] = useState<string>('4100')
  const [selectedLingkunganFilter, setSelectedLingkunganFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchKk, setSearchKk] = useState<string>('')
  const [showAllStatus, setShowAllStatus] = useState<boolean>(false)
  const [kartuOptions] = useState<Array<{ code: string; name: string; labelShort: string }>>(() => getDynamicJenisKartuOptions())

  // Raw Data State
  const [jurnalList, setJurnalList] = useState<JurnalTransaksi[]>([])
  const [dafuByLingkungan, setDafuByLingkungan] = useState<Record<string, KepalaKeluarga[]>>({})

  // Refs for sticky table headers when scrolling page (<main>) or table container
  const rekapTableRef = React.useRef<HTMLDivElement>(null)
  const kartuTableRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updateStickyOffsets = () => {
      ;[rekapTableRef.current, kartuTableRef.current].forEach(container => {
        if (!container) return
        const mainEl = container.closest('main')
        const rect = container.getBoundingClientRect()
        const mainTop = mainEl ? mainEl.getBoundingClientRect().top : 0
        if (rect.top < mainTop) {
          const offset = Math.min(Math.max(0, mainTop - rect.top), Math.max(0, rect.height - 48))
          container.style.setProperty('--sticky-top', `${offset}px`)
        } else {
          container.style.setProperty('--sticky-top', '0px')
        }
      })
    }

    updateStickyOffsets()
    const mainEl = document.querySelector('main')
    if (mainEl) mainEl.addEventListener('scroll', updateStickyOffsets, { passive: true })
    window.addEventListener('scroll', updateStickyOffsets, { passive: true })
    window.addEventListener('resize', updateStickyOffsets, { passive: true })

    return () => {
      if (mainEl) mainEl.removeEventListener('scroll', updateStickyOffsets)
      window.removeEventListener('scroll', updateStickyOffsets)
      window.removeEventListener('resize', updateStickyOffsets)
    }
  }, [activeTab, loading, selectedLingkunganFilter, selectedCoa, selectedYear, rekapFilterKategori])

  // Linked to Sheet State
  const [sheetModalOpen, setSheetModalOpen] = useState(false)
  const [isSyncingSheet, setIsSyncingSheet] = useState(false)
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('Hari ini, ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }))
  const spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0'

  // Load All Financial & Parish Data
  const loadParokiFinancialData = async () => {
    setLoading(true)
    try {
      const masterList = getAllMasterLingkungan()
      setAllLingkungan(masterList)

      // 1. Load All DAFU KKs per Lingkungan directly from Supabase Cloud
      const parishKks = await fetchAllParishKksWithGolongan(supabase)
      const dafuMap: Record<string, KepalaKeluarga[]> = {}
      masterList.forEach(ling => {
        const targetUuid = getLingkunganDbUuid(ling.id)
        const targetNorm = ling.nama_lingkungan.toLowerCase().replace(/[^a-z0-9]/g, '')
        const kksForLing = parishKks.filter(k =>
          k.lingkunganId === ling.id ||
          k.lingkunganId === targetUuid ||
          k.lingkunganNama.toLowerCase().replace(/[^a-z0-9]/g, '') === targetNorm
        ).map(p => ({
          id: p.id,
          lingkungan_id: p.lingkunganId,
          nama_kk: p.nama_kk,
          alamat: p.alamat || '',
          is_biduk: p.is_biduk ?? true,
          jumlah_anggota: p.jumlah_anggota || 1
        }))
        dafuMap[ling.id] = kksForLing
      })
      setDafuByLingkungan(dafuMap)

      // 2. Load Journals from DB
      let allJournals: JurnalTransaksi[] = []
      let supabaseSuccess = false
      try {
        const { data: dbJournals, error } = await supabase.from('jurnal_transaksi').select('*')
        if (!error && Array.isArray(dbJournals)) {
          supabaseSuccess = true
          allJournals = dbJournals
        }
      } catch (e) {}

      // 3. Load Locally Cached Journals from all Lingkungan
      const localJournals: JurnalTransaksi[] = []
      if (typeof window !== 'undefined') {
        try {
          masterList.forEach(ling => {
            const dbUuid = getLingkunganDbUuid(ling.id)
            const keys = [`custom_journals_${dbUuid}`, `custom_journals_${ling.id}`, `custom_journals_csv-${ling.id}`]
            keys.forEach(k => {
              const raw = localStorage.getItem(k)
              if (raw) {
                try {
                  const parsed = JSON.parse(raw)
                  if (Array.isArray(parsed)) localJournals.push(...parsed)
                } catch (e) {}
              }
            })
          })

          const rawAll = localStorage.getItem('custom_journals_all_store')
          if (rawAll) {
            try {
              const parsedAll = JSON.parse(rawAll)
              if (Array.isArray(parsedAll)) localJournals.push(...parsedAll)
            } catch (e) {}
          }
        } catch (e) {}
      }

      // Merge Unique Journals: prune items deleted in Supabase
      const cloudIds = new Set(allJournals.map(j => j.id))
      const map = new Map<string, JurnalTransaksi>()
      allJournals.forEach(j => map.set(j.id, j))
      localJournals.forEach(j => {
        if (supabaseSuccess && isStandardUuid(j.id) && !cloudIds.has(j.id)) return
        if (!map.has(j.id)) map.set(j.id, j)
      })
      const mergedJournals = Array.from(map.values())

      // Auto-tag KK jika belum terisi dari local cache tx_kk atau tag keterangan
      if (typeof window !== 'undefined') {
        mergedJournals.forEach(j => {
          if (!j.kepala_keluarga?.nama_kk) {
            const cached = localStorage.getItem(`tx_kk_${j.id}`)
            if (cached) {
              try {
                const parsed = JSON.parse(cached)
                j.kepala_keluarga = { id: parsed.id, nama_kk: parsed.nama_kk, lingkungan_id: j.lingkungan_id } as any
                if (!j.kk_id && parsed.id) j.kk_id = parsed.id
              } catch (e) {}
            } else if (j.keterangan) {
              const kkMatch = j.keterangan.match(/\[KK:\s*([^\]]+)\]/i)
              if (kkMatch) {
                const nameFromKet = kkMatch[1].trim()
                j.kepala_keluarga = { id: `kk-${nameFromKet}`, nama_kk: nameFromKet, lingkungan_id: j.lingkungan_id } as any
              }
            }
          }
        })
      }

      setJurnalList(mergedJournals)
    } catch (err) {
      console.error('Error loading paroki financial data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadParokiFinancialData()

    // Realtime listener jika bendahara/sekretaris mengupdate data
    const handleSync = () => {
      loadParokiFinancialData()
    }
    window.addEventListener('storage', handleSync)
    window.addEventListener('customJournalsUpdated', handleSync)
    window.addEventListener('dafuDataUpdated', handleSync)
    window.addEventListener('lingkunganChanged', handleSync)

    return () => {
      window.removeEventListener('storage', handleSync)
      window.removeEventListener('customJournalsUpdated', handleSync)
      window.removeEventListener('dafuDataUpdated', handleSync)
      window.removeEventListener('lingkunganChanged', handleSync)
    }
  }, [])

  // Google Sheets Push
  const handleSyncToSheet = async () => {
    setIsSyncingSheet(true)
    try {
      await fetch('/api/google-sheets/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lingkunganId: 'paroki-financial',
          namaLingkungan: 'Keuangan Seluruh Lingkungan Paroki St. Clara',
          bulan: BULAN_BERJALAN_CURRENT,
          tahun: selectedYear,
          reportData: { totalLingkungan: allLingkungan.length }
        })
      })
      setLastSyncedTime('Baru saja, ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }))
    } catch (e) {
      console.error(e)
    } finally {
      setIsSyncingSheet(false)
    }
  }

  // Filter journals for Kas Lingkungan (4100) for Rekap Kas Paroki
  const kasYearJournals = useMemo(() => {
    return jurnalList.filter(j => {
      const d = new Date(j.tanggal)
      const matchesYear = d.getFullYear() === selectedYear
      const matchesCoa = j.coa_kredit === '4100' || j.coa_debit === '4100'
      return matchesYear && matchesCoa
    })
  }, [jurnalList, selectedYear])

  // Filter journals for selected COA and Year (for Kartu Setoran)
  const coaYearJournals = useMemo(() => {
    return jurnalList.filter(j => {
      const d = new Date(j.tanggal)
      const matchesYear = d.getFullYear() === selectedYear
      const matchesCoa = j.coa_kredit === selectedCoa || j.coa_debit === selectedCoa
      return matchesYear && matchesCoa
    })
  }, [jurnalList, selectedYear, selectedCoa])

  // Build KK Payment Map: Key = kkId or (lingkunganId + nama_kk) -> { monthsDetail: Record<number, SetoranDetail>, totalNominal: number }
  const kkPaymentMap = useMemo(() => {
    const map = new Map<string, { monthsDetail: Record<number, SetoranDetail>; totalNominal: number }>()

    coaYearJournals.forEach(j => {
      if (j.no_bukti?.startsWith('[SA/') || (j.keterangan || '').includes('[SALDO_AWAL]')) return
      const d = new Date(j.tanggal)
      const month = d.getMonth() + 1
      const rawNominal = Number(j.nominal) || 0
      const isPengurangan = j.tipe_arus === 'KELUAR' || (j.coa_debit === selectedCoa && j.coa_kredit !== selectedCoa)
      const nominal = isPengurangan ? -Math.abs(rawNominal) : Math.abs(rawNominal)

      let kkKey = j.kk_id
      if (!kkKey || kkKey === 'umum') {
        if (j.kepala_keluarga?.id && j.kepala_keluarga.id !== 'umum') {
          kkKey = j.kepala_keluarga.id
        } else if (j.kepala_keluarga?.nama_kk) {
          kkKey = `${j.lingkungan_id}_${j.kepala_keluarga.nama_kk.toLowerCase().trim()}`
        }
      }

      let sumber: SumberSetoranType = 'SENDIRI'
      let penalangNama: string | undefined = undefined
      if (
        j.sumber_setoran === 'DANA_LINGKUNGAN' ||
        (j.keterangan || '').toLowerCase().includes('kas lingkungan') ||
        (j.keterangan || '').toLowerCase().includes('dana lingkungan') ||
        (j.keterangan || '').toLowerCase().includes('subsidi')
      ) {
        sumber = 'DANA_LINGKUNGAN'
      } else if (
        j.sumber_setoran === 'PAROKI' ||
        (j.keterangan || '').toLowerCase().includes('talangan paroki') ||
        (j.keterangan || '').toLowerCase().includes('ditalangi paroki')
      ) {
        sumber = 'PAROKI'
      } else if (
        j.sumber_setoran === 'ORANG_LAIN' ||
        (j.keterangan || '').toLowerCase().includes('donasi') ||
        (j.keterangan || '').toLowerCase().includes('ditalangi')
      ) {
        sumber = 'ORANG_LAIN'
        const match = (j.keterangan || '').match(/\((?:Ditalangi|Donasi)\s+([^)]+)\)/i)
        penalangNama = match ? match[1].trim() : (j.keterangan || undefined)
      }

      if (kkKey) {
        const cur = map.get(kkKey) || { monthsDetail: {}, totalNominal: 0 }
        const existingMonth = cur.monthsDetail[month]
        if (existingMonth) {
          existingMonth.nominal += nominal
          if (sumber !== 'SENDIRI') {
            existingMonth.sumber = sumber
            existingMonth.penalangNama = penalangNama
          }
        } else {
          cur.monthsDetail[month] = {
            nominal,
            sumber,
            penalangNama
          }
        }
        cur.totalNominal += nominal
        map.set(kkKey, cur)
      }
    })

    return map
  }, [coaYearJournals])

  // =========================================================================
  // REKAP REALISASI IURAN KAS PER LINGKUNGAN (TARGET, REALISASI, PERSENTASE & STATUS ROMO)
  // =========================================================================
  const rekapCapaianLingkungan = useMemo(() => {
    let grandTotalKk = 0
    let grandTotalKkWajib = 0
    let grandTotalKkBebas = 0
    let grandTotalTarget = 0
    let grandTotalRealisasi = 0
    let countButuhPerhatian = 0
    let countPerluFollowup = 0
    let countTertib = 0

    const list = allLingkungan.map(ling => {
      const rawKks = dafuByLingkungan[ling.id] || []
      const kks = rawKks.filter(k => {
        const al = (k.alamat || '').toLowerCase()
        return !al.includes('[pindah]') && !al.includes('[keluar]') && al !== 'pindah / keluar'
      })
      const stats = getLingkunganStats(ling.id, ling.nama_lingkungan)
      const jumlahKkTotal = kks.length > 0 ? kks.length : (stats.kkCount > 0 ? stats.kkCount : 0)
      grandTotalKk += jumlahKkTotal

      // KK Bebas Iuran (Golongan Tidak Mampu / Subsidi)
      const kkBebasCount = kks.filter(k => {
        const gol = getDummyGolonganForKk(k)
        return gol.golongan === 'Tidak Mampu'
      }).length

      const kkWajibCount = Math.max(0, jumlahKkTotal - kkBebasCount)
      grandTotalKkWajib += kkWajibCount
      grandTotalKkBebas += kkBebasCount

      // Target iuran s/d bulan berjalan (KK Wajib * Standar Iuran * Bulan Berjalan)
      const targetKas = kkWajibCount * STANDAR_IURAN_PER_BULAN * BULAN_BERJALAN_CURRENT
      grandTotalTarget += targetKas

      // Realisasi iuran kas lingkungan ini
      const dbUuid = getLingkunganDbUuid(ling.id)
      const lingJournals = kasYearJournals.filter(j =>
        j.lingkungan_id === ling.id || j.lingkungan_id === dbUuid || j.lingkungan_id === `csv-${ling.id}`
      )
      const realisasiIuran = lingJournals.reduce((sum, j) => {
        if (j.no_bukti?.startsWith('[SA/') || (j.keterangan || '').includes('[SALDO_AWAL]')) return sum
        const rawNom = Number(j.nominal) || 0
        const isPengurangan = j.tipe_arus === 'KELUAR' || (j.coa_debit === '4100' && j.coa_kredit !== '4100')
        return sum + (isPengurangan ? -Math.abs(rawNom) : Math.abs(rawNom))
      }, 0)
      grandTotalRealisasi += realisasiIuran

      const persentaseCapaian = targetKas > 0 ? Number(((realisasiIuran / targetKas) * 100).toFixed(1)) : 0

      // Kategori Perhatian Romo (Soft, Muted, Minimalist & Tidak Neon)
      let statusKategori: 'BUTUH_PERHATIAN' | 'PERLU_FOLLOWUP' | 'TERTIB' = 'BUTUH_PERHATIAN'
      let statusLabel = 'Butuh Perhatian Romo'
      let badgeClass = 'bg-[#F6F3F3] text-[#6B5353] border-[#E4DCDC]'
      let barClass = 'bg-[#8C6D6D]'
      let barBg = 'bg-slate-100'
      let deskripsi = 'Capaian < 35%, partisipasi kas sangat minim. Perlu perhatian & kunjungan pastoral Romo.'

      if (persentaseCapaian >= 70) {
        statusKategori = 'TERTIB'
        statusLabel = 'Mandiri & Tertib'
        badgeClass = 'bg-[#F2F5F3] text-[#4E6358] border-[#DCE5DF]'
        barClass = 'bg-[#637D6F]'
        barBg = 'bg-slate-100'
        deskripsi = 'Capaian ≥ 70%, kas lingkungan sehat dan tertib.'
        countTertib++
      } else if (persentaseCapaian >= 35) {
        statusKategori = 'PERLU_FOLLOWUP'
        statusLabel = 'Perlu Follow-up'
        badgeClass = 'bg-[#F6F4F0] text-[#6B5F4E] border-[#E5DFD5]'
        barClass = 'bg-[#8C7B65]'
        barBg = 'bg-slate-100'
        deskripsi = 'Capaian 35%–69%, ada setoran tapi perlu diingatkan agar tunggakan terkejar.'
        countPerluFollowup++
      } else {
        countButuhPerhatian++
      }

      const wilayah = getWilayahForLingkungan(ling.nama_lingkungan || ling.id)

      return {
        lingkunganId: ling.id,
        namaLingkungan: ling.nama_lingkungan,
        wilayah,
        jumlahKkTotal,
        kkWajibCount,
        kkBebasCount,
        targetKas,
        realisasiIuran,
        persentaseCapaian,
        statusKategori,
        statusLabel,
        badgeClass,
        barClass,
        barBg,
        deskripsi
      }
    })

    const grandTotalPersentase = grandTotalTarget > 0 ? Number(((grandTotalRealisasi / grandTotalTarget) * 100).toFixed(1)) : 0

    return {
      list,
      grandTotalKk,
      grandTotalKkWajib,
      grandTotalKkBebas,
      grandTotalTarget,
      grandTotalRealisasi,
      grandTotalPersentase,
      countButuhPerhatian,
      countPerluFollowup,
      countTertib
    }
  }, [allLingkungan, dafuByLingkungan, kasYearJournals])

  // Filter & Urutkan Daftar Rekapitulasi Lingkungan
  const filteredRekapList = useMemo(() => {
    return rekapCapaianLingkungan.list
      .filter(item => {
        if (rekapFilterKategori !== 'ALL' && item.statusKategori !== rekapFilterKategori) {
          return false
        }
        if (rekapSearchText.trim()) {
          const q = rekapSearchText.toLowerCase()
          const matchName = item.namaLingkungan.toLowerCase().includes(q)
          const matchWil = item.wilayah.toLowerCase().includes(q)
          if (!matchName && !matchWil) return false
        }
        return true
      })
      .sort((a, b) => {
        if (rekapSortBy === 'ATTENTION_FIRST') {
          const weight = { BUTUH_PERHATIAN: 0, PERLU_FOLLOWUP: 1, TERTIB: 2 }
          if (weight[a.statusKategori] !== weight[b.statusKategori]) {
            return weight[a.statusKategori] - weight[b.statusKategori]
          }
          return a.persentaseCapaian - b.persentaseCapaian
        }
        if (rekapSortBy === 'PERCENT_ASC') return a.persentaseCapaian - b.persentaseCapaian
        if (rekapSortBy === 'PERCENT_DESC') return b.persentaseCapaian - a.persentaseCapaian
        if (rekapSortBy === 'NOMINAL_DESC') return b.realisasiIuran - a.realisasiIuran
        if (rekapSortBy === 'NAME_ASC') return a.namaLingkungan.localeCompare(b.namaLingkungan)
        return 0
      })
  }, [rekapCapaianLingkungan.list, rekapFilterKategori, rekapSearchText, rekapSortBy])

  // Aksi Klik Lihat Umat: Set filter dan pindah ke Tab 2 (Kartu Setoran)
  const handleSelectLingkunganForUmat = (lingId: string) => {
    setSelectedLingkunganFilter(lingId)
    setActiveTab('KARTU')
  }

  // =========================================================================
  // DETAIL KARTU SETORAN (SELARAS DENGAN BENDAHARA LINGKUNGAN)
  // =========================================================================
  const allUmatSetoranList = useMemo(() => {
    const rows: Array<{
      lingkunganId: string
      lingkunganNama: string
      kk: KepalaKeluarga
      golongan: GolonganKeluarga
      monthsDetail: Record<number, SetoranDetail>
      paidMonths: number[]
      totalBayar: number
      statusUmat: 'AKTIF' | 'PINDAH' | 'KELUAR'
    }> = []

    allLingkungan.forEach(ling => {
      // Jika ada filter lingkungan
      if (selectedLingkunganFilter !== 'ALL') {
        const targetUuid = getLingkunganDbUuid(selectedLingkunganFilter).toLowerCase()
        const lingUuid = getLingkunganDbUuid(ling.id).toLowerCase()
        if (
          ling.id !== selectedLingkunganFilter &&
          lingUuid !== targetUuid &&
          ling.nama_lingkungan.toLowerCase() !== selectedLingkunganFilter.toLowerCase()
        ) {
          return
        }
      }

      const kks = dafuByLingkungan[ling.id] || []
      kks.forEach(k => {
        const gol = getDummyGolonganForKk(k)

        // Cek pembayaran KK ini
        const dbUuid = getLingkunganDbUuid(ling.id)
        const payInfo1 = kkPaymentMap.get(k.id)
        const payInfo2 = kkPaymentMap.get(`${ling.id}_${k.nama_kk.toLowerCase().trim()}`)
        const payInfo3 = kkPaymentMap.get(`${dbUuid}_${k.nama_kk.toLowerCase().trim()}`)

        const mergedMonths: Record<number, SetoranDetail> = {}
        let totalBayar = 0

        const mergeFrom = (info?: { monthsDetail: Record<number, SetoranDetail>; totalNominal: number }) => {
          if (!info) return
          Object.entries(info.monthsDetail).forEach(([mStr, det]) => {
            const m = Number(mStr)
            if (!mergedMonths[m]) {
              mergedMonths[m] = { ...det }
            } else {
              mergedMonths[m].nominal += det.nominal
              if (det.sumber !== 'SENDIRI') {
                mergedMonths[m].sumber = det.sumber
                mergedMonths[m].penalangNama = det.penalangNama
              }
            }
          })
          totalBayar += info.totalNominal
        }

        mergeFrom(payInfo1)
        mergeFrom(payInfo2)
        mergeFrom(payInfo3)

        const paidMonths = Object.keys(mergedMonths).map(Number).sort((a, b) => a - b)

        const combinedText = `${k.alamat || ''} ${k.nama_kk || ''}`.toLowerCase()
        let statusUmat: 'AKTIF' | 'PINDAH' | 'KELUAR' = 'AKTIF'
        if (combinedText.includes('pindah')) statusUmat = 'PINDAH'
        else if (combinedText.includes('keluar')) statusUmat = 'KELUAR'

        rows.push({
          lingkunganId: ling.id,
          lingkunganNama: ling.nama_lingkungan,
          kk: k,
          golongan: gol,
          monthsDetail: mergedMonths,
          paidMonths,
          totalBayar,
          statusUmat
        })
      })
    })

    return rows.filter(item => {
      if (searchKk) {
        const q = searchKk.toLowerCase()
        const matchName = item.kk.nama_kk.toLowerCase().includes(q)
        const matchNo = (item.kk.no_kk || '').toLowerCase().includes(q)
        const matchLing = item.lingkunganNama.toLowerCase().includes(q)
        if (!matchName && !matchNo && !matchLing) return false
      }

      return true
    })
  }, [allLingkungan, dafuByLingkungan, kkPaymentMap, selectedLingkunganFilter, searchKk, showAllStatus])

  // Statistik Kartu Setoran (Jumlah KK yang Setor & Total Setoran Tahun Ini)
  const kartuSetoranStats = useMemo(() => {
    let totalKkCount = 0
    let grandTotalSetoran = 0
    allUmatSetoranList.forEach(item => {
      if (item.totalBayar > 0) {
        totalKkCount++
        grandTotalSetoran += item.totalBayar
      }
    })
    return { totalKkCount, grandTotalSetoran }
  }, [allUmatSetoranList])

  const selectedCoaObj = useMemo(() => {
    return kartuOptions.find(c => c.code === selectedCoa) || kartuOptions[0] || { code: selectedCoa, name: `COA ${selectedCoa}`, labelShort: `COA ${selectedCoa}` }
  }, [kartuOptions, selectedCoa])

  // Export Realisasi Kas CSV
  const handleExportCapaianCsv = () => {
    const rows = [
      ['REKAPITULASI CAPAIAN IURAN KAS LINGKUNGAN & STATUS PERHATIAN ROMO'],
      ['GEREJA ST CLARA - PAROKI BEKASI UTARA'],
      [`Tahun Buku: ${selectedYear} (Periode s/d Bulan ke-${BULAN_BERJALAN_CURRENT} - ${MONTH_NAMES[BULAN_BERJALAN_CURRENT - 1]})`],
      [`Standar Iuran: Rp ${STANDAR_IURAN_PER_BULAN.toLocaleString('id-ID')} / KK / Bulan`],
      [`Tanggal Ekspor: ${new Date().toLocaleDateString('id-ID')}`],
      [''],
      [
        'No',
        'Nama Lingkungan',
        'Wilayah',
        'Total KK',
        'KK Wajib Iuran',
        'KK Bebas Iuran (Subsidi)',
        'Target Kas s/d Bulan Ini (Rp)',
        'Realisasi Kas Terkumpul (Rp)',
        'Capaian (%)',
        'Status Pastoral Romo',
        'Catatan Rekomendasi'
      ]
    ]

    filteredRekapList.forEach((item, idx) => {
      rows.push([
        String(idx + 1),
        formatNamaLingkungan(item.namaLingkungan),
        item.wilayah,
        String(item.jumlahKkTotal),
        String(item.kkWajibCount),
        String(item.kkBebasCount),
        String(item.targetKas),
        String(item.realisasiIuran),
        `${item.persentaseCapaian}%`,
        item.statusLabel,
        item.deskripsi
      ])
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const link = document.createElement('a')
    link.href = encodeURI(csvContent)
    link.download = `Rekap_Capaian_Kas_Lingkungan_${selectedYear}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Export Kartu Setoran Excel / CSV (12 Bulan Jan-Des selaras dengan Bendahara Lingkungan)
  const handleExportUmatCsv = () => {
    const headers = ['No', 'Lingkungan', 'Nama Kepala Keluarga', ...SHORT_MONTHS, 'Total Setoran (Rp)']
    const rows = allUmatSetoranList.map((item, idx) => {
      let totalKk = 0
      const monthCols = Array.from({ length: 12 }, (_, i) => {
        const det = item.monthsDetail[i + 1]
        const val = det ? det.nominal : 0
        totalKk += val
        return val
      })
      return [
        idx + 1,
        `"${formatNamaLingkungan(item.lingkunganNama)}"`,
        `"${item.kk.nama_kk}"`,
        ...monthCols,
        totalKk
      ]
    })

    const lingLabel = selectedLingkunganFilter === 'ALL'
      ? 'Seluruh Lingkungan (69 Lingkungan)'
      : formatNamaLingkungan(getNamaLingkunganFromAnyIdentifier(selectedLingkunganFilter))

    const titleRows = [
      ['GEREJA ST CLARA - PAROKI BEKASI UTARA'],
      [`REKAP KARTU SETORAN: ${selectedCoaObj.name}`],
      [`Tahun: ${selectedYear} — Lingkungan: ${lingLabel}`],
      ['']
    ]

    const csvContent = 'data:text/csv;charset=utf-8,' +
      titleRows.map(r => r.join(',')).join('\n') + '\n' +
      headers.join(',') + '\n' +
      rows.map(r => r.join(',')).join('\n')

    const link = document.createElement('a')
    link.href = encodeURI(csvContent)
    link.download = `Kartu_Setoran_${selectedCoaObj.labelShort.replace(/\s+/g, '_')}_${selectedYear}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#18539E]"></div>
      </div>
    )
  }

  const sortLabels: Record<string, string> = {
    ATTENTION_FIRST: 'Prioritas Perhatian Romo',
    PERCENT_ASC: 'Capaian Terendah (0% - 100%)',
    PERCENT_DESC: 'Capaian Tertinggi (100% - 0%)',
    NOMINAL_DESC: 'Realisasi Terbesar',
    NAME_ASC: 'Nama Lingkungan (A-Z)'
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 text-slate-800">
      {/* Top Banner Header - Clean, Soft & Minimalist */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100/90 border border-slate-200/80 flex items-center justify-center shrink-0">
            <Coins className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200/80">
                Pengawas &amp; Bendahara Paroki
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Gereja St. Clara • Paroki Bekasi Utara
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tracking-tight font-serif">
              Monitoring Keuangan &amp; Kartu Setoran Seluruh Lingkungan
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Pantau kepatuhan setoran, nominal iuran, capaian persentase kas, dan status kesimpulan pembayaran tiap keluarga.
            </p>
          </div>
        </div>

        {/* Action Buttons: Linked to Sheet (Soft Grey) & Refresh */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setSheetModalOpen(true)}
            className="bg-slate-100/90 hover:bg-slate-200/80 text-slate-700 border-slate-200/90 font-semibold h-10 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-2xs cursor-pointer transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-600" />
            Linked to Sheet
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={loadParokiFinancialData}
            className="bg-white border-slate-200/90 text-slate-600 hover:bg-slate-50 hover:text-slate-800 font-semibold h-10 px-3.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all"
            title="Sinkronkan data terbaru"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            Refresh
          </Button>
        </div>
      </div>

      {/* 4 Kartu Metrik & Pastoral Paroki (Soft & Elegant Neutral Palette) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Kas Terkumpul Paroki vs Target */}
        <Card className="bg-white border-slate-200/80 rounded-2xl shadow-2xs">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Kas Paroki Terkumpul</span>
              <div className="w-9 h-9 rounded-xl bg-slate-100/80 border border-slate-200/60 text-slate-600 flex items-center justify-center shrink-0">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {formatRupiah(rekapCapaianLingkungan.grandTotalRealisasi)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Target: {formatRupiah(rekapCapaianLingkungan.grandTotalTarget)} ({rekapCapaianLingkungan.grandTotalPersentase}%)
              </div>
              {/* Progress Bar Global Paroki */}
              <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-slate-600 rounded-full transition-all"
                  style={{ width: `${Math.min(100, rekapCapaianLingkungan.grandTotalPersentase)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Butuh Perhatian Romo */}
        <Card
          onClick={() => {
            setActiveTab('REKAP')
            setRekapFilterKategori('BUTUH_PERHATIAN')
          }}
          className={`bg-white border-slate-200/80 hover:border-slate-300 transition-all rounded-2xl shadow-2xs cursor-pointer group ${
            activeTab === 'REKAP' && rekapFilterKategori === 'BUTUH_PERHATIAN' ? 'ring-1 ring-slate-400 border-slate-400 bg-slate-50/40' : ''
          }`}
        >
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Butuh Perhatian Romo</span>
              <div className="w-9 h-9 rounded-xl bg-[#F6F3F3] border border-[#E4DCDC] text-[#6B5353] flex items-center justify-center shrink-0 group-hover:bg-[#EFEAEA] transition-colors">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {rekapCapaianLingkungan.countButuhPerhatian}{' '}
                <span className="text-xs font-medium text-slate-500">Lingkungan</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Capaian &lt; 35% atau belum ada setoran
              </div>
              <div className="text-[11px] text-slate-500 group-hover:text-slate-800 font-medium mt-3 flex items-center gap-1 transition-colors">
                <span>Klik untuk saring data</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Perlu Follow-up */}
        <Card
          onClick={() => {
            setActiveTab('REKAP')
            setRekapFilterKategori('PERLU_FOLLOWUP')
          }}
          className={`bg-white border-slate-200/80 hover:border-slate-300 transition-all rounded-2xl shadow-2xs cursor-pointer group ${
            activeTab === 'REKAP' && rekapFilterKategori === 'PERLU_FOLLOWUP' ? 'ring-1 ring-slate-400 border-slate-400 bg-slate-50/40' : ''
          }`}
        >
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Perlu Follow-up</span>
              <div className="w-9 h-9 rounded-xl bg-[#F6F4F0] border border-[#E5DFD5] text-[#6B5F4E] flex items-center justify-center shrink-0 group-hover:bg-[#EFECE6] transition-colors">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {rekapCapaianLingkungan.countPerluFollowup}{' '}
                <span className="text-xs font-medium text-slate-500">Lingkungan</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Capaian 35% – 69% (perlu diingatkan)
              </div>
              <div className="text-[11px] text-slate-500 group-hover:text-slate-800 font-medium mt-3 flex items-center gap-1 transition-colors">
                <span>Klik untuk saring data</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mandiri & Tertib */}
        <Card
          onClick={() => {
            setActiveTab('REKAP')
            setRekapFilterKategori('TERTIB')
          }}
          className={`bg-white border-slate-200/80 hover:border-slate-300 transition-all rounded-2xl shadow-2xs cursor-pointer group ${
            activeTab === 'REKAP' && rekapFilterKategori === 'TERTIB' ? 'ring-1 ring-slate-400 border-slate-400 bg-slate-50/40' : ''
          }`}
        >
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Mandiri &amp; Tertib</span>
              <div className="w-9 h-9 rounded-xl bg-[#F2F5F3] border border-[#DCE5DF] text-[#4E6358] flex items-center justify-center shrink-0 group-hover:bg-[#E7ECE9] transition-colors">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {rekapCapaianLingkungan.countTertib}{' '}
                <span className="text-xs font-medium text-slate-500">Lingkungan</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Capaian &ge; 70% s/d bulan {MONTH_NAMES[BULAN_BERJALAN_CURRENT - 1]}
              </div>
              <div className="text-[11px] text-slate-500 group-hover:text-slate-800 font-medium mt-3 flex items-center gap-1 transition-colors">
                <span>Klik untuk saring data</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================== */}
      {/* SEGMENTED 2-TAB SWITCHER (REKAP KAS LINGKUNGAN vs KARTU SETORAN) */}
      {/* ============================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
        <div className="inline-flex p-1 rounded-2xl bg-slate-100/90 border border-slate-200/80 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('REKAP')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'REKAP'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Rekap Kas Lingkungan</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200/80">
              {allLingkungan.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('KARTU')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'KARTU'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 text-slate-500" />
            <span>Kartu Setoran</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200/80 max-w-[140px] truncate">
              {selectedLingkunganFilter === 'ALL' ? 'Semua' : formatNamaLingkungan(getNamaLingkunganFromAnyIdentifier(selectedLingkunganFilter)).replace('Lingkungan ', '')}
            </span>
          </button>
        </div>

        <span className="text-[11px] text-slate-400">
          {activeTab === 'REKAP'
            ? 'Klik "Lihat Kartu Setoran →" pada baris lingkungan untuk membuka kartu setoran KK'
            : 'Rekapitulasi kartu setoran bulanan per Kepala Keluarga'}
        </span>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: TABEL REKAPITULASI IURAN KAS TIAP LINGKUNGAN */}
      {/* ============================================================== */}
      {activeTab === 'REKAP' && (
        <Card id="rekap-kas-section" className="bg-white border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden scroll-mt-6">
          <CardHeader className="p-5 border-b border-slate-200/80 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-bold text-slate-900 font-serif">
                    Rekapitulasi Capaian Iuran Kas Seluruh Lingkungan
                  </CardTitle>
                  <span className="text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md">
                    {allLingkungan.length} Lingkungan
                  </span>
                </div>
                <CardDescription className="text-xs text-slate-500 mt-1">
                  Rumus: <strong className="text-slate-700 font-semibold">Target Kas</strong> = Jumlah KK Wajib &times; Rp 20.000 &times; {BULAN_BERJALAN_CURRENT} Bulan (KK Tidak Mampu dikecualikan dari beban target).
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleExportCapaianCsv}
                className="border-slate-200/90 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl h-9 px-3.5 cursor-pointer shrink-0 self-start sm:self-auto shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                Unduh Rekap Kas
              </Button>
            </div>

            {/* Filter Kategori & Kontrol Pencarian / Pengurutan */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-slate-100">
              {/* Tabs Filter Kategori Pastoral (Minimalist Soft Pills) */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setRekapFilterKategori('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                    rekapFilterKategori === 'ALL'
                      ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                      : 'bg-slate-50/80 text-slate-600 border-slate-200/80 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  Semua Lingkungan ({rekapCapaianLingkungan.list.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRekapFilterKategori('BUTUH_PERHATIAN')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border flex items-center gap-1.5 ${
                    rekapFilterKategori === 'BUTUH_PERHATIAN'
                      ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                      : 'bg-slate-50/80 text-slate-600 border-slate-200/80 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${rekapFilterKategori === 'BUTUH_PERHATIAN' ? 'bg-[#D4B2B2]' : 'bg-[#9E7B7B]'}`} />
                  Butuh Perhatian Romo ({rekapCapaianLingkungan.countButuhPerhatian})
                </button>
                <button
                  type="button"
                  onClick={() => setRekapFilterKategori('PERLU_FOLLOWUP')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border flex items-center gap-1.5 ${
                    rekapFilterKategori === 'PERLU_FOLLOWUP'
                      ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                      : 'bg-slate-50/80 text-slate-600 border-slate-200/80 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${rekapFilterKategori === 'PERLU_FOLLOWUP' ? 'bg-[#D6C5A9]' : 'bg-[#9E8C70]'}`} />
                  Perlu Follow-up ({rekapCapaianLingkungan.countPerluFollowup})
                </button>
                <button
                  type="button"
                  onClick={() => setRekapFilterKategori('TERTIB')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border flex items-center gap-1.5 ${
                    rekapFilterKategori === 'TERTIB'
                      ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                      : 'bg-slate-50/80 text-slate-600 border-slate-200/80 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${rekapFilterKategori === 'TERTIB' ? 'bg-[#A8C4B5]' : 'bg-[#688777]'}`} />
                  Mandiri &amp; Tertib ({rekapCapaianLingkungan.countTertib})
                </button>
              </div>

              {/* Pencarian Lingkungan & Sort */}
              <div className="flex items-center gap-2">
                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={rekapSearchText}
                    onChange={(e) => setRekapSearchText(e.target.value)}
                    placeholder="Cari lingkungan / wilayah..."
                    className="pl-8 bg-slate-50/60 border-slate-200/90 text-slate-800 text-xs rounded-xl h-9 focus:bg-white"
                  />
                </div>

                <Select value={rekapSortBy} onValueChange={(val: any) => setRekapSortBy(val)}>
                  <SelectTrigger className="w-52 bg-slate-50/60 border-slate-200/90 text-slate-700 text-xs font-medium rounded-xl h-9">
                    <span className="truncate">{sortLabels[rekapSortBy] || 'Prioritas Perhatian Romo'}</span>
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-slate-800 text-xs">
                    <SelectItem value="ATTENTION_FIRST">Prioritas Perhatian Romo</SelectItem>
                    <SelectItem value="PERCENT_ASC">Capaian Terendah (0% - 100%)</SelectItem>
                    <SelectItem value="PERCENT_DESC">Capaian Tertinggi (100% - 0%)</SelectItem>
                    <SelectItem value="NOMINAL_DESC">Realisasi Terbesar</SelectItem>
                    <SelectItem value="NAME_ASC">Nama Lingkungan (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div ref={rekapTableRef} className="overflow-auto max-h-[540px]">
              <table className="w-full caption-bottom text-xs border-separate border-spacing-0">
                <TableHeader className="bg-slate-100 sticky z-20">
                  <TableRow className="bg-slate-100">
                    <TableHead style={{ top: 'var(--sticky-top, 0px)' }} className="sticky z-20 bg-slate-100 border-b border-slate-200/90 w-12 text-center font-semibold text-slate-700 shadow-2xs">No</TableHead>
                    <TableHead style={{ top: 'var(--sticky-top, 0px)' }} className="sticky z-20 bg-slate-100 border-b border-slate-200/90 w-48 font-semibold text-slate-700 shadow-2xs">Lingkungan &amp; Wilayah</TableHead>
                    <TableHead style={{ top: 'var(--sticky-top, 0px)' }} className="sticky z-20 bg-slate-100 border-b border-slate-200/90 w-32 text-center font-semibold text-slate-700 shadow-2xs">Jumlah KK</TableHead>
                    <TableHead style={{ top: 'var(--sticky-top, 0px)' }} className="sticky z-20 bg-slate-100 border-b border-slate-200/90 w-36 text-right font-semibold text-slate-700 shadow-2xs">Target Kas (Rp)</TableHead>
                    <TableHead style={{ top: 'var(--sticky-top, 0px)' }} className="sticky z-20 bg-slate-100 border-b border-slate-200/90 w-36 text-right font-semibold text-slate-700 shadow-2xs">Realisasi Kas (Rp)</TableHead>
                    <TableHead style={{ top: 'var(--sticky-top, 0px)' }} className="sticky z-20 bg-slate-100 border-b border-slate-200/90 w-48 font-semibold text-slate-700 shadow-2xs">Capaian Kas (%)</TableHead>
                    <TableHead style={{ top: 'var(--sticky-top, 0px)' }} className="sticky z-20 bg-slate-100 border-b border-slate-200/90 w-44 text-center font-semibold text-slate-700 shadow-2xs">Status Pastoral</TableHead>
                    <TableHead style={{ top: 'var(--sticky-top, 0px)' }} className="sticky z-20 bg-slate-100 border-b border-slate-200/90 w-36 text-center font-semibold text-slate-700 shadow-2xs">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100">
                  {filteredRekapList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-slate-500">
                        Tidak ada lingkungan yang sesuai dengan kriteria filter saat ini.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRekapList.map((item, idx) => (
                      <TableRow key={item.lingkunganId} className="hover:bg-slate-50/70 transition-colors">
                        <TableCell className="text-center font-mono text-slate-400 font-medium">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="font-semibold text-slate-800">
                            {formatNamaLingkungan(item.namaLingkungan)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Wilayah: {item.wilayah}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="font-semibold text-slate-800">
                            {item.jumlahKkTotal} <span className="text-[11px] text-slate-400 font-normal">KK</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {item.kkWajibCount} Wajib {item.kkBebasCount > 0 ? `• ${item.kkBebasCount} Bebas` : ''}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-600 font-medium">
                          {formatRupiah(item.targetKas)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-slate-800">
                          {item.realisasiIuran > 0 ? formatRupiah(item.realisasiIuran) : 'Rp 0'}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-mono font-semibold text-slate-700">{item.persentaseCapaian}%</span>
                              <span className="text-[10px] text-slate-400">
                                {item.realisasiIuran > 0 ? 'Tercatat' : 'Belum ada'}
                              </span>
                            </div>
                            {/* Mini Progress Bar Halus & Elegan */}
                            <div className={`w-full h-1.5 rounded-full overflow-hidden ${item.barBg}`}>
                              <div
                                className={`h-full rounded-full transition-all ${item.barClass}`}
                                style={{ width: `${Math.min(100, Math.max(item.realisasiIuran > 0 ? 4 : 0, item.persentaseCapaian))}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            title={item.deskripsi}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${item.badgeClass}`}
                          >
                            {item.statusKategori === 'BUTUH_PERHATIAN' ? (
                              <AlertCircle className="w-3 h-3 shrink-0 text-[#8C6D6D]" />
                            ) : item.statusKategori === 'PERLU_FOLLOWUP' ? (
                              <Clock className="w-3 h-3 shrink-0 text-[#8C7B65]" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3 shrink-0 text-[#637D6F]" />
                            )}
                            <span>{item.statusLabel}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSelectLingkunganForUmat(item.lingkunganId)}
                            className="h-7 px-2.5 text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200/80 cursor-pointer"
                            title="Lihat rincian kartu setoran lingkungan ini"
                          >
                            Lihat Kartu Setoran →
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================================== */}
      {/* TAB 2: KARTU SETORAN (SAMA PERSIS DENGAN BENDAHARA LINGKUNGAN) */}
      {/* ============================================================== */}
      {activeTab === 'KARTU' && (
        <div id="monitoring-kartu-umat-section" className="space-y-6 scroll-mt-6">
          {/* 1. FILTER BAR ATAS */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 flex-1 min-w-0">
                {/* Filter Pilih Lingkungan */}
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs font-bold text-slate-700">Filter Lingkungan</Label>
                  <Select value={selectedLingkunganFilter} onValueChange={(val) => setSelectedLingkunganFilter(val || 'ALL')}>
                    <SelectTrigger className="w-full max-w-full overflow-hidden bg-white border-slate-200/90 text-slate-900 font-semibold rounded-xl h-11 text-xs sm:text-sm px-3.5">
                      <span className="truncate">
                        {selectedLingkunganFilter === 'ALL'
                          ? `Semua Lingkungan (${allLingkungan.length})`
                          : formatNamaLingkungan(getNamaLingkunganFromAnyIdentifier(selectedLingkunganFilter))}
                      </span>
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 text-slate-900 max-h-72 text-xs">
                      <SelectItem value="ALL" className="font-semibold">
                        Semua Lingkungan ({allLingkungan.length} Lingkungan)
                      </SelectItem>
                      {allLingkungan.map(ling => (
                        <SelectItem key={ling.id} value={ling.id}>
                          {formatNamaLingkungan(ling.nama_lingkungan)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter Jenis Setoran / Akun COA */}
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs font-bold text-slate-700">Jenis Setoran / Akun COA</Label>
                  <Select value={selectedCoa} onValueChange={(val) => setSelectedCoa(val || '4100')}>
                    <SelectTrigger className="w-full max-w-full overflow-hidden bg-white border-slate-200/90 text-slate-900 font-semibold rounded-xl h-11 text-xs sm:text-sm px-3.5">
                      <span className="truncate">{selectedCoaObj.name}</span>
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 text-slate-900 text-xs">
                      {kartuOptions.map((opt) => (
                        <SelectItem key={opt.code} value={opt.code}>
                          {opt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter Tahun Buku */}
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs font-bold text-slate-700">Tahun Buku</Label>
                  <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(parseInt(val || '2026', 10))}>
                    <SelectTrigger className="w-full max-w-full overflow-hidden bg-white border-slate-200/90 text-slate-900 font-semibold rounded-xl h-11 text-xs sm:text-sm px-3.5">
                      <span className="truncate">Tahun {selectedYear}</span>
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 text-slate-900 text-xs">
                      {[2026, 2025, 2024].map((yr) => (
                        <SelectItem key={yr} value={String(yr)}>
                          Tahun {yr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleExportUmatCsv}
                  className="border-slate-200/90 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl h-11 px-4 text-xs cursor-pointer shadow-2xs flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-4 h-4 text-slate-600" />
                  Download Excel / CSV
                </Button>
              </div>
            </div>
          </div>

          {/* 2. 2 SUMMARY METRIC BOXES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card 1: Jumlah KK yang Setor */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
              <div className="text-xs font-medium text-slate-500">Jumlah KK yang Setor</div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1.5 font-serif">
                {kartuSetoranStats.totalKkCount}
              </div>
            </div>

            {/* Card 2: Total Setoran Tahun Ini */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
              <div className="text-xs font-medium text-slate-500">Total Setoran Tahun Ini</div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1.5 font-serif">
                {formatRupiah(kartuSetoranStats.grandTotalSetoran)}
              </div>
            </div>
          </div>

          {/* 3. KOTAK REKAP SETORAN */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            {/* Header Kotak Rekap */}
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200/60">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-serif">
                    Rekap Setoran {selectedCoaObj.labelShort}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {kartuSetoranStats.grandTotalSetoran === 0
                      ? `Belum ada setoran di tahun ${selectedYear}`
                      : `${kartuSetoranStats.totalKkCount} KK telah menyetor di tahun ${selectedYear}`}
                  </p>
                </div>
              </div>

              {/* PANDUAN WARNA (LEGEND) - SOFT & ELEGANT */}
              <div className="flex flex-wrap items-center gap-2 text-xs bg-slate-50/80 border border-slate-200/80 px-3 py-2 rounded-xl">
                <span className="font-semibold text-slate-700 text-[11px] flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-slate-400" /> Keterangan:
                </span>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F2F5F3] text-[#4E6358] border border-[#DCE5DF] font-medium text-[10px]">
                  <span className="w-2 h-2 rounded-full bg-[#637D6F]"></span>
                  Bayar Sendiri
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F4F3F7] text-[#5B546E] border border-[#E0DDE8] font-medium text-[10px]">
                  <span className="w-2 h-2 rounded-full bg-[#766D8F]"></span>
                  Kas Lingkungan
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F6F4F0] text-[#6B5F4E] border border-[#E5DFD5] font-medium text-[10px]">
                  <span className="w-2 h-2 rounded-full bg-[#8C7B65]"></span>
                  Dari Donasi Umat Lain
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F6F2F2] text-[#6B5353] border border-[#DECFCF] font-medium text-[10px]">
                  <span className="w-2 h-2 rounded-full bg-[#9E7B7B]"></span>
                  Umat Pindah / Keluar
                </div>
              </div>
            </div>

            {/* Isi Kotak: Tabel Kartu Setoran 12 Bulan */}
            <div className="p-5 space-y-4">
              {/* Search Input for KK & Status Filter Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={searchKk}
                      onChange={(e) => setSearchKk(e.target.value)}
                      placeholder="Cari nama Kepala Keluarga..."
                      className="pl-9 bg-slate-50 border-slate-200 text-xs rounded-xl h-9 text-slate-900 focus:bg-white"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-100/80 hover:bg-slate-100 border border-slate-200/90 px-2.5 py-1.5 rounded-xl cursor-pointer select-none transition">
                    <input
                      type="checkbox"
                      checked={showAllStatus}
                      onChange={(e) => setShowAllStatus(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-slate-800 cursor-pointer"
                    />
                    <span>Tampilkan Umat Pindah / Keluar</span>
                  </label>
                </div>

                <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  <span>Data setoran terakumulasi otomatis dari modul Jurnal Transaksi</span>
                </div>
              </div>

              {/* Tabel 12 Bulan Kartu Setoran dengan Freeze Header Bulan (Sticky top & left) */}
              <div ref={kartuTableRef} className="border border-slate-200/90 rounded-xl overflow-auto max-h-[580px] shadow-2xs bg-white scrollbar-thin">
                <table className="w-full text-xs text-left border-separate border-spacing-0">
                  <thead className="bg-slate-100 sticky z-30">
                    <tr className="bg-slate-100">
                      <th
                        style={{ top: 'var(--sticky-top, 0px)' }}
                        className="sticky left-0 z-40 bg-slate-100 w-12 min-w-[48px] max-w-[48px] text-center font-bold text-slate-800 p-2.5 border-b-2 border-r border-slate-300 shadow-2xs"
                      >
                        No
                      </th>
                      <th
                        style={{ top: 'var(--sticky-top, 0px)' }}
                        className="sticky left-12 z-40 bg-slate-100 min-w-[220px] font-bold text-slate-800 p-2.5 border-b-2 border-r border-slate-300 shadow-xs"
                      >
                        Kepala Keluarga
                      </th>
                      {SHORT_MONTHS.map((m) => (
                        <th
                          key={m}
                          style={{ top: 'var(--sticky-top, 0px)' }}
                          className="sticky z-30 bg-slate-100 w-16 min-w-[64px] text-center font-bold text-slate-800 p-2.5 border-b-2 border-slate-300 shadow-2xs"
                        >
                          {m}
                        </th>
                      ))}
                      <th
                        style={{ top: 'var(--sticky-top, 0px)' }}
                        className="sticky z-30 bg-slate-100 w-28 min-w-[100px] text-right font-bold text-slate-800 p-2.5 pr-3 border-b-2 border-slate-300 shadow-2xs"
                      >
                        Total (Rp)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {allUmatSetoranList.length === 0 ? (
                      <tr>
                        <td colSpan={15} className="h-32 text-center text-slate-500 p-4">
                          Tidak ada data Kepala Keluarga yang sesuai dengan filter.
                        </td>
                      </tr>
                    ) : (
                      allUmatSetoranList.slice(0, 150).map((item, idx) => {
                        let totalKk = 0
                        const isPindahKeluar = item.statusUmat !== 'AKTIF'

                        return (
                          <tr
                            key={`${item.lingkunganId}-${item.kk.id}`}
                            className={`transition group ${
                              isPindahKeluar
                                ? 'bg-[#F6F2F2]/70 hover:bg-[#EFE9E9]/90'
                                : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <td
                              className={`sticky left-0 z-10 text-center font-mono text-[11px] p-2 border-b border-r w-12 min-w-[48px] max-w-[48px] transition-colors ${
                                isPindahKeluar
                                  ? 'bg-[#F6F2F2] group-hover:bg-[#EFE9E9] text-[#6B5353] border-b-[#E4DCDC] border-r-[#E4DCDC] border-l-[3px] border-l-[#9E7B7B]'
                                  : 'bg-white group-hover:bg-slate-50 text-slate-400 border-slate-100'
                              }`}
                            >
                              {idx + 1}
                            </td>
                            <td
                              className={`sticky left-12 z-10 font-semibold p-2 border-b border-r shadow-2xs min-w-[220px] transition-colors ${
                                isPindahKeluar
                                  ? 'bg-[#F6F2F2] group-hover:bg-[#EFE9E9] text-[#6B5353] border-b-[#E4DCDC] border-r-[#DECFCF]'
                                  : 'bg-white group-hover:bg-slate-50 text-slate-800 border-b-slate-100 border-r-slate-200'
                              }`}
                            >
                              <div className="flex flex-col">
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="truncate">{item.kk.nama_kk}</span>
                                  {isPindahKeluar && (
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md border border-[#DECFCF] bg-[#EFE9E9] text-[#6B5353] shrink-0">
                                      {item.statusUmat === 'KELUAR' ? 'Keluar' : 'Pindah'}
                                    </span>
                                  )}
                                </div>
                                {selectedLingkunganFilter === 'ALL' && (
                                  <span className="text-[10px] font-normal text-slate-400 mt-0.5">
                                    {formatNamaLingkungan(item.lingkunganNama)}
                                  </span>
                                )}
                              </div>
                            </td>
                            {Array.from({ length: 12 }, (_, i) => {
                              const mNum = i + 1
                              const det = item.monthsDetail[mNum]
                              const val = det ? det.nominal : 0
                              const sumber = det ? det.sumber : 'SENDIRI'
                              const penalang = det?.penalangNama
                              totalKk += val

                              return (
                                <td key={mNum} className="text-center p-1.5 font-mono text-[11px] border-b border-slate-100">
                                  {val > 0 ? (
                                    <span
                                      title={
                                        sumber === 'ORANG_LAIN'
                                          ? `Donasi Umat Lain: ${penalang || 'Donatur'} (${formatRupiah(val)})`
                                          : sumber === 'PAROKI'
                                          ? `Ditalangi Paroki (${formatRupiah(val)})`
                                          : sumber === 'DANA_LINGKUNGAN'
                                          ? `Dari Kas Lingkungan (${formatRupiah(val)})`
                                          : `Bayar Sendiri (${formatRupiah(val)})`
                                      }
                                      className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] select-none ${
                                        sumber === 'ORANG_LAIN'
                                          ? 'bg-[#F6F4F0] text-[#6B5F4E] border border-[#E5DFD5]'
                                          : sumber === 'PAROKI'
                                          ? 'bg-slate-100 text-slate-700 border border-slate-200/90'
                                          : sumber === 'DANA_LINGKUNGAN'
                                          ? 'bg-[#F4F3F7] text-[#5B546E] border border-[#E0DDE8]'
                                          : 'bg-[#F2F5F3] text-[#4E6358] border border-[#DCE5DF]'
                                      }`}
                                    >
                                      <span>{val >= 1000 ? `${val / 1000}k` : val}</span>
                                      {sumber === 'ORANG_LAIN' && <span className="text-[10px] text-[#8C7B65] font-bold">★</span>}
                                      {sumber === 'PAROKI' && <span className="text-[10px] text-slate-600 font-bold">✝</span>}
                                    </span>
                                  ) : val < 0 ? (
                                    <span
                                      title={`Pengurangan / Pengembalian Setoran (${formatRupiah(Math.abs(val))})`}
                                      className="inline-flex items-center justify-center gap-0.5 px-2 py-0.5 rounded-md font-semibold text-[11px] select-none bg-[#F6F3F3] text-[#6B5353] border border-[#E4DCDC]"
                                    >
                                      <span>-{Math.abs(val) >= 1000 ? `${Math.abs(val) / 1000}k` : Math.abs(val)}</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 font-light select-none">—</span>
                                  )}
                                </td>
                              )
                            })}
                            <td className="text-right font-mono font-bold text-slate-800 pr-3 p-2 border-b border-slate-100">
                              {totalKk > 0 ? (
                                totalKk.toLocaleString('id-ID')
                              ) : totalKk < 0 ? (
                                <span className="text-[#6B5353]">-{Math.abs(totalKk).toLocaleString('id-ID')}</span>
                              ) : Object.keys(item.monthsDetail).length > 0 ? (
                                <span className="text-slate-500">0</span>
                              ) : (
                                <span className="text-slate-300 font-normal">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {allUmatSetoranList.length > 150 && (
                <div className="p-2.5 bg-slate-50/70 rounded-xl border border-slate-200/70 text-center text-xs text-slate-500">
                  Menampilkan 150 data pertama dari {allUmatSetoranList.length} KK. Pilih filter Lingkungan spesifik atau cari nama KK di atas untuk melihat rincian lengkap.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* DIALOG LINKED TO GOOGLE SHEET */}
      {/* ============================================================== */}
      <Dialog open={sheetModalOpen} onOpenChange={setSheetModalOpen}>
        <DialogContent className="max-w-md bg-white text-slate-900 rounded-2xl border-slate-200 p-6">
          <DialogHeader>
            <div className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center mb-2">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold font-serif text-slate-900">
              Linked to Google Sheets Paroki
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Integrasi langsung untuk menarik dan memantau seluruh data kas &amp; kartu setoran dari 69 lingkungan secara terpusat di Google Spreadsheet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Status Koneksi:</span>
                <span className="inline-flex items-center gap-1 font-medium text-[#4E6358] bg-[#F2F5F3] border border-[#DCE5DF] px-2 py-0.5 rounded-full text-[11px]">
                  <CheckCircle2 className="w-3 h-3 text-[#637D6F]" /> Terhubung Aktif
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Pembaruan Terakhir:</span>
                <span className="font-semibold text-slate-800">{lastSyncedTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Total Lingkungan Tersinkron:</span>
                <span className="font-semibold text-slate-800">{allLingkungan.length} Lingkungan</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-600">Spreadsheet URL</label>
              <Input
                readOnly
                value={spreadsheetUrl}
                className="bg-slate-50 border-slate-200 text-slate-600 text-xs font-mono rounded-xl h-10 select-all"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2 flex-col sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={isSyncingSheet}
              onClick={handleSyncToSheet}
              className="border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold rounded-xl text-xs h-10 flex items-center justify-center gap-2 cursor-pointer flex-1"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingSheet ? 'animate-spin' : ''}`} />
              {isSyncingSheet ? 'Menyinkronkan...' : 'Tarik & Sinkronkan Sekarang'}
            </Button>
            <Button
              type="button"
              onClick={() => window.open(spreadsheetUrl, '_blank')}
              className="bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl text-xs h-10 flex items-center justify-center gap-2 cursor-pointer shadow-2xs flex-1"
            >
              <ExternalLink className="w-4 h-4" />
              Buka Google Sheets
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
