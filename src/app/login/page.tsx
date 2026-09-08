'use client'

import React, { useState, useEffect } from 'react'
import { login } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { KeyRound, Eye, EyeOff, Building, Users, Shield, Sparkles } from 'lucide-react'
import { getAllMasterLingkungan, formatNamaLingkungan } from '@/lib/constants'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Quick Selector State
  const [selectedRole, setSelectedRole] = useState<'SEKRETARIS' | 'BENDAHARA' | 'PAROKI'>('SEKRETARIS')
  const [selectedLingkunganId, setSelectedLingkunganId] = useState<string>('')
  const [isQuickMode, setIsQuickMode] = useState(false)

  const masterLingkunganList = getAllMasterLingkungan()

  useEffect(() => {
    if (masterLingkunganList.length > 0 && !selectedLingkunganId) {
      // Find Padre Pio 1 or default first
      const defaultL = masterLingkunganList.find(l => l.nama_lingkungan.toLowerCase().includes('padre pio')) || masterLingkunganList[0]
      setSelectedLingkunganId(defaultL.id)
    }
  }, [masterLingkunganList, selectedLingkunganId])

  // Read URL query param message if present on client
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const msg = params.get('message')
      if (msg) setMessage(msg)
    }
  }, [])

  const handleApplyQuickAccount = (role: 'SEKRETARIS' | 'BENDAHARA' | 'PAROKI', lId: string) => {
    setSelectedRole(role)
    if (role === 'PAROKI') {
      setUsername('paroki')
      setSelectedLingkunganId('')
    } else {
      setSelectedLingkunganId(lId)
      const found = masterLingkunganList.find(l => l.id === lId)
      const slug = found ? found.slug.replace(/-/g, '') : 'lingkungan'
      setUsername(`${role.toLowerCase()}_${slug}`)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#16233F] px-4 py-12 text-[#1B2130]">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 shadow-2xl">
            <img
              src="/logo-st-clara.jpg"
              alt="Logo Gereja Santa Clara"
              className="w-20 h-20 rounded-full object-cover border-2 border-[#A9834F] bg-white shadow-xl"
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-serif">
              Sistem Keuangan Lingkungan
            </h1>
            <p className="text-xs text-[#A9834F] font-semibold tracking-widest uppercase">
              Gereja St. Clara • Paroki Bekasi Utara
            </p>
          </div>
        </div>

        {/* Card Authentication */}
        <Card className="border-[#E3E6EC] bg-white shadow-2xl rounded-2xl overflow-hidden">
          <CardHeader className="space-y-1 text-center border-b border-[#E3E6EC] bg-[#F5F6F9]/60 pb-5 pt-6">
            <CardTitle className="text-xl font-bold text-[#1B2130] font-serif">Masuk ke Sistem</CardTitle>
            <CardDescription className="text-xs text-[#5C6478]">
              Akses khusus Sekretaris & Bendahara Lingkungan atau Pengawas Paroki
            </CardDescription>

            {/* Quick Helper Toggle Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsQuickMode(!isQuickMode)}
                className="inline-flex items-center gap-1.5 text-xs text-[#A9834F] font-bold bg-[#A9834F]/10 hover:bg-[#A9834F]/20 px-3 py-1.5 rounded-full transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isQuickMode ? 'Mode Input Manual' : 'Pilih Akun Lingkungan Cepat'}
              </button>
            </div>
          </CardHeader>

          <CardContent className="pt-5 px-6 sm:px-8 pb-7 space-y-4">
            {/* Quick Picker Widget if active */}
            {isQuickMode && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#A9834F]" />
                  Pilih Peran & Lingkungan:
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleApplyQuickAccount('SEKRETARIS', selectedLingkunganId || masterLingkunganList[0]?.id || '')}
                      className={`p-2 rounded-lg text-center font-bold text-[11px] border transition cursor-pointer ${
                        selectedRole === 'SEKRETARIS'
                          ? 'bg-purple-50 text-purple-700 border-purple-300 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      Sekretaris
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyQuickAccount('BENDAHARA', selectedLingkunganId || masterLingkunganList[0]?.id || '')}
                      className={`p-2 rounded-lg text-center font-bold text-[11px] border transition cursor-pointer ${
                        selectedRole === 'BENDAHARA'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      Bendahara
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyQuickAccount('PAROKI', '')}
                      className={`p-2 rounded-lg text-center font-bold text-[11px] border transition cursor-pointer ${
                        selectedRole === 'PAROKI'
                          ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      Paroki
                    </button>
                  </div>

                  {selectedRole !== 'PAROKI' && (
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-600 font-semibold">Pilih Lingkungan Anda:</Label>
                      <Select
                        value={selectedLingkunganId}
                        onValueChange={(val) => val && handleApplyQuickAccount(selectedRole, val)}
                      >
                        <SelectTrigger className="h-9 bg-white border-slate-300 text-xs text-slate-900 rounded-lg">
                          <SelectValue placeholder="Pilih Lingkungan" />
                        </SelectTrigger>
                        <SelectContent className="max-h-56 overflow-y-auto bg-white border-slate-200 text-slate-900 text-xs">
                          {masterLingkunganList.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {formatNamaLingkungan(l.nama_lingkungan)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            )}

            <form action={login} className="space-y-4">
              <input type="hidden" name="lingkungan_id" value={isQuickMode ? selectedLingkunganId : ''} />

              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs font-semibold text-[#1B2130]">Username</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan Username"
                  required
                  className="h-11 bg-white border-[#D3D7E0] text-[#1B2130] rounded-lg focus:ring-[#A9834F] focus:border-[#A9834F] text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-[#1B2130]">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Masukkan Password"
                    className="h-11 bg-white border-[#D3D7E0] text-[#1B2130] rounded-lg focus:ring-[#A9834F] focus:border-[#A9834F] text-sm font-medium pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A90A3] hover:text-[#1B2130] transition-colors p-1 cursor-pointer"
                    title={showPassword ? 'Sembunyikan Password' : 'Tampilkan Password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {message && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs text-center font-bold">
                  {message}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 bg-[#16233F] hover:bg-[#22335A] text-white font-bold rounded-lg transition-all shadow-md cursor-pointer text-sm flex items-center justify-center gap-2 mt-2"
              >
                <KeyRound className="w-4 h-4 text-[#A9834F]" />
                Masuk ke Aplikasi
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-[#8A90A3] font-medium">
          © {new Date().getFullYear()} Gereja St. Clara - Paroki Bekasi Utara • Digital Platform
        </p>
      </div>
    </div>
  )
}



