-- Migration: Menambahkan kolom data_sebelum_edit dan is_edited_by_paroki ke tabel dafu_approvals
-- Digunakan untuk audit trail penyesuaian data oleh Sekretaris Paroki

ALTER TABLE public.dafu_approvals 
  ADD COLUMN IF NOT EXISTS data_sebelum_edit JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_edited_by_paroki BOOLEAN DEFAULT false;
