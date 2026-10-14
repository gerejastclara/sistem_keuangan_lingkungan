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

import { getLingkunganDbUuid, getAllMasterLingkungan } from './constants'

export function getPengurusForLingkungan(
  lingkunganId: string | null | undefined,
  namaLingkungan: string | null | undefined,
  profilDb?: {
    ketua_nama?: string | null
    bendahara_nama?: string | null
    sekretaris_nama?: string | null
    telepon_ketua?: string | null
    telepon_bendahara?: string | null
    telepon_sekretaris?: string | null
    periode_masa_bakti?: string | null
    status?: string | null
  } | null
): PengurusLingkungan {
  const cleanId = lingkunganId || 'default'
  const cleanNama = (namaLingkungan || '').replace(/^lingkungan\s+/i, '').trim()

  // 1. Check DB profil if present (authoritative cloud database)
  if (profilDb && (profilDb.ketua_nama || profilDb.bendahara_nama || profilDb.sekretaris_nama)) {
    return {
      ketua_nama: profilDb.ketua_nama || 'Susunan pengurus belum ditentukan',
      ketua_kontak: profilDb.telepon_ketua || '-',
      bendahara_nama: profilDb.bendahara_nama || 'Susunan pengurus belum ditentukan',
      bendahara_kontak: profilDb.telepon_bendahara || '-',
      sekretaris_nama: profilDb.sekretaris_nama || 'Susunan pengurus belum ditentukan',
      sekretaris_kontak: profilDb.telepon_sekretaris || '-',
      periode: profilDb.periode_masa_bakti || '2024 - 2026',
      status: profilDb.status || 'Aktif'
    }
  }

  // 2. Check manual localStorage with all possible identifiers (UUID, slug, master id, clean name)
  if (typeof window !== 'undefined') {
    try {
      const dbUuid = getLingkunganDbUuid(cleanId)
      const allM = getAllMasterLingkungan()
      const matched = allM.find(m => m.id === cleanId || m.nama_lingkungan.toLowerCase() === cleanNama.toLowerCase())
      const mId = matched?.id || ''
      const mSlug = matched?.slug || ''

      const candidateKeys = [
        `profil_manual_${cleanId}`,
        `profil_manual_${dbUuid}`,
        mId ? `profil_manual_${mId}` : null,
        mSlug ? `profil_manual_${mSlug}` : null,
        cleanNama ? `profil_manual_${cleanNama}` : null,
        cleanNama ? `profil_manual_${cleanNama.toLowerCase().replace(/\s+/g, '')}` : null,
        cleanNama ? `profil_manual_${cleanNama.toLowerCase().replace(/[^a-z0-9]/g, '')}` : null,
      ].filter(Boolean) as string[]

      for (const key of candidateKeys) {
        const saved = localStorage.getItem(key)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed.ketuaNama || parsed.bendaharaNama || parsed.sekretarisNama) {
            return {
              ketua_nama: parsed.ketuaNama || 'Susunan pengurus belum ditentukan',
              ketua_kontak: parsed.teleponKetua || '-',
              bendahara_nama: parsed.bendaharaNama || 'Susunan pengurus belum ditentukan',
              bendahara_kontak: parsed.teleponBendahara || '-',
              sekretaris_nama: parsed.sekretarisNama || 'Susunan pengurus belum ditentukan',
              sekretaris_kontak: parsed.teleponSekretaris || '-',
              periode: parsed.periodeMasaBakti || '2024 - 2026',
              status: parsed.status || 'Aktif'
            }
          }
        }
      }
    } catch (e) {}
  }

  // 3. Fallback when not yet configured
  return {
    ketua_nama: 'Susunan pengurus belum ditentukan',
    ketua_kontak: '-',
    bendahara_nama: 'Susunan pengurus belum ditentukan',
    bendahara_kontak: '-',
    sekretaris_nama: 'Susunan pengurus belum ditentukan',
    sekretaris_kontak: '-',
    periode: 'Belum ditentukan',
    status: 'Belum Ditentukan'
  }
}

