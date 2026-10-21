'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { Sidebar } from '@/components/layout/Sidebar'
import { UserProfile, Lingkungan } from '@/lib/types'
import { createClient } from '@/utils/supabase/client'
import { purgeAllObsoleteLocalStorageCache } from '@/lib/journalSync'
import { findLingkunganByQuery, getNamaLingkunganFromAnyIdentifier } from '@/lib/constants'

interface ClientDashboardShellProps {
  initialProfile: UserProfile | null
  lingkunganList: Lingkungan[]
  children: React.ReactNode
}

export function ClientDashboardShell({
  initialProfile,
  lingkunganList,
  children,
}: ClientDashboardShellProps) {
  const router = useRouter()
  const supabase = createClient()
  const userProfile = initialProfile
  const isParoki = userProfile?.role === 'PAROKI' || userProfile?.role === 'SEKRETARIS_PAROKI'

  // Resolve assigned Lingkungan for non-Paroki users strictly from username / profile
  const assignedLingkungan = useMemo(() => {
    if (isParoki || !userProfile) return null
    if (userProfile.username) {
      const m = findLingkunganByQuery(userProfile.username)
      if (m) return m
    }
    if (userProfile.lingkungan_id) {
      const found = lingkunganList.find(l => l.id === userProfile.lingkungan_id)
      if (found) return { id: found.id, nama_lingkungan: found.nama_lingkungan }
      return {
        id: userProfile.lingkungan_id,
        nama_lingkungan: getNamaLingkunganFromAnyIdentifier(userProfile.lingkungan_id)
      }
    }
    return null
  }, [userProfile, isParoki, lingkunganList])

  const [selectedLingkunganId, setSelectedLingkunganId] = useState<string | null>(() => {
    // If not PAROKI/SEKRETARIS_PAROKI, strictly lock to assigned lingkungan
    if (!isParoki && assignedLingkungan?.id) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('last_user_role', userProfile?.role || 'SEKRETARIS')
        localStorage.setItem('selected_lingkungan_id', assignedLingkungan.id)
      }
      return assignedLingkungan.id
    }

    // If SEKRETARIS_PAROKI, default strictly to 'all' (Seluruh Lingkungan)
    if (userProfile?.role === 'SEKRETARIS_PAROKI') {
      if (typeof window !== 'undefined') {
        const lastRole = localStorage.getItem('last_user_role')
        if (lastRole !== 'SEKRETARIS_PAROKI') {
          localStorage.setItem('last_user_role', 'SEKRETARIS_PAROKI')
          localStorage.setItem('selected_lingkungan_id', 'all')
          return 'all'
        }
        const saved = localStorage.getItem('selected_lingkungan_id')
        if (saved && saved !== 'undefined' && saved !== 'null') return saved
      }
      return 'all'
    }

    // If PAROKI:
    if (userProfile?.role === 'PAROKI') {
      if (typeof window !== 'undefined') {
        const lastRole = localStorage.getItem('last_user_role')
        if (lastRole !== 'PAROKI') {
          localStorage.setItem('last_user_role', 'PAROKI')
          localStorage.setItem('selected_lingkungan_id', 'all')
          return 'all'
        }
        const saved = localStorage.getItem('selected_lingkungan_id')
        if (saved && saved !== 'undefined' && saved !== 'null') return saved
      }
      return 'all'
    }

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selected_lingkungan_id')
      if (saved) return saved
    }
    return userProfile?.lingkungan_id || (lingkunganList.length > 0 ? lingkunganList[0].id : null)
  })

  useEffect(() => {
    // Purge obsolete local storage caches so financial & profile data are 100% database-driven
    purgeAllObsoleteLocalStorageCache()

    // If non-PAROKI, continuously ensure it stays locked to assigned Lingkungan
    if (!isParoki && assignedLingkungan?.id) {
      if (selectedLingkunganId !== assignedLingkungan.id) {
        setSelectedLingkunganId(assignedLingkungan.id)
      }
      localStorage.setItem('selected_lingkungan_id', assignedLingkungan.id)
      localStorage.setItem('last_user_role', userProfile?.role || 'SEKRETARIS')
      return
    }

    if (selectedLingkunganId) {
      localStorage.setItem('selected_lingkungan_id', selectedLingkunganId)
    }
  }, [selectedLingkunganId, isParoki, assignedLingkungan, userProfile])

  const handleLingkunganChange = (id: string) => {
    // Only PAROKI can switch between Lingkungan
    if (!isParoki) return

    setSelectedLingkunganId(id)
    localStorage.setItem('selected_lingkungan_id', id)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('lingkunganChanged'))
      window.dispatchEvent(new Event('storage'))
    }
    router.refresh()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  return (
    <div className="flex h-screen bg-[#F5F6F9] text-[#1B2130] overflow-hidden print:h-auto print:overflow-visible print:bg-white">
      <Sidebar
        userRole={userProfile?.role}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:h-auto print:overflow-visible">
        <Navbar
          userProfile={userProfile}
          lingkunganList={lingkunganList}
          selectedLingkunganId={selectedLingkunganId}
          onLingkunganChange={handleLingkunganChange}
          onLogout={handleLogout}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#F5F6F9] text-[#1B2130] print:h-auto print:overflow-visible print:p-0 print:bg-white">
          {children}
        </main>
      </div>
    </div>
  )
}


