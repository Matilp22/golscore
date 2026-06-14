import 'server-only'

import {
  getAdminClient,
  toAdminDataError,
  type AdminDataResult,
} from '@/server/admin/shared'

export type AdSlotRow = {
  id: string
  slot_key: string
  label: string
  location: string
  provider: string
  enabled: boolean
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

export type AdSlotInput = {
  id: string
  label: string
  location: string
  provider: string
  enabled: boolean
  notes?: string | null
}

export async function getAdSlots(): Promise<AdminDataResult<AdSlotRow[]>> {
  try {
    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('admin_ad_slots')
      .select('*')
      .order('slot_key', { ascending: true })

    if (error) {
      return {
        data: [],
        error: toAdminDataError(error, 'No se pudieron leer slots de publicidad.'),
      }
    }

    return {
      data: (data ?? []) as AdSlotRow[],
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: toAdminDataError(error, 'No se pudo cargar publicidad admin.'),
    }
  }
}

export async function updateAdSlot(input: AdSlotInput) {
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('admin_ad_slots')
    .update({
      label: input.label,
      location: input.location,
      provider: input.provider,
      enabled: input.enabled,
      notes: input.notes || null,
    })
    .eq('id', input.id)

  if (error) {
    throw new Error(`No se pudo guardar el slot de publicidad: ${error.message}`)
  }
}
