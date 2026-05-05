import { NextResponse } from 'next/server'

import { getAssetsAudit } from '@/server/assets/image-assets'

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false

  return request.headers.get('x-cron-secret') === cronSecret
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const audit = await getAssetsAudit()

    return NextResponse.json(
      {
        ok: true,
        ...audit,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo auditar assets.',
      },
      { status: 500 }
    )
  }
}
