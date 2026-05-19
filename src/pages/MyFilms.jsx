import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useRatings } from '../contexts/RatingsContext'
import { useMovies, useWatchlist } from '../hooks/useMovies'
import TabBar from '../components/TabBar'
import { Bookmark, Trash2, ChevronRight, ThumbsUp, ThumbsDown, Eye, MinusCircle, BarChart3 } from 'lucide-react'
import { MOCK_MOVIES } from '../lib/mockData'
import { TMDB_GENRES } from '../lib/tmdb'

const GENRE_MAP = Object.fromEntries(TMDB_GENRES.map((g) => [g.id, g.name]))

const RATING_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'liked', label: 'Liked' },
  { value: 'disliked', label: 'Disliked' },
  { value: 'seen', label: 'Seen' },
  { value: 'not_interested', label: 'Not Interested' },
]

const RATING_META = {
  liked: { label: 'Liked', icon: ThumbsUp, color: 'text-emerald-400' },
  disliked: { label: 'Disliked', icon: ThumbsDown, color: 'text-red-400' },
  seen: { label: 'Seen', icon: Eye, color: 'text-accent' },
  not_interested: { label: 'Not Interested', icon: MinusCircle, color: 'text-text-secondary' },
}

export default function MyFilms() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { movies } = useMovies(user?.id)
  const { watchlist, loading: watchlistLoading, removeFromWatchlist } = useWatchlist(user?.id)
  const { ratingRows, removeRating, loading: ratingsLoading } = useRatings()

  const [segment, setSegment] = useState('watchlist')
  const [ratingFilter, setRatingFilter] = useState('all')

  // --- Watchlist segment ---
  const watchlistMovies = watchlist
    .map((entry) => {
      const movie = movies.find((m) => m.id === entry.movie_id) ||
                    MOCK_MOVIES.find((m) => m.id === entry.movie_id)
      return movie ? { ...movie, added_at: entry.added_at } : null
    })
    .filter(Boolean)

  // --- Rated segment ---
  const filteredRated = ratingFilter === 'all'
    ? ratingRows
    : ratingRows.filter((r) => r.rating === ratingFilter)

  const sortedRated = [...filteredRated].sort(
    (a, b) => new Date(b.rated_at) - new Date(a.rated_at)
  )

  const loading = segment === 'watchlist' ? watchlistLoading : ratingsLoading

  return (
    <div className="min-h-screen bg-bg pb-24">
      {/* Header */}
      <header
        className="sticky top-0 z-20 border-b border-accent-secondary/15 px-4 pt-safe"
        style={{ background: 'rgb(var(--color-bg) / 0.9)', backdropFilter: 'blur(12px)' }}
      >
        <div className="max-w-2xl mx-auto">
          <div className="py-4">
            <h1 className="font-heading font-bold text-text text-xl">My Films</h1>
          </div>

          {/* Segment tabs */}
          <div className="flex gap-1 mb-3 bg-surface rounded-xl p-1 border border-accent-secondary/15">
            {['watchlist', 'rated'].map((seg) => (
              <button
                key={seg}
                onClick={() => setSegment(seg)}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium font-body transition-colors capitalize ${
                  segment === seg
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:text-text'
                }`}
              >
                {seg === 'watchlist' ? `Watchlist${watchlistMovies.length ? ` (${watchlistMovies.length})` : ''}` : `Rated${ratingRows.length ? ` (${ratingRows.length})` : ''}`}
              </button>
            ))}
          </div>

          {/* Rating filter chips — only in Rated segment */}
          {segment === 'rated' && (
            <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
              {RATING_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setRatingFilter(f.value)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium font-body transition-colors border ${
                    ratingFilter === f.value
                      ? 'bg-accent text-white border-accent'
                      : 'bg-surface text-text-secondary border-accent-secondary/20 hover:border-accent/40'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface rounded-2xl h-24 animate-pulse" />
            ))}
          </div>
        ) : segment === 'watchlist' ? (
          <WatchlistContent
            movies={watchlistMovies}
            onRemove={removeFromWatchlist}
            onNavigate={(id) => navigate(`/movie/${id}`)}
            onBrowse={() => navigate('/dashboard')}
          />
        ) : (
            <>
            {ratingRows.length > 0 && (
              <button
                onClick={() => navigate('/stats')}
                className="w-full mb-4 flex items-center justify-between px-4 py-3 bg-surface rounded-2xl border border-accent-secondary/15 hover:border-accent/40 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <BarChart3 size={18} className="text-accent" />
                  <span className="font-body font-medium text-text text-sm">View Taste Stats</span>
                </div>
                <ChevronRight size={16} className="text-text-secondary group-hover:text-text transition-colors" />
              </button>
            )}
            <RatedContent
              rows={sortedRated}
              allCount={ratingRows.length}
              onRemove={removeRating}
              onNavigate={(tmdbId) => navigate(`/movie/tmdb-${tmdbId}`)}
            />
          </>
        )}
      </main>

      <TabBar />
    </div>
  )
}

function WatchlistContent({ movies, onRemove, onNavigate, onBrowse }) {
  if (movies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface border border-accent-secondary/20 flex items-center justify-center">
          <Bookmark size={28} className="text-text-secondary" />
        </div>
        <div>
          <h2 className="font-heading font-semibold text-text text-xl mb-2">Your watchlist is empty</h2>
          <p className="text-text-secondary font-body text-sm max-w-xs">
            Browse movies and tap the bookmark icon to save them here.
          </p>
        </div>
        <button
          onClick={onBrowse}
          className="px-6 py-2.5 bg-accent text-white rounded-xl font-body font-medium text-sm hover:opacity-90 transition-opacity"
        >
          Browse movies
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {movies.map((movie) => (
        <div key={movie.id} className="bg-surface rounded-2xl overflow-hidden flex">
          <button onClick={() => onNavigate(movie.id)} className="flex-shrink-0 w-20">
            {movie.poster_path ? (
              <img
                src={`https://image.tmdb.org/t/p/w185${movie.poster_path}`}
                alt={movie.title}
                className="w-20 h-28 object-cover"
              />
            ) : (
              <div className={`w-20 h-28 bg-gradient-to-br ${movie.posterGradient || 'from-gray-800 to-gray-900'}`} />
            )}
          </button>

          <div className="flex-1 p-3 flex flex-col justify-between">
            <div>
              <h3 className="font-heading font-semibold text-text text-sm leading-tight mb-1">
                {movie.title}
              </h3>
              {movie.release_date && (
                <p className="text-text-secondary text-xs font-body mb-1.5">
                  {movie.release_date.slice(0, 4)}
                </p>
              )}
              <div className="flex flex-wrap gap-1">
                {(movie.genres || []).slice(0, 2).map((g) => (
                  <span
                    key={typeof g === 'object' ? g.id : g}
                    className="px-2 py-0.5 bg-bg rounded-full text-xs text-text-secondary border border-accent-secondary/15 font-body"
                  >
                    {typeof g === 'object' ? g.name : g}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mt-2">
              {movie.score != null && (
                <div className="flex items-baseline gap-0.5">
                  <span className="text-accent font-heading font-bold text-base">{movie.score}</span>
                  <span className="text-text-secondary text-xs font-body">/100</span>
                </div>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => onRemove(movie.id)}
                  className="p-1.5 rounded-lg text-text-secondary hover:text-red-400 transition-colors"
                  aria-label="Remove from watchlist"
                >
                  <Trash2 size={15} />
                </button>
                <button
                  onClick={() => onNavigate(movie.id)}
                  className="flex items-center gap-1 text-accent text-xs font-body hover:opacity-80"
                >
                  Details <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function RatedContent({ rows, allCount, onRemove, onNavigate }) {
  if (allCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface border border-accent-secondary/20 flex items-center justify-center">
          <ThumbsUp size={28} className="text-text-secondary" />
        </div>
        <div>
          <h2 className="font-heading font-semibold text-text text-xl mb-2">No rated films yet</h2>
          <p className="text-text-secondary font-body text-sm max-w-xs">
            Rate movies from the dashboard or import your Letterboxd history in Settings.
          </p>
        </div>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-text-secondary font-body text-sm">No films match this filter.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const meta = RATING_META[row.rating]
        const Icon = meta?.icon
        return (
          <div key={`${row.tmdb_id}`} className="bg-surface rounded-2xl overflow-hidden flex">
            {/* Poster */}
            <button onClick={() => onNavigate(row.tmdb_id)} className="flex-shrink-0 w-20">
              {row.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w185${row.poster_path}`}
                  alt={row.title}
                  className="w-20 h-28 object-cover"
                />
              ) : (
                <div className="w-20 h-28 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                  <span className="text-text-secondary text-2xl">🎬</span>
                </div>
              )}
            </button>

            {/* Content */}
            <div className="flex-1 p-3 flex flex-col justify-between">
              <div>
                <h3 className="font-heading font-semibold text-text text-sm leading-tight mb-1">
                  {row.title}
                </h3>
                {row.rated_at && (
                  <p className="text-text-secondary text-xs font-body mb-2">
                    {new Date(row.rated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
                {meta && (
                  <div className={`inline-flex items-center gap-1 text-xs font-body font-medium ${meta.color}`}>
                    {Icon && <Icon size={13} />}
                    {meta.label}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-2">
                <div className="flex flex-wrap gap-1">
                  {(row.genre_ids || []).slice(0, 2).map((id) => (
                    <span
                      key={id}
                      className="px-2 py-0.5 bg-bg rounded-full text-xs text-text-secondary border border-accent-secondary/15 font-body"
                    >
                      {GENRE_MAP[id] || id}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onRemove(row.tmdb_id)}
                    className="p-1.5 rounded-lg text-text-secondary hover:text-red-400 transition-colors"
                    aria-label="Remove rating"
                  >
                    <Trash2 size={15} />
                  </button>
                  <button
                    onClick={() => onNavigate(row.tmdb_id)}
                    className="flex items-center gap-1 text-accent text-xs font-body hover:opacity-80"
                  >
                    Details <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
