'use server'

import { revalidatePath } from 'next/cache'
import { AdminAuthError, requireAdmin } from '@/server/admin/auth'
import { updateAdSlot } from '@/server/admin/ads'
import {
  createBroadcastOverride,
  deleteBroadcastOverride,
  updateBroadcastOverride,
} from '@/server/admin/broadcasts'
import { upsertFeaturedMatch } from '@/server/admin/featured-matches'
import { clampInteger } from '@/server/admin/shared'
import { runManualFixtureSync } from '@/server/admin/sync'
import {
  createVisibilityRule,
  isVisibilityRuleType,
  updateVisibilityRule,
} from '@/server/admin/visibility'

export type ManualSyncActionState = {
  ok: boolean
  message: string
  result: {
    checked: number
    synced: number
    cached: number
    errors: Array<{
      fixtureId: number | null
      stage: string
      message: string
    }>
    durationMs: number
  } | null
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key)

  return typeof value === 'string' ? value.trim() : ''
}

function readOptionalString(formData: FormData, key: string) {
  const value = readString(formData, key)

  return value || null
}

function readBoolean(formData: FormData, key: string) {
  return formData.get(key) === 'on' || formData.get(key) === 'true'
}

function readInteger(
  formData: FormData,
  key: string,
  fallback: number,
  min: number,
  max: number
) {
  const parsed = Number(readString(formData, key))

  return clampInteger(parsed, fallback, min, max)
}

function getActionErrorMessage(error: unknown) {
  if (error instanceof AdminAuthError) return error.message
  if (error instanceof Error) return error.message

  return 'No se pudo completar la accion.'
}

export async function runManualSyncAction(
  _previousState: ManualSyncActionState,
  formData: FormData
): Promise<ManualSyncActionState> {
  try {
    await requireAdmin()

    const date = readOptionalString(formData, 'date')
    const limit = readInteger(formData, 'limit', 20, 1, 50)
    const result = await runManualFixtureSync({ date, limit })

    revalidatePath('/admin')
    revalidatePath('/admin/sync')

    return {
      ok: result.ok,
      message: result.ok
        ? 'Sync manual ejecutado.'
        : 'Sync manual ejecutado con errores.',
      result: {
        checked: result.checked,
        synced: result.synced,
        cached: result.cached,
        errors: result.errors,
        durationMs: result.durationMs,
      },
    }
  } catch (error) {
    return {
      ok: false,
      message: getActionErrorMessage(error),
      result: null,
    }
  }
}

export async function saveFeaturedMatchAction(formData: FormData) {
  await requireAdmin()

  await upsertFeaturedMatch({
    fixtureExternalId: readString(formData, 'fixtureExternalId'),
    title: readOptionalString(formData, 'title'),
    homeTeam: readOptionalString(formData, 'homeTeam'),
    awayTeam: readOptionalString(formData, 'awayTeam'),
    leagueName: readOptionalString(formData, 'leagueName'),
    matchDate: readOptionalString(formData, 'matchDate'),
    featured: readBoolean(formData, 'featured'),
    priority: readInteger(formData, 'priority', 100, 0, 10000),
    note: readOptionalString(formData, 'note'),
  })

  revalidatePath('/admin')
  revalidatePath('/admin/featured-matches')
}

export async function createBroadcastOverrideAction(formData: FormData) {
  await requireAdmin()

  await createBroadcastOverride({
    fixtureExternalId: readString(formData, 'fixtureExternalId'),
    broadcasterName: readString(formData, 'broadcasterName'),
    broadcasterLogoUrl: readOptionalString(formData, 'broadcasterLogoUrl'),
    country: readOptionalString(formData, 'country'),
    active: true,
    priority: readInteger(formData, 'priority', 100, 0, 10000),
    note: readOptionalString(formData, 'note'),
  })

  revalidatePath('/admin/broadcasts')
}

export async function saveBroadcastOverrideAction(formData: FormData) {
  await requireAdmin()

  await updateBroadcastOverride(readString(formData, 'id'), {
    broadcasterName: readString(formData, 'broadcasterName'),
    broadcasterLogoUrl: readOptionalString(formData, 'broadcasterLogoUrl'),
    country: readOptionalString(formData, 'country'),
    active: readBoolean(formData, 'active'),
    priority: readInteger(formData, 'priority', 100, 0, 10000),
    note: readOptionalString(formData, 'note'),
  })

  revalidatePath('/admin/broadcasts')
}

export async function deleteBroadcastOverrideAction(formData: FormData) {
  await requireAdmin()
  await deleteBroadcastOverride(readString(formData, 'id'))

  revalidatePath('/admin/broadcasts')
}

export async function saveAdSlotAction(formData: FormData) {
  await requireAdmin()

  await updateAdSlot({
    id: readString(formData, 'id'),
    label: readString(formData, 'label'),
    location: readString(formData, 'location'),
    provider: readString(formData, 'provider') || 'adsense',
    enabled: readBoolean(formData, 'enabled'),
    notes: readOptionalString(formData, 'notes'),
  })

  revalidatePath('/admin/ads')
}

export async function createVisibilityRuleAction(formData: FormData) {
  await requireAdmin()

  const ruleType = readString(formData, 'ruleType')

  if (!isVisibilityRuleType(ruleType)) {
    throw new Error('Tipo de regla invalido.')
  }

  await createVisibilityRule({
    ruleType,
    value: readString(formData, 'value'),
    reason: readOptionalString(formData, 'reason'),
    active: readBoolean(formData, 'active'),
  })

  revalidatePath('/admin/visibility')
}

export async function saveVisibilityRuleAction(formData: FormData) {
  await requireAdmin()

  const ruleType = readString(formData, 'ruleType')

  if (!isVisibilityRuleType(ruleType)) {
    throw new Error('Tipo de regla invalido.')
  }

  await updateVisibilityRule(readString(formData, 'id'), {
    ruleType,
    value: readString(formData, 'value'),
    reason: readOptionalString(formData, 'reason'),
    active: readBoolean(formData, 'active'),
  })

  revalidatePath('/admin/visibility')
}
