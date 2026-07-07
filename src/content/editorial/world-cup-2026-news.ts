import type { EditorialArticle } from './types'

const WORLD_CUP_2026_EDITORIAL_IMAGE = '/brand/competitions/world-cup-2026.png'
const WORLD_CUP_TROPHY_EDITORIAL_IMAGE = '/brand/competitions/world-cup-trophy-transparent.png'
const WORLD_CUP_TROPHY_CUTOUT_IMAGE = '/brand/competitions/world-cup-trophy-cutout.png'

// Articulos 1 y 2 estan escritos antes de Argentina vs. Egipto; revisar si se actualiza el resultado.
export const WORLD_CUP_2026_NEWS_ARTICLES: EditorialArticle[] = [
  {
    slug: 'mundial-2026-la-copa-se-quedo-sin-duenos',
    title: 'Mundial 2026: la Copa se quedó sin dueños',
    summary:
      'El Mundial entró en esa zona donde no manda la lógica. Ya no quedan anfitriones, Brasil y Alemania miran desde afuera, Portugal despidió a Cristiano y Argentina se prepara para Egipto con Messi encendido y la guardia alta.',
    category: 'mundial-2026',
    tags: ['noticias', 'mundial-2026', 'argentina', 'messi', 'scaloneta', 'octavos-de-final'],
    author: 'Redacción Hay Fulbo',
    publishedAt: '2026-07-07',
    updatedAt: '2026-07-07T14:00:00-03:00',
    heroImage: WORLD_CUP_2026_EDITORIAL_IMAGE,
    sources: [],
    relatedSlugs: [
      'goleadores-historicos-del-mundial-messi-mbappe-haaland',
      'momento-bajonero-mundial-2026-historias-dolor',
      'entradas-mundial-2026-precios-como-se-calculan',
    ],
    body: [
      {
        image: {
          src: WORLD_CUP_TROPHY_EDITORIAL_IMAGE,
          alt: 'Trofeo de la Copa del Mundo 2026',
          caption:
            'La Copa entro en zona de cruces: menos margen para el error y mas memoria por escribir.',
        },
        paragraphs: [
          'El Mundial 2026 ya se sacó el saco de gala y se puso la ropa de combate. Se terminó la parte en la que algunos todavía hacían cuentas, probaban variantes o administraban piernas. Ahora cada pelota dividida vale media vida, cada error defensivo puede ser pasaje de vuelta y cada partido tiene ese olor hermoso y cruel de los mata-mata: ganás y seguís soñando; perdés y te toca armar la valija.',
          'Y este Mundial, el más grande de la historia, no está dejando caminar a nadie. El nuevo formato, con más selecciones y más partidos, abrió la puerta a historias nuevas, pero también le cargó al torneo una dosis extra de desgaste, viajes, calor, canchas distintas y cruces incómodos. Lionel Scaloni lo dijo sin vueltas antes del partido contra Egipto: no hay un favorito clarísimo. Y tiene razón. Los grandes están pasando, sí, pero ninguno está sobrando la situación.',
          'La prueba está a la vista. Alemania ya quedó afuera. Países Bajos también. Brasil, que siempre parece tener una vida más en los Mundiales, se pegó un golpazo contra Noruega y se fue eliminado por un 2-1 que metió a Erling Haaland en el centro de la escena. Portugal también se despidió, con un 1-0 ante España que tuvo gol agónico de Mikel Merino y dejó una postal fuerte: Cristiano Ronaldo, a los 41 años, saliendo de su último Mundial.',
          'Encima, la Copa se quedó sin anfitriones. Canadá fue eliminado por Marruecos, México cayó en un partidazo contra Inglaterra en el Azteca y Estados Unidos se fue después de una derrota dura contra Bélgica. Para un Mundial organizado entre tres países, es un dato pesadísimo. La fiesta sigue, los estadios van a seguir llenos, pero el calor local ya no tiene equipo propio para empujar.',
          'En el medio de todo eso aparece Argentina, que viene de ganar un partido que dejó más alivio que euforia. El 3-2 contra Cabo Verde fue una de esas noches donde el campeón del mundo tiene que acordarse de por qué es campeón. No alcanzó con la camiseta, no alcanzó con el favoritismo, no alcanzó con tener a Messi. Hubo que sufrir. Cabo Verde, debutante mundialista, se plantó como si llevara toda la vida jugando estas instancias. Empató dos veces, llevó el partido al suplementario y obligó a Argentina a sacar carácter cuando el fútbol no fluía.',
          'Messi abrió el partido con su séptimo gol en este Mundial y llegó a 20 tantos en Copas del Mundo. Una locura. Pero la noche no fue un paseo. Argentina tuvo tramos incómodos, momentos de poca claridad y hasta necesitó que el Dibu Martínez apareciera en el final para evitar otro golpe. La jugada decisiva llegó en el segundo tiempo del alargue: córner de Messi, cabezazo de Cuti Romero y pelota que terminó entrando tras el desvío en Diney Borges. Fue clasificación, sí. Pero también fue aviso.',
          'Ahora viene Egipto. Y no es una figurita decorativa. Egipto llega agrandado, con Mohamed Salah como bandera y con un logro histórico encima: por primera vez se metió en una instancia eliminatoria del Mundial. Viene de superar a Australia por penales y encontró en este torneo una alegría que le había sido esquiva durante décadas. No tiene el plantel de Argentina, pero tiene orden, energía emocional y un líder que sabe jugar partidos grandes.',
          'Por eso la Scaloneta tiene que entrar con el cuchillo entre los dientes. Nada de creer que el partido se gana con el escudo. Este Mundial ya demostró que castiga al que pestañea. Francia necesitó un penal de Mbappé para sacarse de encima a Paraguay. España tuvo que esperar hasta el minuto 91 para quebrar a Portugal. Inglaterra terminó pidiendo la hora contra México con diez jugadores. Nadie está haciendo trámites.',
          'La buena para Argentina es que tiene memoria competitiva. Este grupo sabe sufrir. Lo hizo en Qatar, lo hizo en finales, lo hizo en penales y lo volvió a hacer contra Cabo Verde. Cuando el partido se pone feo, hay una base emocional que aparece. Y en un Mundial, a veces eso vale tanto como jugar lindo.',
          'Hasta acá, la Copa viene siendo un quilombo hermoso: candidatos golpeados, tapados que se agrandan, favoritos obligados a transpirar y figuras históricas que siguen escribiendo o cerrando capítulos. El Mundial ya se quedó sin dueños. Y ahí, cuando nadie domina del todo, empieza lo que más nos gusta a los futboleros: la parte donde el corazón también juega.',
        ],
      },
    ],
  },
  {
    slug: 'goleadores-historicos-del-mundial-messi-mbappe-haaland',
    title: 'Goleadores históricos del Mundial: Messi arriba, Mbappé al acecho',
    summary:
      'La tabla de goleadores mundialistas, que durante años pareció intocable, está viviendo una revolución. Messi llegó a 20, Mbappé ya está a tiro y Haaland se metió de lleno en la pelea por la Bota de Oro.',
    category: 'mundial-2026',
    tags: ['noticias', 'mundial-2026', 'messi', 'mbappe', 'haaland', 'goleadores', 'bota-de-oro'],
    author: 'Redacción Hay Fulbo',
    publishedAt: '2026-07-07',
    updatedAt: '2026-07-07T13:55:00-03:00',
    heroImage: WORLD_CUP_TROPHY_EDITORIAL_IMAGE,
    sources: [],
    relatedSlugs: [
      'mundial-2026-la-copa-se-quedo-sin-duenos',
      '10-datos-de-mundiales-que-pocos-conocen',
      'entradas-mundial-2026-precios-como-se-calculan',
    ],
    body: [
      {
        image: {
          src: WORLD_CUP_2026_EDITORIAL_IMAGE,
          alt: 'Identidad visual del Mundial 2026',
          caption:
            'La carrera por los goles ya no mira solo al pasado: tambien se juega en tiempo real.',
        },
        paragraphs: [
          'La tabla de goleadores históricos de los Mundiales siempre tuvo algo de vitrina sagrada. Uno la miraba y aparecían nombres que parecían imposibles de mover: Miroslav Klose, Ronaldo Nazário, Gerd Müller, Just Fontaine, Pelé. Tipos que no solo hicieron goles; hicieron memoria. Pero este Mundial 2026 terminó de romper la lógica del museo. La historia ya no está quieta: se está jugando ahora mismo.',
          'Lionel Messi está arriba de todos. Con el gol a Cabo Verde, llegó a 20 tantos en Copas del Mundo y estiró una marca que ya parecía de otro planeta. Lo más fuerte no es solo el número, sino el recorrido. Messi hizo goles en seis Mundiales, atravesó eliminaciones dolorosas, finales perdidas, críticas absurdas, gloria absoluta en Qatar y ahora, a los 39 años, sigue jugando como si todavía tuviera una cuenta pendiente con la pelota.',
          'El dato impacta más cuando uno recuerda de dónde venía la tabla. Klose había dejado el récord en 16 goles después de Brasil 2014. Era una marca enorme, construida con precisión alemana: sin tanto firulete, sin tanto marketing, pero con una capacidad tremenda para aparecer donde había que aparecer. Durante años pareció un techo altísimo. Messi lo pasó. Y no solo lo pasó: siguió.',
          'Pero la historia tiene otro monstruo corriendo de atrás. Kylian Mbappé ya llegó a 19 goles mundialistas y está a uno de Messi. Uno. El francés tiene apenas 27 años y una voracidad que mete miedo. En 2018 fue campeón siendo decisivo, en 2022 hizo una final que todavía nos acelera el pulso a los argentinos, y en 2026 volvió a aparecer con goles clave. Contra Paraguay, metió de penal el gol que mandó a Francia a cuartos y lo dejó otra vez en la conversación grande.',
          'Ahí está el cambio de época. Durante mucho tiempo, la discusión era si alguien podía alcanzar a Klose. Ahora la pregunta es cuánto tiempo más puede sostener Messi la cima con Mbappé respirándole en la nuca. Es una carrera hermosa y rara: el mejor jugador de una generación contra el delantero que parece haber nacido para heredar el escenario mundialista.',
          'Atrás quedan apellidos enormes. Ronaldo Nazário, el Fenómeno, aparece con 15. Y hay que decirlo bien: Ronaldo no fue solamente un goleador; fue una amenaza física y técnica. Cuando arrancaba de frente, los defensores no marcaban, sobrevivían. Gerd Müller quedó con 14, otro animal del área, de esos que no necesitaban tocar muchas pelotas para destruir un partido. Just Fontaine sigue con 13, pero dueño de un récord que todavía parece imposible: hizo todos esos goles en un solo Mundial, Suecia 1958. Trece goles en seis partidos. Una barbaridad que resiste como si fuera una marca de atletismo de otro siglo.',
          'Pelé, con 12, sigue ocupando un lugar que no se mide solo con números. Cristiano Ronaldo cerró su historia mundialista con 11 goles y sin la Copa que siempre buscó. Es curioso y cruel: una carrera gigante, llena de récords, pero con el Mundial como ese sueño que nunca pudo agarrar del todo.',
          'Y después está la pelea por la Bota de Oro de este torneo, que viene espectacular. Messi, Mbappé y Erling Haaland están empatados con 7 goles. Harry Kane viene atrás con 6. Haaland, en su primer gran Mundial, ya llevó a Noruega a cuartos con un doblete contra Brasil. No es una aparición simpática: es una amenaza real. Noruega no solo eliminó a Brasil; puso a su delantero en la mesa de los grandes.',
          'Para Argentina, todo esto tiene un sabor especial. Porque Messi no está sumando goles en partidos de relleno. Está marcando en momentos que importan, cuando la Selección lo necesita y cuando el torneo empieza a cerrar puertas. Cada gol suyo tiene algo de presente y algo de despedida, aunque nadie quiera decir esa palabra en voz alta.',
          'La tabla histórica de goleadores no es una planilla. Es una novela. Está Klose con su oficio. Ronaldo con su potencia. Müller con su instinto. Fontaine con su récord imposible. Pelé con su eternidad. Cristiano con su búsqueda incompleta. Haaland con hambre de futuro. Mbappé con la persecución feroz. Y Messi, todavía arriba, todavía jugando, todavía obligando al mundo a actualizar la historia.',
          'El Mundial siempre se acuerda de los goles. Los sistemas pasan, las modas cambian, las camisetas se renuevan. Pero la pelota adentro del arco queda para siempre. Y hoy, en esa memoria, Messi sigue sentado en la cabecera. Aunque Mbappé ya esté golpeando la puerta.',
        ],
      },
    ],
  },
  {
    slug: '10-datos-de-mundiales-que-pocos-conocen',
    title: '10 datos de Mundiales que pocos conocen y sirven para ganar cualquier previa',
    summary:
      'Los Mundiales no son solamente campeones, finales y goleadores. También están llenos de historias raras, mitos mal contados, récords escondidos y detalles que parecen inventados, pero pasaron.',
    category: 'historias-mundialistas',
    tags: ['noticias', 'mundiales', 'historia', 'curiosidades', 'datos', 'futbol'],
    author: 'Redacción Hay Fulbo',
    publishedAt: '2026-07-07',
    updatedAt: '2026-07-07T13:50:00-03:00',
    heroImage: WORLD_CUP_2026_EDITORIAL_IMAGE,
    sources: [],
    relatedSlugs: [
      'mundial-2026-la-copa-se-quedo-sin-duenos',
      'momento-bajonero-mundial-2026-historias-dolor',
      'goleadores-historicos-del-mundial-messi-mbappe-haaland',
    ],
    body: [
      {
        image: {
          src: WORLD_CUP_TROPHY_CUTOUT_IMAGE,
          alt: 'Trofeo del Mundial 2026',
          caption:
            'Cada Mundial suma una capa nueva de mitos, rarezas y detalles que sobreviven al resultado.',
        },
        paragraphs: [
          'Los Mundiales tienen una historia oficial, la que aparece en los resúmenes: campeones, finales, goleadores, figuras y atajadas. Pero también tienen una historia paralela, mucho más sabrosa, que vive en los márgenes. Son esos datos que aparecen en una sobremesa, en una previa o en una charla de bar y hacen que todos levanten la cabeza. Acá van diez.',
        ],
      },
      {
        heading: '1. La primera final se jugó con dos pelotas',
        paragraphs: [
          'Argentina y Uruguay no se pusieron de acuerdo sobre qué pelota usar en la final de 1930. Entonces se resolvió de una manera muy de época: un tiempo con cada una. El primer tiempo se jugó con pelota argentina y la Selección se fue 2-1 arriba al descanso. El segundo se jugó con pelota uruguaya, y Uruguay lo dio vuelta para ganar 4-2. El Mundial nació con discusión, picante y Río de la Plata. Bastante lógico, si lo pensamos bien.',
        ],
      },
      {
        heading: '2. El primer gol mundialista lo hizo un francés en una cancha que ya no existe',
        paragraphs: [
          'Lucien Laurent marcó el primer gol en la historia de los Mundiales el 13 de julio de 1930, en Montevideo, en el Francia 4-1 México. El escenario fue el viejo estadio de Pocitos, de Peñarol, que fue demolido pocos años después. Hoy, en esa zona de Montevideo, hay marcas urbanas que recuerdan el lugar aproximado donde arrancó todo. El primer grito mundialista no está en un estadio moderno: está escondido en una esquina de barrio.',
        ],
      },
      {
        heading: '3. El Maracanazo no fue una final como las de ahora',
        paragraphs: [
          'Todos hablamos del Brasil-Uruguay de 1950 como “la final del Maracanazo”, y emocionalmente lo fue. Pero el formato de aquel Mundial no tenía una final única: se definía por un grupo final. Brasil llegaba con ventaja y le alcanzaba el empate; Uruguay necesitaba ganar. Ganó Uruguay 2-1 y el Maracaná quedó en silencio. Fue una final sin formato de final, pero con peso de tragedia nacional.',
        ],
      },
      {
        heading: '4. India no se bajó del Mundial 1950 solamente por jugar descalza',
        paragraphs: [
          'Durante décadas se repitió que India no fue al Mundial de Brasil 1950 porque FIFA no la dejó jugar descalza. La historia real es más compleja. India sí tenía lugar, pero su ausencia tuvo que ver con prioridades deportivas, organización, costos, preparación y el mayor peso que entonces tenían los Juegos Olímpicos para su federación. El mito de los pies descalzos quedó buenísimo para contar, pero se queda corto.',
        ],
      },
      {
        heading: '5. A la Copa Jules Rimet la encontró un perro',
        paragraphs: [
          'En 1966, antes del Mundial de Inglaterra, robaron la Copa Jules Rimet mientras estaba exhibida. Hubo escándalo, investigación policial, pedido de rescate y nervios por todos lados. Una semana después, el trofeo apareció envuelto en diarios. ¿Quién lo encontró? Pickles, un perro que paseaba con su dueño por el sur de Londres. Inglaterra terminó ganando ese Mundial, pero antes la Copa la salvó un perro. Cine puro.',
        ],
      },
      {
        heading: '6. Las tarjetas amarilla y roja no existieron siempre',
        paragraphs: [
          'Hoy parecen parte natural del fútbol, pero no siempre estuvieron. Antes, las amonestaciones y expulsiones se comunicaban verbalmente, lo que generaba confusiones enormes, sobre todo en partidos internacionales. El sistema de tarjetas empezó a usarse en Mundiales desde México 1970 para evitar malentendidos entre árbitros y jugadores de distintos idiomas. Algo que hoy parece obvio, en su momento fue una innovación enorme.',
        ],
      },
      {
        heading: '7. La expulsión más rápida fue de un uruguayo',
        paragraphs: [
          'José Batista, defensor uruguayo, fue expulsado ante Escocia en México 1986 cuando el partido apenas arrancaba. FIFA recuerda esa roja, a los 52 segundos, como la expulsión más rápida de la historia de la Copa del Mundo. Uruguay jugó casi todo el partido con diez y aun así empató 0-0. Marca histórica, sí. Pero de esas que nadie quiere tener.',
        ],
      },
      {
        heading: '8. Hungría metió diez goles en un partido',
        paragraphs: [
          'En España 1982, Hungría le ganó 10-1 a El Salvador. Es la única vez que un equipo llegó a los dos dígitos en un partido de Mundial. Y dentro de esa goleada hubo otro récord tremendo: László Kiss entró desde el banco e hizo un hat-trick en siete minutos. El tipo no empezó el partido y terminó metido en la historia para siempre.',
        ],
      },
      {
        heading: '9. El gol más rápido duró menos que acomodarse en el sillón',
        paragraphs: [
          'Hakan Şükür, de Turquía, hizo el gol más rápido de la historia mundialista en 2002, contra Corea del Sur, por el tercer puesto. Tardó apenas 11 segundos. Sacaron, apretaron arriba, error defensivo, definición y récord. Hay goles que llegan después de construir una jugada. Este llegó antes de que muchos terminaran de encontrar el control remoto.',
        ],
      },
      {
        heading: '10. Cafu jugó tres finales del mundo',
        paragraphs: [
          'Cafu es el único futbolista que disputó tres finales mundialistas: 1994, 1998 y 2002. Ganó dos, perdió una y levantó la Copa como capitán de Brasil en Corea-Japón. Para cualquier jugador, jugar una final del mundo es tocar el cielo. Cafu jugó tres. Una animalada de regularidad, físico, jerarquía y carrera larga.',
          'Eso también es el Mundial. No solo campeones y cracks. Es un archivo enorme de rarezas, injusticias, perros héroes, mitos desarmados, récords insólitos y partidos que sobreviven mucho más allá del resultado. Por eso cada Copa no empieza de cero: se suma a una historia que nunca termina.',
        ],
      },
    ],
  },
  {
    slug: 'entradas-mundial-2026-precios-como-se-calculan',
    title: 'Entradas del Mundial 2026: por qué salen una fortuna y cómo se calculan',
    summary:
      'Ir a un Mundial siempre fue caro, pero 2026 llevó la discusión a otro nivel. FIFA habla de precio variable; los hinchas ven números que cambian, reventa por las nubes y un sueño cada vez más difícil de pagar.',
    category: 'mundial-2026',
    tags: ['noticias', 'mundial-2026', 'entradas', 'fifa', 'precios', 'hinchas'],
    author: 'Redacción Hay Fulbo',
    publishedAt: '2026-07-07',
    updatedAt: '2026-07-07T13:45:00-03:00',
    heroImage: WORLD_CUP_TROPHY_CUTOUT_IMAGE,
    sources: [],
    relatedSlugs: [
      'mundial-2026-la-copa-se-quedo-sin-duenos',
      '10-datos-de-mundiales-que-pocos-conocen',
      'goleadores-historicos-del-mundial-messi-mbappe-haaland',
    ],
    body: [
      {
        image: {
          src: WORLD_CUP_2026_EDITORIAL_IMAGE,
          alt: 'Mundial 2026',
          caption:
            'La entrada es apenas una parte del viaje: sede, demanda y contexto terminan de mover la aguja.',
        },
        paragraphs: [
          'Ir a un Mundial nunca fue barato. Pero en 2026 la conversación cambió de escala. Ya no se trata solamente de decir “las entradas están caras”. Se trata de entender por qué cambian tanto, cómo se calculan, qué diferencia hay entre precio oficial y reventa, y por qué para muchos hinchas el sueño mundialista empieza a parecerse más a un lujo que a una fiesta popular.',
          'Lo primero que hay que saber es que FIFA usa un sistema de categorías. No vale lo mismo una ubicación detrás del arco que una platea central baja. Tampoco vale lo mismo un partido de fase de grupos que uno de eliminación directa. La instancia pesa, la sede pesa, la demanda pesa y las selecciones que juegan también pesan. En otras palabras: no se calcula solamente el asiento; se calcula el evento completo.',
          'FIFA define su sistema como “precio variable”. Según su explicación, los valores pueden ajustarse durante las fases de venta en función de la demanda y la disponibilidad de cada partido. La entidad aclara que no se trata de un modelo dinámico automático, porque los precios no se modificarían solos por algoritmo en tiempo real. Pero para el hincha común, la sensación puede ser bastante parecida: entrás un día, ves un precio; volvés después, y el número ya es otro.',
          'Ahí aparece la primera diferencia importante: precio oficial no es lo mismo que precio de reventa. El precio oficial es el que surge de la plataforma o de las asignaciones establecidas. La reventa, en cambio, puede dispararse según la ansiedad del mercado: poca oferta, mucha demanda, partido atractivo, selección popular, sede con mucho turismo o cruce eliminatorio caliente. Esa combinación puede transformar una entrada cara en una entrada directamente obscena.',
          'Los precios oficiales de fase de grupos llegaron a ubicarse en rangos muy superiores a los de Qatar 2022. También hubo cupos limitados de entradas económicas, como la categoría de 60 dólares para hinchas de selecciones participantes, pero se trata de una porción chica comparada con la cantidad total de tickets del torneo. Para el que no entra en ese cupo, el camino suele ser mucho más pesado.',
          'Y después está lo que no aparece en el valor de la entrada. Porque nadie viaja a un Mundial pagando solo el ticket. Hay pasajes, alojamiento, comida, traslados, seguros, impuestos, tipo de cambio y días de viaje. Para un argentino, además, todo pasa por el filtro del dólar. Una entrada de 300, 500 o 1.000 dólares no es solamente una cifra: es una decisión económica grande.',
          'El problema se vuelve más evidente en los partidos de alta demanda. Si juega Argentina, Brasil, México, Inglaterra, Estados Unidos, España o Francia, el mercado se calienta. Si encima es un cruce eliminatorio, peor. Y si hay una figura mundial en cancha, ni hablar. El hincha no paga solo por ver fútbol: paga por estar en una escena que puede quedar en la historia.',
          'Entonces, ¿cómo se calcula una entrada del Mundial? Con una mezcla de ubicación, categoría, instancia, ciudad, rival, demanda, disponibilidad y momento de compra. A eso se le suma el mercado secundario, donde los precios pueden alejarse muchísimo del valor original.',
          'El Mundial sigue siendo el sueño máximo del futbolero. Ver a tu selección en una Copa del Mundo no se compara con casi nada. Pero en 2026 quedó expuesto algo incómodo: cada vez más hinchas miran el torneo desde afuera no por falta de pasión, sino por falta de bolsillo. Y esa también es una noticia.',
        ],
      },
    ],
  },
  {
    slug: 'momento-bajonero-mundial-2026-historias-dolor',
    title: 'Momento bajonero: cuando el Mundial te pega donde más duele',
    summary:
      'No todo en la Copa es épica, goles y festejos. Hay historias que aparecen en medio del ruido y te recuerdan que detrás de cada camiseta hay una persona cargando su propia vida.',
    category: 'momento-bajonero',
    tags: ['noticias', 'mundial-2026', 'momento-bajonero', 'historias', 'gakpo', 'diogo-jota', 'congo'],
    author: 'Redacción Hay Fulbo',
    publishedAt: '2026-07-07',
    updatedAt: '2026-07-07T13:40:00-03:00',
    heroImage: WORLD_CUP_TROPHY_EDITORIAL_IMAGE,
    sources: [],
    relatedSlugs: [
      'mundial-2026-la-copa-se-quedo-sin-duenos',
      '10-datos-de-mundiales-que-pocos-conocen',
      'goleadores-historicos-del-mundial-messi-mbappe-haaland',
    ],
    body: [
      {
        image: {
          src: WORLD_CUP_TROPHY_EDITORIAL_IMAGE,
          alt: 'Trofeo del Mundial sobre fondo oscuro',
          caption:
            'No todas las postales del Mundial son festejo: algunas obligan a bajar el ruido y mirar de cerca.',
        },
        paragraphs: [
          'Esta sección no va de morbo. Va de mirar el Mundial completo. Porque entre goles, himnos, banderas, relatos desaforados y tribunas que explotan, también aparecen historias que te frenan en seco. Momentos donde el fútbol queda chiquito. Donde el resultado importa, sí, pero por un rato deja de ser lo más importante.',
          'Uno de esos golpes fue el de Sébastien Desabre, técnico de República Democrática del Congo. Su equipo acababa de quedar eliminado por Inglaterra en un partido durísimo, después de haber estado cerca de meter un batacazo enorme. La conferencia de prensa ya venía con el peso lógico de una derrota mundialista, hasta que el jefe de prensa comunicó públicamente la muerte del padre del entrenador.',
          'La escena fue incómoda y triste. Desabre pareció sorprenderse, miró hacia un costado, agradeció y mantuvo la compostura como pudo. Después se informó que la noticia ya era conocida por él antes del partido, pero eso no le quita fuerza al momento. Porque una cosa es cargar un dolor en privado y otra muy distinta es que ese dolor aparezca frente a cámaras, micrófonos y periodistas, justo después de quedar afuera de un Mundial.',
          'Ahí el fútbol muestra su cara más humana. Uno mira a un técnico y piensa en sistemas, cambios, presión alta, repliegue, pelota parada. Pero ese tipo también es hijo. También tiene una familia. También atraviesa noticias que no entran en ningún análisis táctico. Hay derrotas deportivas que duelen, pero hay dolores que directamente no pertenecen al fútbol.',
          'Otro momento fuerte fue el de Cody Gakpo. El delantero neerlandés marcó contra Marruecos y se quebró emocionalmente. Días antes, él y su pareja, Noa van der Bij, habían comunicado la pérdida de su bebé durante el embarazo. Gakpo hizo el gol, cayó al piso y empezó a llorar. Sus compañeros entendieron enseguida que no era un festejo normal. Fueron a abrazarlo, más para sostenerlo que para celebrar.',
          'La imagen pegó fuerte porque mezcló todo: el gol, el duelo, el estadio, la presión de un Mundial y un tipo tratando de mantenerse entero en medio de una tristeza enorme. Después, como si el fútbol a veces no tuviera ni un gramo de piedad, Marruecos empató sobre el final y eliminó a Países Bajos por penales. El gol de Gakpo quedó como una de las postales emocionales de la Copa, pero no alcanzó para evitar la caída.',
          'El tercer golpe vino con Portugal y el recuerdo de Diogo Jota. En el triunfo 2-1 contra Croacia, Cristiano Ronaldo y sus compañeros homenajearon al delantero fallecido junto a su hermano André Silva en un accidente de auto. Después del partido, Ronaldo apareció con la camiseta número 21 de Jota y Portugal caminó hacia sus hinchas en una escena cargada de emoción. No fue solo una dedicatoria: fue un equipo entero jugando con alguien ausente en la memoria.',
          'Ese homenaje pegó todavía más porque Portugal avanzó aquella noche, pero pocos días después terminó eliminado por España. Cristiano también cerró ahí su último Mundial. Entonces la historia quedó atravesada por varias despedidas al mismo tiempo: la de Portugal en la Copa, la de Cristiano en los Mundiales y la presencia simbólica de Jota, que sus compañeros llevaron como bandera emocional.',
          'Eso también es el Mundial. No solamente el que mete el penal decisivo, el que salva en la línea o el que levanta la Copa. También es el jugador que llora por alguien que no está, el técnico que intenta hablar mientras carga una pérdida, el equipo que convierte una victoria en homenaje. El fútbol tiene esa cosa rara: puede ser una fiesta enorme y, al mismo tiempo, recordarte que la vida sigue pasando alrededor.',
          'Por eso “Momento bajonero” tiene sentido. No para revolver heridas ni buscar lágrimas fáciles, sino para contar esas historias que aparecen entre partido y partido y te dejan mudo. Porque el Mundial se juega con botines, sí. Pero muchas veces también se juega con el corazón roto.',
        ],
      },
    ],
  },
]
