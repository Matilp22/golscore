import AdminCard from '@/components/admin/AdminCard'
import AdminNotice from '@/components/admin/AdminNotice'
import { saveAdSlotAction } from '@/app/admin/actions'
import { getAdSlots } from '@/server/admin/ads'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function AdminAdsPage() {
  const slotsResult = await getAdSlots()
  const slots = slotsResult.data

  return (
    <div className="space-y-4">
      {slotsResult.error ? (
        <AdminNotice
          title={slotsResult.error.setupRequired ? 'SQL pendiente' : 'Error de datos'}
          message={slotsResult.error.message}
          tone="danger"
        />
      ) : null}

      <AdminCard
        title="Publicidad"
        description="Configuracion interna para AdSense y futuros sponsors directos. No renderiza anuncios visibles."
      >
        {slots.length ? (
          <div className="space-y-3">
            {slots.map((slot) => (
              <form
                key={slot.id}
                action={saveAdSlotAction}
                className="rounded-xl border border-white/8 bg-black/10 p-3"
              >
                <input type="hidden" name="id" value={slot.id} />
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-mono text-xs text-[#70ff9d]">{slot.slot_key}</p>
                    <p className="text-sm text-[#9aa7b5]">
                      Creado por migracion. Se puede editar metadata, no la key.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#dce7f2]">
                    <input
                      type="checkbox"
                      name="enabled"
                      defaultChecked={slot.enabled}
                      className="h-4 w-4 accent-[#70ff9d]"
                    />
                    Habilitado
                  </label>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <input
                    name="label"
                    defaultValue={slot.label}
                    required
                    className="hf-input h-10 rounded-xl px-3 text-sm"
                  />
                  <input
                    name="location"
                    defaultValue={slot.location}
                    required
                    className="hf-input h-10 rounded-xl px-3 text-sm"
                  />
                  <input
                    name="provider"
                    defaultValue={slot.provider}
                    required
                    className="hf-input h-10 rounded-xl px-3 text-sm"
                  />
                  <input
                    name="notes"
                    defaultValue={slot.notes ?? ''}
                    placeholder="Notas"
                    className="hf-input h-10 rounded-xl px-3 text-sm md:col-span-2"
                  />
                  <button className="hf-button h-10 rounded-xl px-4 text-sm font-black" type="submit">
                    Guardar
                  </button>
                </div>
              </form>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#9aa7b5]">No hay datos todavia.</p>
        )}
      </AdminCard>
    </div>
  )
}
