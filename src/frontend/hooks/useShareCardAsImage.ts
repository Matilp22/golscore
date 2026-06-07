'use client'

import { useCallback, useState } from 'react'
import { toPng } from 'html-to-image'

type ShareCardOptions = {
  fileName: string
  title: string
  text: string
  url: string
}

function dataUrlToFile(dataUrl: string, fileName: string) {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/data:(.*?);base64/)?.[1] ?? 'image/png'
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new File([bytes], fileName, { type: mime })
}

function downloadDataUrl(dataUrl: string, fileName: string) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
}

async function waitForShareAssets(element: HTMLElement) {
  if (document.fonts?.ready) {
    await document.fonts.ready.catch(() => undefined)
  }

  const images = Array.from(element.querySelectorAll('img'))

  await Promise.all(
    images.map(async (image) => {
      if (image.complete && image.naturalWidth > 0) return

      if (typeof image.decode === 'function') {
        await image.decode().catch(() => undefined)
        return
      }

      await new Promise<void>((resolve) => {
        const finish = () => resolve()
        image.addEventListener('load', finish, { once: true })
        image.addEventListener('error', finish, { once: true })
      })
    })
  )
}

export function useShareCardAsImage(
  targetId: string,
  options: ShareCardOptions
) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const createPng = useCallback(async () => {
    const element = document.getElementById(targetId)

    if (!element) {
      throw new Error('No se encontró la card para compartir.')
    }

    await waitForShareAssets(element)

    return toPng(element, {
      backgroundColor: '#07100d',
      cacheBust: true,
      pixelRatio: 2,
      width: element.scrollWidth,
      height: element.scrollHeight,
      style: {
        backgroundColor: '#07100d',
        color: '#ffffff',
        overflow: 'hidden',
      },
      filter: (node) => {
        if (!(node instanceof HTMLElement)) return true

        return node.dataset.shareExclude !== 'true' && node.dataset.shareIgnore !== 'true'
      },
    })
  }, [targetId])

  const downloadImage = useCallback(async () => {
    setIsGenerating(true)
    setError('')
    setMessage('')

    try {
      const dataUrl = await createPng()
      downloadDataUrl(dataUrl, options.fileName)
      setMessage('Imagen descargada.')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'No se pudo generar la imagen.')
    } finally {
      setIsGenerating(false)
    }
  }, [createPng, options.fileName])

  const shareImage = useCallback(async () => {
    setIsGenerating(true)
    setError('')
    setMessage('')

    try {
      const dataUrl = await createPng()
      const file = dataUrlToFile(dataUrl, options.fileName)
      const canShareFiles =
        typeof navigator !== 'undefined' &&
        'canShare' in navigator &&
        navigator.canShare?.({ files: [file] })

      if (canShareFiles) {
        await navigator.share({
          title: options.title,
          text: options.text,
          url: options.url,
          files: [file],
        })
        setMessage('Imagen compartida.')
        return
      }

      downloadDataUrl(dataUrl, options.fileName)
      setMessage('Tu navegador no comparte archivos. Descargué la imagen como fallback.')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'No se pudo compartir la imagen.')
    } finally {
      setIsGenerating(false)
    }
  }, [createPng, options])

  return {
    isGenerating,
    message,
    error,
    downloadImage,
    shareImage,
  }
}

