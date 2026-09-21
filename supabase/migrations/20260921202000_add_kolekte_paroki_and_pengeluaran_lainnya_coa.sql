-- Migration: Penambahan COA 5350 (Kolekte yg disetor ke Paroki), 5340 (Sumbangan Dana PPG), dan 5900 (Pengeluaran lainnya)
-- Tanggal: 2026-09-21

INSERT INTO coa (id, nama_akun, tipe) VALUES
('5340', 'Sumbangan Dana PPG', 'DEBIT'),
('5350', 'Kolekte yg disetor ke Paroki', 'DEBIT'),
('5900', 'Pengeluaran lainnya', 'DEBIT')
ON CONFLICT (id) DO UPDATE SET 
    nama_akun = EXCLUDED.nama_akun, 
    tipe = EXCLUDED.tipe;
