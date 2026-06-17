'use client'

import TournamentBackgroundAudio from '@/frontend/components/TournamentBackgroundAudio'
import { WORLD_CUP_AUDIO } from '@/lib/audio-config'

type WorldCupBackgroundAudioProps = {
  enabled: boolean
}

export default function WorldCupBackgroundAudio({
  enabled,
}: WorldCupBackgroundAudioProps) {
  return (
    <TournamentBackgroundAudio
      enabled={enabled && WORLD_CUP_AUDIO.enabled}
      src={WORLD_CUP_AUDIO.src}
      volume={WORLD_CUP_AUDIO.volume}
      loop={WORLD_CUP_AUDIO.loop}
      debugName="world-cup-audio"
    />
  )
}
