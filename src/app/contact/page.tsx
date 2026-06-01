import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Contacto',
  description: 'Canales de contacto de Hay Fulbo.',
  alternates: {
    canonical: 'https://hayfulbo.com/contact',
  },
}

export default function ContactPage() {
  return (
    <main className="min-w-0">
      <section className="hf-card overflow-hidden rounded-2xl text-white">
        <div className="hf-section-head px-4 py-4 sm:px-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#70ff9d]">
            Hay Fulbo
          </p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Contacto</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#c8d3cf]">
            Si tenés consultas, sugerencias, reportes de errores o pedidos
            relacionados con el sitio, podés escribirnos por email.
          </p>
        </div>

        <div className="space-y-6 px-4 py-5 text-sm leading-7 text-[#dbe5df] sm:px-5">
          <div className="rounded-2xl border border-[#70ff9d]/15 bg-[#07100d]/72 p-4">
            <h2 className="text-lg font-black text-white">Email</h2>
            <p className="mt-2">
              <a
                href="mailto:contacto@hayfulbo.com"
                className="font-bold text-[#70ff9d] transition hover:text-white"
              >
                contacto@hayfulbo.com
              </a>
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black text-white">Consultas habituales</h2>
            <p className="mt-2">
              Podemos recibir mensajes sobre funcionamiento del sitio,
              correcciones de datos, privacidad, publicidad, derechos de autor,
              contenido publicado y experiencia de usuario.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black text-white">Sitio</h2>
            <p className="mt-2">
              Dominio principal:{' '}
              <Link href="/" className="font-bold text-[#70ff9d] transition hover:text-white">
                https://hayfulbo.com
              </Link>
            </p>
            <p className="mt-2">
              Hay Fulbo ofrece resultados de fútbol, fixtures, estadísticas,
              prode y contenido relacionado, principalmente para usuarios de
              Argentina.
            </p>
          </div>

          <p className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-xs leading-6 text-[#aebbb6]">
            Intentamos responder los mensajes en un plazo razonable. Para
            pedidos vinculados con privacidad, incluí la mayor cantidad de
            información posible para poder identificar tu consulta.
          </p>
        </div>
      </section>
    </main>
  )
}
