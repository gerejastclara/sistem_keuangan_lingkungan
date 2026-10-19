'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UserProfile, Lingkungan } from '@/lib/types'
import { getWilayahForLingkungan, formatNamaLingkungan, getAllMasterLingkungan, getLingkunganDbUuid, getNamaLingkunganFromAnyIdentifier } from '@/lib/constants'
import { LogOut, Building2, User, ChevronDown, Menu, Bell, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getDafuApprovals, DafuApprovalItem } from '@/lib/dafuApproval'

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
  const router = useRouter()
  const [showProfileMenu, setShowProfileMenu] = React.useState(false)
  const [showNotifMenu, setShowNotifMenu] = React.useState(false)
  const [approvals, setApprovals] = React.useState<DafuApprovalItem[]>([])

  useEffect(() => {
    const loadNotifs = () => {
      setApprovals(getDafuApprovals())
    }
    loadNotifs()
    window.addEventListener('dafuApprovalUpdated', loadNotifs)
    window.addEventListener('storage', loadNotifs)
    return () => {
      window.removeEventListener('dafuApprovalUpdated', loadNotifs)
      window.removeEventListener('storage', loadNotifs)
    }
  }, [])

  const pendingApprovals = approvals.filter(a => a.status === 'PENDING')
  const pendingCount = pendingApprovals.length

  const resolveLingkunganLabel = (id: string | null): string => {
    if (!id || id === 'all' || id === '') return 'Seluruh Lingkungan (69)'
    const foundDirect = lingkunganList.find((l) => l.id === id)
    if (foundDirect) return formatNamaLingkungan(foundDirect.nama_lingkungan)

    return getNamaLingkunganFromAnyIdentifier(id)
  }

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'SEKRETARIS_PAROKI':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            Sekretaris Paroki (Approval DAFU)
          </span>
        )
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
    resolveLingkunganLabel(selectedLingkunganId)

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
            {(userProfile?.role === 'PAROKI' || userProfile?.role === 'SEKRETARIS_PAROKI') ? (
              <Select value={selectedLingkunganId || 'all'} onValueChange={(val) => val && onLingkunganChange(val)}>
                <SelectTrigger className="h-6 border-none bg-transparent shadow-none focus:ring-0 text-xs font-semibold p-0 text-white gap-1.5 cursor-pointer max-w-[210px]">
                  <span className="truncate">{resolveLingkunganLabel(selectedLingkunganId)}</span>
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto bg-[#16233F] border-[#2C3E66] text-slate-100">
                  <SelectItem value="all" className="hover:bg-[#22335A] focus:bg-[#22335A] focus:text-white font-bold text-[#A9834F]">
                    <div className="flex items-center justify-between w-full gap-3">
                      <span>Seluruh Lingkungan (69)</span>
                      <span className="text-[10px] bg-[#22335A] text-[#A9834F] px-1.5 py-0.5 rounded border border-[#2C3E66]">
                        Semua
                      </span>
                    </div>
                  </SelectItem>
                  {lingkunganList.map((l) => (
                    <SelectItem key={l.id} value={l.id} className="hover:bg-[#22335A] focus:bg-[#22335A] focus:text-white">
                      <div className="flex items-center justify-between w-full gap-3">
                        <span className="font-medium">{formatNamaLingkungan(l.nama_lingkungan)}</span>
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

          {/* Notification Bell (Khusus Sekretaris Paroki) */}
          {userProfile?.role === 'SEKRETARIS_PAROKI' && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowNotifMenu(!showNotifMenu)
                  setShowProfileMenu(false)
                }}
                className="relative p-2 rounded-[7px] bg-[#22335A] hover:bg-[#2C3E66] text-[#A9834F] hover:text-white border border-[#2C3E66] transition cursor-pointer flex items-center justify-center shrink-0 shadow-xs"
                title="Notifikasi Pengajuan DAFU"
              >
                <Bell className="w-4 h-4" />
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse shadow-sm">
                    {pendingCount}
                  </span>
                )}
              </button>

              {showNotifMenu && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#16233F] border border-[#2C3E66] rounded-xl shadow-2xl p-3 z-50 text-xs text-slate-200">
                  <div className="flex items-center justify-between pb-2 border-b border-[#2C3E66] mb-2">
                    <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                      <ShieldCheck className="w-4 h-4 text-[#A9834F]" />
                      <span>Notifikasi Approval DAFU</span>
                    </div>
                    {pendingCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {pendingCount} Menunggu
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Semua selesai
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {pendingApprovals.length === 0 ? (
                      <div className="text-center py-6 text-slate-400">
                        <p className="text-xs">Tidak ada permohonan DAFU yang menunggu persetujuan.</p>
                      </div>
                    ) : (
                      pendingApprovals.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            setShowNotifMenu(false)
                            router.push('/dashboard/approval')
                          }}
                          className="p-2.5 rounded-lg bg-[#22335A]/60 hover:bg-[#22335A] border border-[#2C3E66] transition cursor-pointer space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-xs truncate">
                              {item.nama_lingkungan}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {item.action_type === 'TAMBAH_KK' ? '+ KK Baru' : 'Ubah KK'}
                            </span>
                          </div>
                          <p className="text-slate-300 text-[11px] truncate font-medium">
                            {item.nama_kk}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-[#8A90A3] pt-0.5">
                            <span>Golongan: {item.golongan}</span>
                            <span className="text-slate-300 font-semibold hover:underline">Tinjau →</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pt-2.5 mt-2 border-t border-[#2C3E66]">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setShowNotifMenu(false)
                        router.push('/dashboard/approval')
                      }}
                      className="w-full bg-slate-600 hover:bg-slate-700 text-white font-bold h-8 text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>Buka Modul Approval Lengkap</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Profile Menu Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 bg-[#22335A] hover:bg-[#22335A]/80 p-1.5 pr-3 rounded-[7px] border border-[#2C3E66] transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-[5px] bg-[#A9834F]/20 border border-[#A9834F]/30 text-[#A9834F] font-bold flex items-center justify-center text-xs shrink-0">
                {(userProfile?.username || userProfile?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="text-left hidden md:block">
                <div className="text-xs font-bold text-white leading-tight truncate max-w-[140px]">
                  {userProfile?.username || (userProfile?.email ? userProfile.email.split('@')[0] : 'User')}
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
                  <p className="font-bold text-white text-sm truncate">{userProfile?.username || userProfile?.email}</p>
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


