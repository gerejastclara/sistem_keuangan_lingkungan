export interface TransactionTypeOption {
  code: string;
  name: string;
  category: 'MASUK' | 'KELUAR';
  defaultCoaDebit: string;
  defaultCoaKredit: string;
  requiresKK?: boolean;
}

export const TRANSACTION_TYPES: TransactionTypeOption[] = [
  // PENERIMAAN (KAS MASUK -> Debit: 1100 Bank, Kredit: Akun 4xxx)
  { code: '4100', name: 'Iuran Kas Lingkungan', category: 'MASUK', defaultCoaDebit: '1100', defaultCoaKredit: '4100', requiresKK: true },
  { code: '4110', name: 'Kolekte Ibadat Sabda', category: 'MASUK', defaultCoaDebit: '1100', defaultCoaKredit: '4110', requiresKK: false },
  { code: '4120', name: 'Sumbangan Dahar Romo', category: 'MASUK', defaultCoaDebit: '1100', defaultCoaKredit: '4120', requiresKK: true },
  { code: '4200', name: 'Sumbangan ASAK', category: 'MASUK', defaultCoaDebit: '1100', defaultCoaKredit: '4200', requiresKK: true },
  { code: '4300', name: 'Iuran Dana Kematian / St. Yusuf', category: 'MASUK', defaultCoaDebit: '1100', defaultCoaKredit: '4300', requiresKK: true },
  { code: '4400', name: 'Kolekte Misa Lingkungan', category: 'MASUK', defaultCoaDebit: '1100', defaultCoaKredit: '4400', requiresKK: false },
  { code: '4500', name: 'Sumbangan Umat', category: 'MASUK', defaultCoaDebit: '1100', defaultCoaKredit: '4500', requiresKK: true },
  { code: '4501', name: 'Iuran Celengan CYTM', category: 'MASUK', defaultCoaDebit: '1100', defaultCoaKredit: '4501', requiresKK: true },
  { code: '4600', name: 'Bantuan Paroki', category: 'MASUK', defaultCoaDebit: '1100', defaultCoaKredit: '4600', requiresKK: false },
  { code: '4700', name: 'Dana APP', category: 'MASUK', defaultCoaDebit: '1100', defaultCoaKredit: '4700', requiresKK: false },
  { code: '4800', name: 'Dana Aksi Natal', category: 'MASUK', defaultCoaDebit: '1100', defaultCoaKredit: '4800', requiresKK: false },
  { code: '4900', name: 'Penerimaan Lainnya', category: 'MASUK', defaultCoaDebit: '1100', defaultCoaKredit: '4900', requiresKK: false },

  // PENGELUARAN (KAS KELUAR -> Debit: Akun 5xxx, Kredit: 1100 Bank)
  { code: '5100', name: 'Misa', category: 'KELUAR', defaultCoaDebit: '5100', defaultCoaKredit: '1100' },
  { code: '5110', name: 'Ibadat Sabda', category: 'KELUAR', defaultCoaDebit: '5110', defaultCoaKredit: '1100' },
  { code: '5120', name: 'Rosario', category: 'KELUAR', defaultCoaDebit: '5120', defaultCoaKredit: '1100' },
  { code: '5130', name: 'Koor', category: 'KELUAR', defaultCoaDebit: '5130', defaultCoaKredit: '1100' },
  { code: '5140', name: 'Stipendium / Iura Stolae', category: 'KELUAR', defaultCoaDebit: '5140', defaultCoaKredit: '1100' },
  { code: '5150', name: 'Bina Iman', category: 'KELUAR', defaultCoaDebit: '5150', defaultCoaKredit: '1100' },
  { code: '5160', name: 'Pendalaman Kitab Suci', category: 'KELUAR', defaultCoaDebit: '5160', defaultCoaKredit: '1100' },
  { code: '5170', name: 'Kepemudaan (OMK)', category: 'KELUAR', defaultCoaDebit: '5170', defaultCoaKredit: '1100' },
  { code: '5180', name: 'Kerasulan Keluarga', category: 'KELUAR', defaultCoaDebit: '5180', defaultCoaKredit: '1100' },
  { code: '5190', name: 'Pendidikan Calon Imam', category: 'KELUAR', defaultCoaDebit: '5190', defaultCoaKredit: '1100' },
  { code: '5200', name: 'Rapat / Pertemuan Lingkungan', category: 'KELUAR', defaultCoaDebit: '5200', defaultCoaKredit: '1100' },
  { code: '5210', name: 'Perayaan (Natal / Paskah / HUT)', category: 'KELUAR', defaultCoaDebit: '5210', defaultCoaKredit: '1100' },
  { code: '5220', name: 'Inventaris (Pembelian / Pemeliharaan)', category: 'KELUAR', defaultCoaDebit: '5220', defaultCoaKredit: '1100' },
  { code: '5230', name: 'Administrasi (ATK dll.)', category: 'KELUAR', defaultCoaDebit: '5230', defaultCoaKredit: '1100' },
  { code: '5240', name: 'Kegiatan Rohani Lain (Retret, rekoleksi)', category: 'KELUAR', defaultCoaDebit: '5240', defaultCoaKredit: '1100' },
  { code: '5250', name: 'Bantuan Sosial Internal', category: 'KELUAR', defaultCoaDebit: '5250', defaultCoaKredit: '1100' },
  { code: '5260', name: 'Bantuan Sosial Eksternal', category: 'KELUAR', defaultCoaDebit: '5260', defaultCoaKredit: '1100' },
  { code: '5270', name: 'Pastoran (Dahar Romo)', category: 'KELUAR', defaultCoaDebit: '5270', defaultCoaKredit: '1100' },
  { code: '5280', name: 'Sumbangan Kematian / St. Yusuf', category: 'KELUAR', defaultCoaDebit: '5280', defaultCoaKredit: '1100' },
  { code: '5290', name: 'Sumbangan Dana ASAK', category: 'KELUAR', defaultCoaDebit: '5290', defaultCoaKredit: '1100' },
  { code: '5300', name: 'Sumbangan Dana Pastoran', category: 'KELUAR', defaultCoaDebit: '5300', defaultCoaKredit: '1100' },
  { code: '5310', name: 'Sumbangan Dana APP', category: 'KELUAR', defaultCoaDebit: '5310', defaultCoaKredit: '1100' },
  { code: '5320', name: 'Sumbangan Dana Aksi Natal', category: 'KELUAR', defaultCoaDebit: '5320', defaultCoaKredit: '1100' },
  { code: '5340', name: 'Sumbangan Dana PPG', category: 'KELUAR', defaultCoaDebit: '5340', defaultCoaKredit: '1100' },
  { code: '5350', name: 'Kolekte yg disetor ke Paroki', category: 'KELUAR', defaultCoaDebit: '5350', defaultCoaKredit: '1100' },
  { code: '5360', name: 'Sumbangan Celengan CYTM', category: 'KELUAR', defaultCoaDebit: '5360', defaultCoaKredit: '1100' },
  { code: '5900', name: 'Pengeluaran Lainnya', category: 'KELUAR', defaultCoaDebit: '5900', defaultCoaKredit: '1100' }
];

export function getDoubleEntryMapping(typeCode: string, arus: 'MASUK' | 'KELUAR') {
  const match = TRANSACTION_TYPES.find(t => t.code === typeCode && t.category === arus);
  if (match) {
    return { coaDebit: match.defaultCoaDebit, coaKredit: match.defaultCoaKredit };
  }
  // Default fallbacks
  return arus === 'MASUK'
    ? { coaDebit: '1100', coaKredit: typeCode || '4900' }
    : { coaDebit: typeCode || '5900', coaKredit: '1100' };
}
