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
  ChevronRight
} from 'lucide-react'

// Iuran Bulanan Standar Kas Lingkungan (COA 4100)
const STANDAR_IURAN_PER_BULAN = 20000
const BULAN_BERJALAN_CURRENT = 9 // September

export default function ParokiBendaharaPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [allLingkungan, setAllLingkungan] = useState<any[]>([])

  // Rekapitulasi Lingkungan Filter & Sort State
  const [rekapFilterKategori, setRekapFilterKategori] = useState<'ALL' | 'BUTUH_PERHATIAN' | 'PERLU_FOLLOWUP' | 'TERTIB'>('ALL')
  const [rekapSearchText, setRekapSearchText] = useState('')
  const [rekapSortBy, setRekapSortBy] = useState<'ATTENTION_FIRST' | 'PERCENT_ASC' | 'PERCENT_DESC' | 'NOMINAL_DESC' | 'NAME_ASC'>('ATTENTION_FIRST')

  // Selection & Filters for Monitoring Umat
  const [selectedYear, setSelectedYear] = useState<number>(2026)
  const [selectedCoa, setSelectedCoa] = useState<string>('4100')
  const [selectedLingkunganFilter, setSelectedLingkunganFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchKk, setSearchKk] = useState<string>('')

  // Raw Data State
  const [jurnalList, setJurnalList] = useState<JurnalTransaksi[]>([])
  const [dafuByLingkungan, setDafuByLingkungan] = useState<Record<string, KepalaKeluarga[]>>({})

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

  // Filter journals for selected COA and Year
  const coaYearJournals = useMemo(() => {
    return jurnalList.filter(j => {
      const d = new Date(j.tanggal)
      const matchesYear = d.getFullYear() === selectedYear
      const matchesCoa = j.coa_kredit === selectedCoa || j.coa_debit === selectedCoa
      return matchesYear && matchesCoa
    })
  }, [jurnalList, selectedYear, selectedCoa])

  // Build KK Payment Map: Key = kkId or (lingkunganId + nama_kk) -> { months: Set<number>, totalNominal: number }
  const kkPaymentMap = useMemo(() => {
    const map = new Map<string, { months: Set<number>; totalNominal: number }>()

    coaYearJournals.forEach(j => {
      const d = new Date(j.tanggal)
      const month = d.getMonth() + 1
      const nominal = Number(j.nominal) || 0

      let kkKey = j.kk_id
      if (!kkKey || kkKey === 'umum') {
        if (j.kepala_keluarga?.id && j.kepala_keluarga.id !== 'umum') {
          kkKey = j.kepala_keluarga.id
        } else if (j.kepala_keluarga?.nama_kk) {
          kkKey = `${j.lingkungan_id}_${j.kepala_keluarga.nama_kk.toLowerCase().trim()}`
        }
      }

      if (kkKey) {
        const cur = map.get(kkKey) || { months: new Set<number>(), totalNominal: 0 }
        cur.months.add(month)
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
      const kks = dafuByLingkungan[ling.id] || []
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
      const lingJournals = coaYearJournals.filter(j =>
        j.lingkungan_id === ling.id || j.lingkungan_id === dbUuid || j.lingkungan_id === `csv-${ling.id}`
      )
      const realisasiIuran = lingJournals.reduce((sum, j) => sum + (Number(j.nominal) || 0), 0)
      grandTotalRealisasi += realisasiIuran

      const persentaseCapaian = targetKas > 0 ? Number(((realisasiIuran / targetKas) * 100).toFixed(1)) : 0

      // Kategori Perhatian Romo (Soft, Netral, Tidak Neon)
      let statusKategori: 'BUTUH_PERHATIAN' | 'PERLU_FOLLOWUP' | 'TERTIB' = 'BUTUH_PERHATIAN'
      let statusLabel = 'Butuh Perhatian Romo'
      let badgeClass = 'bg-rose-50 text-rose-800 border-rose-200/90'
      let barClass = 'bg-[#be123c]'
      let barBg = 'bg-rose-100/60'
      let deskripsi = 'Capaian < 35%, partisipasi kas sangat minim. Perlu perhatian & kunjungan pastoral Romo.'

      if (persentaseCapaian >= 70) {
        statusKategori = 'TERTIB'
        statusLabel = 'Mandiri & Tertib'
        badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200/90'
        barClass = 'bg-[#15803d]'
        barBg = 'bg-emerald-100/60'
        deskripsi = 'Capaian ≥ 70%, kas lingkungan sehat dan tertib.'
        countTertib++
      } else if (persentaseCapaian >= 35) {
        statusKategori = 'PERLU_FOLLOWUP'
        statusLabel = 'Perlu Follow-up'
        badgeClass = 'bg-amber-50 text-amber-800 border-amber-200/90'
        barClass = 'bg-[#b45309]'
        barBg = 'bg-amber-100/60'
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
  }, [allLingkungan, dafuByLingkungan, coaYearJournals])

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

  // Aksi Klik Lihat Umat: Set filter dan gulir ke tabel bawah
  const handleSelectLingkunganForUmat = (lingId: string) => {
    setSelectedLingkunganFilter(lingId)
    const element = document.getElementById('monitoring-kartu-umat-section')
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // =========================================================================
  // DETAIL MONITORING KARTU SETORAN SEMUA UMAT
  // =========================================================================
  const allUmatSetoranList = useMemo(() => {
    const rows: Array<{
      lingkunganId: string
      lingkunganNama: string
      kk: KepalaKeluarga
      golongan: GolonganKeluarga
      paidMonths: number[]
      totalBayar: number
      kesimpulanStatus: {
        label: string
        badgeClass: string
        color: string
        isLunas: boolean
      }
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
        
        const paidSet = new Set<number>()
        let totalBayar = 0
        if (payInfo1) {
          payInfo1.months.forEach(m => paidSet.add(m))
          totalBayar += payInfo1.totalNominal
        }
        if (payInfo2) {
          payInfo2.months.forEach(m => paidSet.add(m))
          totalBayar += payInfo2.totalNominal
        }
        if (payInfo3) {
          payInfo3.months.forEach(m => paidSet.add(m))
          totalBayar += payInfo3.totalNominal
        }

        const paidMonths = Array.from(paidSet).sort((a, b) => a - b)
        const paidCount = paidMonths.length

        // Tentukan Kesimpulan Status (Warna Soft & Netral Elegan, tidak neon)
        let kesimpulanStatus = {
          label: 'Belum Bayar (Tunggakan 9 Bulan)',
          badgeClass: 'bg-slate-50 text-slate-700 border-slate-200/90',
          color: 'text-slate-700',
          isLunas: false
        }

        if (gol.golongan === 'Tidak Mampu') {
          kesimpulanStatus = {
            label: 'Bebas Iuran (Subsidi Paroki)',
            badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
            color: 'text-slate-600',
            isLunas: true
          }
        } else if (paidCount >= 12) {
          kesimpulanStatus = {
            label: 'Lunas Penuh 1 Tahun (12/12 Bln)',
            badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
            color: 'text-slate-800',
            isLunas: true
          }
        } else if (paidCount >= BULAN_BERJALAN_CURRENT) {
          kesimpulanStatus = {
            label: `Lunas s/d Bulan Ini (${paidCount}/${BULAN_BERJALAN_CURRENT} Bln)`,
            badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
            color: 'text-slate-800',
            isLunas: true
          }
        } else if (paidCount > 0) {
          const sisa = BULAN_BERJALAN_CURRENT - paidCount
          kesimpulanStatus = {
            label: `Bayar Sebagian (${paidCount}/${BULAN_BERJALAN_CURRENT} Bln - Kurang ${sisa} Bln)`,
            badgeClass: 'bg-amber-50/70 text-amber-800/90 border-amber-200/70',
            color: 'text-amber-700',
            isLunas: false
          }
        }

        rows.push({
          lingkunganId: ling.id,
          lingkunganNama: ling.nama_lingkungan,
          kk: k,
          golongan: gol,
          paidMonths,
          totalBayar,
          kesimpulanStatus
        })
      })
    })

    // Filter berdasarkan status
    return rows.filter(item => {
      if (statusFilter === 'LUNAS') {
        if (!item.kesimpulanStatus.isLunas || item.golongan.golongan === 'Tidak Mampu') return false
      } else if (statusFilter === 'SEBAGIAN') {
        if (!item.kesimpulanStatus.label.startsWith('Bayar Sebagian')) return false
      } else if (statusFilter === 'BELUM') {
        if (!item.kesimpulanStatus.label.startsWith('Belum Bayar')) return false
      } else if (statusFilter === 'BEBAS') {
        if (item.golongan.golongan !== 'Tidak Mampu') return false
      }

      if (searchKk) {
        const q = searchKk.toLowerCase()
        const matchName = item.kk.nama_kk.toLowerCase().includes(q)
        const matchNo = (item.kk.no_kk || '').toLowerCase().includes(q)
        const matchLing = item.lingkunganNama.toLowerCase().includes(q)
        if (!matchName && !matchNo && !matchLing) return false
      }

      return true
    })
  }, [allLingkungan, dafuByLingkungan, kkPaymentMap, selectedLingkunganFilter, statusFilter, searchKk])

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

  // Export Monitoring Kartu Setoran CSV
  const handleExportUmatCsv = () => {
    const rows = [
      ['MONITORING KARTU SETORAN SELURUH UMAT PAROKI'],
      ['GEREJA ST CLARA - PAROKI BEKASI UTARA'],
      [`Filter Lingkungan: ${selectedLingkunganFilter === 'ALL' ? 'Semua Lingkungan' : formatNamaLingkungan(allLingkungan.find(l => l.id === selectedLingkunganFilter)?.nama_lingkungan || '')}`],
      [`Tahun: ${selectedYear}`],
      [''],
      ['No', 'Lingkungan', 'Nomor KK', 'Nama Kepala Keluarga', 'Golongan', 'Bulan Terbayar', 'Total Terbayar (Rp)', 'Kesimpulan Status Pembayaran']
    ]

    allUmatSetoranList.forEach((item, idx) => {
      rows.push([
        String(idx + 1),
        formatNamaLingkungan(item.lingkunganNama),
        item.kk.no_kk || '-',
        item.kk.nama_kk,
        item.golongan.golongan,
        item.paidMonths.join(', ') || 'Belum ada',
        String(item.totalBayar),
        item.kesimpulanStatus.label
      ])
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const link = document.createElement('a')
    link.href = encodeURI(csvContent)
    link.download = `Monitoring_Kartu_Setoran_Umat_Paroki_${selectedYear}.csv`
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 text-[#1B2130]">
      {/* Top Banner Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
            <Coins className="w-6 h-6 text-amber-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
                Pengawas & Bendahara Paroki
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Gereja St. Clara • Paroki Bekasi Utara
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 tracking-tight font-serif">
              Monitoring Keuangan & Kartu Setoran Seluruh Lingkungan
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Pantau kepatuhan setoran, nominal iuran, capaian persentase kas, dan status kesimpulan pembayaran tiap keluarga.
            </p>
          </div>
        </div>

        {/* Action Buttons: Linked to Sheet & Refresh */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
          <Button
            type="button"
            onClick={() => setSheetModalOpen(true)}
            className="bg-[#0F9D58] hover:bg-[#0B8043] text-white font-bold h-10 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-white" />
            Linked to Sheet
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={loadParokiFinancialData}
            className="border-slate-300 text-slate-700 hover:bg-slate-100 font-bold h-10 px-3.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
            title="Sinkronkan data terbaru"
          >
            <RefreshCw className="w-4 h-4 text-slate-600" />
            Refresh
          </Button>
        </div>
      </div>

      {/* 4 Kartu Metrik & Pastoral Paroki */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Kas Terkumpul Paroki vs Target */}
        <Card className="bg-white border-slate-200/90 rounded-2xl shadow-xs">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kas Paroki Terkumpul</span>
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Coins className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black text-slate-900">
                {formatRupiah(rekapCapaianLingkungan.grandTotalRealisasi)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Target: {formatRupiah(rekapCapaianLingkungan.grandTotalTarget)} ({rekapCapaianLingkungan.grandTotalPersentase}%)
              </div>
              {/* Progress Bar Global Paroki */}
              <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2.5 overflow-hidden">
                <div
                  className="h-full bg-slate-800 rounded-full transition-all"
                  style={{ width: `${Math.min(100, rekapCapaianLingkungan.grandTotalPersentase)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 🔴 Butuh Perhatian Romo */}
        <Card
          onClick={() => {
            setRekapFilterKategori('BUTUH_PERHATIAN')
            document.getElementById('rekap-kas-section')?.scrollIntoView({ behavior: 'smooth' })
          }}
          className={`bg-white border-slate-200/90 hover:border-rose-300 transition-all rounded-2xl shadow-xs cursor-pointer group ${
            rekapFilterKategori === 'BUTUH_PERHATIAN' ? 'ring-2 ring-rose-700/30 border-rose-300' : ''
          }`}
        >
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-800 uppercase tracking-wider">Butuh Perhatian Romo</span>
              <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 flex items-center justify-center shrink-0 group-hover:bg-rose-100 transition-colors">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black text-rose-900">
                {rekapCapaianLingkungan.countButuhPerhatian}{' '}
                <span className="text-xs font-semibold text-slate-500">Lingkungan</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Capaian &lt; 35% atau belum ada setoran
              </div>
              <div className="text-[10px] text-rose-700 font-semibold mt-2.5 flex items-center gap-1">
                <span>Klik untuk saring data</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 🟡 Perlu Follow-up */}
        <Card
          onClick={() => {
            setRekapFilterKategori('PERLU_FOLLOWUP')
            document.getElementById('rekap-kas-section')?.scrollIntoView({ behavior: 'smooth' })
          }}
          className={`bg-white border-slate-200/90 hover:border-amber-300 transition-all rounded-2xl shadow-xs cursor-pointer group ${
            rekapFilterKategori === 'PERLU_FOLLOWUP' ? 'ring-2 ring-amber-700/30 border-amber-300' : ''
          }`}
        >
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Perlu Follow-up</span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-700 flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black text-amber-900">
                {rekapCapaianLingkungan.countPerluFollowup}{' '}
                <span className="text-xs font-semibold text-slate-500">Lingkungan</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Capaian 35% – 69% (perlu diingatkan)
              </div>
              <div className="text-[10px] text-amber-700 font-semibold mt-2.5 flex items-center gap-1">
                <span>Klik untuk saring data</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 🟢 Mandiri & Tertib */}
        <Card
          onClick={() => {
            setRekapFilterKategori('TERTIB')
            document.getElementById('rekap-kas-section')?.scrollIntoView({ behavior: 'smooth' })
          }}
          className={`bg-white border-slate-200/90 hover:border-emerald-300 transition-all rounded-2xl shadow-xs cursor-pointer group ${
            rekapFilterKategori === 'TERTIB' ? 'ring-2 ring-emerald-700/30 border-emerald-300' : ''
          }`}
        >
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Mandiri &amp; Tertib</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black text-emerald-900">
                {rekapCapaianLingkungan.countTertib}{' '}
                <span className="text-xs font-semibold text-slate-500">Lingkungan</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Capaian &ge; 70% s/d bulan {MONTH_NAMES[BULAN_BERJALAN_CURRENT - 1]}
              </div>
              <div className="text-[10px] text-emerald-700 font-semibold mt-2.5 flex items-center gap-1">
                <span>Klik untuk saring data</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================== */}
      {/* SEKSI 1: TABEL REKAPITULASI IURAN KAS TIAP LINGKUNGAN */}
      {/* (Nama Lingkungan, Jumlah KK, Target, Realisasi, Persentase & Status Romo) */}
      {/* ============================================================== */}
      <Card id="rekap-kas-section" className="bg-white border-slate-200/90 rounded-2xl shadow-xs overflow-hidden scroll-mt-6">
        <CardHeader className="p-5 border-b border-slate-200 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-slate-900 font-serif">
                  Rekapitulasi Capaian Iuran Kas Seluruh Lingkungan
                </CardTitle>
                <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                  {allLingkungan.length} Lingkungan
                </span>
              </div>
              <CardDescription className="text-xs text-slate-500 mt-1">
                Rumus: <strong>Target Kas</strong> = Jumlah KK Wajib &times; Rp 20.000 &times; {BULAN_BERJALAN_CURRENT} Bulan (KK Tidak Mampu dikecualikan dari beban target).
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleExportCapaianCsv}
              className="border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl h-9 px-3 cursor-pointer shrink-0 self-start sm:self-auto"
            >
              <Download className="w-4 h-4 mr-1 text-slate-600" />
              Unduh Rekap Kas
            </Button>
          </div>

          {/* Filter Kategori & Kontrol Pencarian / Pengurutan */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1 border-t border-slate-100">
            {/* Tabs Filter Kategori Pastoral */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setRekapFilterKategori('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                  rekapFilterKategori === 'ALL'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Semua Lingkungan ({rekapCapaianLingkungan.list.length})
              </button>
              <button
                type="button"
                onClick={() => setRekapFilterKategori('BUTUH_PERHATIAN')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                  rekapFilterKategori === 'BUTUH_PERHATIAN'
                    ? 'bg-rose-900 text-white border-rose-900 shadow-xs'
                    : 'bg-rose-50/70 text-rose-800 border-rose-200/80 hover:bg-rose-100/70'
                }`}
              >
                🔴 Butuh Perhatian Romo ({rekapCapaianLingkungan.countButuhPerhatian})
              </button>
              <button
                type="button"
                onClick={() => setRekapFilterKategori('PERLU_FOLLOWUP')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                  rekapFilterKategori === 'PERLU_FOLLOWUP'
                    ? 'bg-amber-900 text-white border-amber-900 shadow-xs'
                    : 'bg-amber-50/70 text-amber-800 border-amber-200/80 hover:bg-amber-100/70'
                }`}
              >
                🟡 Perlu Follow-up ({rekapCapaianLingkungan.countPerluFollowup})
              </button>
              <button
                type="button"
                onClick={() => setRekapFilterKategori('TERTIB')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                  rekapFilterKategori === 'TERTIB'
                    ? 'bg-emerald-900 text-white border-emerald-900 shadow-xs'
                    : 'bg-emerald-50/70 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100/70'
                }`}
              >
                🟢 Mandiri &amp; Tertib ({rekapCapaianLingkungan.countTertib})
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
                  className="pl-8 bg-white border-slate-300 text-slate-900 text-xs rounded-xl h-9"
                />
              </div>

              <Select value={rekapSortBy} onValueChange={(val: any) => setRekapSortBy(val)}>
                <SelectTrigger className="w-48 bg-white border-slate-300 text-slate-800 text-xs font-medium rounded-xl h-9">
                  <SelectValue placeholder="Urutkan" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900 text-xs">
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
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <Table className="text-xs">
              <TableHeader className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 shadow-2xs">
                <TableRow>
                  <TableHead className="w-12 text-center font-bold text-slate-700">No</TableHead>
                  <TableHead className="w-48 font-bold text-slate-700">Lingkungan &amp; Wilayah</TableHead>
                  <TableHead className="w-32 text-center font-bold text-slate-700">Jumlah KK</TableHead>
                  <TableHead className="w-36 text-right font-bold text-slate-700">Target Kas (Rp)</TableHead>
                  <TableHead className="w-36 text-right font-bold text-slate-700">Realisasi Kas (Rp)</TableHead>
                  <TableHead className="w-48 font-bold text-slate-700">Capaian Kas (%)</TableHead>
                  <TableHead className="w-44 text-center font-bold text-slate-700">Status Pastoral</TableHead>
                  <TableHead className="w-24 text-center font-bold text-slate-700">Aksi</TableHead>
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
                    <TableRow key={item.lingkunganId} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="text-center font-mono text-slate-500 font-semibold">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="font-bold text-slate-900">
                          {formatNamaLingkungan(item.namaLingkungan)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Wilayah: {item.wilayah}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="font-bold text-slate-800">
                          {item.jumlahKkTotal} <span className="text-[11px] text-slate-500 font-normal">KK</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          {item.kkWajibCount} Wajib {item.kkBebasCount > 0 ? `• ${item.kkBebasCount} Bebas` : ''}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-slate-700 font-semibold">
                        {formatRupiah(item.targetKas)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-slate-900">
                        {item.realisasiIuran > 0 ? formatRupiah(item.realisasiIuran) : 'Rp 0'}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono font-bold text-slate-800">{item.persentaseCapaian}%</span>
                            <span className="text-[10px] text-slate-500">
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
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${item.badgeClass}`}
                        >
                          {item.statusKategori === 'BUTUH_PERHATIAN' ? (
                            <AlertCircle className="w-3 h-3 shrink-0 text-rose-700" />
                          ) : item.statusKategori === 'PERLU_FOLLOWUP' ? (
                            <Clock className="w-3 h-3 shrink-0 text-amber-700" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-700" />
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
                          className="h-7 px-2.5 text-[11px] font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200/80 cursor-pointer"
                          title="Lihat rincian kartu setoran umat lingkungan ini"
                        >
                          Lihat Umat
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================== */}
      {/* SEKSI 2: MONITORING KARTU SETORAN SEMUA LINGKUNGAN */}
      {/* (Data Umat, Kesimpulan "Orang ini sudah bayar", Lunas/Belum) */}
      {/* ============================================================== */}
      <div id="monitoring-kartu-umat-section" className="space-y-4 scroll-mt-6">
        {/* Filter Controls Bar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 font-serif">
                Monitoring Kartu Setoran Seluruh Umat
              </h2>
              <p className="text-xs text-slate-500">
                Cek status kepatuhan setoran setiap kepala keluarga di seluruh lingkungan beserta kesimpulan status pembayarannya.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleExportUmatCsv}
              className="border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl h-9 px-3 cursor-pointer shrink-0 self-start sm:self-auto"
            >
              <Download className="w-4 h-4 mr-1 text-slate-600" />
              Unduh CSV Umat
            </Button>
          </div>

          {/* Active Filter Lingkungan Indicator */}
          {selectedLingkunganFilter !== 'ALL' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200/90 rounded-xl text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-800"></span>
                <span>
                  Menampilkan rincian kartu setoran keluarga khusus di:{' '}
                  <strong className="text-slate-900">{getNamaLingkunganFromAnyIdentifier(selectedLingkunganFilter)}</strong>
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedLingkunganFilter('ALL')}
                className="h-7 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 font-semibold cursor-pointer self-start sm:self-auto"
              >
                Reset ke Semua Lingkungan
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            {/* Filter Lingkungan */}
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-slate-500">Filter Lingkungan</Label>
              <Select value={selectedLingkunganFilter} onValueChange={(val) => setSelectedLingkunganFilter(val || 'ALL')}>
                <SelectTrigger className="bg-white border-slate-300 text-slate-900 text-xs font-semibold rounded-xl h-10">
                  <span className="truncate">{getNamaLingkunganFromAnyIdentifier(selectedLingkunganFilter)}</span>
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900 text-xs max-h-72">
                  <SelectItem value="ALL" className="font-semibold text-slate-800">
                    ⭐ Semua Lingkungan (69 Lingkungan)
                  </SelectItem>
                  {allLingkungan.map(ling => (
                    <SelectItem key={ling.id} value={ling.id}>
                      {formatNamaLingkungan(ling.nama_lingkungan)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filter Status Pembayaran */}
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-slate-500">Kesimpulan Status</Label>
              <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || 'ALL')}>
                <SelectTrigger className="bg-white border-slate-300 text-slate-900 text-xs font-bold rounded-xl h-10">
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900 text-xs">
                  <SelectItem value="ALL">Semua Status</SelectItem>
                  <SelectItem value="LUNAS">✅ Sudah Lunas s/d Bulan Berjalan</SelectItem>
                  <SelectItem value="SEBAGIAN">🟡 Bayar Sebagian</SelectItem>
                  <SelectItem value="BELUM">❌ Belum Bayar (Menunggak)</SelectItem>
                  <SelectItem value="BEBAS">⚪ Bebas Iuran (Keluarga Tidak Mampu)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filter Tahun */}
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-slate-500">Tahun Buku</Label>
              <Input
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10) || 2026)}
                className="bg-white border-slate-300 text-slate-900 text-xs font-bold rounded-xl h-10"
              />
            </div>

            {/* Pencarian Nama KK */}
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-slate-500">Pencarian Umat / KK</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchKk}
                  onChange={(e) => setSearchKk(e.target.value)}
                  placeholder="Cari nama KK atau no KK..."
                  className="pl-9 bg-white border-slate-300 text-slate-900 text-xs rounded-xl h-10"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tabel Data Kartu Setoran Seluruh Umat */}
        <Card className="bg-white border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-3.5 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>
              Menampilkan <strong>{allUmatSetoranList.length}</strong> KK berdasarkan kriteria filter
            </span>
            <span className="text-[11px] text-slate-500">
              Standar Iuran: <strong>Rp 20.000 / KK / Bulan</strong>
            </span>
          </div>
          <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
            <Table className="text-xs">
              <TableHeader className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 shadow-2xs">
                <TableRow>
                  <TableHead className="w-12 text-center font-bold text-slate-700">No</TableHead>
                  <TableHead className="w-44 font-bold text-slate-700">Lingkungan</TableHead>
                  <TableHead className="font-bold text-slate-700">Kepala Keluarga</TableHead>
                  <TableHead className="w-28 font-bold text-slate-700">Golongan</TableHead>
                  <TableHead className="w-44 font-bold text-slate-700">Riwayat Bulan Terbayar</TableHead>
                  <TableHead className="w-32 text-right font-bold text-slate-700">Total Terbayar</TableHead>
                  <TableHead className="w-64 font-bold text-slate-700">Kesimpulan Status Pembayaran</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {allUmatSetoranList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-slate-500">
                      Tidak ada data setoran yang cocok dengan filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  allUmatSetoranList.slice(0, 100).map((item, idx) => (
                    <TableRow key={`${item.lingkunganId}-${item.kk.id}`} className="hover:bg-blue-50/40 transition-colors">
                      <TableCell className="text-center font-mono text-slate-500 font-semibold">{idx + 1}</TableCell>
                      <TableCell className="font-bold text-slate-800">
                        {formatNamaLingkungan(item.lingkunganNama)}
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-slate-900">{item.kk.nama_kk}</div>
                        {item.kk.no_kk && item.kk.no_kk.trim() !== '' && item.kk.no_kk.trim() !== '-' && (
                          <div className="text-[11px] text-slate-500 font-mono">No. KK: {item.kk.no_kk}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${
                          String(item.golongan.golongan) === 'Tidak Mampu'
                            ? 'bg-rose-50/70 text-rose-700/90 border-rose-200/60'
                            : String(item.golongan.golongan).includes('Rentan') || String(item.golongan.golongan).includes('Prasejahtera')
                            ? 'bg-amber-50/70 text-amber-800/90 border-amber-200/60'
                            : 'bg-slate-100 text-slate-700 border-slate-200/80'
                        }`}>
                          {item.golongan.golongan}
                        </span>
                      </TableCell>
                      <TableCell>
                        {item.paidMonths.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {item.paidMonths.map(m => (
                              <span key={m} className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80 text-[10px] font-medium">
                                {MONTH_NAMES[m - 1].slice(0, 3)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Belum ada setoran</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-slate-900">
                        {item.totalBayar > 0 ? formatRupiah(item.totalBayar) : 'Rp 0'}
                      </TableCell>
                      <TableCell>
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-semibold ${item.kesimpulanStatus.badgeClass}`}>
                          {item.kesimpulanStatus.isLunas ? (
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-slate-600" />
                          ) : item.kesimpulanStatus.label.startsWith('Bayar Sebagian') ? (
                            <Clock className="w-3.5 h-3.5 shrink-0 text-amber-700" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-[#B25E5E]" />
                          )}
                          <span>{item.kesimpulanStatus.label}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {allUmatSetoranList.length > 100 && (
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500">
              Menampilkan 100 data pertama dari {allUmatSetoranList.length} data. Gunakan filter lingkungan atau status di atas untuk melihat data spesifik.
            </div>
          )}
        </Card>
      </div>

      {/* ============================================================== */}
      {/* DIALOG LINKED TO GOOGLE SHEET */}
      {/* ============================================================== */}
      <Dialog open={sheetModalOpen} onOpenChange={setSheetModalOpen}>
        <DialogContent className="max-w-md bg-white text-slate-900 rounded-2xl border-slate-200 p-6">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mb-2">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <DialogTitle className="text-lg font-bold font-serif text-slate-900">
              Linked to Google Sheets Paroki
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Integrasi langsung untuk menarik dan memantau seluruh data kas & kartu setoran dari 69 lingkungan secara terpusat di Google Spreadsheet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Status Koneksi:</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full text-[11px]">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Terhubung Aktif
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Pembaruan Terakhir:</span>
                <span className="font-semibold text-slate-800">{lastSyncedTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Total Lingkungan Tersinkron:</span>
                <span className="font-bold text-[#004085]">{allLingkungan.length} Lingkungan</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600">Spreadsheet URL</label>
              <Input
                readOnly
                value={spreadsheetUrl}
                className="bg-slate-100 border-slate-300 text-slate-700 text-xs font-mono rounded-xl h-10 select-all"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2 flex-col sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={isSyncingSheet}
              onClick={handleSyncToSheet}
              className="border-slate-300 text-slate-700 hover:bg-slate-100 font-bold rounded-xl text-xs h-10 flex items-center justify-center gap-2 cursor-pointer flex-1"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingSheet ? 'animate-spin' : ''}`} />
              {isSyncingSheet ? 'Menyinkronkan...' : 'Tarik & Sinkronkan Sekarang'}
            </Button>
            <Button
              type="button"
              onClick={() => window.open(spreadsheetUrl, '_blank')}
              className="bg-[#0F9D58] hover:bg-[#0B8043] text-white font-bold rounded-xl text-xs h-10 flex items-center justify-center gap-2 cursor-pointer shadow-xs flex-1"
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
