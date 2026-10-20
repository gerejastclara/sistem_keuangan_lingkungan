'use client'

import React, { useState, useRef } from 'react'
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  Users,
  Home,
  Layers,
  ArrowRight,
  RefreshCw,
  X,
  FileCheck,
  Building2,
  AlertTriangle
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { parseDafuExcelOrCsv, uploadDafuParsedDataToSupabase, ParsedDafuResult } from '@/lib/dafuExcelImporter'
import { createClient } from '@/utils/supabase/client'

interface ImportExcelDafuModalProps {
  isOpen: boolean
  onClose: () => void
  userRole?: string
  userLingkunganId?: string | null
  onSuccess?: () => void
}

export function ImportExcelDafuModal({
  isOpen,
  onClose,
  userRole,
  userLingkunganId,
  onSuccess
}: ImportExcelDafuModalProps) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<'IDLE' | 'PARSING' | 'PREVIEW' | 'UPLOADING' | 'SUCCESS'>('IDLE')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedDafuResult | null>(null)
  const [selectedLingkunganFilter, setSelectedLingkunganFilter] = useState<string>('all')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Upload progress state
  const [progressPercent, setProgressPercent] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [uploadResult, setUploadResult] = useState<{ totalKks: number; totalJiwa: number } | null>(null)

  const handleReset = () => {
    setStep('IDLE')
    setSelectedFile(null)
    setParsedData(null)
    setErrorMessage(null)
    setProgressPercent(0)
    setProgressMessage('')
    setUploadResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    processFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    processFile(file)
  }

  const processFile = async (file: File) => {
    const validExts = ['.xlsx', '.xls', '.csv']
    const hasValidExt = validExts.some(ext => file.name.toLowerCase().endsWith(ext))
    if (!hasValidExt) {
      setErrorMessage('Format file tidak didukung! Harap unggah file berformat .xlsx, .xls, atau .csv.')
      return
    }

    setSelectedFile(file)
    setErrorMessage(null)
    setStep('PARSING')

    try {
      const buffer = await file.arrayBuffer()
      const result = await parseDafuExcelOrCsv(buffer)

      if (result.kks.length === 0) {
        throw new Error('Tidak ada data keluarga yang valid di dalam file.')
      }

      setParsedData(result)
      setStep('PREVIEW')
    } catch (err: any) {
      console.error('Error parsing file:', err)
      setErrorMessage(err?.message || 'Gagal membaca isi file Excel / CSV.')
      setStep('IDLE')
    }
  }

  const handleStartUpload = async () => {
    if (!parsedData || !selectedFile) return

    setStep('UPLOADING')
    setProgressPercent(0)
    setProgressMessage('Menyiapkan batch data ke database Supabase...')

    const result = await uploadDafuParsedDataToSupabase(supabase, parsedData.kks, {
      userRole,
      userLingkunganId,
      fileName: selectedFile.name,
      fileSizeBytes: selectedFile.size,
      onProgress: (percent, current, total, message) => {
        setProgressPercent(percent)
        setProgressMessage(message)
      }
    })

    if (result.success) {
      setUploadResult({
        totalKks: result.totalKksInserted,
        totalJiwa: result.totalJiwaInserted
      })
      setStep('SUCCESS')
      if (onSuccess) onSuccess()
    } else {
      setErrorMessage(result.error || 'Gagal menyimpan ke database Supabase.')
      setStep('PREVIEW')
    }
  }

  // Filter preview records
  const filteredPreviewKks = parsedData?.kks.filter(k => {
    if (selectedLingkunganFilter === 'all') return true
    return k.lingkungan_id === selectedLingkunganFilter
  }) || []

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && step !== 'UPLOADING') { handleReset(); onClose(); } }}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-white text-slate-900 border border-slate-200 shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 via-teal-50/40 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                Import & Distribusi Data Umat (DAFU)
                <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                  Cloud DB
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Unggah file Excel / CSV data umat resmi paroki untuk langsung disimpan dan didistribusikan ke masing-masing lingkungan.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 text-sm">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-900">Terjadi Kesalahan</p>
                <p className="text-xs text-rose-700 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* STEP 1: IDLE / DROPZONE */}
          {step === 'IDLE' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/20 hover:bg-emerald-50/50 rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 group flex flex-col items-center justify-center"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-16 h-16 rounded-2xl bg-white border border-emerald-200 shadow-sm flex items-center justify-center text-emerald-600 group-hover:scale-110 group-hover:shadow-md transition-all">
                  <Upload className="w-8 h-8" />
                </div>
                <h4 className="mt-4 font-bold text-slate-800 text-base sm:text-lg">
                  Klik atau Tarik File Excel / CSV ke sini
                </h4>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mt-1">
                  Format yang didukung: <span className="font-semibold text-emerald-700">.xlsx, .xls, .csv</span> (Contoh: File Ekspor Data Umat Santa Clara).
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-400 bg-white/80 px-3 py-1.5 rounded-full border border-slate-200">
                  <FileCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Mendukung ribuan baris dengan auto-split batching ke Supabase
                </div>
              </div>

              {/* Tips format kolom */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-600" /> Format Kolom yang Dikenali Otomatis:
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Nama Lingkungan</span>, <span className="font-semibold text-slate-700">Nomor Kartu Keluarga (No KK)</span>, <span className="font-semibold text-slate-700">Nama Lengkap</span>, <span className="font-semibold text-slate-700">Hubungan Keluarga</span>, <span className="font-semibold text-slate-700">Alamat / RT / RW / Kelurahan</span>, <span className="font-semibold text-slate-700">Telepon</span>, dan <span className="font-semibold text-slate-700">Status Kesejahteraan (Golongan)</span>.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: PARSING SPINNER */}
          {step === 'PARSING' && (
            <div className="py-16 text-center space-y-4">
              <RefreshCw className="w-10 h-10 text-emerald-600 animate-spin mx-auto" />
              <div>
                <h4 className="font-bold text-slate-800 text-base">Sedang Membaca & Memetakan File...</h4>
                <p className="text-xs text-slate-500 mt-1">Menormalisasi nama lingkungan dan mengelompokkan keluarga...</p>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW DATA */}
          {step === 'PREVIEW' && parsedData && (
            <div className="space-y-5">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/60">
                  <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                    <Home className="w-3.5 h-3.5" /> Total Kepala Keluarga
                  </p>
                  <p className="text-xl sm:text-2xl font-black text-emerald-950 mt-1">
                    {parsedData.summary.totalKks.toLocaleString('id-ID')} <span className="text-xs font-semibold text-emerald-700">KK</span>
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/60">
                  <p className="text-xs text-blue-700 font-semibold flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Total Jiwa (Anggota)
                  </p>
                  <p className="text-xl sm:text-2xl font-black text-blue-950 mt-1">
                    {parsedData.summary.totalJiwa.toLocaleString('id-ID')} <span className="text-xs font-semibold text-blue-700">Jiwa</span>
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/60">
                  <p className="text-xs text-amber-700 font-semibold flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> Lingkungan Terdampak
                  </p>
                  <p className="text-xl sm:text-2xl font-black text-amber-950 mt-1">
                    {parsedData.summary.lingkunganCount} <span className="text-xs font-semibold text-amber-700">Lingkungan</span>
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200/60">
                  <p className="text-xs text-purple-700 font-semibold flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> Total Baris Asli
                  </p>
                  <p className="text-xl sm:text-2xl font-black text-purple-950 mt-1">
                    {parsedData.summary.totalRows.toLocaleString('id-ID')} <span className="text-xs font-semibold text-purple-700">Baris</span>
                  </p>
                </div>
              </div>

              {/* Unmapped warning */}
              {parsedData.summary.unmappedRowsCount > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>
                    Ditemukan <strong className="font-bold">{parsedData.summary.unmappedRowsCount} baris</strong> yang nama lingkungannya tidak dikenali dan akan dilewati saat penyimpanan.
                  </span>
                </div>
              )}

              {/* Filter & Table Preview */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Pratinjau Data Keluarga (Sampel 10 Teratas)
                  </p>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <label className="text-xs text-slate-500 whitespace-nowrap">Filter Lingkungan:</label>
                    <select
                      value={selectedLingkunganFilter}
                      onChange={(e) => setSelectedLingkunganFilter(e.target.value)}
                      className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="all">Semua Lingkungan ({parsedData.summary.lingkunganCount})</option>
                      {parsedData.byLingkungan.map(l => (
                        <option key={l.lingkunganId} value={l.lingkunganId}>
                          {l.namaLingkungan} ({l.kkCount} KK - {l.jiwaCount} Jiwa)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3">No. KK</th>
                          <th className="py-2.5 px-3">Nama Kepala Keluarga</th>
                          <th className="py-2.5 px-3">Lingkungan</th>
                          <th className="py-2.5 px-3">Jumlah Anggota</th>
                          <th className="py-2.5 px-3">Golongan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {filteredPreviewKks.slice(0, 10).map((k) => (
                          <tr key={k.id} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-3 font-mono font-medium text-slate-600">{k.no_kk || '-'}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">{k.nama_kk}</td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 font-medium text-slate-700 border border-slate-200">
                                {k.nama_lingkungan}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-blue-700">{k.anggota.length}</span> Jiwa
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                k.golongan === 'Sejahtera' ? 'bg-emerald-100 text-emerald-800' :
                                k.golongan === 'Terduga Prasejahtera' ? 'bg-amber-100 text-amber-800' :
                                k.golongan === 'Rentan Tidak Mampu' ? 'bg-orange-100 text-orange-800' :
                                'bg-rose-100 text-rose-800'
                              }`}>
                                {k.golongan}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredPreviewKks.length > 10 && (
                    <div className="p-2 text-center text-[11px] text-slate-500 bg-slate-50/50 border-t border-slate-100">
                      Menampilkan 10 dari total {filteredPreviewKks.length} keluarga pada filter ini.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: UPLOADING PROGRESS */}
          {step === 'UPLOADING' && (
            <div className="py-12 px-4 text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner animate-pulse">
                <Upload className="w-8 h-8" />
              </div>
              <div className="space-y-2 max-w-md mx-auto">
                <h4 className="font-bold text-slate-900 text-lg">Menyimpan Data ke Database Cloud...</h4>
                <p className="text-xs sm:text-sm text-slate-500">{progressMessage}</p>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200 mt-4">
                  <div
                    className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs font-bold text-emerald-700 text-right">{progressPercent}%</p>
              </div>
              <p className="text-xs text-slate-400">
                Mohon tidak menutup peramban hingga proses penyimpanan selesai.
              </p>
            </div>
          )}

          {/* STEP 5: SUCCESS CONFIRMATION */}
          {step === 'SUCCESS' && uploadResult && (
            <div className="py-10 px-4 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-bold text-slate-900 text-xl">Import Data Umat Berhasil!</h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  Seluruh data berhasil disimpan langsung ke database Supabase dan otomatis terdistribusi ke masing-masing lingkungan.
                </p>
              </div>
              <div className="inline-flex items-center gap-6 p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 text-sm">
                <div>
                  <p className="text-xs text-emerald-700 font-semibold">Total Kepala Keluarga</p>
                  <p className="text-2xl font-black text-emerald-950">{uploadResult.totalKks.toLocaleString('id-ID')} <span className="text-xs">KK</span></p>
                </div>
                <div className="w-px h-8 bg-emerald-200" />
                <div>
                  <p className="text-xs text-emerald-700 font-semibold">Total Jiwa Terdaftar</p>
                  <p className="text-2xl font-black text-emerald-950">{uploadResult.totalJiwa.toLocaleString('id-ID')} <span className="text-xs">Jiwa</span></p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          {step === 'PREVIEW' ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="text-xs font-semibold"
              >
                Pilih File Lain
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  className="text-xs"
                >
                  Batal
                </Button>
                <Button
                  size="sm"
                  onClick={handleStartUpload}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-sm shadow-emerald-600/30"
                >
                  Simpan ke Database ({parsedData?.summary.totalKks.toLocaleString('id-ID')} KK)
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </>
          ) : step === 'SUCCESS' ? (
            <div className="w-full flex justify-end">
              <Button
                size="sm"
                onClick={() => { handleReset(); onClose(); }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6"
              >
                Selesai
              </Button>
            </div>
          ) : (
            <div className="w-full flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={step === 'UPLOADING'}
                className="text-xs"
              >
                Tutup
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
