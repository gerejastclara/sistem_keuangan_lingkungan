export type UserRole = 'BENDAHARA' | 'SEKRETARIS' | 'PAROKI';

export interface UserProfile {
  id: string;
  username?: string;
  password?: string;
  email?: string;
  role: UserRole;
  lingkungan_id: string | null;
  lingkungan_nama?: string;
}

export interface Lingkungan {
  id: string;
  nama_lingkungan: string;
}

export interface KepalaKeluarga {
  id: string;
  lingkungan_id: string;
  nama_kk: string;
  alamat: string | null;
  is_biduk: boolean;
  wilayah?: string;
  nama_lingkungan?: string;
  telepon?: string;
  jumlah_anggota?: number;
}

export type PeranKeluarga = 'Kepala Keluarga' | 'Suami' | 'Istri' | 'Anak' | 'Orang Tua' | 'Famili Lain';
export type KategoriGolongan = 'Sejahtera' | 'Terduga Prasejahtera' | 'Terduga Pra Sejahtera' | 'Rentan Tidak Mampu' | 'Tidak Mampu';

export interface AnggotaKeluarga {
  id: string;
  kk_id: string;
  nama: string;
  peran: PeranKeluarga;
  is_kaj: boolean;
  keterangan?: string | null;
}

export interface GolonganKeluarga {
  id: string;
  kk_id: string;
  lingkungan_id: string;
  golongan: KategoriGolongan;
  kriteria_catatan?: string | null;
  updated_by_role?: string;
  updated_at?: string;
}

export interface KepalaKeluargaWithDetails extends KepalaKeluarga {
  anggota?: AnggotaKeluarga[];
  golongan_info?: GolonganKeluarga;
}

export interface ProfilLingkungan {
  id: string;
  lingkungan_id: string;
  ketua_id: string | null;
  sekretaris_id: string | null;
  bendahara_id: string | null;
  ketua_nama?: string | null;
  sekretaris_nama?: string | null;
  bendahara_nama?: string | null;
  alamat_bendahara?: string | null;
  telepon_bendahara: string | null;
  periode_masa_bakti: string | null;
  is_hub_kerabat: boolean;
  is_bendahara_kaj: boolean;
  jenis_rekening: string | null;
  nama_bank: string | null;
  no_rekening: string | null;
  saldo_awal: number;
  tahun_buku: string | null;
  bulan_saldo: number | null;
  // Joined details
  ketua?: KepalaKeluarga;
  sekretaris?: KepalaKeluarga;
  bendahara?: KepalaKeluarga;
}

export interface COA {
  id: string;
  nama_akun: string;
  tipe: 'DEBIT' | 'KREDIT';
}

export interface JurnalTransaksi {
  id: string;
  lingkungan_id: string;
  kk_id: string | null;
  tanggal: string;
  tipe_arus: 'MASUK' | 'KELUAR';
  coa_debit: string;
  coa_kredit: string;
  nominal: number;
  keterangan: string | null;
  is_posted: boolean;
  // Joined details
  kepala_keluarga?: KepalaKeluarga;
  account_debit?: COA;
  account_kredit?: COA;
}

export interface Aset {
  id: string;
  lingkungan_id: string;
  kategori: string | null;
  nama_barang: string;
  tahun_beli: number | null;
  jumlah: number;
  harga_satuan: number;
}
