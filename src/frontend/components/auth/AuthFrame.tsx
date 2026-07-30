import type { ReactNode } from 'react'

import BrandMark from '@/frontend/components/BrandMark'

type AuthFrameProps = {
  children: ReactNode
  context: 'login' | 'register' | 'recovery'
}

const FRAME_COPY = {
  login: {
    eyebrow: 'Tu tribuna',
    title: 'Todo tu fútbol, también cuando volvés.',
    description:
      'Entrá para recuperar tu Prode, tus torneos privados y las preferencias que guardaste.',
  },
  register: {
    eyebrow: 'Una cuenta, todo Hay Fulbo',
    title: 'Guardá lo que te importa del partido.',
    description:
      'Tu cuenta conecta pronósticos, torneos privados y preferencias sin alterar tus favoritos locales.',
  },
  recovery: {
    eyebrow: 'Acceso seguro',
    title: 'Volvé a entrar sin perder tu lugar.',
    description:
      'El enlace de recuperación es personal y temporal. Hay Fulbo nunca te va a pedir la contraseña por correo.',
  },
} as const

export default function AuthFrame({ children, context }: AuthFrameProps) {
  const copy = FRAME_COPY[context]

  return (
    <main className="hf-account-access">
      <section className="hf-account-access-story" aria-label="Hay Fulbo">
        <div className="hf-account-access-brand">
          <BrandMark />
        </div>
        <div>
          <span className="hf-type-overline">{copy.eyebrow}</span>
          <p className="hf-account-access-title">{copy.title}</p>
          <p className="hf-account-access-description">{copy.description}</p>
        </div>
        <ul className="hf-account-access-benefits">
          <li>
            <span aria-hidden="true">01</span>
            <div>
              <strong>Pronósticos y puntaje</strong>
              <small>Tu recorrido en el Prode queda asociado a tu sesión.</small>
            </div>
          </li>
          <li>
            <span aria-hidden="true">02</span>
            <div>
              <strong>Torneos privados</strong>
              <small>Entrá a tus grupos y retomá cada competencia.</small>
            </div>
          </li>
          <li>
            <span aria-hidden="true">03</span>
            <div>
              <strong>Control en tus manos</strong>
              <small>Podés cerrar sesión y cambiar tus datos cuando quieras.</small>
            </div>
          </li>
        </ul>
      </section>

      <div className="hf-account-access-form">{children}</div>
    </main>
  )
}
