'use client'

import { useCallback, useEffect, useState } from 'react'

import { APP_AUDIO_PREFERENCE } from '@/lib/audio-config'

function hasWindow() {
  return typeof window !== 'undefined'
}

export function readAppAudioEnabled() {
  if (!hasWindow()) return APP_AUDIO_PREFERENCE.enabledByDefault

  try {
    const stored = window.localStorage.getItem(APP_AUDIO_PREFERENCE.storageKey)

    if (stored === 'true') return true
    if (stored === 'false') return false
  } catch {
    return APP_AUDIO_PREFERENCE.enabledByDefault
  }

  return APP_AUDIO_PREFERENCE.enabledByDefault
}

export function stopAllAppAudio() {
  if (!hasWindow()) return

  window.dispatchEvent(new Event(APP_AUDIO_PREFERENCE.stopEvent))
}

export function writeAppAudioEnabled(enabled: boolean) {
  if (!hasWindow()) return

  try {
    window.localStorage.setItem(APP_AUDIO_PREFERENCE.storageKey, String(enabled))
  } catch {
    // Audio preference remains best-effort on browsers with restricted storage.
  }

  window.dispatchEvent(new CustomEvent(APP_AUDIO_PREFERENCE.changeEvent, {
    detail: { enabled },
  }))

  if (!enabled) stopAllAppAudio()
}

export function useAppAudioPreference() {
  const [enabled, setEnabledState] = useState<boolean>(APP_AUDIO_PREFERENCE.enabledByDefault)

  useEffect(() => {
    function syncPreference() {
      setEnabledState(readAppAudioEnabled())
    }

    syncPreference()
    window.addEventListener(APP_AUDIO_PREFERENCE.changeEvent, syncPreference)
    window.addEventListener('storage', syncPreference)

    return () => {
      window.removeEventListener(APP_AUDIO_PREFERENCE.changeEvent, syncPreference)
      window.removeEventListener('storage', syncPreference)
    }
  }, [])

  const setEnabled = useCallback((nextEnabled: boolean) => {
    writeAppAudioEnabled(nextEnabled)
    setEnabledState(nextEnabled)
  }, [])

  return {
    enabled,
    setEnabled,
  }
}
