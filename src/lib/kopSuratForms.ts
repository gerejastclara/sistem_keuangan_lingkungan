export type FormCategory = 'SEMUA' | 'PENGANTAR' | 'SAKRAMEN' | 'DATA_KK' | 'LITURGI_INTERNAL'

export interface FormItemDef {
  id: string
  code: string
  title: string
  shortTitle: string
  category: 'PENGANTAR' | 'SAKRAMEN' | 'DATA_KK' | 'LITURGI_INTERNAL'
  pdfFileName?: string
  description: string
  syarat: string[]
  defaultKopType: 'PAROKI' | 'LINGKUNGAN' | 'KATEKESE'
  fields: {
    key: string
    label: string
    type: 'text' | 'date' | 'select' | 'textarea' | 'radio'
    placeholder?: string
    options?: string[]
    defaultValue?: string
    gridSpan?: 1 | 2
    autoFillKey?: 'nama' | 'nama_kk' | 'alamat' | 'tgl_lahir' | 'nama_ayah' | 'nama_ibu' | 'nik'
  }[]
}

export const KOP_SURAT_FORMS: FormItemDef[] = [
  // --- KATEGORI 1: SURAT PENGANTAR & DOKUMEN LINGKUNGAN ---
  {
    id: 'FORM10A',
    code: 'F-KAJ-2017-PL/010a',
    title: 'SURAT PENGANTAR LINGKUNGAN UMUM',
    shortTitle: 'Form 10a - Surat Pengantar Umum',
    category: 'PENGANTAR',
    pdfFileName: 'FORM10a - SURAT PENGANTAR LINGKUNGAN UMUM.pdf',
    description: 'Surat pengantar resmi dari Ketua Lingkungan kepada Sekretariat Paroki Santa Clara untuk keperluan administrasi umum warga.',
    syarat: [
      'Warga berdomisili sah di lingkungan Paroki Santa Clara',
      'Terdaftar dalam Kartu Keluarga Lingkungan / BIDUK KAJ',
      'Ditandatangani oleh Ketua Lingkungan dengan mencantumkan nama jelas',
    ],
    defaultKopType: 'LINGKUNGAN',
    fields: [
      { key: 'nama_lengkap', label: 'Nama Lengkap Umat', type: 'text', placeholder: 'Nama lengkap sesuai KTP/Surat Baptis', autoFillKey: 'nama', gridSpan: 2 },
      { key: 'tempat_tgl_lahir', label: 'Tempat, Tgl Lahir', type: 'text', placeholder: 'Bekasi, 15 Januari 1995', autoFillKey: 'tgl_lahir' },
      { key: 'nama_ortu', label: 'Nama Orang Tua / Pasangan', type: 'text', placeholder: 'Nama Ayah / Ibu / Pasangan', autoFillKey: 'nama_ayah' },
      { key: 'alamat', label: 'Alamat Tinggal', type: 'text', placeholder: 'Jl. Harapan Indah Blok...', autoFillKey: 'alamat', gridSpan: 2 },
      { key: 'keperluan', label: 'Keperluan Pembuatan Surat', type: 'textarea', placeholder: 'Menerangkan keperluan umat (misal: pengantar nikah catatan sipil, beasiswa pendidikan, administrasi yayasan, dll.)', defaultValue: 'Pengurusan administrasi gerejawi / rekomendasi ke Sekretariat Paroki Santa Clara Bekasi Utara.', gridSpan: 2 },
    ]
  },
  {
    id: 'FORM09',
    code: 'FSakr-KAJ-2017-PW/002',
    title: 'SURAT PENGANTAR LINGKUNGAN KEPERLUAN PERSIAPAN PERKAWINAN KATOLIK',
    shortTitle: 'Form 09 - Pengantar Perkawinan',
    category: 'PENGANTAR',
    pdfFileName: 'FORM09 - SURAT PENGANTAR LINGKUNGAN KEPERLUAN PERSIAPAN PERKAWINAN KATOLIK.pdf',
    description: 'Pengantar dari Ketua Lingkungan untuk permohonan Penyelidikan Kanonik dan persiapan penerimaan Sakramen Perkawinan di Paroki.',
    syarat: [
      'Warga Katolik terdaftar di Lingkungan yang bersangkutan',
      'Membawa fotokopi Surat Baptis terbaru (maksimal 6 bulan)',
      'Fotokopi Sertifikat Kursus Membangun Rumah Tangga (MRT)',
      'Status bebas nikah (status liber) telah diverifikasi Ketua Lingkungan',
    ],
    defaultKopType: 'LINGKUNGAN',
    fields: [
      { key: 'nomor_surat', label: 'Nomor Surat Lingkungan', type: 'text', placeholder: '012/SPL-PW/SC/IX/2026', defaultValue: '012/SPL-PW/SC/IX/2026' },
      { key: 'nama_calon', label: 'Nama Lengkap Calon Mempelai', type: 'text', placeholder: 'Nama calon mempelai dari lingkungan', autoFillKey: 'nama', gridSpan: 2 },
      { key: 'tempat_tgl_lahir', label: 'Tempat, Tgl Lahir', type: 'text', placeholder: 'Bekasi, 20 Oktober 1996', autoFillKey: 'tgl_lahir' },
      { key: 'alamat', label: 'Alamat Tinggal', type: 'text', placeholder: 'Alamat lengkap domisili', autoFillKey: 'alamat', gridSpan: 2 },
      { key: 'nama_pasangan', label: 'Nama Calon Pasangan (Suami/Istri)', type: 'text', placeholder: 'Nama lengkap calon pasangan' },
      { key: 'asal_pasangan', label: 'Asal Paroki / Agama Calon Pasangan', type: 'text', placeholder: 'Contoh: Paroki St. Arnoldus Bekasi / Katolik' },
      { key: 'rencana_tgl_nikah', label: 'Rencana Tanggal Pernikahan', type: 'text', placeholder: 'Contoh: 18 Oktober 2026 di Gereja Santa Clara' },
      { key: 'catatan_status', label: 'Keterangan Status Warga', type: 'textarea', placeholder: 'Keterangan tambahan Ketua Lingkungan', defaultValue: 'Yang bersangkutan adalah benar warga aktif di lingkungan kami dan sepanjang pengetahuan kami belum pernah menikah baik secara sipil maupun secara gereja (status liber).', gridSpan: 2 }
    ]
  },
  {
    id: 'FORM10',
    code: 'FSakr-KAJ-2017-PW/003',
    title: 'SURAT KETERANGAN DOMISILI UNTUK PERKAWINAN',
    shortTitle: 'Form 10 - Keterangan Domisili Nikah',
    category: 'PENGANTAR',
    pdfFileName: 'FORM10 - SURAT KETERANGAN DOMISILI UNTUK PERKAWINAN.pdf',
    description: 'Surat keterangan domisili resmi lingkungan untuk lampiran berkas kanonik perkawinan gereja.',
    syarat: [
      'Terdaftar dan bertempat tinggal nyata di lingkungan',
      'Fotokopi KTP dan Kartu Keluarga',
    ],
    defaultKopType: 'LINGKUNGAN',
    fields: [
      { key: 'nama_mempelai', label: 'Nama Lengkap', type: 'text', placeholder: 'Nama lengkap', autoFillKey: 'nama', gridSpan: 2 },
      { key: 'tempat_tgl_lahir', label: 'Tempat, Tgl Lahir', type: 'text', placeholder: 'Tempat, Tgl Lahir', autoFillKey: 'tgl_lahir' },
      { key: 'agama', label: 'Agama', type: 'text', defaultValue: 'Katolik' },
      { key: 'pekerjaan', label: 'Pekerjaan', type: 'text', placeholder: 'Karyawan Swasta / Wiraswasta' },
      { key: 'alamat', label: 'Alamat Domisili Sekarang', type: 'text', placeholder: 'Alamat lengkap', autoFillKey: 'alamat', gridSpan: 2 },
      { key: 'lama_domisili', label: 'Lama Berdomisili', type: 'text', defaultValue: '5 (lima) tahun' },
      { key: 'status_perkawinan', label: 'Status Perkawinan', type: 'text', defaultValue: 'Belum Pernah Menikah (Jejaka / Perawan)' }
    ]
  },
  {
    id: 'FORM05',
    code: 'FSakr-KAJ-2017-B/005',
    title: 'SURAT PERNYATAAN MEMBERI IZIN ANAK UNTUK MENIKAH SECARA KATOLIK',
    shortTitle: 'Form 05 - Izin Ortu Nikah Katolik',
    category: 'PENGANTAR',
    pdfFileName: 'FORM05 - PERNYATAAN MEMBERI IZIN ANAK UNTUK MENIKAH SECARA KATOLIK.pdf',
    description: 'Surat pernyataan izin dari orang tua/wali bagi anak yang melangsungkan perkawinan secara Gereja Katolik.',
    syarat: [
      'Surat pernyataan orang tua/wali',
      'Meterai secukupnya (Rp 10.000,-)',
      'Fotokopi KTP orang tua dan calon mempelai',
    ],
    defaultKopType: 'PAROKI',
    fields: [
      { key: 'nama_ortu', label: 'Nama Lengkap Orang Tua / Wali', type: 'text', placeholder: 'Nama orang tua/wali pemberi izin', autoFillKey: 'nama_kk', gridSpan: 2 },
      { key: 'agama_ortu', label: 'Agama Orang Tua', type: 'text', defaultValue: 'Katolik' },
      { key: 'alamat_ortu', label: 'Alamat Orang Tua', type: 'text', placeholder: 'Alamat lengkap orang tua', autoFillKey: 'alamat', gridSpan: 2 },
      { key: 'nama_anak', label: 'Nama Anak yang Diberi Izin', type: 'text', placeholder: 'Nama lengkap anak', autoFillKey: 'nama', gridSpan: 2 },
      { key: 'nama_calon_pasangan', label: 'Nama Calon Menantu (Pasangan)', type: 'text', placeholder: 'Nama calon pasangan anak', gridSpan: 2 },
      { key: 'pernyataan_izin', label: 'Isi Pernyataan', type: 'textarea', defaultValue: 'Dengan sukarela dan tanpa paksaan dari pihak manapun memberi izin kepada anak kami tersebut di atas untuk melangsungkan perkawinan secara sah menurut tata cara GEREJA KATOLIK.', gridSpan: 2 }
    ]
  },
  {
    id: 'FORM05A',
    code: 'FSakr-KAJ-2017-B/005a',
    title: 'SURAT PERNYATAAN MEMBERI IZIN ANAK UNTUK MENJADI KATOLIK',
    shortTitle: 'Form 05a - Izin Anak Menjadi Katolik',
    category: 'PENGANTAR',
    pdfFileName: 'FORM05a - PERNYATAAN MEMBERI IZIN ANAK UNTUK MENJADI KATOLIK.pdf',
    description: 'Pernyataan resmi orang tua/wali memberi izin kepada anak di bawah umur untuk dibaptis/diterima ke dalam Gereja Katolik.',
    syarat: [
      'Pernyataan orang tua kandung / wali yang sah',
      'Fotokopi Kartu Keluarga dan Akta Lahir Anak',
    ],
    defaultKopType: 'PAROKI',
    fields: [
      { key: 'nama_ortu', label: 'Nama Orang Tua / Wali', type: 'text', placeholder: 'Nama orang tua', autoFillKey: 'nama_kk', gridSpan: 2 },
      { key: 'agama_ortu', label: 'Agama Orang Tua', type: 'text', placeholder: 'Agama orang tua' },
      { key: 'alamat_ortu', label: 'Alamat Orang Tua', type: 'text', placeholder: 'Alamat', autoFillKey: 'alamat', gridSpan: 2 },
      { key: 'nama_anak', label: 'Nama Anak', type: 'text', placeholder: 'Nama anak yang diberi izin', autoFillKey: 'nama', gridSpan: 2 },
      { key: 'tgl_lahir_anak', label: 'Tempat, Tgl Lahir Anak', type: 'text', placeholder: 'Tempat, tgl lahir anak', autoFillKey: 'tgl_lahir' },
      { key: 'pernyataan_izin', label: 'Pernyataan Izin', type: 'textarea', defaultValue: 'Menyatakan tidak keberatan dan memberi izin sepenuhnya kepada anak kami untuk menerima Sakramen Inisiasi / Baptis dan dididik dalam iman Gereja Katolik.', gridSpan: 2 }
    ]
  },
  {
    id: 'SURAT_DINAS',
    code: 'SKR-SC-DINAS/2026',
    title: 'SURAT DINAS KELUAR RESMI LINGKUNGAN',
    shortTitle: 'Kop Surat Bebas Lingkungan',
    category: 'PENGANTAR',
    description: 'Format surat keluar naskah bebas pengurus lingkungan dengan kop surat standar Gereja Santa Clara.',
    syarat: ['Surat resmi lingkungan untuk keperluan intern maupun ekstern'],
    defaultKopType: 'LINGKUNGAN',
    fields: [
      { key: 'nomor_surat', label: 'Nomor Surat', type: 'text', defaultValue: '018/SKR-LKG/SC/IX/2026' },
      { key: 'lampiran', label: 'Lampiran', type: 'text', defaultValue: '1 (Satu) Berkas' },
      { key: 'perihal', label: 'Perihal / Hal', type: 'text', defaultValue: 'Permohonan / Pemberitahuan Administrasi Lingkungan', gridSpan: 2 },
      { key: 'tujuan', label: 'Tujuan Surat (Kepada Yth.)', type: 'textarea', defaultValue: 'Yth. Pastor Rekan & Sekretariat Paroki Santa Clara\nBekasi Utara', gridSpan: 2 },
      { key: 'isi_naskah', label: 'Isi Naskah Surat', type: 'textarea', defaultValue: 'Dengan hormat,\n\nBersama ini kami Pengurus Lingkungan menyampaikan laporan dan permohonan terkait kegiatan pelayanan umat di lingkungan kami.\n\nDemikian surat ini kami sampaikan, atas perhatian dan kerja sama Romo serta rekan pengurus kami ucapkan terima kasih.\n\nBerkah Dalem,', gridSpan: 2 },
    ]
  },
  {
    id: 'BERITA_ACARA',
    code: 'BA-DPL-SC/2026',
    title: 'BERITA ACARA RESMI LINGKUNGAN',
    shortTitle: 'Berita Acara Lingkungan',
    category: 'PENGANTAR',
    description: 'Dokumen pengesahan serah terima jabatan pengurus lingkungan, pemilihan ketua, atau rapat musyawarah warga.',
    syarat: ['Ditandatangani oleh para pihak dan saksi dewan pengurus lingkungan'],
    defaultKopType: 'LINGKUNGAN',
    fields: [
      { key: 'jenis_acara', label: 'Jenis Kegiatan / Acara', type: 'select', options: ['Serah Terima Jabatan Dewan Pengurus Lingkungan (DPL)', 'Hasil Pemilihan Ketua Lingkungan Baru', 'Rapat Pleno Musyawarah Warga & Keuangan'], defaultValue: 'Serah Terima Jabatan Dewan Pengurus Lingkungan (DPL)', gridSpan: 2 },
      { key: 'hari_tanggal', label: 'Hari & Tanggal Pelaksanaan', type: 'text', defaultValue: 'Minggu, 20 September 2026' },
      { key: 'tempat', label: 'Tempat Pelaksanaan', type: 'text', defaultValue: 'Gereja Santa Clara / Rumah Warga Lingkungan' },
      { key: 'pihak1_nama', label: 'Nama Pihak Pertama', type: 'text', defaultValue: 'FX Wisnu Ardianto' },
      { key: 'pihak1_jabatan', label: 'Jabatan Pihak Pertama', type: 'text', defaultValue: 'Ketua Lingkungan Demisioner' },
      { key: 'pihak2_nama', label: 'Nama Pihak Kedua', type: 'text', defaultValue: 'Petrus Stefanus Wijaya' },
      { key: 'pihak2_jabatan', label: 'Jabatan Pihak Kedua', type: 'text', defaultValue: 'Ketua Lingkungan Terpilih' },
      { key: 'saksi1', label: 'Saksi 1 (Sekretaris)', type: 'text', defaultValue: 'Ignatius Sugeng' },
      { key: 'saksi2', label: 'Saksi 2 (Bendahara)', type: 'text', defaultValue: 'Maria Bernadette' },
      { key: 'poin_keputusan', label: 'Poin Kesepakatan / Hasil Keputusan', type: 'textarea', defaultValue: '1. Pihak Pertama menyerahkan seluruh arsip dan inventaris lingkungan kepada Pihak Kedua.\n2. Saldo kas keuangan lingkungan telah diverifikasi bersama tim pemeriksa dan diserahkan dalam keadaan lengkap dan seimbang.\n3. Pihak Kedua resmi mengemban tugas pelayanan terhitung sejak penandatanganan berita acara ini.', gridSpan: 2 }
    ]
  },

  // --- KATEGORI 2: PELAYANAN SAKRAMEN & INISIASI KATOLIK ---
  {
    id: 'FORM01',
    code: 'FSakr-KAJ-2017-B/001',
    title: 'FORMULIR SAKRAMEN BAPTIS BAYI / ANAK',
    shortTitle: 'Form 01 - Baptis Bayi / Anak',
    category: 'SAKRAMEN',
    pdfFileName: 'FORM01_-_SAKRAMEN_BAPTIS_BAYI[1] - REV 040525.pdf',
    description: 'Pendaftaran penerimaan Sakramen Baptis untuk bayi dan anak-anak usia maksimal 7 tahun di Paroki Santa Clara.',
    syarat: [
      'Anak berusia maksimal 7 tahun saat pendaftaran',
      'Fotokopi Akta Kelahiran Sipil Anak',
      'Fotokopi Surat Perkawinan Gereja Katolik Orang Tua',
      'Fotokopi Kartu Keluarga Gereja (KK Katolik / BIDUK)',
      'Fotokopi Surat Penguatan / Krisma Wali Baptis Katolik',
      'Orang tua dan wali baptis wajib mengikuti rekoleksi pembekalan baptis',
    ],
    defaultKopType: 'PAROKI',
    fields: [
      { key: 'nama_anak', label: 'Nama Lengkap Calon Baptis', type: 'text', placeholder: 'Nama calon baptis', autoFillKey: 'nama', gridSpan: 2 },
      { key: 'tempat_tgl_lahir', label: 'Tempat, Tanggal Lahir', type: 'text', placeholder: 'Bekasi, 12 Agustus 2025', autoFillKey: 'tgl_lahir' },
      { key: 'nama_baptis', label: 'Nama Baptis yang Dimohon', type: 'text', placeholder: 'Contoh: Maria / Fransiskus / Clara' },
      { key: 'nama_ayah', label: 'Nama Lengkap Ayah Kandung', type: 'text', placeholder: 'Nama Ayah', autoFillKey: 'nama_ayah' },
      { key: 'nama_ibu', label: 'Nama Lengkap Ibu Kandung', type: 'text', placeholder: 'Nama Ibu', autoFillKey: 'nama_ibu' },
      { key: 'alamat', label: 'Alamat Tinggal Orang Tua', type: 'text', placeholder: 'Alamat lengkap', autoFillKey: 'alamat', gridSpan: 2 },
      { key: 'wali_baptis', label: 'Nama Wali Baptis', type: 'text', placeholder: 'Nama wali baptis (telah menerima Sakramen Krisma)' },
      { key: 'paroki_wali', label: 'Paroki Asal Wali Baptis', type: 'text', defaultValue: 'Paroki Santa Clara Bekasi Utara' },
    ]
  },
  {
    id: 'FORM02',
    code: 'FKat-SC-REV.02.25',
    title: 'FORMULIR PENDAFTARAN CALON KATEKUMEN',
    shortTitle: 'Form 02 - Calon Katekumen',
    category: 'SAKRAMEN',
    pdfFileName: 'FORM02 - FORMULIR CALON KATEKUMEN.pdf',
    description: 'Pendaftaran katekumenat bagi calon baptis dewasa melalui Seksi Katekese Paroki Santa Clara.',
    syarat: [
      'Mengikuti masa pembinaan katekumenat minimal 1 tahun',
      'Melampirkan fotokopi KTP / Kartu Identitas',
      'Melampirkan fotokopi Akta Lahir & Surat Nikah (bila sudah menikah)',
      'Kontak Narahubung WA Katekese: 0851-8310-4061 / Sekretariat: 0819-1188-9980',
    ],
    defaultKopType: 'KATEKESE',
    fields: [
      { key: 'nama_calon', label: 'Nama Lengkap Calon Katekumen', type: 'text', placeholder: 'Nama lengkap calon', autoFillKey: 'nama', gridSpan: 2 },
      { key: 'tempat_tgl_lahir', label: 'Tempat, Tanggal Lahir', type: 'text', placeholder: 'Tempat, tgl lahir', autoFillKey: 'tgl_lahir' },
      { key: 'agama_asal', label: 'Agama Sebelumnya', type: 'text', placeholder: 'Kristen Protestan / Islam / Buddha / Hindu / Lainnya' },
      { key: 'status_pernikahan', label: 'Status Perkawinan', type: 'select', options: ['Lajang / Belum Menikah', 'Menikah', 'Cerai Hidup', 'Cerai Mati'], defaultValue: 'Lajang / Belum Menikah' },
      { key: 'alamat', label: 'Alamat Tempat Tinggal', type: 'text', placeholder: 'Alamat tempat tinggal', autoFillKey: 'alamat', gridSpan: 2 },
      { key: 'telepon_wa', label: 'No. Handphone / WhatsApp', type: 'text', placeholder: '0812-xxxx-xxxx' },
      { key: 'alasan_masuk', label: 'Alasan Masuk Agama Katolik', type: 'textarea', defaultValue: 'Kerinduan pribadi untuk mengenal Tuhan Yesus Kristus dan menerima keselamatan dalam persekutuan Gereja Katolik.', gridSpan: 2 }
    ]
  },
  {
    id: 'FORM03',
    code: 'FSakr-KAJ-2017-B/003',
    title: 'FORMULIR BAPTIS DARURAT',
    shortTitle: 'Form 03 - Baptis Darurat',
    category: 'SAKRAMEN',
    pdfFileName: 'FORM03 - BAPTIS DARURAT.pdf',
    description: 'Laporan dan permohonan pembaptisan darurat bagi orang yang sedang berada dalam bahaya maut/kematian.',
    syarat: [
      'Kondisi dalam bahaya kematian fisik / sakit kritis di Rumah Sakit atau Rumah Duka',
      'Dilakukan oleh siapa saja yang bermaksud melakukan apa yang dilakukan Gereja dengan formula Trinitas',
      'Segera dilaporkan ke Sekretariat Paroki setelah kondisi darurat selesai',
    ],
    defaultKopType: 'PAROKI',
    fields: [
      { key: 'nama_dibaptis', label: 'Nama Orang yang Dibaptis', type: 'text', placeholder: 'Nama lengkap', autoFillKey: 'nama', gridSpan: 2 },
      { key: 'nama_baptis', label: 'Nama Baptis yang Diberikan', type: 'text', placeholder: 'Contoh: Yohanes / Maria' },
      { key: 'tempat_baptis', label: 'Tempat Pembaptisan Darurat', type: 'text', placeholder: 'Contoh: RSUD Chasbullah Bekasi, Ruang ICU' },
      { key: 'tgl_baptis', label: 'Hari, Tanggal & Jam Pembaptisan', type: 'text', defaultValue: '20 September 2026, Pukul 14.30 WIB' },
      { key: 'pembaptis', label: 'Nama Pelayan yang Membaptis', type: 'text', placeholder: 'Nama Romo / Suster / Umat yang membaptis' },
      { key: 'saksi_baptis', label: 'Nama Saksi-Saksi', type: 'text', placeholder: 'Nama keluarga atau saksi yang hadir' },
      { key: 'alasan_darurat', label: 'Kondisi Darurat yang Terjadi', type: 'textarea', defaultValue: 'Pasien dalam kondisi kritis penurunan kesadaran akibat sakit berat dan keluarga menghendaki penerimaan sakramen baptis.', gridSpan: 2 }
    ]
  },
  {
    id: 'FORM06',
    code: 'FSakr-KAJ-2017-KP/001',
    title: 'FORMULIR SAKRAMEN KOMUNI PERTAMA',
    shortTitle: 'Form 06 - Komuni Pertama',
    category: 'SAKRAMEN',
    pdfFileName: 'FORM06_-_KOMUNI_PERTAMA[1] - REV 040525.pdf',
    description: 'Pendaftaran penerimaan Sakramen Ekaristi / Komuni Pertama bagi anak-anak di Paroki Santa Clara.',
    syarat: [
      'Minimal usia 10 tahun (kelas 4 SD) saat pendaftaran',
      'Melampirkan fotokopi Surat Baptis Katolik',
      'Melampirkan fotokopi Kartu Keluarga Gereja / BIDUK',
      'Telah mengikuti pelajaran persiapan Komuni Pertama secara lengkap',
      'Wajib menerima Sakramen Rekonsiliasi / Tobat Pertama sebelum hari H',
    ],
    defaultKopType: 'PAROKI',
    fields: [
      { key: 'nama_anak', label: 'Nama Lengkap Anak', type: 'text', placeholder: 'Nama anak', autoFillKey: 'nama', gridSpan: 2 },
      { key: 'tempat_tgl_lahir', label: 'Tempat, Tanggal Lahir', type: 'text', placeholder: 'Bekasi, 10 Mei 2016', autoFillKey: 'tgl_lahir' },
      { key: 'surat_baptis_no', label: 'Nomor Surat Baptis', type: 'text', placeholder: 'Buku Baptis No. SC-...' },
      { key: 'sekolah_kelas', label: 'Sekolah & Kelas', type: 'text', placeholder: 'SDK Strada Bhakti Mandiri, Kelas 4' },
      { key: 'nama_ayah', label: 'Nama Ayah Kandung', type: 'text', placeholder: 'Ayah', autoFillKey: 'nama_ayah' },
      { key: 'nama_ibu', label: 'Nama Ibu Kandung', type: 'text', placeholder: 'Ibu', autoFillKey: 'nama_ibu' },
      { key: 'alamat', label: 'Alamat Rumah', type: 'text', placeholder: 'Alamat tempat tinggal', autoFillKey: 'alamat', gridSpan: 2 },
    ]
  },
  {
    id: 'FORM07',
    code: 'FSakr-KAJ-2017-P/001',
    title: 'FORMULIR SAKRAMEN PENGUATAN (KRISMA)',
    shortTitle: 'Form 07 - Sakramen Krisma',
    category: 'SAKRAMEN',
    pdfFileName: 'FORM07_-_SAKRAMEN_PENGUATAN[1] - REV 040525.pdf',
    description: 'Pendaftaran Sakramen Krisma untuk kedewasaan iman Katolik yang diterimakan oleh Bapa Uskup KAJ.',
    syarat: [
      'Minimal usia 14 tahun (SMP kelas 2 / SMA / Dewasa)',
      'Melampirkan fotokopi Surat Permandian / Baptis Katolik terbaru',
      'Melampirkan fotokopi Surat Komuni Pertama',
      'Wali krisma wajib seorang Katolik yang sudah menerima Sakramen Krisma',
      'Telah lulus evaluasi pembekalan katekese krisma',
    ],
    defaultKopType: 'PAROKI',
    fields: [
      { key: 'nama_calon', label: 'Nama Lengkap Calon Krisma', type: 'text', placeholder: 'Nama calon', autoFillKey: 'nama', gridSpan: 2 },
      { key: 'nama_krisma_dimohon', label: 'Nama Santo/Santa Krisma yang Dipilih', type: 'text', placeholder: 'Contoh: Ignasius Loyola / Teresa Kalkuta' },
      { key: 'tempat_tgl_lahir', label: 'Tempat, Tanggal Lahir', type: 'text', placeholder: 'Tempat, tgl lahir', autoFillKey: 'tgl_lahir' },
      { key: 'wali_krisma', label: 'Nama Wali Krisma', type: 'text', placeholder: 'Nama wali rohani krisma' },
      { key: 'alamat', label: 'Alamat Tempat Tinggal', type: 'text', placeholder: 'Alamat', autoFillKey: 'alamat', gridSpan: 2 },
      { key: 'telepon', label: 'No. Telp / HP', type: 'text', placeholder: '0812-xxxx-xxxx' },
    ]
  },
  {
    id: 'FORM08',
    code: 'FSakr-KAJ-2017-PW/001',
    title: 'FORMULIR PENDAFTARAN PERKAWINAN',
    shortTitle: 'Form 08 - Pendaftaran Nikah',
    category: 'SAKRAMEN',
    pdfFileName: 'FORM08 - PENDAFTARAN PERKAWINAN.pdf',
    description: 'Pendaftaran lengkap penyelidikan kanonik Sakramen Perkawinan Katolik di Paroki Santa Clara.',
    syarat: [
      'Pendaftaran minimal 3 bulan sebelum tanggal perkawinan',
      'Surat Baptis terbaru (maksimal berlaku 6 bulan)',
      'Sertifikat lulus Membangun Rumah Tangga (MRT)',
      'Surat Pengantar Lingkungan (Form 09) & Domisili (Form 10)',
      'Pasfoto berdampingan ukuran 4x6 latar belakang merah (4 lembar)',
      'KTP & Kartu Keluarga kedua calon mempelai',
    ],
    defaultKopType: 'PAROKI',
    fields: [
      { key: 'nama_pria', label: 'Nama Calon Mempelai Pria', type: 'text', placeholder: 'Nama pria', gridSpan: 1 },
      { key: 'agama_pria', label: 'Agama Calon Pria', type: 'text', defaultValue: 'Katolik' },
      { key: 'nama_wanita', label: 'Nama Calon Mempelai Wanita', type: 'text', placeholder: 'Nama wanita', gridSpan: 1 },
      { key: 'agama_wanita', label: 'Agama Calon Wanita', type: 'text', defaultValue: 'Katolik' },
      { key: 'tgl_rencana_nikah', label: 'Rencana Tanggal & Jam Pemberkatan', type: 'text', placeholder: 'Contoh: 14 November 2026, Pukul 10.00 WIB' },
      { key: 'tempat_pemberkatan', label: 'Tempat Pemberkatan Pernikahan', type: 'text', defaultValue: 'Gereja Santa Clara Paroki Bekasi Utara' },
      { key: 'romo_penyelidik', label: 'Pastor yang Melakukan Penyelidikan', type: 'text', defaultValue: 'Pastor Paroki Santa Clara' }
    ]
  },
  {
    id: 'FORM12',
    code: 'FSakr-KAJ-2017-PW/005',
    title: 'FORMULIR MEMBANGUN RUMAH TANGGA (MRT)',
    shortTitle: 'Form 12 - Kursus MRT',
    category: 'SAKRAMEN',
    pdfFileName: 'FORM12 - FORMULIR MEMBANGUN RUMAH TANGGA.pdf',
    description: 'Pendaftaran kursus persiapan perkawinan Katolik Membangun Rumah Tangga (MRT).',
    syarat: [
      'Peserta wajib hadir berpasangan dan mengikuti seluruh sesi secara penuh',
      'Fotokopi KTP kedua calon mempelai',
      'Pasfoto berdampingan ukuran 4x6 (2 lembar)',
    ],
    defaultKopType: 'PAROKI',
    fields: [
      { key: 'nama_pria', label: 'Nama Calon Suami', type: 'text', placeholder: 'Nama pria' },
      { key: 'agama_pria', label: 'Agama Calon Suami', type: 'text', defaultValue: 'Katolik' },
      { key: 'nama_wanita', label: 'Nama Calon Istri', type: 'text', placeholder: 'Nama wanita' },
      { key: 'agama_wanita', label: 'Agama Calon Istri', type: 'text', defaultValue: 'Katolik' },
      { key: 'jadwal_mrt', label: 'Gelombang / Tanggal Kursus MRT', type: 'text', placeholder: 'Contoh: Gelombang III (10-11 Oktober 2026)' },
      { key: 'telepon_kontak', label: 'Nomor Kontak Pasangan', type: 'text', placeholder: '0812-xxxx-xxxx' },
    ]
  },
  {
    id: 'FORM14',
    code: 'FSakr-KAJ-2017-PW/007',
    title: 'FORMULIR PEMBERESAN / PENYEGARAN PERKAWINAN KATOLIK',
    shortTitle: 'Form 14 - Pemberesan Perkawinan',
    category: 'SAKRAMEN',
    pdfFileName: 'FORM14 - FORMULIR PEMBAHARUAN PERKAWINAN.pdf',
    description: 'Permohonan convalidatio (pemberesan/peneguhan kanonik) pernikahan sipil atau pembaruan janji perkawinan suci.',
    syarat: [
      'Fotokopi Akta Nikah Catatan Sipil',
      'Surat Pengantar dari Ketua Lingkungan',
      'Fotokopi Surat Baptis para pihak',
    ],
    defaultKopType: 'PAROKI',
    fields: [
      { key: 'nama_suami', label: 'Nama Lengkap Suami', type: 'text', placeholder: 'Nama suami', autoFillKey: 'nama_kk' },
      { key: 'nama_istri', label: 'Nama Lengkap Istri', type: 'text', placeholder: 'Nama istri' },
      { key: 'tgl_nikah_sipil', label: 'Tanggal & Tempat Nikah Sipil', type: 'text', placeholder: 'Bekasi, 12 Juli 2018 (Catatan Sipil Kota Bekasi)' },
      { key: 'alasan_pemberesan', label: 'Alasan / Tujuan Pemberesan', type: 'textarea', defaultValue: 'Menghendaki peneguhan secara sakramental menurut hukum Kanonik Gereja Katolik untuk kesempurnaan iman keluarga.', gridSpan: 2 }
    ]
  },
  {
    id: 'FORM16',
    code: 'FSakr-KAJ-2017-POS/001',
    title: 'LAPORAN PENERIMAAN SAKRAMEN PENGURAPAN ORANG SAKIT',
    shortTitle: 'Form 16 - Pengurapan Orang Sakit',
    category: 'SAKRAMEN',
    pdfFileName: 'FORM16 - LAPORAN PENERIMAAN SAKRAMEN PENGURAPAN ORANG SAKIT.pdf',
    description: 'Laporan resmi pengurapan orang sakit (viaticum dan minyak suci) untuk pencatatan buku register paroki.',
    syarat: [
      'Dilayani oleh Pastor/Romo Paroki Santa Clara',
      'Laporan diserahkan ke sekretariat paroki pasca pelayanan sakramen',
    ],
    defaultKopType: 'PAROKI',
    fields: [
      { key: 'nama_pasien', label: 'Nama Penerima Sakramen', type: 'text', placeholder: 'Nama orang sakit', autoFillKey: 'nama', gridSpan: 2 },
      { key: 'umur', label: 'Usia / Umur', type: 'text', placeholder: 'Contoh: 68 Tahun' },
      { key: 'hari_tgl_pelayanan', label: 'Hari & Tanggal Pelayanan', type: 'text', defaultValue: 'Sabtu, 19 September 2026' },
      { key: 'tempat_pelayanan', label: 'Tempat Pelayanan', type: 'text', placeholder: 'Rumah tinggal / RS Ananda Bekasi Kamar 304' },
      { key: 'pastor_pelayan', label: 'Pastor yang Melayani', type: 'text', defaultValue: 'Pastor Paroki Santa Clara' },
      { key: 'alamat', label: 'Alamat Tinggal Pasien', type: 'text', placeholder: 'Alamat', autoFillKey: 'alamat', gridSpan: 2 }
    ]
  },

  // --- KATEGORI 3: DATA KEPENDUDUKAN KK & BIDUK ---
  {
    id: 'BLANKO_BIDUK',
    code: 'F-BIDUK-KAJ-2026',
    title: 'FORM PENDATAAN / REVISI KEPALA KELUARGA & ANGGOTA PAROKI (BIDUK)',
    shortTitle: 'Blanko BIDUK KAJ',
    category: 'DATA_KK',
    pdfFileName: 'BLANKO BIDUK.pdf',
    description: 'Blanko resmi pendataan sensus kependudukan umat Katolik Paroki Santa Clara (Basis Integrasi Data Umat Keuskupan).',
    syarat: [
      'Wajib diisi oleh seluruh warga yang tinggal menetap di Paroki Santa Clara',
      'Fotokopi KTP seluruh anggota keluarga',
      'Fotokopi Kartu Keluarga Sipil Pemerintah',
      'Fotokopi Surat Baptis, Komuni, Krisma, dan Perkawinan Gereja',
    ],
    defaultKopType: 'LINGKUNGAN',
    fields: [
      { key: 'nama_kk', label: 'Nama Kepala Keluarga', type: 'text', placeholder: 'Nama KK', autoFillKey: 'nama_kk', gridSpan: 2 },
      { key: 'nik_kk', label: 'NIK Kepala Keluarga', type: 'text', placeholder: '3275xxxxxxxxxxxx', autoFillKey: 'nik' },
      { key: 'tempat_tgl_lahir', label: 'Tempat, Tgl Lahir KK', type: 'text', placeholder: 'Tempat, Tgl Lahir', autoFillKey: 'tgl_lahir' },
      { key: 'alamat_lengkap', label: 'Alamat Lengkap Rumah', type: 'text', placeholder: 'Alamat rumah', autoFillKey: 'alamat', gridSpan: 2 },
      { key: 'status_rumah', label: 'Status Kepemilikan Rumah', type: 'select', options: ['Milik Sendiri', 'Keluarga / Orang Tua', 'Kontrak / Sewa', 'Dinas / Lainnya'], defaultValue: 'Milik Sendiri' },
      { key: 'iuran_kematian', label: 'Kepesertaan Iuran Kematian Lingkungan', type: 'select', options: ['Ya (Aktif)', 'Tidak'], defaultValue: 'Ya (Aktif)' },
    ]
  },
  {
    id: 'FORM17',
    code: 'F-KAJ-2017-SA/003',
    title: 'LAPORAN KEMATIAN WARGA LINGKUNGAN',
    shortTitle: 'Form 17 - Laporan Kematian',
    category: 'DATA_KK',
    pdfFileName: 'FORM17 - LAPORAN KEMATIAN.pdf',
    description: 'Laporan resmi lelayu/kematian warga lingkungan untuk register buku kematian paroki dan santunan duka.',
    syarat: [
      'Dilampiri fotokopi Kartu Keluarga Gereja yang meninggal',
      'Surat Keterangan Kematian dari Rumah Sakit / Puskesmas / RT-RW',
    ],
    defaultKopType: 'PAROKI',
    fields: [
      { key: 'nama_almarhum', label: 'Nama Lengkap Almarhum/Almarhumah', type: 'text', placeholder: 'Nama mendiang', autoFillKey: 'nama', gridSpan: 2 },
      { key: 'tgl_meninggal', label: 'Hari, Tanggal & Jam Meninggal', type: 'text', placeholder: 'Sabtu, 19 September 2026, 08.00 WIB' },
      { key: 'usia_meninggal', label: 'Usia Saat Meninggal', type: 'text', placeholder: 'Contoh: 72 Tahun' },
      { key: 'tempat_meninggal', label: 'Tempat Meninggal Dunia', type: 'text', placeholder: 'RSUD Chasbullah Bekasi / Rumah Tinggal' },
      { key: 'nama_pasangan_keluarga', label: 'Nama Pasangan / Keluarga yang Ditinggalkan', type: 'text', placeholder: 'Nama pasangan/ahli waris', autoFillKey: 'nama_kk' },
      { key: 'sakramen_terakhir', label: 'Sakramen Terakhir yang Diterima', type: 'text', defaultValue: 'Sakramen Pengurapan Orang Sakit & Komuni Bekal Suci' },
      { key: 'tempat_semayam_makam', label: 'Tempat Disemayamkan & Pemakaman', type: 'textarea', defaultValue: 'Disemayamkan di Rumah Duka Harapan Baru dan dimakamkan di TPU Perwira Bekasi Utara.', gridSpan: 2 }
    ]
  },
  {
    id: 'FORM18',
    code: 'F-KAJ-2017-SA/004',
    title: 'FORMULIR PERUBAHAN KK - LAPORAN PINDAH DOMISILI',
    shortTitle: 'Form 18 - Pindah Domisili KK',
    category: 'DATA_KK',
    pdfFileName: 'FORM18 - FORMULIR PINDAH DOMISILI KK.pdf',
    description: 'Permohonan perubahan data BIDUK karena pindah domisili antar lingkungan di Paroki Santa Clara atau keluar paroki.',
    syarat: [
      'Melampirkan Kartu Keluarga Gereja asli yang lama',
      'Surat pengantar dari Ketua Lingkungan asal',
    ],
    defaultKopType: 'PAROKI',
    fields: [
      { key: 'nama_kk', label: 'Nama Kepala Keluarga', type: 'text', placeholder: 'Nama KK', autoFillKey: 'nama_kk', gridSpan: 2 },
      { key: 'nomor_kk', label: 'Nomor Kartu Keluarga Gereja', type: 'text', placeholder: 'No. KK Gereja / BIDUK' },
      { key: 'jenis_pindah', label: 'Jenis Perpindahan', type: 'select', options: ['Pindah Sekeluarga', 'Salah Satu Anggota Keluarga'], defaultValue: 'Pindah Sekeluarga' },
      { key: 'alamat_tujuan', label: 'Alamat Domisili Baru', type: 'text', placeholder: 'Alamat lengkap baru', gridSpan: 2 },
      { key: 'paroki_tujuan', label: 'Paroki & Wilayah/Lingkungan Tujuan', type: 'text', placeholder: 'Contoh: Paroki St. Arnoldus Bekasi / Lingkungan St. Agustinus' },
      { key: 'alasan_pindah', label: 'Alasan Kepindahan', type: 'textarea', defaultValue: 'Kepindahan domisili tempat tinggal keluarga.', gridSpan: 2 }
    ]
  },
  {
    id: 'FORM19',
    code: 'F-KAJ-2017-SA/005',
    title: 'FORMULIR PERUBAHAN KK - PENAMBAHAN ANGGOTA KELUARGA',
    shortTitle: 'Form 19 - Penambahan Anggota KK',
    category: 'DATA_KK',
    pdfFileName: 'FORM19 - PENAMBAHAN ANGGOTA KK.pdf',
    description: 'Pencatatan penambahan anggota keluarga baru (kelahiran anak, anggota keluarga baru) ke dalam Kartu Keluarga Paroki.',
    syarat: [
      'Fotokopi Surat Baptis anggota baru / Akta Kelahiran Sipil',
      'Fotokopi Kartu Keluarga Gereja asli yang berjalan',
    ],
    defaultKopType: 'PAROKI',
    fields: [
      { key: 'nama_kk', label: 'Nama Kepala Keluarga', type: 'text', placeholder: 'Nama KK', autoFillKey: 'nama_kk', gridSpan: 2 },
      { key: 'nomor_kk', label: 'Nomor KK Gereja', type: 'text', placeholder: 'No KK Gereja' },
      { key: 'nama_anggota_baru', label: 'Nama Lengkap Anggota Baru', type: 'text', placeholder: 'Nama anggota yang ditambahkan', autoFillKey: 'nama', gridSpan: 2 },
      { key: 'tempat_tgl_lahir', label: 'Tempat, Tanggal Lahir', type: 'text', placeholder: 'Tempat, tgl lahir', autoFillKey: 'tgl_lahir' },
      { key: 'hubungan_keluarga', label: 'Hubungan Keluarga dengan KK', type: 'select', options: ['Anak Kandung', 'Anak Angkat', 'Orang Tua / Mertua', 'Famili Lain'], defaultValue: 'Anak Kandung' },
      { key: 'keterangan_tambahan', label: 'Keterangan Tambahan', type: 'textarea', defaultValue: 'Penambahan anggota keluarga karena kelahiran anak baru dalam keluarga.', gridSpan: 2 }
    ]
  },
  {
    id: 'FORM20',
    code: 'F-KAJ-2017-SA/006',
    title: 'FORMULIR PERUBAHAN KK - PERMOHONAN CETAK ULANG KK',
    shortTitle: 'Form 20 - Cetak Ulang KK',
    category: 'DATA_KK',
    pdfFileName: 'FORM20 - CETAK ULANG KK.pdf',
    description: 'Permohonan cetak ulang fisik Kartu Keluarga Gereja karena hilang, rusak, atau revisi data besar.',
    syarat: [
      'Surat Pernyataan Kehilangan (bila hilang) atau melampirkan KK fisik yang lama bila rusak',
      'Persetujuan dan paraf Ketua Lingkungan',
    ],
    defaultKopType: 'PAROKI',
    fields: [
      { key: 'nama_kk', label: 'Nama Kepala Keluarga', type: 'text', placeholder: 'Nama KK', autoFillKey: 'nama_kk', gridSpan: 2 },
      { key: 'nomor_kk', label: 'Nomor KK Gereja', type: 'text', placeholder: 'No KK Gereja' },
      { key: 'alasan_cetak', label: 'Alasan Permohonan Cetak Ulang', type: 'select', options: ['Kartu Keluarga Fisik Rusak', 'Kartu Keluarga Fisik Hilang', 'Revisi / Pemutakhiran Data BIDUK'], defaultValue: 'Kartu Keluarga Fisik Rusak' },
      { key: 'alamat', label: 'Alamat Domisili Keluarga', type: 'text', placeholder: 'Alamat', autoFillKey: 'alamat', gridSpan: 2 },
      { key: 'catatan', label: 'Catatan Pengurus Lingkungan', type: 'textarea', defaultValue: 'Data keluarga telah diverifikasi sesuai basis data sensus lingkungan terkini dan dimohon untuk dicetak ulang.', gridSpan: 2 }
    ]
  },

  // --- KATEGORI 4: LITURGI & INTERNAL PAROKI ---
  {
    id: 'FORM_PRODIAKON',
    code: 'F-LIT-SC-2025',
    title: 'PENDAFTARAN ANGGOTA BARU PELAYAN LITURGI / PRODIAKON',
    shortTitle: 'Formulir Pendaftaran Prodiakon',
    category: 'LITURGI_INTERNAL',
    pdfFileName: 'FORMULIR PENDAFTARAN PRODIAKON.pdf',
    description: 'Formulir pendaftaran dan kesediaan diri menjadi Prodiakon / Pelayan Luar Biasa Komuni Kudus Paroki Santa Clara.',
    syarat: [
      'Umat Katolik yang telah menerima Sakramen Penguatan (Krisma)',
      'Bagi yang berkeluarga, telah menerima Sakramen Perkawinan yang sah',
      'Mendapatkan rekomendasi dan tanda tangan dari Ketua Lingkungan',
      'Bersedia mengikuti kursus pembinaan dasar dan pelantikan resmi oleh Uskup / Pastor Paroki',
    ],
    defaultKopType: 'PAROKI',
    fields: [
      { key: 'nama_lengkap', label: 'Nama Lengkap (Nama Baptis & Krisma)', type: 'text', placeholder: 'Nama lengkap calon prodiakon', autoFillKey: 'nama', gridSpan: 2 },
      { key: 'tempat_tgl_lahir', label: 'Tempat, Tanggal Lahir', type: 'text', placeholder: 'Tempat, Tgl Lahir', autoFillKey: 'tgl_lahir' },
      { key: 'pendidikan_pekerjaan', label: 'Pendidikan Terakhir / Pekerjaan', type: 'text', placeholder: 'S1 / Karyawan Swasta' },
      { key: 'alamat', label: 'Alamat Tempat Tinggal', type: 'text', placeholder: 'Alamat lengkap', autoFillKey: 'alamat', gridSpan: 2 },
      { key: 'riwayat_pelayanan', label: 'Riwayat Pelayanan yang Pernah Dilakukan', type: 'textarea', defaultValue: 'Aktif dalam kepengurusan doa lingkungan, koor lingkungan, dan panitia perayaan liturgi gereja.', gridSpan: 2 },
      { key: 'kesediaan', label: 'Pernyataan Kesediaan', type: 'textarea', defaultValue: 'Saya telah membaca dan mengerti persyaratan sebagai Prodiakon dan menyatakan bersedia melayani pembagian Komuni Kudus di gereja maupun kepada orang sakit di lingkungan.', gridSpan: 2 }
    ]
  },
  {
    id: 'FORM_PINJAM_ALAT',
    code: 'F-SARPRAS-SC-2025',
    title: 'FORMULIR PEMINJAMAN PERALATAN PAROKI BEKASI UTARA',
    shortTitle: 'Form Peminjaman Peralatan Paroki',
    category: 'LITURGI_INTERNAL',
    pdfFileName: 'Formulir Peminjaman Peralatan Paroki.pdf',
    description: 'Formulir permohonan peminjaman inventaris sarana/prasarana milik Paroki Santa Clara untuk kegiatan pastoral lingkungan.',
    syarat: [
      'Diajukan selambat-lambatnya 7 (tujuh) hari sebelum pelaksanaan kegiatan',
      'Wajib menjaga keutuhan alat dan mengganti apabila terjadi kerusakan/kehilangan',
    ],
    defaultKopType: 'PAROKI',
    fields: [
      { key: 'penanggung_jawab', label: 'Nama Penanggung Jawab Peminjam', type: 'text', placeholder: 'Nama penanggung jawab', autoFillKey: 'nama', gridSpan: 2 },
      { key: 'nama_kegiatan', label: 'Nama Kegiatan / Acara Lingkungan', type: 'text', defaultValue: 'Ibadat Doa Rosario & Pertemuan Warga Lingkungan', gridSpan: 2 },
      { key: 'hari_tanggal', label: 'Hari / Tanggal Acara', type: 'text', defaultValue: 'Sabtu, 26 September 2026' },
      { key: 'tempat_acara', label: 'Tempat Pelaksanaan Acara', type: 'text', defaultValue: 'Ruang Aula Paroki Santa Clara / Rumah Umat' },
      { key: 'daftar_alat', label: 'Rincian Peralatan yang Dipinjam', type: 'textarea', defaultValue: '1. Sound system portable (1 unit) + 2 mic wireless\n2. Kursi lipat plastik (20 buah)\n3. Kabel roll 25m (1 buah)', gridSpan: 2 },
    ]
  },
]
