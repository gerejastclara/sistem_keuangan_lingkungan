'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { Sidebar } from '@/components/layout/Sidebar'
import { UserProfile, Lingkungan } from '@/lib/types'
import { createClient } from '@/utils/supabase/client'

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
  const [userProfile] = useState<UserProfile | null>(initialProfile)
  const isParoki = userProfile?.role === 'PAROKI'

  const [selectedLingkunganId, setSelectedLingkunganId] = useState<string | null>(() => {
    // If not PAROKI and user has an assigned lingkungan, strictly lock to it!
    if (initialProfile?.role && initialProfile.role !== 'PAROKI' && initialProfile.lingkungan_id) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('selected_lingkungan_id', initialProfile.lingkungan_id)
      }
      return initialProfile.lingkungan_id
    }

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selected_lingkungan_id')
      if (saved) return saved
    }
    return initialProfile?.lingkungan_id || (lingkunganList.length > 0 ? lingkunganList[0].id : null)
  })

  useEffect(() => {
    // If non-PAROKI, continuously ensure it stays locked to assigned Lingkungan
    if (!isParoki && userProfile?.lingkungan_id) {
      if (selectedLingkunganId !== userProfile.lingkungan_id) {
        setSelectedLingkunganId(userProfile.lingkungan_id)
      }
      localStorage.setItem('selected_lingkungan_id', userProfile.lingkungan_id)
      return
    }

    if (selectedLingkunganId) {
      localStorage.setItem('selected_lingkungan_id', selectedLingkunganId)
    }
  }, [selectedLingkunganId, isParoki, userProfile])

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


