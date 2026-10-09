import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { lingkunganId, namaLingkungan, bulan, tahun, reportData, action } = body

    // 1. Ambil Data Real dari Supabase (Contoh Tarik Data DAFU)
    const supabase = await createClient()
    
    // Anda bisa menambahkan logika fetch data dari tabel Supabase di sini
    // const { data: dafuData } = await supabase.from('kepala_keluarga').select('*').eq('lingkungan_id', lingkunganId);
    // body.realData = dafuData; // Sisipkan data asli ke payload yang akan dikirim ke Sheets

    console.log(`Syncing financial report to Google Sheets for ${namaLingkungan} (${bulan}/${tahun})...`)

    // 2. Kirim Data ke Google Apps Script Web App
    // GANTI URL DI BAWAH DENGAN WEB APP URL DARI GOOGLE APPS SCRIPT ANDA
    const GOOGLE_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/GANTI_DENGAN_ID_WEB_APP_ANDA/exec'

    const scriptResponse = await fetch(GOOGLE_SCRIPT_WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const result = await scriptResponse.json()

    if (!result.success) {
      throw new Error(result.error || 'Gagal menyinkronkan dari Apps Script')
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil menyinkronkan laporan finansial ${namaLingkungan} ke Google Sheets!`,
      spreadsheetUrl: result.spreadsheetUrl || '',
      syncedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Error saat ekspor ke Sheets:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menyinkronkan ke Google Sheets' },
      { status: 500 }
    )
  }
}
