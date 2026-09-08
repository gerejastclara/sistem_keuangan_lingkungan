'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { findLingkunganByQuery, getAllMasterLingkungan } from '@/lib/constants'

export async function login(formData: FormData) {
  const usernameInput = (formData.get('username') as string || formData.get('email') as string || '').trim().toLowerCase()
  const password = formData.get('password') as string
  const formLingkunganId = (formData.get('lingkungan_id') as string || '').trim()

  if (!usernameInput || !password) {
    redirect('/login?message=Username dan password wajib diisi')
  }

  const email = usernameInput.includes('@') ? usernameInput : `${usernameInput}@example.com`

  let role: 'BENDAHARA' | 'SEKRETARIS' | 'PAROKI' = 'BENDAHARA'
  if (email.includes('sekretaris')) role = 'SEKRETARIS'
  else if (email.includes('paroki')) role = 'PAROKI'

  // Determine Lingkungan Scope
  let assignedLingkunganId: string | null = null
  let assignedLingkunganNama: string | null = null

  if (role !== 'PAROKI') {
    const all = getAllMasterLingkungan()

    // 1. ALWAYS give TOP PRIORITY to the username entered by the user
    // E.g. sekretaris_padrepio3 -> Padre Pio 3, sekretaris_pedro -> Padre Pio 1
    const matchedFromUser = findLingkunganByQuery(usernameInput)
    if (matchedFromUser) {
      assignedLingkunganId = matchedFromUser.id
      assignedLingkunganNama = matchedFromUser.nama_lingkungan
    }

    // 2. Only if username has NO specific lingkungan (e.g. generic "sekretaris" or "bendahara"), use formLingkunganId
    if (!assignedLingkunganId && formLingkunganId) {
      const found = all.find(l => l.id === formLingkunganId)
      if (found) {
        assignedLingkunganId = found.id
        assignedLingkunganNama = found.nama_lingkungan
      }
    }

    // 3. Fallback default to first lingkungan
    if (!assignedLingkunganId && all.length > 0) {
      assignedLingkunganId = all[0].id
      assignedLingkunganNama = all[0].nama_lingkungan
    }
  }

  try {
    const supabase = await createClient()

    // 1. Attempt Sign In with Supabase Auth
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (!signInError && signInData.user) {
      // Ensure users record has correct role & lingkungan_id
      await supabase.from('users').upsert({
        id: signInData.user.id,
        email: email,
        role: role,
        lingkungan_id: assignedLingkunganId,
      })

      const cookieStore = await cookies()
      cookieStore.set('demo_user_email', email)
      cookieStore.set('demo_user_role', role)
      if (assignedLingkunganId) {
        cookieStore.set('demo_user_lingkungan_id', assignedLingkunganId)
        cookieStore.set('demo_user_lingkungan_nama', assignedLingkunganNama || '')
      } else {
        cookieStore.delete('demo_user_lingkungan_id')
        cookieStore.delete('demo_user_lingkungan_nama')
      }

      revalidatePath('/', 'layout')
      redirect('/dashboard')
    }

    // 2. If Sign In failed, try Auto Sign-Up on Supabase Auth
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (!signUpError && signUpData.user) {
      await supabase.from('users').upsert({
        id: signUpData.user.id,
        email: email,
        role: role,
        lingkungan_id: assignedLingkunganId,
      })

      const cookieStore = await cookies()
      cookieStore.set('demo_user_email', email)
      cookieStore.set('demo_user_role', role)
      if (assignedLingkunganId) {
        cookieStore.set('demo_user_lingkungan_id', assignedLingkunganId)
        cookieStore.set('demo_user_lingkungan_nama', assignedLingkunganNama || '')
      }

      revalidatePath('/', 'layout')
      redirect('/dashboard')
    }
  } catch (err: any) {
    console.log('Supabase Auth notice in login action:', err?.message)
  }

  // Demo fallback validation: Accept password123 for any role account
  if (password === 'password123' || password === 'admin123') {
    const cookieStore = await cookies()
    cookieStore.set('demo_user_email', email)
    cookieStore.set('demo_user_role', role)
    if (assignedLingkunganId) {
      cookieStore.set('demo_user_lingkungan_id', assignedLingkunganId)
      cookieStore.set('demo_user_lingkungan_nama', assignedLingkunganNama || '')
    } else {
      cookieStore.delete('demo_user_lingkungan_id')
      cookieStore.delete('demo_user_lingkungan_nama')
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
  }

  // If both Supabase auth & demo user validation failed: reject invalid login
  redirect('/login?message=Username atau password yang Anda masukkan salah')
}
