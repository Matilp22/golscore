'use client'

import { getSupabaseBrowserClient } from '@/lib/supabase/supabaseClient'

export async function testSupabaseLeaguesConnection() {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.from('leagues').select('*')

  if (error) {
    console.error('Supabase leagues connection error:', error)
    return { data: null, error }
  }

  console.log('Supabase leagues connection OK:', data)
  return { data, error: null }
}
