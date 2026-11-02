-- ==============================================================================
-- SKRIP MIGRASI DATABASE: SISTEM KEUANGAN LINGKUNGAN -> PROJEK SICLAR (PRO PLAN)
-- Organisasi: gerejastclara (Paroki Santa Clara - Bekasi Utara)
-- Domain: siclar.id
-- Sifat: Idempoten (Aman dijalankan berulang kali, tidak menimpa data budgeting)
-- ==============================================================================

BEGIN;

-- 1. Ekstensi UUID & Kriptografi
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABEL LINGKUNGAN (69 Lingkungan Paroki Santa Clara)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.lingkungan (
    id UUID PRIMARY KEY,
    nama_lingkungan VARCHAR(255) NOT NULL,
    wilayah VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. TABEL COA (BAGAN AKUN STANDAR KAJ + NATURE)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.coa (
    id VARCHAR(10) PRIMARY KEY,
    nama_akun VARCHAR(255) NOT NULL,
    tipe VARCHAR(50) NOT NULL CHECK (tipe IN ('DEBIT', 'KREDIT')),
    kategori VARCHAR(50) DEFAULT 'PENERIMAAN',
    keterangan TEXT,
    nature TEXT,
    urutan INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.coa ADD COLUMN IF NOT EXISTS kategori VARCHAR(50) DEFAULT 'PENERIMAAN';
ALTER TABLE public.coa ADD COLUMN IF NOT EXISTS keterangan TEXT;
ALTER TABLE public.coa ADD COLUMN IF NOT EXISTS nature TEXT;
ALTER TABLE public.coa ADD COLUMN IF NOT EXISTS urutan INT DEFAULT 0;

-- ==============================================================================
-- 4. TABEL KRITERIA GOLONGAN (PEDOMAN DUPRAS KAJ)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.kriteria_golongan (
    id VARCHAR(100) PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    badge_color VARCHAR(30),
    bg_light VARCHAR(30),
    border_light VARCHAR(30),
    text_color VARCHAR(30),
    icon_emoji VARCHAR(10),
    subjudul VARCHAR(255),
    garis_pengeluaran VARCHAR(255),
    tahap_metode VARCHAR(255),
    indikator TEXT,
    contoh_kondisi TEXT,
    rekomendasi_bantuan TEXT,
    is_default BOOLEAN DEFAULT TRUE,
    urutan INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 5. TABEL DOKUMEN PAROKI (FORMULIR, BLANKO, KOP RESMI)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.dokumen_paroki (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode_form VARCHAR(50),
    nama_dokumen VARCHAR(255) NOT NULL,
    kategori VARCHAR(100) DEFAULT 'Formulir',
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT DEFAULT 0,
    mime_type VARCHAR(100) DEFAULT 'application/pdf',
    keterangan TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 6. TABEL PROFIL LINGKUNGAN (PENGURUS & SALDO AWAL)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profil_lingkungan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lingkungan_id UUID NOT NULL UNIQUE REFERENCES public.lingkungan(id) ON DELETE CASCADE,
    ketua_nama TEXT,
    telepon_ketua VARCHAR(50),
    sekretaris_nama TEXT,
    telepon_sekretaris VARCHAR(50),
    bendahara_nama TEXT,
    telepon_bendahara VARCHAR(50),
    periode_masa_bakti VARCHAR(50) DEFAULT '2024 - 2026',
    status VARCHAR(50) DEFAULT 'Aktif',
    jenis_rekening VARCHAR(100),
    nama_bank VARCHAR(100),
    no_rekening VARCHAR(100),
    saldo_awal DECIMAL(15,2) DEFAULT 0.00,
    tahun_buku VARCHAR(4) DEFAULT '2026',
    bulan_saldo INT DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 7. TABEL KEPALA KELUARGA (DAFU)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.kepala_keluarga (
    id VARCHAR(100) PRIMARY KEY,
    lingkungan_id UUID NOT NULL REFERENCES public.lingkungan(id) ON DELETE CASCADE,
    nama_kk VARCHAR(255) NOT NULL,
    no_kk VARCHAR(50),
    alamat TEXT,
    telepon VARCHAR(50),
    is_biduk BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.kepala_keluarga ADD COLUMN IF NOT EXISTS no_kk VARCHAR(50);
ALTER TABLE public.kepala_keluarga ADD COLUMN IF NOT EXISTS telepon VARCHAR(50);
ALTER TABLE public.kepala_keluarga ADD COLUMN IF NOT EXISTS is_biduk BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_kk_lingkungan_id ON public.kepala_keluarga(lingkungan_id);
CREATE INDEX IF NOT EXISTS idx_kk_nama ON public.kepala_keluarga(nama_kk);

-- ==============================================================================
-- 8. TABEL ANGGOTA KELUARGA
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.anggota_keluarga (
    id VARCHAR(100) PRIMARY KEY,
    kk_id VARCHAR(100) NOT NULL REFERENCES public.kepala_keluarga(id) ON DELETE CASCADE,
    no_anggota VARCHAR(50),
    nama VARCHAR(255) NOT NULL,
    peran VARCHAR(50) NOT NULL DEFAULT 'Anak',
    jenis_kelamin VARCHAR(10),
    is_kaj BOOLEAN DEFAULT TRUE,
    keterangan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.anggota_keluarga ADD COLUMN IF NOT EXISTS no_anggota VARCHAR(50);
ALTER TABLE public.anggota_keluarga ADD COLUMN IF NOT EXISTS jenis_kelamin VARCHAR(10);
ALTER TABLE public.anggota_keluarga ADD COLUMN IF NOT EXISTS is_kaj BOOLEAN DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_anggota_kk_id ON public.anggota_keluarga(kk_id);

-- ==============================================================================
-- 9. TABEL GOLONGAN KELUARGA (STATUS EKONOMI PER KK)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.golongan_keluarga (
    id VARCHAR(100) PRIMARY KEY,
    kk_id VARCHAR(100) NOT NULL UNIQUE REFERENCES public.kepala_keluarga(id) ON DELETE CASCADE,
    lingkungan_id UUID NOT NULL REFERENCES public.lingkungan(id) ON DELETE CASCADE,
    golongan VARCHAR(50) NOT NULL DEFAULT 'Sejahtera',
    kriteria_catatan TEXT,
    updated_by_role VARCHAR(50) DEFAULT 'SEKRETARIS',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_golongan_kk_id ON public.golongan_keluarga(kk_id);
CREATE INDEX IF NOT EXISTS idx_golongan_lingkungan_id ON public.golongan_keluarga(lingkungan_id);

-- ==============================================================================
-- 10. TABEL ASET (INVENTARIS LINGKUNGAN)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.aset (
    id VARCHAR(100) PRIMARY KEY,
    lingkungan_id UUID NOT NULL REFERENCES public.lingkungan(id) ON DELETE CASCADE,
    kategori VARCHAR(100),
    nama_barang VARCHAR(255) NOT NULL,
    tahun_beli INT,
    jumlah INT DEFAULT 1,
    harga_satuan DECIMAL(15,2) DEFAULT 0.00,
    kondisi VARCHAR(50) DEFAULT 'Baik',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aset_lingkungan_id ON public.aset(lingkungan_id);

-- ==============================================================================
-- 11. TABEL JURNAL TRANSAKSI (PEMBUKUAN KAS & TALANGAN)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.jurnal_transaksi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lingkungan_id UUID NOT NULL REFERENCES public.lingkungan(id) ON DELETE CASCADE,
    kk_id VARCHAR(100) REFERENCES public.kepala_keluarga(id) ON DELETE SET NULL,
    tanggal DATE NOT NULL,
    tipe_arus VARCHAR(10) NOT NULL CHECK (tipe_arus IN ('MASUK', 'KELUAR')),
    coa_debit VARCHAR(10) REFERENCES public.coa(id) ON DELETE RESTRICT,
    coa_kredit VARCHAR(10) REFERENCES public.coa(id) ON DELETE RESTRICT,
    nominal DECIMAL(15,2) NOT NULL,
    keterangan TEXT,
    no_bukti VARCHAR(100),
    sumber_kas VARCHAR(50) DEFAULT 'BANK',
    sumber_setoran VARCHAR(100) DEFAULT 'SENDIRI',
    is_posted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.jurnal_transaksi ADD COLUMN IF NOT EXISTS sumber_kas VARCHAR(50) DEFAULT 'BANK';
ALTER TABLE public.jurnal_transaksi ADD COLUMN IF NOT EXISTS sumber_setoran VARCHAR(100) DEFAULT 'SENDIRI';
ALTER TABLE public.jurnal_transaksi ADD COLUMN IF NOT EXISTS no_bukti VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_jurnal_lingkungan_id ON public.jurnal_transaksi(lingkungan_id);
CREATE INDEX IF NOT EXISTS idx_jurnal_tanggal ON public.jurnal_transaksi(tanggal);

-- ==============================================================================
-- 12. TABEL DAFU APPROVALS (PERSETUJUAN PERUBAHAN DATA UMAT PAROKI)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.dafu_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lingkungan_id TEXT,
    nama_lingkungan TEXT NOT NULL,
    kk_id TEXT,
    action_type VARCHAR(50) NOT NULL DEFAULT 'TAMBAH_KK',
    nama_kk TEXT NOT NULL,
    alamat TEXT,
    is_biduk BOOLEAN DEFAULT TRUE,
    golongan VARCHAR(100) DEFAULT 'Sejahtera',
    kriteria_catatan TEXT,
    anggota_keluarga JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    catatan_paroki TEXT,
    submitted_by VARCHAR(100),
    reviewed_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    is_read BOOLEAN DEFAULT FALSE,
    data_sebelum_edit JSONB DEFAULT NULL,
    is_edited_by_paroki BOOLEAN DEFAULT FALSE
);

ALTER TABLE public.dafu_approvals ADD COLUMN IF NOT EXISTS data_sebelum_edit JSONB DEFAULT NULL;
ALTER TABLE public.dafu_approvals ADD COLUMN IF NOT EXISTS is_edited_by_paroki BOOLEAN DEFAULT FALSE;

-- ==============================================================================
-- 13. TABEL RIWAYAT IMPORT DAFU
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.riwayat_import_dafu (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT DEFAULT 0,
    total_baris INT DEFAULT 0,
    total_kk INT DEFAULT 0,
    total_jiwa INT DEFAULT 0,
    lingkungan_terdampak INT DEFAULT 0,
    uploaded_by VARCHAR(100),
    user_role VARCHAR(50),
    status VARCHAR(50) DEFAULT 'SUCCESS',
    catatan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 14. TABEL USERS (LOGIN TANPA EMAIL)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE,
    password VARCHAR(100) NOT NULL,
    role VARCHAR(30) NOT NULL,
    lingkungan_id UUID REFERENCES public.lingkungan(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Penyesuaian jika public.users sudah ada sebelumnya dari sistem budgeting
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
ALTER TABLE public.users ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password VARCHAR(100);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role VARCHAR(30);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS lingkungan_id UUID REFERENCES public.lingkungan(id) ON DELETE SET NULL;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON public.users(username);

-- ==============================================================================
-- SEED DATA 1: 69 LINGKUNGAN PAROKI SANTA CLARA
-- ==============================================================================
INSERT INTO public.lingkungan (id, nama_lingkungan, wilayah) VALUES 
('eea00d03-96b0-40a0-9465-5eb4e97496c6', 'St. Agnes 1', 'AGNES'),
('7a12edb0-663f-4abf-9476-33a65215a6cc', 'St. Agnes 2', 'AGNES'),
('006217f4-ac94-4d36-9f9f-1370ecc17701', 'St. Agnes 3', 'AGNES'),
('0d706022-f150-4dad-a17c-c24e1f20a3f4', 'St. Agnes 4', 'AGNES'),
('d273429a-9e62-40e9-bd98-e32fb6ab9f17', 'St. Agnes 5', 'AGNES'),
('69ed2970-8372-44a6-9cc3-377c522ed916', 'St. Antonius 1', 'ANTONIUS'),
('06fc7687-0c40-4119-9847-cda7931b779e', 'St. Antonius 2', 'ANTONIUS'),
('e6515d0f-314d-40dd-ad2b-d1529767bdcc', 'St. Antonius 3', 'ANTONIUS'),
('04ed939c-bf5d-41d7-b5c8-0d69da9b4578', 'St. Antonius 4', 'ANTONIUS'),
('6b8dd929-7623-490b-af4c-8f43d10e131b', 'St. Antonius 5', 'ANTONIUS'),
('685c464a-f8f6-4ec4-9fe5-d2800b8314d3', 'St. Antonius 6', 'ANTONIUS'),
('4bc7682d-5c70-4ded-9eee-053e05bc2a9f', 'St. Bonaventura 1', 'BONAVENTURA'),
('c5cb86b8-fe2b-4ecb-9d47-66a908eb8ff7', 'St. Bonaventura 2', 'BONAVENTURA'),
('010e9f64-4bf8-4603-9d0b-6be62b5d4e41', 'St. Bonaventura 3', 'BONAVENTURA'),
('3bb6d6d4-82a1-4384-8254-8c8bb9dbef01', 'St. Bonaventura 4', 'BONAVENTURA'),
('3c6f1400-e221-4d1a-be16-a36c84b4aa56', 'St. Bonaventura 5', 'BONAVENTURA'),
('ea039aa7-c8c3-42e5-ad34-6ea2e68be9c8', 'St. Bonaventura 6', 'BONAVENTURA'),
('32efd683-e18e-4a62-957d-ebc267323862', 'St. Brigitta 1', 'BRIGITTA'),
('14e6b52c-fe1c-4389-9a70-80d5bfa7bc2c', 'St. Brigitta 2', 'BRIGITTA'),
('23ebaa47-e19d-40b9-8cb1-863a86348dd0', 'St. Brigitta 3', 'BRIGITTA'),
('8d5c4ba0-59be-426b-ae22-5ba9fa620f32', 'St. Brigitta 4', 'BRIGITTA'),
('d5051610-85f2-4bc4-b81d-ba80ca1fc6fb', 'St. Brigitta 5', 'BRIGITTA'),
('ec5ee0bb-c2eb-4fe1-ba76-2e652c7b5fa3', 'St. Catarina 1', 'CATARINA'),
('0d7426e2-2a90-482a-bc91-2a13b6329fc8', 'St. Catarina 2', 'CATARINA'),
('eebfb895-c548-4381-8fd7-d1cf8226d97c', 'St. Catarina 3', 'CATARINA'),
('ff804e76-35fc-4279-994d-4876cf308bfa', 'St. Catarina 4', 'CATARINA'),
('d6108151-6c24-4050-848e-ee518e874982', 'St. Elisabeth 1', 'ELISABETH'),
('c3aa5df5-f4e9-4e76-a795-09ce4a0aa3a8', 'St. Elisabeth 2', 'ELISABETH'),
('bb7299a9-460f-48d1-93e1-cc8097d74db1', 'St. Elisabeth 3', 'ELISABETH'),
('81da5346-6f81-42cb-b1b7-a36c8be48b7f', 'St. Elisabeth 4', 'ELISABETH'),
('47214731-0df8-45e0-94cb-55d644be6509', 'St. Fransiskus Asisi 1', 'FRANSISKUS ASISI'),
('e6c86e0d-4235-430c-99ae-ba2ea451db65', 'St. Fransiskus Asisi 2', 'FRANSISKUS ASISI'),
('e39755b4-dff8-4ff4-bf9f-eb6a7c3ce97f', 'St. Fransiskus Asisi 3', 'FRANSISKUS ASISI'),
('c37ceee6-dd87-4171-85e3-6a9cb5d2eb35', 'St. Fransiskus Asisi 4', 'FRANSISKUS ASISI'),
('a59b7dfd-b4b3-49dc-8c43-85e6831d3209', 'St. Fransiskus Asisi 5', 'FRANSISKUS ASISI'),
('33203f19-38b4-419b-ab46-4cb7fa03d65b', 'St. Fransiskus Xaverius 1', 'FRANSISKUS XAVERIUS'),
('33efcb83-2fdb-4ec6-8d5f-4bf23a1a5416', 'St. Fransiskus Xaverius 2', 'FRANSISKUS XAVERIUS'),
('20e98059-e935-47e2-a0d3-500b5fc2411e', 'St. Fransiskus Xaverius 3', 'FRANSISKUS XAVERIUS'),
('d17c768c-db5d-4f10-9114-c15c543fe7d0', 'St. Fransiskus Xaverius 4', 'FRANSISKUS XAVERIUS'),
('7f92e4df-e1b9-445a-bb48-e8cbda2ef90e', 'St. Fransiskus Xaverius 5', 'FRANSISKUS XAVERIUS'),
('c2ca582e-9d22-4217-91f7-e435e0e0f224', 'St. Maria 1', 'MARIA'),
('372e61a4-b0db-46be-a979-3ba345fbb596', 'St. Maria 2', 'MARIA'),
('a921d428-f62f-410a-8bf8-d5bfec6ef777', 'St. Maria 3', 'MARIA'),
('2bb050c2-3e2d-45be-9bc0-881bc37bda00', 'St. Maria 4', 'MARIA'),
('2d577ca2-488f-4ba6-af5b-ca0e5b7fbca9', 'St. Maria 5', 'MARIA'),
('da1b6d3b-db10-48cc-8159-b211dffc3c22', 'Padre Pio 1', 'PADRE PIO'),
('5378c2e6-a059-4bf9-89a3-5c01b44cb72e', 'Padre Pio 2', 'PADRE PIO'),
('7a942544-e2bc-44aa-9cbf-9a0d8e8748a3', 'Padre Pio 3', 'PADRE PIO'),
('ec989c95-bc65-42df-b732-c744f91efba5', 'Padre Pio 4', 'PADRE PIO'),
('ae550970-1927-4a0b-939e-e81881515bb5', 'Padre Pio 5', 'PADRE PIO'),
('e378c56e-69cb-485a-8b81-a968eb1a4b67', 'Padre Pio 6', 'PADRE PIO'),
('9180b06a-a82f-4e0d-b8d9-299f19ca1e75', 'Padre Pio 7', 'PADRE PIO'),
('95e865f3-52fe-44f2-95f3-f9302e3b2e56', 'St. Theresia 1', 'THERESIA'),
('73c4fcfb-449e-4cb8-8c5e-851a02102179', 'St. Theresia 2', 'THERESIA'),
('30ce6f05-021b-4395-813c-cc4eb5ea6f31', 'St. Theresia 3', 'THERESIA'),
('707567e9-6019-4cb5-86ea-d68a9643f82b', 'St. Theresia 4', 'THERESIA'),
('542b6a03-7cf5-4dbb-82ea-2fc800d97bf2', 'St. Theresia 5', 'THERESIA'),
('69ddc637-236b-4e67-8ddb-29a888c3a5ce', 'St. Thomas Aquino 1', 'THOMAS AQUINO'),
('ee39a489-026d-472e-836e-52eb321855b7', 'St. Thomas Aquino 2', 'THOMAS AQUINO'),
('20df4447-da7c-4712-a7f4-ec0f7793d508', 'St. Thomas Aquino 3', 'THOMAS AQUINO'),
('22312d99-ba60-4fe7-91a6-a058da3522f7', 'St. Thomas Aquino 4', 'THOMAS AQUINO'),
('b66236b4-a951-460f-b44c-98a96a3e6205', 'St. Thomas Aquino 5', 'THOMAS AQUINO'),
('d5fb513f-8461-4c7b-a2e6-fa9921da4311', 'St. Thomas Aquino 6', 'THOMAS AQUINO'),
('6ce4b706-0dd4-468b-8e36-ff4e8a1f28b2', 'St. Veronika 1', 'VERONIKA'),
('47c67c52-0820-4e3a-9694-82a17f694602', 'St. Veronika 2', 'VERONIKA'),
('41d8e17b-bc43-42e7-94ff-7883907e5436', 'St. Veronika 3', 'VERONIKA'),
('9b7b9687-f8e0-47fa-8025-a13a85bbd1f9', 'St. Veronika 4', 'VERONIKA'),
('7d544078-4ea1-4dd9-af7b-ba52d7ee8252', 'St. Veronika 5', 'VERONIKA'),
('8035fb14-1e5b-4394-bb9e-1e434f40d3f8', 'St. Veronika 6', 'VERONIKA')
ON CONFLICT (id) DO UPDATE SET 
  nama_lingkungan = EXCLUDED.nama_lingkungan, 
  wilayah = EXCLUDED.wilayah;

-- ==============================================================================
-- SEED DATA 2: 31 MASTER COA (BAGAN AKUN DENGAN NATURE)
-- ==============================================================================
INSERT INTO public.coa (id, nama_akun, tipe, kategori, nature, urutan) VALUES
  ('1100', 'Bank', 'DEBIT', 'KAS', 'Saldo rekening bank lingkungan', 1),
  ('1200', 'Kas', 'DEBIT', 'KAS', 'Uang tunai kas kecil lingkungan', 2),
  ('1300', 'Dana talangan Dahar Romo', 'DEBIT', 'KAS', 'Bersumber dari kas lingkungan atau umat', 3),
  ('1400', 'Dana talangan Santo Yusuf', 'DEBIT', 'KAS', 'Bersumber dari kas lingkungan atau umat', 4),
  ('4100', 'Iuran Kas Lingkungan', 'KREDIT', 'PENERIMAAN', 'Iuran rutin warga lingkungan', 10),
  ('4110', 'Kolekte Ibadat Sabda', 'KREDIT', 'PENERIMAAN', 'Persembahan kolekte ibadat', 11),
  ('4120', 'Sumbangan Dahar Romo', 'KREDIT', 'PENERIMAAN', 'Sumbangan makan/dahar Romo', 12),
  ('4200', 'Sumbangan ASAK', 'KREDIT', 'PENERIMAAN', 'Ayo Sekolah Ayo Kuliah', 13),
  ('4300', 'Iuran Dana Kematian/St. Yusuf', 'KREDIT', 'PENERIMAAN', 'Dana santunan kematian', 14),
  ('4400', 'Kolekte Misa Lingkungan', 'KREDIT', 'PENERIMAAN', 'Persembahan misa di lingkungan', 15),
  ('4500', 'Sumbangan Umat', 'KREDIT', 'PENERIMAAN', 'Donasi sukarela warga umat', 16),
  ('4501', 'Iuran Celengan CYTM', 'KREDIT', 'PENERIMAAN', 'Nature dana CYTM (Celengan)', 17),
  ('4600', 'Bantuan dari Paroki', 'KREDIT', 'PENERIMAAN', 'Subsidi/dana dari Dewan Paroki', 18),
  ('4700', 'Dana APP', 'KREDIT', 'PENERIMAAN', 'Aksi Puasa Pembangunan', 19),
  ('4800', 'Dana Aksi Natal', 'KREDIT', 'PENERIMAAN', 'Aksi sosial perayaan Natal', 20),
  ('4900', 'Penerimaan Lainnya', 'KREDIT', 'PENERIMAAN', 'Penerimaan kas non-rutin lainnya', 21),
  ('5100', 'Misa', 'DEBIT', 'PENGELUARAN', 'Biaya perlengkapan perayaan ekaristi', 30),
  ('5110', 'Ibadat Sabda', 'DEBIT', 'PENGELUARAN', 'Biaya penyelenggaraan ibadat', 31),
  ('5120', 'Rosario', 'DEBIT', 'PENGELUARAN', 'Konsumsi & lilin doa rosario', 32),
  ('5130', 'Koor', 'DEBIT', 'PENGELUARAN', 'Latihan koor & fotokopi partitur', 33),
  ('5140', 'Stipendium/ Iura stolae', 'DEBIT', 'PENGELUARAN', 'Stipendium Romo & pelayan altar', 34),
  ('5150', 'Bina iman', 'DEBIT', 'PENGELUARAN', 'Kegiatan BIA / BIR anak-anak', 35),
  ('5160', 'Pendalaman kitab suci', 'DEBIT', 'PENGELUARAN', 'Bulan Kitab Suci Nasional (BKSN)', 36),
  ('5170', 'Kepemudaan', 'DEBIT', 'PENGELUARAN', 'Kegiatan Orang Muda Katolik (OMK)', 37),
  ('5180', 'Kerasulan keluarga', 'DEBIT', 'PENGELUARAN', 'Program pembinaan pasutri & keluarga', 38),
  ('5190', 'Pendidikan calon imam', 'DEBIT', 'PENGELUARAN', 'Bantuan seminari / calon imam', 39),
  ('5200', 'Rapat / pertemuan lingkungan', 'DEBIT', 'PENGELUARAN', 'Konsumsi & perlengkapan rapat warga', 40),
  ('5210', 'Perayaan (Natal / Paskah / HUT)', 'DEBIT', 'PENGELUARAN', 'Acara pesta & perayaan bersama', 41),
  ('5220', 'Inventaris (Pembelian / Pemeliharaan)', 'DEBIT', 'PENGELUARAN', 'Pengadaan & perawatan aset', 42),
  ('5230', 'Administrasi', 'DEBIT', 'PENGELUARAN', 'ATK, fotokopi buku warta, materai', 43),
  ('5240', 'Kegiatan rohani lain (retret, rekoleksi, dsb)', 'DEBIT', 'PENGELUARAN', 'Ziarah rohani, retret pengurus', 44),
  ('5250', 'Bantuan Sosial Internal (umat lingkungan)', 'DEBIT', 'PENGELUARAN', 'Santunan warga lingkungan prasejahtera', 45),
  ('5260', 'Bantuan Sosial Eksternal (umat luar lingkungan)', 'DEBIT', 'PENGELUARAN', 'Bakti sosial warga luar lingkungan', 46),
  ('5270', 'Pastoran (dahar Romo)', 'DEBIT', 'PENGELUARAN', 'Penyaluran konsumsi pastoran', 47),
  ('5280', 'Sumbangan kematian/St. Yusuf', 'DEBIT', 'PENGELUARAN', 'Bantuan kedukaan warga', 48),
  ('5290', 'Sumbangan Dana ASAK', 'DEBIT', 'PENGELUARAN', 'Penyaluran dana beasiswa ASAK', 49),
  ('5300', 'Sumbangan Dana Pastoran', 'DEBIT', 'PENGELUARAN', 'Dukungan operasional pastoran', 50),
  ('5310', 'Sumbangan Dana APP', 'DEBIT', 'PENGELUARAN', 'Penyetoran kotak APP ke paroki', 51),
  ('5320', 'Sumbangan Dana Aksi Natal', 'DEBIT', 'PENGELUARAN', 'Penyetoran aksi Natal ke paroki', 52),
  ('5340', 'Sumbangan Dana PPG', 'DEBIT', 'PENGELUARAN', 'Panitia Pembangunan Gereja', 53),
  ('5350', 'Kolekte yg disetor ke Paroki', 'DEBIT', 'PENGELUARAN', 'Penyetoran kolekte misa / ibadat ke paroki', 54),
  ('5360', 'Sumbangan Celengan CYTM', 'DEBIT', 'PENGELUARAN', 'Penyetoran/sumbangan celengan CYTM ke Paroki', 55),
  ('5900', 'Pengeluaran lainnya', 'DEBIT', 'PENGELUARAN', 'Pengeluaran operasional lain-lain', 56)
ON CONFLICT (id) DO UPDATE SET 
  nama_akun = EXCLUDED.nama_akun, 
  tipe = EXCLUDED.tipe,
  kategori = EXCLUDED.kategori,
  nature = EXCLUDED.nature,
  urutan = EXCLUDED.urutan;

-- ==============================================================================
-- SEED DATA 3: KRITERIA GOLONGAN DUPRAS KAJ
-- ==============================================================================
INSERT INTO public.kriteria_golongan (id, nama, badge_color, bg_light, border_light, text_color, icon_emoji, subjudul, garis_pengeluaran, tahap_metode, indikator, contoh_kondisi, rekomendasi_bantuan, is_default, urutan)
VALUES
('tidak-mampu', 'Tidak Mampu', 'bg-rose-500', 'bg-rose-50', 'border-rose-200', 'text-rose-700', '🆘', 'Keluarga Miskin Absolut / Sangat Membutuhkan', '< Rp 800.000 / kapita / bulan', 'Bantuan Langsung Tunai (BLT) & Pangan', 'Tidak memiliki penghasilan tetap, makan < 2x sehari, tempat tinggal tidak layak', 'Lansia sebatang kara, keluarga dengan disabilitas berat tanpa pencari nafkah', 'Bantuan sembako rutin bulanan, santunan kesehatan paroki, pembebasan iuran', true, 1),
('rentan-tidak-mampu', 'Rentan Tidak Mampu', 'bg-amber-500', 'bg-amber-50', 'border-amber-200', 'text-amber-700', '⚠️', 'Keluarga Prasejahtera / Rentan Jatuh Miskin', 'Rp 800.000 - Rp 1.500.000 / kapita / bulan', 'Pendampingan & Subsidi Terarah', 'Pekerja serabutan, buruh harian lepas, tanggungan anak sekolah banyak', 'Keluarga buruh kontrak dengan 3 anak sekolah, terancam putus sekolah saat sakit', 'Beasiswa ASAK (Ayo Sekolah Ayo Kuliah), subsidi iuran dana solidaritas', true, 2),
('terduga-prasejahtera', 'Terduga Pra Sejahtera', 'bg-blue-500', 'bg-blue-50', 'border-blue-200', 'text-blue-700', '🔍', 'Keluarga Menengah Bawah / Butuh Pemantauan', 'Rp 1.500.000 - Rp 2.500.000 / kapita / bulan', 'Monitoring Berkala oleh Tim Caritas', 'Penghasilan pas-pasan, memiliki tanggungan cicilan atau anggota keluarga berobat jalan', 'Keluarga karyawan kontrak dengan tanggungan orang tua sakit menahun', 'Prioritas bursa kerja paroki, pelatihan keterampilan wirausaha', true, 3),
('sejahtera', 'Sejahtera', 'bg-emerald-500', 'bg-emerald-50', 'border-emerald-200', 'text-emerald-700', '✅', 'Keluarga Mandiri / Berkemampuan Membantu', '> Rp 2.500.000 / kapita / bulan', 'Pemberdayaan Donatur & Relawan', 'Penghasilan tetap di atas UMR per kapita, memiliki tabungan & aset produktif', 'Karyawan tetap, profesional, pengusaha dengan kondisi finansial stabil', 'Pemberdayaan sebagai donatur tetap Aksi Peduli Paroki dan orang tua asuh ASAK', true, 4)
ON CONFLICT (id) DO UPDATE SET
  nama = EXCLUDED.nama,
  badge_color = EXCLUDED.badge_color,
  bg_light = EXCLUDED.bg_light,
  border_light = EXCLUDED.border_light,
  text_color = EXCLUDED.text_color,
  subjudul = EXCLUDED.subjudul,
  garis_pengeluaran = EXCLUDED.garis_pengeluaran,
  tahap_metode = EXCLUDED.tahap_metode,
  indikator = EXCLUDED.indikator,
  contoh_kondisi = EXCLUDED.contoh_kondisi,
  rekomendasi_bantuan = EXCLUDED.rekomendasi_bantuan;

-- ==============================================================================
-- SEED DATA 4: 21 FORMULIR & BLANKO DOKUMEN RESMI PAROKI
-- ==============================================================================
INSERT INTO public.dokumen_paroki (kode_form, nama_dokumen, file_name, file_path, file_size_bytes, mime_type, keterangan) VALUES
('BLANKO BIDUK', 'BLANKO BIDUK', 'BLANKO BIDUK.pdf', '/kop-surat-asli/BLANKO BIDUK.pdf', 69850, 'application/pdf', 'Dokumen blanko resmi Sekretariat Paroki Santa Clara'),
('FORM01', 'FORM01 - SAKRAMEN BAPTIS BAYI[1] - REV 040525', 'FORM01_-_SAKRAMEN_BAPTIS_BAYI[1] - REV 040525.pdf', '/kop-surat-asli/FORM01_-_SAKRAMEN_BAPTIS_BAYI[1] - REV 040525.pdf', 172827, 'application/pdf', 'Dokumen blanko resmi Sekretariat Paroki Santa Clara'),
('FORM02', 'FORM02 - FORMULIR CALON KATEKUMEN', 'FORM02 - FORMULIR CALON KATEKUMEN.pdf', '/kop-surat-asli/FORM02 - FORMULIR CALON KATEKUMEN.pdf', 149884, 'application/pdf', 'Dokumen blanko resmi Sekretariat Paroki Santa Clara'),
('FORM03', 'FORM03 - BAPTIS DARURAT', 'FORM03 - BAPTIS DARURAT.pdf', '/kop-surat-asli/FORM03 - BAPTIS DARURAT.pdf', 86261, 'application/pdf', 'Dokumen blanko resmi Sekretariat Paroki Santa Clara'),
('FORM05', 'FORM05 - PERNYATAAN MEMBERI IZIN ANAK UNTUK MENIKAH SECARA KATOLIK', 'FORM05 - PERNYATAAN MEMBERI IZIN ANAK UNTUK MENIKAH SECARA KATOLIK.pdf', '/kop-surat-asli/FORM05 - PERNYATAAN MEMBERI IZIN ANAK UNTUK MENIKAH SECARA KATOLIK.pdf', 63169, 'application/pdf', 'Dokumen blanko resmi Sekretariat Paroki Santa Clara'),
('FORM05A', 'FORM05a - PERNYATAAN MEMBERI IZIN ANAK UNTUK MENJADI KATOLIK', 'FORM05a - PERNYATAAN MEMBERI IZIN ANAK UNTUK MENJADI KATOLIK.pdf', '/kop-surat-asli/FORM05a - PERNYATAAN MEMBERI IZIN ANAK UNTUK MENJADI KATOLIK.pdf', 63001, 'application/pdf', 'Dokumen blanko resmi Sekretariat Paroki Santa Clara'),
('FORM06', 'FORM06 - KOMUNI PERTAMA[1] - REV 040525', 'FORM06_-_KOMUNI_PERTAMA[1] - REV 040525.pdf', '/kop-surat-asli/FORM06_-_KOMUNI_PERTAMA[1] - REV 040525.pdf', 76075, 'application/pdf', 'Dokumen blanko resmi Sekretariat Paroki Santa Clara'),
('FORM07', 'FORM07 - SAKRAMEN PENGUATAN[1] - REV 040525', 'FORM07_-_SAKRAMEN_PENGUATAN[1] - REV 040525.pdf', '/kop-surat-asli/FORM07_-_SAKRAMEN_PENGUATAN[1] - REV 040525.pdf', 77692, 'application/pdf', 'Dokumen blanko resmi Sekretariat Paroki Santa Clara'),
('FORM08', 'FORM08 - PENDAFTARAN PERKAWINAN', 'FORM08 - PENDAFTARAN PERKAWINAN.pdf', '/kop-surat-asli/FORM08 - PENDAFTARAN PERKAWINAN.pdf', 222047, 'application/pdf', 'Dokumen blanko resmi Sekretariat Paroki Santa Clara'),
('FORM09', 'FORM09 - SURAT PENGANTAR LINGKUNGAN KEPERLUAN PERSIAPAN PERKAWINAN KATOLIK', 'FORM09 - SURAT PENGANTAR LINGKUNGAN KEPERLUAN PERSIAPAN PERKAWINAN KATOLIK.pdf', '/kop-surat-asli/FORM09 - SURAT PENGANTAR LINGKUNGAN KEPERLUAN PERSIAPAN PERKAWINAN KATOLIK.pdf', 64494, 'application/pdf', 'Dokumen blanko resmi Sekretariat Paroki Santa Clara'),
('FORM10', 'FORM10 - SURAT KETERANGAN DOMISILI UNTUK PERKAWINAN', 'FORM10 - SURAT KETERANGAN DOMISILI UNTUK PERKAWINAN.pdf', '/kop-surat-asli/FORM10 - SURAT KETERANGAN DOMISILI UNTUK PERKAWINAN.pdf', 61383, 'application/pdf', 'Dokumen blanko resmi Sekretariat Paroki Santa Clara'),
('FORM10A', 'FORM10a - SURAT PENGANTAR LINGKUNGAN UMUM', 'FORM10a - SURAT PENGANTAR LINGKUNGAN UMUM.pdf', '/kop-surat-asli/FORM10a - SURAT PENGANTAR LINGKUNGAN UMUM.pdf', 67869, 'application/pdf', 'Dokumen blanko resmi Sekretariat Paroki Santa Clara'),
('FORM12', 'FORM12 - FORMULIR MEMBANGUN RUMAH TANGGA', 'FORM12 - FORMULIR MEMBANGUN RUMAH TANGGA.pdf', '/kop-surat-asli/FORM12 - FORMULIR MEMBANGUN RUMAH TANGGA.pdf', 90239, 'application/pdf', 'Dokumen blanko resmi Sekretariat Paroki Santa Clara'),
('FORM14', 'FORM14 - FORMULIR PEMBAHARUAN PERKAWINAN', 'FORM14 - FORMULIR PEMBAHARUAN PERKAWINAN.pdf', '/kop-surat-asli/FORM14 - FORMULIR PEMBAHARUAN PERKAWINAN.pdf', 88324, 'application/pdf', 'Dokumen blanko resmi Sekretariat Paroki Santa Clara'),
('FORM16', 'FORM16 - LAPORAN PENERIMAAN SAKRAMEN PENGURAPAN ORANG SAKIT', 'FORM16 - LAPORAN PENERIMAAN SAKRAMEN PENGURAPAN ORANG SAKIT.pdf', '/kop-surat-asli/FORM16 - LAPORAN PENERIMAAN SAKRAMEN PENGURAPAN ORANG SAKIT.pdf', 82661, 'application/pdf', 'Dokumen blanko resmi Sekretariat Paroki Santa Clara'),
('FORM17', 'FORM17 - LAPORAN KEMATIAN', 'FORM17 - LAPORAN KEMATIAN.pdf', '/kop-surat-asli/FORM17 - LAPORAN KEMATIAN.pdf', 170723, 'application/pdf', 'Dokumen blanko resmi Sekretariat Paroki Santa Clara'),
('FORM18', 'FORM18 - FORMULIR PINDAH DOMISILI KK', 'FORM18 - FORMULIR PINDAH DOMISILI KK.pdf', '/kop-surat-asli/FORM18 - FORMULIR PINDAH DOMISILI KK.pdf', 13724, 'application/pdf', 'Dokumen blanko resmi Sekretariat Paroki Santa Clara'),
('FORM19', 'FORM19 - PENAMBAHAN ANGGOTA KK', 'FORM19 - PENAMBAHAN ANGGOTA KK.pdf', '/kop-surat-asli/FORM19 - PENAMBAHAN ANGGOTA KK.pdf', 19793, 'application/pdf', 'Dokumen blanko resmi Sekretariat Paroki Santa Clara'),
('FORM20', 'FORM20 - CETAK ULANG KK', 'FORM20 - CETAK ULANG KK.pdf', '/kop-surat-asli/FORM20 - CETAK ULANG KK.pdf', 14601, 'application/pdf', 'Dokumen blanko resmi Sekretariat Paroki Santa Clara'),
('PINJAM_ALAT', 'Formulir Peminjaman Peralatan Paroki', 'Formulir Peminjaman Peralatan Paroki.pdf', '/kop-surat-asli/Formulir Peminjaman Peralatan Paroki.pdf', 67376, 'application/pdf', 'Dokumen blanko resmi Sekretariat Paroki Santa Clara'),
('PRODIAKON', 'FORMULIR PENDAFTARAN PRODIAKON', 'FORMULIR PENDAFTARAN PRODIAKON.pdf', '/kop-surat-asli/FORMULIR PENDAFTARAN PRODIAKON.pdf', 28763, 'application/pdf', 'Dokumen blanko resmi Sekretariat Paroki Santa Clara')
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- SEED DATA 5: INISIALISASI PROFIL LINGKUNGAN (69 LINGKUNGAN)
-- ==============================================================================
INSERT INTO public.profil_lingkungan (lingkungan_id, periode_masa_bakti, status, tahun_buku, bulan_saldo, saldo_awal)
SELECT id, '2024 - 2026', 'Aktif', '2026', 1, 0.00
FROM public.lingkungan
ON CONFLICT (lingkungan_id) DO NOTHING;

-- ==============================================================================
-- SEED DATA 6: USER & LOGIN SYSTEM (PASSWORD: Paroki321)
-- ==============================================================================
-- 1. Akun Paroki & Sekretaris Paroki
INSERT INTO public.users (id, username, password, role, lingkungan_id)
VALUES 
  (gen_random_uuid(), 'paroki', 'Paroki321', 'PAROKI', NULL),
  (gen_random_uuid(), 'sekretaris_paroki', 'Paroki321', 'SEKRETARIS_PAROKI', NULL),
  (gen_random_uuid(), 'sekertaris_paroki', 'Paroki321', 'SEKRETARIS_PAROKI', NULL)
ON CONFLICT (username) DO UPDATE 
  SET password = EXCLUDED.password, role = EXCLUDED.role;

-- 2. Otomatisasi Akun Sekretaris & Bendahara untuk seluruh 69 Lingkungan
DO $$
DECLARE
  ling RECORD;
  clean_slug TEXT;
  raw_name TEXT;
  total_lingkungan INT := 0;
BEGIN
  FOR ling IN SELECT id, nama_lingkungan FROM public.lingkungan ORDER BY nama_lingkungan LOOP
    -- Standarisasi nama: "Padre Pio 1" -> "padrepio1"
    raw_name := lower(ling.nama_lingkungan);
    raw_name := regexp_replace(raw_name, '^lingkungan\s+', '', 'i');
    raw_name := regexp_replace(raw_name, 'st\.\s*', 'st', 'gi');
    clean_slug := regexp_replace(raw_name, '[^a-z0-9]', '', 'g');

    -- Akun Sekretaris (mendukung kedua variasi: sekretaris_ & sekertaris_)
    INSERT INTO public.users (id, username, password, role, lingkungan_id)
    VALUES (gen_random_uuid(), 'sekretaris_' || clean_slug, 'Paroki321', 'SEKRETARIS', ling.id)
    ON CONFLICT (username) DO UPDATE 
      SET password = EXCLUDED.password, role = EXCLUDED.role, lingkungan_id = EXCLUDED.lingkungan_id;

    INSERT INTO public.users (id, username, password, role, lingkungan_id)
    VALUES (gen_random_uuid(), 'sekertaris_' || clean_slug, 'Paroki321', 'SEKRETARIS', ling.id)
    ON CONFLICT (username) DO UPDATE 
      SET password = EXCLUDED.password, role = EXCLUDED.role, lingkungan_id = EXCLUDED.lingkungan_id;

    -- Akun Bendahara
    INSERT INTO public.users (id, username, password, role, lingkungan_id)
    VALUES (gen_random_uuid(), 'bendahara_' || clean_slug, 'Paroki321', 'BENDAHARA', ling.id)
    ON CONFLICT (username) DO UPDATE 
      SET password = EXCLUDED.password, role = EXCLUDED.role, lingkungan_id = EXCLUDED.lingkungan_id;

    total_lingkungan := total_lingkungan + 1;
  END LOOP;

  RAISE NOTICE 'Selesai! Akun berhasil disiapkan untuk % lingkungan.', total_lingkungan;
END $$;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.lingkungan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kriteria_golongan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dokumen_paroki ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kepala_keluarga ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anggota_keluarga ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.golongan_keluarga ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profil_lingkungan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aset ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jurnal_transaksi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dafu_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riwayat_import_dafu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for LINGKUNGAN" ON public.lingkungan;
CREATE POLICY "Enable all access for LINGKUNGAN" ON public.lingkungan FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for COA" ON public.coa;
CREATE POLICY "Enable all access for COA" ON public.coa FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for KRITERIA_GOLONGAN" ON public.kriteria_golongan;
CREATE POLICY "Enable all access for KRITERIA_GOLONGAN" ON public.kriteria_golongan FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for DOKUMEN_PAROKI" ON public.dokumen_paroki;
CREATE POLICY "Enable all access for DOKUMEN_PAROKI" ON public.dokumen_paroki FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for KEPALA_KELUARGA" ON public.kepala_keluarga;
CREATE POLICY "Enable all access for KEPALA_KELUARGA" ON public.kepala_keluarga FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for ANGGOTA_KELUARGA" ON public.anggota_keluarga;
CREATE POLICY "Enable all access for ANGGOTA_KELUARGA" ON public.anggota_keluarga FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for GOLONGAN_KELUARGA" ON public.golongan_keluarga;
CREATE POLICY "Enable all access for GOLONGAN_KELUARGA" ON public.golongan_keluarga FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for PROFIL_LINGKUNGAN" ON public.profil_lingkungan;
CREATE POLICY "Enable all access for PROFIL_LINGKUNGAN" ON public.profil_lingkungan FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for ASET" ON public.aset;
CREATE POLICY "Enable all access for ASET" ON public.aset FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for JURNAL_TRANSAKSI" ON public.jurnal_transaksi;
CREATE POLICY "Enable all access for JURNAL_TRANSAKSI" ON public.jurnal_transaksi FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for DAFU_APPROVALS" ON public.dafu_approvals;
CREATE POLICY "Enable all access for DAFU_APPROVALS" ON public.dafu_approvals FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for RIWAYAT_IMPORT_DAFU" ON public.riwayat_import_dafu;
CREATE POLICY "Enable all access for RIWAYAT_IMPORT_DAFU" ON public.riwayat_import_dafu FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for USERS" ON public.users;
CREATE POLICY "Enable all access for USERS" ON public.users FOR ALL USING (true) WITH CHECK (true);

COMMIT;

-- ==============================================================================
-- CEK REKAP TABEL & AKUN SETELAH MIGRASI
-- ==============================================================================
SELECT 'lingkungan' AS tabel, count(*) AS total FROM public.lingkungan
UNION ALL
SELECT 'coa' AS tabel, count(*) AS total FROM public.coa
UNION ALL
SELECT 'kriteria_golongan' AS tabel, count(*) AS total FROM public.kriteria_golongan
UNION ALL
SELECT 'dokumen_paroki' AS tabel, count(*) AS total FROM public.dokumen_paroki
UNION ALL
SELECT 'profil_lingkungan' AS tabel, count(*) AS total FROM public.profil_lingkungan
UNION ALL
SELECT 'users' AS tabel, count(*) AS total FROM public.users;
