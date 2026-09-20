'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  FileText,
  Printer,
  FileCheck,
  Award,
  ScrollText,
  Building,
  CheckCircle2,
  Calendar,
  User,
  ShieldCheck,
  Stamp,
  Download,
  RotateCcw,
  Sparkles,
  Pencil,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatNamaLingkungan, getAllMasterLingkungan, findLingkunganByQuery } from '@/lib/constants'
import { getPengurusForLingkungan } from '@/lib/pengurusData'
import { createClient } from '@/utils/supabase/client'
import { KepalaKeluarga, AnggotaKeluarga } from '@/lib/types'
import { ensureDummyKksForLingkungan, getDummyAnggotaForKk } from '@/lib/dummyData'

type TabType = 'KOP_SURAT' | 'SAKRAMEN' | 'BERITA_ACARA'

export default function FormStandarPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<TabType>('KOP_SURAT')

  // Lingkungan & Profile State
  const [lingkunganId, setLingkunganId] = useState<string>('')
  const [lingkunganName, setLingkunganName] = useState<string>('')
  const [kkList, setKkList] = useState<KepalaKeluarga[]>([])
  const [anggotaMap, setAnggotaMap] = useState<Record<string, AnggotaKeluarga[]>>({})

  // Load Lingkungan & Data
  useEffect(() => {
    async function init() {
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

      // Load KK and members for autofill
      try {
        const { data: dbKks } = await supabase.from('kepala_keluarga').select('*').eq('lingkungan_id', effId)
        let finalKks = dbKks && dbKks.length > 0 ? dbKks : ensureDummyKksForLingkungan(effId, effNama, [])
        setKkList(finalKks)

        const { data: dbAnggota } = await supabase.from('anggota_keluarga').select('*').in('kk_id', finalKks.map((k) => k.id))
        const aMap: Record<string, AnggotaKeluarga[]> = {}
        finalKks.forEach((k) => {
          let mems = dbAnggota?.filter((a) => a.kk_id === k.id) || []
          if (mems.length === 0) mems = getDummyAnggotaForKk(k)
          aMap[k.id] = mems
        })
        setAnggotaMap(aMap)
      } catch (err) {
        const dummyKks = ensureDummyKksForLingkungan(effId, effNama, [])
        setKkList(dummyKks)
      }
    }

    init()
  }, [])

  // Pengurus Info
  const pengurus = useMemo(() => {
    return getPengurusForLingkungan(lingkunganId || 'default', lingkunganName)
  }, [lingkunganId, lingkunganName])

  // Flat members list for applicant selector
  const allMembers = useMemo(() => {
    const list: { id: string; nama: string; nama_kk: string; peran?: string; alamat?: string }[] = []
    kkList.forEach((kk) => {
      if (kk.nama_kk) {
        list.push({
          id: `kk-${kk.id}`,
          nama: kk.nama_kk,
          nama_kk: kk.nama_kk,
          peran: 'Kepala Keluarga',
          alamat: kk.alamat || undefined,
        })
      }
      const mems = anggotaMap[kk.id] || []
      mems.forEach((m) => {
        if (m.nama && m.nama !== kk.nama_kk) {
          list.push({
            id: m.id,
            nama: m.nama,
            nama_kk: kk.nama_kk,
            peran: m.peran,
            alamat: kk.alamat || undefined,
          })
        }
      })
    })
    return list.sort((a, b) => a.nama.localeCompare(b.nama))
  }, [kkList, anggotaMap])

  // TAB 1: KOP & SURAT STATE
  const [suratNomor, setSuratNomor] = useState('014/SKR-LKG/SC/IX/2026')
  const [suratPerihal, setSuratPerihal] = useState('Surat Pengantar Administrasi Lingkungan')
  const [suratLampiran, setSuratLampiran] = useState('1 (Satu) Berkas')
  const [suratTanggal, setSuratTanggal] = useState('Bekasi, 20 September 2026')
  const [suratTujuan, setSuratTujuan] = useState('Yth. Pastor Kepala Paroki Santa Clara\nBekasi Utara')
  const [suratIsi, setSuratIsi] = useState(
    'Dengan hormat,\n\nBersama surat ini, kami Dewan Pengurus Lingkungan menerangkan dengan sebenarnya bahwa warga yang bersangkutan adalah umat Katolik yang berdomisili dan aktif dalam persekutuan doa serta kegiatan di lingkungan kami.\n\nSurat pengantar ini diterbitkan sebagai kelengkapan berkas administrasi gerejawi. Demikian surat pengantar ini kami sampaikan, atas perhatian dan kerja sama Romo serta Sekretariat Paroki kami ucapkan terima kasih.\n\nBerkah Dalem,'
  )

  // TAB 2: PELAYANAN SAKRAMEN STATE
  const [sakramenType, setSakramenType] = useState('BAPTIS_BAYI')
  const [sakramenNama, setSakramenNama] = useState('')
  const [sakramenNamaKk, setSakramenNamaKk] = useState('')
  const [sakramenTempatLahir, setSakramenTempatLahir] = useState('Bekasi, 12 Agustus 2025')
  const [sakramenAlamat, setSakramenAlamat] = useState('')
  const [sakramenNamaAyah, setSakramenNamaAyah] = useState('')
  const [sakramenNamaIbu, setSakramenNamaIbu] = useState('')
  const [sakramenWaliBaptis, setSakramenWaliBaptis] = useState('Bpk. Yohanes Paulus')
  const [sakramenCatatan, setSakramenCatatan] = useState('Telah mengikuti rekoleksi dan pembekalan orang tua & wali baptis.')

  const handleSelectMemberForSakramen = (memberId: string) => {
    const mem = allMembers.find((m) => m.id === memberId)
    if (mem) {
      setSakramenNama(mem.nama)
      setSakramenNamaKk(mem.nama_kk)
      if (mem.alamat) setSakramenAlamat(mem.alamat)
      setSakramenNamaAyah(mem.nama_kk)
    }
  }

  // TAB 3: BERITA ACARA STATE
  const [baType, setBaType] = useState('SERAH_TERIMA_JABATAN')
  const [baHariTanggal, setBaHariTanggal] = useState('Minggu, 20 September 2026')
  const [baTempat, setBaTempat] = useState('Ruang Rapat Lingkungan St. Clara')
  const [baPihak1, setBaPihak1] = useState(pengurus.ketua_nama || 'FX Wisnu Ardianto')
  const [baJabatan1, setBaJabatan1] = useState('Ketua Lingkungan Periode Demisioner')
  const [baPihak2, setBaPihak2] = useState('Petrus Stefanus Wijaya')
  const [baJabatan2, setBaJabatan2] = useState('Ketua Lingkungan Terpilih Periode Baru')
  const [baSaksi1, setBaSaksi1] = useState(pengurus.sekretaris_nama || 'Ignatius Sugeng')
  const [baSaksi2, setBaSaksi2] = useState(pengurus.bendahara_nama || 'Maria Bernadette')
  const [baPoinKeputusan, setBaPoinKeputusan] = useState(
    '1. Pihak Pertama telah menyerahkan seluruh inventaris aset fisik lingkungan dan buku kas keuangan dalam keadaan lengkap.\n2. Saldo kas riil saat serah terima adalah sebesar kas tercatat dan telah diverifikasi bersama seluruh tim formatur.\n3. Pihak Kedua resmi mengemban tugas pastoral terhitung sejak penandatanganan berita acara ini.'
  )

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* CSS KHUSUS PRINT A4 CLEAN */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-document-area, #print-document-area * {
            visibility: visible;
          }
          #print-document-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 30px;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs no-print">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F6EFE2] text-[#5A4423] border border-[#A9834F]/30 font-serif">
            <Stamp className="w-3.5 h-3.5 text-[#A9834F]" />
            Sekretariat Lingkungan
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 font-serif">
            <FileText className="w-6 h-6 text-emerald-600" />
            Form Standar Administrasi Sekretariat
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Kop surat resmi, template formulir pelayanan sakramen, dan berita acara lingkungan siap cetak dokumen A4
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            onClick={handlePrint}
            size="sm"
            className="bg-[#16233F] hover:bg-[#22335A] text-white rounded-xl text-xs font-bold cursor-pointer h-10 px-4 shadow-sm flex items-center gap-2"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            Cetak Dokumen Resmi (PDF / A4)
          </Button>
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 no-print overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('KOP_SURAT')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shrink-0 ${
            activeTab === 'KOP_SURAT'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building className="w-4 h-4" />
          1. Kop Surat & Surat Pengantar
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SAKRAMEN')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shrink-0 ${
            activeTab === 'SAKRAMEN'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Award className="w-4 h-4" />
          2. Formulir Pelayanan Sakramen
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('BERITA_ACARA')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shrink-0 ${
            activeTab === 'BERITA_ACARA'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ScrollText className="w-4 h-4" />
          3. Berita Acara Resmi
        </button>
      </div>

      {/* MAIN TWO-COLUMN WORKSPACE: LEFT EDITOR, RIGHT LIVE PREVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: FORM SETTINGS & CONTROLS (NO-PRINT) */}
        <div className="lg:col-span-5 space-y-4 no-print">
          {/* TAB 1 CONTROLS */}
          {activeTab === 'KOP_SURAT' && (
            <Card className="bg-white border-slate-200 rounded-2xl shadow-xs">
              <CardHeader className="p-4 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-emerald-600" />
                  Editor Surat Resmi Lingkungan
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Sesuaikan perihal, nomor surat, dan isi surat keluar
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Nomor Surat</Label>
                  <Input
                    value={suratNomor}
                    onChange={(e) => setSuratNomor(e.target.value)}
                    className="h-9 text-xs bg-white border-slate-300 font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700">Lampiran</Label>
                    <Input
                      value={suratLampiran}
                      onChange={(e) => setSuratLampiran(e.target.value)}
                      className="h-9 text-xs bg-white border-slate-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700">Tempat & Tanggal</Label>
                    <Input
                      value={suratTanggal}
                      onChange={(e) => setSuratTanggal(e.target.value)}
                      className="h-9 text-xs bg-white border-slate-300"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Perihal / Hal</Label>
                  <Input
                    value={suratPerihal}
                    onChange={(e) => setSuratPerihal(e.target.value)}
                    className="h-9 text-xs bg-white border-slate-300 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Tujuan Surat (Kepada Yth.)</Label>
                  <textarea
                    rows={2}
                    value={suratTujuan}
                    onChange={(e) => setSuratTujuan(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Isi Naskah Surat</Label>
                  <textarea
                    rows={8}
                    value={suratIsi}
                    onChange={(e) => setSuratIsi(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed font-sans"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 2 CONTROLS */}
          {activeTab === 'SAKRAMEN' && (
            <Card className="bg-white border-slate-200 rounded-2xl shadow-xs">
              <CardHeader className="p-4 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-600" />
                  Pengaturan Formulir Sakramen
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Pilih jenis sakramen dan pilih umat untuk isi data instan
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Jenis Pelayanan Sakramen</Label>
                  <Select value={sakramenType} onValueChange={(val) => val && setSakramenType(val)}>
                    <SelectTrigger className="h-9 text-xs bg-white border-slate-300 font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-slate-900 border-slate-200">
                      <SelectItem value="BAPTIS_BAYI">Sakramen Baptis Bayi / Anak</SelectItem>
                      <SelectItem value="BAPTIS_DEWASA">Sakramen Baptis Dewasa / Krisma</SelectItem>
                      <SelectItem value="KOMUNI_PERTAMA">Sakramen Ekaristi / Komuni Pertama</SelectItem>
                      <SelectItem value="PERKAWINAN">Penyelidikan Kanonik Perkawinan</SelectItem>
                      <SelectItem value="PENGURAPAN_ORANG_SAKIT">Sakramen Pengurapan Orang Sakit (Viaticum)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Auto-fill from Lingkungan members */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-slate-500" />
                    Tarik Otomatis dari Data Umat Lingkungan:
                  </Label>
                  <Select onValueChange={(val) => { if (val) handleSelectMemberForSakramen(String(val)) }}>
                    <SelectTrigger className="h-8 text-xs bg-white border-slate-300 text-slate-800">
                      <SelectValue placeholder="-- Pilih nama pemohon sakramen --" />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-slate-900 border-slate-200 max-h-56">
                      {allMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.nama} ({m.peran || 'Umat'} • KK: {m.nama_kk})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Nama Calon Penerima Sakramen</Label>
                  <Input
                    value={sakramenNama}
                    onChange={(e) => setSakramenNama(e.target.value)}
                    placeholder="Contoh: Maria Gabriella Putri"
                    className="h-9 text-xs bg-white border-slate-300 font-bold text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700">Tempat & Tgl Lahir</Label>
                    <Input
                      value={sakramenTempatLahir}
                      onChange={(e) => setSakramenTempatLahir(e.target.value)}
                      className="h-9 text-xs bg-white border-slate-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700">Nama Kepala Keluarga</Label>
                    <Input
                      value={sakramenNamaKk}
                      onChange={(e) => setSakramenNamaKk(e.target.value)}
                      className="h-9 text-xs bg-white border-slate-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700">Nama Ayah Kandung</Label>
                    <Input
                      value={sakramenNamaAyah}
                      onChange={(e) => setSakramenNamaAyah(e.target.value)}
                      placeholder="Ayah..."
                      className="h-9 text-xs bg-white border-slate-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700">Nama Ibu Kandung</Label>
                    <Input
                      value={sakramenNamaIbu}
                      onChange={(e) => setSakramenNamaIbu(e.target.value)}
                      placeholder="Ibu..."
                      className="h-9 text-xs bg-white border-slate-300"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Alamat Tempat Tinggal</Label>
                  <Input
                    value={sakramenAlamat}
                    onChange={(e) => setSakramenAlamat(e.target.value)}
                    placeholder="Contoh: Jl. Duta Harapan Blok B3 No. 12"
                    className="h-9 text-xs bg-white border-slate-300"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Nama Wali Baptis / Saksi</Label>
                  <Input
                    value={sakramenWaliBaptis}
                    onChange={(e) => setSakramenWaliBaptis(e.target.value)}
                    placeholder="Nama wali rohani..."
                    className="h-9 text-xs bg-white border-slate-300"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Catatan Rekomendasi</Label>
                  <textarea
                    rows={2}
                    value={sakramenCatatan}
                    onChange={(e) => setSakramenCatatan(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 3 CONTROLS */}
          {activeTab === 'BERITA_ACARA' && (
            <Card className="bg-white border-slate-200 rounded-2xl shadow-xs">
              <CardHeader className="p-4 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-emerald-600" />
                  Editor Berita Acara Lingkungan
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Format resmi pengesahan serah terima jabatan, rapat, atau pemilihan ketua
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Jenis Berita Acara</Label>
                  <Select value={baType} onValueChange={(val) => val && setBaType(val)}>
                    <SelectTrigger className="h-9 text-xs bg-white border-slate-300 font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-slate-900 border-slate-200">
                      <SelectItem value="SERAH_TERIMA_JABATAN">Serah Terima Jabatan Pengurus (DPL)</SelectItem>
                      <SelectItem value="PEMILIHAN_KETUA">Hasil Pemilihan Ketua Lingkungan Baru</SelectItem>
                      <SelectItem value="RAPAT_PLENO">Musyawarah Warga & Verifikasi Keuangan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700">Hari & Tanggal</Label>
                    <Input
                      value={baHariTanggal}
                      onChange={(e) => setBaHariTanggal(e.target.value)}
                      className="h-9 text-xs bg-white border-slate-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700">Tempat Pelaksanaan</Label>
                    <Input
                      value={baTempat}
                      onChange={(e) => setBaTempat(e.target.value)}
                      className="h-9 text-xs bg-white border-slate-300"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="font-bold text-slate-800">Para Pihak / Pejabat:</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-500">Nama Pihak Pertama</Label>
                      <Input
                        value={baPihak1}
                        onChange={(e) => setBaPihak1(e.target.value)}
                        className="h-8 text-xs bg-white border-slate-300 font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-500">Jabatan Pihak 1</Label>
                      <Input
                        value={baJabatan1}
                        onChange={(e) => setBaJabatan1(e.target.value)}
                        className="h-8 text-xs bg-white border-slate-300"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-500">Nama Pihak Kedua</Label>
                      <Input
                        value={baPihak2}
                        onChange={(e) => setBaPihak2(e.target.value)}
                        className="h-8 text-xs bg-white border-slate-300 font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-500">Jabatan Pihak 2</Label>
                      <Input
                        value={baJabatan2}
                        onChange={(e) => setBaJabatan2(e.target.value)}
                        className="h-8 text-xs bg-white border-slate-300"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700">Nama Saksi 1</Label>
                    <Input
                      value={baSaksi1}
                      onChange={(e) => setBaSaksi1(e.target.value)}
                      className="h-8 text-xs bg-white border-slate-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700">Nama Saksi 2</Label>
                    <Input
                      value={baSaksi2}
                      onChange={(e) => setBaSaksi2(e.target.value)}
                      className="h-8 text-xs bg-white border-slate-300"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Poin Kesepakatan / Putusan</Label>
                  <textarea
                    rows={5}
                    value={baPoinKeputusan}
                    onChange={(e) => setBaPoinKeputusan(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none font-sans"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN: LIVE PREVIEW & OFFICIAL PRINT SHEET (A4 FORMAT) */}
        <div className="lg:col-span-7">
          <div
            id="print-document-area"
            className="bg-white rounded-2xl border border-slate-200/90 shadow-lg p-8 sm:p-12 space-y-6 text-slate-900 font-serif min-h-[800px]"
          >
            {/* KOP SURAT RESMI RESMI GEREJA & LINGKUNGAN */}
            <div className="border-b-4 border-double border-slate-900 pb-3">
              <div className="flex items-center justify-between gap-4">
                <img
                  src="/logo-st-clara.jpg"
                  alt="Logo Gereja Santa Clara"
                  className="w-20 h-20 rounded-full object-cover border border-slate-300 shrink-0 shadow-xs"
                />
                <div className="text-center flex-1 space-y-0.5">
                  <div className="text-xs font-bold tracking-widest uppercase text-slate-800">
                    KEUSKUPAN AGUNG JAKARTA • DEKANAT BEKASI
                  </div>
                  <div className="text-base sm:text-lg font-black tracking-wide uppercase text-slate-950">
                    PAROKI SANTA CLARA — BEKASI UTARA
                  </div>
                  <div className="text-sm sm:text-base font-extrabold uppercase text-[#A9834F]">
                    PENGURUS {formatNamaLingkungan(lingkunganName).toUpperCase()}
                  </div>
                  <div className="text-[10px] text-slate-600 font-sans italic pt-0.5">
                    Sekretariat: Gereja Santa Clara, Jl. Lingkar Utara RT.001/RW.025, Harapan Baru, Bekasi Utara
                  </div>
                </div>
                <div className="w-20 shrink-0 hidden sm:block"></div>
              </div>
            </div>

            {/* TAB 1 CONTENT: SURAT RESMI */}
            {activeTab === 'KOP_SURAT' && (
              <div className="space-y-6 text-xs text-slate-900 pt-2 font-sans">
                {/* Meta Surat Bar */}
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div>
                      <span className="font-semibold w-20 inline-block font-serif">Nomor</span>: {suratNomor}
                    </div>
                    <div>
                      <span className="font-semibold w-20 inline-block font-serif">Lampiran</span>: {suratLampiran}
                    </div>
                    <div>
                      <span className="font-semibold w-20 inline-block font-serif">Perihal</span>:{' '}
                      <span className="font-bold underline">{suratPerihal}</span>
                    </div>
                  </div>

                  <div className="text-right italic font-medium">{suratTanggal}</div>
                </div>

                {/* Tujuan Surat */}
                <div className="space-y-1 pt-2">
                  <div className="font-semibold font-serif">Kepada Yth.</div>
                  <div className="whitespace-pre-line leading-relaxed font-bold text-slate-900">
                    {suratTujuan}
                  </div>
                </div>

                {/* Isi Surat */}
                <div className="pt-2 whitespace-pre-line leading-relaxed text-justify text-slate-800 text-[13px]">
                  {suratIsi}
                </div>

                {/* Kolom Tanda Tangan */}
                <div className="pt-10 grid grid-cols-2 text-center gap-8">
                  <div className="space-y-16">
                    <div className="font-bold font-serif">
                      Ketua {formatNamaLingkungan(lingkunganName)}
                    </div>
                    <div className="space-y-0.5">
                      <div className="font-bold underline text-slate-950 text-sm">
                        {pengurus.ketua_nama || 'FX Wisnu Ardianto'}
                      </div>
                      <div className="text-[11px] text-slate-500 font-sans">Ketua Lingkungan</div>
                    </div>
                  </div>

                  <div className="space-y-16">
                    <div className="font-bold font-serif">Sekretaris Lingkungan</div>
                    <div className="space-y-0.5">
                      <div className="font-bold underline text-slate-950 text-sm">
                        {pengurus.sekretaris_nama || 'Ignatius Stefanus Sugeng'}
                      </div>
                      <div className="text-[11px] text-slate-500 font-sans">Sekretaris Lingkungan</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2 CONTENT: FORMULIR PELAYANAN SAKRAMEN */}
            {activeTab === 'SAKRAMEN' && (
              <div className="space-y-5 text-xs text-slate-900 pt-1 font-sans">
                <div className="text-center space-y-1 pb-2">
                  <h2 className="text-base sm:text-lg font-black uppercase tracking-wide font-serif underline">
                    SURAT PERMOHONAN PELAYANAN SAKRAMEN
                  </h2>
                  <div className="text-[11px] font-bold text-[#A9834F] uppercase tracking-wider">
                    {sakramenType === 'BAPTIS_BAYI' && 'Sakramen Baptis Bayi / Anak'}
                    {sakramenType === 'BAPTIS_DEWASA' && 'Sakramen Baptis Dewasa / Penerimaan Resmi'}
                    {sakramenType === 'KOMUNI_PERTAMA' && 'Sakramen Komuni Pertama (Ekaristi Maha Kudus)'}
                    {sakramenType === 'PERKAWINAN' && 'Penyelidikan Kanonik Sakramen Perkawinan'}
                    {sakramenType === 'PENGURAPAN_ORANG_SAKIT' && 'Sakramen Pengurapan Orang Sakit (Viaticum)'}
                  </div>
                </div>

                <div className="space-y-2 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <div className="font-bold text-slate-800 font-serif mb-2">A. DATA PRIBADI PEMOHON / UMAT:</div>
                  <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-200">
                    <span className="text-slate-500">Nama Lengkap</span>
                    <span className="col-span-2 font-bold text-slate-950">: {sakramenNama || '— (Belum diisi)'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-200">
                    <span className="text-slate-500">Tempat, Tanggal Lahir</span>
                    <span className="col-span-2">: {sakramenTempatLahir}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-200">
                    <span className="text-slate-500">Nama Kepala Keluarga</span>
                    <span className="col-span-2">: {sakramenNamaKk || '—'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-200">
                    <span className="text-slate-500">Nama Orang Tua (Ayah / Ibu)</span>
                    <span className="col-span-2">: {sakramenNamaAyah || '—'} & {sakramenNamaIbu || '—'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-200">
                    <span className="text-slate-500">Alamat Tempat Tinggal</span>
                    <span className="col-span-2">: {sakramenAlamat || 'Sesuai Data Lingkungan'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-200">
                    <span className="text-slate-500">Nama Wali / Saksi Baptis</span>
                    <span className="col-span-2 font-semibold text-emerald-800">: {sakramenWaliBaptis}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 py-1">
                    <span className="text-slate-500">Lingkungan / Wilayah</span>
                    <span className="col-span-2">: {formatNamaLingkungan(lingkunganName)}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="font-bold text-slate-800 font-serif">B. REKOMENDASI PENGURUS LINGKUNGAN:</div>
                  <p className="text-slate-700 leading-relaxed text-[11px]">
                    {sakramenCatatan}
                  </p>
                </div>

                {/* Signature Grid */}
                <div className="pt-8 grid grid-cols-3 text-center gap-4 text-[11px]">
                  <div className="space-y-14">
                    <div>Pemohon / Orang Tua</div>
                    <div className="font-bold underline text-slate-950">{sakramenNamaAyah || sakramenNama || 'Pemohon'}</div>
                  </div>
                  <div className="space-y-14">
                    <div>Ketua Lingkungan</div>
                    <div className="font-bold underline text-slate-950">{pengurus.ketua_nama || 'FX Wisnu Ardianto'}</div>
                  </div>
                  <div className="space-y-14">
                    <div>Mengetahui Pastor Paroki</div>
                    <div className="font-bold underline text-slate-950">Pastor Paroki St. Clara</div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3 CONTENT: BERITA ACARA */}
            {activeTab === 'BERITA_ACARA' && (
              <div className="space-y-5 text-xs text-slate-900 pt-1 font-sans">
                <div className="text-center space-y-1 pb-1">
                  <h2 className="text-base sm:text-lg font-black uppercase tracking-wide font-serif underline">
                    BERITA ACARA RESMI LINGKUNGAN
                  </h2>
                  <div className="text-[11px] font-bold text-[#A9834F] uppercase tracking-wider">
                    Nomor: BA-{Date.now().toString().slice(-6)}/{formatNamaLingkungan(lingkunganName).replace(/\s+/g, '-').toUpperCase()}/2026
                  </div>
                </div>

                <p className="leading-relaxed text-justify text-slate-800">
                  Pada hari ini <strong>{baHariTanggal}</strong>, bertempat di <strong>{baTempat}</strong>, 
                  telah diselenggarakan acara resmi <strong>{baType.replace(/_/g, ' ')}</strong> untuk 
                  <strong> {formatNamaLingkungan(lingkunganName)}</strong>, Paroki Santa Clara Bekasi Utara, oleh dan antara:
                </p>

                <div className="space-y-2 border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                  <div className="grid grid-cols-3 gap-1">
                    <span className="font-bold text-slate-700">1. PIHAK PERTAMA</span>
                    <span className="col-span-2 font-bold text-slate-950">: {baPihak1} ({baJabatan1})</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="font-bold text-slate-700">2. PIHAK KEDUA</span>
                    <span className="col-span-2 font-bold text-slate-950">: {baPihak2} ({baJabatan2})</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="font-bold text-slate-900 font-serif">POIN KESEPAKATAN DAN PUTUSAN:</div>
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl whitespace-pre-line leading-relaxed text-slate-800">
                    {baPoinKeputusan}
                  </div>
                </div>

                <p className="leading-relaxed text-justify text-slate-600 text-[11px] italic">
                  Demikian Berita Acara ini dibuat dan ditandatangani dengan penuh kesadaran dan tanggung jawab demi 
                  kemuliaan Tuhan dan pelayanan umat di Lingkungan Santa Clara.
                </p>

                {/* Signatures */}
                <div className="pt-6 grid grid-cols-2 text-center gap-6">
                  <div className="space-y-12">
                    <div>Pihak Pertama</div>
                    <div className="font-bold underline text-slate-950">{baPihak1}</div>
                  </div>
                  <div className="space-y-12">
                    <div>Pihak Kedua</div>
                    <div className="font-bold underline text-slate-950">{baPihak2}</div>
                  </div>
                </div>

                <div className="pt-2 grid grid-cols-2 text-center gap-6 border-t border-slate-100">
                  <div className="space-y-12">
                    <div>Saksi I (Sekretaris)</div>
                    <div className="font-bold underline text-slate-800">{baSaksi1}</div>
                  </div>
                  <div className="space-y-12">
                    <div>Saksi II (Bendahara)</div>
                    <div className="font-bold underline text-slate-800">{baSaksi2}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
