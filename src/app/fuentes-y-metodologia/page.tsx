import Link from 'next/link'

import TrustPageLayout from '@/frontend/components/TrustPageLayout'
import { buildSeoMetadata } from '@/shared/seo'

export const metadata = buildSeoMetadata({
  title: 'Fuentes y metodologia | Hay Fulbo',
  description:
    'Fuentes deportivas, actualizacion de datos, tratamiento de errores, goles, penales, estadisticas y contenido editorial en Hay Fulbo.',
  path: '/fuentes-y-metodologia',
})

export default function FuentesYMetodologiaPage() {
  return (
    <TrustPageLayout
      title="Fuentes y metodologia"
      summary="Como obtenemos, mostramos, corregimos y contextualizamos datos deportivos y contenido editorial."
      updatedAt="25 de junio de 2026"
    >
      <section>
        <h2 className="text-lg font-black text-white">Fuentes deportivas</h2>
        <p className="mt-2">
          Hay Fulbo integra datos deportivos de proveedores especializados y de
          la cache operativa del sitio. Esa informacion puede incluir fixtures,
          resultados, eventos de partido, tablas, planteles, estadisticas y
          datos de competiciones. Cuando una competencia publica informacion
          oficial, se toma como referencia para revisar diferencias relevantes.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-white">Actualizacion de datos</h2>
        <p className="mt-2">
          Los partidos pueden actualizarse en vivo, por sincronizaciones
          programadas o por lecturas cacheadas. La frecuencia depende del estado
          del partido y de la disponibilidad tecnica. En vivo se priorizan
          resultados, minuto, eventos importantes y cambios que afecten la
          lectura principal de la pagina.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-white">Tratamiento de errores</h2>
        <p className="mt-2">
          Si detectamos un error, revisamos si proviene del proveedor, de la
          cache, de una transformacion interna o de la interfaz. La correccion
          se aplica sobre el dato afectado y se evita modificar otras secciones
          sin evidencia. Si el problema requiere una sincronizacion nueva, se
          documenta el paso tecnico antes de tocar produccion.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-white">Goles y penales</h2>
        <p className="mt-2">
          El marcador del partido y una tanda de penales pueden representar
          cosas distintas. Cuando el dato esta disponible, Hay Fulbo muestra los
          goles del tiempo de juego separados de los penales de definicion. Los
          penales de tanda no se tratan como goles comunes para tablas de
          goleadores.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-white">Estadisticas</h2>
        <p className="mt-2">
          Las estadisticas se muestran como informacion complementaria del
          partido o la competencia. Pueden incluir remates, posesion, tarjetas,
          pases, atajadas y otros indicadores segun disponibilidad. Si una
          estadistica no llega desde la fuente, la pagina debe mostrar el estado
          real del dato en vez de completar valores inventados.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-white">Contenido editorial</h2>
        <p className="mt-2">
          Las guias y analisis se guardan versionados en el repositorio. Cada
          articulo debe tener titulo, slug, resumen, autor, fechas, categoria,
          fuentes y relacionados. El objetivo es explicar formatos y criterios
          de lectura, no producir contenido masivo ni duplicado.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-white">Contacto para correcciones</h2>
        <p className="mt-2">
          Para reportar un error, escribinos desde la pagina de{' '}
          <Link href="/contacto" className="font-bold text-[#70ff9d] transition hover:text-white">
            contacto
          </Link>
          . Conviene incluir URL, fecha, competencia, equipos y una descripcion
          concreta del dato que deberia revisarse.
        </p>
      </section>
    </TrustPageLayout>
  )
}
