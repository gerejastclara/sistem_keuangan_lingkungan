import { KepalaKeluarga, AnggotaKeluarga, GolonganKeluarga, KategoriGolongan, PeranKeluarga } from './types'

// Names pool for generating realistic Catholic Indonesian Umat/KK per Lingkungan
const CATHOLIC_FIRST_NAMES = [
  'Petrus', 'Maria', 'Antonius', 'Theresa', 'Yohanes',
  'Ignatius', 'Clara', 'Stephanus', 'Bernadette', 'FX',
  'Agustinus', 'Elisabeth', 'Joseph', 'Cecilia', 'Paulus',
  'Anastasia', 'Dominikus', 'Veronica', 'Francisca', 'Benediktus',
  'Gregorius', 'Vincentius', 'Fransiskus', 'Thomas', 'Andreas',
  'Matheus', 'Lukas', 'Markus', 'Bartolomeus', 'Theresia',
  'Anna', 'Katarina', 'Agnes', 'Martha', 'Monika',
  'Yuliana', 'Albertus', 'Mikael', 'Gabriel', 'Rafael',
  'Stanislaus', 'Aloysius', 'Bernardus', 'Damianus', 'Leonardus',
  'Raymond', 'Martinus', 'Laurentius', 'Sebastianus', 'Alfonsus', 'Herman'
]

const LAST_NAMES = [
  'Sugeng', 'Francisca', 'Budi', 'Wati', 'Koko',
  'Rossi', 'Setiawati', 'Hartono', 'Tri', 'Bambang',
  'Santoso', 'Wijaya', 'Kusuma', 'Purnama', 'Sutrisno',
  'Pratama', 'Hidayat', 'Gunawan', 'Laksana', 'Handoko',
  'Subroto', 'Siregar', 'Simanjuntak', 'Situmorang', 'Hutabarat',
  'Tampubolon', 'Manurung', 'Sinaga', 'Nainggolan', 'Pasaribu',
  'Tanudjaja', 'Widjaja', 'Surya', 'Halim', 'Salim',
  'Wibowo', 'Kristianto', 'Nugroho', 'Saputra', 'Utomo',
  'Danubroto', 'Setyawan', 'Wardhana', 'Prakoso', 'Baskoro',
  'Suwandi', 'Darmanto', 'Hermawan', 'Tanoto', 'Tedjokusumo'
]

export function getDummyKkListForLingkungan(lingkunganId: string, namaLingkungan: string): KepalaKeluarga[] {
  const cleanName = (namaLingkungan || '').replace(/^lingkungan\s+/i, '').trim() || 'Lingkungan'
  const normalizedKey = cleanName.toLowerCase().trim()
  const slugKey = normalizedKey.replace(/[^a-z0-9]/g, '-')
  
  // Extract number if present (e.g. 1, 2, 3, 4)
  const numMatch = normalizedKey.match(/\d+/)
  const lingkunganNumber = numMatch ? parseInt(numMatch[0], 10) : 1
  
  // Hash function based strictly on normalized Lingkungan name and number
  let hash = lingkunganNumber * 10007
  for (let i = 0; i < normalizedKey.length; i++) {
    hash = ((hash << 5) - hash) + normalizedKey.charCodeAt(i) * 31
    hash |= 0
  }
  const absHash = Math.abs(hash)

  const result: KepalaKeluarga[] = []
  
  for (let i = 0; i < 5; i++) {
    const fnIdx = (absHash + i * 7 + lingkunganNumber * 13) % CATHOLIC_FIRST_NAMES.length
    const lnIdx = (absHash + i * 11 + lingkunganNumber * 17 + 3) % LAST_NAMES.length
    const namaKK = `${CATHOLIC_FIRST_NAMES[fnIdx]} ${LAST_NAMES[lnIdx]}`
    
    // 4 out of 5 are BIDUK registered by default
    const isBiduk = (i + lingkunganNumber) % 5 !== 0
    const blokLetter = ['A', 'B', 'C', 'D', 'E', 'F'][(absHash + i) % 6]
    const houseNo = ((i + 1) * 3) + ((absHash + i * 5) % 27) + 1
    
    result.push({
      id: `dummy-kk-${slugKey}-${i + 1}`,
      lingkungan_id: lingkunganId,
      nama_kk: namaKK,
      alamat: `Jl. ${cleanName} Blok ${blokLetter} No. ${houseNo}`,
      is_biduk: isBiduk
    })
  }

  return result
}

export function ensureDummyKksForLingkungan(lingkunganId: string, namaLingkungan: string, existingList: KepalaKeluarga[]): KepalaKeluarga[] {
  if (existingList && existingList.length >= 5) {
    return existingList
  }

  const dummyList = getDummyKkListForLingkungan(lingkunganId, namaLingkungan)
  
  // Merge existing custom entries with dummy list
  const combinedMap = new Map<string, KepalaKeluarga>()
  dummyList.forEach(k => combinedMap.set(k.id, k))
  if (existingList) {
    existingList.forEach(k => combinedMap.set(k.id, k))
  }
  
  return Array.from(combinedMap.values()).sort((a, b) => a.nama_kk.localeCompare(b.nama_kk))
}


const FEMALE_NAMES = ['Maria', 'Theresa', 'Clara', 'Bernadette', 'Elisabeth', 'Cecilia', 'Anastasia', 'Veronica', 'Francisca', 'Agnes']
const CHILDREN_NAMES = ['Yohanes', 'Stephanus', 'Agustinus', 'Joseph', 'Dominikus', 'Benediktus', 'Gabriel', 'Michael', 'Rafael', 'Lucia', 'Martha', 'Monika']

export function getDummyAnggotaForKk(kk: KepalaKeluarga): AnggotaKeluarga[] {
  const parts = kk.nama_kk.trim().split(' ')
  const lastName = parts.length > 1 ? parts[parts.length - 1] : 'Keluarga'
  
  let hash = 0
  for (let i = 0; i < kk.nama_kk.length; i++) {
    hash = (hash << 5) - hash + kk.nama_kk.charCodeAt(i)
    hash |= 0
  }
  const absHash = Math.abs(hash)

  const fnWifeIdx = absHash % FEMALE_NAMES.length
  const wifeName = `${FEMALE_NAMES[fnWifeIdx]} ${lastName}`

  const fnChild1Idx = (absHash + 3) % CHILDREN_NAMES.length
  const child1Name = `${CHILDREN_NAMES[fnChild1Idx]} ${lastName}`

  const fnChild2Idx = (absHash + 7) % CHILDREN_NAMES.length
  const child2Name = `${CHILDREN_NAMES[fnChild2Idx]} ${lastName}`

  const members: AnggotaKeluarga[] = [
    {
      id: `dummy-member-${kk.id}-1`,
      kk_id: kk.id,
      nama: kk.nama_kk,
      peran: 'Kepala Keluarga',
      is_kaj: kk.is_biduk,
      keterangan: 'Kepala Keluarga'
    },
    {
      id: `dummy-member-${kk.id}-2`,
      kk_id: kk.id,
      nama: wifeName,
      peran: 'Istri',
      is_kaj: true,
      keterangan: 'Ibu Rumah Tangga'
    },
    {
      id: `dummy-member-${kk.id}-3`,
      kk_id: kk.id,
      nama: child1Name,
      peran: 'Anak',
      is_kaj: true,
      keterangan: 'Pelajar / Mahasiswa'
    }
  ]

  // Add 4th member for some families
  if (absHash % 2 === 0) {
    members.push({
      id: `dummy-member-${kk.id}-4`,
      kk_id: kk.id,
      nama: child2Name,
      peran: 'Anak',
      is_kaj: kk.is_biduk,
      keterangan: 'Remaja OMK / Pelajar'
    })
  }

  return members
}

export function getDummyGolonganForKk(kk: KepalaKeluarga): GolonganKeluarga {
  const idParts = kk.id.split('-')
  const index = parseInt(idParts[idParts.length - 1], 10) || 1
  
  let hash = 0
  for (let i = 0; i < kk.nama_kk.length; i++) {
    hash = ((hash << 5) - hash) + kk.nama_kk.charCodeAt(i)
    hash |= 0
  }
  const absHash = Math.abs(hash)

  // Spread across 5 families in each lingkungan (usually 1 Miskin, 2 or 3 Menengah, 1 or 2 Atas)
  const pattern = (index + (absHash % 3)) % 5

  let golongan: KategoriGolongan = 'MENENGAH'
  let catatan = 'Keluarga mandiri berpenghasilan tetap bulanan standar, aktif dalam paguyuban warga.'

  if (pattern === 0) {
    golongan = 'MISKIN'
    catatan = 'Keluarga pra-sejahtera, pekerja informal / lansia, membutuhkan perhatian dan subsidi berkala lingkungan.'
  } else if (pattern === 3 || pattern === 4) {
    golongan = 'ATAS'
    catatan = 'Keluarga mapan / profesional, berpotensi sebagai donatur sukarela aksi sosial lingkungan.'
  }

  return {
    id: `dummy-golongan-${kk.id}`,
    kk_id: kk.id,
    lingkungan_id: kk.lingkungan_id,
    golongan,
    kriteria_catatan: catatan,
    updated_by_role: 'SEKRETARIS',
    updated_at: new Date().toISOString()
  }
}
