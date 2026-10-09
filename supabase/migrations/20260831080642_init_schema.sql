-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. LINGKUNGAN TABLE
CREATE TABLE LINGKUNGAN (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama_lingkungan VARCHAR(255) NOT NULL
);

-- 2. KEPALA_KELUARGA (DAFU)
CREATE TABLE KEPALA_KELUARGA (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lingkungan_id UUID NOT NULL REFERENCES LINGKUNGAN(id) ON DELETE CASCADE,
    nama_kk VARCHAR(255) NOT NULL,
    alamat TEXT,
    is_biduk BOOLEAN DEFAULT FALSE
);

-- 3. PROFIL_LINGKUNGAN
CREATE TABLE PROFIL_LINGKUNGAN (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lingkungan_id UUID NOT NULL REFERENCES LINGKUNGAN(id) ON DELETE CASCADE,
    ketua_id UUID REFERENCES KEPALA_KELUARGA(id) ON DELETE SET NULL,
    sekretaris_id UUID REFERENCES KEPALA_KELUARGA(id) ON DELETE SET NULL,
    bendahara_id UUID REFERENCES KEPALA_KELUARGA(id) ON DELETE SET NULL,
    telepon_bendahara VARCHAR(20),
    periode_masa_bakti VARCHAR(20),
    is_hub_kerabat BOOLEAN DEFAULT FALSE,
    is_bendahara_kaj BOOLEAN DEFAULT FALSE,
    jenis_rekening VARCHAR(100),
    nama_bank VARCHAR(100),
    no_rekening VARCHAR(100),
    saldo_awal DECIMAL(15,2) DEFAULT 0.00,
    tahun_buku VARCHAR(4),
    bulan_saldo INT
);

-- 4. COA
CREATE TABLE COA (
    id VARCHAR(10) PRIMARY KEY,
    nama_akun VARCHAR(255) NOT NULL,
    tipe VARCHAR(50) NOT NULL CHECK (tipe IN ('DEBIT', 'KREDIT'))
);

-- 5. JURNAL_TRANSAKSI
CREATE TABLE JURNAL_TRANSAKSI (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lingkungan_id UUID NOT NULL REFERENCES LINGKUNGAN(id) ON DELETE CASCADE,
    kk_id UUID REFERENCES KEPALA_KELUARGA(id) ON DELETE SET NULL,
    tanggal DATE NOT NULL,
    tipe_arus VARCHAR(10) NOT NULL CHECK (tipe_arus IN ('MASUK', 'KELUAR')),
    coa_debit VARCHAR(10) REFERENCES COA(id) ON DELETE RESTRICT,
    coa_kredit VARCHAR(10) REFERENCES COA(id) ON DELETE RESTRICT,
    nominal DECIMAL(15,2) NOT NULL,
    keterangan TEXT,
    is_posted BOOLEAN DEFAULT FALSE
);

-- 6. ASET
CREATE TABLE ASET (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lingkungan_id UUID NOT NULL REFERENCES LINGKUNGAN(id) ON DELETE CASCADE,
    kategori VARCHAR(100),
    nama_barang VARCHAR(255) NOT NULL,
    tahun_beli INT,
    jumlah INT DEFAULT 1,
    harga_satuan DECIMAL(15,2) DEFAULT 0.00
);

-- 7. USERS (Custom table linking to auth.users)
CREATE TABLE USERS (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('BENDAHARA', 'SEKRETARIS', 'PAROKI')),
    lingkungan_id UUID REFERENCES LINGKUNGAN(id) ON DELETE CASCADE
);

-- ROW LEVEL SECURITY (RBAC)

ALTER TABLE LINGKUNGAN ENABLE ROW LEVEL SECURITY;
ALTER TABLE KEPALA_KELUARGA ENABLE ROW LEVEL SECURITY;
ALTER TABLE PROFIL_LINGKUNGAN ENABLE ROW LEVEL SECURITY;
ALTER TABLE COA ENABLE ROW LEVEL SECURITY;
ALTER TABLE JURNAL_TRANSAKSI ENABLE ROW LEVEL SECURITY;
ALTER TABLE ASET ENABLE ROW LEVEL SECURITY;
ALTER TABLE USERS ENABLE ROW LEVEL SECURITY;

-- LINGKUNGAN: All users can read
CREATE POLICY "All users can read LINGKUNGAN" ON LINGKUNGAN FOR SELECT USING (true);

-- COA: All users can read
CREATE POLICY "All users can read COA" ON COA FOR SELECT USING (true);

-- USERS: Users can read their own profile
CREATE POLICY "Users can read own profile" ON USERS FOR SELECT USING (auth.uid() = id);

-- KEPALA_KELUARGA
CREATE POLICY "SEKRETARIS can CRUD KEPALA_KELUARGA" ON KEPALA_KELUARGA
FOR ALL USING (
    EXISTS (SELECT 1 FROM USERS WHERE USERS.id = auth.uid() AND USERS.role = 'SEKRETARIS' AND USERS.lingkungan_id = KEPALA_KELUARGA.lingkungan_id)
);
CREATE POLICY "BENDAHARA can view KEPALA_KELUARGA" ON KEPALA_KELUARGA
FOR SELECT USING (
    EXISTS (SELECT 1 FROM USERS WHERE USERS.id = auth.uid() AND USERS.role = 'BENDAHARA' AND USERS.lingkungan_id = KEPALA_KELUARGA.lingkungan_id)
);
CREATE POLICY "PAROKI can view KEPALA_KELUARGA" ON KEPALA_KELUARGA
FOR SELECT USING (
    EXISTS (SELECT 1 FROM USERS WHERE USERS.id = auth.uid() AND USERS.role = 'PAROKI')
);

-- JURNAL_TRANSAKSI
CREATE POLICY "BENDAHARA can CRUD JURNAL_TRANSAKSI" ON JURNAL_TRANSAKSI
FOR ALL USING (
    EXISTS (SELECT 1 FROM USERS WHERE USERS.id = auth.uid() AND USERS.role = 'BENDAHARA' AND USERS.lingkungan_id = JURNAL_TRANSAKSI.lingkungan_id)
);
CREATE POLICY "SEKRETARIS can view JURNAL_TRANSAKSI" ON JURNAL_TRANSAKSI
FOR SELECT USING (
    EXISTS (SELECT 1 FROM USERS WHERE USERS.id = auth.uid() AND USERS.role = 'SEKRETARIS' AND USERS.lingkungan_id = JURNAL_TRANSAKSI.lingkungan_id)
);
CREATE POLICY "PAROKI can view JURNAL_TRANSAKSI" ON JURNAL_TRANSAKSI
FOR SELECT USING (
    EXISTS (SELECT 1 FROM USERS WHERE USERS.id = auth.uid() AND USERS.role = 'PAROKI')
);

-- ASET
CREATE POLICY "BENDAHARA can CRUD ASET" ON ASET
FOR ALL USING (
    EXISTS (SELECT 1 FROM USERS WHERE USERS.id = auth.uid() AND USERS.role = 'BENDAHARA' AND USERS.lingkungan_id = ASET.lingkungan_id)
);
CREATE POLICY "SEKRETARIS can view ASET" ON ASET
FOR SELECT USING (
    EXISTS (SELECT 1 FROM USERS WHERE USERS.id = auth.uid() AND USERS.role = 'SEKRETARIS' AND USERS.lingkungan_id = ASET.lingkungan_id)
);
CREATE POLICY "PAROKI can view ASET" ON ASET
FOR SELECT USING (
    EXISTS (SELECT 1 FROM USERS WHERE USERS.id = auth.uid() AND USERS.role = 'PAROKI')
);

-- PROFIL_LINGKUNGAN
CREATE POLICY "SEKRETARIS and BENDAHARA can update PROFIL_LINGKUNGAN" ON PROFIL_LINGKUNGAN
FOR UPDATE USING (
    EXISTS (SELECT 1 FROM USERS WHERE USERS.id = auth.uid() AND USERS.role IN ('SEKRETARIS', 'BENDAHARA') AND USERS.lingkungan_id = PROFIL_LINGKUNGAN.lingkungan_id)
);
CREATE POLICY "SEKRETARIS, BENDAHARA, PAROKI can view PROFIL_LINGKUNGAN" ON PROFIL_LINGKUNGAN
FOR SELECT USING (
    EXISTS (SELECT 1 FROM USERS WHERE USERS.id = auth.uid() AND (USERS.role = 'PAROKI' OR USERS.lingkungan_id = PROFIL_LINGKUNGAN.lingkungan_id))
);

-- INITIAL SEED DATA FOR COA
INSERT INTO COA (id, nama_akun, tipe) VALUES
('1100', 'Bank', 'DEBIT'),
('4100', 'Iuran Kas Lingkungan', 'KREDIT'),
('4110', 'Kolekte Ibadat Sabda', 'KREDIT'),
('4120', 'Sumbangan Dahar Romo', 'KREDIT'),
('4200', 'Sumbangan ASAK', 'KREDIT'),
('4300', 'Iuran Dana Kematian / St. Yusuf', 'KREDIT'),
('4400', 'Kolekte Misa Lingkungan', 'KREDIT'),
('4500', 'Sumbangan Umat', 'KREDIT'),
('4600', 'Bantuan Paroki', 'KREDIT'),
('4700', 'Dana APP', 'KREDIT'),
('4800', 'Dana Aksi Natal', 'KREDIT'),
('4900', 'Penerimaan Lainnya', 'KREDIT'),
('5100', 'Misa', 'DEBIT'),
('5110', 'Ibadat Sabda', 'DEBIT'),
('5120', 'Rosario', 'DEBIT'),
('5130', 'Koor', 'DEBIT'),
('5140', 'Stipendium / Iura Stolae', 'DEBIT'),
('5150', 'Bina Iman', 'DEBIT'),
('5160', 'Pendalaman Kitab Suci', 'DEBIT'),
('5170', 'Kepemudaan (OMK)', 'DEBIT'),
('5180', 'Kerasulan Keluarga', 'DEBIT'),
('5190', 'Pendidikan Calon Imam', 'DEBIT'),
('5200', 'Rapat / Pertemuan Lingkungan', 'DEBIT'),
('5210', 'Perayaan (Natal / Paskah / HUT)', 'DEBIT'),
('5220', 'Inventaris (Pembelian / Pemeliharaan)', 'DEBIT'),
('5230', 'Administrasi (ATK dll.)', 'DEBIT'),
('5240', 'Kegiatan Rohani Lain (Retret, rekoleksi)', 'DEBIT'),
('5250', 'Bantuan Sosial Internal', 'DEBIT'),
('5260', 'Bantuan Sosial Eksternal', 'DEBIT'),
('5270', 'Pastoran (Dahar Romo)', 'DEBIT'),
('5280', 'Sumbangan kematian/St. Yusuf', 'DEBIT'),
('5290', 'Sumbangan Dana ASAK', 'DEBIT'),
('5300', 'Sumbangan Dana Pastoran', 'DEBIT'),
('5310', 'Sumbangan Dana APP', 'DEBIT'),
('5320', 'Sumbangan Dana Aksi Natal', 'DEBIT'),
('5340', 'Sumbangan Dana PPG', 'DEBIT'),
('5350', 'Kolekte yg disetor ke Paroki', 'DEBIT'),
('5900', 'Pengeluaran lainnya', 'DEBIT');

-- INITIAL SEED DATA FOR LINGKUNGAN
INSERT INTO LINGKUNGAN (nama_lingkungan) VALUES
('St. Agnes 1'), ('St. Agnes 2'), ('St. Agnes 3'), ('St. Agnes 4'), ('St. Agnes 5'),
('St. Antonius 1'), ('St. Antonius 2'), ('St. Antonius 3'), ('St. Antonius 4'), ('St. Antonius 5'), ('St. Antonius 6'),
('St. Bonaventura 1'), ('St. Bonaventura 2'), ('St. Bonaventura 3'), ('St. Bonaventura 4'), ('St. Bonaventura 5'), ('St. Bonaventura 6'),
('St. Bunda Teresa 1'), ('St. Bunda Teresa 2'), ('St. Bunda Teresa 3'), ('St. Bunda Teresa 4'), ('St. Bunda Teresa 5'), ('St. Bunda Teresa 6'),
('St. Catarina 1'), ('St. Catarina 2'), ('St. Catarina 3'), ('St. Catarina 4'),
('St. Fidelis 1'), ('St. Fidelis 2'), ('St. Fidelis 3'), ('St. Fidelis 4'), ('St. Fidelis 5'),
('St. Konradus 1'), ('St. Konradus 2'), ('St. Konradus 3'), ('St. Konradus 4'), ('St. Konradus 5'), ('St. Konradus 6'),
('St. Laurentius 1'), ('St. Laurentius 2'), ('St. Laurentius 3'),
('Padre Pio 1'), ('Padre Pio 2'), ('Padre Pio 3'), ('Padre Pio 4'),
('St. Paulus 1'), ('St. Paulus 2'), ('St. Paulus 3'), ('St. Paulus 4'), ('St. Paulus 5'),
('St. Petrus 1'), ('St. Petrus 2'), ('St. Petrus 3'), ('St. Petrus 4'), ('St. Petrus 5'), ('St. Petrus 6'), ('St. Petrus 7'), ('St. Petrus 8'),
('St. Thomas Aquinas 1'), ('St. Thomas Aquinas 2'), ('St. Thomas Aquinas 3'), ('St. Thomas Aquinas 4'), ('St. Thomas Aquinas 5'), ('St. Thomas Aquinas 6'),
('St. Yohannes Pemandi 1'), ('St. Yohannes Pemandi 2'), ('St. Yohannes Pemandi 3'), ('St. Yohannes Pemandi 4'), ('St. Yohannes Pemandi 5');
