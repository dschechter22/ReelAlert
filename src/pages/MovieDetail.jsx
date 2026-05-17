import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useMovies, useWatchlist } from '../hooks/useMovies'
import { ArrowLeft, Bookmark, BookmarkCheck, ExternalLink, Check, X } from 'lucide-react'
import BucketBadge from '../components/BucketBadge'
import TabBar from '../components/TabBar'

const SOURCE_LABELS = {
  tmdb: 'TMDB',
  rt_critic: 'RT Critic',
  rt_audience: 'RT Audience',
  letterboxd: 'Letterboxd',
}

function ScoreRow({ source, data }) {
  if (!data) return null
  return (
    <div className="flex items-center justify-between py-3 border-b border-accent-secondary/10 last:border-0">
      <div className="flex items-center gap-2.5">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${data.passed ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
          {data.passed
            ? <Check size={11} className="text-emerald-400" />
            : <X size={11} className="text-red-400" />
          }
        </div>
        <span className="font-body text-sm text-text">{SOURCE_LABELS[source] || source}</span>
      </div>
      <div className="text-right">
        <span className={`font-body text-sm font-semibold ${data.passed ? 'text-text' : 'text-text-secondary'}`}>
          {data.actual ?? 'N/A'}
        </span>
        {data.required != null && (
          <span className="text-text-secondary text-xs font-body ml-1.5">min {data.required}</span>
        )}
      </div>
    </div>
  )
}

export default function MovieDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { movies } = useMovies(user?.id)
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist(user?.id)

  const movie = movies.find((m) => m.id === id || String(m.tmdb_id) === id)

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

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 p-2 rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>

        {/* Watchlist button */}
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
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-accent font-heading font-bold text-4xl">{score}</span>
            <span className="text-text-secondary font-body">/100 ReelScore</span>
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

        {/* Synopsis */}
        {synopsis && (
          <div className="mb-6">
            <h2 className="font-heading font-semibold text-text text-lg mb-2">Synopsis</h2>
            <p className="text-text-secondary font-body text-sm leading-relaxed">{synopsis}</p>
          </div>
        )}

        {/* Rating breakdown */}
        <div className="mb-6">
          <h2 className="font-heading font-semibold text-text text-lg mb-3">Rating Breakdown</h2>
          <div className="bg-surface rounded-2xl px-4 py-1">
            {Object.entries(breakdown?.globalThresholds || {}).map(([source, data]) => (
              <ScoreRow key={source} source={source} data={data} />
            ))}
            {Object.keys(breakdown?.globalThresholds || {}).length === 0 && (
              <p className="text-text-secondary text-sm font-body py-3 text-center">
                No thresholds set. Configure them in Settings.
              </p>
            )}
          </div>
        </div>

        {/* All scores */}
        <div className="mb-6">
          <h2 className="font-heading font-semibold text-text text-lg mb-3">All Scores</h2>
          <div className="bg-surface rounded-2xl px-4 py-1">
            {Object.entries(breakdown?.sources || {}).map(([source, data]) => (
              <div key={source} className="flex justify-between py-3 border-b border-accent-secondary/10 last:border-0">
                <span className="text-text font-body text-sm">{SOURCE_LABELS[source] || source}</span>
                <span className="text-text font-body text-sm font-semibold">{data.displayValue}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Flags */}
        {(breakdown?.hasMustSeeGenre || breakdown?.hasFavoritePerson || breakdown?.hasNeverGenre || breakdown?.hasExcludedPerson) && (
          <div className="mb-6">
            <h2 className="font-heading font-semibold text-text text-lg mb-3">Personalization Flags</h2>
            <div className="bg-surface rounded-2xl p-4 space-y-2">
              {breakdown.hasMustSeeGenre && <p className="text-emerald-400 text-sm font-body">✓ Contains a Must-See genre for you</p>}
              {breakdown.hasFavoritePerson && <p className="text-pink-400 text-sm font-body">✓ Features someone on your favorites list</p>}
              {breakdown.hasNeverGenre && <p className="text-red-400 text-sm font-body">✗ Contains a genre you've excluded</p>}
              {breakdown.hasExcludedPerson && <p className="text-red-400 text-sm font-body">✗ Features someone on your exclusion list</p>}
            </div>
          </div>
        )}

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

        {/* Release */}
        {release_date && (
          <p className="text-text-secondary font-body text-sm mb-4">
            Released: {new Date(release_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        )}

        {/* Trailer */}
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
