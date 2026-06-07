import type { User } from '@supabase/supabase-js'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  getProdeChatSticker,
  PRODE_CHAT_STICKERS,
} from '@/shared/config/prode-chat-stickers'

type TournamentRow = {
  id: string
  display_name: string | null
  name: string | null
  created_by: string | null
}

type MembershipRow = {
  id: string
  role: string | null
}

type ChatRow = {
  id: string
  private_tournament_id: string
  title: string | null
  created_at: string
  updated_at: string
}

type MessageRow = {
  id: string
  chat_id: string
  private_tournament_id: string
  user_id: string
  username: string | null
  message_type: 'text' | 'sticker'
  message: string | null
  sticker_id: string | null
  sticker_url: string | null
  sticker_label: string | null
  created_at: string
  edited_at: string | null
  deleted_at: string | null
}

type ProfileRow = {
  id: string
  username?: string | null
  display_name?: string | null
  email?: string | null
}

type AccessContext = {
  tournament: TournamentRow
  membership: MembershipRow | null
  canRead: boolean
  canWrite: boolean
  canModerate: boolean
  role: string | null
}

export class PrivateTournamentChatError extends Error {
  status: number
  code: string | null

  constructor(message: string, status = 500, code: string | null = null) {
    super(message)
    this.name = 'PrivateTournamentChatError'
    this.status = status
    this.code = code
  }
}

function cleanTextMessage(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 500)
}

function getMetadataName(user: User) {
  const metadata = user.user_metadata as Record<string, unknown> | null
  if (!metadata) return null

  for (const key of ['username', 'name', 'full_name', 'display_name']) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  return null
}

async function getProfile(userId: string) {
  const supabase = getSupabaseAdminClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, email')
    .eq('id', userId)
    .maybeSingle()

  return (data ?? null) as ProfileRow | null
}

async function resolveUsername(user: User) {
  const profile = await getProfile(user.id)

  return (
    profile?.username?.trim() ||
    profile?.display_name?.trim() ||
    getMetadataName(user) ||
    profile?.email?.trim() ||
    user.email?.trim() ||
    'Usuario'
  )
}

async function getAccessContext(tournamentId: string, userId: string): Promise<AccessContext> {
  const supabase = getSupabaseAdminClient()
  const [{ data: tournament, error: tournamentError }, { data: membership, error: membershipError }] =
    await Promise.all([
      supabase
        .from('prode_private_tournaments')
        .select('id, display_name, name, created_by')
        .eq('id', tournamentId)
        .maybeSingle(),
      supabase
        .from('prode_private_tournament_members')
        .select('id, role')
        .eq('tournament_id', tournamentId)
        .eq('user_id', userId)
        .maybeSingle(),
    ])

  if (tournamentError) {
    throw new PrivateTournamentChatError(tournamentError.message, 500, tournamentError.code ?? null)
  }
  if (membershipError) {
    throw new PrivateTournamentChatError(membershipError.message, 500, membershipError.code ?? null)
  }
  if (!tournament) {
    throw new PrivateTournamentChatError('Torneo no encontrado.', 404)
  }

  const role = (membership as MembershipRow | null)?.role ?? null
  const isCreator = (tournament as TournamentRow).created_by === userId
  const canRead = Boolean(membership) || isCreator
  const canModerate = isCreator || role === 'owner' || role === 'admin'

  return {
    tournament: tournament as TournamentRow,
    membership: membership as MembershipRow | null,
    canRead,
    canWrite: canRead,
    canModerate,
    role: canModerate ? role ?? 'owner' : role,
  }
}

function assertAccess(context: AccessContext) {
  if (!context.canRead) {
    throw new PrivateTournamentChatError('No tenés acceso a este chat.', 403)
  }
}

async function findOrCreateChat(context: AccessContext) {
  const supabase = getSupabaseAdminClient()
  const { data: existing, error: existingError } = await supabase
    .from('private_tournament_chats')
    .select('id, private_tournament_id, title, created_at, updated_at')
    .eq('private_tournament_id', context.tournament.id)
    .maybeSingle()

  if (existingError) {
    throw new PrivateTournamentChatError(existingError.message, 500, existingError.code ?? null)
  }
  if (existing) return existing as ChatRow

  const title = context.tournament.display_name ?? context.tournament.name ?? 'Torneo privado'
  const { data: inserted, error: insertError } = await supabase
    .from('private_tournament_chats')
    .insert({
      private_tournament_id: context.tournament.id,
      title,
    })
    .select('id, private_tournament_id, title, created_at, updated_at')
    .single()

  if (insertError) {
    if (insertError.code === '23505') return findOrCreateChat(context)
    throw new PrivateTournamentChatError(insertError.message, 500, insertError.code ?? null)
  }

  return inserted as ChatRow
}

function serializeMessage(message: MessageRow) {
  return {
    id: message.id,
    chatId: message.chat_id,
    privateTournamentId: message.private_tournament_id,
    userId: message.user_id,
    username: message.username?.trim() || 'Usuario',
    messageType: message.message_type,
    message: message.message,
    stickerId: message.sticker_id,
    stickerUrl: message.sticker_url,
    stickerLabel: message.sticker_label,
    createdAt: message.created_at,
    editedAt: message.edited_at,
    deletedAt: message.deleted_at,
  }
}

async function getChatByTournamentId(tournamentId: string, userId: string) {
  const context = await getAccessContext(tournamentId, userId)
  assertAccess(context)

  const chat = await findOrCreateChat(context)

  return { context, chat }
}

export async function getPrivateTournamentChat({
  tournamentId,
  userId,
  limit = 50,
  before,
}: {
  tournamentId: string
  userId: string
  limit?: number
  before?: string | null
}) {
  const { context, chat } = await getChatByTournamentId(tournamentId, userId)
  const supabase = getSupabaseAdminClient()
  let query = supabase
    .from('private_tournament_chat_messages')
    .select(
      'id, chat_id, private_tournament_id, user_id, username, message_type, message, sticker_id, sticker_url, sticker_label, created_at, edited_at, deleted_at'
    )
    .eq('chat_id', chat.id)
    .eq('private_tournament_id', tournamentId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(100, Math.floor(limit))))

  if (before) query = query.lt('created_at', before)

  const { data, error } = await query
  if (error) {
    throw new PrivateTournamentChatError(error.message, 500, error.code ?? null)
  }

  return {
    chat: {
      id: chat.id,
      privateTournamentId: chat.private_tournament_id,
      title: chat.title,
      createdAt: chat.created_at,
      updatedAt: chat.updated_at,
    },
    messages: ((data ?? []) as MessageRow[]).reverse().map(serializeMessage),
    stickers: PRODE_CHAT_STICKERS,
    currentUserCanWrite: context.canWrite,
    currentUserCanModerate: context.canModerate,
  }
}

export async function createPrivateTournamentChatMessage({
  tournamentId,
  user,
  messageType,
  message,
  stickerId,
}: {
  tournamentId: string
  user: User
  messageType: 'text' | 'sticker'
  message?: string | null
  stickerId?: string | null
}) {
  const { context, chat } = await getChatByTournamentId(tournamentId, user.id)
  if (!context.canWrite) {
    throw new PrivateTournamentChatError('No tenés acceso a este chat.', 403)
  }

  const username = await resolveUsername(user)
  let payload:
    | {
        message_type: 'text'
        message: string
        sticker_id?: null
        sticker_url?: null
        sticker_label?: null
      }
    | {
        message_type: 'sticker'
        message?: null
        sticker_id: string
        sticker_url: string
        sticker_label: string
      }

  if (messageType === 'text') {
    const cleanMessage = cleanTextMessage(message)
    if (!cleanMessage) {
      throw new PrivateTournamentChatError('El mensaje no puede estar vacío.', 400)
    }

    payload = {
      message_type: 'text',
      message: cleanMessage,
      sticker_id: null,
      sticker_url: null,
      sticker_label: null,
    }
  } else {
    const sticker = getProdeChatSticker(stickerId)
    if (!sticker) throw new PrivateTournamentChatError('Sticker inválido.', 400)

    payload = {
      message_type: 'sticker',
      message: null,
      sticker_id: sticker.id,
      sticker_url: sticker.url,
      sticker_label: sticker.label,
    }
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('private_tournament_chat_messages')
    .insert({
      chat_id: chat.id,
      private_tournament_id: tournamentId,
      user_id: user.id,
      username,
      ...payload,
    })
    .select(
      'id, chat_id, private_tournament_id, user_id, username, message_type, message, sticker_id, sticker_url, sticker_label, created_at, edited_at, deleted_at'
    )
    .single()

  if (error) throw new PrivateTournamentChatError(error.message, 500, error.code ?? null)

  return serializeMessage(data as MessageRow)
}

export async function deletePrivateTournamentChatMessage({
  tournamentId,
  messageId,
  userId,
}: {
  tournamentId: string
  messageId: string
  userId: string
}) {
  const { context } = await getChatByTournamentId(tournamentId, userId)
  const supabase = getSupabaseAdminClient()
  const { data: message, error: messageError } = await supabase
    .from('private_tournament_chat_messages')
    .select('id, user_id, private_tournament_id, deleted_at')
    .eq('id', messageId)
    .eq('private_tournament_id', tournamentId)
    .maybeSingle()

  if (messageError) {
    throw new PrivateTournamentChatError(messageError.message, 500, messageError.code ?? null)
  }
  if (!message) throw new PrivateTournamentChatError('Mensaje no encontrado.', 404)
  if ((message as { user_id: string }).user_id !== userId && !context.canModerate) {
    throw new PrivateTournamentChatError('No podés borrar este mensaje.', 403)
  }

  const { error } = await supabase
    .from('private_tournament_chat_messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('private_tournament_id', tournamentId)

  if (error) throw new PrivateTournamentChatError(error.message, 500, error.code ?? null)

  return { ok: true }
}

export async function auditPrivateTournamentChats() {
  const supabase = getSupabaseAdminClient()
  const [
    tournamentsResponse,
    chatsResponse,
    messagesResponse,
    messageUsernameRowsResponse,
  ] = await Promise.all([
    supabase.from('prode_private_tournaments').select('id', { count: 'exact', head: true }),
    supabase
      .from('private_tournament_chats')
      .select('id, private_tournament_id', { count: 'exact' }),
    supabase
      .from('private_tournament_chat_messages')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('private_tournament_chat_messages')
      .select('id, username')
      .limit(5000),
  ])

  if (tournamentsResponse.error) throw tournamentsResponse.error
  if (chatsResponse.error) throw chatsResponse.error
  if (messagesResponse.error) throw messagesResponse.error
  if (messageUsernameRowsResponse.error) throw messageUsernameRowsResponse.error

  const chatRows = (chatsResponse.data ?? []) as Array<{
    id: string
    private_tournament_id: string | null
  }>
  const messageUsernameRows = (messageUsernameRowsResponse.data ?? []) as Array<{
    id: string
    username: string | null
  }>
  const orphanChats = chatRows.filter((chat) => !chat.private_tournament_id)
  const messagesMissingUsername = messageUsernameRows.filter(
    (message) => !message.username?.trim()
  ).length

  return {
    ok: true,
    tournamentsChecked: tournamentsResponse.count ?? 0,
    chatsFound: chatsResponse.count ?? chatRows.length,
    messagesCount: messagesResponse.count ?? 0,
    messagesMissingUsername,
    orphanChats: orphanChats.length,
    groupChatsStillRendered: false,
    warnings: orphanChats.length ? ['orphan_private_tournament_chats'] : [],
  }
}
