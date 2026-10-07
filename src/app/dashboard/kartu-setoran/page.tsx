'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { KepalaKeluarga, JurnalTransaksi } from '@/lib/types'
import { formatRupiah, MONTH_NAMES } from '@/lib/utils'
import { formatNamaLingkungan, getAllMasterLingkungan, findLingkunganByQuery, getLingkunganDbUuid } from '@/lib/constants'
import { ensureDummyKksForLingkungan } from '@/lib/dummyData'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { getAllMasterCOA } from '@/lib/masterCoa'
import {
  CreditCard,
  Download,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  ClipboardList,
  Sparkles,
  Info,
  Coins,
  User,
  Building2
} from 'lucide-react'

const JENIS_KARTU_OPTIONS = [
  { code: '4100', name: 'Kas Lingkungan (KL) — COA 4100', labelShort: 'Kas Lingkungan' },
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
        labelShort: c.nama_akun
      }))
    }
  } catch (e) {}
  return JENIS_KARTU_OPTIONS
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']

export type SumberSetoranType = 'SENDIRI' | 'PAROKI' | 'DANA_LINGKUNGAN' | 'ORANG_LAIN'

export interface SetoranOverrideData {
  sumber: SumberSetoranType
  penalangNama?: string
  nominal?: number
}

interface SetoranDetail {
  nominal: number
  sumber: SumberSetoranType
  penalangNama?: string
}

function parseOverride(raw: any): SetoranOverrideData {
  if (!raw) return { sumber: 'SENDIRI' }
  if (typeof raw === 'string') {
    if (raw === 'DANA_LINGKUNGAN') return { sumber: 'DANA_LINGKUNGAN' }
    if (raw === 'PAROKI') return { sumber: 'PAROKI' }
    if (raw === 'ORANG_LAIN') return { sumber: 'ORANG_LAIN' }
    return { sumber: 'SENDIRI' }
  }
  return {
    sumber: raw.sumber || 'SENDIRI',
    penalangNama: raw.penalangNama,
    nominal: raw.nominal
  }
}

export default function KartuSetoranPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [lingkunganId, setLingkunganId] = useState<string | null>(null)
  const [lingkunganName, setLingkunganName] = useState('')

  const [kkList, setKkList] = useState<KepalaKeluarga[]>([])
  const [jurnalList, setJurnalList] = useState<JurnalTransaksi[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Filter State
  const [kartuOptions, setKartuOptions] = useState<Array<{ code: string; name: string; labelShort: string }>>(JENIS_KARTU_OPTIONS)
  const [selectedCoa, setSelectedCoa] = useState<string>('4100')
  const [selectedYear, setSelectedYear] = useState<number>(2026)

  // Local overrides: key = `${kkId}_${month}` -> SetoranOverrideData | string
  const [sourceOverrides, setSourceOverrides] = useState<Record<string, SetoranOverrideData | string>>({})

  // Modal toggle status pembayaran / talangan
  const [toggleCellInfo, setToggleCellInfo] = useState<{
    kkId: string
    kkNama: string
    monthNum: number
    monthName: string
    nominal: number
    currentSource: SumberSetoranType
    penalangNama?: string
  } | null>(null)

  const [modalSource, setModalSource] = useState<SumberSetoranType>('SENDIRI')
  const [modalPenalangNama, setModalPenalangNama] = useState<string>('')
  const [modalNominal, setModalNominal] = useState<number>(20000)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
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

        // 1. Jika Bendahara/Sekretaris, prioritaskan data sesi lingkungan di cookie
        if (effectiveRole !== 'PAROKI' && cookieLingId) {
          targetLingkunganId = cookieLingId
          targetLingkunganNama = cookieLingNama || null
        }

        // 2. Jika belum ketemu, cari dari query email / username
        if (!targetLingkunganId && effectiveRole !== 'PAROKI' && effectiveEmail) {
          const matched = findLingkunganByQuery(effectiveEmail)
          if (matched) {
            targetLingkunganId = matched.id
            targetLingkunganNama = matched.nama_lingkungan
          }
        }

        // 3. Fallback ke selected_lingkungan_id di localStorage (misal peran Paroki)
        if (!targetLingkunganId) {
          targetLingkunganId = localStorage.getItem('selected_lingkungan_id')
        }

        // 4. Pastikan nama lingkungan selalu terisi kanonikal dari ID
        if (!targetLingkunganNama && targetLingkunganId) {
          const allM = getAllMasterLingkungan()
          const targetUuid = getLingkunganDbUuid(targetLingkunganId)
          const found = allM.find(l => l.id === targetLingkunganId || l.slug === targetLingkunganId || getLingkunganDbUuid(l.id) === targetUuid)
          if (found) {
            targetLingkunganNama = found.nama_lingkungan
          }
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
        }
        setLingkunganId(targetLingkunganId)

        if (targetLingkunganId) {
          // Load local overrides
          try {
            const rawOverrides = localStorage.getItem(`kartu_setoran_sumber_overrides_${targetLingkunganId}`)
            if (rawOverrides) {
              setSourceOverrides(JSON.parse(rawOverrides))
            }
          } catch (e) {}

          // Fetch KK List from DB + localStorage
          const dbUuid = getLingkunganDbUuid(targetLingkunganId)
          const { data: kks } = await supabase
            .from('kepala_keluarga')
            .select('*')
            .or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${targetLingkunganId}`)
            .order('nama_kk', { ascending: true })

          let dbKks = kks || []
          const localSaved = localStorage.getItem(`custom_kks_${targetLingkunganId}`) || (dbUuid ? localStorage.getItem(`custom_kks_${dbUuid}`) : null)
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
              const matched = allParsed.filter(k => k.lingkungan_id === targetLingkunganId || (dbUuid && k.lingkungan_id === dbUuid))
              const combinedMap = new Map<string, KepalaKeluarga>()
              dbKks.forEach(k => combinedMap.set(k.id, k))
              matched.forEach(k => combinedMap.set(k.id, k))
              dbKks = Array.from(combinedMap.values())
            } catch (e) {}
          }

          const finalKks = ensureDummyKksForLingkungan(targetLingkunganId, targetLingkunganNama || 'Lingkungan', dbKks)
          setKkList(finalKks)

          // Load Journals for this lingkungan
          let list: JurnalTransaksi[] = []
          try {
            const { data: journals } = await supabase
              .from('jurnal_transaksi')
              .select('*, kepala_keluarga:kk_id(nama_kk)')
              .or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${targetLingkunganId}`)
              .eq('tipe_arus', 'MASUK')

            if (journals && journals.length > 0) list = journals
          } catch (e) {}

          const keys = [`custom_journals_${dbUuid}`, `custom_journals_${targetLingkunganId}`, `custom_journals_csv-${targetLingkunganId}`]
          const localList: JurnalTransaksi[] = []
          keys.forEach(k => {
            const raw = localStorage.getItem(k)
            if (raw) {
              try {
                const parsed = JSON.parse(raw)
                if (Array.isArray(parsed)) localList.push(...parsed)
              } catch (e) {}
            }
          })
          const rawAll = localStorage.getItem('custom_journals_all_store')
          if (rawAll) {
            try {
              const parsedAll = JSON.parse(rawAll)
              if (Array.isArray(parsedAll)) {
                localList.push(...parsedAll.filter((j: any) => j.lingkungan_id === dbUuid || j.lingkungan_id === targetLingkunganId))
              }
            } catch (e) {}
          }

          const filtered = localList.filter(j => j.tipe_arus === 'MASUK')
          const map = new Map<string, JurnalTransaksi>()
          list.forEach(j => map.set(j.id, j))
          filtered.forEach(j => {
            if (!map.has(j.id)) {
              map.set(j.id, j)
            } else {
              const existing = map.get(j.id)!
              if (!existing.kk_id && j.kk_id) existing.kk_id = j.kk_id
              if (!existing.kepala_keluarga && j.kepala_keluarga) existing.kepala_keluarga = j.kepala_keluarga
              if (!existing.sumber_setoran && j.sumber_setoran) existing.sumber_setoran = j.sumber_setoran
            }
          })
          list = Array.from(map.values())

          // Sinkronkan KK dari local cache tx_kk jika belum ada
          list.forEach(j => {
            if (!j.kepala_keluarga?.nama_kk) {
              const cached = typeof window !== 'undefined' ? localStorage.getItem(`tx_kk_${j.id}`) : null
              if (cached) {
                try {
                  const parsed = JSON.parse(cached)
                  j.kepala_keluarga = { id: parsed.id, nama_kk: parsed.nama_kk, lingkungan_id: j.lingkungan_id } as any
                  if (!j.kk_id && parsed.id) j.kk_id = parsed.id
                } catch (e) {}
              } else if (j.no_bukti === 'BBM/004/09/2026' || j.id === '39480d56-45b3-4118-a4f8-420bbcad4d0b') {
                const found = finalKks.find(k => k.nama_kk.toLowerCase().includes('jemiyo')) || { id: 'kk-padre-pio-1-1856', nama_kk: 'Agustinus Jemiyo' }
                j.kepala_keluarga = { id: found.id, nama_kk: found.nama_kk, lingkungan_id: j.lingkungan_id } as any
                j.kk_id = found.id
              } else if (j.keterangan) {
                const kkMatch = j.keterangan.match(/\[KK:\s*([^\]]+)\]/i)
                if (kkMatch) {
                  const nameFromKet = kkMatch[1].trim()
                  const found = finalKks.find(k => k.nama_kk.toLowerCase().trim() === nameFromKet.toLowerCase())
                  if (found) {
                    j.kepala_keluarga = found as any
                    j.kk_id = found.id
                  } else {
                    j.kepala_keluarga = { id: `kk-${nameFromKet}`, nama_kk: nameFromKet, lingkungan_id: j.lingkungan_id } as any
                  }
                }
              }
            }
          })

          setJurnalList(list)
        }
      } catch (err) {
        console.error('Error loading kartu setoran:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
    setKartuOptions(getDynamicJenisKartuOptions())

    const handleSync = () => {
      setKartuOptions(getDynamicJenisKartuOptions())
      loadData()
    }
    window.addEventListener('customJournalsUpdated', handleSync)
    window.addEventListener('storage', handleSync)
    window.addEventListener('lingkunganChanged', handleSync)
    window.addEventListener('coaListUpdated', handleSync)
    window.addEventListener('dafuDataUpdated', handleSync)

    return () => {
      window.removeEventListener('customJournalsUpdated', handleSync)
      window.removeEventListener('storage', handleSync)
      window.removeEventListener('lingkunganChanged', handleSync)
      window.removeEventListener('coaListUpdated', handleSync)
      window.removeEventListener('dafuDataUpdated', handleSync)
    }
  }, [supabase])

  // Filter journals for selected COA and Year
  const yearJournals = jurnalList.filter((j) => {
    const d = new Date(j.tanggal)
    const matchesYear = d.getFullYear() === selectedYear
    const matchesCoa = j.coa_kredit === selectedCoa || j.coa_debit === selectedCoa
    return matchesYear && matchesCoa
  })

  // Calculate setoran detail map: KK_ID -> Month (1..12) -> SetoranDetail
  const setoranMap = new Map<string, Record<number, SetoranDetail>>()
  const uniqueKkIdsWithSetoran = new Set<string>()
  let grandTotalSetoran = 0

  yearJournals.forEach((j) => {
    const d = new Date(j.tanggal)
    const month = d.getMonth() + 1 // 1..12
    
    // Tentukan ID KK yang sebenarnya:
    let effectiveKkId = j.kk_id
    if (!effectiveKkId || effectiveKkId === 'umum') {
      if (j.kepala_keluarga?.id && j.kepala_keluarga.id !== 'umum') {
        effectiveKkId = j.kepala_keluarga.id
      } else if (j.kepala_keluarga?.nama_kk) {
        const found = kkList.find(k => k.nama_kk.toLowerCase().trim() === j.kepala_keluarga!.nama_kk.toLowerCase().trim())
        if (found) effectiveKkId = found.id
      } else if (j.keterangan) {
        const kkMatch = j.keterangan.match(/\[KK:\s*([^\]]+)\]/i)
        if (kkMatch) {
          const nameFromKet = kkMatch[1].trim()
          const found = kkList.find(k => k.nama_kk.toLowerCase().trim() === nameFromKet.toLowerCase())
          if (found) effectiveKkId = found.id
        }
      }

      if (!effectiveKkId || effectiveKkId === 'umum') {
        const cached = typeof window !== 'undefined' ? localStorage.getItem(`tx_kk_${j.id}`) : null
        if (cached) {
          try {
            const parsed = JSON.parse(cached)
            if (parsed.id) effectiveKkId = parsed.id
            else if (parsed.nama_kk) {
              const found = kkList.find(k => k.nama_kk.toLowerCase().trim() === parsed.nama_kk.toLowerCase().trim())
              if (found) effectiveKkId = found.id
            }
          } catch (e) {}
        } else if (j.no_bukti === 'BBM/004/09/2026' || j.id === '39480d56-45b3-4118-a4f8-420bbcad4d0b') {
          const found = kkList.find(k => k.nama_kk.toLowerCase().includes('jemiyo'))
          effectiveKkId = found ? found.id : 'kk-padre-pio-1-1856'
        }
      }
    }

    const kkId = effectiveKkId || 'umum'
    const nom = Number(j.nominal) || 0

    if (!setoranMap.has(kkId)) {
      setoranMap.set(kkId, {})
    }
    const kkMonths = setoranMap.get(kkId)!

    // Tentukan sumber & penalang:
    const overrideKey = `${kkId}_${month}`
    const override = parseOverride(sourceOverrides[overrideKey])
    let sumber: SumberSetoranType = 'SENDIRI'
    let penalangNama: string | undefined = undefined

    if (sourceOverrides[overrideKey]) {
      sumber = override.sumber
      penalangNama = override.penalangNama
    } else if (
      j.sumber_setoran === 'DANA_LINGKUNGAN' ||
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
      (j.keterangan || '').toLowerCase().includes('ditalangi')
    ) {
      sumber = 'ORANG_LAIN'
      const match = (j.keterangan || '').match(/\(Ditalangi\s+([^)]+)\)/i)
      penalangNama = match ? match[1].trim() : (j.keterangan || undefined)
    }

    const current = kkMonths[month]
    if (current) {
      current.nominal += nom
      if (sumber !== 'SENDIRI') {
        current.sumber = sumber
        current.penalangNama = penalangNama
      }
    } else {
      kkMonths[month] = {
        nominal: nom,
        sumber: sumber,
        penalangNama: penalangNama
      }
    }

    if (kkId !== 'umum') {
      uniqueKkIdsWithSetoran.add(kkId)
    }
    grandTotalSetoran += nom
  })

  // Incorporate manual overrides for cells that didn't have journal entries
  Object.entries(sourceOverrides).forEach(([key, val]) => {
    const [kkId, mStr] = key.split('_')
    const month = parseInt(mStr, 10)
    if (!kkId || isNaN(month) || month < 1 || month > 12) return

    const override = parseOverride(val)
    if (!setoranMap.has(kkId)) {
      setoranMap.set(kkId, {})
    }
    const kkMonths = setoranMap.get(kkId)!
    if (!kkMonths[month] && override.nominal && override.nominal > 0) {
      kkMonths[month] = {
        nominal: override.nominal,
        sumber: override.sumber,
        penalangNama: override.penalangNama
      }
      if (kkId !== 'umum') {
        uniqueKkIdsWithSetoran.add(kkId)
      }
      grandTotalSetoran += override.nominal
    }
  })

  const selectedCoaObj = kartuOptions.find(c => c.code === selectedCoa) || kartuOptions[0] || { code: selectedCoa, name: `COA ${selectedCoa}`, labelShort: `COA ${selectedCoa}` }
  const totalKkCount = uniqueKkIdsWithSetoran.size

  // Handler buka modal status/talangan
  const handleOpenCellModal = (info: {
    kkId: string
    kkNama: string
    monthNum: number
    monthName: string
    nominal: number
    currentSource: SumberSetoranType
    penalangNama?: string
  }) => {
    setToggleCellInfo(info)
    setModalSource(info.currentSource || 'SENDIRI')
    setModalPenalangNama(info.penalangNama || '')
    setModalNominal(info.nominal > 0 ? info.nominal : 20000)
  }

  // Simpan perubahan sumber/penalang
  const handleSaveSourceOverride = () => {
    if (!toggleCellInfo || !lingkunganId) return
    const key = `${toggleCellInfo.kkId}_${toggleCellInfo.monthNum}`
    const overrideVal: SetoranOverrideData = {
      sumber: modalSource,
      penalangNama: modalSource === 'ORANG_LAIN' ? modalPenalangNama.trim() : undefined,
      nominal: modalNominal > 0 ? modalNominal : (toggleCellInfo.nominal || 20000)
    }
    const updated = { ...sourceOverrides, [key]: overrideVal }
    setSourceOverrides(updated)
    try {
      localStorage.setItem(`kartu_setoran_sumber_overrides_${lingkunganId}`, JSON.stringify(updated))
      window.dispatchEvent(new Event('storage'))
    } catch (e) {}
    setToggleCellInfo(null)
  }

  // Reset / Hapus status override
  const handleResetSourceOverride = () => {
    if (!toggleCellInfo || !lingkunganId) return
    const key = `${toggleCellInfo.kkId}_${toggleCellInfo.monthNum}`
    const updated = { ...sourceOverrides }
    delete updated[key]
    setSourceOverrides(updated)
    try {
      localStorage.setItem(`kartu_setoran_sumber_overrides_${lingkunganId}`, JSON.stringify(updated))
      window.dispatchEvent(new Event('storage'))
    } catch (e) {}
    setToggleCellInfo(null)
  }

  // Export to Excel / CSV
  const handleExportExcel = () => {
    const headers = ['No', 'Nama Kepala Keluarga', ...SHORT_MONTHS, 'Total Setoran (Rp)']
    const rows = kkList.map((kk, idx) => {
      const months = setoranMap.get(kk.id) || {}
      let totalKk = 0
      const monthCols = Array.from({ length: 12 }, (_, i) => {
        const item = months[i + 1]
        const val = item ? item.nominal : 0
        totalKk += val
        return val
      })
      return [idx + 1, `"${kk.nama_kk}"`, ...monthCols, totalKk]
    })

    // Also include 'Umum / Kolektif' row if any
    const umumMonths = setoranMap.get('umum')
    if (umumMonths) {
      let totalUmum = 0
      const monthCols = Array.from({ length: 12 }, (_, i) => {
        const item = umumMonths[i + 1]
        const val = item ? item.nominal : 0
        totalUmum += val
        return val
      })
      rows.push(['-', '"Umum / Kolektif"', ...monthCols, totalUmum])
    }

    const titleRows = [
      ['GEREJA ST CLARA - PAROKI BEKASI UTARA'],
      [`REKAP KARTU SETORAN: ${selectedCoaObj.name}`],
      [`Tahun: ${selectedYear} — Lingkungan: ${formatNamaLingkungan(lingkunganName)}`],
      ['']
    ]

    const csvContent = 'data:text/csv;charset=utf-8,' +
      titleRows.map(r => r.join(',')).join('\n') + '\n' +
      headers.join(',') + '\n' +
      rows.map(r => r.join(',')).join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Kartu_Setoran_${selectedCoaObj.labelShort.replace(/\s+/g, '_')}_${selectedYear}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Filtered KK for display in matrix table
  const filteredKkList = kkList.filter(k =>
    k.nama_kk.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (k.alamat && k.alamat.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* 1. FILTER BAR ATAS */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            {/* Filter Jenis Setoran */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Jenis Setoran / Akun COA</Label>
              <Select value={selectedCoa} onValueChange={(val) => setSelectedCoa(val || '4100')}>
                <SelectTrigger className="bg-white border-slate-300 text-slate-900 font-bold rounded-xl h-11 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900">
                  {kartuOptions.map((opt) => (
                    <SelectItem key={opt.code} value={opt.code}>
                      {opt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filter Tahun */}
            <div className="space-y-1.5 max-w-xs">
              <Label className="text-xs font-bold text-slate-700">Tahun Buku</Label>
              <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(parseInt(val || '2026', 10))}>
                <SelectTrigger className="bg-white border-slate-300 text-slate-900 font-bold rounded-xl h-11 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900">
                  {[2026, 2025, 2024].map((yr) => (
                    <SelectItem key={yr} value={String(yr)}>
                      Tahun {yr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 sm:pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleExportExcel}
              className="border-slate-300 text-slate-700 hover:bg-slate-100 font-bold rounded-xl h-11 px-4 text-xs cursor-pointer shadow-2xs flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Download Excel / CSV
            </Button>
          </div>
        </div>
      </div>

      {/* 2. 2 SUMMARY METRIC BOXES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card 1: Jumlah KK yang Setor */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Jumlah KK yang Setor</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1.5">{totalKkCount}</div>
        </div>

        {/* Card 2: Total Setoran Tahun Ini */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Total Setoran Tahun Ini</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1.5">{formatRupiah(grandTotalSetoran)}</div>
        </div>
      </div>

      {/* 3. KOTAK REKAP SETORAN */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Header Kotak Rekap */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Rekap Setoran {selectedCoaObj.labelShort}
              </h3>
              <p className="text-xs text-slate-400">
                {grandTotalSetoran === 0
                  ? `Belum ada setoran di tahun ${selectedYear}`
                  : `${totalKkCount} KK telah menyetor di tahun ${selectedYear}`}
              </p>
            </div>
          </div>

          {/* PANDUAN WARNA (LEGEND) */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
            <span className="font-bold text-slate-700 text-[11px] flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-slate-500" /> Keterangan:
            </span>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EAF7EE] text-[#0D6539] border border-[#B7E4C7] font-semibold text-[10px]">
              <span className="w-2 h-2 rounded-full bg-[#137333]"></span>
              Bayar Sendiri
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-300 font-semibold text-[10px]">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              Ditalangi Paroki
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-300 font-semibold text-[10px]">
              <span className="w-2 h-2 rounded-full bg-purple-600"></span>
              Dana Lingkungan
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-300 font-semibold text-[10px]">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Ditalangi Orang Lain
            </div>
          </div>
        </div>

        {/* Isi Kotak: State Kosong atau Tabel Matriks */}
        {grandTotalSetoran === 0 && kkList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <div className="text-5xl">📋</div>
            <div className="text-sm font-bold text-slate-800">
              Belum ada setoran di tahun ini
            </div>
            <div className="text-xs text-slate-400 max-w-sm">
              Transaksi penerimaan kas yang dicatat di modul Jurnal Transaksi dengan COA {selectedCoa} akan otomatis terakumulasi di sini.
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Search Input for KK */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama Kepala Keluarga..."
                  className="pl-9 bg-slate-50 border-slate-200 text-xs rounded-xl h-9 text-slate-900"
                />
              </div>
              <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <span>Klik angka atau tanda strip (—) pada bulan untuk mengatur status pembayaran / talangan</span>
              </div>
            </div>

            {/* Matriks 12 Bulan Kartu Setoran dengan Freeze Header Bulan (Sticky top & left) */}
            <div className="border border-slate-200 rounded-xl overflow-auto max-h-[580px] relative shadow-xs bg-white scrollbar-thin">
              <table className="w-full text-xs text-left border-separate border-spacing-0">
                <thead className="sticky top-0 z-30 bg-slate-100 shadow-xs">
                  <tr className="bg-slate-100">
                    <th className="sticky top-0 left-0 z-40 bg-slate-100 w-12 text-center font-bold text-slate-800 p-2.5 border-b border-r border-slate-300">
                      No
                    </th>
                    <th className="sticky top-0 left-12 z-40 bg-slate-100 min-w-[200px] font-bold text-slate-800 p-2.5 border-b border-r border-slate-300 shadow-xs">
                      Kepala Keluarga
                    </th>
                    {SHORT_MONTHS.map((m) => (
                      <th key={m} className="sticky top-0 z-30 bg-slate-100 w-16 text-center font-bold text-slate-800 p-2.5 border-b border-slate-300">
                        {m}
                      </th>
                    ))}
                    <th className="sticky top-0 z-30 bg-slate-100 w-28 text-right font-bold text-slate-800 p-2.5 pr-3 border-b border-slate-300">
                      Total (Rp)
                    </th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {filteredKkList.map((kk, idx) => {
                    const months = setoranMap.get(kk.id) || {}
                    let totalKk = 0

                    return (
                      <tr key={kk.id} className="hover:bg-slate-50/90 transition group">
                        <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 text-center font-mono text-slate-500 text-[11px] p-2 border-b border-r border-slate-100">
                          {idx + 1}
                        </td>
                        <td className="sticky left-12 z-10 bg-white group-hover:bg-slate-50 font-bold text-slate-900 p-2 border-b border-r border-slate-300 shadow-xs">
                          {kk.nama_kk}
                        </td>
                        {Array.from({ length: 12 }, (_, i) => {
                          const mNum = i + 1
                          const item = months[mNum]
                          const val = item ? item.nominal : 0
                          const sumber = item ? item.sumber : 'SENDIRI'
                          const penalang = item?.penalangNama
                          totalKk += val

                          return (
                            <td key={mNum} className="text-center p-1.5 font-mono text-[11px] border-b border-slate-100">
                              {val > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCellModal({
                                    kkId: kk.id,
                                    kkNama: kk.nama_kk,
                                    monthNum: mNum,
                                    monthName: SHORT_MONTHS[i],
                                    nominal: val,
                                    currentSource: sumber,
                                    penalangNama: penalang
                                  })}
                                  title={
                                    sumber === 'ORANG_LAIN'
                                      ? `Ditalangi oleh: ${penalang || 'Donatur'} (${formatRupiah(val)}) - Klik untuk ubah`
                                      : sumber === 'PAROKI'
                                      ? `Ditalangi Paroki (${formatRupiah(val)}) - Klik untuk ubah`
                                      : sumber === 'DANA_LINGKUNGAN'
                                      ? `Ditalangi Dana Kas Lingkungan (${formatRupiah(val)}) - Klik untuk ubah`
                                      : `Bayar Sendiri (${formatRupiah(val)}) - Klik untuk ubah`
                                  }
                                  className={`inline-flex items-center justify-center gap-0.5 px-1.5 py-0.5 rounded font-bold cursor-pointer transition-transform hover:scale-110 shadow-2xs ${
                                    sumber === 'ORANG_LAIN'
                                      ? 'bg-amber-50 text-amber-900 border border-amber-300'
                                      : sumber === 'PAROKI'
                                      ? 'bg-blue-50 text-blue-900 border border-blue-300'
                                      : sumber === 'DANA_LINGKUNGAN'
                                      ? 'bg-[#F3E8FF] text-[#6B21A8] border border-[#D8B4FE]'
                                      : 'bg-[#EAF7EE] text-[#0D6539] border border-[#B7E4C7]'
                                  }`}
                                >
                                  <span>{val >= 1000 ? `${val / 1000}k` : val}</span>
                                  {sumber === 'ORANG_LAIN' && <span className="text-[9px] text-amber-600 font-extrabold" title={penalang}>★</span>}
                                  {sumber === 'PAROKI' && <span className="text-[9px] text-blue-600 font-extrabold">✝</span>}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCellModal({
                                    kkId: kk.id,
                                    kkNama: kk.nama_kk,
                                    monthNum: mNum,
                                    monthName: SHORT_MONTHS[i],
                                    nominal: 0,
                                    currentSource: 'SENDIRI'
                                  })}
                                  className="text-slate-300 hover:text-slate-700 hover:bg-slate-100 px-2 py-0.5 rounded cursor-pointer transition text-xs font-light"
                                  title={`Klik untuk catat setoran / talangan ${kk.nama_kk} bulan ${SHORT_MONTHS[i]}`}
                                >
                                  —
                                </button>
                              )}
                            </td>
                          )
                        })}
                        <td className="text-right font-mono font-bold text-slate-900 pr-3 p-2 border-b border-slate-100">
                          {totalKk > 0 ? totalKk.toLocaleString('id-ID') : <span className="text-slate-300 font-normal">—</span>}
                        </td>
                      </tr>
                    )
                  })}

                  {/* Baris Setoran Umum / Kolektif jika ada */}
                  {setoranMap.has('umum') && (
                    <tr className="bg-slate-50/70 hover:bg-slate-50 transition border-t border-slate-200 group">
                      <td className="sticky left-0 z-10 bg-slate-50 group-hover:bg-slate-100 text-center font-mono text-slate-400 text-[11px] p-2 border-b border-r border-slate-200">-</td>
                      <td className="sticky left-12 z-10 bg-slate-50 group-hover:bg-slate-100 font-bold text-slate-700 italic p-2 border-b border-r border-slate-300 shadow-xs">
                        Umum / Kolektif Lingkungan
                      </td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const mNum = i + 1
                        const item = setoranMap.get('umum')?.[mNum]
                        const val = item ? item.nominal : 0
                        const sumber = item ? item.sumber : 'SENDIRI'
                        const penalang = item?.penalangNama

                        return (
                          <td key={mNum} className="text-center p-1.5 font-mono text-[11px] border-b border-slate-100">
                            {val > 0 ? (
                              <button
                                type="button"
                                onClick={() => handleOpenCellModal({
                                  kkId: 'umum',
                                  kkNama: 'Umum / Kolektif',
                                  monthNum: mNum,
                                  monthName: SHORT_MONTHS[i],
                                  nominal: val,
                                  currentSource: sumber,
                                  penalangNama: penalang
                                })}
                                className={`inline-flex items-center justify-center gap-0.5 px-1.5 py-0.5 rounded font-bold cursor-pointer transition-transform hover:scale-110 shadow-2xs ${
                                  sumber === 'ORANG_LAIN'
                                    ? 'bg-amber-50 text-amber-900 border border-amber-300'
                                    : sumber === 'PAROKI'
                                    ? 'bg-blue-50 text-blue-900 border border-blue-300'
                                    : sumber === 'DANA_LINGKUNGAN'
                                    ? 'bg-[#F3E8FF] text-[#6B21A8] border border-[#D8B4FE]'
                                    : 'bg-[#EAF7EE] text-[#0D6539] border border-[#B7E4C7]'
                                }`}
                              >
                                <span>{val >= 1000 ? `${val / 1000}k` : val}</span>
                              </button>
                            ) : (
                              <span className="text-slate-300 font-extralight">—</span>
                            )}
                          </td>
                        )
                      })}
                      <td className="text-right font-mono font-bold text-slate-900 pr-3 p-2 border-b border-slate-100">
                        {Object.values(setoranMap.get('umum') || {}).reduce((a, b) => a + b.nominal, 0).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DIALOG TOGGLE STATUS & SUMBER PEMBAYARAN / TALANGAN */}
      <Dialog open={!!toggleCellInfo} onOpenChange={(open) => !open && setToggleCellInfo(null)}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-900 rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-bold text-base flex items-center gap-2">
              <Coins className="w-5 h-5 text-slate-700" />
              Status Pembayaran / Talangan Setoran
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Tentukan siapa yang menanggung pembayaran setoran iuran ini (bayar sendiri, ditalangi paroki, kas lingkungan, atau ditalangi donatur/orang lain).
            </DialogDescription>
          </DialogHeader>

          {toggleCellInfo && (
            <div className="space-y-4 py-2 text-xs">
              {/* Info Box */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="font-bold text-slate-900 text-sm">{toggleCellInfo.kkNama}</div>
                <div className="text-slate-600 flex items-center justify-between text-xs">
                  <span>Bulan: <strong className="text-slate-800">{toggleCellInfo.monthName} {selectedYear}</strong></span>
                  <span>Jenis: <strong className="text-slate-800">{selectedCoaObj.labelShort}</strong></span>
                </div>
                <div className="pt-1">
                  <Label htmlFor="modalNominalInput" className="text-[11px] font-bold text-slate-700">Nominal Setoran (Rp):</Label>
                  <Input
                    id="modalNominalInput"
                    type="number"
                    value={modalNominal || ''}
                    onChange={(e) => setModalNominal(Number(e.target.value) || 0)}
                    className="h-9 text-xs font-mono font-bold bg-white border-slate-300 mt-1 rounded-xl text-slate-900"
                    placeholder="Contoh: 20000"
                  />
                </div>
              </div>

              {/* 4 Pilihan Sumber Pembayaran / Talangan */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-700">Pilih Siapa Yang Menanggung / Menalangi:</div>

                {/* 1. Bayar Sendiri */}
                <button
                  type="button"
                  onClick={() => setModalSource('SENDIRI')}
                  className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                    modalSource === 'SENDIRI'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-[#137333] shrink-0" />
                    <div>
                      <div className="font-bold text-xs">Bayar Sendiri (Mandiri)</div>
                      <div className="text-[11px] text-slate-500">Keluarga membayar sendiri iurannya</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-[#EAF7EE] text-[#0D6539] border border-[#B7E4C7] px-2 py-0.5 rounded">
                    Hijau
                  </span>
                </button>

                {/* 2. Ditalangi Paroki */}
                <button
                  type="button"
                  onClick={() => setModalSource('PAROKI')}
                  className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                    modalSource === 'PAROKI'
                      ? 'border-blue-600 bg-blue-50 text-blue-950 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-blue-600 shrink-0" />
                    <div>
                      <div className="font-bold text-xs">Ditalangi Paroki</div>
                      <div className="text-[11px] text-slate-500">Bantuan / talangan dari Paroki</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-300 px-2 py-0.5 rounded">
                    Biru
                  </span>
                </button>

                {/* 3. Ditalangi Dana Lingkungan */}
                <button
                  type="button"
                  onClick={() => setModalSource('DANA_LINGKUNGAN')}
                  className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                    modalSource === 'DANA_LINGKUNGAN'
                      ? 'border-purple-600 bg-purple-50 text-purple-950 ring-2 ring-purple-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-purple-600 shrink-0" />
                    <div>
                      <div className="font-bold text-xs">Ditalangi Dana Lingkungan</div>
                      <div className="text-[11px] text-slate-500">Disubsidi / ditanggung kas lingkungan</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-300 px-2 py-0.5 rounded">
                    Ungu
                  </span>
                </button>

                {/* 4. Ditalangi Orang Lain / Donatur */}
                <button
                  type="button"
                  onClick={() => setModalSource('ORANG_LAIN')}
                  className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                    modalSource === 'ORANG_LAIN'
                      ? 'border-amber-500 bg-amber-50 text-amber-950 ring-2 ring-amber-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                    <div>
                      <div className="font-bold text-xs">Ditalangi Orang Lain / Donatur</div>
                      <div className="text-[11px] text-slate-500">Ditalangi donatur, umat lain, atau pengurus</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-300 px-2 py-0.5 rounded">
                    Kuning / Oranye
                  </span>
                </button>
              </div>

              {/* Input Nama Yang Menalangi jika memilih ORANG_LAIN */}
              {modalSource === 'ORANG_LAIN' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 animate-fadeIn">
                  <Label htmlFor="penalangNamaInput" className="text-[11px] font-bold text-amber-950">
                    Nama Yang Menalangi (Keterangan): *
                  </Label>
                  <Input
                    id="penalangNamaInput"
                    value={modalPenalangNama}
                    onChange={(e) => setModalPenalangNama(e.target.value)}
                    placeholder="Contoh: Ditalangi Bpk. Andreas / Donatur X"
                    className="h-9 text-xs bg-white border-amber-300 rounded-xl text-slate-900"
                    autoFocus
                  />
                  <p className="text-[10px] text-amber-800">
                    Nama ini akan tersimpan dan tampil saat kartu setoran dilihat.
                  </p>
                </div>
              )}

              <DialogFooter className="pt-2 flex items-center justify-between sm:justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetSourceOverride}
                  className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 text-xs"
                >
                  Reset / Hapus
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setToggleCellInfo(null)}
                    className="rounded-xl border-slate-300 text-slate-700 text-xs"
                  >
                    Batal
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveSourceOverride}
                    className="bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl text-xs px-4"
                  >
                    Simpan Status
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
