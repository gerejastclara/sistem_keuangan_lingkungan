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

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('*, lingkungan:lingkungan_id(nama_lingkungan)')
        .eq('id', user.id)
        .maybeSingle()

      if (userData) {
        profile = {
          id: userData.id,
          email: userData.email,
          role: userData.role,
          lingkungan_id: userData.lingkungan_id,
          lingkungan_nama: userData.lingkungan?.nama_lingkungan,
        }
      } else {
        profile = {
          id: user.id,
          email: user.email || 'bendahara@example.com',
          role: 'BENDAHARA',
          lingkungan_id: null,
        }
      }

      const { data: lData } = await supabase
        .from('lingkungan')
        .select('*')
        .order('nama_lingkungan', { ascending: true })

      if (lData) lingkunganList = lData
    }
  } catch (err) {
    console.log('Supabase connection error in layout:', err)
  }

  // Check Demo Cookie fallback if not logged in via Supabase Auth
  if (!profile) {
    const demoEmail = cookieStore.get('demo_user_email')?.value
    const demoRole = cookieStore.get('demo_user_role')?.value as any
    const demoLingkunganId = cookieStore.get('demo_user_lingkungan_id')?.value || null
    const demoLingkunganNama = cookieStore.get('demo_user_lingkungan_nama')?.value || null

    if (demoEmail) {
      profile = {
        id: 'demo-user-id',
        email: demoEmail,
        role: demoRole || (demoEmail.includes('sekretaris') ? 'SEKRETARIS' : demoEmail.includes('paroki') ? 'PAROKI' : 'BENDAHARA'),
        lingkungan_id: demoRole === 'PAROKI' ? null : demoLingkunganId,
        lingkungan_nama: demoRole === 'PAROKI' ? undefined : (demoLingkunganNama || undefined),
      }
    } else {
      redirect('/login')
    }
  }

  // If lingkunganList is empty from database, populate from master list
  if (lingkunganList.length === 0) {
    const { getAllMasterLingkungan } = await import('@/lib/constants')
    lingkunganList = getAllMasterLingkungan().map(m => ({ id: m.id, nama_lingkungan: m.nama_lingkungan }))
  }

  // Enforce consistent lingkungan scoping for non-PAROKI roles based on email or assigned ID
  if (profile && profile.role !== 'PAROKI') {
    const { findLingkunganByQuery, getAllMasterLingkungan } = await import('@/lib/constants')
    const matched = findLingkunganByQuery(profile.email)
    if (matched) {
      profile.lingkungan_id = matched.id
      profile.lingkungan_nama = matched.nama_lingkungan
    } else if (!profile.lingkungan_nama && profile.lingkungan_id) {
      const allM = getAllMasterLingkungan()
      const found = allM.find(l => l.id === profile?.lingkungan_id)
      if (found) profile.lingkungan_nama = found.nama_lingkungan
    }
  }

  return (
    <ClientDashboardShell initialProfile={profile} lingkunganList={lingkunganList}>
      {children}
    </ClientDashboardShell>
  )
}
