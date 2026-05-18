import { useState, useEffect } from 'react'
import { X, ChevronRight, CheckCircle } from 'lucide-react'
import { getMovieDetails } from '../lib/tmdb'
import { useRatings } from '../contexts/RatingsContext'

// Well-known films across genres — fetched from TMDB for fresh poster/title data
const CALIBRATION_IDS = [
  238,    // The Godfather
  278,    // The Shawshank Redemption
  155,    // The Dark Knight
  299534, // Avengers: Endgame
  496243, // Parasite
  419430, // Get Out
  313369, // La La Land
  157336, // Interstellar
  493922, // Hereditary
  545611, // Everything Everywhere All at Once
  456740, // Crazy Rich Asians
  8363,   // Superbad
  76341,  // Mad Max: Fury Road
  376867, // Moonlight
  546554, // Knives Out
  120467, // The Grand Budapest Hotel
  324857, // Spider-Man: Into the Spider-Verse
  11036,  // The Notebook
  558144, // Us
  862,    // Toy Story
]

const RATING_OPTIONS = [
  { value: 'liked',          emoji: '👍', label: 'Liked' },
  { value: 'disliked',       emoji: '👎', label: 'Disliked' },
  { value: 'seen',           emoji: '👁️', label: 'Seen it' },
  { value: 'not_interested', emoji: '—',  label: "Haven't seen" },
]

export default function CalibrationModal({ onClose }) {
  const { rate, getRating } = useRatings()
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    Promise.allSettled(CALIBRATION_IDS.map((id) => getMovieDetails(id)))
      .then((results) => {
        const loaded = results
          .filter((r) => r.status === 'fulfilled')
          .map((r) => {
            const d = r.value
            const keywords = (d.keywords?.keywords || []).map((k) => k.name)
            return {
              tmdb_id: d.id,
              title: d.title,
              poster_path: d.poster_path,
              genres: d.genres || [],
              keywords,
              director: d.credits?.crew?.find((c) => c.job === 'Director') || null,
              cast: [],
            }
          })
        setMovies(loaded)
        setLoading(false)
      })
  }, [])

  async function handleRate(value) {
    const movie = movies[index]
    if (value !== 'skip') await rate(movie, value)
    if (index + 1 >= movies.length) {
      setDone(true)
    } else {
      setIndex((i) => i + 1)
    }
  }

  const movie = movies[index]
  const progress = movies.length ? Math.round((index / movies.length) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg border border-accent-secondary/20 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="font-heading font-bold text-text text-lg">Calibrate your taste</h2>
            <p className="text-text-secondary font-body text-xs mt-0.5">Rate films you've seen to personalize suggestions</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-surface text-text-secondary hover:text-text transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Progress bar */}
        {!done && movies.length > 0 && (
          <div className="px-5 pb-3">
            <div className="h-1 bg-surface rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-text-secondary/50 font-body text-xs mt-1">{index} of {movies.length}</p>
          </div>
        )}

        {/* Content */}
        <div className="px-5 pb-6">
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            </div>
          ) : done ? (
            <div className="text-center py-8">
              <CheckCircle size={44} className="text-emerald-400 mx-auto mb-3" />
              <h3 className="font-heading font-bold text-text text-xl mb-2">All set!</h3>
              <p className="text-text-secondary font-body text-sm mb-5">Your suggestions are now personalized based on your ratings.</p>
              <button onClick={onClose} className="px-6 py-3 bg-accent text-white rounded-xl font-body font-medium hover:opacity-90 transition-opacity">
                See my suggestions <ChevronRight size={16} className="inline" />
              </button>
            </div>
          ) : movie ? (
            <>
              {/* Poster */}
              <div className="flex gap-4 mb-5 items-center">
                {movie.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w185${movie.poster_path}`}
                    alt={movie.title}
                    className="w-20 h-28 object-cover rounded-xl flex-shrink-0"
                  />
                ) : (
                  <div className="w-20 h-28 bg-surface rounded-xl flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <h3 className="font-heading font-semibold text-text text-lg leading-tight mb-1">{movie.title}</h3>
                  <div className="flex flex-wrap gap-1">
                    {(movie.genres || []).slice(0, 3).map((g) => (
                      <span key={g.id} className="px-2 py-0.5 bg-surface rounded-full text-xs text-text-secondary font-body border border-accent-secondary/20">
                        {g.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Rating buttons */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                {RATING_OPTIONS.map(({ value, emoji, label }) => (
                  <button
                    key={value}
                    onClick={() => handleRate(value)}
                    className="py-3 rounded-xl bg-surface border border-accent-secondary/15 text-text font-body text-sm hover:border-accent/30 hover:bg-accent/5 transition-colors flex items-center justify-center gap-2"
                  >
                    <span>{emoji}</span> {label}
                  </button>
                ))}
              </div>

              <button onClick={() => handleRate('skip')} className="w-full text-center text-text-secondary/50 font-body text-xs hover:text-text-secondary transition-colors py-1">
                Skip this one
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
