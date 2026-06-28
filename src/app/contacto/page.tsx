import Link from 'next/link'

import TrustPageLayout from '@/frontend/components/TrustPageLayout'
import { buildSeoMetadata } from '@/shared/seo'

export const metadata = buildSeoMetadata({
  title: 'Contacto | Hay Fulbo',
  description:
    'Canales de contacto de Hay Fulbo para consultas, correcciones de datos, privacidad, publicidad y contenido editorial.',
  path: '/contacto',
})

export default function ContactoPage() {
  return (
    <TrustPageLayout
      title="Contacto"
      summary="Canales para consultas, correcciones, privacidad, publicidad y reportes sobre el sitio."
      updatedAt="25 de junio de 2026"
    >
      <section>
        <h2 className="text-lg font-black text-white">Email</h2>
        <p className="mt-2">
          Escribinos a{' '}
          <a
            href="mailto:contacto@hayfulbo.com"
            className="font-bold text-[#70ff9d] transition hover:text-white"
          >
            contacto@hayfulbo.com
          </a>
          . Para reportes de datos, inclui URL, competencia, partido, fecha y el
          detalle que necesita revision.
        </p>
        <p className="mt-2">
          En las correcciones deportivas priorizamos mensajes que permiten
          identificar el dato exacto: marcador, autor de gol, penal, tarjeta,
          horario, sede, tabla, fase del torneo o estadistica. Si el reporte
          depende de una fuente externa, revisamos la diferencia antes de
          modificar contenido visible.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-white">Temas habituales</h2>
        <p className="mt-2">
          Podemos recibir consultas sobre funcionamiento del sitio, correcciones
          deportivas, privacidad, publicidad, derechos de autor, experiencia de
          usuario, contenido editorial y problemas tecnicos.
        </p>
        <p className="mt-2">
          No usamos este canal para cambiar resultados por pedidos informales ni
          para publicar contenido sin verificacion. Las consultas editoriales se
          evaluan segun relevancia para el sitio, disponibilidad de fuentes y
          utilidad para lectores que buscan entender competiciones, reglas o
          criterios de lectura.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-white">Sitio</h2>
        <p className="mt-2">
          Dominio principal:{' '}
          <Link href="/" className="font-bold text-[#70ff9d] transition hover:text-white">
            https://hayfulbo.com
          </Link>
          . Hay Fulbo es independiente y no representa oficialmente a clubes,
          ligas, federaciones ni proveedores externos.
        </p>
        <p className="mt-2">
          Para cuestiones legales o de privacidad, indica el motivo del contacto
          y la pagina relacionada. Para publicidad, aclara el tipo de consulta
          sin enviar credenciales, codigos privados ni informacion sensible.
        </p>
      </section>
    </TrustPageLayout>
  )
}
