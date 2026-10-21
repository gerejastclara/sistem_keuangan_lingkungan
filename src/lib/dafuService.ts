import { SupabaseClient } from '@supabase/supabase-js'
import { KepalaKeluarga, AnggotaKeluarga, GolonganKeluarga } from './types'
import { getLingkunganDbUuid } from './constants'

/**
 * Service for querying DAFU data directly from Supabase PostgreSQL Cloud.
 * Pure Database-Driven, zero heavy JSON dependency.
 */

export async function fetchKkListFromDb(
  supabase: SupabaseClient,
  lingkunganId: string
): Promise<KepalaKeluarga[]> {
  const dbUuid = getLingkunganDbUuid(lingkunganId)

  let query = supabase.from('kepala_keluarga').select('*').order('nama_kk', { ascending: true })

  if (lingkunganId && lingkunganId !== 'all') {
    query = query.or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${lingkunganId}`)
  }

  const { data, error } = await query
  if (error) {
    console.error('Error fetching KK list from Supabase:', error)
    return []
  }

  return data || []
}

export async function fetchAnggotaMapFromDb(
  supabase: SupabaseClient,
  kkIds: string[]
): Promise<Record<string, AnggotaKeluarga[]>> {
  if (!kkIds || kkIds.length === 0) return {}

  const map: Record<string, AnggotaKeluarga[]> = {}
  const BATCH_SIZE = 100

  for (let i = 0; i < kkIds.length; i += BATCH_SIZE) {
    const batch = kkIds.slice(i, i + BATCH_SIZE)
    const { data, error } = await supabase
      .from('anggota_keluarga')
      .select('*')
      .in('kk_id', batch)

    if (!error && data) {
      data.forEach((m: AnggotaKeluarga) => {
        if (!map[m.kk_id]) map[m.kk_id] = []
        map[m.kk_id].push(m)
      })
    }
  }

  return map
}

export async function fetchGolonganMapFromDb(
  supabase: SupabaseClient,
  kkIds: string[]
): Promise<Record<string, GolonganKeluarga>> {
  if (!kkIds || kkIds.length === 0) return {}

  const map: Record<string, GolonganKeluarga> = {}
  const BATCH_SIZE = 100

  for (let i = 0; i < kkIds.length; i += BATCH_SIZE) {
    const batch = kkIds.slice(i, i + BATCH_SIZE)
    const { data, error } = await supabase
      .from('golongan_keluarga')
      .select('*')
      .in('kk_id', batch)

    if (!error && data) {
      data.forEach((g: GolonganKeluarga) => {
        map[g.kk_id] = g
      })
    }
  }

  return map
}

export async function fetchLingkunganCountsFromDb(
  supabase: SupabaseClient,
  lingkunganId: string
): Promise<{ kkCount: number; jiwaCount: number }> {
  const dbUuid = getLingkunganDbUuid(lingkunganId)

  const { count: kkCount } = await supabase
    .from('kepala_keluarga')
    .select('*', { count: 'exact', head: true })
    .or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${lingkunganId}`)

  // Get KK IDs to count members
  const { data: kks } = await supabase
    .from('kepala_keluarga')
    .select('id')
    .or(`lingkungan_id.eq.${dbUuid},lingkungan_id.eq.${lingkunganId}`)

  let jiwaCount = 0
  if (kks && kks.length > 0) {
    const ids = kks.map(k => k.id)
    const { count } = await supabase
      .from('anggota_keluarga')
      .select('*', { count: 'exact', head: true })
      .in('kk_id', ids)
    jiwaCount = count || 0
  }

  return {
    kkCount: kkCount || 0,
    jiwaCount: jiwaCount || (kkCount ? kkCount * 3 : 0)
  }
}
