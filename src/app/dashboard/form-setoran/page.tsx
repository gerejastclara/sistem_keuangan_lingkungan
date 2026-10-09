'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { JurnalTransaksi, KepalaKeluarga } from '@/lib/types'
import { ensureDummyKksForLingkungan } from '@/lib/dummyData'
import { getAllMasterCOA, MasterCOAItem } from '@/lib/masterCoa'
import { formatNamaLingkungan, getLingkunganDbUuid, getAllMasterLingkungan } from '@/lib/constants'
import { getPengurusForLingkungan, PengurusLingkungan } from '@/lib/pengurusData'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Printer, RefreshCw, Check } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'

export default function FormSetoranPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [lingkunganId, setLingkunganId] = useState<string | null>(null)
  const [lingkunganName, setLingkunganName] = useState('')
  const [pengurus, setPengurus] = useState<PengurusLingkungan | null>(null)

  const [kkList, setKkList] = useState<KepalaKeluarga[]>([])
  const [coaList, setCoaList] = useState<MasterCOAItem[]>([])
  const [jurnalList, setJurnalList] = useState<JurnalTransaksi[]>([])

  const [selectedCoaId, setSelectedCoaId] = useState<string>('')
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

        const dbLingkId = effId
        if (dbLingkId) {
          const { data: profil } = await supabase.from('profil_lingkungan').select('*').eq('id', dbLingkId)
          const peng = getPengurusForLingkungan(dbLingkId, effNama, profil?.[0] || {})
          setPengurus(peng)
        }

        const masterCoa = getAllMasterCOA()
        setCoaList(masterCoa)

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
  const matrixData = kkList.map(kk => {
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Form Setoran PDF</h1>
            <p className="text-slate-500 mt-1 text-sm font-medium">Buat formulir cetak untuk St. Yusuf, APP, Pastoran terintegrasi Jurnal Transaksi.</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
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
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
                {loading ? 'Memuat Data...' : 'Cetak / Simpan PDF'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* DOCUMENT PREVIEW (Styled for Print) */}
      {isPrintReady && !loading && (
        <div className="bg-white border border-slate-200 shadow-xl mx-auto rounded-none print:shadow-none print:border-none" style={{ maxWidth: '210mm', minHeight: '297mm' }}>
          <div className="p-8 sm:p-12 print:p-0 print:m-0 font-serif text-black">
            
            {/* KOP SURAT */}
            <div className="flex justify-between items-start mb-6">
              {/* Logo / Left side */}
              <div className="w-24 flex items-center justify-center">
                {/* Fallback to SVG if logo.png doesn't exist. User can replace public/logo.png later */}
                <div className="relative w-16 h-16 border-2 border-black rounded-full flex flex-col items-center justify-center overflow-hidden">
                   <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                     <span className="text-3xl font-black">†</span>
                   </div>
                   <svg className="w-16 h-16 absolute inset-0 text-black opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                     <circle cx="12" cy="12" r="11"/>
                   </svg>
                </div>
              </div>
              
              {/* Center Text */}
              <div className="flex-1 text-center">
                <h2 className="text-lg sm:text-xl font-bold uppercase tracking-wider underline underline-offset-4 mb-1">
                  Tanda Terima Setoran
                </h2>
                <h3 className="text-sm sm:text-base font-bold uppercase tracking-wide">
                  Paroki St. Clara - Bekasi Utara
                </h3>
              </div>
              
              {/* Right Title */}
              <div className="w-48 text-right flex flex-col justify-start pt-2">
                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-none break-words">
                  DANA {selectedCoa?.nama_akun?.replace(/Sumbangan /i, '')?.replace(/Iuran /i, '')?.toUpperCase() || 'UMAT'}
                </h1>
              </div>
            </div>

            {/* INFO HEADER */}
            <div className="flex flex-col sm:flex-row justify-between items-end mb-3 text-xs sm:text-sm font-bold uppercase gap-4 sm:gap-0">
              <div className="flex gap-2 w-full sm:w-1/2 items-end">
                <span>LINGKUNGAN :</span>
                <span className="border-b border-black flex-1 border-dashed inline-block h-5 leading-5">{formatNamaLingkungan(lingkunganName)}</span>
              </div>
              <div className="flex gap-4 sm:gap-8 items-end">
                <div className="flex gap-2 items-end">
                  <span className="lowercase font-normal">bulan:</span>
                  <span className="w-16 sm:w-20 border-b border-black border-dashed inline-block h-5"></span>
                </div>
                <div className="flex gap-2 items-end">
                  <span>TAHUN :</span>
                  <span className="w-16 sm:w-24 border-b border-black border-dashed inline-block h-5 text-center leading-5">{selectedYear}</span>
                </div>
              </div>
            </div>

            {/* TABLE */}
            <div className="overflow-x-auto w-full">
              <table className="w-full border-collapse border-2 border-black text-[10px] sm:text-xs">
                <thead>
                  <tr className="border border-black">
                    <th rowSpan={2} className="border border-black p-1 w-8 font-bold">No.</th>
                    <th rowSpan={2} className="border border-black p-1 font-bold">NAMA KELUARGA</th>
                    <th colSpan={12} className="border border-black p-1 font-bold">BULAN</th>
                    <th rowSpan={2} className="border border-black p-1 w-20 sm:w-24 font-bold">JUMLAH<br/><span className="font-normal">(Rp)</span></th>
                    <th rowSpan={2} className="border border-black p-1 w-24 sm:w-32 font-bold">KETERANGAN</th>
                  </tr>
                  <tr className="border border-black">
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                      <th key={m} className="border border-black p-0.5 sm:p-1 w-5 sm:w-6 font-bold">{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixData.map((row, idx) => (
                    <tr key={row.kk.id} className="border border-black">
                      <td className="border border-black p-1 text-center">{idx + 1}</td>
                      <td className="border border-black p-1 px-2 font-medium">{row.kk.nama_kk}</td>
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                        <td key={m} className="border border-black p-1 text-center font-bold text-emerald-800 print:text-black">
                          {row.monthlyStatus[m] ? '✓' : ''}
                        </td>
                      ))}
                      <td className="border border-black p-1 text-right font-medium pr-2">
                        {row.yearlyTotal > 0 ? row.yearlyTotal.toLocaleString('id-ID') : ''}
                      </td>
                      <td className="border border-black p-1 text-center font-medium italic">
                        {row.yearlyTotal > 0 ? 'Sudah Bayar' : ''}
                      </td>
                    </tr>
                  ))}
                  
                  {/* Empty rows to make the table look full if there are too few KKs */}
                  {Array.from({ length: Math.max(0, 35 - matrixData.length) }).map((_, idx) => (
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

            {/* FOOTER SIGNATURES */}
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-6 text-sm font-bold">
                <span>TERBILANG :</span>
                <div className="flex-1 border-2 border-black h-8 bg-slate-50 print:bg-transparent"></div>
              </div>

              <div className="flex justify-between items-start text-xs sm:text-sm font-bold text-center px-4">
                <div className="flex flex-col items-center w-40">
                  <div className="mb-16">Diterima Oleh :</div>
                  <div className="border-b border-black border-dashed w-full"></div>
                  <div className="mt-1 font-normal">Sekretariat Paroki</div>
                </div>
                
                <div className="flex flex-col items-center w-40">
                  <div className="mb-16">Disetujui oleh:</div>
                  <div className="border-b border-black border-dashed w-full relative">
                     <span className="absolute -top-4 w-full text-center font-normal capitalize"></span>
                  </div>
                  <div className="mt-1 font-normal">Ketua Lingkungan</div>
                </div>

                <div className="flex flex-col items-center w-40">
                  <div className="mb-16">Disetor Oleh :</div>
                  <div className="border-b border-black border-dashed w-full relative">
                     <span className="absolute -top-4 w-full text-center font-normal capitalize"></span>
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
