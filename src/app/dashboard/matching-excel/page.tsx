'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  Search,
  Building2,
  Users,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Filter,
  Clock,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Layers,
  ShieldCheck,
  FileText,
  SlidersHorizontal,
  Home,
  Check,
  X,
  Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getAllMasterLingkungan, formatNamaLingkungan, getWilayahForLingkungan } from '@/lib/constants'
import { ensureDummyKksForLingkungan, getDummyAnggotaForKk, getDummyGolonganForKk, santaClaraStats } from '@/lib/dummyData'
import { createClient } from '@/utils/supabase/client'
import { fetchAllParishKksWithGolongan, ParishKkItem } from '@/lib/dafuService'
import { KepalaKeluarga } from '@/lib/types'

interface ExcelRowParsed {
  no?: number | string
  lingkungan: string
  no_kk?: string
  nama_kk: string
  alamat?: string
  is_biduk?: boolean
  jumlah_anggota?: number
  anggota_keluarga?: string
  golongan?: string
}

interface MatchingResultItem {
  id: string
  nama_kk: string
  nama_lingkungan: string
  status: 'MATCH_IDENTIK' | 'MATCH_MODIFIED' | 'EXCEL_NEW' | 'DB_ONLY'
  data_lama?: {
    nama_kk: string
    lingkungan: string
    alamat: string
    is_biduk: boolean
    jumlah_anggota: number
    golongan: string
  }
  data_baru?: {
    nama_kk: string
    lingkungan: string
    alamat: string
    is_biduk: boolean
    jumlah_anggota: number
    golongan: string
  }
  perbedaan: string[]
  rekomendasi: string
}

export default function MatchingDataExcelPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [userRole, setUserRole] = useState<string | null>(null)
  const [checkingRole, setCheckingRole] = useState(true)

  const masterLingkunganList = getAllMasterLingkungan()

  // State
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsedRows, setParsedRows] = useState<ExcelRowParsed[]>([])
  const [parishKks, setParishKks] = useState<ParishKkItem[]>([])
  const [matchingResults, setMatchingResults] = useState<MatchingResultItem[]>([])
  const [processing, setProcessing] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MATCH_MODIFIED' | 'EXCEL_NEW' | 'MATCH_IDENTIK' | 'DB_ONLY'>('ALL')
  const [selectedLingkunganFilter, setSelectedLingkunganFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null)

  // 1. Role access verification: Only SEKRETARIS_PAROKI can access
  useEffect(() => {
    const cookies = typeof document !== 'undefined' ? document.cookie : ''
    const getCookieVal = (name: string) => {
      const v = `; ${cookies}`
      const p = v.split(`; ${name}=`)
      if (p.length === 2) return decodeURIComponent(p.pop()!.split(';').shift()!)
      return null
    }
    const demoRole = getCookieVal('demo_user_role') || ''
    const demoEmail = getCookieVal('demo_user_email') || getCookieVal('demo_user_username') || ''

    let resolvedRole = 'BENDAHARA'
    if (
      demoRole === 'SEKRETARIS_PAROKI' ||
      ((demoEmail.includes('sekretaris') || demoEmail.includes('sekertaris')) && demoEmail.includes('paroki'))
    ) {
      resolvedRole = 'SEKRETARIS_PAROKI'
    } else if (demoRole === 'PAROKI' || demoEmail.includes('paroki')) {
      resolvedRole = 'PAROKI'
    } else if (demoRole === 'SEKRETARIS' || demoEmail.includes('sekretaris') || demoEmail.includes('sekertaris')) {
      resolvedRole = 'SEKRETARIS'
    }

    setUserRole(resolvedRole)
    setCheckingRole(false)

    if (resolvedRole !== 'SEKRETARIS_PAROKI') {
      router.replace('/dashboard')
    }

    const supabase = createClient()
    fetchAllParishKksWithGolongan(supabase)
      .then(setParishKks)
      .catch(console.error)
  }, [router])

  // 2. Fetch full official 2.884 KKs of Santa Clara from Supabase Cloud (Data Lama / Database)
  const officialParishDb = useMemo(() => {
    return parishKks.map((p) => ({
      kk: {
        id: p.id,
        lingkungan_id: p.lingkunganId,
        nama_kk: p.nama_kk,
        alamat: p.alamat || '',
        is_biduk: p.is_biduk ?? true,
        jumlah_anggota: p.jumlah_anggota || 1,
      },
      lingkunganNama: p.lingkunganNama,
      golongan: p.golongan,
      jumlahJiwa: p.jumlah_anggota || 1,
    }))
  }, [parishKks])

  // 3. Core Matching Engine (Compares parsed Excel against officialParishDb WITHOUT mutating data lama)
  const runMatchingAlgorithm = (rows: ExcelRowParsed[], sourceFileName: string) => {
    setProcessing(true)

    // Index existing database for fast lookup by normalized KK name
    const dbMap = new Map<string, typeof officialParishDb[0]>()
    officialParishDb.forEach((item) => {
      const key = `${item.lingkunganNama.toLowerCase().trim()}___${item.kk.nama_kk.toLowerCase().trim()}`
      dbMap.set(key, item)
      // Also index by name alone
      dbMap.set(item.kk.nama_kk.toLowerCase().trim(), item)
    })

    const results: MatchingResultItem[] = []
    const matchedDbKeys = new Set<string>()

    // Analyze each row from Excel
    rows.forEach((row, idx) => {
      const rowKeyFull = `${row.lingkungan.toLowerCase().trim()}___${row.nama_kk.toLowerCase().trim()}`
      const rowKeyName = row.nama_kk.toLowerCase().trim()

      const found = dbMap.get(rowKeyFull) || dbMap.get(rowKeyName)

      if (found) {
        matchedDbKeys.add(`${found.lingkunganNama.toLowerCase().trim()}___${found.kk.nama_kk.toLowerCase().trim()}`)

        const differences: string[] = []
        // Compare address
        if (row.alamat && found.kk.alamat && row.alamat.trim().toLowerCase() !== found.kk.alamat.trim().toLowerCase()) {
          differences.push(`Alamat: "${found.kk.alamat}" ➔ "${row.alamat}"`)
        }
        // Compare members count
        if (row.jumlah_anggota && row.jumlah_anggota !== found.jumlahJiwa) {
          differences.push(`Jumlah Jiwa: ${found.jumlahJiwa} Jiwa ➔ ${row.jumlah_anggota} Jiwa`)
        }
        // Compare BIDUK status
        if (row.is_biduk !== undefined && row.is_biduk !== found.kk.is_biduk) {
          differences.push(`Status BIDUK: ${found.kk.is_biduk ? 'BIDUK' : 'Non-BIDUK'} ➔ ${row.is_biduk ? 'BIDUK' : 'Non-BIDUK'}`)
        }
        // Compare Golongan
        if (row.golongan && row.golongan !== found.golongan) {
          differences.push(`Status Golongan: "${found.golongan}" ➔ "${row.golongan}"`)
        }

        const isModified = differences.length > 0

        results.push({
          id: `match-${idx}-${Date.now()}`,
          nama_kk: row.nama_kk,
          nama_lingkungan: row.lingkungan || found.lingkunganNama,
          status: isModified ? 'MATCH_MODIFIED' : 'MATCH_IDENTIK',
          data_lama: {
            nama_kk: found.kk.nama_kk,
            lingkungan: found.lingkunganNama,
            alamat: found.kk.alamat || 'Alamat belum tercatat',
            is_biduk: found.kk.is_biduk,
            jumlah_anggota: found.jumlahJiwa,
            golongan: found.golongan,
          },
          data_baru: {
            nama_kk: row.nama_kk,
            lingkungan: row.lingkungan,
            alamat: row.alamat || 'Belum diisi di file',
            is_biduk: row.is_biduk ?? true,
            jumlah_anggota: row.jumlah_anggota || 1,
            golongan: row.golongan || found.golongan,
          },
          perbedaan: differences,
          rekomendasi: isModified
            ? `Ditemukan ${differences.length} perbedaan data. Disarankan verifikasi dengan Ketua Lingkungan sebelum penyesuaian.`
            : 'Data baru di Excel cocok sempurna dengan database paroki.',
        })
      } else {
        // Brand new family in Excel
        results.push({
          id: `match-${idx}-${Date.now()}`,
          nama_kk: row.nama_kk,
          nama_lingkungan: row.lingkungan,
          status: 'EXCEL_NEW',
          data_baru: {
            nama_kk: row.nama_kk,
            lingkungan: row.lingkungan,
            alamat: row.alamat || 'Belum diisi di file',
            is_biduk: row.is_biduk ?? true,
            jumlah_anggota: row.jumlah_anggota || 1,
            golongan: row.golongan || 'Sejahtera',
          },
          perbedaan: ['Data keluarga ini belum terdaftar di basis data resmi 2.884 KK St. Clara.'],
          rekomendasi: 'Keluarga baru: dapat diproses penambahan ke database melalui approval DAFU.',
        })
      }
    })

    // If sampling or matching specific lingkungan, also find records in DB that were omitted in Excel
    const selectedLingkunganSample = rows[0]?.lingkungan
    if (selectedLingkunganSample) {
      officialParishDb
        .filter((d) => d.lingkunganNama.toLowerCase() === selectedLingkunganSample.toLowerCase())
        .forEach((d, idx) => {
          const key = `${d.lingkunganNama.toLowerCase().trim()}___${d.kk.nama_kk.toLowerCase().trim()}`
          if (!matchedDbKeys.has(key)) {
            results.push({
              id: `db-only-${idx}-${Date.now()}`,
              nama_kk: d.kk.nama_kk,
              nama_lingkungan: d.lingkunganNama,
              status: 'DB_ONLY',
              data_lama: {
                nama_kk: d.kk.nama_kk,
                lingkungan: d.lingkunganNama,
                alamat: d.kk.alamat || 'Alamat terdaftar',
                is_biduk: d.kk.is_biduk,
                jumlah_anggota: d.jumlahJiwa,
                golongan: d.golongan,
              },
              perbedaan: ['Terdaftar di database paroki, namun tidak tercantum dalam file sensus baru yang diunggah.'],
              rekomendasi: 'Perlu konfirmasi ke Sekretaris Lingkungan apakah keluarga telah pindah paroki atau terlewat saat sensus.',
            })
          }
        })
    }

    setMatchingResults(results)
    setFileName(sourceFileName)
    setProcessing(false)
    setAlertSuccess(`Matching data berbasis Excel selesai! Berhasil menganalisis ${rows.length} data baru dengan basis data paroki tanpa mengubah data lama.`)
  }

  // 4. File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rawJson: any[] = XLSX.utils.sheet_to_json(sheet)

        if (!rawJson || rawJson.length === 0) {
          setAlertSuccess('File Excel kosong atau tidak memiliki baris data.')
          setTimeout(() => setAlertSuccess(null), 4000)
          return
        }

        // Normalize rows from various possible headers
        const parsed: ExcelRowParsed[] = rawJson.map((row, idx) => {
          const getVal = (patterns: string[]) => {
            for (const key of Object.keys(row)) {
              for (const pat of patterns) {
                if (key.toLowerCase().includes(pat.toLowerCase())) {
                  return row[key]
                }
              }
            }
            return undefined
          }

          const nama = getVal(['nama kepala keluarga', 'nama kk', 'nama keluarga', 'kepala keluarga', 'nama']) || `Keluarga Umat #${idx + 1}`
          const ling = getVal(['nama lingkungan', 'lingkungan', 'ling']) || 'Padre Pio 1'
          const alamat = getVal(['alamat', 'tempat tinggal', 'domisili']) || 'Alamat belum diisi'
          const noKk = getVal(['no kk', 'nomor kk', 'id kk', 'id'])
          const jml = parseInt(getVal(['jumlah anggota', 'jumlah jiwa', 'jiwa', 'anggota']) || '3', 10)
          const bidukStr = String(getVal(['biduk', 'is_biduk', 'status biduk']) || 'ya').toLowerCase()
          const isBiduk = bidukStr.includes('ya') || bidukStr.includes('true') || bidukStr.includes('kaj')
          const gol = getVal(['golongan', 'kategori', 'dupras']) || 'Sejahtera'

          return {
            no: idx + 1,
            nama_kk: String(nama).trim(),
            lingkungan: String(ling).trim(),
            no_kk: noKk ? String(noKk) : undefined,
            alamat: String(alamat).trim(),
            jumlah_anggota: isNaN(jml) ? 3 : jml,
            is_biduk: isBiduk,
            golongan: String(gol).trim(),
          }
        })

        setParsedRows(parsed)
        runMatchingAlgorithm(parsed, file.name)
      } catch (err) {
        console.error('Error parsing Excel:', err)
        setAlertSuccess('Gagal membaca file Excel. Pastikan format file adalah .xlsx atau .xls yang valid.')
        setTimeout(() => setAlertSuccess(null), 4000)
      }
    }

    reader.readAsArrayBuffer(file)
  }

  // 5. Download Sample Template Excel
  const handleDownloadTemplate = () => {
    const templateData = [
      ['No', 'Nama Lingkungan', 'No KK', 'Nama Kepala Keluarga', 'Alamat', 'Status BIDUK (Ya/Tidak)', 'Jumlah Anggota', 'Nama Anggota Keluarga', 'Status Golongan (Sejahtera/Terduga Prasejahtera/Rentan Tidak Mampu)'],
      [1, 'Padre Pio 1', 'KK-3275-001', 'FX Sudirman & Maria Fransisca', 'Taman Harapan Baru Blok D5 No. 12', 'Ya', 3, 'FX Sudirman, Maria Fransisca, Benedictus Bryan', 'Sejahtera'],
      [2, 'Padre Pio 1', 'KK-3275-002', 'Antonius Budi Santoso', 'THB Blok C1 No. 4', 'Ya', 4, 'Antonius Budi, Fransisca Ratna, Kevin, Aurel', 'Sejahtera'],
      [3, 'Padre Pio 1', 'KK-3275-003', 'Yohanes Prasetyo', 'Harapan Indah 2 Blok HY No. 18', 'Ya', 2, 'Yohanes Prasetyo, Elizabeth Mega', 'Terduga Prasejahtera'],
      [4, 'St. Catarina 1', 'KK-3275-004', 'Markus Susanto', 'Pesona Anggrek Harapan Blok B2 No. 8', 'Ya', 3, 'Markus Susanto, Linda, Stevanus', 'Rentan Tidak Mampu'],
      [5, 'St. Agnes 1', 'KK-3275-005', 'Keluarga Baru Ignasius Arya', 'Taman Wisma Asri 2 Blok AA No. 15', 'Ya', 2, 'Ignasius Arya, Clara Shinta', 'Sejahtera'],
    ]

    const ws = XLSX.utils.aoa_to_sheet(templateData)

    // Set column widths
    ws['!cols'] = [
      { wch: 6 },
      { wch: 20 },
      { wch: 15 },
      { wch: 32 },
      { wch: 35 },
      { wch: 24 },
      { wch: 16 },
      { wch: 45 },
      { wch: 30 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Data_Umat')
    XLSX.writeFile(wb, 'Template_Format_Matching_Data_Umat_St_Clara.xlsx')
  }

  // 6. Pre-load Realistic Demo Simulation (1-click testing)
  const handleLoadDemoSimulation = () => {
    const demoData: ExcelRowParsed[] = [
      // 1. Identik
      {
        no: 1,
        lingkungan: 'Padre Pio 1',
        nama_kk: 'Keluarga FX Sudirman & Maria Fransisca',
        alamat: 'Taman Harapan Baru Blok D5 No. 12',
        jumlah_anggota: 3,
        is_biduk: true,
        golongan: 'Sejahtera',
      },
      // 2. Modified: Penambahan jiwa (3 -> 4) dan perubahan alamat
      {
        no: 2,
        lingkungan: 'Padre Pio 1',
        nama_kk: 'Keluarga Antonius Budi Santoso',
        alamat: 'Taman Harapan Baru Blok D5 No. 19 (Pindah Rumah)',
        jumlah_anggota: 5,
        is_biduk: true,
        golongan: 'Sejahtera',
      },
      // 3. Modified: Status Golongan disesuaikan
      {
        no: 3,
        lingkungan: 'Padre Pio 1',
        nama_kk: 'Keluarga Yohanes Prasetyo',
        alamat: 'THB Blok C1 No. 4',
        jumlah_anggota: 2,
        is_biduk: true,
        golongan: 'Terduga Prasejahtera',
      },
      // 4. Data Baru di Excel (Belum ada di DB)
      {
        no: 4,
        lingkungan: 'Padre Pio 1',
        nama_kk: 'Keluarga Gabriel Satria & Veronica Dewi',
        alamat: 'Cluster Villa Mutiara Gading 3 Blok M6 No. 2',
        jumlah_anggota: 3,
        is_biduk: true,
        golongan: 'Sejahtera',
      },
      // 5. Data Baru di Excel (Belum ada di DB)
      {
        no: 5,
        lingkungan: 'Padre Pio 1',
        nama_kk: 'Keluarga Robertus Danang',
        alamat: 'Harapan Indah Regency Blok RA No. 14',
        jumlah_anggota: 2,
        is_biduk: true,
        golongan: 'Rentan Tidak Mampu',
      },
    ]

    // Grab 5 actual KKs from Padre Pio 1 to create realistic matching
    const sampleKks = officialParishDb.filter((d) => d.lingkunganNama.toLowerCase() === 'padre pio 1').slice(0, 8)
    sampleKks.forEach((skk, idx) => {
      if (idx === 0) {
        demoData.push({
          no: demoData.length + 1,
          lingkungan: skk.lingkunganNama,
          nama_kk: skk.kk.nama_kk,
          alamat: skk.kk.alamat || 'Alamat Terdaftar',
          jumlah_anggota: skk.jumlahJiwa,
          is_biduk: skk.kk.is_biduk,
          golongan: skk.golongan,
        })
      } else if (idx === 1) {
        demoData.push({
          no: demoData.length + 1,
          lingkungan: skk.lingkunganNama,
          nama_kk: skk.kk.nama_kk,
          alamat: `${skk.kk.alamat || 'THB Blok A'} (Renovasi Alamat)`,
          jumlah_anggota: skk.jumlahJiwa + 1,
          is_biduk: skk.kk.is_biduk,
          golongan: 'Terduga Prasejahtera',
        })
      }
    })

    setParsedRows(demoData)
    runMatchingAlgorithm(demoData, 'Sensus_Pembaruan_PadrePio1_2026.xlsx')
  }

  // 7. Export Full Matching & Reconciliation Report (.xlsx)
  const handleExportMatchingReport = () => {
    if (matchingResults.length === 0) {
      setAlertSuccess('Belum ada data matching untuk diekspor.')
      setTimeout(() => setAlertSuccess(null), 4000)
      return
    }

    // Sheet 1: Ringkasan
    const summaryData: any[][] = [
      ['LAPORAN REKONSILIASI & MATCHING DATA UMAT PAROKI ST. CLARA'],
      ['Pusat Sekretariat Paroki St. Clara • Dihasilkan pada: ' + new Date().toLocaleString('id-ID')],
      ['File Sumber Excel:', fileName || 'Sensus_Pembaruan.xlsx'],
      [],
      ['PARAMETER ANALISIS', 'JUMLAH KELUARGA (KK)', 'PERSENTASE'],
      ['Total Data Baru Dianalisis', matchingResults.length, '100%'],
      ['Cocok Sempurna (Identik)', matchingResults.filter((m) => m.status === 'MATCH_IDENTIK').length, `${((matchingResults.filter((m) => m.status === 'MATCH_IDENTIK').length / matchingResults.length) * 100).toFixed(1)}%`],
      ['Ada Perbedaan / Perlu Penyesuaian', matchingResults.filter((m) => m.status === 'MATCH_MODIFIED').length, `${((matchingResults.filter((m) => m.status === 'MATCH_MODIFIED').length / matchingResults.length) * 100).toFixed(1)}%`],
      ['Data Baru di Excel (Belum di DB)', matchingResults.filter((m) => m.status === 'EXCEL_NEW').length, `${((matchingResults.filter((m) => m.status === 'EXCEL_NEW').length / matchingResults.length) * 100).toFixed(1)}%`],
      ['Hanya di Database Lama (Belum Masuk Excel)', matchingResults.filter((m) => m.status === 'DB_ONLY').length, `${((matchingResults.filter((m) => m.status === 'DB_ONLY').length / matchingResults.length) * 100).toFixed(1)}%`],
      [],
      ['CATATAN INTEGRITAS DATA:'],
      ['Proses matching ini tidak memodifikasi data lama pada database utama paroki secara langsung.'],
      ['Hasil laporan ini digunakan sebagai bahan peninjauan verifikasi oleh Sekretaris Paroki.'],
    ]

    // Sheet 2: Detail
    const detailData: any[][] = [
      [
        'No',
        'Status Matching',
        'Nama Lingkungan',
        'Nama Kepala Keluarga',
        'Alamat Lama (DB)',
        'Alamat Baru (Excel)',
        'Jiwa Lama',
        'Jiwa Baru',
        'Golongan Lama',
        'Golongan Baru',
        'Rincian Perbedaan',
        'Rekomendasi Penyesuaian Paroki',
      ],
    ]

    matchingResults.forEach((m, idx) => {
      detailData.push([
        idx + 1,
        m.status === 'MATCH_IDENTIK'
          ? 'Cocok Identik'
          : m.status === 'MATCH_MODIFIED'
          ? 'Ada Perbedaan'
          : m.status === 'EXCEL_NEW'
          ? 'Data Baru (Excel)'
          : 'Hanya di Database Lama',
        m.nama_lingkungan,
        m.nama_kk,
        m.data_lama?.alamat || '-',
        m.data_baru?.alamat || '-',
        m.data_lama?.jumlah_anggota || '-',
        m.data_baru?.jumlah_anggota || '-',
        m.data_lama?.golongan || '-',
        m.data_baru?.golongan || '-',
        m.perbedaan.join(' | '),
        m.rekomendasi,
      ])
    })

    const wb = XLSX.utils.book_new()
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
    const wsDetail = XLSX.utils.aoa_to_sheet(detailData)

    wsSummary['!cols'] = [{ wch: 35 }, { wch: 25 }, { wch: 20 }]
    wsDetail['!cols'] = [
      { wch: 5 },
      { wch: 22 },
      { wch: 20 },
      { wch: 32 },
      { wch: 30 },
      { wch: 30 },
      { wch: 10 },
      { wch: 10 },
      { wch: 18 },
      { wch: 18 },
      { wch: 45 },
      { wch: 45 },
    ]

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Rekonsiliasi')
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail Penyesuaian')

    const dateStr = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `Laporan_Matching_Penyesuaian_Data_Umat_St_Clara_${dateStr}.xlsx`)
  }

  // Filtered Results
  const filteredResults = useMemo(() => {
    return matchingResults.filter((item) => {
      const matchStatus = statusFilter === 'ALL' || item.status === statusFilter
      const matchLing =
        selectedLingkunganFilter === 'ALL' ||
        item.nama_lingkungan.toLowerCase().includes(selectedLingkunganFilter.toLowerCase())
      const q = searchQuery.toLowerCase().trim()
      const matchSearch =
        !q ||
        item.nama_kk.toLowerCase().includes(q) ||
        item.nama_lingkungan.toLowerCase().includes(q) ||
        item.perbedaan.some((p) => p.toLowerCase().includes(q))

      return matchStatus && matchLing && matchSearch
    })
  }, [matchingResults, statusFilter, selectedLingkunganFilter, searchQuery])

  // Count aggregates
  const counts = useMemo(() => {
    return {
      all: matchingResults.length,
      modified: matchingResults.filter((m) => m.status === 'MATCH_MODIFIED').length,
      newExcel: matchingResults.filter((m) => m.status === 'EXCEL_NEW').length,
      identical: matchingResults.filter((m) => m.status === 'MATCH_IDENTIK').length,
      dbOnly: matchingResults.filter((m) => m.status === 'DB_ONLY').length,
    }
  }, [matchingResults])

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (checkingRole || userRole !== 'SEKRETARIS_PAROKI') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
          <Clock className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-sm font-semibold text-slate-700">Memverifikasi hak akses...</p>
        <p className="text-xs text-slate-400">Modul ini khusus untuk Sekretaris Paroki. Mengalihkan ke Dashboard...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner - Soft Grey Theme */}
      <div className="bg-[#F8F9FA] text-slate-900 p-6 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white border border-slate-300 text-slate-700 text-xs font-semibold uppercase tracking-wider shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
              Sekretariat Paroki St. Clara
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-serif text-slate-900">
              Matching Data Umat Berbasis Excel (Rekonsiliasi)
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
              Harmonisasi dan perbandingan otomatis antara data sensus baru (file Excel) dengan basis data lama (2.884 KK Paroki) secara akurat <strong>tanpa mengubah format data lama</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="bg-white hover:bg-slate-50 text-slate-700 border-slate-300 text-xs rounded-xl font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Unduh Template Excel</span>
            </Button>

            <Button
              size="sm"
              onClick={handleLoadDemoSimulation}
              className="bg-slate-600 hover:bg-slate-700 text-white text-xs rounded-xl font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Muat Contoh Data Pembaruan</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Alert Notification */}
      {alertSuccess && (
        <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 text-slate-800 text-xs font-semibold flex items-center justify-between gap-3 animate-fadeIn shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-500 shrink-0" />
            <span>{alertSuccess}</span>
          </div>
          <button
            onClick={() => setAlertSuccess(null)}
            className="text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Upload Box & Instructions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 font-serif">
              <FileSpreadsheet className="w-4 h-4 text-slate-600" />
              Unggah File Excel Baru (Sensus / DAFU / Pembaruan Umat)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Sistem akan membandingkan data dalam file dengan 2.884 KK aktif di database paroki tanpa memodifikasi data lama.
            </p>
          </div>

          {fileName && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-mono font-semibold">
              <FileCheck className="w-3.5 h-3.5 text-slate-600" />
              <span>{fileName}</span>
            </div>
          )}
        </div>

        {/* Drag & Drop Upload Container */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/70 hover:bg-slate-50/90 rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-slate-500">
            <Upload className="w-6 h-6 text-slate-500" />
          </div>
          <div className="space-y-1">
            <p className="text-xs sm:text-sm font-bold text-slate-800">
              Klik untuk memilih atau seret file Excel ke sini
            </p>
            <p className="text-[11px] text-slate-500">
              Format yang didukung: <span className="font-mono font-semibold">.xlsx, .xls, .csv</span> (Maksimal 10 MB)
            </p>
          </div>
        </div>
      </div>

      {/* Matching Results Section */}
      {matchingResults.length > 0 && (
        <div className="space-y-4">
          {/* 4 Metric Summary Cards - Soft Grey Theme */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Total Data Dianalisis</span>
                <Users className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{counts.all} KK</div>
              <p className="text-[11px] text-slate-500">Data baru dari file Excel</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Ada Perbedaan (Modified)</span>
                <AlertTriangle className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{counts.modified} KK</div>
              <p className="text-[11px] text-slate-500">Alamat / Jiwa / Golongan berbeda</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Data Baru di Excel</span>
                <Sparkles className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{counts.newExcel} KK</div>
              <p className="text-[11px] text-slate-500">Belum ada di database lama</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Cocok Sempurna (Identik)</span>
                <CheckCircle2 className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{counts.identical} KK</div>
              <p className="text-[11px] text-slate-500">Data lama & baru sama persis</p>
            </div>
          </div>

          {/* Filter Bar & Export Actions */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Segmented Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer shrink-0 ${
                    statusFilter === 'ALL'
                      ? 'bg-[#16233F] text-white shadow-2xs font-semibold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  Semua Hasil ({counts.all})
                </button>
                <button
                  onClick={() => setStatusFilter('MATCH_MODIFIED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    statusFilter === 'MATCH_MODIFIED'
                      ? 'bg-[#16233F] text-white shadow-2xs font-semibold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
                  Perlu Penyesuaian ({counts.modified})
                </button>
                <button
                  onClick={() => setStatusFilter('EXCEL_NEW')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    statusFilter === 'EXCEL_NEW'
                      ? 'bg-[#16233F] text-white shadow-2xs font-semibold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                  Data Baru (Excel Only) ({counts.newExcel})
                </button>
                <button
                  onClick={() => setStatusFilter('MATCH_IDENTIK')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    statusFilter === 'MATCH_IDENTIK'
                      ? 'bg-[#16233F] text-white shadow-2xs font-semibold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                  Cocok Identik ({counts.identical})
                </button>
                {counts.dbOnly > 0 && (
                  <button
                    onClick={() => setStatusFilter('DB_ONLY')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      statusFilter === 'DB_ONLY'
                        ? 'bg-[#16233F] text-white shadow-2xs font-semibold'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`}
                  >
                    <Info className="w-3.5 h-3.5 text-slate-400" />
                    Hanya di Database ({counts.dbOnly})
                  </button>
                )}
              </div>

              {/* Search & Export Button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    type="text"
                    placeholder="Cari KK / lingkungan / selisih..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 h-9 text-xs rounded-xl bg-slate-50 border-slate-200 text-slate-900"
                  />
                </div>

                <Button
                  size="sm"
                  onClick={handleExportMatchingReport}
                  className="bg-slate-600 hover:bg-slate-700 text-white text-xs rounded-xl font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ekspor Laporan (.xlsx)</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Results List Cards */}
          <div className="space-y-3">
            {filteredResults.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 space-y-2 shadow-xs">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="text-sm font-bold text-slate-700">Tidak ada data yang sesuai filter</div>
                <p className="text-xs text-slate-400">Silakan ubah filter kategori atau kata kunci pencarian Anda.</p>
              </div>
            ) : (
              filteredResults.map((item) => {
                const isExpanded = expandedIds.has(item.id)
                const isModified = item.status === 'MATCH_MODIFIED'
                const isNew = item.status === 'EXCEL_NEW'
                const isIdentik = item.status === 'MATCH_IDENTIK'
                const isDbOnly = item.status === 'DB_ONLY'

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-200 transition-all duration-200 shadow-xs overflow-hidden hover:border-slate-300"
                  >
                    {/* Item Header */}
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#F8F9FA] border-b border-slate-200/80">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Lingkungan Badge */}
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#16233F] text-white font-semibold text-xs shadow-2xs">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>{item.nama_lingkungan}</span>
                        </div>

                        {/* Status Matching Badge (Soft Neutral) */}
                        <span className="text-[11px] px-2.5 py-0.5 rounded-md font-medium flex items-center gap-1.5 border border-slate-200 bg-white text-slate-700 shadow-2xs">
                          {isIdentik && <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />}
                          {isModified && <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />}
                          {isNew && <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />}
                          {isDbOnly && <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />}
                          {isIdentik
                            ? 'Cocok Identik'
                            : isModified
                            ? 'Ada Perbedaan / Perlu Penyesuaian'
                            : isNew
                            ? 'Data Baru (Excel Only)'
                            : 'Hanya di Database Lama'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleExpand(item.id)}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer ml-auto md:ml-0"
                      >
                        <span>{isExpanded ? 'Tutup Rincian' : 'Bandingkan Data'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {/* Item Body */}
                    <div className="p-4 space-y-3 text-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h4 className="text-base font-bold text-slate-900 font-serif">
                            {item.nama_kk}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {item.rekomendasi}
                          </p>
                        </div>

                        {item.perbedaan.length > 0 && !isIdentik && (
                          <div className="flex flex-wrap items-center gap-1 sm:justify-end">
                            {item.perbedaan.map((p, pIdx) => (
                              <span
                                key={pIdx}
                                className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Side-by-Side Comparison (If expanded) */}
                      {isExpanded && (
                        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3 animate-fadeIn">
                          {/* Left Column: Data Lama (Database) */}
                          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                            <div className="flex items-center justify-between text-slate-700 font-semibold border-b border-slate-200 pb-1.5">
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-slate-500" />
                                Data Lama (Basis Data 2.884 KK Paroki)
                              </span>
                              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono">
                                Tetap / Tidak Diubah
                              </span>
                            </div>

                            {item.data_lama ? (
                              <div className="space-y-1 text-slate-600 text-[11px]">
                                <div><strong>Nama KK:</strong> {item.data_lama.nama_kk}</div>
                                <div><strong>Lingkungan:</strong> {item.data_lama.lingkungan}</div>
                                <div><strong>Alamat:</strong> {item.data_lama.alamat}</div>
                                <div><strong>Jumlah Jiwa:</strong> {item.data_lama.jumlah_anggota} Jiwa</div>
                                <div><strong>Status BIDUK:</strong> {item.data_lama.is_biduk ? 'BIDUK KAJ' : 'Non-BIDUK'}</div>
                                <div><strong>Golongan:</strong> {item.data_lama.golongan}</div>
                              </div>
                            ) : (
                              <p className="text-slate-400 italic text-[11px]">
                                Tidak tercatat di database lama paroki (Keluarga Baru).
                              </p>
                            )}
                          </div>

                          {/* Right Column: Data Baru (File Excel) */}
                          <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2 shadow-2xs">
                            <div className="flex items-center justify-between text-slate-700 font-semibold border-b border-slate-200 pb-1.5">
                              <span className="flex items-center gap-1.5">
                                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
                                Data Baru (File Excel Diunggah)
                              </span>
                              <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-300 px-1.5 py-0.2 rounded font-mono">
                                Input Excel Baru
                              </span>
                            </div>

                            {item.data_baru ? (
                              <div className="space-y-1 text-slate-600 text-[11px]">
                                <div><strong>Nama KK:</strong> {item.data_baru.nama_kk}</div>
                                <div><strong>Lingkungan:</strong> {item.data_baru.lingkungan}</div>
                                <div><strong>Alamat:</strong> {item.data_baru.alamat}</div>
                                <div><strong>Jumlah Jiwa:</strong> {item.data_baru.jumlah_anggota} Jiwa</div>
                                <div><strong>Status BIDUK:</strong> {item.data_baru.is_biduk ? 'BIDUK KAJ' : 'Non-BIDUK'}</div>
                                <div><strong>Golongan:</strong> {item.data_baru.golongan}</div>
                              </div>
                            ) : (
                              <p className="text-slate-400 italic text-[11px]">
                                Tidak tercantum dalam file sensus Excel baru.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
