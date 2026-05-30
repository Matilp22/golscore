'use client'

import { useCallback, useEffect, useState } from 'react'

import { CHAMPIONS_AUDIO } from '@/lib/audio-config'

const PREF_CHANGE_EVENT = 'hayfulbo:champions-audio-preference'
const LAST_PLAYED_KEY = 'hayfulbo_champions_audio_last_played_at'
const BLOCKED_KEY = 'hayfulbo_champions_audio_blocked'
const RECENT_PLAY_WINDOW_MS = 15000

let sharedAudio: HTMLAudioElement | null = null
let stopTimer: ReturnType<typeof setTimeout> | null = null
let cachedAvailability: boolean | null = null
let availabilityPromise: Promise<boolean> | null = null

function hasWindow() {
  return typeof window !== 'undefined'
}

function readStoredEnabled() {
  if (!CHAMPIONS_AUDIO.enabled) return false
  if (!hasWindow()) return CHAMPIONS_AUDIO.enabled

  try {
    const stored = window.localStorage.getItem(CHAMPIONS_AUDIO.storageKey)

    if (stored === 'false') return false
    if (stored === 'true') return true
  } catch {
    return CHAMPIONS_AUDIO.enabled
  }

  return CHAMPIONS_AUDIO.enabled
}

function writeStoredEnabled(enabled: boolean) {
  if (!hasWindow()) return

  try {
    window.localStorage.setItem(CHAMPIONS_AUDIO.storageKey, String(enabled))
    window.dispatchEvent(new Event(PREF_CHANGE_EVENT))
  } catch {
    // Preference persistence is best-effort only.
  }
}

function readRecentPlayed() {
  if (!hasWindow()) return false

  try {
    const rawValue = window.sessionStorage.getItem(LAST_PLAYED_KEY)
    const timestamp = rawValue ? Number(rawValue) : 0

    return Number.isFinite(timestamp) && Date.now() - timestamp < RECENT_PLAY_WINDOW_MS
  } catch {
    return false
  }
}

function markPlayed() {
  if (!hasWindow()) return

  try {
    window.sessionStorage.setItem(LAST_PLAYED_KEY, String(Date.now()))
  } catch {
    // Session state is only used to keep the page control quiet after a click navigation.
  }
}

function readBlocked() {
  if (!hasWindow()) return false

  try {
    return window.sessionStorage.getItem(BLOCKED_KEY) === 'true'
  } catch {
    return false
  }
}

function writeBlocked(blocked: boolean) {
  if (!hasWindow()) return

  try {
    if (blocked) {
      window.sessionStorage.setItem(BLOCKED_KEY, 'true')
    } else {
      window.sessionStorage.removeItem(BLOCKED_KEY)
    }
  } catch {
    // Blocking state is UI-only.
  }
}

function stopSharedAudio() {
  if (stopTimer) {
    clearTimeout(stopTimer)
    stopTimer = null
  }

  if (!sharedAudio) return

  sharedAudio.pause()
  sharedAudio.currentTime = 0
}

function getSharedAudio() {
  if (!hasWindow() || !CHAMPIONS_AUDIO.enabled) return null
  if (cachedAvailability === false) return null

  if (!sharedAudio) {
    sharedAudio = new Audio(CHAMPIONS_AUDIO.src)
    sharedAudio.preload = 'auto'
    sharedAudio.loop = false
  }

  sharedAudio.volume = CHAMPIONS_AUDIO.volume
  sharedAudio.loop = false

  return sharedAudio
}

function checkChampionsAudioAvailable() {
  if (!hasWindow() || !CHAMPIONS_AUDIO.enabled) return Promise.resolve(false)
  if (cachedAvailability !== null) return Promise.resolve(cachedAvailability)
  if (availabilityPromise) return availabilityPromise

  availabilityPromise = window
    .fetch(CHAMPIONS_AUDIO.src, { method: 'HEAD', cache: 'no-store' })
    .then((response) => {
      cachedAvailability = response.ok
      return cachedAvailability
    })
    .catch(() => {
      cachedAvailability = false
      return false
    })
    .finally(() => {
      availabilityPromise = null
    })

  return availabilityPromise
}

function isAutoplayBlock(error: unknown) {
  return error instanceof DOMException && error.name === 'NotAllowedError'
}

export function useChampionsEntrySound() {
  const [enabled, setEnabledState] = useState<boolean>(CHAMPIONS_AUDIO.enabled)
  const [blocked, setBlocked] = useState(false)
  const [available, setAvailable] = useState(false)
  const [availabilityChecked, setAvailabilityChecked] = useState(false)
  const [played, setPlayed] = useState(false)

  useEffect(() => {
    let active = true

    void checkChampionsAudioAvailable().then((isAvailable) => {
      if (!active) return

      setEnabledState(readStoredEnabled())
      setBlocked(readBlocked())
      setPlayed(readRecentPlayed())
      setAvailable(isAvailable)
      setAvailabilityChecked(true)
    })

    function handlePreferenceChange() {
      setEnabledState(readStoredEnabled())
    }

    window.addEventListener(PREF_CHANGE_EVENT, handlePreferenceChange)
    window.addEventListener('storage', handlePreferenceChange)

    return () => {
      active = false
      window.removeEventListener(PREF_CHANGE_EVENT, handlePreferenceChange)
      window.removeEventListener('storage', handlePreferenceChange)
    }
  }, [])

  const stop = useCallback(() => {
    stopSharedAudio()
  }, [])

  const setEnabled = useCallback(
    (nextEnabled: boolean) => {
      writeStoredEnabled(nextEnabled)
      setEnabledState(nextEnabled)

      if (!nextEnabled) stop()
    },
    [stop]
  )

  const play = useCallback(async () => {
    if (!readStoredEnabled()) return false

    const audio = getSharedAudio()
    if (!audio) {
      setAvailable(false)
      setAvailabilityChecked(true)
      return false
    }

    try {
      if (stopTimer) clearTimeout(stopTimer)

      audio.pause()
      audio.currentTime = 0
      await audio.play()

      setAvailable(true)
      setAvailabilityChecked(true)
      setBlocked(false)
      writeBlocked(false)
      setPlayed(true)
      markPlayed()

      stopTimer = setTimeout(stopSharedAudio, CHAMPIONS_AUDIO.maxDurationMs)

      return true
    } catch (error) {
      stopSharedAudio()

      if (isAutoplayBlock(error)) {
        setBlocked(true)
        writeBlocked(true)
      } else {
        cachedAvailability = false
        setAvailable(false)
        setAvailabilityChecked(true)
      }

      return false
    }
  }, [])

  return {
    play,
    stop,
    blocked,
    enabled,
    setEnabled,
    available,
    availabilityChecked,
    played,
  }
}
