import { NextResponse } from 'next/server'

import {
  isAllowedRemoteAssetHost,
  normalizeAssetUrl,
} from '@/shared/utils/asset-urls'

export const dynamic = 'force-dynamic'

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
  'Access-Control-Allow-Origin': '*',
}

function isValidImageContentType(contentType: string | null) {
  return Boolean(contentType?.toLowerCase().startsWith('image/'))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const targetUrl = normalizeAssetUrl(searchParams.get('url'))

  if (!targetUrl || targetUrl.startsWith('/') || !isAllowedRemoteAssetHost(targetUrl)) {
    return NextResponse.json(
      { ok: false, error: 'Asset no permitido.' },
      { status: 400, headers: CACHE_HEADERS }
    )
  }

  try {
    const response = await fetch(targetUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
      headers: {
        accept: 'image/avif,image/webp,image/png,image/jpeg,image/svg+xml,image/*,*/*;q=0.8',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: `Asset respondio ${response.status}.` },
        { status: response.status, headers: CACHE_HEADERS }
      )
    }

    const contentType = response.headers.get('content-type') ?? 'image/png'

    if (!isValidImageContentType(contentType)) {
      return NextResponse.json(
        { ok: false, error: 'El recurso no es una imagen.' },
        { status: 415, headers: CACHE_HEADERS }
      )
    }

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        ...CACHE_HEADERS,
        'Content-Type': contentType,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo cargar el asset.',
      },
      { status: 502, headers: CACHE_HEADERS }
    )
  }
}
