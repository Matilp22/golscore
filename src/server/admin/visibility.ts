import 'server-only'

import {
  getAdminClient,
  toAdminDataError,
  type AdminDataResult,
} from '@/server/admin/shared'

export type VisibilityRuleType = 'league' | 'team' | 'fixture' | 'country' | 'keyword'

export type VisibilityRuleRow = {
  id: string
  rule_type: VisibilityRuleType
  value: string
  reason: string | null
  active: boolean
  created_at: string | null
  updated_at: string | null
}

export type VisibilityRuleInput = {
  ruleType: VisibilityRuleType
  value: string
  reason?: string | null
  active: boolean
}

export const VISIBILITY_RULE_TYPES: Array<{
  value: VisibilityRuleType
  label: string
}> = [
  { value: 'league', label: 'Liga' },
  { value: 'team', label: 'Equipo' },
  { value: 'fixture', label: 'Fixture' },
  { value: 'country', label: 'Pais' },
  { value: 'keyword', label: 'Keyword' },
]

export function isVisibilityRuleType(value: string): value is VisibilityRuleType {
  return VISIBILITY_RULE_TYPES.some((item) => item.value === value)
}

export async function getVisibilityRules(): Promise<AdminDataResult<VisibilityRuleRow[]>> {
  try {
    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('admin_visibility_rules')
      .select('*')
      .order('active', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(300)

    if (error) {
      return {
        data: [],
        error: toAdminDataError(error, 'No se pudieron leer reglas de visibilidad.'),
      }
    }

    return {
      data: (data ?? []) as VisibilityRuleRow[],
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: toAdminDataError(error, 'No se pudo cargar visibilidad admin.'),
    }
  }
}

export async function createVisibilityRule(input: VisibilityRuleInput) {
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('admin_visibility_rules')
    .insert({
      rule_type: input.ruleType,
      value: input.value,
      reason: input.reason || null,
      active: input.active,
    })

  if (error) {
    throw new Error(`No se pudo crear la regla de visibilidad: ${error.message}`)
  }
}

export async function updateVisibilityRule(id: string, input: VisibilityRuleInput) {
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('admin_visibility_rules')
    .update({
      rule_type: input.ruleType,
      value: input.value,
      reason: input.reason || null,
      active: input.active,
    })
    .eq('id', id)

  if (error) {
    throw new Error(`No se pudo actualizar la regla de visibilidad: ${error.message}`)
  }
}
