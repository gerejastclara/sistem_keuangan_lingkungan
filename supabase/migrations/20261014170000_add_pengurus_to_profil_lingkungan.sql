-- ==============================================================================
-- MIGRATION: INTEGRASI PROFIL PENGURUS LINGKUNGAN KE DATABASE SUPABASE
-- ==============================================================================
-- Migration ini menambahkan kolom informasi nama pengurus, kontak, dan status
-- ke tabel public.profil_lingkungan agar data yang diisi oleh Sekretaris
-- otomatis tersinkronisasi ke Bendahara dan Paroki secara cloud.

-- 1. Tambah kolom pengurus ke tabel PROFIL_LINGKUNGAN jika belum ada
ALTER TABLE public.profil_lingkungan 
  ADD COLUMN IF NOT EXISTS ketua_nama TEXT,
  ADD COLUMN IF NOT EXISTS bendahara_nama TEXT,
  ADD COLUMN IF NOT EXISTS sekretaris_nama TEXT,
  ADD COLUMN IF NOT EXISTS telepon_ketua VARCHAR(30),
  ADD COLUMN IF NOT EXISTS telepon_sekretaris VARCHAR(30),
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Aktif';

-- 2. Pastikan RLS (Row Level Security) mengizinkan akses simpan dan baca (CRUD)
ALTER TABLE public.profil_lingkungan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for PROFIL_LINGKUNGAN" ON public.profil_lingkungan;
DROP POLICY IF EXISTS "SEKRETARIS and BENDAHARA can update PROFIL_LINGKUNGAN" ON public.profil_lingkungan;
DROP POLICY IF EXISTS "SEKRETARIS, BENDAHARA, PAROKI can view PROFIL_LINGKUNGAN" ON public.profil_lingkungan;

CREATE POLICY "Enable all access for PROFIL_LINGKUNGAN" ON public.profil_lingkungan
  FOR ALL
  USING (true)
  WITH CHECK (true);
