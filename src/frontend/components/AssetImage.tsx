'use client'

import SafeImage from '@/frontend/components/SafeImage'
import {
  getApiSportsPlayerPhotoUrl,
  pickLeagueLogoUrl,
  pickStableAssetUrl,
  pickTeamLogoUrl,
} from '@/shared/utils/asset-urls'

type AssetEntity = {
  id?: string | number | null
  external_id?: string | number | null
  externalId?: string | number | null
  name?: string | null
  logo_url?: string | null
  logoUrl?: string | null
  logo?: string | null
  photo_url?: string | null
  photoUrl?: string | null
  photo?: string | null
}

type AssetImageProps = {
  src?: string | null
  logoUrl?: string | null
  photoUrl?: string | null
  team?: AssetEntity | null
  league?: AssetEntity | null
  player?: AssetEntity | null
  alt: string
  size?: number
  className?: string
  fallbackClassName?: string
  priority?: boolean
  unoptimized?: boolean
}

function getExternalId(entity?: AssetEntity | null) {
  return entity?.external_id ?? entity?.externalId ?? entity?.id ?? null
}

function getAssetId(entity?: AssetEntity | null) {
  return entity?.external_id ?? entity?.externalId ?? entity?.id ?? null
}

export function TeamLogo({
  src,
  logoUrl,
  team,
  alt,
  size = 24,
  className,
  fallbackClassName,
  priority,
  unoptimized,
}: AssetImageProps) {
  const externalId = getExternalId(team)
  const source = pickTeamLogoUrl(
    team?.logo_url,
    externalId,
    team?.logoUrl ?? logoUrl ?? src ?? team?.logo
  )
  const receivedProps = {
    logo_url: team?.logo_url ?? null,
    logoUrl: team?.logoUrl ?? logoUrl ?? null,
    logo: team?.logo ?? src ?? null,
  }

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <SafeImage
        src={source}
        alt={alt}
        imageType="team"
        width={size}
        height={size}
        className={className ?? 'h-full w-full object-contain'}
        fallbackClassName={fallbackClassName ?? 'h-[80%] w-[68%]'}
        assetId={getAssetId(team)}
        expectedSrc={team?.logo_url ?? logoUrl ?? src ?? null}
        receivedProps={receivedProps}
        priority={priority}
        unoptimized={unoptimized ?? true}
      />
    </span>
  )
}

export function LeagueLogo({
  src,
  logoUrl,
  league,
  alt,
  size = 24,
  className,
  fallbackClassName,
  priority,
  unoptimized,
}: AssetImageProps) {
  const externalId = getExternalId(league)
  const source = pickLeagueLogoUrl(
    league?.logo_url,
    externalId,
    league?.logoUrl ?? logoUrl ?? src ?? league?.logo
  )
  const receivedProps = {
    logo_url: league?.logo_url ?? null,
    logoUrl: league?.logoUrl ?? logoUrl ?? null,
    logo: league?.logo ?? src ?? null,
  }

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <SafeImage
        src={source}
        alt={alt}
        imageType="league"
        width={size}
        height={size}
        className={className ?? 'h-full w-full object-contain'}
        fallbackClassName={fallbackClassName ?? 'h-[80%] w-[68%]'}
        assetId={getAssetId(league)}
        expectedSrc={league?.logo_url ?? logoUrl ?? src ?? null}
        receivedProps={receivedProps}
        priority={priority}
        unoptimized={unoptimized ?? true}
      />
    </span>
  )
}

export function PlayerPhoto({
  src,
  photoUrl,
  player,
  alt,
  size = 40,
  className,
  fallbackClassName,
  priority,
  unoptimized,
}: AssetImageProps) {
  const externalId = getExternalId(player)
  const source = pickStableAssetUrl(
    player?.photo_url,
    player?.photoUrl ?? photoUrl ?? src ?? player?.photo,
    getApiSportsPlayerPhotoUrl(externalId)
  )
  const receivedProps = {
    photo_url: player?.photo_url ?? null,
    photoUrl: player?.photoUrl ?? photoUrl ?? null,
    photo: player?.photo ?? src ?? null,
  }

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/8 bg-[#121d1a]"
      style={{ width: size, height: size }}
    >
      <SafeImage
        src={source}
        alt={alt}
        imageType="player"
        width={size}
        height={size}
        className={className ?? 'h-full w-full rounded-full object-cover'}
        fallbackClassName={fallbackClassName ?? 'h-full w-full rounded-full'}
        assetId={getAssetId(player)}
        expectedSrc={player?.photo_url ?? photoUrl ?? src ?? null}
        receivedProps={receivedProps}
        priority={priority}
        unoptimized={unoptimized}
      />
    </span>
  )
}
