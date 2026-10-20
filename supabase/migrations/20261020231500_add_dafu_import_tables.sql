-- ==============================================================================
-- MIGRATION: DAFU EXCEL/CSV IMPORT & ENHANCED UMAT SCHEMA (SELF-CONTAINED)
-- Paroki Santa Clara - Bekasi Utara
-- Skrip ini otomatis membuat tabel jika belum ada (CREATE TABLE IF NOT EXISTS)
-- dan menambahkan kolom baru jika tabel sudah ada.
-- Menggunakan tipe UUID yang konsisten dengan relasi database PostgreSQL / Supabase.
-- ==============================================================================

BEGIN;

-- 1. Ekstensi UUID & Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Pastikan tabel LINGKUNGAN ada
CREATE TABLE IF NOT EXISTS public.lingkungan (
    id UUID PRIMARY KEY,
    nama_lingkungan VARCHAR(255) NOT NULL,
    wilayah VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Pastikan tabel KEPALA_KELUARGA ada dan memiliki kolom pendukung
CREATE TABLE IF NOT EXISTS public.kepala_keluarga (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lingkungan_id UUID NOT NULL REFERENCES public.lingkungan(id) ON DELETE CASCADE,
    nama_kk VARCHAR(255) NOT NULL,
    no_kk VARCHAR(50),
    alamat TEXT,
    telepon VARCHAR(50),
    is_biduk BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tambahkan kolom no_kk, telepon, created_at jika tabel sudah ada sebelumnya
ALTER TABLE public.kepala_keluarga 
  ADD COLUMN IF NOT EXISTS no_kk VARCHAR(50),
  ADD COLUMN IF NOT EXISTS telepon VARCHAR(50),
  ADD COLUMN IF NOT EXISTS is_biduk BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_kk_lingkungan_id ON public.kepala_keluarga(lingkungan_id);
CREATE INDEX IF NOT EXISTS idx_kk_no_kk ON public.kepala_keluarga(no_kk);

-- 4. Pastikan tabel ANGGOTA_KELUARGA ada (menggunakan kk_id tipe UUID)
CREATE TABLE IF NOT EXISTS public.anggota_keluarga (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kk_id UUID NOT NULL REFERENCES public.kepala_keluarga(id) ON DELETE CASCADE,
    no_anggota VARCHAR(50),
    nama VARCHAR(255) NOT NULL,
    peran VARCHAR(50) NOT NULL DEFAULT 'Anak',
    jenis_kelamin VARCHAR(10),
    is_kaj BOOLEAN DEFAULT TRUE,
    keterangan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.anggota_keluarga 
  ADD COLUMN IF NOT EXISTS no_anggota VARCHAR(50),
  ADD COLUMN IF NOT EXISTS jenis_kelamin VARCHAR(10),
  ADD COLUMN IF NOT EXISTS is_kaj BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS keterangan TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_anggota_kk_id ON public.anggota_keluarga(kk_id);
CREATE INDEX IF NOT EXISTS idx_anggota_no_anggota ON public.anggota_keluarga(no_anggota);

-- 5. Pastikan tabel GOLONGAN_KELUARGA ada (Desil / Klasifikasi Ekonomi Umat)
CREATE TABLE IF NOT EXISTS public.golongan_keluarga (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kk_id UUID NOT NULL UNIQUE REFERENCES public.kepala_keluarga(id) ON DELETE CASCADE,
    lingkungan_id UUID NOT NULL REFERENCES public.lingkungan(id) ON DELETE CASCADE,
    golongan VARCHAR(50) NOT NULL DEFAULT 'Sejahtera',
    kriteria_catatan TEXT,
    updated_by_role VARCHAR(50) DEFAULT 'SEKRETARIS',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_golongan_kk_id ON public.golongan_keluarga(kk_id);
CREATE INDEX IF NOT EXISTS idx_golongan_lingkungan_id ON public.golongan_keluarga(lingkungan_id);

-- 6. Buat tabel RIWAYAT_IMPORT_DAFU (Audit log unggahan file DAFU)
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

-- 7. Pastikan tabel KRITERIA_GOLONGAN & DOKUMEN_PAROKI ada
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

-- 8. Seed awal Pedoman Kriteria DUPRAS KAJ
INSERT INTO public.kriteria_golongan (id, nama, badge_color, bg_light, border_light, text_color, icon_emoji, subjudul, garis_pengeluaran, tahap_metode, indikator, contoh_kondisi, rekomendasi_bantuan, is_default, urutan)
VALUES
('tidak-mampu', 'Tidak Mampu', 'bg-rose-500', 'bg-rose-50', 'border-rose-200', 'text-rose-700', '🔴', 'Keluarga Miskin Absolut / Sangat Membutuhkan', '< Rp 800.000 / kapita / bulan', 'Bantuan Langsung Tunai (BLT) & Pangan', 'Tidak memiliki penghasilan tetap, makan < 2x sehari, tempat tinggal tidak layak', 'Lansia sebatang kara, keluarga dengan disabilitas berat tanpa pencari nafkah', 'Bantuan sembako rutin bulanan, santunan kesehatan paroki, pembebasan iuran', true, 1),
('rentan-tidak-mampu', 'Rentan Tidak Mampu', 'bg-amber-500', 'bg-amber-50', 'border-amber-200', 'text-amber-700', '🟡', 'Keluarga Prasejahtera / Rentan Jatuh Miskin', 'Rp 800.000 - Rp 1.500.000 / kapita / bulan', 'Pendampingan & Subsidi Terarah', 'Pekerja serabutan, buruh harian lepas, tanggungan anak sekolah banyak', 'Keluarga buruh kontrak dengan 3 anak sekolah, terancam putus sekolah saat sakit', 'Beasiswa ASAK (Ayo Sekolah Ayo Kuliah), subsidi iuran dana solidaritas', true, 2),
('terduga-prasejahtera', 'Terduga Pra Sejahtera', 'bg-blue-500', 'bg-blue-50', 'border-blue-200', 'text-blue-700', '🔵', 'Keluarga Menengah Bawah / Butuh Pemantauan', 'Rp 1.500.000 - Rp 2.500.000 / kapita / bulan', 'Monitoring Berkala oleh Tim Caritas', 'Penghasilan pas-pasan, memiliki tanggungan cicilan atau anggota keluarga berobat jalan', 'Keluarga karyawan kontrak dengan tanggungan orang tua sakit menahun', 'Prioritas bursa kerja paroki, pelatihan keterampilan wirausaha', true, 3),
('sejahtera', 'Sejahtera', 'bg-emerald-500', 'bg-emerald-50', 'border-emerald-200', 'text-emerald-700', '🟢', 'Keluarga Mandiri / Berkemampuan Membantu', '> Rp 2.500.000 / kapita / bulan', 'Pemberdayaan Donatur & Relawan', 'Penghasilan tetap di atas UMR per kapita, memiliki tabungan & aset produktif', 'Karyawan tetap, profesional, pengusaha dengan kondisi finansial stabil', 'Pemberdayaan sebagai donatur tetap Aksi Peduli Paroki dan orang tua asuh ASAK', true, 4)
ON CONFLICT (id) DO NOTHING;

-- 9. Row Level Security (RLS) - Buka akses operasional sistem keuangan & DAFU
ALTER TABLE public.kepala_keluarga ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anggota_keluarga ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.golongan_keluarga ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riwayat_import_dafu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kriteria_golongan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dokumen_paroki ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for KEPALA_KELUARGA" ON public.kepala_keluarga;
CREATE POLICY "Enable all access for KEPALA_KELUARGA" ON public.kepala_keluarga FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for ANGGOTA_KELUARGA" ON public.anggota_keluarga;
CREATE POLICY "Enable all access for ANGGOTA_KELUARGA" ON public.anggota_keluarga FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for GOLONGAN_KELUARGA" ON public.golongan_keluarga;
CREATE POLICY "Enable all access for GOLONGAN_KELUARGA" ON public.golongan_keluarga FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for RIWAYAT_IMPORT_DAFU" ON public.riwayat_import_dafu;
CREATE POLICY "Enable all access for RIWAYAT_IMPORT_DAFU" ON public.riwayat_import_dafu FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for KRITERIA_GOLONGAN" ON public.kriteria_golongan;
CREATE POLICY "Enable all access for KRITERIA_GOLONGAN" ON public.kriteria_golongan FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for DOKUMEN_PAROKI" ON public.dokumen_paroki;
CREATE POLICY "Enable all access for DOKUMEN_PAROKI" ON public.dokumen_paroki FOR ALL USING (true) WITH CHECK (true);

COMMIT;
