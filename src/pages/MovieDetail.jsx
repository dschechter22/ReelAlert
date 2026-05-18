import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useMovies, useWatchlist } from '../hooks/useMovies'
import { useRatings } from '../contexts/RatingsContext'
import { getMovieDetails, posterUrl } from '../lib/tmdb'
import { fetchOMDbRatings } from '../lib/omdb'
import { computeReelScore } from '../lib/reelScore'
import { ArrowLeft, Bookmark, BookmarkCheck, ExternalLink, ThumbsUp, ThumbsDown, Eye, MinusCircle, RefreshCw } from 'lucide-react'
import BucketBadge from '../components/BucketBadge'
import TabBar from '../components/TabBar'
import StreamingBadges from '../components/StreamingBadges'
import RatingButtons from '../components/RatingButtons'

const RATING_BADGE = {
  liked:          { label: 'You liked this',   Icon: ThumbsUp,    color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  disliked:       { label: 'You disliked this', Icon: ThumbsDown, color: 'text-red-400',      bg: 'bg-red-500/10 border-red-500/20' },
  seen:           { label: "You've seen this",  Icon: Eye,         color: 'text-accent',       bg: 'bg-accent/10 border-accent/20' },
  not_interested: { label: 'Not for you',       Icon: MinusCircle, color: 'text-text-secondary', bg: 'bg-surface border-accent-secondary/20' },
}

const SOURCE_LABELS = { imdb: 'IMDb', rt_critic: 'RT Critic', letterboxd: 'Letterboxd' }

// Extract a numeric TMDB id from route params like "tmdb-12345" or "12345"
function parseTmdbId(id) {
  if (!id) return null
  const s = String(id).replace(/^tmdb-/, '')
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

export default function MovieDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { movies } = useMovies(user?.id)
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist(user?.id)
  const { getRating, tasteProfile } = useRatings()

  const [fetchedMovie, setFetchedMovie] = useState(null)
  const [fetchLoading, setFetchLoading] = useState(false)
  const [fetchError, setFetchError] = useState(false)

  // Try the preloaded list first
  const preloaded = movies.find((m) => m.id === id || String(m.tmdb_id) === id)

  const tmdbId = parseTmdbId(id)

  // If not in the preloaded list, fetch directly from TMDB
  useEffect(() => {
    if (preloaded || !tmdbId) return
    let cancelled = false
    async function load() {
      setFetchLoading(true)
      setFetchError(false)
      try {
        const detail = await getMovieDetails(tmdbId)
        const omdb = await fetchOMDbRatings(detail.imdb_id).catch(() => null)
        const director = detail.credits?.crew?.find((c) => c.job === 'Director') || null
        const cast = (detail.credits?.cast || []).slice(0, 10).map((c) => ({ id: c.id, name: c.name }))
        const trailer = detail.videos?.results?.find((v) => v.type === 'Trailer' && v.site === 'YouTube')
        const keywords = (detail.keywords?.keywords || []).map((k) => k.name)

        const base = {
          id: `tmdb-${detail.id}`,
          tmdb_id: detail.id,
          imdb_id: detail.imdb_id || null,
          title: detail.title,
          synopsis: detail.overview,
          poster_path: detail.poster_path,
          backdrop_path: detail.backdrop_path,
          release_date: detail.release_date,
          genres: (detail.genres || []).map((g) => ({ id: g.id, name: g.name })),
          keywords,
          cast,
          director: director ? { id: director.id, name: director.name } : null,
          trailer_url: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
          imdb_score: omdb?.imdb_score ?? null,
          rt_critic: omdb?.rt_critic ?? null,
          letterboxd_score: omdb?.letterboxd_score ?? null,
        }
        const scored = { ...base, ...computeReelScore(base, { tasteProfile }) }
        if (!cancelled) setFetchedMovie(scored)
      } catch {
        if (!cancelled) setFetchError(true)
      } finally {
        if (!cancelled) setFetchLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [tmdbId, preloaded])

  // Loading state
  if (fetchLoading || (!preloaded && !fetchedMovie && !fetchError && tmdbId)) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <RefreshCw size={24} className="text-accent animate-spin" />
      </div>
    )
  }

  const movie = preloaded || fetchedMovie

  if (!movie) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <p className="font-heading text-text text-xl mb-3">Movie not found</p>
          <button onClick={() => navigate(-1)} className="text-accent font-body text-sm hover:underline">
            Go back
          </button>
        </div>
      </div>
    )
  }

  const { title, synopsis, genres, cast, director, bucket, score, breakdown, trailer_url,
    release_date, posterGradient, poster_path } = movie
  const posterBg = posterGradient || 'from-gray-800 via-gray-700 to-gray-900'
  const inWatchlist = isInWatchlist(movie.id)

  function toggleWatchlist() {
    inWatchlist ? removeFromWatchlist(movie.id) : addToWatchlist(movie.id)
  }

  return (
    <div className="min-h-screen bg-bg pb-28">
      {/* Hero poster */}
      <div className="relative h-64 sm:h-80">
        {poster_path ? (
          <img
            src={`https://image.tmdb.org/t/p/w780${poster_path}`}
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${posterBg}`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-transparent" />

        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 p-2 rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>

        <button
          onClick={toggleWatchlist}
          className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-colors"
        >
          {inWatchlist ? <BookmarkCheck size={20} className="text-accent" /> : <Bookmark size={20} />}
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-6 relative">
        {/* Title block */}
        <div className="mb-4">
          <BucketBadge bucket={bucket} className="mb-3" />
          <h1 className="font-heading font-bold text-text text-3xl leading-tight mb-2">{title}</h1>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-baseline gap-2">
              <span className="text-accent font-heading font-bold text-4xl">{score}</span>
              <span className="text-text-secondary font-body">/100 ReelScore</span>
            </div>
            {(() => {
              const userRating = getRating(movie.tmdb_id)
              const badge = userRating ? RATING_BADGE[userRating] : null
              if (!badge) return null
              const { label, Icon, color, bg } = badge
              return (
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-body font-medium border ${color} ${bg}`}>
                  <Icon size={11} />
                  {label}
                </span>
              )
            })()}
          </div>
          <div className="flex flex-wrap gap-2">
            {(genres || []).map((g) => (
              <span key={typeof g === 'object' ? g.id : g}
                className="px-2.5 py-0.5 bg-surface rounded-full text-xs text-text-secondary border border-accent-secondary/20 font-body">
                {typeof g === 'object' ? g.name : g}
              </span>
            ))}
          </div>
        </div>

        {/* Rating */}
        <div className="mb-6">
          <h2 className="font-heading font-semibold text-text text-lg mb-3">Rate This Film</h2>
          <RatingButtons movie={movie} />
        </div>

        {/* Synopsis */}
        {synopsis && (
          <div className="mb-6">
            <h2 className="font-heading font-semibold text-text text-lg mb-2">Synopsis</h2>
            <p className="text-text-secondary font-body text-sm leading-relaxed">{synopsis}</p>
          </div>
        )}

        {/* Score breakdown */}
        <div className="mb-6">
          <h2 className="font-heading font-semibold text-text text-lg mb-3">Score Breakdown</h2>
          <div className="bg-surface rounded-2xl px-4 py-1">
            <div className="flex justify-between py-3 border-b border-accent-secondary/10">
              <div>
                <span className="text-text font-body text-sm">Base score</span>
                {breakdown?.weightPct && (
                  <span className="ml-2 text-text-secondary font-body text-xs">
                    IMDb {breakdown.weightPct.imdb}% · RT {breakdown.weightPct.rt}% · LB {breakdown.weightPct.lb}%
                  </span>
                )}
              </div>
              <span className="text-text font-body text-sm font-semibold">{breakdown?.baseScore ?? score}/100</span>
            </div>
            {breakdown?.hasMustSeeGenre && (
              <div className="flex justify-between py-3 border-b border-accent-secondary/10">
                <span className="text-emerald-400 font-body text-sm">Must-See Genre boost</span>
                <span className="text-emerald-400 font-body text-sm font-semibold">+10</span>
              </div>
            )}
            {breakdown?.hasFavoritePerson && (
              <div className="flex justify-between py-3 border-b border-accent-secondary/10">
                <span className="text-pink-400 font-body text-sm">Favorite person boost</span>
                <span className="text-pink-400 font-body text-sm font-semibold">+15</span>
              </div>
            )}
            {breakdown?.hasNeverGenre && (
              <div className="flex justify-between py-3 border-b border-accent-secondary/10">
                <span className="text-red-400 font-body text-sm">Excluded genre penalty</span>
                <span className="text-red-400 font-body text-sm font-semibold">−25</span>
              </div>
            )}
            {breakdown?.hasExcludedPerson && (
              <div className="flex justify-between py-3 border-b border-accent-secondary/10">
                <span className="text-red-400 font-body text-sm">Excluded person penalty</span>
                <span className="text-red-400 font-body text-sm font-semibold">−30</span>
              </div>
            )}
            {!!breakdown?.tasteBonus && (
              <div className="flex justify-between py-3 border-b border-accent-secondary/10">
                <span className={breakdown.tasteBonus > 0 ? 'text-emerald-400 font-body text-sm' : 'text-red-400 font-body text-sm'}>
                  Taste profile {breakdown.tasteBonus > 0 ? 'boost' : 'penalty'}
                </span>
                <span className={breakdown.tasteBonus > 0 ? 'text-emerald-400 font-body text-sm font-semibold' : 'text-red-400 font-body text-sm font-semibold'}>
                  {breakdown.tasteBonus > 0 ? `+${breakdown.tasteBonus}` : breakdown.tasteBonus}
                </span>
              </div>
            )}
            <div className="flex justify-between py-3">
              <span className="text-text font-body text-sm font-semibold">ReelScore</span>
              <span className="text-accent font-heading font-bold text-base">{score}/100</span>
            </div>
          </div>
        </div>

        {/* All scores */}
        <div className="mb-6">
          <h2 className="font-heading font-semibold text-text text-lg mb-3">All Scores</h2>
          <div className="bg-surface rounded-2xl px-4 py-1">
            {Object.entries(breakdown?.sources || SOURCE_LABELS).map(([source, data]) => (
              <div key={source} className="flex justify-between py-3 border-b border-accent-secondary/10 last:border-0">
                <span className="text-text font-body text-sm">{SOURCE_LABELS[source] || source}</span>
                <span className={`font-body text-sm font-semibold ${data?.value != null ? 'text-text' : 'text-text-secondary/40'}`}>
                  {data?.displayValue ?? 'N/A'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Cast & crew */}
        {(cast?.length > 0 || director) && (
          <div className="mb-6">
            <h2 className="font-heading font-semibold text-text text-lg mb-3">Cast & Crew</h2>
            <div className="bg-surface rounded-2xl px-4 py-1">
              {director && (
                <div className="flex justify-between py-3 border-b border-accent-secondary/10">
                  <span className="text-text-secondary font-body text-sm">Director</span>
                  <span className="text-text font-body text-sm">{director.name || director}</span>
                </div>
              )}
              {(cast || []).slice(0, 5).map((c, i) => (
                <div key={c.id || i} className="flex justify-between py-3 border-b border-accent-secondary/10 last:border-0">
                  <span className="text-text-secondary font-body text-sm">Cast</span>
                  <span className="text-text font-body text-sm">{c.name || c}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Streaming */}
        <div className="mb-6">
          <h2 className="font-heading font-semibold text-text text-lg mb-3">Where to Watch</h2>
          <div className="bg-surface rounded-2xl px-4 py-4">
            <StreamingBadges tmdbId={movie.tmdb_id} />
          </div>
        </div>

        {release_date && (
          <p className="text-text-secondary font-body text-sm mb-4">
            Released: {new Date(release_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        )}

        {trailer_url && (
          <a
            href={trailer_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 bg-accent text-white rounded-xl font-body font-medium text-sm hover:opacity-90 transition-opacity"
          >
            Watch Trailer <ExternalLink size={15} />
          </a>
        )}
      </div>

      <TabBar />
    </div>
  )
}
