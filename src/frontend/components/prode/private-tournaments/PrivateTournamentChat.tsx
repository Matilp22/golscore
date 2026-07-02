'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useTranslations } from '@/frontend/components/LocaleProvider'
import { useAuth } from '@/frontend/hooks/useAuth'
import type { ProdeChatSticker } from '@/shared/config/prode-chat-stickers'

type ChatMessage = {
  id: string
  chatId: string
  privateTournamentId: string
  userId: string
  username: string
  messageType: 'text' | 'sticker'
  message: string | null
  stickerId: string | null
  stickerUrl: string | null
  stickerLabel: string | null
  createdAt: string
}

type PrivateTournamentChatProps = {
  tournamentId: string
  tournamentName: string
}

const DATE_LOCALE: Record<string, string> = {
  es: 'es-AR',
  en: 'en-US',
  pt: 'pt-BR',
  fr: 'fr-FR',
}

function formatTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale] ?? locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

function renderSticker(stickerUrl: string | null, label: string | null, fallbackAlt: string) {
  if (!stickerUrl) return <span className="text-4xl">🙂</span>
  if (stickerUrl.startsWith('emoji:')) {
    return <span className="text-4xl leading-none">{stickerUrl.replace('emoji:', '')}</span>
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={stickerUrl}
      alt={label ?? fallbackAlt}
      className="h-16 w-16 object-contain"
      loading="lazy"
    />
  )
}

function NotificationBellIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

export default function PrivateTournamentChat({
  tournamentId,
  tournamentName,
}: PrivateTournamentChatProps) {
  const { locale, t } = useTranslations()
  const { user, isLoading: isAuthLoading } = useAuth()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const shouldStickToBottomRef = useRef(true)
  const hasInitializedReadStateRef = useRef(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [stickers, setStickers] = useState<ProdeChatSticker[]>([])
  const [currentUserCanWrite, setCurrentUserCanWrite] = useState(false)
  const [currentUserCanModerate, setCurrentUserCanModerate] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isStickerPanelOpen, setIsStickerPanelOpen] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [lastSeenMessageId, setLastSeenMessageId] = useState<string | null>(null)

  const loadChat = useCallback(async (silent = false) => {
    if (isAuthLoading) return

    if (!user) {
      setMessages([])
      setCurrentUserCanWrite(false)
      setCurrentUserCanModerate(false)
      setIsLoading(false)
      return
    }

    if (!silent) setIsLoading(true)
    setError('')

    try {
      const response = await fetch(
        `/api/prode/private-tournaments/${encodeURIComponent(tournamentId)}/chat?limit=50`,
        { cache: 'no-store' }
      )
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || t('privateChat.loadError'))
      }

      setMessages(payload.messages ?? [])
      setStickers(payload.stickers ?? [])
      setCurrentUserCanWrite(Boolean(payload.currentUserCanWrite))
      setCurrentUserCanModerate(Boolean(payload.currentUserCanModerate))
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t('privateChat.loadError'))
      setCurrentUserCanWrite(false)
      setCurrentUserCanModerate(false)
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [isAuthLoading, t, tournamentId, user])

  useEffect(() => {
    void loadChat()
  }, [loadChat])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadChat(true)
    }, 15000)

    return () => window.clearInterval(intervalId)
  }, [loadChat])

  useEffect(() => {
    if (!shouldStickToBottomRef.current) return
    const element = scrollRef.current
    if (!element) return

    element.scrollTop = element.scrollHeight
  }, [messages])

  useEffect(() => {
    const latestMessageId = messages.at(-1)?.id ?? null

    if (!latestMessageId) {
      hasInitializedReadStateRef.current = false
      setLastSeenMessageId(null)
      return
    }

    if (!hasInitializedReadStateRef.current || isMobileOpen) {
      hasInitializedReadStateRef.current = true
      setLastSeenMessageId(latestMessageId)
    }
  }, [isMobileOpen, messages])

  const unreadCount = useMemo(() => {
    if (isMobileOpen || !messages.length || !lastSeenMessageId) return 0

    const lastSeenIndex = messages.findIndex((chatMessage) => chatMessage.id === lastSeenMessageId)
    const unreadMessages = lastSeenIndex === -1
      ? messages
      : messages.slice(lastSeenIndex + 1)

    return unreadMessages.filter((chatMessage) => chatMessage.userId !== user?.id).length
  }, [isMobileOpen, lastSeenMessageId, messages, user?.id])

  const groupedStickers = useMemo(() => {
    return stickers.reduce<Record<string, ProdeChatSticker[]>>((groups, sticker) => {
      groups[sticker.category] = [...(groups[sticker.category] ?? []), sticker]
      return groups
    }, {})
  }, [stickers])

  const handleScroll = () => {
    const element = scrollRef.current
    if (!element) return

    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
    shouldStickToBottomRef.current = distanceFromBottom < 48
  }

  const sendMessage = async (input: {
    messageType: 'text' | 'sticker'
    message?: string
    stickerId?: string
  }) => {
    if (isSending) return

    setIsSending(true)
    setError('')

    try {
      const response = await fetch(
        `/api/prode/private-tournaments/${encodeURIComponent(tournamentId)}/chat/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        }
      )
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || t('privateChat.sendError'))
      }

      setMessages((current) => [...current, payload.message])
      setLastSeenMessageId(payload.message?.id ?? null)
      setMessage('')
      setIsStickerPanelOpen(false)
      shouldStickToBottomRef.current = true
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t('privateChat.sendError'))
    } finally {
      setIsSending(false)
    }
  }

  const deleteMessage = async (messageId: string) => {
    try {
      const response = await fetch(
        `/api/prode/private-tournaments/${encodeURIComponent(tournamentId)}/chat/messages/${encodeURIComponent(messageId)}`,
        { method: 'DELETE' }
      )
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(payload.error || t('privateChat.deleteError'))

      setMessages((current) => current.filter((chatMessage) => chatMessage.id !== messageId))
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t('privateChat.deleteError'))
    }
  }

  const sendText = () => {
    const cleanMessage = message.trim()
    if (!cleanMessage) return

    void sendMessage({ messageType: 'text', message: cleanMessage })
  }

  const chatSurface = (
    <section className="hf-card hf-prode-chat-card flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl">
      <div className="hf-section-head shrink-0 px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-white">{t('privateChat.title')}</h2>
            <p className="mt-1 truncate text-xs text-[#8d98a7]">{tournamentName}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {unreadCount ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-amber-300/35 bg-amber-300 px-2 py-1 text-[10px] font-black uppercase text-[#221505] shadow-[0_0_16px_rgba(251,191,36,0.28)]"
                title={t('privateChat.unreadMessages', { count: String(unreadCount) })}
              >
                <NotificationBellIcon />
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            ) : null}
            <span className="rounded-full border border-[#70ff9d]/20 bg-[#70ff9d]/10 px-2 py-1 text-[10px] font-black uppercase text-[#70ff9d]">
              {t('privateChat.live')}
            </span>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="hf-prode-chat-scroll min-h-0 flex-1 overflow-y-auto border-y border-white/6 bg-[#080f0d] px-3 py-3"
      >
        {isLoading || isAuthLoading ? (
          <p className="text-sm text-[#8d98a7]">{t('privateChat.loading')}</p>
        ) : messages.length ? (
          <div className="space-y-2">
            {messages.map((chatMessage) => {
              const canDelete =
                currentUserCanModerate || (user?.id && user.id === chatMessage.userId)

              return (
                <div key={chatMessage.id} className="group flex items-start gap-2 text-sm">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#70ff9d]/20 bg-[#70ff9d]/10 text-[11px] font-black text-[#70ff9d]">
                    {chatMessage.username.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <span className="truncate text-xs font-black text-[#7ff0b2]">
                        {chatMessage.username}
                      </span>
                      <span className="text-[10px] text-[#6f7a86]">
                        {formatTime(chatMessage.createdAt, locale)}
                      </span>
                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => void deleteMessage(chatMessage.id)}
                          className="ml-auto text-[10px] font-bold text-[#6f7a86] opacity-0 transition hover:text-red-200 group-hover:opacity-100"
                        >
                          {t('privateChat.delete')}
                        </button>
                      ) : null}
                    </div>
                    {chatMessage.messageType === 'sticker' ? (
                      <div className="mt-1 inline-flex rounded-xl border border-white/8 bg-white/[0.03] p-2">
                        {renderSticker(chatMessage.stickerUrl, chatMessage.stickerLabel, t('privateChat.stickerAlt'))}
                      </div>
                    ) : (
                      <p className="hf-prode-chat-message mt-0.5 break-words leading-relaxed text-[#dce7f2]">
                        {chatMessage.message}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-[#8d98a7]">
            {t('privateChat.empty')}
          </p>
        )}
      </div>

      <div className="shrink-0 space-y-2 p-3">
        {!user && !isAuthLoading ? (
          <p className="rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-sm text-[#9aa7b5]">
            {t('privateChat.signIn')}
          </p>
        ) : user && !currentUserCanWrite ? (
          <p className="rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-sm text-[#9aa7b5]">
            {t('privateChat.noAccess')}
          </p>
        ) : null}

        {isStickerPanelOpen ? (
          <div className="max-h-44 overflow-y-auto rounded-xl border border-white/8 bg-[#101714] p-2">
            {Object.entries(groupedStickers).map(([category, categoryStickers]) => (
              <div key={category} className="mb-2 last:mb-0">
                <p className="mb-1 px-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#8d98a7]">
                  {category}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {categoryStickers.map((sticker) => (
                    <button
                      key={sticker.id}
                      type="button"
                      onClick={() => sendMessage({ messageType: 'sticker', stickerId: sticker.id })}
                      disabled={!currentUserCanWrite || isSending}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/8 bg-black/20 text-2xl transition hover:border-[#7ff0b2]/40 disabled:cursor-not-allowed disabled:opacity-50"
                      title={sticker.label}
                    >
                      {sticker.emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsStickerPanelOpen((current) => !current)}
            disabled={!currentUserCanWrite}
            className="hf-button-secondary h-11 w-11 rounded-xl text-xl disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Stickers"
            title="Stickers"
          >
            🙂
          </button>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value.slice(0, 500))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                sendText()
              }
            }}
            disabled={!currentUserCanWrite || isSending}
            rows={1}
            placeholder={t('privateChat.placeholder')}
            className="hf-input min-h-11 flex-1 resize-none rounded-xl px-3 py-2 text-sm font-semibold outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="button"
            onClick={sendText}
            disabled={!currentUserCanWrite || isSending || !message.trim()}
            className="hf-button h-11 rounded-xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('privateChat.send')}
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-[#6f7a86]">
          <span>{message.length}/500</span>
          <span>{t('privateChat.shortcut')}</span>
        </div>
        {error ? <p className="text-xs font-semibold text-red-200">{error}</p> : null}
      </div>
    </section>
  )

  return (
    <>
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => {
            setIsMobileOpen(true)
            setLastSeenMessageId(messages.at(-1)?.id ?? null)
          }}
          className="hf-button relative flex h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-black"
          aria-label={
            unreadCount
              ? `${t('privateChat.title')} - ${t('privateChat.unreadMessages', { count: String(unreadCount) })}`
              : t('privateChat.title')
          }
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            {unreadCount ? (
              <span className="relative inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-300/35 bg-amber-300 text-[#221505] shadow-[0_0_16px_rgba(251,191,36,0.28)]">
                <NotificationBellIcon className="h-3.5 w-3.5" />
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-400 ring-2 ring-[#70ff9d]" />
              </span>
            ) : null}
            <span className="truncate">{t('privateChat.title')}</span>
          </span>
          {unreadCount ? (
            <span className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-full border border-amber-300/35 bg-amber-300 px-2 py-0.5 text-[10px] font-black text-[#221505] shadow-[0_0_16px_rgba(251,191,36,0.28)]">
              <NotificationBellIcon className="h-3 w-3" />
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </button>
      </div>

      <div className="hidden lg:sticky lg:top-4 lg:block lg:h-[calc(100vh-7rem)]">
        {chatSurface}
      </div>

      {isMobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={t('privateChat.close')}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 h-[82vh] rounded-t-3xl border border-white/10 bg-[#070b09] p-3 shadow-[0_-24px_80px_rgba(0,0,0,0.55)]">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-black uppercase tracking-[0.12em] text-[#8d98a7]">
                {t('privateChat.title')}
              </p>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="hf-button-secondary h-9 rounded-xl px-3 text-xs font-black"
              >
                {t('common.close')}
              </button>
            </div>
            <div className="h-[calc(82vh-4rem)]">{chatSurface}</div>
          </div>
        </div>
      ) : null}
    </>
  )
}
