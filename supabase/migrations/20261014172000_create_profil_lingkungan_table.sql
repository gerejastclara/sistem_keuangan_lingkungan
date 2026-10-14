-- ==============================================================================
-- MIGRATION: CREATE PROFIL_LINGKUNGAN TABLE (LENGKAP DENGAN PENGURUS & RLS)
-- ==============================================================================

-- 1. Ekstensi UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Buat tabel PROFIL_LINGKUNGAN dari nol secara lengkap
CREATE TABLE IF NOT EXISTS public.profil_lingkungan (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lingkungan_id UUID NOT NULL REFERENCES public.lingkungan(id) ON DELETE CASCADE,
    
    -- Informasi Nama & Kontak Pengurus Lingkungan
    ketua_nama TEXT,
    telepon_ketua VARCHAR(30),
    bendahara_nama TEXT,
    telepon_bendahara VARCHAR(30),
    sekretaris_nama TEXT,
    telepon_sekretaris VARCHAR(30),
    periode_masa_bakti VARCHAR(50) DEFAULT '2024 - 2026',
    status VARCHAR(50) DEFAULT 'Aktif',
    
    -- Relasi opsional ke Kepala Keluarga
    ketua_id UUID REFERENCES public.kepala_keluarga(id) ON DELETE SET NULL,
    sekretaris_id UUID REFERENCES public.kepala_keluarga(id) ON DELETE SET NULL,
    bendahara_id UUID REFERENCES public.kepala_keluarga(id) ON DELETE SET NULL,
    
    -- Informasi Keuangan & Saldo Awal
    saldo_awal DECIMAL(15,2) DEFAULT 0.00,
    tahun_buku VARCHAR(4) DEFAULT '2026',
    bulan_saldo INT DEFAULT 1,
    
    -- Informasi Rekening Lingkungan
    is_hub_kerabat BOOLEAN DEFAULT FALSE,
    is_bendahara_kaj BOOLEAN DEFAULT FALSE,
    jenis_rekening VARCHAR(100),
    nama_bank VARCHAR(100),
    no_rekening VARCHAR(100),
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint Unique agar 1 lingkungan memiliki 1 profil
    CONSTRAINT profil_lingkungan_lingkungan_id_key UNIQUE (lingkungan_id)
);

-- 3. Buka izin akses Row Level Security (RLS)
ALTER TABLE public.profil_lingkungan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for PROFIL_LINGKUNGAN" ON public.profil_lingkungan;
DROP POLICY IF EXISTS "SEKRETARIS and BENDAHARA can update PROFIL_LINGKUNGAN" ON public.profil_lingkungan;
DROP POLICY IF EXISTS "SEKRETARIS, BENDAHARA, PAROKI can view PROFIL_LINGKUNGAN" ON public.profil_lingkungan;

CREATE POLICY "Enable all access for PROFIL_LINGKUNGAN" ON public.profil_lingkungan
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Seed data awal pengurus untuk Padre Pio 1
INSERT INTO public.profil_lingkungan (
    lingkungan_id,
    ketua_nama,
    telepon_ketua,
    bendahara_nama,
    telepon_bendahara,
    sekretaris_nama,
    telepon_sekretaris,
    periode_masa_bakti,
    status
)
VALUES (
    'da1b6d3b-db10-48cc-8159-b211dffc3c22',
    'Aegidius Agus Riyanta',
    '021-8921434',
    'Anastasia Asiah',
    '021-89132978',
    'Antonius Rachmadi',
    '083897600636',
    '2024 - 2026',
    'Aktif'
)
ON CONFLICT (lingkungan_id) DO UPDATE SET
    ketua_nama = EXCLUDED.ketua_nama,
    telepon_ketua = EXCLUDED.telepon_ketua,
    bendahara_nama = EXCLUDED.bendahara_nama,
    telepon_bendahara = EXCLUDED.telepon_bendahara,
    sekretaris_nama = EXCLUDED.sekretaris_nama,
    telepon_sekretaris = EXCLUDED.telepon_sekretaris,
    periode_masa_bakti = EXCLUDED.periode_masa_bakti,
    status = EXCLUDED.status;
