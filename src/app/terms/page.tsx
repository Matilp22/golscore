import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Términos y Condiciones',
  description: 'Términos y Condiciones de uso de Hay Fulbo.',
  alternates: {
    canonical: 'https://hayfulbo.com/terms',
  },
}

export default function TermsPage() {
  return (
    <main className="min-w-0">
      <article className="hf-card overflow-hidden rounded-2xl text-white">
        <div className="hf-section-head px-4 py-4 sm:px-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#70ff9d]">
            Hay Fulbo
          </p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">
            Términos y Condiciones
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#c8d3cf]">
            Última actualización: 1 de junio de 2026
          </p>
        </div>

        <div className="space-y-7 px-4 py-5 text-sm leading-7 text-[#dbe5df] sm:px-5">
          <section>
            <h2 className="text-lg font-black text-white">1. Aceptación</h2>
            <p className="mt-2">
              Al acceder o usar Hay Fulbo aceptás estos Términos y Condiciones.
              Si no estás de acuerdo, por favor no utilices el sitio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">
              2. Descripción del servicio
            </h2>
            <p className="mt-2">
              Hay Fulbo ofrece información sobre fútbol, incluyendo resultados,
              fixtures, estadísticas, tablas, contenido relacionado y
              funcionalidades de prode. El sitio puede cambiar, suspender o
              discontinuar funciones sin aviso previo.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">
              3. Información deportiva
            </h2>
            <p className="mt-2">
              Trabajamos para mostrar información actualizada y precisa, pero no
              garantizamos que todos los datos estén libres de errores,
              demoras u omisiones. Los resultados, horarios y estadísticas son
              informativos y pueden variar según fuentes oficiales o
              proveedores externos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">
              4. Cuentas y prode
            </h2>
            <p className="mt-2">
              Algunas funciones pueden requerir registro. Sos responsable de
              mantener la confidencialidad de tus credenciales y de la actividad
              de tu cuenta. Podemos limitar, suspender o eliminar cuentas o
              participaciones ante uso abusivo, fraudulento o contrario a estos
              términos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">
              5. Uso permitido
            </h2>
            <p className="mt-2">
              No está permitido intentar vulnerar la seguridad del sitio,
              interferir con su funcionamiento, extraer datos de forma abusiva,
              publicar contenido ilegal o usar Hay Fulbo para fines que afecten
              a otros usuarios o a la operación normal del servicio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">
              6. Propiedad intelectual
            </h2>
            <p className="mt-2">
              La marca, identidad visual, textos, interfaces y desarrollos
              propios de Hay Fulbo pertenecen a sus responsables o licenciantes.
              Los nombres, logos y referencias de clubes, competencias o
              terceros pertenecen a sus respectivos titulares. Hay Fulbo no es
              un sitio oficial de ligas, clubes ni federaciones, salvo que se
              indique expresamente lo contrario.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">
              7. Publicidad y enlaces externos
            </h2>
            <p className="mt-2">
              El sitio puede mostrar publicidad y enlaces a servicios de
              terceros. No somos responsables por el contenido, disponibilidad,
              políticas o prácticas de sitios externos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">
              8. Limitación de responsabilidad
            </h2>
            <p className="mt-2">
              Hay Fulbo se ofrece en el estado en que se encuentra. En la medida
              permitida por la normativa aplicable, no seremos responsables por
              daños indirectos, pérdida de datos, interrupciones del servicio o
              decisiones tomadas en base a información publicada en el sitio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">
              9. Ley aplicable y contacto
            </h2>
            <p className="mt-2">
              Estos términos se interpretan de acuerdo con la normativa
              aplicable en Argentina, sin perjuicio de normas imperativas que
              puedan corresponder. Para consultas, escribinos a{' '}
              <a
                href="mailto:contacto@hayfulbo.com"
                className="font-bold text-[#70ff9d] transition hover:text-white"
              >
                contacto@hayfulbo.com
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </main>
  )
}
