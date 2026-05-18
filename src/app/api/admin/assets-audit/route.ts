import { NextResponse } from 'next/server'

import { getAssetsAudit } from '@/server/assets/image-assets'

export const dynamic = 'force-dynamic'

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_CRON_SECRET
  if (!cronSecret) return false

  return request.headers.get('x-cron-secret') === cronSecret
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const checkRemote = searchParams.get('checkRemote') !== 'false'
    const remoteLimit = Number(searchParams.get('remoteLimit')) || 25
    const audit = await getAssetsAudit({ checkRemote, remoteLimit })

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
