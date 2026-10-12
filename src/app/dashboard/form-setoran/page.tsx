'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { JurnalTransaksi, KepalaKeluarga } from '@/lib/types'
import { ensureDummyKksForLingkungan } from '@/lib/dummyData'
import { getAllMasterCOA, MasterCOAItem } from '@/lib/masterCoa'
import { formatNamaLingkungan, getLingkunganDbUuid, getAllMasterLingkungan, getWilayahForLingkungan } from '@/lib/constants'
import { getPengurusForLingkungan, PengurusLingkungan } from '@/lib/pengurusData'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Printer, RefreshCw, Check, FileText, Table as TableIcon } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'

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

export default function FormSetoranPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [lingkunganId, setLingkunganId] = useState<string | null>(null)
  const [lingkunganName, setLingkunganName] = useState('')
  const [pengurus, setPengurus] = useState<PengurusLingkungan | null>(null)

  const [kkList, setKkList] = useState<KepalaKeluarga[]>([])
  const [coaList, setCoaList] = useState<MasterCOAItem[]>([])
  const [jurnalList, setJurnalList] = useState<JurnalTransaksi[]>([])

  const [selectedCoaId, setSelectedCoaId] = useState<string>('4300')
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())
  const [formTemplate, setFormTemplate] = useState<'TANDA_TERIMA' | 'REKAP_AMPLOP'>('TANDA_TERIMA')

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

        const dbLingkId = effId
        if (dbLingkId) {
          const { data: profil } = await supabase.from('profil_lingkungan').select('*').eq('id', dbLingkId)
          const peng = getPengurusForLingkungan(dbLingkId, effNama, profil?.[0] || {})
          setPengurus(peng)
        }

        const masterCoa = getAllMasterCOA()
        setCoaList(masterCoa)

        // Default to St. Yusuf (4300) if not set or found
        if (!selectedCoaId && masterCoa.length > 0) {
          const stYusuf = masterCoa.find(c => c.id === '4300') || masterCoa[0]
          setSelectedCoaId(stYusuf.id)
        }

        // Load KK
        const { data: kkData } = await supabase
          .from('kepala_keluarga')
          .select('*')
          .eq('lingkungan_id', dbLingkId)
          .order('nama_kk', { ascending: true })

        if (kkData && kkData.length > 0) {
          setKkList(kkData)
        } else {
          setKkList(ensureDummyKksForLingkungan(dbLingkId, effNama, []))
        }

        // Load Jurnal
        const { data: jData } = await supabase
          .from('jurnal_transaksi')
          .select('*')
          .eq('lingkungan_id', dbLingkId)
          .order('tanggal', { ascending: true })

        if (jData) {
          setJurnalList(jData)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [supabase])

  const handlePrint = () => {
    window.print()
  }

  const selectedCoa = coaList.find(c => c.id === selectedCoaId)
  const isPrintReady = selectedCoaId !== '' && selectedYear !== ''

  // Filter COA for the dropdown (usually Penerimaan like St Yusuf, Pastoran, APP, HPS, etc)
  const formCoaOptions = coaList.filter(c => c.kategori === 'PENERIMAAN' || c.kategori === 'PENGELUARAN' || c.id === '1300' || c.id === '1400')

  // Prepare table matrix data
  const matrixData = kkList.map((kk, idx) => {
    let yearlyTotal = 0
    const monthlyStatus: Record<number, boolean> = {}

    // Find transactions for this KK in the selected year and selected COA
    const txs = jurnalList.filter(j => 
      j.kk_id === kk.id && 
      j.tanggal.startsWith(selectedYear) && 
      (j.coa_debit === selectedCoaId || j.coa_kredit === selectedCoaId)
    )

    txs.forEach(tx => {
      const month = parseInt(tx.tanggal.split('-')[1], 10)
      monthlyStatus[month] = true
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

  // Compute clean title for Dana header
  const getCleanDanaTitle = () => {
    if (selectedCoa?.id === '4300' || selectedCoa?.nama_akun?.toLowerCase().includes('yusuf')) {
      return 'DANA ST. YUSUF'
    }
    const cleanName = selectedCoa?.nama_akun
      ?.replace(/^Iuran /i, '')
      ?.replace(/^Sumbangan /i, '')
      ?.replace(/^Dana /i, '')
      ?.toUpperCase() || 'UMAT'
    return `DANA ${cleanName}`
  }

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 relative min-h-screen pb-20 font-sans">
      
      {/* CONTROL PANEL (Hidden during print) */}
      <div className="print:hidden space-y-6 mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Form Setoran &amp; Rekapitulasi PDF</h1>
            <p className="text-slate-500 mt-1 text-sm font-medium">Kop surat resmi Paroki Santa Clara untuk formulir cetak Bendahara Lingkungan (St. Yusuf, APP, Dahar Romo, Rekapitulasi Amplop).</p>
          </div>
        </div>

        {/* TEMPLATE PICKER & COA SELECTOR */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-5">
          {/* Format Template Tabs */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2">Pilih Format Formulir</label>
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 gap-1">
              <button
                type="button"
                onClick={() => setFormTemplate('TANDA_TERIMA')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  formTemplate === 'TANDA_TERIMA'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-300'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TableIcon className="w-4 h-4 text-[#18539E]" />
                Tanda Terima Setoran (Matriks 12 Bulan)
              </button>
              <button
                type="button"
                onClick={() => setFormTemplate('REKAP_AMPLOP')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  formTemplate === 'REKAP_AMPLOP'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-300'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-4 h-4 text-[#18539E]" />
                Rekapitulasi Amplop
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div className="space-y-2.5 col-span-1 sm:col-span-2">
              <label className="text-xs font-bold text-slate-700">Pilih Jenis Dana Form (COA)</label>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {formCoaOptions.map(coa => {
                  const isSelected = selectedCoaId === coa.id
                  return (
                    <button
                      key={coa.id}
                      type="button"
                      onClick={() => setSelectedCoaId(coa.id)}
                      className={`text-left p-2.5 rounded-xl border transition cursor-pointer shrink-0 w-48 ${
                        isSelected
                          ? 'bg-slate-100 border-slate-400 text-slate-900 shadow-xs ring-1 ring-slate-400'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 border border-slate-300">
                          {coa.id}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-slate-800" />}
                      </div>
                      <div className="font-bold text-xs text-slate-900 truncate" title={coa.nama_akun}>
                        {coa.nama_akun}
                      </div>
                      <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                        {coa.kategori}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Tahun Transaksi</label>
              <Select value={selectedYear} onValueChange={(val) => { if (val) setSelectedYear(val) }}>
                <SelectTrigger className="bg-white border-slate-300 text-slate-900 rounded-xl h-11 text-sm font-medium">
                  <SelectValue placeholder="Pilih Tahun" />
                </SelectTrigger>
                <SelectContent>
                  {['2024', '2025', '2026', '2027', '2028'].map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Button 
                onClick={handlePrint}
                disabled={!isPrintReady || loading}
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
                {loading ? 'Memuat Data...' : 'Cetak / Simpan PDF'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* DOCUMENT PREVIEW (Styled for Print - Exactly Matches Authentic Documents) */}
      {isPrintReady && !loading && (
        <div className="bg-white border border-slate-300 shadow-xl mx-auto rounded-none print:shadow-none print:border-none" style={{ maxWidth: '210mm', minHeight: '297mm' }}>
          <div className="p-8 sm:p-12 print:p-0 print:m-0 font-serif text-black">
            
            {/* ========================================================= */}
            {/* FORMAT 1: TANDA TERIMA SETORAN (PERSIS GAMBAR 1)          */}
            {/* ========================================================= */}
            {formTemplate === 'TANDA_TERIMA' && (
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
                  
                  {/* Judul Kanan (DANA ST. YUSUF) */}
                  <div className="w-48 text-right flex flex-col justify-start pt-1">
                    <h1 className="text-lg sm:text-2xl font-black font-sans uppercase tracking-tight leading-none break-words">
                      {getCleanDanaTitle()}
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
                  <div className="flex gap-4 sm:gap-8 items-end">
                    <div className="flex gap-2 items-end">
                      <span className="lowercase font-normal">bulan:</span>
                      <span className="w-16 sm:w-20 border-b border-black border-dashed inline-block h-5"></span>
                    </div>
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
                      
                      {/* Empty rows padding up to 35 rows */}
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

            {/* ========================================================= */}
            {/* FORMAT 2: REKAPITULASI AMPLOP (PERSIS GAMBAR 2)           */}
            {/* ========================================================= */}
            {formTemplate === 'REKAP_AMPLOP' && (
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
                      REKAPITULASI AMPLOP {selectedCoa?.nama_akun?.replace(/^Iuran /i, '')?.replace(/^Sumbangan /i, '') ? `(${selectedCoa.nama_akun.replace(/^Iuran /i, '').replace(/^Sumbangan /i, '')})` : '....................................................'} Thn {selectedYear || '........'}
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

                {/* TABLE REKAPITULASI AMPLOP */}
                <div className="overflow-x-auto w-full">
                  <table className="w-full border-collapse border-2 border-black text-[10px] sm:text-xs">
                    <thead>
                      <tr className="border border-black">
                        <th className="border border-black p-1.5 w-12 font-bold text-center">No.</th>
                        <th className="border border-black p-1.5 w-28 font-bold text-center">No. AMPLOP</th>
                        <th className="border border-black p-1.5 font-bold text-left px-3">NAMA</th>
                        <th className="border border-black p-1.5 w-36 font-bold text-center">JUMLAH (Rp)</th>
                        <th className="border border-black p-1.5 w-40 font-bold text-center">KETERANGAN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrixData.map((row, idx) => (
                        <tr key={row.kk.id} className="border border-black h-7">
                          <td className="border border-black p-1 text-center font-medium">{idx + 1}</td>
                          <td className="border border-black p-1 text-center font-mono font-medium">{row.envelopeNo}</td>
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
                          <td className="border border-black p-1"></td>
                        </tr>
                      ))}
                      
                      {/* TOTAL ROW */}
                      <tr className="border-t-2 border-black font-bold">
                        <td colSpan={3} className="border border-black p-1.5 text-center">JUMLAH</td>
                        <td className="border-2 border-black p-1.5 text-right pr-3">
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

