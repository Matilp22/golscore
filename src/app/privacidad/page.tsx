import TrustPageLayout from '@/frontend/components/TrustPageLayout'
import { buildSeoMetadata } from '@/shared/seo'

export const metadata = buildSeoMetadata({
  title: 'Privacidad | Hay Fulbo',
  description:
    'Politica de privacidad de Hay Fulbo: datos tratados, cookies, analitica, publicidad, servicios externos y contacto.',
  path: '/privacidad',
})

export default function PrivacidadPage() {
  return (
    <TrustPageLayout
      title="Privacidad"
      summary="Informacion sobre datos personales, cookies, analitica, publicidad y servicios de terceros."
      updatedAt="25 de junio de 2026"
    >
      <section>
        <h2 className="text-lg font-black text-white">Datos que podemos tratar</h2>
        <p className="mt-2">
          Podemos tratar informacion tecnica y de uso, como paginas visitadas,
          dispositivo, navegador, direccion IP aproximada, fecha, hora, cookies
          e identificadores similares. Si creas una cuenta o participas en el
          prode, tambien podemos tratar email, nombre de usuario, preferencias,
          predicciones y actividad asociada a tu cuenta.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-white">Uso de la informacion</h2>
        <p className="mt-2">
          Usamos la informacion para operar el sitio, mostrar resultados,
          gestionar cuentas, sostener el prode, mejorar rendimiento y seguridad,
          medir uso, corregir errores y cumplir obligaciones legales cuando
          corresponda.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-white">Cookies, analitica y publicidad</h2>
        <p className="mt-2">
          Hay Fulbo puede usar cookies y tecnologias similares para recordar
          preferencias, medir audiencia, mejorar la experiencia y mostrar
          publicidad. Los proveedores publicitarios pueden usar cookies de
          acuerdo con sus propias politicas y controles de usuario.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-white">Servicios externos</h2>
        <p className="mt-2">
          El sitio puede integrar alojamiento, autenticacion, analitica,
          publicidad, imagenes, datos deportivos y herramientas tecnicas de
          terceros. Cada servicio puede tratar informacion segun sus propias
          condiciones y politicas.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-white">Derechos y contacto</h2>
        <p className="mt-2">
          Podés escribir a contacto@hayfulbo.com para solicitar informacion,
          correccion, actualizacion o eliminacion de datos personales cuando
          corresponda. Inclui la mayor cantidad de contexto posible para poder
          identificar la consulta.
        </p>
      </section>
    </TrustPageLayout>
  )
}
