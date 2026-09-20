-- ==============================================================================
-- MIGRATION: SEED PENGGUNA MURNI BERBASIS USERNAME & PASSWORD (TANPA EMAIL)
-- ==============================================================================

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
ALTER TABLE public.users DROP COLUMN IF EXISTS email CASCADE;

ALTER TABLE public.users ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password VARCHAR(100);

DELETE FROM public.users;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON public.users(username);

INSERT INTO public.users (id, username, password, role, lingkungan_id)
VALUES (gen_random_uuid(), 'paroki', 'Paroki321', 'PAROKI', NULL)
ON CONFLICT (username) DO NOTHING;

DO $$
DECLARE
  ling RECORD;
  clean_slug TEXT;
  raw_name TEXT;
BEGIN
  FOR ling IN SELECT id, nama_lingkungan FROM public.lingkungan ORDER BY nama_lingkungan LOOP
    raw_name := lower(ling.nama_lingkungan);
    raw_name := regexp_replace(raw_name, '^lingkungan\s+', '', 'i');
    raw_name := regexp_replace(raw_name, 'st\.\s*', 'st', 'gi');
    clean_slug := regexp_replace(raw_name, '[^a-z0-9]', '', 'g');

    INSERT INTO public.users (id, username, password, role, lingkungan_id)
    VALUES (gen_random_uuid(), 'sekretaris_' || clean_slug, 'Paroki321', 'SEKRETARIS', ling.id)
    ON CONFLICT (username) DO NOTHING;

    INSERT INTO public.users (id, username, password, role, lingkungan_id)
    VALUES (gen_random_uuid(), 'sekertaris_' || clean_slug, 'Paroki321', 'SEKRETARIS', ling.id)
    ON CONFLICT (username) DO NOTHING;

    INSERT INTO public.users (id, username, password, role, lingkungan_id)
    VALUES (gen_random_uuid(), 'bendahara_' || clean_slug, 'Paroki321', 'BENDAHARA', ling.id)
    ON CONFLICT (username) DO NOTHING;
  END LOOP;
END $$;
