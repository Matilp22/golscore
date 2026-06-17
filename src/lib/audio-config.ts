export const APP_AUDIO_PREFERENCE = {
  enabledByDefault: false,
  storageKey: 'hayfulbo_audio_enabled',
  changeEvent: 'hayfulbo:audio-preference',
  stopEvent: 'hayfulbo:audio-stop-all',
} as const

export const CHAMPIONS_AUDIO = {
  enabled: true,
  src: '/audio/champions-sting.mp3',
  maxDurationMs: 5000,
  volume: 0.35,
} as const

export const WORLD_CUP_AUDIO = {
  enabled: true,
  src: '/audio/copa%20del%20mundo%2026.m4a',
  volume: 0.18,
  loop: true,
} as const
