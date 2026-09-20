-- Migration: Penambahan COA Kas & Dana Talangan, Kolom No Bukti Jurnal, dan Kondisi Aset
-- Tanggal: 2026-09-20

-- 1. Insert / Update Master COA: Kas (1200), Dana Talangan Dahar Romo (1300), Dana Talangan Santo Yusuf (1400)
INSERT INTO coa (id, nama_akun, tipe) VALUES
('1100', 'Bank', 'DEBIT'),
('1200', 'Kas', 'DEBIT'),
('1300', 'Dana talangan Dahar Romo', 'DEBIT'),
('1400', 'Dana talangan Santo Yusuf', 'DEBIT')
ON CONFLICT (id) DO UPDATE SET 
    nama_akun = EXCLUDED.nama_akun, 
    tipe = EXCLUDED.tipe;

-- 2. Pastikan kolom No Bukti dan Referensi Kas di Jurnal Transaksi tersedia
ALTER TABLE jurnal_transaksi ADD COLUMN IF NOT EXISTS no_bukti VARCHAR(50);
ALTER TABLE jurnal_transaksi ADD COLUMN IF NOT EXISTS sumber_kas VARCHAR(20) DEFAULT 'BANK';
ALTER TABLE jurnal_transaksi ADD COLUMN IF NOT EXISTS sumber_setoran VARCHAR(30) DEFAULT 'SENDIRI';

-- 3. Pastikan kolom kondisi di tabel Aset tersedia
ALTER TABLE aset ADD COLUMN IF NOT EXISTS kondisi VARCHAR(50) DEFAULT 'Baik';
