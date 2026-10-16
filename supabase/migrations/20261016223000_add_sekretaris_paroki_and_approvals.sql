-- ==============================================================================
-- MIGRATION: USER SEKRETARIS PAROKI & TABEL APPROVAL DAFU
-- Paroki Santa Clara - Bekasi Utara
-- ==============================================================================

-- 1. Perbarui batasan role pada tabel public.users agar menerima role SEKRETARIS_PAROKI
-- Catatan: Jangan ubah tipe kolom role agar tidak bentrok dengan RLS policy kepala_keluarga
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('BENDAHARA', 'SEKRETARIS', 'PAROKI', 'SEKRETARIS_PAROKI'));

-- Pastikan indeks unik pada username tersedia
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON public.users(username);

-- 2. Tambah / Perbarui Akun Sekretaris Paroki ke tabel public.users
INSERT INTO public.users (id, username, password, role, lingkungan_id)
VALUES 
  (gen_random_uuid(), 'sekretaris_paroki', 'Paroki321', 'SEKRETARIS_PAROKI', NULL)
ON CONFLICT (username) DO UPDATE 
  SET role = 'SEKRETARIS_PAROKI', password = 'Paroki321';

INSERT INTO public.users (id, username, password, role, lingkungan_id)
VALUES 
  (gen_random_uuid(), 'sekertaris_paroki', 'Paroki321', 'SEKRETARIS_PAROKI', NULL)
ON CONFLICT (username) DO UPDATE 
  SET role = 'SEKRETARIS_PAROKI', password = 'Paroki321';

-- 3. Buat Tabel DAFU Approvals untuk mencatat riwayat dan status persetujuan
CREATE TABLE IF NOT EXISTS public.dafu_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lingkungan_id TEXT,
  nama_lingkungan TEXT NOT NULL,
  kk_id TEXT,
  action_type VARCHAR(50) NOT NULL DEFAULT 'TAMBAH_KK',
  nama_kk TEXT NOT NULL,
  alamat TEXT,
  is_biduk BOOLEAN DEFAULT true,
  golongan VARCHAR(100) DEFAULT 'Sejahtera',
  kriteria_catatan TEXT,
  anggota_keluarga JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  catatan_paroki TEXT,
  submitted_by VARCHAR(100),
  reviewed_by VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  is_read BOOLEAN DEFAULT false
);

-- 4. Buka izin akses RLS agar dapat dibaca & diupdate oleh Sekretaris Paroki & Sekretaris Lingkungan
ALTER TABLE public.dafu_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for DAFU_APPROVALS" ON public.dafu_approvals;
CREATE POLICY "Enable all access for DAFU_APPROVALS" ON public.dafu_approvals
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. Masukkan Seed Data Awal untuk simulasi approval langsung
INSERT INTO public.dafu_approvals (
  lingkungan_id, nama_lingkungan, action_type, nama_kk, alamat, is_biduk, golongan, kriteria_catatan, anggota_keluarga, status, submitted_by
)
VALUES (
  'da1b6d3b-db10-48cc-8159-b211dffc3c22',
  'Padre Pio 1',
  'TAMBAH_KK',
  'Keluarga FX Sudirman & Maria Fransisca',
  'Taman Harapan Baru Blok D5 No. 12',
  true,
  'Sejahtera',
  'Keluarga mandiri, kedua orang tua bekerja tetap, memiliki rumah pribadi.',
  '[{"nama":"FX Sudirman","peran":"Kepala Keluarga","is_kaj":true},{"nama":"Maria Fransisca","peran":"Istri","is_kaj":true},{"nama":"Benedictus Bryan","peran":"Anak","is_kaj":true}]'::jsonb,
  'PENDING',
  'sekretaris_padrepio1'
)
ON CONFLICT DO NOTHING;
