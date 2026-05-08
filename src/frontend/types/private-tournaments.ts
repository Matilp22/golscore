export type PrivateTournamentRole = 'owner' | 'member'
export type JoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export type PrivateTournamentSummary = {
  id: string
  name: string
  creatorName: string
  memberCount: number
  role: PrivateTournamentRole
  myPosition: number | null
  myPoints: number
  createdAt: string
}

export type PrivateTournamentSearchResult = {
  id: string
  name: string
  creatorName: string
  memberCount: number
  isMember: boolean
  requestStatus: JoinRequestStatus | null
  canRequest: boolean
}

export type PrivateTournamentRankingRow = {
  position: number
  userId: string
  username: string
  points: number
  exactHits: number
  partialHits: number
  playedPredictions: number
}

export type PrivateTournamentDetail = {
  id: string
  name: string
  creatorName: string
  currentUserRole: PrivateTournamentRole
  memberCount: number
  ranking: PrivateTournamentRankingRow[]
  members: Array<{
    id: string
    userId: string
    username: string
    role: PrivateTournamentRole
    joinedAt: string
  }>
  pendingRequests: Array<{
    id: string
    userId: string
    username: string
    requestedAt: string
  }>
}
