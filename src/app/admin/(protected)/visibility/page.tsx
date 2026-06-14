import AdminCard from '@/components/admin/AdminCard'
import AdminNotice from '@/components/admin/AdminNotice'
import {
  createVisibilityRuleAction,
  saveVisibilityRuleAction,
} from '@/app/admin/actions'
import {
  getVisibilityRules,
  VISIBILITY_RULE_TYPES,
} from '@/server/admin/visibility'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function AdminVisibilityPage() {
  const rulesResult = await getVisibilityRules()
  const rules = rulesResult.data

  return (
    <div className="space-y-4">
      {rulesResult.error ? (
        <AdminNotice
          title={rulesResult.error.setupRequired ? 'SQL pendiente' : 'Error de datos'}
          message={rulesResult.error.message}
          tone="danger"
        />
      ) : null}

      <AdminCard
        title="Visibilidad"
        description="Reglas internas para ocultar ligas, equipos, fixtures, paises o keywords en una v2."
      >
        <form
          action={createVisibilityRuleAction}
          className="mb-4 grid gap-2 md:grid-cols-[160px_1fr_1fr_auto]"
        >
          <select
            name="ruleType"
            defaultValue="league"
            className="hf-input h-10 rounded-xl px-3 text-sm"
          >
            {VISIBILITY_RULE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <input
            name="value"
            required
            placeholder="Valor"
            className="hf-input h-10 rounded-xl px-3 text-sm"
          />
          <input
            name="reason"
            placeholder="Motivo"
            className="hf-input h-10 rounded-xl px-3 text-sm"
          />
          <label className="inline-flex h-10 items-center gap-2 text-sm font-semibold text-[#dce7f2]">
            <input
              type="checkbox"
              name="active"
              defaultChecked
              className="h-4 w-4 accent-[#70ff9d]"
            />
            Activa
          </label>
          <button className="hf-button h-10 rounded-xl px-4 text-sm font-black md:col-start-4" type="submit">
            Crear regla
          </button>
        </form>

        {rules.length ? (
          <div className="space-y-3">
            {rules.map((rule) => (
              <form
                key={rule.id}
                action={saveVisibilityRuleAction}
                className="grid gap-2 rounded-xl border border-white/8 bg-black/10 p-3 md:grid-cols-[160px_1fr_1fr_auto]"
              >
                <input type="hidden" name="id" value={rule.id} />
                <select
                  name="ruleType"
                  defaultValue={rule.rule_type}
                  className="hf-input h-10 rounded-xl px-3 text-sm"
                >
                  {VISIBILITY_RULE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <input
                  name="value"
                  defaultValue={rule.value}
                  required
                  className="hf-input h-10 rounded-xl px-3 text-sm"
                />
                <input
                  name="reason"
                  defaultValue={rule.reason ?? ''}
                  placeholder="Motivo"
                  className="hf-input h-10 rounded-xl px-3 text-sm"
                />
                <label className="inline-flex h-10 items-center gap-2 text-sm font-semibold text-[#dce7f2]">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={rule.active}
                    className="h-4 w-4 accent-[#70ff9d]"
                  />
                  Activa
                </label>
                <button className="hf-button h-10 rounded-xl px-4 text-sm font-black md:col-start-4" type="submit">
                  Guardar
                </button>
              </form>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#9aa7b5]">No hay datos todavia.</p>
        )}
      </AdminCard>

      <AdminNotice
        title="Integracion publica pendiente"
        message="Estas reglas no se aplican todavia a Home ni a paginas publicas para evitar cambios de comportamiento en esta v1."
      />
    </div>
  )
}
