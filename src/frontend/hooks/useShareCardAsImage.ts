'use client'

import { useCallback, useState } from 'react'
import { toBlob } from 'html-to-image'

type ShareCardOptions = {
  fileName: string
  title: string
  text: string
  url: string
}

const TRANSPARENT_IMAGE_PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='

function blobToFile(blob: Blob, fileName: string) {
  return new File([blob], fileName, { type: blob.type || 'image/png' })
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = objectUrl
  link.download = fileName
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000)
}

function openBlobInNewTab(blob: Blob) {
  const objectUrl = URL.createObjectURL(blob)
  const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer')

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)

  return Boolean(opened)
}

function isLikelyDownloadHostileBrowser() {
  const userAgent = navigator.userAgent.toLowerCase()
  const isIos = /iphone|ipad|ipod/.test(userAgent)
  const isInAppBrowser = /instagram|fbav|fban|line|wv|whatsapp/.test(userAgent)

  return isIos || isInAppBrowser
}

function getShareAssetProxyUrl(source: string) {
  if (!source || source.startsWith('data:') || source.startsWith('blob:')) return null

  try {
    const url = new URL(source, window.location.origin)

    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (url.origin === window.location.origin) return null

    return `/api/share-card-asset?url=${encodeURIComponent(url.toString())}`
  } catch {
    return null
  }
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

async function withProxiedShareImages<T>(
  element: HTMLElement,
  callback: () => Promise<T>
) {
  const images = Array.from(element.querySelectorAll('img'))
  const restores: Array<() => void> = []

  for (const image of images) {
    const originalSrc = image.getAttribute('src')
    const originalSrcSet = image.getAttribute('srcset')
    const proxyUrl = originalSrc ? getShareAssetProxyUrl(originalSrc) : null

    if (!proxyUrl) continue

    restores.push(() => {
      if (originalSrc === null) image.removeAttribute('src')
      else image.setAttribute('src', originalSrc)

      if (originalSrcSet === null) image.removeAttribute('srcset')
      else image.setAttribute('srcset', originalSrcSet)
    })

    image.removeAttribute('srcset')
    image.setAttribute('src', proxyUrl)
  }

  try {
    await waitForShareAssets(element)
    return await callback()
  } finally {
    restores.reverse().forEach((restore) => restore())
  }
}

export function useShareCardAsImage(
  targetId: string,
  options: ShareCardOptions
) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const createPngBlob = useCallback(async () => {
    const element = document.getElementById(targetId)

    if (!element) {
      throw new Error('No se encontro la card para compartir.')
    }

    await waitForShareAssets(element)

    return withProxiedShareImages(element, async () => {
      const rect = element.getBoundingClientRect()
      const width = Math.max(1, Math.ceil(element.scrollWidth || rect.width))
      const height = Math.max(1, Math.ceil(element.scrollHeight || rect.height))
      const blob = await toBlob(element, {
        backgroundColor: '#07100d',
        cacheBust: true,
        canvasWidth: width * 2,
        canvasHeight: height * 2,
        imagePlaceholder: TRANSPARENT_IMAGE_PLACEHOLDER,
        includeQueryParams: true,
        pixelRatio: 2,
        width,
        height,
        style: {
          backgroundColor: '#07100d',
          bottom: 'auto',
          color: '#ffffff',
          left: '0',
          margin: '0',
          overflow: 'hidden',
          position: 'relative',
          right: 'auto',
          top: '0',
          transform: 'none',
        },
        filter: (node) => {
          if (!(node instanceof HTMLElement)) return true

          return node.dataset.shareExclude !== 'true' && node.dataset.shareIgnore !== 'true'
        },
      })

      if (!blob) throw new Error('No se pudo generar el PNG.')

      return blob
    })
  }, [targetId])

  const downloadImage = useCallback(async () => {
    setIsGenerating(true)
    setError('')
    setMessage('')

    try {
      const blob = await createPngBlob()
      const file = blobToFile(blob, options.fileName)
      const canShareFiles =
        typeof navigator !== 'undefined' &&
        'canShare' in navigator &&
        navigator.canShare?.({ files: [file] })

      if (isLikelyDownloadHostileBrowser() && canShareFiles) {
        await navigator.share({
          title: options.title,
          text: options.text,
          files: [file],
        })
        setMessage('Abrimos la hoja de compartir para guardar la imagen.')
        return
      }

      downloadBlob(blob, options.fileName)
      setMessage('Imagen descargada. Si tu navegador no la guardo, usa Compartir imagen.')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'No se pudo generar la imagen.')
    } finally {
      setIsGenerating(false)
    }
  }, [createPngBlob, options])

  const shareImage = useCallback(async () => {
    setIsGenerating(true)
    setError('')
    setMessage('')

    try {
      const blob = await createPngBlob()
      const file = blobToFile(blob, options.fileName)
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

      downloadBlob(blob, options.fileName)
      setMessage('Tu navegador no comparte archivos. Descargue la imagen como fallback.')
    } catch (caughtError) {
      if (caughtError instanceof DOMException && caughtError.name === 'AbortError') {
        setMessage('Compartir cancelado.')
      } else {
        setError(caughtError instanceof Error ? caughtError.message : 'No se pudo compartir la imagen.')
      }
    } finally {
      setIsGenerating(false)
    }
  }, [createPngBlob, options])

  const openImage = useCallback(async () => {
    setIsGenerating(true)
    setError('')
    setMessage('')

    try {
      const blob = await createPngBlob()

      if (openBlobInNewTab(blob)) {
        setMessage('Imagen abierta. Desde ahi podes guardarla o compartirla.')
        return
      }

      downloadBlob(blob, options.fileName)
      setMessage('No se pudo abrir una pestana nueva. Intente descargar la imagen.')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'No se pudo abrir la imagen.')
    } finally {
      setIsGenerating(false)
    }
  }, [createPngBlob, options.fileName])

  return {
    isGenerating,
    message,
    error,
    downloadImage,
    openImage,
    shareImage,
  }
}
