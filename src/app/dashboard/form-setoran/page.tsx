'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { JurnalTransaksi, KepalaKeluarga } from '@/lib/types'
import { ensureDummyKksForLingkungan } from '@/lib/dummyData'
import { getAllMasterCOA, MasterCOAItem } from '@/lib/masterCoa'
import { formatNamaLingkungan, getAllMasterLingkungan, getWilayahForLingkungan, getLingkunganDbUuid, findLingkunganByQuery, getNamaLingkunganFromAnyIdentifier } from '@/lib/constants'
import { reconcileJournals } from '@/lib/journalSync'
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
    coaCodes: ['5300', '4120'],
    coaKeywords: ['pastoran']
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

        const demoEmail = getCookieVal('demo_user_email') || getCookieVal('demo_user_username') || ''
        const demoRole = getCookieVal('demo_user_role') || ''
        const isGlobalScope = demoRole === 'PAROKI' || demoRole === 'SEKRETARIS_PAROKI'

        let effId = ''
        let effNama = ''

        if (!isGlobalScope && demoEmail) {
          const matched = findLingkunganByQuery(demoEmail)
          if (matched) {
            effId = matched.id
            effNama = matched.nama_lingkungan
          }
        }

        if (!effId) {
          effId = getCookieVal('demo_user_lingkungan_id') || savedLId || ''
          effNama = getCookieVal('demo_user_lingkungan_nama') || ''
        }

        if (!effId || effId === 'all') {
          const allM = getAllMasterLingkungan()
          effId = allM[0].id
          effNama = allM[0].nama_lingkungan
        } else {
          effNama = getNamaLingkunganFromAnyIdentifier(effId) || effNama
        }

        setLingkunganId(effId)
        setLingkunganName(effNama)

        const dbUuid = getLingkunganDbUuid(effId)
        const dbLingkId = dbUuid || effId

        if (dbLingkId) {
          const { data: profil } = await supabase
            .from('profil_lingkungan')
            .select('*')
            .or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${effId}`)
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
              finalKks.forEach((k: any) => map.set(k.id, k))
              parsed.forEach((k: any) => map.set(k.id, k))
              finalKks = Array.from(map.values())
            } catch (e) {}
          }

          const allSaved = localStorage.getItem('custom_kks_all_store')
          if (allSaved) {
            try {
              const allParsed: KepalaKeluarga[] = JSON.parse(allSaved)
              const matchedAll = allParsed.filter((k: any) => k.lingkungan_id === effId || (dbUuid && k.lingkungan_id === dbUuid))
              const map = new Map<string, KepalaKeluarga>()
              finalKks.forEach((k: any) => map.set(k.id, k))
              matchedAll.forEach((k: any) => map.set(k.id, k))
              finalKks = Array.from(map.values())
            } catch (e) {}
          }
        }

        const resolvedKks = ensureDummyKksForLingkungan(effId, effNama, finalKks)
        setKkList(resolvedKks)

        // Load Jurnal Transaksi (Cloud Supabase + LocalStorage offline sync)
        let list: JurnalTransaksi[] = []
        let supabaseSuccess = false
        try {
          const { data: jData, error } = await supabase
            .from('jurnal_transaksi')
            .select('*, kepala_keluarga:kk_id(nama_kk)')
            .or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${effId}`)
            .order('tanggal', { ascending: true })

          if (!error && Array.isArray(jData)) {
            supabaseSuccess = true
            list = jData
          }
        } catch (e) {}

        list = reconcileJournals(list, dbUuid, effId, supabaseSuccess)

        // Sinkronkan nama KK dari tx_kk cache, no_bukti, atau keterangan
        if (typeof window !== 'undefined') {
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
      
      // Logika Form Setoran Paroki: Tercatat 'Sudah Bayar' ketika ada UANG KELUAR
      // yaitu uang kas yang sudah disetorkan oleh Bendahara Lingkungan ke Paroki
      const isUangKeluar = j.tipe_arus === 'KELUAR' || 
        j.no_bukti?.startsWith('BBK') || 
        j.no_bukti?.startsWith('BKK') || 
        (j.coa_debit && j.coa_debit.startsWith('5'))

      // Jika transaksi eksplisit Uang Masuk (iuran umat di lingkungan), abaikan dari form setoran ke paroki
      if (j.tipe_arus === 'MASUK' && !j.no_bukti?.startsWith('BBK') && !j.no_bukti?.startsWith('BKK')) {
        return false
      }

      if (!isUangKeluar) return false

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
          <p className="text-slate-500 mt-1 text-sm font-medium">Kop surat resmi Paroki Santa Clara untuk tanda terima setoran dari bendahara lingkungan ke paroki (terintegrasi otomatis dari pencatatan Uang Keluar yang disetor ke Paroki pada Jurnal Transaksi).</p>
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
        <div className="print-sheet bg-white border border-slate-300 shadow-xl mx-auto rounded-none print:shadow-none print:border-none print:m-0 print:p-0" style={{ maxWidth: '210mm', minHeight: '297mm' }}>
          <div className="print-sheet-inner p-8 sm:p-12 print:p-0 print:m-0 font-serif text-black">
            
            {/* ========================================================================= */}
            {/* FORMAT 1: REKAPITULASI DANA APP & DANA HPS (LANGSUNG NAMA, JUMLAH, KET)   */}
            {/* ========================================================================= */}
            {isAmplopFormat ? (
              <>
                {/* KOP SURAT RESMI PAROKI SANTA CLARA */}
                <div className="flex justify-between items-start mb-4 print-kop">
                  {/* Logo Paroki Santa Clara di sebelah kiri */}
                  <div className="w-20 shrink-0 flex items-center justify-start">
                    <img
                      src="/logo-kop-paroki.png"
                      alt="Logo Paroki St. Clara"
                      className="w-16 h-16 sm:w-20 sm:h-20 print-kop-logo object-contain"
                      onError={(e) => {
                        ;(e.currentTarget as HTMLImageElement).src = '/logo-st-clara.jpg'
                      }}
                    />
                  </div>
                  
                  {/* Judul Tengah */}
                  <div className="flex-1 text-left pl-4">
                    <h2 className="text-base sm:text-xl print-kop-title font-bold uppercase tracking-wider underline underline-offset-4 mb-1">
                      REKAPITULASI AMPLOP {selectedForm.amplopLabel ? `${selectedForm.amplopLabel} ` : ''}.................................................... Thn {selectedYear || '........'}
                    </h2>
                    <h3 className="text-xs sm:text-sm print-kop-sub font-bold uppercase tracking-wider">
                      PAROKI ST. CLARA - BEKASI UTARA
                    </h3>
                  </div>
                </div>

                {/* INFO HEADER: LINGKUNGAN & WILAYAH */}
                <div className="flex justify-between items-end mb-3 print-info-row text-xs sm:text-sm font-bold uppercase">
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
                  <table className="print-table w-full border-collapse border-2 border-black text-[10px] sm:text-xs">
                    <colgroup>
                      <col style={{ width: '5%' }} />
                      <col style={{ width: '45%' }} />
                      <col style={{ width: '25%' }} />
                      <col style={{ width: '25%' }} />
                    </colgroup>
                    <thead>
                      <tr className="border border-black">
                        <th className="border border-black p-1.5 font-bold text-center">No.</th>
                        <th className="border border-black p-1.5 font-bold text-left px-3 col-nama whitespace-nowrap">NAMA</th>
                        <th className="border border-black p-1.5 font-bold text-center whitespace-nowrap">JUMLAH (Rp)</th>
                        <th className="border border-black p-1.5 font-bold text-center whitespace-nowrap">KETERANGAN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrixData.map((row, idx) => (
                        <tr key={row.kk.id} className="border border-black h-7">
                          <td className="border border-black p-1 text-center font-medium">{idx + 1}</td>
                          <td className="border border-black p-1 px-3 font-medium col-nama whitespace-nowrap text-left">{row.kk.nama_kk}</td>
                          <td className="border border-black p-1 text-right font-medium pr-3 whitespace-nowrap">
                            {row.yearlyTotal > 0 ? row.yearlyTotal.toLocaleString('id-ID') : ''}
                          </td>
                          <td className="border border-black p-1 text-center font-medium italic text-[10px] whitespace-nowrap">
                            {row.yearlyTotal > 0 ? 'Diterima' : ''}
                          </td>
                        </tr>
                      ))}
                      
                      {/* Empty rows padding up to 32 rows */}
                      {Array.from({ length: Math.max(0, (matrixData.length > 32 ? 0 : 32) - matrixData.length) }).map((_, idx) => (
                        <tr key={`empty-amplop-${idx}`} className="border border-black h-7">
                          <td className="border border-black p-1 text-center">{matrixData.length + idx + 1}</td>
                          <td className="border border-black p-1 col-nama"></td>
                          <td className="border border-black p-1"></td>
                          <td className="border border-black p-1"></td>
                        </tr>
                      ))}
                      
                      {/* TOTAL ROW */}
                      <tr className="border-t-2 border-black font-bold">
                        <td colSpan={2} className="border border-black p-1.5 text-center">JUMLAH</td>
                        <td className="border-2 border-black p-1.5 text-right pr-3 whitespace-nowrap">
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
                <div className="flex justify-between items-start mb-4 print-kop">
                  {/* Logo Paroki Santa Clara di sebelah kiri */}
                  <div className="w-20 shrink-0 flex items-center justify-start">
                    <img
                      src="/logo-kop-paroki.png"
                      alt="Logo Paroki St. Clara"
                      className="w-16 h-16 sm:w-20 sm:h-20 print-kop-logo object-contain"
                      onError={(e) => {
                        ;(e.currentTarget as HTMLImageElement).src = '/logo-st-clara.jpg'
                      }}
                    />
                  </div>
                  
                  {/* Judul Tengah */}
                  <div className="flex-1 text-center pl-2">
                    <h2 className="text-base sm:text-xl print-kop-title font-bold uppercase tracking-[0.25em] underline underline-offset-4 mb-1">
                      TANDA TERIMA SETORAN
                    </h2>
                    <h3 className="text-xs sm:text-sm print-kop-sub font-bold uppercase tracking-wider">
                      PAROKI ST. CLARA - BEKASI UTARA
                    </h3>
                  </div>
                  
                  {/* Judul Kanan (DANA ST. YUSUF, DANA PASTORAN, DLL) */}
                  <div className="w-48 text-right flex flex-col justify-start pt-1">
                    <h1 className="text-lg sm:text-2xl print-kop-header-right font-black font-sans uppercase tracking-tight leading-none break-words">
                      {selectedForm.headerRightText || 'DANA UMAT'}
                    </h1>
                  </div>
                </div>

                {/* INFO HEADER */}
                <div className="flex flex-col sm:flex-row justify-between items-end mb-3 print-info-row text-xs sm:text-sm font-bold uppercase gap-2 sm:gap-0">
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
                  <table className="print-table w-full border-collapse border-2 border-black text-[10px] sm:text-xs">
                    <colgroup>
                      <col style={{ width: '4%' }} />
                      <col style={{ width: '30%' }} />
                      {Array.from({ length: 12 }).map((_, i) => (
                        <col key={i} style={{ width: '3%' }} />
                      ))}
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '15%' }} />
                    </colgroup>
                    <thead>
                      <tr className="border border-black">
                        <th rowSpan={2} className="border border-black p-1 text-center font-bold">No.</th>
                        <th rowSpan={2} className="border border-black p-1 px-3 text-left font-bold col-nama whitespace-nowrap">NAMA KELUARGA</th>
                        <th colSpan={12} className="border border-black p-1 font-bold text-center">BULAN</th>
                        <th rowSpan={2} className="border border-black p-1 text-center font-bold whitespace-nowrap">JUMLAH<br/><span className="font-normal text-[9px] print:text-[6.5pt]">(Rp)</span></th>
                        <th rowSpan={2} className="border border-black p-1 text-center font-bold whitespace-nowrap">KETERANGAN</th>
                      </tr>
                      <tr className="border border-black">
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                          <th key={m} className="border border-black p-0.5 sm:p-1 font-bold text-center">{m}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrixData.map((row, idx) => (
                        <tr key={row.kk.id} className="border border-black">
                          <td className="border border-black p-1 text-center font-medium">{idx + 1}</td>
                          <td className="border border-black p-1 px-3 font-medium whitespace-nowrap text-left col-nama">{row.kk.nama_kk}</td>
                          {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                            <td key={m} className="border border-black p-1 text-center font-bold text-emerald-800 print:text-black check-mark">
                              {row.monthlyStatus[m] ? '✓' : ''}
                            </td>
                          ))}
                          <td className="border border-black p-1 text-right font-medium pr-3 whitespace-nowrap">
                            {row.yearlyTotal > 0 ? row.yearlyTotal.toLocaleString('id-ID') : ''}
                          </td>
                          <td className="border border-black p-1 text-center font-medium italic text-[10px] print:text-[8pt] whitespace-nowrap">
                            {row.yearlyTotal > 0 ? 'Sudah Bayar' : ''}
                          </td>
                        </tr>
                      ))}
                      
                      {/* Empty rows padding up to 32 rows if less than 32 */}
                      {Array.from({ length: Math.max(0, (matrixData.length > 32 ? 0 : 32) - matrixData.length) }).map((_, idx) => (
                        <tr key={`empty-${idx}`} className="border border-black h-6">
                          <td className="border border-black p-1 text-center">{matrixData.length + idx + 1}</td>
                          <td className="border border-black p-1 col-nama"></td>
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
                        <td className="border-2 border-black p-1.5 text-right pr-3 whitespace-nowrap">
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
            <div className="mt-4 print-footer">
              <div className="flex items-center gap-2 mb-6 print-footer-terbilang text-xs sm:text-sm font-bold">
                <span>TERBILANG :</span>
                <div className="print-footer-terbilang-box flex-1 border-2 border-black h-8 px-3 flex items-center text-xs font-semibold uppercase bg-slate-50 print:bg-transparent tracking-wide">
                  {grandTotal > 0 ? angkaKeTerbilang(grandTotal) : ''}
                </div>
              </div>

              <div className="print-signatures flex justify-between items-start text-xs sm:text-sm font-bold text-center px-4 sm:px-8">
                {/* 1. Sekretariat Paroki */}
                <div className="flex flex-col items-center w-48 sm:w-56">
                  <div className="mb-12 print-sign-gap text-center font-bold">Diterima Oleh :</div>
                  <div className="w-full text-center font-normal text-xs mb-1">
                    (&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)
                  </div>
                  <div className="border-b border-black border-dashed w-full"></div>
                  <div className="mt-1 font-normal text-xs text-center">Sekretariat Paroki</div>
                </div>
                
                {/* 2. Ketua Lingkungan */}
                <div className="flex flex-col items-center w-48 sm:w-56">
                  <div className="mb-12 print-sign-gap text-center font-bold">Disetujui oleh:</div>
                  <div className="w-full text-center font-normal text-xs mb-1 whitespace-nowrap">
                    {pengurus?.ketua_nama && pengurus.ketua_nama !== 'Susunan pengurus belum ditentukan'
                      ? `(${pengurus.ketua_nama})`
                      : '(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)'}
                  </div>
                  <div className="border-b border-black border-dashed w-full"></div>
                  <div className="mt-1 font-normal text-xs text-center">Ketua Lingkungan</div>
                </div>

                {/* 3. Bendahara Lingkungan */}
                <div className="flex flex-col items-center w-48 sm:w-56">
                  <div className="mb-12 print-sign-gap text-center font-bold">Disetor Oleh :</div>
                  <div className="w-full text-center font-normal text-xs mb-1 whitespace-nowrap">
                    {pengurus?.bendahara_nama && pengurus.bendahara_nama !== 'Susunan pengurus belum ditentukan'
                      ? `(${pengurus.bendahara_nama})`
                      : '(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)'}
                  </div>
                  <div className="border-b border-black border-dashed w-full"></div>
                  <div className="mt-1 font-normal text-xs text-center">Bendahara Lingkungan</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
      
      {/* GLOBAL STYLES FOR PRINTING */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          html, body {
            background-color: white !important;
            color: black !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          div, main, section, article {
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
          }
          nav, aside, header, footer, .print\\:hidden {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 5mm 7mm 5mm 7mm;
          }
          .print-sheet {
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .print-sheet-inner {
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-kop {
            margin-bottom: 4px !important;
          }
          .print-kop-logo {
            width: 44px !important;
            height: 44px !important;
          }
          .print-kop-title {
            font-size: 11.5pt !important;
            margin-bottom: 2px !important;
            letter-spacing: 0.15em !important;
          }
          .print-kop-sub {
            font-size: 8pt !important;
          }
          .print-kop-header-right {
            font-size: 12pt !important;
            line-height: 1.1 !important;
          }
          .print-info-row {
            margin-bottom: 3px !important;
            font-size: 8pt !important;
          }
          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: auto !important;
          }
          .print-table th {
            padding: 1.8px 2px !important;
            font-size: 6.8pt !important;
            line-height: 1.15 !important;
            border-width: 1px !important;
          }
          .print-table td {
            padding: 1.2px 2px !important;
            font-size: 6.8pt !important;
            line-height: 1.15 !important;
            border-width: 1px !important;
          }
          .print-table .col-nama {
            white-space: nowrap !important;
            text-align: left !important;
            padding-left: 6px !important;
            padding-right: 4px !important;
          }
          .check-mark {
            font-size: 8pt !important;
            line-height: 1 !important;
            font-weight: bold !important;
          }
          .print-footer {
            margin-top: 4px !important;
          }
          .print-footer-terbilang {
            margin-bottom: 4px !important;
            font-size: 7.5pt !important;
          }
          .print-footer-terbilang-box {
            height: 18px !important;
            font-size: 7pt !important;
            padding: 0 4px !important;
            line-height: 18px !important;
          }
          .print-signatures {
            margin-top: 4px !important;
            font-size: 7.2pt !important;
          }
          .print-signatures div, .print-signatures span {
            font-size: 7.2pt !important;
          }
          .print-sign-gap {
            margin-bottom: 20px !important;
          }
        }
      `}} />
    </div>
  )
}

