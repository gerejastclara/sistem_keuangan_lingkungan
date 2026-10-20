'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ClipboardEdit,
  Users,
  BookOpen,
  Receipt,
  FileSpreadsheet,
  Package,
  CreditCard,
  Lock,
  Building2,
  ShieldCheck,
  ChevronLeft,
  SlidersHorizontal,
  FileText,
  HandCoins,
  Printer,
  CheckCircle2
} from 'lucide-react'
import { UserRole } from '@/lib/types'
import { getDafuApprovals, fetchDafuApprovals } from '@/lib/dafuApproval'

interface SidebarProps {
  userRole?: UserRole
  isOpen?: boolean
  onToggle?: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  userRole = 'BENDAHARA',
  isOpen = true,
  onToggle,
}) => {
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const updateCount = async () => {
      const cached = getDafuApprovals()
      if (cached && cached.length > 0) {
        setPendingCount(cached.filter(i => i.status === 'PENDING').length)
      }
      try {
        const list = await fetchDafuApprovals()
        setPendingCount(list.filter(i => i.status === 'PENDING').length)
      } catch (e) {}
    }
    updateCount()
    window.addEventListener('dafuApprovalUpdated', updateCount)
    window.addEventListener('storage', updateCount)
    return () => {
      window.removeEventListener('dafuApprovalUpdated', updateCount)
      window.removeEventListener('storage', updateCount)
    }
  }, [])

  const allNavItems = [
    {
      title: 'Dashboard Overview',
      href: '/dashboard',
      icon: LayoutDashboard,
      roles: ['BENDAHARA', 'SEKRETARIS', 'PAROKI', 'SEKRETARIS_PAROKI'],
    },
    {
      title: 'Approval DAFU Lingkungan',
      href: '/dashboard/approval',
      icon: ShieldCheck,
      roles: ['SEKRETARIS_PAROKI'],
    },
    {
      title: 'Matching Data Excel',
      href: '/dashboard/matching-excel',
      icon: FileSpreadsheet,
      roles: ['SEKRETARIS_PAROKI'],
    },
    // Modul Monitoring Khusus Paroki
    {
      title: 'Sekretariat Paroki (Pengurus & DAFU)',
      href: '/dashboard/paroki/sekretaris',
      icon: Users,
      roles: ['PAROKI'],
    },
    {
      title: 'Monitoring Kas & Setoran',
      href: '/dashboard/paroki/bendahara',
      icon: CreditCard,
      roles: ['PAROKI'],
    },
    // Modul Operasional Lingkungan
    {
      title: 'DAFU (Input Umat)',
      href: '/dashboard/dafu',
      icon: Users,
      roles: ['SEKRETARIS', 'PAROKI'],
    },
    {
      title: 'Kriteria Golongan',
      href: '/dashboard/kriteria-golongan',
      icon: SlidersHorizontal,
      roles: ['SEKRETARIS', 'PAROKI'],
    },
    {
      title: 'Form Standar Sekretariat',
      href: '/dashboard/form-standar',
      icon: FileText,
      roles: ['SEKRETARIS', 'PAROKI'],
    },
    {
      title: 'COA & Saldo Awal',
      href: '/dashboard/coa-saldo',
      icon: BookOpen,
      roles: ['BENDAHARA', 'PAROKI'],
    },
    {
      title: 'Jurnal Transaksi',
      href: '/dashboard/jurnal',
      icon: Receipt,
      roles: ['BENDAHARA', 'PAROKI'],
    },
    {
      title: 'Buku Besar Talangan',
      href: '/dashboard/dana-talangan',
      icon: HandCoins,
      roles: ['BENDAHARA', 'PAROKI'],
    },
    {
      title: 'Laporan Aktivitas',
      href: '/dashboard/laporan',
      icon: FileSpreadsheet,
      roles: ['BENDAHARA', 'PAROKI'],
    },
    {
      title: 'Daftar Aset',
      href: '/dashboard/aset',
      icon: Package,
      roles: ['BENDAHARA', 'PAROKI'],
    },
    {
      title: 'Kartu Setoran',
      href: '/dashboard/kartu-setoran',
      icon: CreditCard,
      roles: ['BENDAHARA', 'PAROKI'],
    },
    {
      title: 'Form Setoran (PDF)',
      href: '/dashboard/form-setoran',
      icon: Printer,
      roles: ['BENDAHARA', 'PAROKI'],
    },
  ]

  // Filter items based on user role
  // Sekretaris: Dashboard Overview, DAFU, Kriteria Golongan, Form Standar
  // Bendahara: Dashboard Overview, COA & Saldo Awal, Jurnal Transaksi, Laporan, Aset, Kartu Setoran
  // Paroki: All modules including Paroki Monitoring modules
  const visibleNavItems = allNavItems.filter((item) => {
    if (userRole === 'SEKRETARIS_PAROKI') {
      return (
        item.href === '/dashboard' ||
        item.href === '/dashboard/approval' ||
        item.href === '/dashboard/matching-excel' ||
        item.href === '/dashboard/kriteria-golongan'
      )
    }
    if (userRole === 'SEKRETARIS') {
      return (
        item.href === '/dashboard' ||
        item.href === '/dashboard/dafu' ||
        item.href === '/dashboard/kriteria-golongan' ||
        item.href === '/dashboard/form-standar'
      )
    }
    if (userRole === 'BENDAHARA') {
      return (
        item.href === '/dashboard' ||
        item.href === '/dashboard/coa-saldo' ||
        item.href === '/dashboard/jurnal' ||
        item.href === '/dashboard/dana-talangan' ||
        item.href === '/dashboard/laporan' ||
        item.href === '/dashboard/aset' ||
        item.href === '/dashboard/kartu-setoran' ||
        item.href === '/dashboard/form-setoran'
      )
    }
    if (userRole === 'PAROKI') {
      return (
        item.roles.includes('PAROKI') &&
        item.href !== '/dashboard/form-standar' &&
        item.href !== '/dashboard/coa-saldo' &&
        item.href !== '/dashboard/dafu' &&
        item.href !== '/dashboard/approval' &&
        item.href !== '/dashboard/matching-excel'
      )
    }
    return true
  })

  if (!isOpen) return null

  return (
    <aside className="w-64 bg-[#16233F] text-[#8A90A3] p-4 border-r border-[#2C3E66] shrink-0 flex flex-col justify-between h-full shadow-2xl transition-all duration-200">
      <div className="flex flex-col gap-4 overflow-y-auto no-scrollbar">
        {/* Single Official Logo in Top-Left Sidebar + Close Toggle */}
        <div className="flex items-center justify-between gap-2 px-1 py-1">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/logo-st-clara.jpg"
              alt="Logo Gereja Santa Clara"
              className="w-10 h-10 rounded-full object-cover border border-[#2C3E66] bg-white shrink-0 shadow-sm"
            />
            <div className="min-w-0">
              <div className="text-base font-extrabold text-white tracking-wide truncate uppercase font-serif">SICLAR</div>
              <div className="text-[11px] text-[#8A90A3] font-medium truncate">Lingkungan</div>
            </div>
          </div>
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              className="p-1.5 rounded-lg text-[#8A90A3] hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
              title="Tutup Bar Samping"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Role & Access Info Card */}
        <div className="bg-[#22335A] rounded-[10px] p-3.5 border border-[#2C3E66] shadow-sm">
          <div className="text-xs font-bold text-white truncate font-serif">Paroki Bekasi Utara</div>
          <div className="text-[11px] text-[#8A90A3] font-medium truncate mb-2">Bekasi Utara</div>

          <div className="text-[10px] uppercase tracking-wider font-bold text-[#8A90A3] font-serif">
            HAK AKSES ROLE:
          </div>
          <div className="text-xs font-bold text-white mt-0.5 flex items-center justify-between gap-1">
            <span className="truncate font-serif">
              {userRole === 'BENDAHARA' && 'Bendahara Lingkungan'}
              {userRole === 'SEKRETARIS' && 'Sekretaris Lingkungan'}
              {userRole === 'SEKRETARIS_PAROKI' && 'Sekretaris Paroki'}
              {userRole === 'PAROKI' && 'Pengawas Paroki'}
            </span>
            {userRole === 'SEKRETARIS_PAROKI' && (
              <span className="text-[9px] bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5 shrink-0">
                <ShieldCheck className="w-2.5 h-2.5" /> Approval
              </span>
            )}
            {userRole === 'PAROKI' && (
              <span className="text-[9px] bg-[#F6EFE2] text-[#5A4423] border border-[#A9834F]/30 px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5 shrink-0">
                <Lock className="w-2.5 h-2.5" /> View-Only
              </span>
            )}
            {userRole === 'SEKRETARIS' && (
              <span className="text-[9px] bg-purple-500/20 text-purple-200 border border-purple-500/30 px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5 shrink-0">
                <ShieldCheck className="w-2.5 h-2.5" /> Isian & DAFU
              </span>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1.5">
          <div className="px-1 text-[10px] font-bold text-[#8A90A3] uppercase tracking-wider mb-1 font-serif">
            MENU UTAMA
          </div>

          <div className="flex flex-col gap-1">
            {visibleNavItems.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              const displayTitle = (userRole === 'SEKRETARIS_PAROKI' && item.href === '/dashboard')
                ? 'Dashboard Seluruh Lingkungan'
                : item.title

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2.5 text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'border-l-2 border-[#A9834F] bg-white/[0.06] text-white font-bold rounded-r-[7px] rounded-l-none pl-2.5'
                      : 'text-[#8A90A3] hover:text-white hover:bg-white/[0.04] rounded-[7px]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#A9834F]' : 'text-[#8A90A3]'}`} />
                    <span className="truncate font-serif">{displayTitle}</span>
                  </div>

                  {item.href === '/dashboard/approval' && pendingCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 font-mono shadow-xs shrink-0">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </nav>
      </div>

      <div className="pt-4 border-t border-[#2C3E66] text-[11px] text-[#8A90A3] flex items-center gap-2 mt-auto">
        <Building2 className="w-4 h-4 text-[#A9834F] shrink-0" />
        <span className="truncate">Gereja St. Clara • v1.1</span>
      </div>
    </aside>
  )
}



