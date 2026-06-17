'use client'

import TournamentBackgroundAudio from '@/frontend/components/TournamentBackgroundAudio'
import { CHAMPIONS_AUDIO } from '@/lib/audio-config'

type ChampionsBackgroundAudioProps = {
  enabled: boolean
}

export default function ChampionsBackgroundAudio({
  enabled,
}: ChampionsBackgroundAudioProps) {
  return (
    <TournamentBackgroundAudio
      enabled={enabled && CHAMPIONS_AUDIO.enabled}
      src={CHAMPIONS_AUDIO.src}
      volume={CHAMPIONS_AUDIO.volume}
      loop
      debugName="champions-audio"
    />
  )
}
