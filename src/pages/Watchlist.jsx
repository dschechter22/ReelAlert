import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useMovies, useWatchlist } from '../hooks/useMovies'
import TabBar from '../components/TabBar'
import BucketBadge from '../components/BucketBadge'
import { Bookmark, Trash2, ChevronRight } from 'lucide-react'
import { MOCK_MOVIES } from '../lib/mockData'

export default function Watchlist() {
  const { user } = useAuth()
  const { movies } = useMovies(user?.id)
  const { watchlist, loading, removeFromWatchlist } = useWatchlist(user?.id)
  const navigate = useNavigate()

  // Map watchlist entries to full movie objects
  const watchlistMovies = watchlist
    .map((entry) => {
      const movie = movies.find((m) => m.id === entry.movie_id) ||
                    MOCK_MOVIES.find((m) => m.id === entry.movie_id)
      return movie ? { ...movie, added_at: entry.added_at } : null
    })
    .filter(Boolean)

  // Demo: show a static list if watchlist is empty (so page isn't blank)
  const displayMovies = watchlistMovies.length > 0 ? watchlistMovies : []

  return (
    <div className="min-h-screen bg-bg pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-accent-secondary/15 px-4 py-4 pt-safe"
        style={{ background: 'rgb(var(--color-bg) / 0.9)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-2xl mx-auto">
          <h1 className="font-heading font-bold text-text text-xl">Watchlist</h1>
          {displayMovies.length > 0 && (
            <p className="text-text-secondary text-xs font-body mt-0.5">
              {displayMovies.length} saved film{displayMovies.length !== 1 ? 's' : ''}
            </p>
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
        ) : displayMovies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface border border-accent-secondary/20 flex items-center justify-center">
              <Bookmark size={28} className="text-text-secondary" />
            </div>
            <div>
              <h2 className="font-heading font-semibold text-text text-xl mb-2">Your watchlist is empty</h2>
              <p className="text-text-secondary font-body text-sm max-w-xs">
                Browse movies on the dashboard and tap the bookmark icon to save them here.
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2.5 bg-accent text-white rounded-xl font-body font-medium text-sm hover:opacity-90 transition-opacity"
            >
              Browse movies
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {displayMovies.map((movie) => (
              <div key={movie.id} className="bg-surface rounded-2xl overflow-hidden flex gap-0">
                {/* Poster */}
                <button
                  onClick={() => navigate(`/movie/${movie.id}`)}
                  className="flex-shrink-0 w-20"
                >
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

                {/* Content */}
                <div className="flex-1 p-3 flex flex-col justify-between">
                  <div>
                    <h3 className="font-heading font-semibold text-text text-sm leading-tight mb-1.5">{movie.title}</h3>
                    {movie.bucket && <BucketBadge bucket={movie.bucket} className="mb-1.5" />}
                    <div className="flex flex-wrap gap-1">
                      {(movie.genres || []).slice(0, 2).map((g) => (
                        <span key={typeof g === 'object' ? g.id : g}
                          className="px-2 py-0.5 bg-bg rounded-full text-xs text-text-secondary border border-accent-secondary/15 font-body">
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => removeFromWatchlist(movie.id)}
                        className="p-1.5 rounded-lg text-text-secondary hover:text-red-400 transition-colors"
                        aria-label="Remove from watchlist"
                      >
                        <Trash2 size={15} />
                      </button>
                      <button
                        onClick={() => navigate(`/movie/${movie.id}`)}
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
        )}
      </main>

      <TabBar />
    </div>
  )
}
