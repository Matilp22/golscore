'use client'

import { useState } from 'react'

type MiTorneitoShareActionsProps = {
  title: string
  url: string
}

function buildWhatsAppUrl(title: string, url: string) {
  const text = encodeURIComponent(`${title} en Hay Fulbo: ${url}`)

  return `https://wa.me/?text=${text}`
}

export function MiTorneitoShareActions({ title, url }: MiTorneitoShareActionsProps) {
  const [copied, setCopied] = useState(false)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="hf-mi-share">
      <a href={buildWhatsAppUrl(title, url)} target="_blank" rel="noreferrer">
        Compartir por WhatsApp
      </a>
      <button type="button" onClick={copyLink}>
        {copied ? 'Link copiado' : 'Copiar link'}
      </button>
    </div>
  )
}
