import { useState, useEffect } from 'react'
import { Tv } from 'lucide-react'
import { getWatchProviders } from '../lib/tmdb'

const _cache = new Map()

async function fetchProviders(tmdbId) {
  if (_cache.has(tmdbId)) return _cache.get(tmdbId)
  const data = await getWatchProviders(tmdbId)
  _cache.set(tmdbId, data)
  return data
}

export default function StreamingBadges({ tmdbId, compact = false }) {
  const [providers, setProviders] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tmdbId) { setLoading(false); return }
    fetchProviders(tmdbId)
      .then(setProviders)
      .catch(() => setProviders(null))
      .finally(() => setLoading(false))
  }, [tmdbId])

  if (loading) return null

  const streaming = providers?.flatrate || []
  const rent = providers?.rent || []
  const buy = providers?.buy || []
  const hasAny = streaming.length > 0 || rent.length > 0 || buy.length > 0

  if (!hasAny) {
    if (compact) return null
    return (
      <div className="flex items-center gap-1.5 text-text-secondary/50">
        <Tv size={13} />
        <span className="font-body text-xs">Not available to stream</span>
      </div>
    )
  }

  if (compact) {
    // Just show logos of streaming providers (subscription only)
    if (!streaming.length) return null
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {streaming.slice(0, 4).map((p) => (
          <ProviderLogo key={p.provider_id} provider={p} size={20} />
        ))}
        {streaming.length > 4 && (
          <span className="text-text-secondary/50 text-xs font-body">+{streaming.length - 4}</span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {streaming.length > 0 && (
        <ProviderRow label="Stream" providers={streaming} labelColor="text-emerald-400" />
      )}
      {rent.length > 0 && (
        <ProviderRow label="Rent" providers={rent} labelColor="text-accent" />
      )}
      {buy.length > 0 && (
        <ProviderRow label="Buy" providers={buy} labelColor="text-text-secondary" />
      )}
      <p className="text-text-secondary/40 font-body text-xs">Availability via JustWatch</p>
    </div>
  )
}

function ProviderRow({ label, providers, labelColor }) {
  return (
    <div>
      <p className={`font-body text-xs font-medium mb-1.5 ${labelColor}`}>{label}</p>
      <div className="flex flex-wrap gap-2">
        {providers.slice(0, 6).map((p) => (
          <div key={p.provider_id} className="flex items-center gap-1.5">
            <ProviderLogo provider={p} size={28} />
            <span className="text-text-secondary font-body text-xs">{p.provider_name}</span>
          </div>
        ))}
        {providers.length > 6 && (
          <span className="text-text-secondary/50 text-xs font-body self-center">+{providers.length - 6} more</span>
        )}
      </div>
    </div>
  )
}

function ProviderLogo({ provider, size }) {
  return (
    <img
      src={`https://image.tmdb.org/t/p/original${provider.logo_path}`}
      alt={provider.provider_name}
      title={provider.provider_name}
      width={size}
      height={size}
      className="rounded-md object-cover"
      style={{ width: size, height: size }}
    />
  )
}
