-- ==============================================================================
-- SEED SCRIPT RESMI: PENGGUNA MURNI BERBASIS USERNAME & PASSWORD (TANPA EMAIL)
-- Paroki Santa Clara - Bekasi Utara
-- Total: 139 Pengguna (69 Sekretaris + 69 Bendahara + 1 Paroki)
-- Password Semua Pengguna: Paroki321
--
-- Struktur Tabel public.users:
--   id            : UUID PRIMARY KEY
--   username      : VARCHAR (contoh: sekretaris_padrepio1, bendahara_padrepio1, paroki)
--   password      : VARCHAR (Paroki321)
--   role          : VARCHAR (SEKRETARIS, BENDAHARA, PAROKI)
--   lingkungan_id : UUID (relasi ke tabel public.lingkungan)
-- ==============================================================================

-- 1. Lepas relasi foreign key ke auth.users agar tabel berdiri sendiri & hapus kolom email
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
ALTER TABLE public.users DROP COLUMN IF EXISTS email CASCADE;

-- 2. Pastikan kolom id, username, password, role, dan lingkungan_id terpasang
ALTER TABLE public.users ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password VARCHAR(100);

-- 3. Hapus data user lama yang sebelumnya memakai email agar bersih dan fresh
DELETE FROM public.users;

-- 4. Pasang index unik pada username agar tidak ada duplikasi
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON public.users(username);

-- 5. Masukkan akun Pengurus Paroki
INSERT INTO public.users (id, username, password, role, lingkungan_id)
VALUES (gen_random_uuid(), 'paroki', 'Paroki321', 'PAROKI', NULL);

-- 6. Masukkan akun Sekretaris dan Bendahara untuk seluruh 69 Lingkungan
DO $$
DECLARE
  ling RECORD;
  clean_slug TEXT;
  raw_name TEXT;
  total_lingkungan INT := 0;
BEGIN
  FOR ling IN SELECT id, nama_lingkungan FROM public.lingkungan ORDER BY nama_lingkungan LOOP
    -- Standarisasi nama lingkungan ke format slug:
    -- Contoh: "Padre Pio 1" -> "padrepio1"
    -- Contoh: "St. Agnes 1" -> "stagnes1"
    raw_name := lower(ling.nama_lingkungan);
    raw_name := regexp_replace(raw_name, '^lingkungan\s+', '', 'i');
    raw_name := regexp_replace(raw_name, 'st\.\s*', 'st', 'gi');
    clean_slug := regexp_replace(raw_name, '[^a-z0-9]', '', 'g');

    -- Masukkan akun Sekretaris
    INSERT INTO public.users (id, username, password, role, lingkungan_id)
    VALUES (gen_random_uuid(), 'sekretaris_' || clean_slug, 'Paroki321', 'SEKRETARIS', ling.id);

    -- Masukkan akun Bendahara
    INSERT INTO public.users (id, username, password, role, lingkungan_id)
    VALUES (gen_random_uuid(), 'bendahara_' || clean_slug, 'Paroki321', 'BENDAHARA', ling.id);

    total_lingkungan := total_lingkungan + 1;
  END LOOP;

  RAISE NOTICE 'Selesai! Akun berhasil dibuat untuk % lingkungan.', total_lingkungan;
END $$;

-- 7. Tampilkan rekap jumlah akun
SELECT role, count(*) AS total_akun FROM public.users GROUP BY role ORDER BY role;

-- 8. Tampilkan 15 contoh akun pertama
SELECT username, password, role, lingkungan_id FROM public.users ORDER BY role, username LIMIT 15;
