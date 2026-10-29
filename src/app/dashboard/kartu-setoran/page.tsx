'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { KepalaKeluarga, JurnalTransaksi } from '@/lib/types'
import { formatRupiah, MONTH_NAMES } from '@/lib/utils'
import { formatNamaLingkungan, getAllMasterLingkungan, findLingkunganByQuery, getLingkunganDbUuid } from '@/lib/constants'
import { reconcileJournals } from '@/lib/journalSync'
import { ensureDummyKksForLingkungan, getDummyKkListForLingkungan } from '@/lib/dummyData'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
  User,
  Building2,
  RotateCcw,
  Users,
  X
} from 'lucide-react'

const JENIS_KARTU_OPTIONS = [
  { code: '4100', name: 'Iuran Kas Lingkungan — COA 4100', labelShort: 'Kas Lingkungan' },
  { code: '4200', name: 'Sumbangan ASAK — COA 4200', labelShort: 'ASAK' },
  { code: '4120', name: 'Sumbangan Dahar Romo — COA 4120', labelShort: 'Dahar Romo' },
  { code: '4300', name: 'Iuran Dana Kematian / St. Yusuf — COA 4300', labelShort: 'St. Yusuf' },
  { code: '5340', name: 'Sumbangan Dana PPG — COA 5340', labelShort: 'PPG' },
  { code: '4501', name: 'Iuran Celengan CYTM — COA 4501', labelShort: 'CYTM' }
]

function getDynamicJenisKartuOptions(): Array<{ code: string; name: string; labelShort: string }> {
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

export interface DisplayKkItem extends KepalaKeluarga {
  statusUmat?: 'AKTIF' | 'PINDAH' | 'KELUAR'
  isLunas?: boolean
  paidMonthsCount?: number
}

export default function KartuSetoranPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [lingkunganId, setLingkunganId] = useState<string | null>(null)
  const [lingkunganName, setLingkunganName] = useState('')

  const [kkList, setKkList] = useState<KepalaKeluarga[]>([])
  const [allDbKks, setAllDbKks] = useState<KepalaKeluarga[]>([])
  const [deletedKkSet, setDeletedKkSet] = useState<Set<string>>(new Set())
  const [umatStatusOverrides, setUmatStatusOverrides] = useState<Record<string, 'AKTIF' | 'PINDAH' | 'KELUAR'>>({})
  const [jurnalList, setJurnalList] = useState<JurnalTransaksi[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showAllStatus, setShowAllStatus] = useState(false)
  const [isManageModalOpen, setIsManageModalOpen] = useState(false)
  const kartuTableRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updateStickyOffset = () => {
      const container = kartuTableRef.current
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
    }

    updateStickyOffset()
    const mainEl = document.querySelector('main')
    if (mainEl) mainEl.addEventListener('scroll', updateStickyOffset, { passive: true })
    window.addEventListener('scroll', updateStickyOffset, { passive: true })
    window.addEventListener('resize', updateStickyOffset, { passive: true })

    return () => {
      if (mainEl) mainEl.removeEventListener('scroll', updateStickyOffset)
      window.removeEventListener('scroll', updateStickyOffset)
      window.removeEventListener('resize', updateStickyOffset)
    }
  }, [loading, lingkunganId, kkList.length])
  const [selectedDonasiNote, setSelectedDonasiNote] = useState<{
    namaKk: string
    bulan: string
    nominal: number
    penalang: string
  } | null>(null)

  // Filter State
  const [kartuOptions, setKartuOptions] = useState<Array<{ code: string; name: string; labelShort: string }>>(JENIS_KARTU_OPTIONS)
  const [selectedCoa, setSelectedCoa] = useState<string>('4100')
  const [selectedYear, setSelectedYear] = useState<number>(2026)

  // Local overrides: key = `${kkId}_${month}` -> SetoranOverrideData | string
  const [sourceOverrides, setSourceOverrides] = useState<Record<string, SetoranOverrideData | string>>({})

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

        // 1. Jika Bendahara/Sekretaris, prioritaskan data identitas username / email
        if (effectiveRole !== 'PAROKI' && effectiveEmail) {
          const matched = findLingkunganByQuery(effectiveEmail)
          if (matched) {
            targetLingkunganId = matched.id
            targetLingkunganNama = matched.nama_lingkungan
          }
        }

        // 2. Jika belum ketemu dari email/username, gunakan data sesi lingkungan di cookie
        if (!targetLingkunganId && effectiveRole !== 'PAROKI' && cookieLingId) {
          targetLingkunganId = cookieLingId
          targetLingkunganNama = cookieLingNama || null
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
              const parsed = JSON.parse(rawOverrides)
              let changed = false
              Object.keys(parsed).forEach(k => {
                // Purge testing override fiktif 500k
                if (JSON.stringify(parsed[k]).includes('500000') || k.includes('1856')) {
                  delete parsed[k]
                  changed = true
                }
              })
              if (changed) {
                localStorage.setItem(`kartu_setoran_sumber_overrides_${targetLingkunganId}`, JSON.stringify(parsed))
              }
              setSourceOverrides(parsed)
            }
            const dbUuidForStatus = getLingkunganDbUuid(targetLingkunganId)
            const rawStatus1 = localStorage.getItem(`kartu_setoran_umat_status_${targetLingkunganId}`)
            const rawStatus2 = dbUuidForStatus ? localStorage.getItem(`kartu_setoran_umat_status_${dbUuidForStatus}`) : null
            const mergedStatus = {
              ...(rawStatus2 ? JSON.parse(rawStatus2) : {}),
              ...(rawStatus1 ? JSON.parse(rawStatus1) : {})
            }
            setUmatStatusOverrides(mergedStatus)
          } catch (e) {}

          // Load deletedSet
          const dbUuid = getLingkunganDbUuid(targetLingkunganId)
          let deletedSet = new Set<string>()
          if (typeof window !== 'undefined') {
            try {
              const rawAll = localStorage.getItem('custom_kks_deleted_store')
              const rawL = localStorage.getItem(`custom_kks_deleted_${targetLingkunganId}`)
              const rawU = dbUuid ? localStorage.getItem(`custom_kks_deleted_${dbUuid}`) : null
              const allD: string[] = rawAll ? JSON.parse(rawAll) : []
              const lD: string[] = rawL ? JSON.parse(rawL) : []
              const uD: string[] = rawU ? JSON.parse(rawU) : []
              deletedSet = new Set([...allD, ...lD, ...uD].map(s => String(s).toLowerCase().trim()))
            } catch (e) {}
          }
          // Tambahkan test12 ke deletedSet agar tidak pernah muncul
          deletedSet.add('test12')
          deletedSet.add('test 12')
          setDeletedKkSet(deletedSet)

          // Fetch KK List from DB + localStorage
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
              dbKks.forEach((k: any) => combinedMap.set(k.id, k))
              parsed.forEach((k: any) => combinedMap.set(k.id, k))
              dbKks = Array.from(combinedMap.values())
            } catch (e) {}
          }

          const allSaved = localStorage.getItem('custom_kks_all_store')
          if (allSaved) {
            try {
              const allParsed: KepalaKeluarga[] = JSON.parse(allSaved)
              const matched = allParsed.filter((k: any) => k.lingkungan_id === targetLingkunganId || (dbUuid && k.lingkungan_id === dbUuid))
              const combinedMap = new Map<string, KepalaKeluarga>()
              dbKks.forEach((k: any) => combinedMap.set(k.id, k))
              matched.forEach((k: any) => combinedMap.set(k.id, k))
              dbKks = Array.from(combinedMap.values())
            } catch (e) {}
          }

          const finalKks = ensureDummyKksForLingkungan(targetLingkunganId, targetLingkunganNama || 'Lingkungan', dbKks)
          setKkList(finalKks)

          // Gabungkan seluruh KK yang pernah ada (DB + CSV baseline) agar KK yang dihapus dari DAFU tetap muncul di Kartu Setoran dengan status Pindah
          const baselineKks = getDummyKkListForLingkungan(targetLingkunganId, targetLingkunganNama || 'Lingkungan')
          const activeNames = new Set(finalKks.map(k => (k.nama_kk || '').toLowerCase().trim()))
          const allKnownMap = new Map<string, KepalaKeluarga>()
          dbKks.forEach((k: KepalaKeluarga) => allKnownMap.set(k.id, k))
          baselineKks.forEach((bk: KepalaKeluarga) => {
            const bNorm = (bk.nama_kk || '').toLowerCase().trim()
            const existsInDb = Array.from(allKnownMap.values()).some(x => (x.nama_kk || '').toLowerCase().trim() === bNorm)
            if (!existsInDb) {
              const isDeletedFromDafu = !activeNames.has(bNorm) || deletedSet.has(bNorm) || deletedSet.has((bk.id || '').toLowerCase().trim())
              allKnownMap.set(bk.id, {
                ...bk,
                alamat: isDeletedFromDafu ? `${bk.alamat || ''} [PINDAH]`.trim() : bk.alamat
              })
            }
          })
          const allKnownKks = Array.from(allKnownMap.values())
          setAllDbKks(allKnownKks)

          // Load Journals for this lingkungan
          let list: JurnalTransaksi[] = []
          let supabaseSuccess = false
          try {
            const { data: journals, error } = await supabase
              .from('jurnal_transaksi')
              .select('*, kepala_keluarga:kk_id(nama_kk)')
              .or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${targetLingkunganId}`)

            if (!error && Array.isArray(journals)) {
              supabaseSuccess = true
              list = journals
            }
          } catch (e) {}

          const reconciled = reconcileJournals(list, dbUuid, targetLingkunganId, supabaseSuccess)
          list = reconciled.filter(j => !(j.no_bukti?.startsWith('[SA/') || (j.keterangan || '').includes('[SALDO_AWAL]')))

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
              } else if (j.keterangan) {
                const kkMatch = j.keterangan.match(/\[KK:\s*([^\]]+)\]/i)
                if (kkMatch) {
                  const nameFromKet = kkMatch[1].trim()
                  const found = finalKks.find(k => k.nama_kk.toLowerCase().trim() === nameFromKet.toLowerCase()) ||
                    allKnownKks.find(k => k.nama_kk.toLowerCase().trim() === nameFromKet.toLowerCase())
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
    if (effectiveKkId === 'kk-padre-pio-1-1856' || (j.kepala_keluarga?.nama_kk && j.kepala_keluarga.nama_kk.toLowerCase().includes('jemiyo'))) {
      const foundJemiyo = kkList.find(k => k.nama_kk.toLowerCase().includes('jemiyo')) || allDbKks.find(k => k.nama_kk.toLowerCase().includes('jemiyo'))
      if (foundJemiyo) effectiveKkId = foundJemiyo.id
    }

    if (!effectiveKkId || effectiveKkId === 'umum') {
      if (j.kepala_keluarga?.id && j.kepala_keluarga.id !== 'umum') {
        effectiveKkId = j.kepala_keluarga.id
      } else if (j.kepala_keluarga?.nama_kk) {
        const targetN = j.kepala_keluarga.nama_kk.toLowerCase().trim()
        const found = kkList.find(k => k.nama_kk.toLowerCase().trim() === targetN) || allDbKks.find(k => k.nama_kk.toLowerCase().trim() === targetN)
        if (found) effectiveKkId = found.id
      } else if (j.keterangan) {
        const kkMatch = j.keterangan.match(/\[KK:\s*([^\]]+)\]/i)
        if (kkMatch) {
          const nameFromKet = kkMatch[1].trim().toLowerCase()
          const found = kkList.find(k => k.nama_kk.toLowerCase().trim() === nameFromKet) || allDbKks.find(k => k.nama_kk.toLowerCase().trim() === nameFromKet)
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
              const targetN = parsed.nama_kk.toLowerCase().trim()
              const found = kkList.find(k => k.nama_kk.toLowerCase().trim() === targetN) || allDbKks.find(k => k.nama_kk.toLowerCase().trim() === targetN)
              if (found) effectiveKkId = found.id
            }
          } catch (e) {}
        }
      }
    }

    const kkId = effectiveKkId || 'umum'
    const rawNom = Number(j.nominal) || 0
    const isPengurangan = j.tipe_arus === 'KELUAR' || (j.coa_debit === selectedCoa && j.coa_kredit !== selectedCoa)
    const nom = isPengurangan ? -Math.abs(rawNom) : Math.abs(rawNom)

    if (!setoranMap.has(kkId)) {
      setoranMap.set(kkId, {})
    }
    const kkMonths = setoranMap.get(kkId)!

    // Cek apakah transaksi memiliki alokasi multi-bulan
    // Contoh: [Bulan: 1, 2, 3] atau [Bulan: Jan, Feb, Mar] atau [Bulan: Jan-Jun]
    const bulanMatch = (j.keterangan || '').match(/\[Bulan:\s*([^\]]+)\]/i)
    let targetMonths: number[] = [month]
    if (bulanMatch) {
      const parsedMonths: number[] = []
      const monthMapLookup: Record<string, number> = {
        '1': 1, '01': 1, 'jan': 1, 'januari': 1,
        '2': 2, '02': 2, 'feb': 2, 'februari': 2,
        '3': 3, '03': 3, 'mar': 3, 'maret': 3,
        '4': 4, '04': 4, 'apr': 4, 'april': 4,
        '5': 5, '05': 5, 'mei': 5,
        '6': 6, '06': 6, 'jun': 6, 'juni': 6,
        '7': 7, '07': 7, 'jul': 7, 'juli': 7,
        '8': 8, '08': 8, 'ags': 8, 'agustus': 8,
        '9': 9, '09': 9, 'sep': 9, 'september': 9,
        '10': 10, 'okt': 10, 'oktober': 10,
        '11': 11, 'nov': 11, 'november': 11,
        '12': 12, 'des': 12, 'desember': 12
      }

      const rawContent = bulanMatch[1].trim()
      const rangeMatch = rawContent.match(/^([a-z0-9]+)\s*[-–—]\s*([a-z0-9]+)$/i)
      if (rangeMatch) {
        const startM = monthMapLookup[rangeMatch[1].toLowerCase()]
        const endM = monthMapLookup[rangeMatch[2].toLowerCase()]
        if (startM && endM && startM <= endM) {
          for (let m = startM; m <= endM; m++) {
            parsedMonths.push(m)
          }
        }
      } else {
        const monthParts = rawContent.split(/[,;\s]+/).map(s => s.trim().toLowerCase())
        monthParts.forEach(p => {
          const subRange = p.match(/^([a-z0-9]+)[-–—]([a-z0-9]+)$/i)
          if (subRange) {
            const sM = monthMapLookup[subRange[1].toLowerCase()]
            const eM = monthMapLookup[subRange[2].toLowerCase()]
            if (sM && eM && sM <= eM) {
              for (let m = sM; m <= eM; m++) {
                if (!parsedMonths.includes(m)) parsedMonths.push(m)
              }
              return
            }
          }
          if (monthMapLookup[p] && !parsedMonths.includes(monthMapLookup[p])) {
            parsedMonths.push(monthMapLookup[p])
          }
        })
      }

      if (parsedMonths.length > 0) {
        targetMonths = parsedMonths
      }
    }

    const nomPerMonth = Math.round(nom / targetMonths.length)

    targetMonths.forEach((mNum) => {
      // Tentukan sumber & penalang:
      const overrideKey = `${kkId}_${mNum}`
      const override = parseOverride(sourceOverrides[overrideKey])
      let sumber: SumberSetoranType = 'SENDIRI'
      let penalangNama: string | undefined = undefined

      if (sourceOverrides[overrideKey]) {
        sumber = override.sumber
        penalangNama = override.penalangNama
      } else if (
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

      const current = kkMonths[mNum]
      if (current) {
        current.nominal += nomPerMonth
        if (sumber !== 'SENDIRI') {
          current.sumber = sumber
          current.penalangNama = penalangNama
        }
      } else {
        kkMonths[mNum] = {
          nominal: nomPerMonth,
          sumber: sumber,
          penalangNama: penalangNama
        }
      }
    })

    if (kkId !== 'umum') {
      uniqueKkIdsWithSetoran.add(kkId)
    }
    grandTotalSetoran += nom
  })

  const selectedCoaObj = kartuOptions.find(c => c.code === selectedCoa) || kartuOptions[0] || { code: selectedCoa, name: `COA ${selectedCoa}`, labelShort: `COA ${selectedCoa}` }
  const totalKkCount = uniqueKkIdsWithSetoran.size

  // Bangun daftar KK lengkap tanpa duplikasi nama, skip dummy test12
  const allCombinedKksMap = new Map<string, KepalaKeluarga>()
  const seenNormalizedNames = new Map<string, string>() // cleanName -> primaryId

  const addOrMergeKk = (k: KepalaKeluarga) => {
    if (!k || !k.nama_kk) return
    let fixedName = k.nama_kk
    if (fixedName === 'kk-padre-pio-1-1856' || k.id === 'kk-padre-pio-1-1856') {
      fixedName = 'Agustinus Jemiyo'
      k.nama_kk = 'Agustinus Jemiyo'
    }

    const norm = fixedName.toLowerCase().trim()
    // Abaikan data testing dummy seperti test12
    if (norm.includes('test12') || norm.includes('test 12') || norm === 'dimas') return

    if (!seenNormalizedNames.has(norm)) {
      seenNormalizedNames.set(norm, k.id)
      allCombinedKksMap.set(k.id, k)
    } else {
      // Nama sudah ada sebelumnya! Gabungkan riwayat setoran jika ada agar tidak ada baris ganda
      const primaryId = seenNormalizedNames.get(norm)!
      if (primaryId !== k.id) {
        const secondaryMonths = setoranMap.get(k.id)
        if (secondaryMonths) {
          if (!setoranMap.has(primaryId)) setoranMap.set(primaryId, {})
          const primaryMonths = setoranMap.get(primaryId)!
          Object.entries(secondaryMonths).forEach(([m, detail]) => {
            const mNum = parseInt(m, 10)
            if (!primaryMonths[mNum]) {
              primaryMonths[mNum] = detail
            } else {
              primaryMonths[mNum].nominal += detail.nominal
            }
          })
          setoranMap.delete(k.id)
        }
      }
    }
  }

  kkList.forEach(addOrMergeKk)
  allDbKks.forEach(addOrMergeKk)

  setoranMap.forEach((_, kkId) => {
    if (kkId !== 'umum' && !allCombinedKksMap.has(kkId)) {
      const jMatch = yearJournals.find(j => j.kk_id === kkId || j.kepala_keluarga?.id === kkId)
      let nama = jMatch?.kepala_keluarga?.nama_kk
      if (!nama || nama === kkId || nama.startsWith('kk-')) {
        const foundInDb = allDbKks.find(k => k.id === kkId) || kkList.find(k => k.id === kkId)
        if (foundInDb && foundInDb.nama_kk && !foundInDb.nama_kk.startsWith('kk-')) {
          nama = foundInDb.nama_kk
        } else if (kkId === 'kk-padre-pio-1-1856' || kkId.includes('1856')) {
          nama = 'Agustinus Jemiyo'
        } else if (kkId.startsWith('kk-')) {
          const cleanNameFromId = kkId.replace(/^kk-[a-z0-9]+-[0-9]+-?/i, '').replace(/^kk-/, '').replace(/-/g, ' ')
          nama = cleanNameFromId.charAt(0).toUpperCase() + cleanNameFromId.slice(1)
        }
      }
      nama = nama || kkId
      addOrMergeKk({
        id: kkId,
        lingkungan_id: lingkunganId || '',
        nama_kk: nama,
        alamat: 'Pindah / Keluar',
        is_biduk: true
      })
    }
  })

  const allPindahKeluarList: Array<{ kk: KepalaKeluarga; status: 'PINDAH' | 'KELUAR'; paidMonthsCount: number; isLunas: boolean }> = []
  const displayedKkList: DisplayKkItem[] = []
  const activeDafuNameSet = new Set(kkList.map(k => (k.nama_kk || '').toLowerCase().trim()))

  Array.from(allCombinedKksMap.values()).forEach(k => {
    const cleanId = (k.id || '').toLowerCase().trim()
    const cleanName = (k.nama_kk || '').toLowerCase().trim()
    const combinedText = `${k.alamat || ''} ${k.nama_kk || ''}`.toLowerCase()

    let status: 'AKTIF' | 'PINDAH' | 'KELUAR' = 'AKTIF'
    if (umatStatusOverrides[k.id]) {
      status = umatStatusOverrides[k.id]
    } else if (umatStatusOverrides[cleanName]) {
      status = umatStatusOverrides[cleanName]
    } else if (combinedText.includes('pindah')) {
      status = 'PINDAH'
    } else if (combinedText.includes('keluar')) {
      status = 'KELUAR'
    } else if (deletedKkSet.has(cleanId) || deletedKkSet.has(cleanName) || !activeDafuNameSet.has(cleanName)) {
      status = 'PINDAH'
    }

    const months = setoranMap.get(k.id) || {}
    const paidMonthsCount = Object.keys(months).length
    const isLunas = paidMonthsCount >= 12

    if (status !== 'AKTIF') {
      allPindahKeluarList.push({
        kk: k,
        status,
        paidMonthsCount,
        isLunas
      })
    }

    // Syarat tampil:
    // 1. Umat aktif selalu tampil.
    // 2. Umat yang dihapus dari DAFU / berstatus Pindah atau Keluar tetap tampil di Kartu Setoran dengan notif Pindah.
    const isSearchingThis = searchQuery.trim().length > 0 && k.nama_kk.toLowerCase().includes(searchQuery.toLowerCase().trim())
    if (status === 'AKTIF' || status === 'PINDAH' || status === 'KELUAR' || paidMonthsCount > 0 || showAllStatus || isSearchingThis) {
      displayedKkList.push({
        ...k,
        statusUmat: status,
        isLunas,
        paidMonthsCount
      })
    }
  })

  displayedKkList.sort((a, b) => a.nama_kk.localeCompare(b.nama_kk))

  const handleRestoreUmat = async (kkId: string, namaKk: string) => {
    if (!lingkunganId) return
    const cleanId = (kkId || '').trim()
    const cleanName = (namaKk || '').toLowerCase().trim()
    const dbUuid = getLingkunganDbUuid(lingkunganId)

    // 1. Hapus override status
    const updated = { ...umatStatusOverrides }
    delete updated[cleanId]
    delete updated[cleanName]
    delete updated[kkId]
    delete updated[namaKk]
    setUmatStatusOverrides(updated)

    try {
      localStorage.setItem(`kartu_setoran_umat_status_${lingkunganId}`, JSON.stringify(updated))
      if (dbUuid) {
        localStorage.setItem(`kartu_setoran_umat_status_${dbUuid}`, JSON.stringify(updated))
      }
    } catch (e) {}

    // 2. Hapus dari deletedKkSet jika sebelumnya terhapus
    const newDeleted = new Set(deletedKkSet)
    newDeleted.delete(cleanId)
    newDeleted.delete(cleanId.toLowerCase())
    newDeleted.delete(cleanName)
    setDeletedKkSet(newDeleted)

    try {
      const pruneList = (key: string) => {
        const raw = localStorage.getItem(key)
        if (raw) {
          const list: string[] = JSON.parse(raw)
          const filtered = list.filter(item => {
            const s = String(item).toLowerCase().trim()
            return s !== cleanId.toLowerCase() && s !== cleanName
          })
          localStorage.setItem(key, JSON.stringify(filtered))
        }
      }
      pruneList('custom_kks_deleted_store')
      pruneList(`custom_kks_deleted_${lingkunganId}`)
      if (dbUuid) pruneList(`custom_kks_deleted_${dbUuid}`)
    } catch (e) {}

    // 3. Bersihkan tag [PINDAH] / [KELUAR] di Supabase kepala_keluarga
    try {
      const targetKk = allDbKks.find(k => k.id === cleanId || (k.nama_kk || '').toLowerCase().trim() === cleanName)
      const cleanedAlamat = (targetKk?.alamat || '')
        .replace(/\[pindah\]/gi, '')
        .replace(/\[keluar\]/gi, '')
        .replace(/pindah\s*\/\s*keluar/gi, '')
        .trim()
      await supabase.from('kepala_keluarga').update({ alamat: cleanedAlamat }).eq('id', cleanId)
      if (dbUuid && namaKk) {
        await supabase.from('kepala_keluarga').update({ alamat: cleanedAlamat }).eq('lingkungan_id', dbUuid).ilike('nama_kk', namaKk.trim())
      }
    } catch (e) {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('dafuDataUpdated'))
    }
  }

  const handleRestoreAllUmat = () => {
    if (!lingkunganId) return
    const dbUuid = getLingkunganDbUuid(lingkunganId)
    setUmatStatusOverrides({})
    setDeletedKkSet(new Set())
    try {
      localStorage.removeItem(`kartu_setoran_umat_status_${lingkunganId}`)
      if (dbUuid) localStorage.removeItem(`kartu_setoran_umat_status_${dbUuid}`)
      localStorage.removeItem('custom_kks_deleted_store')
      localStorage.removeItem(`custom_kks_deleted_${lingkunganId}`)
      if (dbUuid) localStorage.removeItem(`custom_kks_deleted_${dbUuid}`)
    } catch (e) {}
  }

  const handleSetUmatStatus = (kkId: string, namaKk: string, newStatus: 'AKTIF' | 'PINDAH' | 'KELUAR') => {
    if (newStatus === 'AKTIF') {
      handleRestoreUmat(kkId, namaKk)
      return
    }
    if (!lingkunganId) return
    const dbUuid = getLingkunganDbUuid(lingkunganId)
    const updated = {
      ...umatStatusOverrides,
      [kkId]: newStatus,
      [namaKk.toLowerCase().trim()]: newStatus
    }
    setUmatStatusOverrides(updated)
    try {
      localStorage.setItem(`kartu_setoran_umat_status_${lingkunganId}`, JSON.stringify(updated))
      if (dbUuid) {
        localStorage.setItem(`kartu_setoran_umat_status_${dbUuid}`, JSON.stringify(updated))
      }
    } catch (e) {}
  }

  // Export to Excel / CSV
  const handleExportExcel = () => {
    const headers = ['No', 'Nama Kepala Keluarga', ...SHORT_MONTHS, 'Total Setoran (Rp)']
    const rows = displayedKkList.map((kk, idx) => {
      const months = setoranMap.get(kk.id) || {}
      let totalKk = 0
      const monthCols = Array.from({ length: 12 }, (_, i) => {
        const item = months[i + 1]
        const val = item ? item.nominal : 0
        totalKk += val
        return val
      })
      const statusNote = kk.statusUmat && kk.statusUmat !== 'AKTIF'
        ? ` [${kk.statusUmat === 'KELUAR' ? 'Keluar' : 'Pindah'}]`
        : ''
      return [idx + 1, `"${kk.nama_kk}${statusNote}"`, ...monthCols, totalKk]
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
  const filteredKkList = displayedKkList.filter(k =>
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
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 flex-1 min-w-0">
            {/* Filter Jenis Setoran */}
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs font-bold text-slate-700">Jenis Setoran / Akun COA</Label>
              <Select value={selectedCoa} onValueChange={(val) => setSelectedCoa(val || '4100')}>
                <SelectTrigger className="w-full max-w-full overflow-hidden bg-white border-slate-200/90 text-slate-900 font-semibold rounded-xl h-11 text-xs sm:text-sm px-3.5">
                  <span className="truncate">{selectedCoaObj.name}</span>
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
            <div className="space-y-1.5 min-w-0 sm:max-w-[200px]">
              <Label className="text-xs font-bold text-slate-700">Tahun Buku</Label>
              <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(parseInt(val || '2026', 10))}>
                <SelectTrigger className="w-full max-w-full overflow-hidden bg-white border-slate-200/90 text-slate-900 font-semibold rounded-xl h-11 text-xs sm:text-sm px-3.5">
                  <span className="truncate">Tahun {selectedYear}</span>
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

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleExportExcel}
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
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Jumlah KK yang Setor</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1.5 font-serif">{totalKkCount}</div>
        </div>

        {/* Card 2: Total Setoran Tahun Ini */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Total Setoran Tahun Ini</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1.5 font-serif">{formatRupiah(grandTotalSetoran)}</div>
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
              <h3 className="text-sm font-bold text-slate-900 font-serif">
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
            {/* Search Input for KK & Status Filter Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama Kepala Keluarga..."
                    className="pl-9 bg-slate-50 border-slate-200 text-xs rounded-xl h-9 text-slate-900"
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

                {allPindahKeluarList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsManageModalOpen(true)}
                    className="px-2.5 py-1.5 rounded-xl border border-[#DECFCF] bg-[#F6F2F2] hover:bg-[#EFE9E9] text-[#6B5353] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  >
                    <Users className="w-3.5 h-3.5 text-[#6B5353]" />
                    <span>Kelola / Pulihkan Umat ({allPindahKeluarList.length})</span>
                  </button>
                )}
              </div>

              <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <span>Data setoran terakumulasi otomatis dari modul Jurnal Transaksi</span>
              </div>
            </div>

            {/* Tabel 12 Bulan Kartu Setoran dengan Freeze Header Bulan (Sticky top & left) */}
            <div ref={kartuTableRef} className="border border-slate-200 rounded-xl overflow-auto max-h-[580px] shadow-xs bg-white scrollbar-thin">
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
                      className="sticky left-12 z-40 bg-slate-100 min-w-[200px] font-bold text-slate-800 p-2.5 border-b-2 border-r border-slate-300 shadow-xs"
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
                  {filteredKkList.map((kk, idx) => {
                    const months = setoranMap.get(kk.id) || {}
                    let totalKk = 0
                    const isPindahKeluar = Boolean(kk.statusUmat && kk.statusUmat !== 'AKTIF')

                    return (
                      <tr
                        key={kk.id}
                        className={`transition group ${
                          isPindahKeluar
                            ? 'bg-[#F6F2F2]/70 hover:bg-[#EFE9E9]/90'
                            : 'hover:bg-slate-50/90'
                        }`}
                      >
                        <td
                          className={`sticky left-0 z-10 text-center font-mono text-[11px] p-2 border-b border-r w-12 min-w-[48px] max-w-[48px] transition-colors ${
                            isPindahKeluar
                              ? 'bg-[#F6F2F2] group-hover:bg-[#EFE9E9] text-[#6B5353] border-b-[#E4DCDC] border-r-[#E4DCDC] border-l-[3px] border-l-[#9E7B7B]'
                              : 'bg-white group-hover:bg-slate-50 text-slate-500 border-slate-100'
                          }`}
                        >
                          {idx + 1}
                        </td>
                        <td
                          className={`sticky left-12 z-10 font-bold p-2 border-b border-r shadow-xs min-w-[220px] transition-colors ${
                            isPindahKeluar
                              ? 'bg-[#F6F2F2] group-hover:bg-[#EFE9E9] text-[#6B5353] border-b-[#E4DCDC] border-r-[#DECFCF]'
                              : 'bg-white group-hover:bg-slate-50 text-slate-900 border-b-slate-100 border-r-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{kk.nama_kk}</span>

                            {/* Dropdown status kecil untuk bendahara */}
                            <div className={`transition shrink-0 ${isPindahKeluar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                              <select
                                value={kk.statusUmat || 'AKTIF'}
                                onChange={(e) => handleSetUmatStatus(kk.id, kk.nama_kk, e.target.value as any)}
                                className={`text-[10px] rounded-md px-1.5 py-0.5 border cursor-pointer font-medium transition ${
                                  isPindahKeluar
                                    ? 'bg-[#EFE9E9] border-[#DECFCF] text-[#6B5353]'
                                    : 'bg-slate-50 border-slate-200 text-slate-600'
                                }`}
                                title="Ubah status umat: Aktif, Pindah, atau Keluar"
                              >
                                <option value="AKTIF">Aktif</option>
                                <option value="PINDAH">Pindah</option>
                                <option value="KELUAR">Keluar</option>
                              </select>
                            </div>
                          </div>
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
                                sumber === 'ORANG_LAIN' ? (
                                  <div className="relative inline-block group/donasi">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedDonasiNote({
                                        namaKk: kk.nama_kk,
                                        bulan: SHORT_MONTHS[mNum - 1],
                                        nominal: val,
                                        penalang: penalang || 'Umat Donatur (Anonim/N/N)'
                                      })}
                                      className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] select-none cursor-pointer bg-[#F6F4F0] text-[#6B5F4E] border border-[#E5DFD5] hover:bg-[#EFECE6] transition shadow-2xs"
                                    >
                                      <span>{val >= 1000 ? `${val / 1000}k` : val}</span>
                                      <span className="text-[10px] text-[#8C7B65] font-bold">★</span>
                                    </button>

                                    {/* Pop up kecil / hover card note info donatur */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/donasi:flex flex-col z-50 w-52 p-2.5 rounded-xl bg-slate-900 text-white shadow-xl text-left pointer-events-none animate-fadeIn border border-slate-700/80">
                                      <div className="flex items-center justify-between gap-1 mb-1 border-b border-slate-800 pb-1">
                                        <span className="text-[10px] font-bold text-[#D6C5A9] uppercase tracking-wider flex items-center gap-1">
                                          <span>★</span> Donasi Umat Lain
                                        </span>
                                        <span className="text-[9px] text-slate-400 font-mono">{SHORT_MONTHS[mNum - 1]}</span>
                                      </div>
                                      <div className="text-xs font-semibold text-slate-100 leading-tight">
                                        Ditalangi oleh: <span className="text-[#E5DFD5] font-bold">{penalang === 'N/N' ? 'N/N (Umat Anonim)' : (penalang || 'Donatur')}</span>
                                      </div>
                                      <div className="text-[10px] text-slate-400 mt-1 flex justify-between items-center">
                                        <span>Nominal:</span>
                                        <span className="font-mono text-white font-bold">{formatRupiah(val)}</span>
                                      </div>
                                      {/* Panah segitiga pop up */}
                                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                                    </div>
                                  </div>
                                ) : (
                                  <span
                                    title={
                                      sumber === 'PAROKI'
                                        ? `Ditalangi Paroki (${formatRupiah(val)})`
                                        : sumber === 'DANA_LINGKUNGAN'
                                        ? `Dari Kas Lingkungan (${formatRupiah(val)})`
                                        : `Bayar Sendiri (${formatRupiah(val)})`
                                    }
                                    className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] select-none ${
                                      sumber === 'PAROKI'
                                        ? 'bg-slate-100 text-slate-700 border border-slate-200/90'
                                        : sumber === 'DANA_LINGKUNGAN'
                                        ? 'bg-[#F4F3F7] text-[#5B546E] border border-[#E0DDE8]'
                                        : 'bg-[#F2F5F3] text-[#4E6358] border border-[#DCE5DF]'
                                    }`}
                                  >
                                    <span>{val >= 1000 ? `${val / 1000}k` : val}</span>
                                    {sumber === 'PAROKI' && <span className="text-[10px] text-slate-600 font-bold">✝</span>}
                                  </span>
                                )
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
                        <td className="text-right font-mono font-bold text-slate-900 pr-3 p-2 border-b border-slate-100">
                          {totalKk > 0 ? (
                            totalKk.toLocaleString('id-ID')
                          ) : totalKk < 0 ? (
                            <span className="text-[#6B5353]">-{Math.abs(totalKk).toLocaleString('id-ID')}</span>
                          ) : Object.keys(months).length > 0 ? (
                            <span className="text-slate-500">0</span>
                          ) : (
                            <span className="text-slate-300 font-normal">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}

                  {/* Baris Setoran Umum / Kolektif jika ada */}
                  {setoranMap.has('umum') && (
                    <tr className="bg-slate-50/70 hover:bg-slate-50 transition border-t border-slate-200 group">
                      <td className="sticky left-0 z-10 bg-slate-50 group-hover:bg-slate-100 text-center font-mono text-slate-400 text-[11px] p-2 border-b border-r border-slate-200 w-12 min-w-[48px] max-w-[48px]">-</td>
                      <td className="sticky left-12 z-10 bg-slate-50 group-hover:bg-slate-100 font-bold text-slate-700 italic p-2 border-b border-r border-slate-300 shadow-xs min-w-[200px]">
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
                              <span
                                title={
                                  sumber === 'ORANG_LAIN'
                                    ? (penalang === 'N/N' ? `Dari Donasi Umat: N/N (${formatRupiah(val)})` : `Dari Donasi Umat: ${penalang || 'Donatur'} (${formatRupiah(val)})`)
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
                              </span>
                            ) : (
                              <span className="text-slate-300 font-extralight select-none">—</span>
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

      {/* Modal Kelola / Pulihkan Umat Pindah / Keluar */}
      {isManageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-slate-200 text-slate-800">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Kelola Umat Pindah / Keluar</h3>
                  <p className="text-[11px] text-slate-500">
                    Daftar umat yang statusnya ditandai Pindah atau Keluar di lingkungan {lingkunganName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManageModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1">
              {allPindahKeluarList.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  Semua umat di lingkungan ini berstatus Aktif.
                </div>
              ) : (
                allPindahKeluarList.map((item) => (
                  <div
                    key={item.kk.id}
                    className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/70 transition flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-slate-900">{item.kk.nama_kk}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border bg-slate-100 text-slate-800 border-slate-300">
                          {item.status === 'KELUAR' ? 'Keluar' : 'Pindah'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {item.paidMonthsCount > 0
                          ? `Tercatat setoran ${item.paidMonthsCount} bulan (${item.isLunas ? 'Lunas 12 bulan' : 'Setoran di tengah tahun'})`
                          : 'Belum ada setoran tercatat di tahun ini'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRestoreUmat(item.kk.id, item.kk.nama_kk)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white transition flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Kembalikan ke Aktif</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              {allPindahKeluarList.length > 0 ? (
                <button
                  type="button"
                  onClick={() => handleRestoreAllUmat()}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                >
                  Kembalikan Semua ke Aktif
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={() => setIsManageModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Popup Catatan Donasi Umat Lain */}
      {selectedDonasiNote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fadeIn"
          onClick={() => setSelectedDonasiNote(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-2xl border border-slate-200 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold">★</span>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Catatan Donasi Umat Lain</h4>
                  <p className="text-[10px] text-slate-400">Rincian setoran yang ditalangi umat</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDonasiNote(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Nama Penerima:</span>
                <span className="font-bold text-slate-900">{selectedDonasiNote.namaKk}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Bulan Setoran:</span>
                <span className="font-semibold text-slate-800">{selectedDonasiNote.bulan} {selectedYear}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Nominal:</span>
                <span className="font-mono font-bold text-emerald-700">{formatRupiah(selectedDonasiNote.nominal)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                <span className="text-slate-600 font-semibold">Ditalangi oleh:</span>
                <span className="font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                  {selectedDonasiNote.penalang === 'N/N' ? 'N/N (Umat Anonim)' : selectedDonasiNote.penalang}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedDonasiNote(null)}
              className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
