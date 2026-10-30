-- Migration: 20261030143000_add_nature_to_coa.sql
-- Menambahkan kolom nature pada tabel coa dan menyamakan COA di seluruh lingkungan paroki

-- 1. Tambah kolom nature jika belum ada
ALTER TABLE coa ADD COLUMN IF NOT EXISTS nature TEXT;

-- 2. Upsert seluruh COA master beserta nature / keterangan fungsinya
INSERT INTO coa (id, nama_akun, tipe, nature) VALUES
  -- Kas & Setara Kas (Debit Normal)
  ('1100', 'Bank', 'DEBIT', 'Saldo rekening bank lingkungan'),
  ('1200', 'Kas', 'DEBIT', 'Uang tunai kas kecil lingkungan'),
  ('1300', 'Dana talangan Dahar Romo', 'DEBIT', 'Bersumber dari kas lingkungan atau umat'),
  ('1400', 'Dana talangan Santo Yusuf', 'DEBIT', 'Bersumber dari kas lingkungan atau umat'),

  -- Penerimaan (Kredit Normal - Akun 4xxx)
  ('4100', 'Iuran Kas Lingkungan', 'KREDIT', 'Iuran rutin warga lingkungan'),
  ('4110', 'Kolekte Ibadat Sabda', 'KREDIT', 'Persembahan kolekte ibadat'),
  ('4120', 'Sumbangan Dahar Romo', 'KREDIT', 'Sumbangan makan/dahar Romo'),
  ('4200', 'Sumbangan ASAK', 'KREDIT', 'Ayo Sekolah Ayo Kuliah'),
  ('4300', 'Iuran Dana Kematian/St. Yusuf', 'KREDIT', 'Dana santunan kematian'),
  ('4400', 'Kolekte Misa Lingkungan', 'KREDIT', 'Persembahan misa di lingkungan'),
  ('4500', 'Sumbangan Umat', 'KREDIT', 'Donasi sukarela warga umat'),
  ('4501', 'Iuran Celengan CYTM', 'KREDIT', 'Nature dana CYTM (Celengan)'),
  ('4600', 'Bantuan dari Paroki', 'KREDIT', 'Subsidi/dana dari Dewan Paroki'),
  ('4700', 'Dana APP', 'KREDIT', 'Aksi Puasa Pembangunan'),
  ('4800', 'Dana Aksi Natal', 'KREDIT', 'Aksi sosial perayaan Natal'),
  ('4900', 'Penerimaan Lainnya', 'KREDIT', 'Penerimaan kas non-rutin lainnya'),

  -- Pengeluaran (Debit Normal - Akun 5xxx)
  ('5100', 'Misa', 'DEBIT', 'Biaya perlengkapan perayaan ekaristi'),
  ('5110', 'Ibadat Sabda', 'DEBIT', 'Biaya penyelenggaraan ibadat'),
  ('5120', 'Rosario', 'DEBIT', 'Konsumsi & lilin doa rosario'),
  ('5130', 'Koor', 'DEBIT', 'Latihan koor & fotokopi partitur'),
  ('5140', 'Stipendium/ Iura stolae', 'DEBIT', 'Stipendium Romo & pelayan altar'),
  ('5150', 'Bina iman', 'DEBIT', 'Kegiatan BIA / BIR anak-anak'),
  ('5160', 'Pendalaman kitab suci', 'DEBIT', 'Bulan Kitab Suci Nasional (BKSN)'),
  ('5170', 'Kepemudaan', 'DEBIT', 'Kegiatan Orang Muda Katolik (OMK)'),
  ('5180', 'Kerasulan keluarga', 'DEBIT', 'Program pembinaan pasutri & keluarga'),
  ('5190', 'Pendidikan calon imam', 'DEBIT', 'Bantuan seminari / calon imam'),
  ('5200', 'Rapat / pertemuan lingkungan', 'DEBIT', 'Konsumsi & perlengkapan rapat warga'),
  ('5210', 'Perayaan (Natal / Paskah / HUT)', 'DEBIT', 'Acara pesta & perayaan bersama'),
  ('5220', 'Inventaris (Pembelian / Pemeliharaan)', 'DEBIT', 'Pengadaan & perawatan aset'),
  ('5230', 'Administrasi', 'DEBIT', 'ATK, fotokopi buku warta, materai'),
  ('5240', 'Kegiatan rohani lain (retret, rekoleksi, dsb)', 'DEBIT', 'Ziarah rohani, retret pengurus'),
  ('5250', 'Bantuan Sosial Internal (umat lingkungan)', 'DEBIT', 'Santunan warga lingkungan prasejahtera'),
  ('5260', 'Bantuan Sosial Eksternal (umat luar lingkungan)', 'DEBIT', 'Bakti sosial warga luar lingkungan'),
  ('5270', 'Pastoran (dahar Romo)', 'DEBIT', 'Penyaluran konsumsi pastoran'),
  ('5280', 'Sumbangan kematian/St. Yusuf', 'DEBIT', 'Bantuan kedukaan warga'),
  ('5290', 'Sumbangan Dana ASAK', 'DEBIT', 'Penyaluran dana beasiswa ASAK'),
  ('5300', 'Sumbangan Dana Pastoran', 'DEBIT', 'Dukungan operasional pastoran'),
  ('5310', 'Sumbangan Dana APP', 'DEBIT', 'Penyetoran kotak APP ke paroki'),
  ('5320', 'Sumbangan Dana Aksi Natal', 'DEBIT', 'Penyetoran aksi Natal ke paroki'),
  ('5340', 'Sumbangan Dana PPG', 'DEBIT', 'Panitia Pembangunan Gereja'),
  ('5350', 'Kolekte yg disetor ke Paroki', 'DEBIT', 'Penyetoran kolekte misa / ibadat ke paroki'),
  ('5360', 'Sumbangan Celengan CYTM', 'DEBIT', 'Penyetoran/sumbangan celengan CYTM ke Paroki'),
  ('5900', 'Pengeluaran lainnya', 'DEBIT', 'Pengeluaran operasional lain-lain')
ON CONFLICT (id) DO UPDATE SET
  nama_akun = EXCLUDED.nama_akun,
  tipe = EXCLUDED.tipe,
  nature = EXCLUDED.nature;
