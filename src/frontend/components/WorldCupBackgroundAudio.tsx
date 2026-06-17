'use client'

import { useEffect } from 'react'

import { useAppAudioPreference } from '@/frontend/hooks/useAppAudioPreference'
import { APP_AUDIO_PREFERENCE, WORLD_CUP_AUDIO } from '@/lib/audio-config'

type WorldCupBackgroundAudioProps = {
  enabled: boolean
}

let sharedAudio: HTMLAudioElement | null = null

function getAudio() {
  if (typeof window === 'undefined' || !WORLD_CUP_AUDIO.enabled) return null

  if (!sharedAudio) {
    sharedAudio = new Audio(WORLD_CUP_AUDIO.src)
    sharedAudio.preload = 'auto'
  }

  sharedAudio.loop = WORLD_CUP_AUDIO.loop
  sharedAudio.volume = WORLD_CUP_AUDIO.volume

  return sharedAudio
}

function stopWorldCupAudio() {
  if (!sharedAudio) return

  sharedAudio.pause()
  sharedAudio.currentTime = 0
}

function isAutoplayBlock(error: unknown) {
  return error instanceof DOMException && error.name === 'NotAllowedError'
}

export default function WorldCupBackgroundAudio({
  enabled,
}: WorldCupBackgroundAudioProps) {
  const { enabled: appAudioEnabled } = useAppAudioPreference()
  const shouldPlay = enabled && appAudioEnabled && WORLD_CUP_AUDIO.enabled

  useEffect(() => {
    if (!shouldPlay) {
      stopWorldCupAudio()
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
      const audio = getAudio()
      if (!active || !audio) return

      try {
        await audio.play()
        removeInteractionListeners()
      } catch (error) {
        if (isAutoplayBlock(error)) {
          addInteractionListeners()
          return
        }

        console.warn('[world-cup-audio] No se pudo reproducir el audio del Mundial', {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    function handleInteraction() {
      removeInteractionListeners()
      void play()
    }

    function handleStop() {
      stopWorldCupAudio()
    }

    window.addEventListener(APP_AUDIO_PREFERENCE.stopEvent, handleStop)
    void play()

    return () => {
      active = false
      removeInteractionListeners()
      window.removeEventListener(APP_AUDIO_PREFERENCE.stopEvent, handleStop)
      stopWorldCupAudio()
    }
  }, [shouldPlay])

  return null
}
