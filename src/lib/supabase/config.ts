const REST_SUFFIX = '/rest/v1'

export function normalizeSupabaseUrl(url: string) {
  const trimmedUrl = url.trim().replace(/\/+$/, '')

  if (trimmedUrl.endsWith(REST_SUFFIX)) {
    return trimmedUrl.slice(0, -REST_SUFFIX.length)
  }

  return trimmedUrl
}

export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    console.error('Supabase env variables missing')
    return null
  }

  return {
    url: normalizeSupabaseUrl(url),
    anonKey,
  }
}

export function getRequiredSupabasePublicConfig() {
  const config = getSupabasePublicConfig()

  if (!config) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }

  return config
}
