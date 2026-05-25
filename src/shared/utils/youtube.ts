export function getYouTubeVideoId(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed)
    const hostname = url.hostname.replace(/^www\./, '')
    const pathSegments = url.pathname.split('/').filter(Boolean)

    if (hostname === 'youtu.be') return pathSegments[0] ?? null

    if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) {
      if (url.pathname === '/watch') return url.searchParams.get('v')
      if (['embed', 'shorts', 'live'].includes(pathSegments[0])) {
        return pathSegments[1] ?? null
      }
    }
  } catch {
    return null
  }

  return null
}

export function isValidYouTubeUrl(value?: string | null) {
  return Boolean(getYouTubeVideoId(value))
}

export function getYouTubeWatchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
}

export function getYouTubeThumbnailUrl(value?: string | null) {
  const videoId = getYouTubeVideoId(value)
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null
}
