import { ChevronRight, Bookmark, BookmarkCheck } from 'lucide-react'
import BucketBadge from './BucketBadge'

export default function MovieCard({ movie, onOpenDrawer, onWatchlistToggle, inWatchlist }) {
  const { title, genres, score, bucket, posterGradient, poster_path, imdb_score, rt_critic, letterboxd_score } = movie

  const posterBg = poster_path
    ? null
    : posterGradient || 'from-gray-800 via-gray-700 to-gray-900'

  return (
    <div className="bg-surface rounded-2xl overflow-hidden flex gap-0 shadow-sm hover:shadow-md transition-shadow duration-200">
      {/* Poster */}
      <button
        className="flex-shrink-0 w-24 relative"
        onClick={() => onOpenDrawer?.(movie)}
        aria-label={`View details for ${title}`}
      >
        {poster_path ? (
          <img
            src={`https://image.tmdb.org/t/p/w185${poster_path}`}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className={`w-24 h-36 bg-gradient-to-br ${posterBg} flex items-end justify-start p-2`}>
            <span className="text-white/30 text-xs font-heading italic leading-tight line-clamp-2">
              {title}
            </span>
          </div>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
        <div>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="font-heading font-semibold text-text text-base leading-tight line-clamp-2 flex-1">
              {title}
            </h3>
            <button
              onClick={() => onWatchlistToggle?.(movie)}
              className="flex-shrink-0 text-text-secondary hover:text-accent transition-colors p-0.5"
              aria-label={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
            >
              {inWatchlist
                ? <BookmarkCheck size={18} className="text-accent" />
                : <Bookmark size={18} />
              }
            </button>
          </div>

          <BucketBadge bucket={bucket} className="mb-2" />

          {/* Source scores */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {imdb_score != null && (
              <span className="text-xs font-body text-text-secondary">
                <span className="text-text-secondary/60">IMDb</span> {imdb_score}
              </span>
            )}
            {rt_critic != null && (
              <span className="text-xs font-body text-text-secondary">
                {imdb_score != null && <span className="mr-1.5 text-text-secondary/30">·</span>}
                <span className="text-text-secondary/60">RT</span> {rt_critic}%
              </span>
            )}
            {letterboxd_score != null && (
              <span className="text-xs font-body text-text-secondary">
                {(imdb_score != null || rt_critic != null) && <span className="mr-1.5 text-text-secondary/30">·</span>}
                <span className="text-text-secondary/60">LB</span> {letterboxd_score}
              </span>
            )}
          </div>

          {/* Genre tags */}
          <div className="flex flex-wrap gap-1 mb-2">
            {(genres || []).slice(0, 3).map((g) => (
              <span
                key={typeof g === 'object' ? g.id : g}
                className="px-2 py-0.5 bg-bg rounded-full text-xs text-text-secondary border border-accent-secondary/20 font-body"
              >
                {typeof g === 'object' ? g.name : g}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          {/* ReelScore */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-accent font-heading font-bold text-lg leading-none">{score}</span>
              <span className="text-text-secondary text-xs font-body">/100</span>
            </div>
            <span className="text-text-secondary text-xs font-body hidden sm:inline">ReelScore</span>
          </div>

          <button
            onClick={() => onOpenDrawer?.(movie)}
            className="flex items-center gap-1 text-accent text-sm font-medium font-body hover:opacity-80 transition-opacity"
          >
            Details
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
