import { X, Star, Heart, AlertTriangle } from 'lucide-react'
import BucketBadge from './BucketBadge'

export default function ReelScoreDrawer({ movie, onClose }) {
  if (!movie) return null

  const { title, bucket, score, breakdown, posterGradient, poster_path, synopsis, genres, cast, director } = movie
  const posterBg = poster_path ? null : (posterGradient || 'from-gray-800 via-gray-700 to-gray-900')

  const baseScore = breakdown?.baseScore ?? score
  const pct = breakdown?.weightPct

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 fade-in"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 max-w-2xl mx-auto drawer-slide-up">
        <div className="bg-bg rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto pb-safe">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-accent-secondary/40" />
          </div>

          {/* Header */}
          <div className="px-5 pt-2 pb-4 flex items-start gap-4">
            <div className="flex-shrink-0">
              {poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w185${poster_path}`}
                  alt={title}
                  className="w-20 h-28 object-cover rounded-xl"
                />
              ) : (
                <div className={`w-20 h-28 bg-gradient-to-br ${posterBg} rounded-xl`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-heading font-bold text-text text-xl leading-tight mb-2">{title}</h2>
              <BucketBadge bucket={bucket} className="mb-2" />
              <div className="flex items-baseline gap-1">
                <span className="text-accent font-heading font-bold text-3xl">{score}</span>
                <span className="text-text-secondary font-body text-sm">/100 ReelScore</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-surface text-text-secondary hover:text-text transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Synopsis */}
          {synopsis && (
            <div className="px-5 pb-4">
              <p className="text-text-secondary font-body text-sm leading-relaxed">{synopsis}</p>
            </div>
          )}

          {/* Preference flags */}
          <div className="px-5 pb-4 flex flex-wrap gap-2">
            {breakdown?.hasMustSeeGenre && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-400 font-body">
                <Star size={10} /> Must-See Genre +10
              </span>
            )}
            {breakdown?.hasFavoritePerson && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-pink-500/10 border border-pink-500/20 rounded-full text-xs text-pink-400 font-body">
                <Heart size={10} /> Favorite Cast/Director +15
              </span>
            )}
            {breakdown?.hasNeverGenre && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-xs text-red-400 font-body">
                <AlertTriangle size={10} /> Excluded Genre −25
              </span>
            )}
            {breakdown?.hasExcludedPerson && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-xs text-red-400 font-body">
                <AlertTriangle size={10} /> Excluded Person −30
              </span>
            )}
          </div>

          {/* Score breakdown */}
          <div className="px-5 pb-4">
            <h3 className="font-heading font-semibold text-text text-base mb-3">Score Breakdown</h3>
            <div className="bg-surface rounded-2xl px-4 py-1">
              <div className="flex items-center justify-between py-2 border-b border-accent-secondary/10">
                <div>
                  <span className="text-text font-body text-sm">Base score</span>
                  {pct && (
                    <span className="ml-2 text-text-secondary font-body text-xs">
                      IMDb {pct.imdb}% · RT {pct.rt}% · LB {pct.lb}%
                    </span>
                  )}
                </div>
                <span className="text-text font-body text-sm font-medium">{baseScore}/100</span>
              </div>
              {breakdown?.hasMustSeeGenre && (
                <div className="flex items-center justify-between py-2 border-b border-accent-secondary/10">
                  <span className="text-emerald-400 font-body text-sm">Must-See Genre boost</span>
                  <span className="text-emerald-400 font-body text-sm font-medium">+10</span>
                </div>
              )}
              {breakdown?.hasFavoritePerson && (
                <div className="flex items-center justify-between py-2 border-b border-accent-secondary/10">
                  <span className="text-pink-400 font-body text-sm">Favorite person boost</span>
                  <span className="text-pink-400 font-body text-sm font-medium">+15</span>
                </div>
              )}
              {breakdown?.hasNeverGenre && (
                <div className="flex items-center justify-between py-2 border-b border-accent-secondary/10">
                  <span className="text-red-400 font-body text-sm">Excluded genre penalty</span>
                  <span className="text-red-400 font-body text-sm font-medium">−25</span>
                </div>
              )}
              {breakdown?.hasExcludedPerson && (
                <div className="flex items-center justify-between py-2 border-b border-accent-secondary/10">
                  <span className="text-red-400 font-body text-sm">Excluded person penalty</span>
                  <span className="text-red-400 font-body text-sm font-medium">−30</span>
                </div>
              )}
              <div className="flex items-center justify-between py-2">
                <span className="text-text font-body text-sm font-semibold">ReelScore</span>
                <span className="text-accent font-heading font-bold text-base">{score}/100</span>
              </div>
            </div>

            {/* Raw scores */}
            {breakdown?.sources && (
              <>
                <h3 className="font-heading font-semibold text-text text-base mt-5 mb-3">All Scores</h3>
                <div className="bg-surface rounded-2xl px-4 py-1">
                  {Object.entries(breakdown.sources).map(([source, data]) => (
                    <div key={source} className="flex items-center justify-between py-2 border-b border-accent-secondary/10 last:border-0">
                      <span className="text-text font-body text-sm">
                        {{ imdb: 'IMDb', rt_critic: 'RT Critic', letterboxd: 'Letterboxd' }[source] || source}
                      </span>
                      <span className={`font-body text-sm font-medium ${data.value != null ? 'text-text' : 'text-text-secondary/40'}`}>
                        {data.displayValue}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Cast & Director */}
          {(cast?.length > 0 || director) && (
            <div className="px-5 pb-6">
              <h3 className="font-heading font-semibold text-text text-base mb-3">Cast & Crew</h3>
              <div className="bg-surface rounded-2xl px-4 py-1">
                {director && (
                  <div className="flex items-center justify-between py-2 border-b border-accent-secondary/10">
                    <span className="text-text-secondary font-body text-sm">Director</span>
                    <span className="text-text font-body text-sm">{director.name || director}</span>
                  </div>
                )}
                {(cast || []).slice(0, 4).map((c) => (
                  <div key={c.id || c.name} className="flex items-center justify-between py-2 border-b border-accent-secondary/10 last:border-0">
                    <span className="text-text-secondary font-body text-sm">Cast</span>
                    <span className="text-text font-body text-sm">{c.name || c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
