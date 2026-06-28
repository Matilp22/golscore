import TrustPageLayout from '@/frontend/components/TrustPageLayout'
import { buildSeoMetadata } from '@/shared/seo'

export const metadata = buildSeoMetadata({
  title: 'Politica editorial | Hay Fulbo',
  description:
    'Criterios editoriales de Hay Fulbo para guias, analisis, correcciones y separacion entre datos deportivos y opinion.',
  path: '/politica-editorial',
})

export default function PoliticaEditorialPage() {
  return (
    <TrustPageLayout
      title="Politica editorial"
      summary="Criterios que usamos para publicar guias, analisis y explicaciones dentro de Hay Fulbo."
      updatedAt="25 de junio de 2026"
    >
      <section>
        <h2 className="text-lg font-black text-white">Principios</h2>
        <p className="mt-2">
          Publicamos contenido original, util y verificable para explicar
          competiciones, formatos, tablas, fixtures y estadisticas. No copiamos
          textos de otros sitios, no generamos articulos masivos automaticos y
          no publicamos informacion ficticia para completar paginas.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-white">Diferencia entre dato y guia</h2>
        <p className="mt-2">
          El dato deportivo muestra hechos o estados de una competencia:
          horarios, resultados, goles, tarjetas, formaciones y posiciones. La
          guia editorial explica como leer esos datos. Si una tabla depende de
          criterios adicionales, lo indicamos como contexto y evitamos presentar
          una conclusion no confirmada como si fuera oficial.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-white">Actualizaciones</h2>
        <p className="mt-2">
          Los articulos tienen fecha de publicacion y actualizacion. Cuando una
          competencia cambia su formato, se revisa el texto antes de mantenerlo
          indexable. Si una pagina queda obsoleta, puede actualizarse, retirarse
          del sitemap o marcarse como noindex.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-white">Correcciones</h2>
        <p className="mt-2">
          Recibimos reportes por email. Para corregir mas rapido, pedimos
          indicar URL, partido o competencia, dato observado y fuente de
          referencia. Las correcciones de datos deportivos se tratan separadas
          de las mejoras editoriales.
        </p>
      </section>
    </TrustPageLayout>
  )
}
