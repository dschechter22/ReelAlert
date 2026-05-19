import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useRatings } from '../contexts/RatingsContext'
import { useMovies, useWatchlist } from '../hooks/useMovies'
import MovieCard from '../components/MovieCard'
import ReelScoreDrawer from '../components/ReelScoreDrawer'
import TabBar from '../components/TabBar'
import OnboardingModal from '../modals/OnboardingModal'
import CalibrationBanner from '../components/CalibrationBanner'
import { Film, Search, SlidersHorizontal, EyeOff } from 'lucide-react'

const BUCKET_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'must-see', label: 'Must See' },
  { value: 'worth-watching', label: 'Worth Watching' },
  { value: 'if-youre-interested', label: "If You're Interested" },
  { value: 'not-for-you', label: 'Not For You' },
]

export default function Dashboard() {
  const { user } = useAuth()
  const { tasteProfile, ratings } = useRatings()
  const { movies, loading } = useMovies(user?.id, tasteProfile)
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist(user?.id)
  const ratingCount = Object.keys(ratings).length
  const [selectedMovie, setSelectedMovie] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [bucketFilter, setBucketFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [hideWatched, setHideWatched] = useState(false)

  // Show onboarding for new users (no zip_code set)
  useEffect(() => {
    if (user && !user.user_metadata?.zip_code) {
      const seen = localStorage.getItem('ra-onboarding-done')
      if (!seen) setShowOnboarding(true)
    }
  }, [user])

  function handleOnboardingComplete() {
    localStorage.setItem('ra-onboarding-done', '1')
    setShowOnboarding(false)
  }

  function handleWatchlistToggle(movie) {
    if (isInWatchlist(movie.id)) {
      removeFromWatchlist(movie.id)
    } else {
      addToWatchlist(movie.id)
    }
  }

  const filtered = movies.filter((m) => {
    const matchesBucket = bucketFilter === 'all' || m.bucket === bucketFilter
    const matchesSearch = !searchQuery || m.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesWatched = !hideWatched || !ratings[String(m.tmdb_id ?? m.id)]
    return matchesBucket && matchesSearch && matchesWatched
  })

  return (
    <div className="min-h-screen bg-bg pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-accent-secondary/15 px-4 pt-safe"
        style={{ background: 'rgb(var(--color-bg) / 0.9)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2">
              <Film size={20} className="text-accent" />
              <h1 className="font-heading font-bold text-text text-xl">ReelAlert</h1>
            </div>
            <button
              onClick={() => setShowOnboarding(true)}
              className="p-2 rounded-xl bg-surface text-text-secondary hover:text-accent transition-colors border border-accent-secondary/20"
              aria-label="Preferences"
            >
              <SlidersHorizontal size={18} />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search movies…"
              className="w-full bg-surface border border-accent-secondary/20 rounded-xl pl-9 pr-4 py-2.5 text-sm text-text font-body placeholder-text-secondary focus:outline-none focus:border-accent/40"
            />
          </div>

          {/* Bucket filters + hide seen */}
          <div className="flex items-center gap-2 pb-3">
            <div className="flex gap-2 overflow-x-auto scrollbar-none flex-1">
              {BUCKET_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setBucketFilter(f.value)}
                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium font-body transition-colors border ${
                    bucketFilter === f.value
                      ? 'bg-accent text-white border-accent'
                      : 'bg-surface text-text-secondary border-accent-secondary/20 hover:border-accent/40'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setHideWatched((v) => !v)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body font-medium border transition-colors ${
                hideWatched
                  ? 'bg-accent text-white border-accent'
                  : 'bg-surface text-text-secondary border-accent-secondary/20 hover:border-accent/40'
              }`}
            >
              <EyeOff size={13} />
              Hide seen
            </button>
          </div>
        </div>
      </header>

      {/* Calibration banner */}
      <div className="max-w-2xl mx-auto pt-3">
        <CalibrationBanner ratingCount={ratingCount} />
      </div>

      {/* Movie list */}
      <main className="max-w-2xl mx-auto px-4 pt-1 space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-2xl h-36 animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-heading text-text text-lg mb-2">No matches found</p>
            <p className="text-text-secondary text-sm font-body">
              Try adjusting your filters or preferences.
            </p>
          </div>
        ) : (
          <>
            <p className="text-text-secondary text-xs font-body">
              {filtered.length} film{filtered.length !== 1 ? 's' : ''} in theaters
            </p>
            {filtered.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                onOpenDrawer={setSelectedMovie}
                onWatchlistToggle={handleWatchlistToggle}
                inWatchlist={isInWatchlist(movie.id)}
              />
            ))}
          </>
        )}
      </main>

      {/* ReelScore Drawer */}
      {selectedMovie && (
        <ReelScoreDrawer
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
        />
      )}

      {/* Onboarding */}
      {showOnboarding && (
        <OnboardingModal onComplete={handleOnboardingComplete} onClose={() => setShowOnboarding(false)} />
      )}

      <TabBar />
    </div>
  )
}
