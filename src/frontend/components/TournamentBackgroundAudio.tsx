'use client'

import { useEffect } from 'react'

import { useAppAudioPreference } from '@/frontend/hooks/useAppAudioPreference'
import { APP_AUDIO_PREFERENCE } from '@/lib/audio-config'

type TournamentBackgroundAudioProps = {
  enabled: boolean
  src: string
  volume: number
  debugName: string
  loop?: boolean
}

const audioBySource = new Map<string, HTMLAudioElement>()

function getAudio(src: string, volume: number, loop: boolean) {
  if (typeof window === 'undefined') return null

  let audio = audioBySource.get(src)

  if (!audio) {
    audio = new Audio(src)
    audio.preload = 'auto'
    audioBySource.set(src, audio)
  }

  audio.loop = loop
  audio.volume = volume

  return audio
}

function stopAudio(src: string) {
  const audio = audioBySource.get(src)
  if (!audio) return

  audio.pause()
  audio.currentTime = 0
}

export function stopAllTournamentAudio() {
  audioBySource.forEach((audio) => {
    audio.pause()
    audio.currentTime = 0
  })
}

function isAutoplayBlock(error: unknown) {
  return error instanceof DOMException && error.name === 'NotAllowedError'
}

export default function TournamentBackgroundAudio({
  enabled,
  src,
  volume,
  debugName,
  loop = true,
}: TournamentBackgroundAudioProps) {
  const { enabled: appAudioEnabled } = useAppAudioPreference()
  const shouldPlay = enabled && appAudioEnabled

  useEffect(() => {
    if (!shouldPlay) {
      stopAudio(src)
      return
    }

    let active = true
    let waitingForInteraction = false

    const removeInteractionListeners = () => {
      window.removeEventListener('pointerdown', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
      window.removeEventListener('touchstart', handleInteraction)
      waitingForInteraction = false
    }

    const addInteractionListeners = () => {
      if (waitingForInteraction) return

      waitingForInteraction = true
      window.addEventListener('pointerdown', handleInteraction, { passive: true })
      window.addEventListener('keydown', handleInteraction)
      window.addEventListener('touchstart', handleInteraction, { passive: true })
    }

    async function play() {
      const audio = getAudio(src, volume, loop)
      if (!active || !audio) return

      try {
        stopAllTournamentAudio()
        await audio.play()
        removeInteractionListeners()
      } catch (error) {
        if (isAutoplayBlock(error)) {
          addInteractionListeners()
          return
        }

        console.warn(`[${debugName}] No se pudo reproducir el audio de fondo`, {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    function handleInteraction() {
      removeInteractionListeners()
      void play()
    }

    function handleStop() {
      stopAllTournamentAudio()
    }

    window.addEventListener(APP_AUDIO_PREFERENCE.stopEvent, handleStop)
    void play()

    return () => {
      active = false
      removeInteractionListeners()
      window.removeEventListener(APP_AUDIO_PREFERENCE.stopEvent, handleStop)
      stopAudio(src)
    }
  }, [debugName, loop, shouldPlay, src, volume])

  return null
}
