import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const TRUST_PAGE_PATHS = [
  '/quienes-somos',
  '/politica-editorial',
  '/fuentes-y-metodologia',
  '/contacto',
  '/privacidad',
  '/terminos',
  '/cookies',
]

const REQUIRED_ARTICLE_FIELDS = [
  'title',
  'slug',
  'summary',
  'author',
  'publishedAt',
  'updatedAt',
  'category',
  'sources',
  'related',
]

const REQUIRED_LOCAL_ARTICLE_FIELDS = [
  'slug',
  'title',
  'summary',
  'category',
  'tags',
  'author',
  'publishedAt',
  'updatedAt',
  'sources',
  'relatedSlugs',
  'body',
]

const REQUIRED_NEWS_SLUGS = [
  'como-funciona-el-mundial-2026',
  'como-clasifican-mejores-terceros-mundial-2026',
  'como-se-forman-llaves-mundial-2026',
  'como-funciona-el-prode-de-hay-fulbo',
  'como-calculamos-goles-asistencias-y-tarjetas',
]

const PLACEHOLDER_RE =
  /\b(lorem ipsum|placeholder|texto pendiente|pendiente de redaccion|tbd|fake|dummy)\b/i

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function addFinding(findings, message) {
  findings.push(message)
}

function normalize(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function countWords(value) {
  return value
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.trim().length > 1).length
}

function parseArticle(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)

  if (!match) {
    throw new Error(`${filePath} no tiene frontmatter JSON.`)
  }

  return {
    metadata: JSON.parse(match[1]),
    content: match[2].trim(),
  }
}

function getArticles() {
  const dir = path.join(root, 'content', 'analisis')
  if (!fs.existsSync(dir)) return []

  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const absolutePath = path.join(dir, file)
      const article = parseArticle(absolutePath)

      return {
        file,
        slugFromFile: file.replace(/\.md$/, ''),
        ...article,
      }
    })
}

function getLocalEditorialArticleCount() {
  if (!exists('src/content/editorial/articles.ts')) return 0

  return (read('src/content/editorial/articles.ts').match(/\bslug:\s*['"]/g) ?? []).length
}

function getLocalTransferMarketItemCount() {
  if (!exists('src/content/editorial/transfers.ts')) return 0

  const source = read('src/content/editorial/transfers.ts')
  if (/TRANSFER_MARKET_ITEMS:\s*TransferMarketItem\[\]\s*=\s*\[\]/.test(source)) {
    return 0
  }

  return (source.match(/\bplayerName:\s*['"]/g) ?? []).length
}

function verifyTrustPages(findings) {
  for (const pagePath of TRUST_PAGE_PATHS) {
    const file = `src/app${pagePath}/page.tsx`

    if (!exists(file)) {
      addFinding(findings, `${pagePath} no existe.`)
      continue
    }

    const source = read(file)
    if (!source.includes('buildSeoMetadata')) {
      addFinding(findings, `${file} no usa metadata SEO.`)
    }
  }

  const footer = read('src/frontend/components/SiteFooter.tsx')
  for (const pagePath of TRUST_PAGE_PATHS) {
    if (!footer.includes(pagePath)) {
      addFinding(findings, `Footer no enlaza ${pagePath}.`)
    }
  }
}

function verifyArticles(findings) {
  const articles = getArticles()
  const slugs = new Set(articles.map((article) => article.metadata.slug))
  const bodiesByContent = new Map()

  if (!articles.length) {
    addFinding(findings, 'No hay articulos en content/analisis.')
    return
  }

  for (const article of articles) {
    const { metadata, content, file, slugFromFile } = article

    for (const field of REQUIRED_ARTICLE_FIELDS) {
      if (!(field in metadata)) {
        addFinding(findings, `${file} no tiene ${field}.`)
      }
    }

    if (metadata.slug !== slugFromFile) {
      addFinding(findings, `${file} tiene slug ${metadata.slug}, pero el archivo indica ${slugFromFile}.`)
    }

    if (!metadata.author || typeof metadata.author !== 'string') {
      addFinding(findings, `${file} no tiene autor valido.`)
    }

    for (const field of ['publishedAt', 'updatedAt']) {
      if (Number.isNaN(Date.parse(metadata[field]))) {
        addFinding(findings, `${file} tiene ${field} invalido.`)
      }
    }

    if (countWords(content) < 180) {
      addFinding(findings, `${file} tiene menos de 180 palabras editoriales.`)
    }

    if (PLACEHOLDER_RE.test(content) || PLACEHOLDER_RE.test(JSON.stringify(metadata))) {
      addFinding(findings, `${file} contiene texto placeholder.`)
    }

    if (!Array.isArray(metadata.sources) || metadata.sources.length === 0) {
      addFinding(findings, `${file} no tiene fuentes.`)
    } else {
      for (const source of metadata.sources) {
        try {
          new URL(source.url)
        } catch {
          addFinding(findings, `${file} tiene fuente con URL invalida.`)
        }
        if (!source.label) addFinding(findings, `${file} tiene fuente sin label.`)
      }
    }

    if (!Array.isArray(metadata.related)) {
      addFinding(findings, `${file} tiene related invalido.`)
    } else {
      for (const relatedSlug of metadata.related) {
        if (!slugs.has(relatedSlug)) {
          addFinding(findings, `${file} relaciona slug inexistente: ${relatedSlug}.`)
        }
      }
    }

    const normalized = normalize(content)
    const current = bodiesByContent.get(normalized) ?? []
    current.push(file)
    bodiesByContent.set(normalized, current)
  }

  for (const duplicates of bodiesByContent.values()) {
    if (duplicates.length > 1) {
      addFinding(findings, `Contenido duplicado exacto en articulos: ${duplicates.join(', ')}.`)
    }
  }
}

function verifyLocalEditorialSource(findings) {
  const requiredFiles = [
    'src/content/editorial/types.ts',
    'src/content/editorial/articles.ts',
    'src/content/editorial/transfers.ts',
    'src/content/editorial/index.ts',
  ]

  for (const file of requiredFiles) {
    if (!exists(file)) addFinding(findings, `${file} no existe.`)
  }

  if (!requiredFiles.every(exists)) return

  const types = read('src/content/editorial/types.ts')
  for (const required of [
    'EditorialArticle',
    'TransferMarketItem',
    'confirmado',
    'rumor',
    'negociacion',
    'caido',
    'alta',
    'baja',
    'prestamo',
    'renovacion',
    'jugador-libre',
  ]) {
    if (!types.includes(required)) {
      addFinding(findings, `types.ts no define ${required}.`)
    }
  }

  for (const field of REQUIRED_LOCAL_ARTICLE_FIELDS) {
    if (!types.includes(field)) {
      addFinding(findings, `EditorialArticle no contempla ${field}.`)
    }
  }

  for (const field of [
    'playerName',
    'playerPhoto',
    'fromTeam',
    'toTeam',
    'league',
    'country',
    'status',
    'type',
    'sourceName',
    'sourceUrl',
    'publishedAt',
    'updatedAt',
    'summary',
    'body',
  ]) {
    if (!types.includes(field)) {
      addFinding(findings, `TransferMarketItem no contempla ${field}.`)
    }
  }

  const articlesSource = read('src/content/editorial/articles.ts')
  for (const slug of REQUIRED_NEWS_SLUGS) {
    if (!articlesSource.includes(slug)) {
      addFinding(findings, `Falta articulo inicial ${slug}.`)
    }
  }

  if (!articlesSource.includes('como-seguimos-el-mercado-de-pases-en-hay-fulbo')) {
    addFinding(findings, 'Falta guia editorial de mercado de pases.')
  }

  if (PLACEHOLDER_RE.test(articlesSource)) {
    addFinding(findings, 'La fuente editorial local contiene texto placeholder.')
  }

  if (countWords(articlesSource) < 1200) {
    addFinding(findings, 'La fuente editorial local tiene poco contenido original.')
  }

  const transfersSource = read('src/content/editorial/transfers.ts')
  if (!/TRANSFER_MARKET_ITEMS:\s*TransferMarketItem\[\]\s*=\s*\[\]/.test(transfersSource)) {
    addFinding(findings, 'Mercado de pases no debe incluir operaciones inventadas.')
  }
}

function verifySitemap(findings) {
  const source = read('src/app/sitemap.ts')

  if (source.includes('SIDEBAR_SECTION_CONFIGS') || source.includes('/seccion/')) {
    addFinding(findings, 'El sitemap incluye secciones de navegacion.')
  }

  for (const legacyPath of ['/privacy-policy', '/terms', '/contact']) {
    const exactRoutePattern = new RegExp(`['"]${legacyPath.replace('/', '\\/')}['"]`)
    if (exactRoutePattern.test(source)) {
      addFinding(findings, `El sitemap conserva ruta legacy ${legacyPath}.`)
    }
  }

  for (const required of [
    'getAnalysisArticles',
    'getNewsArticles',
    'getTransferMarketEditorialArticles',
    'getTransferMarketItems',
    'TRUST_PAGE_PATHS',
    'getPublicPageIndexability',
    '/noticias',
    '/mercado-de-pases',
    'newsArticleUrls',
    'transferArticleUrls',
  ]) {
    if (!source.includes(required)) {
      addFinding(findings, `El sitemap no usa ${required}.`)
    }
  }
}

function verifyEditorialSections(findings) {
  const newsPage = 'src/app/noticias/page.tsx'
  const newsDetailPage = 'src/app/noticias/[slug]/page.tsx'
  const transfersPage = 'src/app/mercado-de-pases/page.tsx'
  const transfersDetailPage = 'src/app/mercado-de-pases/[slug]/page.tsx'
  const navConfig = 'src/frontend/navigation/sidebar-navigation.tsx'
  const appShell = read('src/frontend/components/AppShell.tsx')

  if (!exists(newsPage)) {
    addFinding(findings, '/noticias no existe.')
  } else {
    const source = read(newsPage)
    for (const required of ['getNewsArticles', 'Noticias', 'generateMetadata', 'EditorialArticleCard']) {
      if (!source.includes(required)) addFinding(findings, `${newsPage} no usa ${required}.`)
    }
  }

  if (!exists(newsDetailPage)) {
    addFinding(findings, '/noticias/[slug] no existe.')
  } else {
    const source = read(newsDetailPage)
    for (const required of ['getNewsArticleBySlug', 'notFound', 'EditorialArticleStructuredData']) {
      if (!source.includes(required)) addFinding(findings, `${newsDetailPage} no usa ${required}.`)
    }
  }

  if (!exists(transfersPage)) {
    addFinding(findings, '/mercado-de-pases no existe.')
  } else {
    const source = read(transfersPage)
    for (const required of [
      'getTransferMarketItems',
      'getTransferMarketEditorialArticles',
      'Mercado de pases',
      'noIndex: !indexability.index',
      'Próximamente vas a encontrar acá',
    ]) {
      if (!source.includes(required)) addFinding(findings, `${transfersPage} no usa ${required}.`)
    }
  }

  if (!exists(transfersDetailPage)) {
    addFinding(findings, '/mercado-de-pases/[slug] no existe.')
  } else {
    const source = read(transfersDetailPage)
    for (const required of [
      'getTransferMarketItemBySlug',
      'getTransferMarketEditorialArticleBySlug',
      'Esta información está marcada como rumor',
    ]) {
      if (!source.includes(required)) addFinding(findings, `${transfersDetailPage} no usa ${required}.`)
    }
  }

  if (!exists(navConfig)) {
    addFinding(findings, 'No existe configuracion central de sidebar.')
  } else {
    const source = read(navConfig)
    for (const required of ['SidebarNavigationItem', '/noticias', '/mercado-de-pases', 'HEADER_ACTIONS']) {
      if (!source.includes(required)) addFinding(findings, `${navConfig} no cubre ${required}.`)
    }
  }

  if (appShell.includes('href="/prode"') || appShell.includes('href="/liga/selecciones-mundial#simulador-mundial"')) {
    addFinding(findings, 'AppShell conserva links manuales de Prode/Simulador fuera de HEADER_ACTIONS.')
  }
}

function verifyNoIndex(findings) {
  const seo = read('src/shared/seo.ts')
  if (!/index:\s*false/.test(seo) || !/follow:\s*true/.test(seo)) {
    addFinding(findings, 'buildSeoMetadata no aplica noindex,follow.')
  }

  const contentQuality = read('src/shared/content-quality.ts')
  for (const required of [
    'getPublicPageIndexability',
    'shouldAllowAdsOnRoute',
    '/admin',
    '/login',
    '/register',
    '/perfil',
    '/restablecer-contrasena',
    'chat',
  ]) {
    if (!contentQuality.includes(required)) {
      addFinding(findings, `content-quality no cubre ${required}.`)
    }
  }

  const sitemap = read('src/app/sitemap.ts')
  if (sitemap.includes('/seccion/')) {
    addFinding(findings, 'El sitemap no debe incluir paginas de navegacion /seccion.')
  }
}

function verifyArticleSchema(findings) {
  const analysisSource = read('src/app/analisis/[slug]/page.tsx')
  const editorialSchemaSource = read('src/frontend/components/EditorialArticleStructuredData.tsx')
  for (const required of [
    "'@type': 'Article'",
    'datePublished',
    'dateModified',
    'author',
    'publisher',
    'mainEntityOfPage',
    'application/ld+json',
  ]) {
    if (!analysisSource.includes(required) && !editorialSchemaSource.includes(required)) {
      addFinding(findings, `Schema Article incompleto: falta ${required}.`)
    }
  }
}

const findings = []

verifyTrustPages(findings)
verifyArticles(findings)
verifyLocalEditorialSource(findings)
verifySitemap(findings)
verifyEditorialSections(findings)
verifyNoIndex(findings)
verifyArticleSchema(findings)

if (findings.length) {
  console.error('Content quality verification failed.')
  for (const finding of findings) {
    console.error(`- ${finding}`)
  }
  process.exit(1)
}

console.log('Content quality verification passed.')
console.log(`Trust pages: ${TRUST_PAGE_PATHS.length}`)
console.log(`Analysis markdown articles: ${getArticles().length}`)
console.log(`Local editorial articles: ${getLocalEditorialArticleCount()}`)
console.log(`Transfer market items: ${getLocalTransferMarketItemCount()}`)
