import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

type PushSubscriptionPayload = {
  endpoint?: unknown
  keys?: unknown
}

function json(body: Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json(body, init)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function normalizeDeviceId(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 128) : null
}

function normalizeSubscription(value: unknown): PushSubscriptionPayload | null {
  if (!value || typeof value !== 'object') return null

  const subscription = value as PushSubscriptionPayload
  return typeof subscription.endpoint === 'string' && subscription.endpoint.trim()
    ? subscription
    : null
}

async function readBody(request: NextRequest) {
  return (await request.json().catch(() => ({}))) as Record<string, unknown>
}

export async function POST(request: NextRequest) {
  const body = await readBody(request)
  const subscription = normalizeSubscription(body.subscription)
  const deviceId = normalizeDeviceId(body.deviceId)

  if (!subscription || !deviceId) {
    return json(
      { ok: false, error: 'Suscripcion o dispositivo invalido.' },
      { status: 400 }
    )
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { error } = await supabase
      .from('pwa_push_subscriptions')
      .upsert(
        {
          device_id: deviceId,
          endpoint: subscription.endpoint,
          subscription,
          user_agent: request.headers.get('user-agent'),
          disabled_at: null,
        },
        { onConflict: 'endpoint' }
      )

    if (error) throw error

    return json({ ok: true })
  } catch (error) {
    return json(
      {
        ok: false,
        error: 'No se pudo guardar la suscripcion push.',
        detail: getErrorMessage(error),
      },
      { status: 503 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const body = await readBody(request)
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : ''

  if (!endpoint) {
    return json({ ok: false, error: 'Endpoint invalido.' }, { status: 400 })
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { error } = await supabase
      .from('pwa_push_subscriptions')
      .update({ disabled_at: new Date().toISOString() })
      .eq('endpoint', endpoint)

    if (error) throw error

    return json({ ok: true })
  } catch (error) {
    return json(
      {
        ok: false,
        error: 'No se pudo desactivar la suscripcion push.',
        detail: getErrorMessage(error),
      },
      { status: 503 }
    )
  }
}
