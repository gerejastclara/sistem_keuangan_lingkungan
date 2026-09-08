'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { KepalaKeluarga, JurnalTransaksi } from '@/lib/types'
import { formatRupiah, MONTH_NAMES } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CheckCircle2, CreditCard, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ensureDummyKksForLingkungan } from '@/lib/dummyData'

export default function KartuSetoranPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [lingkunganId, setLingkunganId] = useState<string | null>(null)
  const [lingkunganName, setLingkunganName] = useState('')

  const [kkList, setKkList] = useState<KepalaKeluarga[]>([])
  const [jurnalList, setJurnalList] = useState<JurnalTransaksi[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  const [selectedCoa, setSelectedCoa] = useState<string>('4100') // 4100 Kas, 4200 ASAK, 4300 St Yusuf, 4120 Dahar Romo
  const [selectedYear, setSelectedYear] = useState<number>(2026)

  const coaOptions = [
    { code: '4100', name: '4100 - Iuran Kas Lingkungan' },
    { code: '4200', name: '4200 - Sumbangan ASAK' },
    { code: '4300', name: '4300 - St. Yusuf / Kematian' },
    { code: '4120', name: '4120 - Sumbangan Dahar Romo' },
  ]

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const effectiveEmail = user?.email || (typeof document !== 'undefined' ? (`; ${document.cookie}`).split('; demo_user_email=').pop()?.split(';').shift() : '') || ''
        const effectiveRole = (typeof document !== 'undefined' ? (`; ${document.cookie}`).split('; demo_user_role=').pop()?.split(';').shift() : '') || ''
        
        let targetLingkunganId: string | null = null
        let targetLingkunganNama: string | null = null

        if (effectiveRole !== 'PAROKI' && effectiveEmail) {
          const { findLingkunganByQuery } = await import('@/lib/constants')
          const matched = findLingkunganByQuery(effectiveEmail)
          if (matched) {
            targetLingkunganId = matched.id
            targetLingkunganNama = matched.nama_lingkungan
          }
        }

        if (!targetLingkunganId) {
          targetLingkunganId = localStorage.getItem('selected_lingkungan_id')
        }
        if (!targetLingkunganId) {
          const { data: uData } = await supabase.from('users').select('lingkungan_id').limit(1).maybeSingle()
          targetLingkunganId = uData?.lingkungan_id || null
        }

        if (targetLingkunganNama) {
          setLingkunganName(targetLingkunganNama)
        } else if (targetLingkunganId) {
          const { getAllMasterLingkungan } = await import('@/lib/constants')
          const found = getAllMasterLingkungan().find(l => l.id === targetLingkunganId)
          if (found) {
            setLingkunganName(found.nama_lingkungan)
          } else {
            const { data: lData } = await supabase.from('lingkungan').select('nama_lingkungan').eq('id', targetLingkunganId).maybeSingle()
            if (lData) setLingkunganName(lData.nama_lingkungan)
          }
        }

        setLingkunganId(targetLingkunganId)

        if (targetLingkunganId) {
          // Fetch KK list
          const { data: kks } = await supabase
            .from('kepala_keluarga')
            .select('*')
            .eq('lingkungan_id', targetLingkunganId)
            .order('nama_kk', { ascending: true })

          let dbKks = kks || []
          const localSaved = localStorage.getItem(`custom_kks_${targetLingkunganId}`)
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
              const matched = allParsed.filter(k => k.lingkungan_id === targetLingkunganId)
              const combinedMap = new Map<string, KepalaKeluarga>()
              dbKks.forEach(k => combinedMap.set(k.id, k))
              matched.forEach(k => combinedMap.set(k.id, k))
              dbKks = Array.from(combinedMap.values())
            } catch (e) {}
          }

          const finalKks = ensureDummyKksForLingkungan(targetLingkunganId, lingkunganName || 'Lingkungan', dbKks)
          setKkList(finalKks)

          // Fetch Journals
          const { data: journals } = await supabase
            .from('jurnal_transaksi')
            .select('*')
            .eq('lingkungan_id', targetLingkunganId)
            .eq('tipe_arus', 'MASUK')

          if (journals) setJurnalList(journals)
        }
      } catch (err) {
        console.error('Error loading kartu setoran:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()

    const handleSync = () => {
      loadData()
    }
    window.addEventListener('dafuDataUpdated', handleSync)
    window.addEventListener('storage', handleSync)
    window.addEventListener('lingkunganChanged', handleSync)

    return () => {
      window.removeEventListener('dafuDataUpdated', handleSync)
      window.removeEventListener('storage', handleSync)
      window.removeEventListener('lingkunganChanged', handleSync)
    }
  }, [supabase])

  const filteredKkList = kkList.filter(k =>
    k.nama_kk.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (k.alamat && k.alamat.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Compute setoran matrix: KK ID -> month (1-12) -> total nominal
  const getMatrixNominal = (kkId: string, month: number) => {
    return jurnalList
      .filter(j => {
        if (j.kk_id !== kkId) return false
        if (j.coa_debit !== selectedCoa && j.coa_kredit !== selectedCoa) return false
        const d = new Date(j.tanggal)
        return d.getMonth() + 1 === month && d.getFullYear() === selectedYear
      })
      .reduce((acc, curr) => acc + Number(curr.nominal), 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#1B2130] tracking-tight font-serif">Kartu Setoran 12 Bulan per KK</h1>
        <p className="text-sm text-slate-500 mt-1">
          Matriks Rekapitulasi Iuran Wajib, Sukarela, Pembangunan, atau Dana Kematian per KK Lingkungan <span className="text-emerald-700 font-semibold">{lingkunganName}</span>.
        </p>
      </div>

      {/* Filter & Toolbar */}
      <Card className="bg-white border-slate-200 rounded-2xl shadow-xs">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-64">
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Jenis Iuran / Pos Penerimaan</Label>
              <Select value={selectedCoa} onValueChange={(val) => val && setSelectedCoa(val)}>
                <SelectTrigger className="h-9 bg-white border-slate-300 text-slate-900 rounded-xl focus:ring-emerald-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900">
                  {coaOptions.map((opt) => (
                    <SelectItem key={opt.code} value={opt.code}>
                      [{opt.code}] {opt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-28">
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Tahun</Label>
              <Select value={selectedYear.toString()} onValueChange={(v) => v && setSelectedYear(parseInt(v))}>
                <SelectTrigger className="h-9 bg-white border-slate-300 text-slate-900 rounded-xl focus:ring-emerald-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900">
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <Input
              placeholder="Cari nama KK..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm bg-white border-slate-300 text-slate-900 rounded-xl focus:ring-emerald-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Matrix Table View */}
      <Card className="bg-white border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-3">
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            Rekap Setoran [{selectedCoa}] {coaOptions.find(c => c.code === selectedCoa)?.name.split('-')[1]} Tahun {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="text-xs border-collapse">
            <TableHeader className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <TableRow>
                <TableHead className="w-10 text-center sticky left-0 bg-slate-100 z-10 border-r border-slate-200 text-slate-700 font-bold">No</TableHead>
                <TableHead className="w-48 sticky left-10 bg-slate-100 z-10 border-r border-slate-200 font-bold text-slate-900">
                  Nama Kepala Keluarga
                </TableHead>
                {MONTH_NAMES.map((m, idx) => (
                  <TableHead key={idx} className="w-20 text-center font-bold border-r border-slate-200 text-slate-700">
                    {m.slice(0, 3)}
                  </TableHead>
                ))}
                <TableHead className="w-28 text-right font-extrabold text-emerald-950 bg-emerald-50/80">Total Setor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100">
              {filteredKkList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={15} className="text-center py-8 text-slate-400">
                    Tidak ada data Kepala Keluarga terdaftar.
                  </TableCell>
                </TableRow>
              ) : (
                filteredKkList.map((kk, idx) => {
                  let kkTotalYear = 0
                  return (
                    <TableRow key={kk.id} className="hover:bg-slate-50 transition">
                      <TableCell className="text-center font-mono text-xs text-slate-500 sticky left-0 bg-white border-r border-slate-200">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900 sticky left-10 bg-white border-r border-slate-200 truncate">
                        {kk.nama_kk}
                      </TableCell>
                      {MONTH_NAMES.map((_, mIdx) => {
                        const amount = getMatrixNominal(kk.id, mIdx + 1)
                        kkTotalYear += amount
                        return (
                          <TableCell key={mIdx} className="text-center border-r border-slate-200/80 p-1">
                            {amount > 0 ? (
                              <span className="inline-block bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold px-1.5 py-0.5 rounded text-[10px]" title={formatRupiah(amount)}>
                                ✓ {amount >= 1000 ? `${amount / 1000}k` : amount}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono text-[10px]">-</span>
                            )}
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-right font-mono font-extrabold text-emerald-700 bg-emerald-50/40 px-3">
                        {formatRupiah(kkTotalYear)}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

