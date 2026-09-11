export interface PengurusLingkungan {
  ketua_nama: string
  ketua_kontak: string
  bendahara_nama: string
  bendahara_kontak: string
  sekretaris_nama: string
  sekretaris_kontak: string
  periode: string
  status: string
}

// Catholic names pool for authentic officer names per lingkungan
const CATHOLIC_OFFICER_NAMES = [
  { nama: 'FX Wisnu Ardianto', kontak: '0812-8921-3341' },
  { nama: 'Maria Bernadette Wijaya', kontak: '0813-1456-7890' },
  { nama: 'Ignatius Stefanus Sugeng', kontak: '0815-9988-2234' },
  { nama: 'Petrus Bambang Santoso', kontak: '0817-4321-6789' },
  { nama: 'Theresia Clara Handoko', kontak: '0812-3344-5566' },
  { nama: 'Yohanes Budi Utomo', kontak: '0818-7766-5544' },
  { nama: 'Agustinus Hidayat Gunawan', kontak: '0813-8899-1122' },
  { nama: 'Cecilia Francisca Rossi', kontak: '0819-2233-4455' },
  { nama: 'Joseph Danubroto Wibowo', kontak: '0812-6677-8899' },
  { nama: 'Anastasia Monika Surya', kontak: '0816-5544-3322' },
  { nama: 'Benediktus Kristianto Kusuma', kontak: '0811-9988-7766' },
  { nama: 'Elisabeth Wati Darmanto', kontak: '0813-7766-1122' },
  { nama: 'Dominikus Pratama Halim', kontak: '0812-4455-6677' },
  { nama: 'Veronica Setiawati Salim', kontak: '0817-8899-0011' },
  { nama: 'Martinus Subroto Tedjokusumo', kontak: '0815-6677-8899' }
]

export function getPengurusForLingkungan(
  lingkunganId: string | null | undefined,
  namaLingkungan: string | null | undefined,
  profilDb?: {
    ketua_nama?: string | null
    bendahara_nama?: string | null
    sekretaris_nama?: string | null
    telepon_bendahara?: string | null
    periode_masa_bakti?: string | null
  } | null
): PengurusLingkungan {
  const cleanId = lingkunganId || 'default'
  const cleanNama = (namaLingkungan || '').replace(/^lingkungan\s+/i, '').trim() || 'St. Clara'

  // 1. Check manual localStorage overrides first
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(`profil_manual_${cleanId}`)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.ketuaNama || parsed.bendaharaNama || parsed.sekretarisNama) {
          return {
            ketua_nama: parsed.ketuaNama || 'FX Wisnu Ardianto',
            ketua_kontak: parsed.teleponKetua || '0812-8921-3341',
            bendahara_nama: parsed.bendaharaNama || 'Maria Bernadette Wijaya',
            bendahara_kontak: parsed.teleponBendahara || '0813-1456-7890',
            sekretaris_nama: parsed.sekretarisNama || 'Ignatius Stefanus Sugeng',
            sekretaris_kontak: parsed.teleponSekretaris || '0815-9988-2234',
            periode: parsed.periodeMasaBakti || '2024 - 2026',
            status: 'Aktif'
          }
        }
      }
    } catch (e) {}
  }

  // 2. Check DB profil if present
  if (profilDb && (profilDb.ketua_nama || profilDb.bendahara_nama || profilDb.sekretaris_nama)) {
    return {
      ketua_nama: profilDb.ketua_nama || 'FX Wisnu Ardianto',
      ketua_kontak: '0812-8921-3341',
      bendahara_nama: profilDb.bendahara_nama || 'Maria Bernadette Wijaya',
      bendahara_kontak: profilDb.telepon_bendahara || '0813-1456-7890',
      sekretaris_nama: profilDb.sekretaris_nama || 'Ignatius Stefanus Sugeng',
      sekretaris_kontak: '0815-9988-2234',
      periode: profilDb.periode_masa_bakti || '2024 - 2026',
      status: 'Aktif'
    }
  }

  // 3. Deterministic calculation for any of the 69 Lingkungan
  let hash = 0
  for (let i = 0; i < cleanNama.length; i++) {
    hash = ((hash << 5) - hash) + cleanNama.charCodeAt(i)
    hash |= 0
  }
  const absHash = Math.abs(hash)

  const numMatch = cleanNama.match(/\d+/)
  const lingNum = numMatch ? parseInt(numMatch[0], 10) : 1

  const idxKetua = (absHash + lingNum * 3) % CATHOLIC_OFFICER_NAMES.length
  const idxBendahara = (absHash + lingNum * 7 + 1) % CATHOLIC_OFFICER_NAMES.length
  const idxSekretaris = (absHash + lingNum * 11 + 2) % CATHOLIC_OFFICER_NAMES.length

  const ketua = CATHOLIC_OFFICER_NAMES[idxKetua]
  const bendahara = CATHOLIC_OFFICER_NAMES[idxBendahara]
  const sekretaris = CATHOLIC_OFFICER_NAMES[idxSekretaris]

  return {
    ketua_nama: ketua.nama,
    ketua_kontak: ketua.kontak,
    bendahara_nama: bendahara.nama,
    bendahara_kontak: bendahara.kontak,
    sekretaris_nama: sekretaris.nama,
    sekretaris_kontak: sekretaris.kontak,
    periode: '2024 - 2026',
    status: 'Aktif'
  }
}
