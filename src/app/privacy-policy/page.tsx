import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidad',
  description: 'Política de Privacidad de Hay Fulbo.',
  alternates: {
    canonical: 'https://hayfulbo.com/privacy-policy',
  },
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-w-0">
      <article className="hf-card overflow-hidden rounded-2xl text-white">
        <div className="hf-section-head px-4 py-4 sm:px-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#70ff9d]">
            Hay Fulbo
          </p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">
            Política de Privacidad
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#c8d3cf]">
            Última actualización: 1 de junio de 2026
          </p>
        </div>

        <div className="space-y-7 px-4 py-5 text-sm leading-7 text-[#dbe5df] sm:px-5">
          <section>
            <h2 className="text-lg font-black text-white">1. Quiénes somos</h2>
            <p className="mt-2">
              Hay Fulbo es un sitio disponible en https://hayfulbo.com que
              ofrece resultados de fútbol, fixtures, estadísticas, prode y
              contenido relacionado, con foco principal en Argentina.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">
              2. Información que podemos recopilar
            </h2>
            <p className="mt-2">
              Podemos recopilar información técnica y de uso, como páginas
              visitadas, dispositivo, navegador, dirección IP aproximada,
              fecha, hora, cookies e identificadores similares. Si creas una
              cuenta o participás en el prode, también podemos tratar datos que
              nos brindes, como email, nombre de usuario, preferencias,
              predicciones y actividad asociada a tu cuenta.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">
              3. Cómo usamos la información
            </h2>
            <p className="mt-2">
              Usamos la información para operar el sitio, mostrar resultados y
              contenido, gestionar cuentas y funcionalidades del prode, mejorar
              rendimiento y seguridad, medir uso, prevenir abuso, corregir
              errores y cumplir obligaciones legales cuando corresponda.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">
              4. Cookies, analítica y publicidad
            </h2>
            <p className="mt-2">
              Hay Fulbo puede usar cookies y tecnologías similares para
              recordar preferencias, medir audiencia, mejorar la experiencia y
              mostrar publicidad. Podemos utilizar servicios de analítica, como
              Google Analytics 4 y Vercel Analytics, si se encuentran
              habilitados en el sitio.
            </p>
            <p className="mt-3">
              Cuando mostremos anuncios, proveedores externos, incluido Google,
              pueden usar cookies para publicar anuncios basados en visitas
              anteriores a este u otros sitios. El uso de cookies publicitarias
              de Google permite que Google y sus socios muestren anuncios a los
              usuarios en función de sus visitas a Hay Fulbo y a otros sitios de
              Internet.
            </p>
            <p className="mt-3">
              Los usuarios pueden inhabilitar la publicidad personalizada desde
              la configuración de anuncios de Google o visitar recursos de
              exclusión de terceros, como aboutads.info, cuando estén
              disponibles en su región.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">
              5. Servicios de terceros
            </h2>
            <p className="mt-2">
              El sitio puede integrar servicios de terceros para autenticación,
              alojamiento, analítica, publicidad, imágenes, datos deportivos y
              herramientas técnicas. Estos terceros pueden tratar información de
              acuerdo con sus propias políticas de privacidad.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">
              6. Conservación y seguridad
            </h2>
            <p className="mt-2">
              Conservamos información durante el tiempo necesario para prestar
              el servicio, mantener registros operativos, proteger el sitio y
              cumplir obligaciones aplicables. Aplicamos medidas razonables de
              seguridad, aunque ningún sistema conectado a Internet puede
              garantizar seguridad absoluta.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">
              7. Tus derechos y contacto
            </h2>
            <p className="mt-2">
              Podés contactarnos para solicitar información, corrección,
              actualización o eliminación de datos personales cuando
              corresponda. Escribinos a{' '}
              <a
                href="mailto:contacto@hayfulbo.com"
                className="font-bold text-[#70ff9d] transition hover:text-white"
              >
                contacto@hayfulbo.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">
              8. Cambios en esta política
            </h2>
            <p className="mt-2">
              Podemos actualizar esta Política de Privacidad para reflejar
              cambios del sitio, servicios utilizados o requisitos legales. La
              versión vigente será la publicada en esta página.
            </p>
          </section>
        </div>
      </article>
    </main>
  )
}
