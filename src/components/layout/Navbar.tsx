'use client'

import React from 'react'
import { UserProfile, Lingkungan } from '@/lib/types'
import { getWilayahForLingkungan } from '@/lib/constants'
import { LogOut, Building2, User, ChevronDown, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface NavbarProps {
  userProfile: UserProfile | null
  lingkunganList: Lingkungan[]
  selectedLingkunganId: string | null
  onLingkunganChange: (id: string) => void
  onLogout: () => void
  isSidebarOpen?: boolean
  onToggleSidebar?: () => void
}

export const Navbar: React.FC<NavbarProps> = ({
  userProfile,
  lingkunganList,
  selectedLingkunganId,
  onLingkunganChange,
  onLogout,
  isSidebarOpen = true,
  onToggleSidebar,
}) => {
  const [showProfileMenu, setShowProfileMenu] = React.useState(false)

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'BENDAHARA':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            Bendahara Lingkungan
          </span>
        )
      case 'SEKRETARIS':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            Sekretaris (DAFU Only)
          </span>
        )
      case 'PAROKI':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Pengawas Paroki (Read-only)
          </span>
        )
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300">
            User
          </span>
        )
    }
  }

  const currentLingkunganName =
    userProfile?.lingkungan_nama ||
    lingkunganList.find((l) => l.id === selectedLingkunganId)?.nama_lingkungan ||
    'Lingkungan'

  return (
    <header className="bg-[#16233F] text-white border-b border-[#2C3E66] sticky top-0 z-30 shadow-md">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Sidebar Toggle + Text-only Title */}
        <div className="flex items-center gap-3 min-w-0">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="p-2 rounded-[8px] bg-[#22335A] hover:bg-[#2C3E66] text-[#A9834F] hover:text-white border border-[#2C3E66] transition cursor-pointer flex items-center justify-center shrink-0 shadow-xs"
              title={isSidebarOpen ? "Tutup Bar Samping" : "Buka Bar Samping"}
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          <div className="min-w-0">
            <h1 className="font-bold text-sm sm:text-base tracking-tight text-white flex items-center gap-2 truncate font-serif">
              Sistem Keuangan Lingkungan
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-[#22335A] text-[#A9834F] border border-[#2C3E66] px-1.5 py-0.5 rounded-[4px] hidden xs:inline-block font-sans">
                v1.1
              </span>
            </h1>
            <p className="text-xs text-[#8A90A3] font-medium tracking-wide truncate">
              Gereja St. Clara • Paroki Bekasi Utara
            </p>
          </div>
        </div>

        {/* Middle & Right Section */}
        <div className="flex items-center gap-3">
          {/* Lingkungan Scope Indicator / Selector */}
          <div className="flex items-center space-x-2 bg-[#22335A] border border-[#2C3E66] rounded-[7px] px-3 py-1.5 text-xs text-slate-200 shadow-xs">
            <Building2 className="w-4 h-4 text-[#A9834F] shrink-0" />
            {userProfile?.role === 'PAROKI' ? (
              <Select value={selectedLingkunganId || ''} onValueChange={(val) => val && onLingkunganChange(val)}>
                <SelectTrigger className="h-6 border-none bg-transparent shadow-none focus:ring-0 text-xs font-medium p-0 text-white gap-1">
                  <SelectValue placeholder="Pilih Lingkungan" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto bg-[#16233F] border-[#2C3E66] text-slate-100">
                  {lingkunganList.map((l) => (
                    <SelectItem key={l.id} value={l.id} className="hover:bg-[#22335A] focus:bg-[#22335A] focus:text-white">
                      <div className="flex items-center justify-between w-full gap-3">
                        <span>{l.nama_lingkungan}</span>
                        <span className="text-[10px] bg-[#22335A] text-[#A9834F] px-1.5 py-0.5 rounded border border-[#2C3E66]">
                          {getWilayahForLingkungan(l.nama_lingkungan)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white truncate max-w-[140px] sm:max-w-[200px]">
                  {currentLingkunganName}
                </span>
                <span className="text-[10px] bg-[#16233F] text-[#A9834F] font-semibold px-1.5 py-0.5 rounded border border-[#2C3E66] hidden sm:inline-block">
                  {getWilayahForLingkungan(currentLingkunganName)}
                </span>
              </div>
            )}
          </div>

          {/* User Profile Menu Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 bg-[#22335A] hover:bg-[#22335A]/80 p-1.5 pr-3 rounded-[7px] border border-[#2C3E66] transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-[5px] bg-[#A9834F]/20 border border-[#A9834F]/30 text-[#A9834F] font-bold flex items-center justify-center text-xs shrink-0">
                {userProfile?.email ? userProfile.email.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="text-left hidden md:block">
                <div className="text-xs font-bold text-white leading-tight truncate max-w-[140px]">
                  {userProfile?.email ? userProfile.email.split('@')[0] : 'User'}
                </div>
                <div className="text-[10px] text-[#8A90A3] truncate">
                  {userProfile?.role || 'BENDAHARA'}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#8A90A3] ml-0.5 shrink-0" />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-60 bg-[#16233F] border border-[#2C3E66] rounded-[10px] shadow-2xl p-2.5 z-50 text-xs">
                <div className="p-2 border-b border-[#2C3E66] mb-1 space-y-1">
                  <p className="font-bold text-white text-sm truncate">{userProfile?.email}</p>
                  <div className="mt-1">{getRoleBadge(userProfile?.role)}</div>
                </div>

                <button
                  onClick={() => {
                    onLogout()
                    setShowProfileMenu(false)
                  }}
                  className="w-full text-left p-2.5 hover:bg-red-500/20 text-red-300 rounded-[7px] flex items-center gap-2 transition-colors cursor-pointer font-medium mt-1"
                >
                  <LogOut className="w-4 h-4 text-red-400" />
                  <span>Keluar (Logout)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}


