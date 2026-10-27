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
          badgeClass: 'bg-[#F6F3F3] text-[#6B5353] border-[#E4DCDC]',
          color: 'text-slate-700',
          isLunas: false
        }

        if (gol.golongan === 'Tidak Mampu') {
          kesimpulanStatus = {
            label: 'Bebas Iuran (Subsidi Paroki)',
            badgeClass: 'bg-slate-100/80 text-slate-600 border-slate-200/80',
            color: 'text-slate-600',
            isLunas: true
          }
        } else if (paidCount >= 12) {
          kesimpulanStatus = {
            label: 'Lunas Penuh 1 Tahun (12/12 Bln)',
            badgeClass: 'bg-[#F2F5F3] text-[#4E6358] border-[#DCE5DF]',
            color: 'text-slate-800',
            isLunas: true
          }
        } else if (paidCount >= BULAN_BERJALAN_CURRENT) {
          kesimpulanStatus = {
            label: `Lunas s/d Bulan Ini (${paidCount}/${BULAN_BERJALAN_CURRENT} Bln)`,
            badgeClass: 'bg-[#F2F5F3] text-[#4E6358] border-[#DCE5DF]',
            color: 'text-slate-800',
            isLunas: true
          }
        } else if (paidCount > 0) {
          const sisa = BULAN_BERJALAN_CURRENT - paidCount
          kesimpulanStatus = {
            label: `Bayar Sebagian (${paidCount}/${BULAN_BERJALAN_CURRENT} Bln - Kurang ${sisa} Bln)`,
            badgeClass: 'bg-[#F6F4F0] text-[#6B5F4E] border-[#E5DFD5]',
            color: 'text-slate-700',
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

  const sortLabels: Record<string, string> = {
    ATTENTION_FIRST: 'Prioritas Perhatian Romo',
    PERCENT_ASC: 'Capaian Terendah (0% - 100%)',
    PERCENT_DESC: 'Capaian Tertinggi (100% - 0%)',
    NOMINAL_DESC: 'Realisasi Terbesar',
    NAME_ASC: 'Nama Lingkungan (A-Z)'
  }

  const statusFilterLabels: Record<string, string> = {
    ALL: 'Semua Status',
    LUNAS: 'Sudah Lunas s/d Bulan Berjalan',
    SEBAGIAN: 'Bayar Sebagian',
    BELUM: 'Belum Bayar (Menunggak)',
    BEBAS: 'Bebas Iuran (Keluarga Tidak Mampu)'
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
            setRekapFilterKategori('BUTUH_PERHATIAN')
            document.getElementById('rekap-kas-section')?.scrollIntoView({ behavior: 'smooth' })
          }}
          className={`bg-white border-slate-200/80 hover:border-slate-300 transition-all rounded-2xl shadow-2xs cursor-pointer group ${
            rekapFilterKategori === 'BUTUH_PERHATIAN' ? 'ring-1 ring-slate-400 border-slate-400 bg-slate-50/40' : ''
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
            setRekapFilterKategori('PERLU_FOLLOWUP')
            document.getElementById('rekap-kas-section')?.scrollIntoView({ behavior: 'smooth' })
          }}
          className={`bg-white border-slate-200/80 hover:border-slate-300 transition-all rounded-2xl shadow-2xs cursor-pointer group ${
            rekapFilterKategori === 'PERLU_FOLLOWUP' ? 'ring-1 ring-slate-400 border-slate-400 bg-slate-50/40' : ''
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
            setRekapFilterKategori('TERTIB')
            document.getElementById('rekap-kas-section')?.scrollIntoView({ behavior: 'smooth' })
          }}
          className={`bg-white border-slate-200/80 hover:border-slate-300 transition-all rounded-2xl shadow-2xs cursor-pointer group ${
            rekapFilterKategori === 'TERTIB' ? 'ring-1 ring-slate-400 border-slate-400 bg-slate-50/40' : ''
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
      {/* SEKSI 1: TABEL REKAPITULASI IURAN KAS TIAP LINGKUNGAN */}
      {/* (Nama Lingkungan, Jumlah KK, Target, Realisasi, Persentase & Status Romo) */}
      {/* ============================================================== */}
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
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <Table className="text-xs">
              <TableHeader className="bg-slate-50/90 sticky top-0 z-10 border-b border-slate-200/80">
                <TableRow>
                  <TableHead className="w-12 text-center font-semibold text-slate-600">No</TableHead>
                  <TableHead className="w-48 font-semibold text-slate-600">Lingkungan &amp; Wilayah</TableHead>
                  <TableHead className="w-32 text-center font-semibold text-slate-600">Jumlah KK</TableHead>
                  <TableHead className="w-36 text-right font-semibold text-slate-600">Target Kas (Rp)</TableHead>
                  <TableHead className="w-36 text-right font-semibold text-slate-600">Realisasi Kas (Rp)</TableHead>
                  <TableHead className="w-48 font-semibold text-slate-600">Capaian Kas (%)</TableHead>
                  <TableHead className="w-44 text-center font-semibold text-slate-600">Status Pastoral</TableHead>
                  <TableHead className="w-24 text-center font-semibold text-slate-600">Aksi</TableHead>
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
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
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
              className="border-slate-200/90 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl h-9 px-3.5 cursor-pointer shrink-0 self-start sm:self-auto shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              Unduh CSV Umat
            </Button>
          </div>

          {/* Active Filter Lingkungan Indicator */}
          {selectedLingkunganFilter !== 'ALL' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-600"></span>
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
                className="h-7 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-medium cursor-pointer self-start sm:self-auto"
              >
                Reset ke Semua Lingkungan
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            {/* Filter Lingkungan */}
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-semibold text-slate-500">Filter Lingkungan</Label>
              <Select value={selectedLingkunganFilter} onValueChange={(val) => setSelectedLingkunganFilter(val || 'ALL')}>
                <SelectTrigger className="bg-slate-50/60 border-slate-200/90 text-slate-800 text-xs font-medium rounded-xl h-10">
                  <span className="truncate">{getNamaLingkunganFromAnyIdentifier(selectedLingkunganFilter)}</span>
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-800 text-xs max-h-72">
                  <SelectItem value="ALL" className="font-semibold text-slate-800">
                    Semua Lingkungan (69 Lingkungan)
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
              <Label className="text-[10px] uppercase font-semibold text-slate-500">Kesimpulan Status</Label>
              <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || 'ALL')}>
                <SelectTrigger className="bg-slate-50/60 border-slate-200/90 text-slate-800 text-xs font-medium rounded-xl h-10">
                  <span className="truncate">{statusFilterLabels[statusFilter] || 'Semua Status'}</span>
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-800 text-xs">
                  <SelectItem value="ALL">Semua Status</SelectItem>
                  <SelectItem value="LUNAS">Sudah Lunas s/d Bulan Berjalan</SelectItem>
                  <SelectItem value="SEBAGIAN">Bayar Sebagian</SelectItem>
                  <SelectItem value="BELUM">Belum Bayar (Menunggak)</SelectItem>
                  <SelectItem value="BEBAS">Bebas Iuran (Keluarga Tidak Mampu)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filter Tahun */}
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-semibold text-slate-500">Tahun Buku</Label>
              <Input
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10) || 2026)}
                className="bg-slate-50/60 border-slate-200/90 text-slate-800 text-xs font-medium rounded-xl h-10 focus:bg-white"
              />
            </div>

            {/* Pencarian Nama KK */}
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-semibold text-slate-500">Pencarian Umat / KK</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchKk}
                  onChange={(e) => setSearchKk(e.target.value)}
                  placeholder="Cari nama KK atau no KK..."
                  className="pl-9 bg-slate-50/60 border-slate-200/90 text-slate-800 text-xs rounded-xl h-10 focus:bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tabel Data Kartu Setoran Seluruh Umat */}
        <Card className="bg-white border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-3.5 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
            <span>
              Menampilkan <strong className="text-slate-800">{allUmatSetoranList.length}</strong> KK berdasarkan kriteria filter
            </span>
            <span className="text-[11px] text-slate-500">
              Standar Iuran: <strong className="text-slate-700">Rp 20.000 / KK / Bulan</strong>
            </span>
          </div>
          <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
            <Table className="text-xs">
              <TableHeader className="bg-slate-50/90 sticky top-0 z-10 border-b border-slate-200/80">
                <TableRow>
                  <TableHead className="w-12 text-center font-semibold text-slate-600">No</TableHead>
                  <TableHead className="w-44 font-semibold text-slate-600">Lingkungan</TableHead>
                  <TableHead className="font-semibold text-slate-600">Kepala Keluarga</TableHead>
                  <TableHead className="w-28 font-semibold text-slate-600">Golongan</TableHead>
                  <TableHead className="w-44 font-semibold text-slate-600">Riwayat Bulan Terbayar</TableHead>
                  <TableHead className="w-32 text-right font-semibold text-slate-600">Total Terbayar</TableHead>
                  <TableHead className="w-64 font-semibold text-slate-600">Kesimpulan Status Pembayaran</TableHead>
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
                    <TableRow key={`${item.lingkunganId}-${item.kk.id}`} className="hover:bg-slate-50/70 transition-colors">
                      <TableCell className="text-center font-mono text-slate-400 font-medium">{idx + 1}</TableCell>
                      <TableCell className="font-semibold text-slate-800">
                        {formatNamaLingkungan(item.lingkunganNama)}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-slate-800">{item.kk.nama_kk}</div>
                        {item.kk.no_kk && item.kk.no_kk.trim() !== '' && item.kk.no_kk.trim() !== '-' && (
                          <div className="text-[11px] text-slate-400 font-mono">No. KK: {item.kk.no_kk}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-medium border ${
                          String(item.golongan.golongan) === 'Tidak Mampu'
                            ? 'bg-[#F6F3F3] text-[#6B5353] border-[#E4DCDC]'
                            : String(item.golongan.golongan).includes('Rentan') || String(item.golongan.golongan).includes('Prasejahtera')
                            ? 'bg-[#F6F4F0] text-[#6B5F4E] border-[#E5DFD5]'
                            : 'bg-slate-100/80 text-slate-600 border-slate-200/80'
                        }`}>
                          {item.golongan.golongan}
                        </span>
                      </TableCell>
                      <TableCell>
                        {item.paidMonths.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {item.paidMonths.map(m => (
                              <span key={m} className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80 text-[10px] font-medium">
                                {MONTH_NAMES[m - 1].slice(0, 3)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Belum ada setoran</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-slate-800">
                        {item.totalBayar > 0 ? formatRupiah(item.totalBayar) : 'Rp 0'}
                      </TableCell>
                      <TableCell>
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-medium ${item.kesimpulanStatus.badgeClass}`}>
                          {item.kesimpulanStatus.isLunas ? (
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#637D6F]" />
                          ) : item.kesimpulanStatus.label.startsWith('Bayar Sebagian') ? (
                            <Clock className="w-3.5 h-3.5 shrink-0 text-[#8C7B65]" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-[#8C6D6D]" />
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
            <div className="p-3 bg-slate-50 border-t border-slate-200/80 text-center text-xs text-slate-500">
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
