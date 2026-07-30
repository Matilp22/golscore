type EntityTaggedContent = {
  title: string
  summary: string
  tags: string[]
}

function normalizeEntityTerm(value: string) {
  return value
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

export function matchesEntityContent(
  entityName: string,
  content: EntityTaggedContent
) {
  const term = normalizeEntityTerm(entityName)
  if (!term) return false

  const tags = content.tags.map(normalizeEntityTerm)
  const searchable = normalizeEntityTerm(
    `${content.title} ${content.summary}`
  )

  return tags.includes(term) || searchable.includes(term)
}
