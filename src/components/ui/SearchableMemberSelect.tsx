'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Search, ArrowDownAZ, ArrowUpZA, Check, ChevronDown, User, X, Plus } from 'lucide-react'

export interface MemberOption {
  id: string
  nama: string
  peran?: string
  telepon?: string
  nama_kk?: string
}

interface SearchableMemberSelectProps {
  members: MemberOption[]
  value: string
  onChange: (nama: string, member?: MemberOption) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
}

export const SearchableMemberSelect: React.FC<SearchableMemberSelectProps> = ({
  members,
  value,
  onChange,
  placeholder = 'Pilih atau cari nama anggota...',
  disabled = false,
  required = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input on open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  // Filter and sort members
  const filteredAndSortedMembers = useMemo(() => {
    let result = [...members]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (m) =>
          m.nama.toLowerCase().includes(q) ||
          (m.nama_kk && m.nama_kk.toLowerCase().includes(q)) ||
          (m.peran && m.peran.toLowerCase().includes(q))
      )
    }

    result.sort((a, b) => {
      const comp = a.nama.localeCompare(b.nama, 'id', { sensitivity: 'base' })
      return sortOrder === 'ASC' ? comp : -comp
    })

    return result
  }, [members, searchQuery, sortOrder])

  const handleSelect = (member: MemberOption) => {
    onChange(member.nama, member)
    setIsOpen(false)
    setSearchQuery('')
  }

  const handleCustomInput = () => {
    if (searchQuery.trim()) {
      onChange(searchQuery.trim())
      setIsOpen(false)
      setSearchQuery('')
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Hidden input to support HTML5 required form validation if needed */}
      {required && (
        <input
          type="text"
          value={value}
          onChange={() => {}}
          required
          className="absolute opacity-0 pointer-events-none -bottom-1 left-0 w-full h-1"
          tabIndex={-1}
        />
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full h-9 px-3 rounded-xl text-xs bg-white border flex items-center justify-between gap-2 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
          disabled
            ? 'opacity-60 bg-slate-100 cursor-not-allowed border-slate-200 text-slate-400'
            : isOpen
            ? 'border-emerald-600 ring-2 ring-emerald-500/20'
            : 'border-slate-300 hover:border-slate-400 text-slate-900'
        }`}
      >
        <span className={`truncate flex-1 font-medium ${value ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
          {value || placeholder}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {value && !disabled && (
            <span
              onClick={handleClear}
              className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Kosongkan pilihan"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-emerald-600' : ''}`} />
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full min-w-[280px] bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header Search & Sort Controls */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80 flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama warga..."
                className="w-full pl-8 pr-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')}
              className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer transition shadow-2xs"
              title={`Urutkan nama (${sortOrder === 'ASC' ? 'A-Z' : 'Z-A'})`}
            >
              {sortOrder === 'ASC' ? (
                <>
                  <ArrowDownAZ className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[10px] font-bold">A-Z</span>
                </>
              ) : (
                <>
                  <ArrowUpZA className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-[10px] font-bold">Z-A</span>
                </>
              )}
            </button>
          </div>

          {/* Members List */}
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
            {filteredAndSortedMembers.length === 0 ? (
              <div className="p-4 text-center text-slate-400">
                <p className="text-xs">Tidak ditemukan warga &ldquo;{searchQuery}&rdquo;</p>
                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={handleCustomInput}
                    className="mt-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 mx-auto transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Gunakan &ldquo;{searchQuery.trim()}&rdquo;
                  </button>
                )}
              </div>
            ) : (
              filteredAndSortedMembers.map((m) => {
                const isSelected = value.trim().toLowerCase() === m.nama.trim().toLowerCase()
                return (
                  <div
                    key={m.id}
                    onClick={() => handleSelect(m)}
                    className={`px-3 py-2 flex items-center justify-between cursor-pointer transition ${
                      isSelected
                        ? 'bg-emerald-50/80 text-emerald-900 font-semibold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <User className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                        <span className="truncate font-medium">{m.nama}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-1" />}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5 pl-5">
                        {m.peran && (
                          <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">
                            {m.peran}
                          </span>
                        )}
                        {m.nama_kk && (
                          <span className="truncate">KK: {m.nama_kk}</span>
                        )}
                        {m.telepon && (
                          <span className="text-emerald-600 font-mono">{m.telepon}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Option to use custom name if search query is typed and not an exact match */}
          {searchQuery.trim() &&
            !filteredAndSortedMembers.some((m) => m.nama.toLowerCase() === searchQuery.toLowerCase()) && (
              <div className="p-2 border-t border-slate-100 bg-slate-50">
                <button
                  type="button"
                  onClick={handleCustomInput}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-emerald-700 hover:bg-emerald-100/60 rounded-lg font-semibold flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Gunakan nama &ldquo;{searchQuery.trim()}&rdquo; (Nama Manual)
                </button>
              </div>
            )}
        </div>
      )}
    </div>
  )
}
