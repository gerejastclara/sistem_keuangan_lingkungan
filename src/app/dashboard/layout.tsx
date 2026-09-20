import { ReactNode } from 'react'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ClientDashboardShell } from './ClientDashboardShell'
import { UserProfile, Lingkungan } from '@/lib/types'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  let profile: UserProfile | null = null
  let lingkunganList: Lingkungan[] = []

  // Ambil list lingkungan dari database
  try {
    const supabase = await createClient()
    const { data: lData } = await supabase
      .from('lingkungan')
      .select('*')
      .order('nama_lingkungan', { ascending: true })

    if (lData && lData.length > 0) {
      lingkunganList = lData
    }
  } catch (err) {
    console.log('Supabase connection error in layout:', err)
  }

  // Jika lingkunganList kosong, fallback ke master list
  if (lingkunganList.length === 0) {
    const { getAllMasterLingkungan } = await import('@/lib/constants')
    lingkunganList = getAllMasterLingkungan().map(m => ({ id: m.id, nama_lingkungan: m.nama_lingkungan }))
  }

  // Baca sesi login langsung dari cookie (berbasis username & password)
  const sessionUsername = cookieStore.get('demo_user_username')?.value || cookieStore.get('demo_user_email')?.value
  const sessionRole = (cookieStore.get('demo_user_role')?.value as any) || (sessionUsername?.includes('sekretaris') ? 'SEKRETARIS' : sessionUsername?.includes('paroki') ? 'PAROKI' : 'BENDAHARA')
  const sessionLingkunganId = cookieStore.get('demo_user_lingkungan_id')?.value || null
  const sessionLingkunganNama = cookieStore.get('demo_user_lingkungan_nama')?.value || null
  const sessionUserId = cookieStore.get('demo_user_id')?.value || 'user-id'

  if (!sessionUsername) {
    redirect('/login')
  }

  profile = {
    id: sessionUserId,
    username: sessionUsername,
    role: sessionRole,
    lingkungan_id: sessionRole === 'PAROKI' ? null : sessionLingkunganId,
    lingkungan_nama: sessionRole === 'PAROKI' ? undefined : (sessionLingkunganNama || undefined),
  }

  // Pastikan nama lingkungan dan id lingkungan sinkron dengan database
  if (profile && profile.role !== 'PAROKI') {
    const isDbUuid = profile.lingkungan_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profile.lingkungan_id)
    if (!isDbUuid || !profile.lingkungan_nama) {
      const { findLingkunganByQuery } = await import('@/lib/constants')
      const matched = findLingkunganByQuery(profile.username || '')
      if (matched) {
        const dbL = lingkunganList.find(l => l.nama_lingkungan.toLowerCase() === matched.nama_lingkungan.toLowerCase())
        profile.lingkungan_id = dbL ? dbL.id : matched.id
        profile.lingkungan_nama = matched.nama_lingkungan

        try {
          cookieStore.set('demo_user_lingkungan_id', profile.lingkungan_id)
          cookieStore.set('demo_user_lingkungan_nama', profile.lingkungan_nama)
        } catch (e) {}
      }
    }
  }

  return (
    <ClientDashboardShell initialProfile={profile} lingkunganList={lingkunganList}>
      {children}
    </ClientDashboardShell>
  )
}
