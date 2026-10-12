'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { JurnalTransaksi, KepalaKeluarga } from '@/lib/types'
import { ensureDummyKksForLingkungan } from '@/lib/dummyData'
import { getAllMasterCOA, MasterCOAItem } from '@/lib/masterCoa'
import { formatNamaLingkungan, getAllMasterLingkungan, getWilayahForLingkungan, getLingkunganDbUuid } from '@/lib/constants'
import { getPengurusForLingkungan, PengurusLingkungan } from '@/lib/pengurusData'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Printer, RefreshCw, Check } from 'lucide-react'

function angkaKeTerbilang(nilai: number): string {
  if (nilai <= 0) return ''
  const satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas']
  function sebut(n: number): string {
    if (n < 12) return satuan[n]
    if (n < 20) return sebut(n - 10) + ' Belas'
    if (n < 100) return sebut(Math.floor(n / 10)) + ' Puluh ' + sebut(n % 10)
    if (n < 200) return 'Seratus ' + sebut(n - 100)
    if (n < 1000) return sebut(Math.floor(n / 100)) + ' Ratus ' + sebut(n % 100)
    if (n < 2000) return 'Seribu ' + sebut(n - 1000)
    if (n < 1000000) return sebut(Math.floor(n / 1000)) + ' Ribu ' + sebut(n % 1000)
    if (n < 1000000000) return sebut(Math.floor(n / 1000000)) + ' Juta ' + sebut(n % 1000000)
    return sebut(Math.floor(n / 1000000000)) + ' Milyar ' + sebut(n % 1000000000)
  }
  return (sebut(Math.floor(nilai)).trim() + ' Rupiah').replace(/\s+/g, ' ')
}

export interface FormConfigItem {
  id: string
  name: string
  formatType: 'MATRIKS' | 'AMPLOP'
  headerRightText?: string
  amplopLabel?: string
  coaCodes: string[]
  coaKeywords: string[]
}

// 7 Form Resmi Sesuai Permintaan User:
// 1. Santo Yusuf (Matriks 12 Bulan)
// 2. Dana Pastoran (Matriks 12 Bulan)
// 3. Dana APP (Rekapitulasi Amplop - Tanpa No. Amplop)
// 4. Dana HPS (Rekapitulasi Amplop - Tanpa No. Amplop)
// 5. Dana ASAK (Matriks 12 Bulan)
// 6. Dana PPG (Matriks 12 Bulan)
// 7. Dana CYTM (Matriks 12 Bulan)
const DAFTAR_FORM_TERSEDIA: FormConfigItem[] = [
  {
    id: 'santo-yusuf',
    name: 'Santo Yusuf',
    formatType: 'MATRIKS',
    headerRightText: 'DANA ST. YUSUF',
    coaCodes: ['4300', '1400', '5280'],
    coaKeywords: ['yusuf', 'kematian']
  },
  {
    id: 'pastoran',
    name: 'Dana Pastoran',
    formatType: 'MATRIKS',
    headerRightText: 'DANA PASTORAN',
    coaCodes: ['4120', '1300', '5270', '5300'],
    coaKeywords: ['pastoran', 'dahar romo']
  },
  {
    id: 'app',
    name: 'Dana APP',
    formatType: 'AMPLOP',
    amplopLabel: 'APP',
    coaCodes: ['4700', '5310'],
    coaKeywords: ['app', 'aksi puasa']
  },
  {
    id: 'hps',
    name: 'Dana HPS',
    formatType: 'AMPLOP',
    amplopLabel: 'HPS',
    coaCodes: [],
    coaKeywords: ['hps', 'pangan']
  },
  {
    id: 'asak',
    name: 'Dana ASAK',
    formatType: 'MATRIKS',
    headerRightText: 'DANA ASAK',
    coaCodes: ['4200', '5290'],
    coaKeywords: ['asak', 'sekolah']
  },
  {
    id: 'ppg',
    name: 'Dana PPG',
    formatType: 'MATRIKS',
    headerRightText: 'DANA PPG',
    coaCodes: ['5340'],
    coaKeywords: ['ppg', 'pembangunan gereja']
  },
  {
    id: 'cytm',
    name: 'Dana CYTM',
    formatType: 'MATRIKS',
    headerRightText: 'DANA CYTM',
    coaCodes: [],
    coaKeywords: ['cytm', 'youth']
  }
]

export default function FormSetoranPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [lingkunganId, setLingkunganId] = useState<string | null>(null)
  const [lingkunganName, setLingkunganName] = useState('')
  const [pengurus, setPengurus] = useState<PengurusLingkungan | null>(null)

  const [kkList, setKkList] = useState<KepalaKeluarga[]>([])
  const [jurnalList, setJurnalList] = useState<JurnalTransaksi[]>([])

  const [selectedFormId, setSelectedFormId] = useState<string>('santo-yusuf')
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        let savedLId = typeof window !== 'undefined' ? localStorage.getItem('selected_lingkungan_id') : null
        const cookies = typeof document !== 'undefined' ? document.cookie : ''
        const getCookieVal = (name: string) => {
          const v = `; ${cookies}`
          const p = v.split(`; ${name}=`)
          if (p.length === 2) return decodeURIComponent(p.pop()!.split(';').shift()!)
          return null
        }

        let effId = savedLId || getCookieVal('demo_user_lingkungan_id') || 'lingkungan-1'
        let effNama = getCookieVal('demo_user_lingkungan_nama') || 'St. Maria'

        const master = getAllMasterLingkungan()
        const matched = master.find((m) => m.id === effId)
        if (matched) {
          effNama = matched.nama_lingkungan
        }

        setLingkunganId(effId)
        setLingkunganName(effNama)

        const dbUuid = getLingkunganDbUuid(effId)
        const dbLingkId = dbUuid || effId

        if (dbLingkId) {
          const { data: profil } = await supabase
            .from('profil_lingkungan')
            .select('*')
            .or(`id.eq.${dbUuid},id.eq.${effId}`)
          const peng = getPengurusForLingkungan(dbLingkId, effNama, profil?.[0] || {})
          setPengurus(peng)
        }

        // Load KK dari Supabase dan LocalStorage
        const { data: kkData } = await supabase
          .from('kepala_keluarga')
          .select('*')
          .or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${effId}`)
          .order('nama_kk', { ascending: true })

        let finalKks = kkData || []
        if (typeof window !== 'undefined') {
          const localSaved = localStorage.getItem(`custom_kks_${effId}`) || (dbUuid ? localStorage.getItem(`custom_kks_${dbUuid}`) : null)
          if (localSaved) {
            try {
              const parsed: KepalaKeluarga[] = JSON.parse(localSaved)
              const map = new Map<string, KepalaKeluarga>()
              finalKks.forEach(k => map.set(k.id, k))
              parsed.forEach(k => map.set(k.id, k))
              finalKks = Array.from(map.values())
            } catch (e) {}
          }

          const allSaved = localStorage.getItem('custom_kks_all_store')
          if (allSaved) {
            try {
              const allParsed: KepalaKeluarga[] = JSON.parse(allSaved)
              const matchedAll = allParsed.filter(k => k.lingkungan_id === effId || (dbUuid && k.lingkungan_id === dbUuid))
              const map = new Map<string, KepalaKeluarga>()
              finalKks.forEach(k => map.set(k.id, k))
              matchedAll.forEach(k => map.set(k.id, k))
              finalKks = Array.from(map.values())
            } catch (e) {}
          }
        }

        const resolvedKks = ensureDummyKksForLingkungan(effId, effNama, finalKks)
        setKkList(resolvedKks)

        // Load Jurnal Transaksi (Cloud Supabase + LocalStorage offline sync)
        let list: JurnalTransaksi[] = []
        try {
          const { data: jData } = await supabase
            .from('jurnal_transaksi')
            .select('*, kepala_keluarga:kk_id(nama_kk)')
            .or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${effId}`)
            .order('tanggal', { ascending: true })

          if (jData && jData.length > 0) {
            list = jData
          }
        } catch (e) {}

        if (typeof window !== 'undefined') {
          const keys = [`custom_journals_${dbUuid}`, `custom_journals_${effId}`, `custom_journals_csv-${effId}`]
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
                localList.push(...parsedAll.filter((j: any) => j.lingkungan_id === dbUuid || j.lingkungan_id === effId))
              }
            } catch (e) {}
          }

          const map = new Map<string, JurnalTransaksi>()
          list.forEach(j => map.set(j.id, j))
          localList.forEach(j => {
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

          // Sinkronkan nama KK dari tx_kk cache, no_bukti, atau keterangan
          list.forEach(j => {
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
                  const found = resolvedKks.find(k => k.nama_kk.toLowerCase().trim() === nameFromKet.toLowerCase())
                  if (found) {
                    j.kepala_keluarga = found as any
                    j.kk_id = found.id
                  } else {
                    j.kepala_keluarga = { id: `kk-${nameFromKet}`, nama_kk: nameFromKet, lingkungan_id: j.lingkungan_id } as any
                  }
                }
              } else if (j.kk_id) {
                const found = resolvedKks.find(k => k.id === j.kk_id)
                if (found) j.kepala_keluarga = { id: found.id, nama_kk: found.nama_kk, lingkungan_id: j.lingkungan_id } as any
              }
            }
          })
        }

        setJurnalList(list)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }

    loadData()

    const handleSync = () => {
      loadData()
    }
    window.addEventListener('customJournalsUpdated', handleSync)
    window.addEventListener('storage', handleSync)
    window.addEventListener('lingkunganChanged', handleSync)

    return () => {
      window.removeEventListener('customJournalsUpdated', handleSync)
      window.removeEventListener('storage', handleSync)
      window.removeEventListener('lingkunganChanged', handleSync)
    }
  }, [supabase])

  const handlePrint = () => {
    window.print()
  }

  const selectedForm = DAFTAR_FORM_TERSEDIA.find(f => f.id === selectedFormId) || DAFTAR_FORM_TERSEDIA[0]
  const isAmplopFormat = selectedForm.formatType === 'AMPLOP'

  // Prepare table data matching the selected fund
  const matrixData = kkList.map((kk, idx) => {
    let yearlyTotal = 0
    const monthlyStatus: Record<number, boolean> = {}
    const rowKkNama = kk.nama_kk.trim().toLowerCase()

    // Find transactions for this KK in the selected year and matched COA
    const txs = jurnalList.filter(j => {
      if (!j.tanggal || !j.tanggal.startsWith(selectedYear)) return false
      
      // Match by exact COA codes or keywords
      const matchCode = selectedForm.coaCodes.some(c => c === j.coa_debit || c === j.coa_kredit)
      const desc = (j.keterangan || '').toLowerCase()
      const matchKeyword = selectedForm.coaKeywords.some(kw => desc.includes(kw))
      if (!matchCode && !matchKeyword) return false

      // Match KK identity (ID, Nama di kepala_keluarga, tx_kk cache, atau keterangan)
      if (j.kk_id && (j.kk_id === kk.id || j.kk_id.toLowerCase() === kk.id.toLowerCase())) return true
      if (j.kepala_keluarga?.id && (j.kepala_keluarga.id === kk.id || j.kepala_keluarga.id.toLowerCase() === kk.id.toLowerCase())) return true

      const txKkNama = (j.kepala_keluarga?.nama_kk || '').trim().toLowerCase()
      if (txKkNama && (txKkNama === rowKkNama || txKkNama.includes(rowKkNama) || rowKkNama.includes(txKkNama))) {
        return true
      }

      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(`tx_kk_${j.id}`)
        if (cached) {
          try {
            const parsed = JSON.parse(cached)
            if (parsed.id === kk.id) return true
            const parsedNama = (parsed.nama_kk || '').trim().toLowerCase()
            if (parsedNama && (parsedNama === rowKkNama || parsedNama.includes(rowKkNama) || rowKkNama.includes(parsedNama))) {
              return true
            }
          } catch (e) {}
        }
      }

      if (rowKkNama && desc.includes(rowKkNama)) {
        return true
      }

      return false
    })

    txs.forEach(tx => {
      const parts = tx.tanggal.split('-')
      const month = parts.length > 1 ? parseInt(parts[1], 10) : NaN
      if (!isNaN(month) && month >= 1 && month <= 12) {
        monthlyStatus[month] = true
      }
      yearlyTotal += Number(tx.nominal)
    })

    return {
      kk,
      envelopeNo: kk.no_kk || String(idx + 1).padStart(3, '0'),
      monthlyStatus,
      yearlyTotal
    }
  })

  // Calculate total across all KKs
  const grandTotal = matrixData.reduce((sum, row) => sum + row.yearlyTotal, 0)

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 relative min-h-screen pb-20 font-sans">
      
      {/* CONTROL PANEL (Hidden during print) */}
      <div className="print:hidden space-y-6 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Formulir Cetak PDF Bendahara</h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">Kop surat resmi Paroki Santa Clara untuk 7 formulir: Santo Yusuf, Dana Pastoran, Dana APP, Dana HPS, Dana ASAK, Dana PPG, dan Dana CYTM.</p>
        </div>

        {/* SELEKSI 7 DANA RESMI */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-5">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2.5">Pilih Formulir Dana (Otomatis Format Sesuai Jenis Dana)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {DAFTAR_FORM_TERSEDIA.map(f => {
                const isSelected = selectedFormId === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFormId(f.id)}
                    className={`py-3 px-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-1.5 ${
                      isSelected
                        ? 'bg-white border-slate-400 text-slate-900 shadow-xs ring-2 ring-slate-300/80 font-bold'
                        : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300 hover:text-slate-900 font-medium'
                    }`}
                  >
                    <span className="text-xs truncate">{f.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-slate-800 shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <label className="text-xs font-bold text-slate-700 shrink-0">Tahun:</label>
              <Select value={selectedYear} onValueChange={(val) => { if (val) setSelectedYear(val) }}>
                <SelectTrigger className="bg-white border-slate-300 text-slate-900 rounded-xl h-10 w-32 text-xs font-bold">
                  <SelectValue placeholder="Pilih Tahun" />
                </SelectTrigger>
                <SelectContent>
                  {['2024', '2025', '2026', '2027', '2028'].map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handlePrint}
              disabled={loading}
              className="w-full sm:w-auto h-10 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              {loading ? 'Memuat Data...' : 'Cetak / Simpan PDF'}
            </Button>
          </div>
        </div>
      </div>

      {/* DOCUMENT PREVIEW (Styled for Print - Exactly Matches Authentic Documents) */}
      {!loading && (
        <div className="bg-white border border-slate-300 shadow-xl mx-auto rounded-none print:shadow-none print:border-none" style={{ maxWidth: '210mm', minHeight: '297mm' }}>
          <div className="p-8 sm:p-12 print:p-0 print:m-0 font-serif text-black">
            
            {/* ========================================================================= */}
            {/* FORMAT 1: REKAPITULASI DANA APP & DANA HPS (LANGSUNG NAMA, JUMLAH, KET)   */}
            {/* ========================================================================= */}
            {isAmplopFormat ? (
              <>
                {/* KOP SURAT RESMI PAROKI SANTA CLARA */}
                <div className="flex justify-between items-start mb-4">
                  {/* Logo Paroki Santa Clara di sebelah kiri */}
                  <div className="w-20 shrink-0 flex items-center justify-start">
                    <img
                      src="/logo-kop-paroki.png"
                      alt="Logo Paroki St. Clara"
                      className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
                      onError={(e) => {
                        ;(e.currentTarget as HTMLImageElement).src = '/logo-st-clara.jpg'
                      }}
                    />
                  </div>
                  
                  {/* Judul Tengah */}
                  <div className="flex-1 text-left pl-4">
                    <h2 className="text-base sm:text-xl font-bold uppercase tracking-wider underline underline-offset-4 mb-1">
                      REKAPITULASI AMPLOP {selectedForm.amplopLabel ? `${selectedForm.amplopLabel} ` : ''}.................................................... Thn {selectedYear || '........'}
                    </h2>
                    <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                      PAROKI ST. CLARA - BEKASI UTARA
                    </h3>
                  </div>
                </div>

                {/* INFO HEADER: LINGKUNGAN & WILAYAH */}
                <div className="flex justify-between items-end mb-3 text-xs sm:text-sm font-bold uppercase">
                  <div className="flex gap-2 w-1/2 items-end">
                    <span>LINGKUNGAN :</span>
                    <span className="border-b border-black flex-1 border-dashed inline-block h-5 leading-5 pl-1">
                      {formatNamaLingkungan(lingkunganName)}
                    </span>
                  </div>
                  <div className="flex gap-2 w-1/3 items-end justify-end">
                    <span>WILAYAH :</span>
                    <span className="w-32 border-b border-black border-dashed inline-block h-5 leading-5 text-center">
                      {getWilayahForLingkungan(lingkunganName)}
                    </span>
                  </div>
                </div>

                {/* TABLE REKAPITULASI DANA APP / HPS (TANPA NO. AMPLOP) */}
                <div className="overflow-x-auto w-full">
                  <table className="w-full border-collapse border-2 border-black text-[10px] sm:text-xs">
                    <thead>
                      <tr className="border border-black">
                        <th className="border border-black p-1.5 w-12 font-bold text-center">No.</th>
                        <th className="border border-black p-1.5 font-bold text-left px-3">NAMA</th>
                        <th className="border border-black p-1.5 w-44 sm:w-52 font-bold text-center">JUMLAH (Rp)</th>
                        <th className="border border-black p-1.5 w-48 sm:w-56 font-bold text-center">KETERANGAN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrixData.map((row, idx) => (
                        <tr key={row.kk.id} className="border border-black h-7">
                          <td className="border border-black p-1 text-center font-medium">{idx + 1}</td>
                          <td className="border border-black p-1 px-3 font-medium">{row.kk.nama_kk}</td>
                          <td className="border border-black p-1 text-right font-medium pr-3">
                            {row.yearlyTotal > 0 ? row.yearlyTotal.toLocaleString('id-ID') : ''}
                          </td>
                          <td className="border border-black p-1 text-center font-medium italic text-[10px]">
                            {row.yearlyTotal > 0 ? 'Diterima' : ''}
                          </td>
                        </tr>
                      ))}
                      
                      {/* Empty rows padding up to 32 rows */}
                      {Array.from({ length: Math.max(0, 32 - matrixData.length) }).map((_, idx) => (
                        <tr key={`empty-amplop-${idx}`} className="border border-black h-7">
                          <td className="border border-black p-1 text-center">{matrixData.length + idx + 1}</td>
                          <td className="border border-black p-1"></td>
                          <td className="border border-black p-1"></td>
                          <td className="border border-black p-1"></td>
                        </tr>
                      ))}
                      
                      {/* TOTAL ROW */}
                      <tr className="border-t-2 border-black font-bold">
                        <td colSpan={2} className="border border-black p-1.5 text-center">JUMLAH</td>
                        <td className="border-2 border-black p-1.5 text-right pr-3">
                          {grandTotal > 0 ? grandTotal.toLocaleString('id-ID') : ''}
                        </td>
                        <td className="border border-black p-1.5"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              /* ========================================================================= */
              /* FORMAT 2: TANDA TERIMA SETORAN (SANTO YUSUF, PASTORAN, ASAK, PPG, CYTM)   */
              /* ========================================================================= */
              <>
                {/* KOP SURAT RESMI PAROKI SANTA CLARA */}
                <div className="flex justify-between items-start mb-4">
                  {/* Logo Paroki Santa Clara di sebelah kiri */}
                  <div className="w-20 shrink-0 flex items-center justify-start">
                    <img
                      src="/logo-kop-paroki.png"
                      alt="Logo Paroki St. Clara"
                      className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
                      onError={(e) => {
                        ;(e.currentTarget as HTMLImageElement).src = '/logo-st-clara.jpg'
                      }}
                    />
                  </div>
                  
                  {/* Judul Tengah */}
                  <div className="flex-1 text-center pl-2">
                    <h2 className="text-base sm:text-xl font-bold uppercase tracking-[0.25em] underline underline-offset-4 mb-1">
                      TANDA TERIMA SETORAN
                    </h2>
                    <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                      PAROKI ST. CLARA - BEKASI UTARA
                    </h3>
                  </div>
                  
                  {/* Judul Kanan (DANA ST. YUSUF, DANA PASTORAN, DLL) */}
                  <div className="w-48 text-right flex flex-col justify-start pt-1">
                    <h1 className="text-lg sm:text-2xl font-black font-sans uppercase tracking-tight leading-none break-words">
                      {selectedForm.headerRightText || 'DANA UMAT'}
                    </h1>
                  </div>
                </div>

                {/* INFO HEADER */}
                <div className="flex flex-col sm:flex-row justify-between items-end mb-3 text-xs sm:text-sm font-bold uppercase gap-2 sm:gap-0">
                  <div className="flex gap-2 w-full sm:w-1/2 items-end">
                    <span>LINGKUNGAN :</span>
                    <span className="border-b border-black flex-1 border-dashed inline-block h-5 leading-5 pl-1">
                      {formatNamaLingkungan(lingkunganName)}
                    </span>
                  </div>
                  <div className="flex items-end">
                    <div className="flex gap-2 items-end">
                      <span>TAHUN :</span>
                      <span className="w-16 sm:w-24 border-b border-black border-dashed inline-block h-5 text-center leading-5">
                        {selectedYear}
                      </span>
                    </div>
                  </div>
                </div>

                {/* TABLE MATRIKS 12 BULAN */}
                <div className="overflow-x-auto w-full">
                  <table className="w-full border-collapse border-2 border-black text-[10px] sm:text-xs">
                    <thead>
                      <tr className="border border-black">
                        <th rowSpan={2} className="border border-black p-1 w-8 font-bold text-center">No.</th>
                        <th rowSpan={2} className="border border-black p-1 font-bold text-left px-2">NAMA KELUARGA</th>
                        <th colSpan={12} className="border border-black p-1 font-bold text-center">BULAN</th>
                        <th rowSpan={2} className="border border-black p-1 w-20 sm:w-24 font-bold text-center">JUMLAH<br/><span className="font-normal">(Rp)</span></th>
                        <th rowSpan={2} className="border border-black p-1 w-24 sm:w-32 font-bold text-center">KETERANGAN</th>
                      </tr>
                      <tr className="border border-black">
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                          <th key={m} className="border border-black p-0.5 sm:p-1 w-5 sm:w-6 font-bold text-center">{m}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrixData.map((row, idx) => (
                        <tr key={row.kk.id} className="border border-black">
                          <td className="border border-black p-1 text-center font-medium">{idx + 1}</td>
                          <td className="border border-black p-1 px-2 font-medium">{row.kk.nama_kk}</td>
                          {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                            <td key={m} className="border border-black p-1 text-center font-bold text-emerald-800 print:text-black">
                              {row.monthlyStatus[m] ? '✓' : ''}
                            </td>
                          ))}
                          <td className="border border-black p-1 text-right font-medium pr-2">
                            {row.yearlyTotal > 0 ? row.yearlyTotal.toLocaleString('id-ID') : ''}
                          </td>
                          <td className="border border-black p-1 text-center font-medium italic text-[10px]">
                            {row.yearlyTotal > 0 ? 'Sudah Bayar' : ''}
                          </td>
                        </tr>
                      ))}
                      
                      {/* Empty rows padding up to 32 rows */}
                      {Array.from({ length: Math.max(0, 32 - matrixData.length) }).map((_, idx) => (
                        <tr key={`empty-${idx}`} className="border border-black h-6">
                          <td className="border border-black p-1 text-center">{matrixData.length + idx + 1}</td>
                          <td className="border border-black p-1"></td>
                          {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                            <td key={`e-${m}`} className="border border-black p-1"></td>
                          ))}
                          <td className="border border-black p-1"></td>
                          <td className="border border-black p-1"></td>
                        </tr>
                      ))}
                      
                      {/* TOTAL ROW */}
                      <tr className="border-t-2 border-black font-bold">
                        <td colSpan={14} className="border border-black p-1.5 text-center">JUMLAH</td>
                        <td className="border-2 border-black p-1.5 text-right pr-2">
                          {grandTotal > 0 ? grandTotal.toLocaleString('id-ID') : ''}
                        </td>
                        <td className="border border-black p-1.5"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* FOOTER SIGNATURES & TERBILANG */}
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-6 text-xs sm:text-sm font-bold">
                <span>TERBILANG :</span>
                <div className="flex-1 border-2 border-black h-8 px-3 flex items-center text-xs font-semibold uppercase bg-slate-50 print:bg-transparent tracking-wide">
                  {grandTotal > 0 ? angkaKeTerbilang(grandTotal) : ''}
                </div>
              </div>

              <div className="flex justify-between items-start text-xs sm:text-sm font-bold text-center px-4">
                <div className="flex flex-col items-center w-40">
                  <div className="mb-14">Diterima Oleh :</div>
                  <div className="border-b border-black border-dashed w-full"></div>
                  <div className="mt-1 font-normal">Sekretariat Paroki</div>
                </div>
                
                <div className="flex flex-col items-center w-40">
                  <div className="mb-14">Disetujui oleh:</div>
                  <div className="border-b border-black border-dashed w-full relative">
                     <span className="absolute -top-5 w-full text-center font-normal text-xs capitalize truncate">
                       {pengurus?.ketua_nama && pengurus.ketua_nama !== 'Susunan pengurus belum ditentukan' ? `(${pengurus.ketua_nama})` : ''}
                     </span>
                  </div>
                  <div className="mt-1 font-normal">Ketua Lingkungan</div>
                </div>

                <div className="flex flex-col items-center w-40">
                  <div className="mb-14">Disetor Oleh :</div>
                  <div className="border-b border-black border-dashed w-full relative">
                     <span className="absolute -top-5 w-full text-center font-normal text-xs capitalize truncate">
                       {pengurus?.bendahara_nama && pengurus.bendahara_nama !== 'Susunan pengurus belum ditentukan' ? `(${pengurus.bendahara_nama})` : ''}
                     </span>
                  </div>
                  <div className="mt-1 font-normal">Bendahara Lingkungan</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
      
      {/* GLOBAL STYLES FOR PRINTING */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          nav, aside, header, footer {
            display: none !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:m-0 {
            margin: 0 !important;
          }
          .print\\:p-0 {
            padding: 0 !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:border-none {
            border: none !important;
          }
          .print\\:bg-transparent {
            background-color: transparent !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}} />
    </div>
  )
}

