export function getYouTubeVideoId(value?: string | null) {
  if (!value) return null

  try {
    const url = new URL(value)
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

export function getYouTubeWatchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
}

export function getYouTubeThumbnailUrl(value?: string | null) {
  const videoId = getYouTubeVideoId(value)
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null
}
