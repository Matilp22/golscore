import { getSupabaseAdminClient } from '@/lib/supabase/admin'

type TextTableConfig = {
  table: string
  idColumn: string
  fields: string[]
}

type SuspiciousText = {
  table: string
  rowId: string
  field: string
  value: string
  suggestedValue: string | null
}

type EncodingFix = SuspiciousText & {
  applied: boolean
}

const TEXT_TABLES: TextTableConfig[] = [
  { table: 'teams', idColumn: 'id', fields: ['name'] },
  { table: 'leagues', idColumn: 'id', fields: ['name', 'country'] },
  {
    table: 'tournament_champions',
    idColumn: 'id',
    fields: ['champion_name', 'runner_up_name', 'venue'],
  },
  {
    table: 'world_cup_finals',
    idColumn: 'id',
    fields: [
      'champion_name',
      'champion_canonical_name',
      'runner_up_name',
      'runner_up_canonical_name',
      'venue',
      'city',
      'country',
      'notes',
    ],
  },
  {
    table: 'copa_argentina_champions',
    idColumn: 'id',
    fields: ['champion_name', 'runner_up_name', 'venue'],
  },
]

const SUSPICIOUS_ENCODING_PATTERN = /Ã|Â|ï¿½|�/

function countSuspiciousEncoding(value: string) {
  return (value.match(/Ã|Â|ï¿½|�/g) ?? []).length
}

function isMissingTableError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ''

  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    message.includes('schema cache') ||
    message.includes('does not exist')
  )
}

export function hasSuspiciousEncoding(value: string | null | undefined) {
  return Boolean(value && SUSPICIOUS_ENCODING_PATTERN.test(value))
}

export function fixMojibakeText(value: string | null | undefined) {
  if (!value || !hasSuspiciousEncoding(value)) return value ?? null

  let current = value
  let best = value
  let bestScore = countSuspiciousEncoding(value)

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const decoded = Buffer.from(current, 'latin1').toString('utf8')
    const score = countSuspiciousEncoding(decoded)

    if (score < bestScore) {
      best = decoded
      bestScore = score
    }

    if (!decoded || decoded === current) break
    current = decoded
  }

  return best === value ? null : best
}

export async function auditTextEncoding() {
  const supabase = getSupabaseAdminClient()
  const suspiciousTexts: SuspiciousText[] = []
  const checkedTables: Array<{
    table: string
    rowsChecked: number
    suspiciousFields: number
    skipped?: boolean
    error?: string
  }> = []

  for (const config of TEXT_TABLES) {
    const columns = [config.idColumn, ...config.fields].join(', ')
    const { data, error } = await supabase
      .from(config.table)
      .select(columns)
      .limit(5000)

    if (error) {
      checkedTables.push({
        table: config.table,
        rowsChecked: 0,
        suspiciousFields: 0,
        skipped: isMissingTableError(error),
        error: error.message,
      })
      continue
    }

    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>
    let suspiciousFields = 0

    for (const row of rows) {
      const rowId = String(row[config.idColumn] ?? '')

      for (const field of config.fields) {
        const value = row[field]
        if (typeof value !== 'string' || !hasSuspiciousEncoding(value)) continue

        suspiciousFields += 1
        suspiciousTexts.push({
          table: config.table,
          rowId,
          field,
          value,
          suggestedValue: fixMojibakeText(value),
        })
      }
    }

    checkedTables.push({
      table: config.table,
      rowsChecked: rows.length,
      suspiciousFields,
    })
  }

  return {
    ok: suspiciousTexts.length === 0,
    checkedTables,
    suspiciousTexts,
    examples: suspiciousTexts.slice(0, 30),
    suggestedFixes: suspiciousTexts.filter((item) => item.suggestedValue),
    warnings: suspiciousTexts.length
      ? ['Hay textos con patrones compatibles con mojibake UTF-8/Latin-1.']
      : [],
  }
}

export async function fixTextEncoding(input: { dryRun?: boolean } = {}) {
  const dryRun = input.dryRun ?? true
  const audit = await auditTextEncoding()
  const supabase = getSupabaseAdminClient()
  const fixes: EncodingFix[] = []
  const errors: Array<{ table: string; rowId: string; field: string; error: string }> = []

  for (const item of audit.suggestedFixes) {
    const config = TEXT_TABLES.find((table) => table.table === item.table)
    if (!config || !item.suggestedValue || item.suggestedValue === item.value) continue

    let applied = false

    if (!dryRun) {
      const { error } = await supabase
        .from(item.table)
        .update({ [item.field]: item.suggestedValue })
        .eq(config.idColumn, item.rowId)

      if (error) {
        errors.push({
          table: item.table,
          rowId: item.rowId,
          field: item.field,
          error: error.message,
        })
      } else {
        applied = true
      }
    }

    fixes.push({
      ...item,
      applied,
    })
  }

  return {
    ok: errors.length === 0,
    dryRun,
    checkedTables: audit.checkedTables,
    suspiciousTextsBefore: audit.suspiciousTexts.length,
    fixesPrepared: fixes.length,
    fixesApplied: fixes.filter((fix) => fix.applied).length,
    fixes,
    errors,
    warnings: dryRun
      ? ['Dry run activo: no se modificaron datos.']
      : audit.warnings,
  }
}
