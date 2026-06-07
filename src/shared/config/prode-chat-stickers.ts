export type ProdeChatSticker = {
  id: string
  label: string
  category: 'Fútbol' | 'Reacciones' | 'Prode'
  emoji: string
  url: string
}

export const PRODE_CHAT_STICKERS: ProdeChatSticker[] = [
  { id: 'ball', label: 'Pelota', category: 'Fútbol', emoji: '⚽', url: 'emoji:⚽' },
  { id: 'goal', label: 'Gol', category: 'Fútbol', emoji: '🥅', url: 'emoji:🥅' },
  { id: 'trophy', label: 'Trofeo', category: 'Fútbol', emoji: '🏆', url: 'emoji:🏆' },
  { id: 'fire', label: 'Fuego', category: 'Reacciones', emoji: '🔥', url: 'emoji:🔥' },
  { id: 'laugh', label: 'Risa', category: 'Reacciones', emoji: '😂', url: 'emoji:😂' },
  { id: 'cry', label: 'Llanto', category: 'Reacciones', emoji: '😭', url: 'emoji:😭' },
  { id: 'vamos', label: 'Vamos', category: 'Prode', emoji: '💪', url: 'emoji:💪' },
  { id: 'var', label: 'VAR', category: 'Prode', emoji: '📺', url: 'emoji:📺' },
  { id: 'mufa', label: 'Mufa', category: 'Prode', emoji: '🧂', url: 'emoji:🧂' },
  { id: 'champion', label: 'Campeón', category: 'Prode', emoji: '⭐', url: 'emoji:⭐' },
]

export function getProdeChatSticker(id: string | null | undefined) {
  if (!id) return null

  return PRODE_CHAT_STICKERS.find((sticker) => sticker.id === id) ?? null
}
