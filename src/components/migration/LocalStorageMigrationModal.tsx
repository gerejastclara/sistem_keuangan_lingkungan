'use client'

import React, { useState, useEffect } from 'react'
import {
  Database,
  CloudUpload,
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
  X,
  FileSpreadsheet,
  Users,
  Building,
  Coins,
  ShieldCheck,
  RefreshCw
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import {
  scanLocalStorageData,
  exportLocalStorageBackup,
  executeMigrationToSupabase,
  clearMigratedLocalStorage,
  LocalStorageInventory,
  MigrationProgress,
  MigrationResult
} from '@/lib/migrationService'

interface LocalStorageMigrationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function LocalStorageMigrationModal({
  isOpen,
  onClose,
  onSuccess
}: LocalStorageMigrationModalProps) {
  const [supabase] = useState(() => createClient())
  const [inventory, setInventory] = useState<LocalStorageInventory | null>(null)
  const [isMigrating, setIsMigrating] = useState(false)
  const [progress, setProgress] = useState<MigrationProgress | null>(null)
  const [result, setResult] = useState<MigrationResult | null>(null)
  const [clearAfter, setClearAfter] = useState(true)
  const [backupDownloaded, setBackupDownloaded] = useState(false)

  // Rescan whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      const inv = scanLocalStorageData()
      setInventory(inv)
      setProgress(null)
      setResult(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleDownloadBackup = () => {
    if (!inventory) return
    exportLocalStorageBackup(inventory)
    setBackupDownloaded(true)
  }

  const handleStartMigration = async () => {
    if (!inventory || inventory.totalItems === 0) return

    setIsMigrating(true)
    setProgress({
      percent: 0,
      currentModule: 'Mempersiapkan',
      currentCount: 0,
      totalCount: inventory.totalItems,
      message: 'Menghubungkan ke Supabase Cloud...'
    })

    const res = await executeMigrationToSupabase(supabase, p => {
      setProgress(p)
    })

    setResult(res)
    setIsMigrating(false)

    if (res.success) {
      if (clearAfter) {
        clearMigratedLocalStorage()
      }
      if (onSuccess) onSuccess()
    }
  }

  const handleFinish = () => {
    if (result?.success && clearAfter) {
      clearMigratedLocalStorage()
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Migrasi Local Storage ke Cloud Database
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pindahkan seluruh data pembukuan & data umat dari browser ke Supabase
              </p>
            </div>
          </div>
          {!isMigrating && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Result View */}
          {result ? (
            <div className="space-y-6 animate-in zoom-in-95 duration-200">
              {result.success ? (
                <div className="text-center p-6 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl">
                  <div className="w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
                    Migrasi Berhasil Sempurna!
                  </h4>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1 max-w-md mx-auto">
                    Seluruh data lokal telah tersimpan dengan aman di database Supabase Cloud. Sistem kini 100% menggunakan database cloud.
                  </p>
                </div>
              ) : (
                <div className="text-center p-6 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-2xl">
                  <div className="w-14 h-14 bg-rose-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-rose-500/20">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <h4 className="text-xl font-bold text-rose-900 dark:text-rose-100">
                    Sebagian Data Gagal Diunggah
                  </h4>
                  <p className="text-sm text-rose-700 dark:text-rose-300 mt-1">
                    {result.error || 'Terjadi gangguan koneksi saat menyimpan data ke database.'}
                  </p>
                </div>
              )}

              {/* Statistics Breakdown */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  Rincian Data yang Berhasil Disimpan ke Supabase:
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-700">
                    <span className="text-xs text-slate-500 block">Transaksi Kas</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
                      {result.stats.transaksiUploaded}
                    </span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-700">
                    <span className="text-xs text-slate-500 block">Kepala Keluarga</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
                      {result.stats.kkUploaded}
                    </span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-700">
                    <span className="text-xs text-slate-500 block">Jiwa Umat</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
                      {result.stats.anggotaUploaded}
                    </span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-700">
                    <span className="text-xs text-slate-500 block">Profil Lingkungan</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
                      {result.stats.profilUploaded}
                    </span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-700">
                    <span className="text-xs text-slate-500 block">Aset Inventaris</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
                      {result.stats.asetUploaded}
                    </span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-700">
                    <span className="text-xs text-slate-500 block">Klasifikasi Ekonomi</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
                      {result.stats.golonganUploaded}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : isMigrating ? (
            /* Progress View */
            <div className="py-8 space-y-6 text-center animate-in fade-in duration-200">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-amber-200 dark:border-amber-950/50 animate-ping opacity-25"></div>
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-xl shadow-orange-500/25">
                  <CloudUpload className="w-10 h-10 animate-bounce" />
                </div>
              </div>

              <div>
                <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {progress?.currentModule || 'Sedang memindahkan data...'}
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {progress?.message || 'Menyiapkan batch data...'}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3.5 p-0.5 overflow-hidden border border-slate-200 dark:border-slate-700">
                <div
                  className="bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress?.percent || 0}%` }}
                ></div>
              </div>

              <div className="flex justify-between text-xs text-slate-400 font-mono">
                <span>Diproses: {progress?.currentCount || 0} entitas</span>
                <span>{progress?.percent || 0}%</span>
              </div>
            </div>
          ) : (
            /* Scan Inventory View */
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex gap-3.5 items-start">
                <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                  <span className="font-semibold block text-sm mb-0.5 text-amber-900 dark:text-amber-100">
                    Data Anda Aman
                  </span>
                  Data di browser Anda akan divalidasi dan diunggah langsung ke database Supabase Cloud. Anda dapat mengunduh salinan cadangan JSON offline sebelum memulai.
                </div>
              </div>

              {/* Detected Items Grid */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Data yang Ditemukan di Local Storage:
                  </h4>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    Total: {inventory?.totalItems || 0} Record
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                      <Coins className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Transaksi Kas</span>
                      <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                        {inventory?.transactions.length || 0}
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Kepala Keluarga</span>
                      <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                        {inventory?.kepalaKeluarga.length || 0}
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Jiwa Umat</span>
                      <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                        {inventory?.anggotaKeluarga.length || 0}
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
                      <Building className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Pengurus Lingkungan</span>
                      <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                        {inventory?.profilLingkungan.length || 0}
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Aset Inventaris</span>
                      <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                        {inventory?.aset.length || 0}
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">COA & Kriteria</span>
                      <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                        {(inventory?.coa.length || 0) + (inventory?.kriteriaGolongan.length || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Options */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={clearAfter}
                    onChange={e => setClearAfter(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 dark:border-slate-700"
                  />
                  <span>Hapus data dari local storage setelah berhasil diunggah ke cloud</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-3">
          {result ? (
            <button
              onClick={handleFinish}
              className="w-full py-2.5 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium shadow-md shadow-emerald-500/20 transition flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> Selesai & Perbarui Halaman
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleDownloadBackup}
                disabled={isMigrating || !inventory || inventory.totalItems === 0}
                className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium transition flex items-center gap-2 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {backupDownloaded ? 'Backup Diunduh ✓' : 'Unduh Backup JSON'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isMigrating}
                  className="py-2.5 px-4 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleStartMigration}
                  disabled={isMigrating || !inventory || inventory.totalItems === 0}
                  className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-sm font-medium shadow-md shadow-orange-500/20 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {isMigrating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Memindahkan...
                    </>
                  ) : (
                    <>
                      <CloudUpload className="w-4 h-4" />
                      Mulai Migrasi ke Cloud
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
