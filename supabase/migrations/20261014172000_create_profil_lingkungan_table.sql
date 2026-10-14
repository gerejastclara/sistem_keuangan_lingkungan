-- ==============================================================================
-- MIGRATION: TABEL PROFIL_LINGKUNGAN KHUSUS PENGURUS LINGKUNGAN
-- ==============================================================================
-- Tabel ini murni untuk menampung susunan pengurus lingkungan:
-- Ketua, Sekretaris, Bendahara, Periode Masa Bakti, dan Status.
-- Tanpa kolom keuangan.

-- 1. Pastikan ekstensi UUID aktif
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Buat tabel PROFIL_LINGKUNGAN khusus pengurus
DROP TABLE IF EXISTS public.profil_lingkungan CASCADE;

CREATE TABLE public.profil_lingkungan (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lingkungan_id UUID NOT NULL REFERENCES public.lingkungan(id) ON DELETE CASCADE,
    
    -- Ketua Lingkungan
    ketua_nama TEXT,
    telepon_ketua VARCHAR(30),
    
    -- Sekretaris Lingkungan
    sekretaris_nama TEXT,
    telepon_sekretaris VARCHAR(30),
    
    -- Bendahara Lingkungan
    bendahara_nama TEXT,
    telepon_bendahara VARCHAR(30),
    
    -- Masa Bakti & Status
    periode_masa_bakti VARCHAR(50) DEFAULT '2024 - 2026',
    status VARCHAR(50) DEFAULT 'Aktif',
    
    -- Constraint agar 1 lingkungan memiliki 1 baris susunan pengurus
    CONSTRAINT profil_lingkungan_lingkungan_id_key UNIQUE (lingkungan_id)
);

-- 3. Buka izin akses Row Level Security (RLS)
ALTER TABLE public.profil_lingkungan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for PROFIL_LINGKUNGAN" ON public.profil_lingkungan;
CREATE POLICY "Enable all access for PROFIL_LINGKUNGAN" ON public.profil_lingkungan
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Masukkan data susunan pengurus Padre Pio 1
INSERT INTO public.profil_lingkungan (
    lingkungan_id,
    ketua_nama,
    telepon_ketua,
    sekretaris_nama,
    telepon_sekretaris,
    bendahara_nama,
    telepon_bendahara,
    periode_masa_bakti,
    status
)
VALUES (
    'da1b6d3b-db10-48cc-8159-b211dffc3c22',
    'Aegidius Agus Riyanta',
    '021-8921434',
    'Antonius Rachmadi',
    '083897600636',
    'Anastasia Asiah',
    '021-89132978',
    '2024 - 2026',
    'Aktif'
)
ON CONFLICT (lingkungan_id) DO UPDATE SET
    ketua_nama = EXCLUDED.ketua_nama,
    telepon_ketua = EXCLUDED.telepon_ketua,
    sekretaris_nama = EXCLUDED.sekretaris_nama,
    telepon_sekretaris = EXCLUDED.telepon_sekretaris,
    bendahara_nama = EXCLUDED.bendahara_nama,
    telepon_bendahara = EXCLUDED.telepon_bendahara,
    periode_masa_bakti = EXCLUDED.periode_masa_bakti,
    status = EXCLUDED.status;
