import TrustPageLayout from '@/frontend/components/TrustPageLayout'
import { buildSeoMetadata } from '@/shared/seo'

export const metadata = buildSeoMetadata({
  title: 'Cookies | Hay Fulbo',
  description:
    'Politica de cookies de Hay Fulbo para preferencias, medicion, seguridad, analitica y publicidad.',
  path: '/cookies',
})

export default function CookiesPage() {
  return (
    <TrustPageLayout
      title="Cookies"
      summary="Como Hay Fulbo puede usar cookies y tecnologias similares."
      updatedAt="25 de junio de 2026"
    >
      <section>
        <h2 className="text-lg font-black text-white">Que son</h2>
        <p className="mt-2">
          Las cookies y tecnologias similares permiten guardar o leer
          informacion en un dispositivo. Pueden usarse para recordar
          preferencias, sostener sesiones, medir uso, proteger el servicio y
          mostrar publicidad cuando corresponda.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-white">Tipos de uso</h2>
        <p className="mt-2">
          Hay Fulbo puede utilizar cookies tecnicas para funcionamiento,
          cookies de preferencias para recordar configuraciones, herramientas de
          analitica para entender uso agregado y cookies publicitarias provistas
          por terceros si los anuncios estan habilitados.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-white">Publicidad</h2>
        <p className="mt-2">
          Los proveedores de anuncios pueden usar cookies para seleccionar,
          limitar y medir anuncios. Hay Fulbo no controla todas las cookies de
          terceros, pero evita mostrar anuncios en rutas privadas, admin,
          autenticacion, chats y paginas marcadas como noindex.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-white">Gestion</h2>
        <p className="mt-2">
          Podes configurar o bloquear cookies desde tu navegador. Algunas
          funciones, como inicio de sesion o preferencias, pueden verse afectadas
          si se deshabilitan cookies tecnicas esenciales.
        </p>
      </section>
    </TrustPageLayout>
  )
}
