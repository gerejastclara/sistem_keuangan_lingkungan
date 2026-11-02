import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { cookies, headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const cookieStore = await cookies()
  const headerList = await headers()
  const host = headerList.get('host') || ''
  const isProduction = host.includes('siclar.or.id')

  let user = null
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data?.user || null
  } catch (err: any) {
    if (err?.digest === 'DYNAMIC_SERVER_USAGE') throw err
    console.error('Error verifying Supabase user in Home page:', err)
  }

  const demoEmail = cookieStore.get('demo_user_email')?.value
  const isAuthed = !!user || !!demoEmail

  if (isAuthed) {
    redirect('/dashboard')
  } else {
    if (isProduction) {
      redirect('https://siclar.or.id')
    } else {
      redirect('/login')
    }
  }
}
