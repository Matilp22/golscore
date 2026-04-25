'use client'

import { createBrowserClient } from '@supabase/ssr'
import { getRequiredSupabasePublicConfig } from '@/lib/supabase/config'

export type Database = {
  public: {
    Tables: {
      leagues: {
        Row: {
          id: number
          competition_id: number | null
          external_id: number | null
          name: string
          country: string | null
          season: number
          logo_url: string | null
          created_at: string
        }
        Insert: {
          id?: number
          competition_id?: number | null
          external_id?: number | null
          name: string
          country?: string | null
          season: number
          logo_url?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['leagues']['Insert']>
        Relationships: []
      }
      matches: {
        Row: {
          id: number
          league_id: number | null
          round: string | null
          match_date: string
          home_team_id: number | null
          away_team_id: number | null
          home_score: number | null
          away_score: number | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: number
          league_id?: number | null
          round?: string | null
          match_date: string
          home_team_id?: number | null
          away_team_id?: number | null
          home_score?: number | null
          away_score?: number | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['matches']['Insert']>
        Relationships: []
      }
      predictions: {
        Row: {
          id: string
          user_id: string
          match_id: number
          predicted_home_score: number
          predicted_away_score: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          match_id: number
          predicted_home_score: number
          predicted_away_score: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['predictions']['Insert']>
        Relationships: []
      }
      user_favorite_leagues: {
        Row: {
          id: string
          user_id: string
          league_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          league_id: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['user_favorite_leagues']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient<Database>>

let browserClient: BrowserSupabaseClient | undefined

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient

  const { url, anonKey } = getRequiredSupabasePublicConfig()
  browserClient = createBrowserClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  })

  return browserClient
}

export async function getCurrentSession() {
  const supabase = getSupabaseBrowserClient()
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) throw error

  return session
}

export async function signUpWithEmail(email: string, password: string) {
  const supabase = getSupabaseBrowserClient()
  const username = email.split('@')[0] || 'usuario'

  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
      },
    },
  })
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = getSupabaseBrowserClient()

  return supabase.auth.signInWithPassword({
    email,
    password,
  })
}

export async function signOut() {
  const supabase = getSupabaseBrowserClient()

  return supabase.auth.signOut()
}
