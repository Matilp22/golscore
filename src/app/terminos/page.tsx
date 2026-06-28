import TrustPageLayout from '@/frontend/components/TrustPageLayout'
import { buildSeoMetadata } from '@/shared/seo'

export const metadata = buildSeoMetadata({
  title: 'Terminos y condiciones | Hay Fulbo',
  description:
    'Terminos de uso de Hay Fulbo para resultados, estadisticas, prode, contenido editorial, cuentas y publicidad.',
  path: '/terminos',
})

export default function TerminosPage() {
  return (
    <TrustPageLayout
      title="Terminos y condiciones"
      summary="Condiciones generales para acceder y usar Hay Fulbo."
      updatedAt="25 de junio de 2026"
    >
      <section>
        <h2 className="text-lg font-black text-white">Aceptacion</h2>
        <p className="mt-2">
          Al acceder o usar Hay Fulbo aceptas estos terminos. Si no estas de
          acuerdo, por favor no utilices el sitio. Podemos actualizar estas
          condiciones para reflejar cambios del servicio o requisitos legales.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-white">Servicio</h2>
        <p className="mt-2">
          Hay Fulbo ofrece informacion de futbol, resultados, fixtures,
          estadisticas, tablas, contenido editorial y funcionalidades de prode.
          El servicio puede cambiar, suspender funciones o ajustar secciones por
          razones tecnicas, editoriales o legales.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-white">Informacion deportiva</h2>
        <p className="mt-2">
          Trabajamos para mostrar informacion actualizada y precisa, pero los
          datos pueden tener demoras, correcciones u omisiones. Resultados,
          horarios y estadisticas son informativos y pueden variar segun fuentes
          oficiales o proveedores externos.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-white">Cuentas y uso permitido</h2>
        <p className="mt-2">
          Algunas funciones requieren registro. Sos responsable de mantener la
          confidencialidad de tus credenciales y de la actividad de tu cuenta.
          No esta permitido vulnerar seguridad, extraer datos de forma abusiva,
          interferir con el servicio o usar el sitio para fines fraudulentos.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-white">Propiedad y terceros</h2>
        <p className="mt-2">
          La marca, identidad visual, textos, interfaces y desarrollos propios
          pertenecen a Hay Fulbo o sus licenciantes. Nombres, logos y referencias
          de clubes, competencias, proveedores o terceros pertenecen a sus
          titulares.
        </p>
      </section>
    </TrustPageLayout>
  )
}
