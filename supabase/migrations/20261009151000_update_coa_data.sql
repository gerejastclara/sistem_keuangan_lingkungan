UPDATE COA SET nama_akun = 'Sumbangan kematian/St. Yusuf' WHERE id = '5280';
UPDATE COA SET nama_akun = 'Sumbangan Dana ASAK' WHERE id = '5290';
UPDATE COA SET nama_akun = 'Sumbangan Dana Pastoran' WHERE id = '5300';
UPDATE COA SET nama_akun = 'Sumbangan Dana APP' WHERE id = '5310';
UPDATE COA SET nama_akun = 'Sumbangan Dana Aksi Natal' WHERE id = '5320';
UPDATE COA SET nama_akun = 'Sumbangan Dana PPG' WHERE id = '5340';
UPDATE COA SET nama_akun = 'Kolekte yg disetor ke Paroki' WHERE id = '5350';

INSERT INTO COA (id, nama_akun, tipe) 
VALUES ('5900', 'Pengeluaran lainnya', 'DEBIT') 
ON CONFLICT (id) DO UPDATE 
SET nama_akun = EXCLUDED.nama_akun;
