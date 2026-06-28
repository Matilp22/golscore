import type { EditorialArticle } from './types'

export const EDITORIAL_ARTICLES: EditorialArticle[] = [
  {
    slug: 'como-funciona-el-mundial-2026',
    title: 'Como funciona el Mundial 2026',
    summary:
      'Guia para entender el formato del Mundial 2026, la fase de grupos, la clasificacion a octavos y como leer la cobertura en Hay Fulbo.',
    category: 'mundial-2026',
    tags: ['noticias', 'guia', 'mundial-2026'],
    author: 'Redaccion Hay Fulbo',
    publishedAt: '2026-06-25',
    updatedAt: '2026-06-25',
    sources: [
      {
        label: 'FIFA - Copa Mundial 2026',
        url: 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026',
      },
    ],
    relatedSlugs: [
      'como-clasifican-mejores-terceros-mundial-2026',
      'como-se-forman-llaves-mundial-2026',
    ],
    body: [
      {
        heading: 'Un torneo mas grande',
        paragraphs: [
          'El Mundial 2026 se juega con 48 selecciones, por eso la primera lectura del torneo cambia respecto de ediciones anteriores. La fase inicial ya no se resume solo en mirar quien gana cada grupo: tambien importa seguir a los segundos y comparar a los terceros mejor ubicados.',
          'En Hay Fulbo la cobertura separa fixture, tablas y llaves para que cada dato tenga contexto. Una tabla muestra la posicion actual; una llave muestra el camino cuando un cruce esta definido o cuando el formato permite presentarlo con claridad.',
        ],
      },
      {
        heading: 'Como clasifica cada seleccion',
        paragraphs: [
          'La fase de grupos se organiza en doce zonas de cuatro equipos. Avanzan los dos primeros de cada grupo y los ocho mejores terceros. Ese punto es importante porque una seleccion que termina tercera todavia puede seguir en carrera, pero depende de su rendimiento comparado con otros grupos.',
          'Para leer la situacion conviene revisar primero los puntos, despues la diferencia de gol y luego los goles a favor. Si un desempate necesita criterios adicionales, Hay Fulbo evita presentar una conclusion editorial como si fuera un resultado oficial ya cerrado.',
        ],
      },
      {
        heading: 'Como usar Hay Fulbo durante el torneo',
        paragraphs: [
          'La pagina del Mundial esta pensada para consultar el estado real del torneo sin mezclar datos confirmados con supuestos. Si falta informacion o un proveedor demora una actualizacion, es preferible mostrar el estado disponible antes que completar espacios con proyecciones.',
          'Esta guia acompana la lectura del sitio. No reemplaza el reglamento oficial ni los comunicados de FIFA; sirve para entender que significa cada tabla, por que algunos terceros pueden clasificar y cuando una llave queda realmente determinada.',
        ],
      },
    ],
  },
  {
    slug: 'como-clasifican-mejores-terceros-mundial-2026',
    title: 'Como clasifican los mejores terceros del Mundial 2026',
    summary:
      'Explicacion simple sobre la tabla de terceros del Mundial 2026 y los cuidados necesarios para no confundir posiciones parciales con clasificaciones definitivas.',
    category: 'mundial-2026',
    tags: ['noticias', 'guia', 'mundial-2026', 'tablas'],
    author: 'Redaccion Hay Fulbo',
    publishedAt: '2026-06-25',
    updatedAt: '2026-06-25',
    sources: [
      {
        label: 'FIFA - Copa Mundial 2026',
        url: 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026',
      },
    ],
    relatedSlugs: [
      'como-funciona-el-mundial-2026',
      'como-se-forman-llaves-mundial-2026',
    ],
    body: [
      {
        heading: 'Por que existe una tabla de terceros',
        paragraphs: [
          'Con doce grupos y 32 cupos para octavos de final, el Mundial 2026 necesita comparar a los terceros de distintas zonas. No alcanza con mirar una sola tabla de grupo, porque el tercer puesto de una zona compite contra terceros que jugaron en otros grupos.',
          'La tabla de terceros ordena ese universo de selecciones para identificar cuales entran en los ocho lugares disponibles. Durante la fase de grupos esa lectura puede cambiar partido a partido, sobre todo cuando todavia quedan equipos con distinta cantidad de encuentros jugados.',
        ],
      },
      {
        heading: 'Que mirar antes de sacar conclusiones',
        paragraphs: [
          'El primer dato es la cantidad de puntos. Despues aparecen la diferencia de gol, los goles a favor y otros criterios de desempate definidos por el reglamento. Cuando dos selecciones estan muy cerca, una posicion parcial puede modificarse con un solo gol en otro partido.',
          'Por eso Hay Fulbo trata la tabla de terceros como una herramienta de seguimiento y no como una sentencia anticipada. Si una clasificacion no esta matematicamente cerrada, el sitio debe evitar titulares o etiquetas que presenten como definitivo lo que todavia depende de resultados pendientes.',
        ],
      },
      {
        heading: 'Lectura recomendada',
        paragraphs: [
          'La forma mas clara de seguir a una seleccion es mirar su grupo, revisar si puede terminar entre los dos primeros y, si queda tercera, comparar su puntaje contra la tabla general de terceros. Ese recorrido ayuda a distinguir dependencia propia, dependencia ajena y escenarios ya cerrados.',
          'Cuando una posicion cambia, no necesariamente hay un error: puede ser consecuencia de un partido terminado en otro grupo o de una correccion de datos. La metodologia editorial prioriza explicar el movimiento de la tabla antes que llenar la pagina con pronosticos automaticos.',
        ],
      },
    ],
  },
  {
    slug: 'como-se-forman-llaves-mundial-2026',
    title: 'Como se forman las llaves del Mundial 2026',
    summary:
      'Guia para entender cuando se puede mostrar una llave del Mundial 2026, que depende de los grupos y como evitar confundir cruces posibles con cruces confirmados.',
    category: 'mundial-2026',
    tags: ['noticias', 'guia', 'mundial-2026', 'llaves'],
    author: 'Redaccion Hay Fulbo',
    publishedAt: '2026-06-25',
    updatedAt: '2026-06-25',
    sources: [
      {
        label: 'FIFA - Copa Mundial 2026',
        url: 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026',
      },
    ],
    relatedSlugs: [
      'como-funciona-el-mundial-2026',
      'como-clasifican-mejores-terceros-mundial-2026',
    ],
    body: [
      {
        heading: 'La llave depende de la fase de grupos',
        paragraphs: [
          'Una llave mundialista parece simple cuando ya estan todos los clasificados, pero durante la fase de grupos es una pieza cambiante. Los cruces de octavos dependen de posiciones finales, mejores terceros y reglas de asignacion del cuadro.',
          'En Hay Fulbo la llave debe leerse como informacion del torneo, no como prediccion. Si un cruce esta confirmado, se muestra como tal. Si todavia depende de resultados pendientes, el sitio tiene que conservar esa diferencia visual y editorial.',
        ],
      },
      {
        heading: 'Confirmado no es lo mismo que posible',
        paragraphs: [
          'Un cruce confirmado necesita equipos clasificados y ubicaciones cerradas. Un cruce posible, en cambio, puede aparecer en simulaciones o escenarios, pero no debe mezclarse con la cobertura de resultados oficiales. Esa separacion reduce errores y evita que el lector crea que una seleccion ya tiene rival cuando todavia no lo tiene.',
          'La misma regla aplica para el camino posterior. Cuartos, semifinales y final se completan a medida que avanza el torneo. Antes de eso, el cuadro ayuda a entender el formato, pero no reemplaza los resultados.',
        ],
      },
      {
        heading: 'Criterio editorial de Hay Fulbo',
        paragraphs: [
          'La prioridad es mostrar una llave clara, estable y trazable. Cuando los datos provienen del fixture o de resultados actualizados, el sitio puede representarlos. Cuando falta informacion, conviene dejar el espacio sin completar o indicar que depende de definiciones pendientes.',
          'Esta politica evita contenido ficticio y tambien ayuda a que la pagina tenga valor real: explica el proceso, muestra lo que esta confirmado y separa el analisis de la carga automatica de datos deportivos.',
        ],
      },
    ],
  },
  {
    slug: 'como-funciona-el-prode-de-hay-fulbo',
    title: 'Como funciona el Prode de Hay Fulbo',
    summary:
      'Explicacion editorial del Prode de Hay Fulbo: que se pronostica, como leer la experiencia y por que el juego se separa de los datos deportivos oficiales.',
    category: 'prode',
    tags: ['noticias', 'guia', 'prode'],
    author: 'Redaccion Hay Fulbo',
    publishedAt: '2026-06-25',
    updatedAt: '2026-06-25',
    sources: [
      {
        label: 'Hay Fulbo - Prode',
        url: 'https://hayfulbo.com/prode',
      },
    ],
    relatedSlugs: [
      'como-calculamos-goles-asistencias-y-tarjetas',
      'como-funciona-el-mundial-2026',
    ],
    body: [
      {
        heading: 'Una capa de juego sobre el fixture',
        paragraphs: [
          'El Prode de Hay Fulbo es una experiencia de pronosticos: el usuario elige resultados o marcadores sobre partidos disponibles y despues compara su desempeno con el resultado real. La parte editorial de esta guia explica la experiencia general, sin modificar reglas de scoring ni funcionamiento interno.',
          'La base del juego es separar opinion y dato. El pronostico pertenece al usuario; el resultado del partido pertenece a la cobertura deportiva. Esa distincion es clave para que el juego sea transparente y para que una prediccion nunca se confunda con informacion oficial.',
        ],
      },
      {
        heading: 'Que conviene mirar antes de jugar',
        paragraphs: [
          'Antes de cargar un pronostico, conviene revisar fecha, equipos, sede si esta disponible y estado del partido. Si el fixture cambia, la experiencia debe acompanar el estado real del encuentro y no forzar una lectura vieja.',
          'Tambien es importante entender que el Prode no promete certeza. Funciona como juego social y de lectura futbolera: premia aciertos segun las reglas definidas por la plataforma, pero no reemplaza analisis profesional ni datos oficiales de competencia.',
        ],
      },
      {
        heading: 'Relacion con Noticias',
        paragraphs: [
          'Las notas editoriales pueden ayudar a entender formatos de torneos, tablas o llaves, pero no deben condicionar automaticamente un pronostico. Hay Fulbo mantiene separados los articulos, el fixture y el scoring para reducir sesgos y errores operativos.',
          'Si una regla del Prode cambia, debe documentarse de forma clara dentro de la experiencia correspondiente. Esta nota es una guia de uso y contexto, no una implementacion tecnica del sistema de puntaje.',
        ],
      },
    ],
  },
  {
    slug: 'como-calculamos-goles-asistencias-y-tarjetas',
    title: 'Como calculamos goles, asistencias y tarjetas',
    summary:
      'Metodo editorial para leer eventos de partido en Hay Fulbo, distinguir datos oficiales de correcciones y explicar goles, asistencias y tarjetas.',
    category: 'estadisticas',
    tags: ['noticias', 'guia', 'estadisticas', 'metodologia'],
    author: 'Redaccion Hay Fulbo',
    publishedAt: '2026-06-25',
    updatedAt: '2026-06-25',
    sources: [
      {
        label: 'Hay Fulbo - Fuentes y metodologia',
        url: 'https://hayfulbo.com/fuentes-y-metodologia',
      },
    ],
    relatedSlugs: [
      'como-funciona-el-prode-de-hay-fulbo',
      'como-funciona-el-mundial-2026',
    ],
    body: [
      {
        heading: 'Eventos con contexto',
        paragraphs: [
          'Los eventos de un partido parecen datos simples, pero pueden cambiar por correcciones del proveedor, revision oficial o ajustes posteriores. Un gol, una asistencia o una tarjeta tienen que mostrarse con el mejor dato disponible y con cuidado cuando el evento todavia no esta confirmado.',
          'Hay Fulbo usa la informacion deportiva disponible para ordenar el relato del partido. La pagina no debe inventar asistencias, autores ni tarjetas cuando el dato no existe. Si falta un evento, se muestra el estado disponible en lugar de completar el espacio con texto generico.',
        ],
      },
      {
        heading: 'Goles, penales y asistencias',
        paragraphs: [
          'Un gol se atribuye al jugador informado por la fuente deportiva. En penales, goles en contra o definiciones especiales, el tratamiento depende de como llega el evento en los datos. La prioridad es conservar consistencia con la fuente y corregir cuando aparece una rectificacion confiable.',
          'Las asistencias requieren especial cuidado porque no todas las competencias o proveedores las informan con el mismo detalle. Si el dato no esta disponible, Hay Fulbo debe evitar convertir una inferencia editorial en estadistica publicada.',
        ],
      },
      {
        heading: 'Tarjetas y correcciones',
        paragraphs: [
          'Las tarjetas amarillas y rojas pueden modificarse por errores de carga o por reportes oficiales posteriores. Cuando se detecta una diferencia, se revisa la fuente disponible y se corrige el evento si corresponde.',
          'Este criterio no cambia los resultados ni las estadisticas oficiales por opinion propia. La finalidad editorial es explicar como se leen los datos y que hacer cuando un usuario detecta una posible diferencia: reportarla por los canales de contacto para revisarla.',
        ],
      },
    ],
  },
  {
    slug: 'como-seguimos-el-mercado-de-pases-en-hay-fulbo',
    title: 'Como seguimos el mercado de pases en Hay Fulbo',
    summary:
      'Guia editorial sobre el tratamiento de rumores, negociaciones y operaciones confirmadas en la seccion Mercado de pases.',
    category: 'guias',
    tags: ['mercado-de-pases', 'guia', 'metodologia'],
    author: 'Redaccion Hay Fulbo',
    publishedAt: '2026-06-25',
    updatedAt: '2026-06-25',
    sources: [
      {
        label: 'Hay Fulbo - Fuentes y metodologia',
        url: 'https://hayfulbo.com/fuentes-y-metodologia',
      },
    ],
    relatedSlugs: [
      'como-calculamos-goles-asistencias-y-tarjetas',
      'como-funciona-el-prode-de-hay-fulbo',
    ],
    body: [
      {
        heading: 'No todo movimiento tiene el mismo estado',
        paragraphs: [
          'El mercado de pases mezcla confirmaciones, negociaciones abiertas, rumores y operaciones caidas. Hay Fulbo no debe presentar todos esos casos como si fueran iguales. Cada publicacion necesita estado visible, fuente identificable y una explicacion proporcional a la certeza disponible.',
          'Una operacion confirmada exige una fuente fuerte, como comunicacion del club, liga, jugador o registro confiable. Un rumor puede publicarse solo si esta marcado como rumor y si la fuente permite entender de donde sale la informacion.',
        ],
      },
      {
        heading: 'Que se publica y que se evita',
        paragraphs: [
          'La seccion no inventa transferencias para llenar espacio. Si no hay informacion verificable, se mantiene un estado vacio o una guia metodologica como esta. Esa decision es mejor para el lector y para la calidad editorial del sitio.',
          'Cuando se carguen movimientos, la card debe mostrar jugador, club de origen, club de destino, tipo de movimiento, estado, fecha y fuente. Si alguno de esos puntos no esta claro, el contenido tiene que conservar la advertencia correspondiente.',
        ],
      },
      {
        heading: 'Correcciones',
        paragraphs: [
          'El mercado cambia rapido. Una negociacion puede avanzar, frenarse o quedar descartada en pocas horas. Por eso cada pieza debe tener fecha de publicacion y de actualizacion, y las correcciones tienen que mejorar la precision sin borrar el historial editorial necesario para entender el cambio.',
          'Esta guia deja preparada la seccion para crecer con contenido real. Hasta que haya operaciones verificadas, Hay Fulbo prioriza metodologia y transparencia por encima de volumen artificial.',
        ],
      },
    ],
  },
]
