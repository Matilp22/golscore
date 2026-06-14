'use client'

import { useActionState } from 'react'
import {
  runManualSyncAction,
  type ManualSyncActionState,
} from '@/app/admin/actions'

const initialState: ManualSyncActionState = {
  ok: true,
  message: '',
  result: null,
}

export default function ManualSyncForm() {
  const [state, formAction, isPending] = useActionState(
    runManualSyncAction,
    initialState
  )

  return (
    <div className="space-y-4">
      <form action={formAction} className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[#c8d0da]">
            Fecha
          </span>
          <input
            type="date"
            name="date"
            className="hf-input h-11 w-full rounded-xl px-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[#c8d0da]">
            Limite
          </span>
          <input
            type="number"
            name="limit"
            min="1"
            max="50"
            defaultValue="20"
            className="hf-input h-11 w-full rounded-xl px-3 text-sm"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={isPending}
            className="hf-button h-11 rounded-xl px-4 text-sm font-black disabled:cursor-wait disabled:opacity-70"
          >
            {isPending ? 'Ejecutando...' : 'Ejecutar sync manual'}
          </button>
        </div>
      </form>

      {state.message ? (
        <div
          className={`rounded-xl border px-3 py-2 text-sm ${
            state.ok
              ? 'border-[#70ff9d]/20 bg-[#0c1c14]/70 text-[#dce7f2]'
              : 'border-[#ff5f62]/30 bg-[#331414]/70 text-[#ffd5d5]'
          }`}
        >
          <p className="font-black">{state.message}</p>
          {state.result ? (
            <dl className="mt-2 grid gap-2 sm:grid-cols-4">
              <div>
                <dt className="text-[#9aa7b5]">Checked</dt>
                <dd className="font-black">{state.result.checked}</dd>
              </div>
              <div>
                <dt className="text-[#9aa7b5]">Synced</dt>
                <dd className="font-black">{state.result.synced}</dd>
              </div>
              <div>
                <dt className="text-[#9aa7b5]">Cached</dt>
                <dd className="font-black">{state.result.cached}</dd>
              </div>
              <div>
                <dt className="text-[#9aa7b5]">Duration</dt>
                <dd className="font-black">{state.result.durationMs} ms</dd>
              </div>
            </dl>
          ) : null}
          {state.result?.errors.length ? (
            <ul className="mt-2 space-y-1 text-xs">
              {state.result.errors.map((error, index) => (
                <li key={`${error.fixtureId ?? 'global'}-${error.stage}-${index}`}>
                  {error.fixtureId ? `Fixture ${error.fixtureId}: ` : ''}
                  {error.stage} - {error.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
