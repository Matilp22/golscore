import TrustPageLayout from '@/frontend/components/TrustPageLayout'
import { buildSeoMetadata } from '@/shared/seo'

export const metadata = buildSeoMetadata({
  title: 'Quienes somos | Hay Fulbo',
  description:
    'Informacion sobre Hay Fulbo, su enfoque editorial, datos deportivos y canales de contacto.',
  path: '/quienes-somos',
})

export default function QuienesSomosPage() {
  return (
    <TrustPageLayout
      title="Quienes somos"
      summary="Hay Fulbo es un sitio independiente de resultados, fixtures, tablas, estadisticas, prode y guias de futbol."
      updatedAt="25 de junio de 2026"
    >
      <section>
        <h2 className="text-lg font-black text-white">Proyecto</h2>
        <p className="mt-2">
          Hay Fulbo nace para ordenar informacion de futbol con foco en usuarios
          de Argentina. El sitio combina resultados del dia, paginas de
          competiciones, detalle de partidos, tablas y una experiencia de prode.
          La cobertura no es oficial de clubes, ligas ni federaciones.
        </p>
        <p className="mt-2">
          El objetivo publico es que cada pagina indexable tenga una utilidad
          clara: consultar un dato deportivo, entender el formato de una
          competencia o leer una guia editorial propia. Las paginas que solo
          cumplen una funcion de navegacion se tratan de forma separada para no
          mezclarlas con contenido informativo.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-white">Enfoque</h2>
        <p className="mt-2">
          Nuestro criterio es separar datos deportivos de explicaciones
          editoriales. Los marcadores, horarios, eventos, formaciones y
          estadisticas se tratan como datos operativos. Las guias explican
          formatos, criterios de lectura y metodologia sin inventar resultados,
          fichajes, declaraciones ni informacion que no este sustentada.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-white">Responsabilidad editorial</h2>
        <p className="mt-2">
          Revisamos las paginas publicas para evitar contenido vacio, duplicado
          o basado solo en navegacion. Cuando una ruta no tiene suficiente
          informacion, puede quedar fuera del sitemap o marcada como noindex
          hasta contar con datos o contexto editorial suficiente.
        </p>
        <p className="mt-2">
          Si detectas un error en un marcador, una tabla, un fixture o una guia,
          pedimos que nos envies la URL afectada y una descripcion concreta del
          problema. Esa informacion ayuda a diferenciar errores de datos,
          demoras de actualizacion y cambios propios del reglamento de cada
          torneo.
        </p>
      </section>
    </TrustPageLayout>
  )
}
