import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If env variables are missing or placeholders, fail-safe gracefully
  if (!supabaseUrl || !supabaseKey || supabaseKey.includes('YOUR_SUPABASE_ANON_KEY')) {
    return response
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    })

    const { data: { user } } = await supabase.auth.getUser()

    // Cek session login terpusat (.siclar.or.id)
    const demoEmail = request.cookies.get('demo_user_email')?.value
    const isAuthed = !!user || !!demoEmail

    const isProduction = request.nextUrl.hostname.includes('siclar.or.id')

    // 1. Jika belum login dan mencoba membuka area dashboard:
    if (!isAuthed && request.nextUrl.pathname.startsWith('/dashboard')) {
      if (isProduction) {
        // Alihkan langsung ke login terpusat SICLAR (siclar.or.id)
        return NextResponse.redirect('https://siclar.or.id')
      }
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // 2. Jika di production dan membuka /login keuangan secara manual:
    // Alihkan langsung ke portal login resmi siclar.or.id
    if (!isAuthed && request.nextUrl.pathname.startsWith('/login') && isProduction) {
      return NextResponse.redirect('https://siclar.or.id')
    }

    // 3. Jika sudah login dan membuka /login:
    if (isAuthed && request.nextUrl.pathname.startsWith('/login')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  } catch (err) {
    console.error('Middleware error:', err)
  }

  return response
}
