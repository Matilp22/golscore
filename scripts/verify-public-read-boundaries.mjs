import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const PUBLIC_ENTRYPOINTS = [
  'src/app/page.tsx',
  'src/app/liga/[id]/page.tsx',
  'src/app/partido/[id]/page.tsx',
  'src/app/prode/page.tsx',
  'src/app/api/prode/matches/route.ts',
  'src/app/api/prode/world-cup-groups/route.ts',
]

const CLIENT_ROOTS = [
  'src/frontend',
  'src/app',
]

const PROVIDER_RUNTIME_PATTERNS = [
  /requestFootballApi\b/,
  /football-api-client/,
  /x-apisports-key/i,
  /v3\.football\.api-sports\.io/i,
]

const API_KEY_PATTERNS = [
  /FOOTBALL_API_KEY/,
  /NEXT_PUBLIC_FOOTBALL_API_KEY/,
  /x-apisports-key/i,
]

function readFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function walkFiles(dir) {
  const absolute = path.join(root, dir)
  if (!fs.existsSync(absolute)) return []

  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(absolute, entry.name)
    const relative = path.relative(root, fullPath).replaceAll(path.sep, '/')

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') return []
      return walkFiles(relative)
    }

    return /\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) ? [relative] : []
  })
}

function isTypeOnlyImportLine(line) {
  return /^\s*import\s+type\b/.test(line)
}

function firstMeaningfulLine(source) {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('//'))
}

function isClientComponent(source) {
  const first = firstMeaningfulLine(source)

  return first === "'use client'" || first === '"use client"'
}

function lineNumberFor(source, index) {
  return source.slice(0, index).split(/\r?\n/).length
}

function addFinding(findings, file, message, line = 1) {
  findings.push({ file, line, message })
}

function checkPublicEntrypoints(findings) {
  for (const file of PUBLIC_ENTRYPOINTS) {
    const absolute = path.join(root, file)
    if (!fs.existsSync(absolute)) continue

    const source = readFile(file)
    const lines = source.split(/\r?\n/)

    lines.forEach((line, index) => {
      if (isTypeOnlyImportLine(line)) return
      if (/requestFootballApi\b/.test(line) || /football-api-client/.test(line)) {
        addFinding(
          findings,
          file,
          'Public entrypoint imports or references the API-Football runtime client directly.',
          index + 1
        )
      }
    })
  }
}

function checkClientFiles(findings) {
  const files = [...new Set(CLIENT_ROOTS.flatMap(walkFiles))]

  for (const file of files) {
    const source = readFile(file)
    const isClient = file.startsWith('src/frontend/') || isClientComponent(source)

    if (!isClient) continue

    const lines = source.split(/\r?\n/)

    lines.forEach((line, index) => {
      if (isTypeOnlyImportLine(line)) return

      for (const pattern of PROVIDER_RUNTIME_PATTERNS) {
        if (pattern.test(line)) {
          addFinding(
            findings,
            file,
            'Client-side code references the API-Football provider runtime.',
            index + 1
          )
        }
      }

      for (const pattern of API_KEY_PATTERNS) {
        if (pattern.test(line)) {
          addFinding(
            findings,
            file,
            'Client-side code references an API-Football key or provider auth header.',
            index + 1
          )
        }
      }
    })
  }
}

function checkUseClientRuntimeImports(findings) {
  const files = walkFiles('src/app')

  for (const file of files) {
    const source = readFile(file)
    if (!isClientComponent(source)) continue

    const importMatches = source.matchAll(/^\s*import\s+(?!type\b).+?from\s+['"]([^'"]+)['"]/gm)

    for (const match of importMatches) {
      const imported = match[1]
      if (
        imported.includes('/server/integrations/football-api-client') ||
        imported.includes('/server/integrations/api-football') ||
        imported === '@/lib/api-football'
      ) {
        addFinding(
          findings,
          file,
          `use client module imports provider-backed runtime module "${imported}".`,
          lineNumberFor(source, match.index ?? 0)
        )
      }
    }
  }
}

const findings = []

checkPublicEntrypoints(findings)
checkClientFiles(findings)
checkUseClientRuntimeImports(findings)

if (findings.length) {
  console.error('Public read boundary verification failed.')
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.message}`)
  }
  process.exit(1)
}

console.log('Public read boundary verification passed.')
console.log(
  'Limits: this is a conservative text scan, not a TypeScript AST analyzer; type-only imports are allowed.'
)
