import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, RefreshCw, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useRatings } from '../contexts/RatingsContext'
import { supabase } from '../lib/supabase'
import { discoverMovies, getMovieDetails, getWatchProviders, posterUrl, TMDB_GENRES } from '../lib/tmdb'
import { computeReelScore, DEFAULT_SCORING_WEIGHTS } from '../lib/reelScore'
import { fetchOMDbRatings } from '../lib/omdb'
import { DEFAULT_MOCK_PREFS } from '../lib/mockData'
import BucketBadge from '../components/BucketBadge'
import TabBar from '../components/TabBar'
import StreamingBadges from '../components/StreamingBadges'

const GENRE_MAP = Object.fromEntries(TMDB_GENRES.map((g) => [g.id, g.name]))

const FILTERS = [
  { key: 'all', label: 'For You' },
  { key: 'must_see', label: 'Must-See Genres' },
  { key: 'top_rated', label: 'Top Rated' },
  { key: 'hidden_gems', label: 'Hidden Gems' },
  { key: 'streaming', label: 'Streaming Now' },
]

export default function Suggestions() {
  const { user } = useAuth()
  const { ratings, tasteProfile } = useRatings()
  const navigate = useNavigate()
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')
  const [hideWatched, setHideWatched] = useState(false)
  const [userPrefs, setUserPrefs] = useState(null)

  const loadSuggestions = useCallback(async (filter = 'all', prefs = userPrefs) => {
    setLoading(true)
    try {
      let results = []

      if (filter === 'hidden_gems') {
        // Lower popularity, higher quality
        const data = await discoverMovies({ sortBy: 'vote_average.desc', minVotes: 100 })
        results = (data.results || []).filter((m) => m.popularity < 20)
      } else if (filter === 'must_see' && prefs) {
        const mustSeeIds = (prefs.genrePreferences || [])
          .filter((g) => g.priority === 'must_see')
          .map((g) => g.genre_id)
        if (mustSeeIds.length) {
          const data = await discoverMovies({ genreIds: mustSeeIds, minVotes: 100 })
          results = data.results || []
        } else {
          const data = await discoverMovies({ minVotes: 200 })
          results = data.results || []
        }
      } else if (filter === 'top_rated') {
        const [p1, p2] = await Promise.all([discoverMovies({ minVotes: 500 }), discoverMovies({ page: 2, minVotes: 500 })])
        results = [...(p1.results || []), ...(p2.results || [])]
      } else if (filter === 'streaming') {
        const [p1, p2] = await Promise.all([discoverMovies({ minVotes: 100 }), discoverMovies({ page: 2, minVotes: 100 })])
        results = [...(p1.results || []), ...(p2.results || [])]
      } else {
        // 'all' — blend discover pages
        const [p1, p2] = await Promise.all([discoverMovies({ minVotes: 200 }), discoverMovies({ page: 2, minVotes: 200 })])
        results = [...(p1.results || []), ...(p2.results || [])]
      }

      // Deduplicate
      const seen = new Set()
      results = results.filter((m) => { if (seen.has(m.id)) return false; seen.add(m.id); return true })

      // Fetch details + OMDb for top 20
      const slice = results.slice(0, 20)
      const details = await Promise.allSettled(slice.map((m) => getMovieDetails(m.id)))
      const [omdbResults, providerResults] = await Promise.all([
        Promise.allSettled(details.map((d) => d.status === 'fulfilled' ? fetchOMDbRatings(d.value.imdb_id) : null)),
        Promise.allSettled(slice.map((m) => getWatchProviders(m.id))),
      ])

      // For streaming filter, keep only movies with flatrate providers
      if (filter === 'streaming') {
        const streamingIds = new Set(
          providerResults
            .map((r, i) => (r.status === 'fulfilled' && r.value?.flatrate?.length ? slice[i].id : null))
            .filter(Boolean)
        )
        results = results.filter((m) => streamingIds.has(m.id))
      }

      const scored = details.map((res, i) => {
        if (res.status !== 'fulfilled') return null
        const detail = res.value
        const omdb = omdbResults[i].status === 'fulfilled' ? omdbResults[i].value : null
        const director = detail.credits?.crew?.find((c) => c.job === 'Director') || null
        const cast = (detail.credits?.cast || []).slice(0, 10).map((c) => ({ id: c.id, name: c.name }))

        const movie = {
          id: `tmdb-${detail.id}`,
          tmdb_id: detail.id,
          imdb_id: detail.imdb_id || null,
          title: detail.title,
          synopsis: detail.overview,
          poster_path: detail.poster_path,
          release_date: detail.release_date,
          genres: (detail.genres || []).map((g) => ({ id: g.id, name: g.name })),
          cast,
          director: director ? { id: director.id, name: director.name } : null,
          imdb_score: omdb?.imdb_score ?? null,
          rt_critic: omdb?.rt_critic ?? null,
          letterboxd_score: omdb?.letterboxd_score ?? null,
        }

        const enrichedPrefs = { ...(prefs || {}), tasteProfile }
        return { ...movie, ...computeReelScore(movie, enrichedPrefs) }
      }).filter(Boolean)

      scored.sort((a, b) => b.score - a.score)
      setMovies(scored)
    } catch (err) {
      console.warn('Suggestions load failed:', err.message)
      setMovies([])
    } finally {
      setLoading(false)
    }
  }, [userPrefs, tasteProfile])

  useEffect(() => {
    async function init() {
      let prefs = DEFAULT_MOCK_PREFS
      if (user) {
        try {
          const [genreRes, peopleRes, { data: { user: authUser } }] = await Promise.all([
            supabase.from('user_genre_preferences').select('*').eq('user_id', user.id),
            supabase.from('user_people_preferences').select('*').eq('user_id', user.id),
            supabase.auth.getUser(),
          ])
          const raw = authUser?.user_metadata?.scoring_weights
          prefs = {
            genrePreferences: genreRes.data?.length ? genreRes.data : DEFAULT_MOCK_PREFS.genrePreferences,
            peoplePreferences: peopleRes.data || [],
            scoringWeights: raw
              ? { imdb: Number(raw.imdb) || 33, rt: Number(raw.rt) || 33, lb: Number(raw.lb) || 34 }
              : DEFAULT_SCORING_WEIGHTS,
            tasteMaxAdjustment: Number(authUser?.user_metadata?.taste_max_adjustment ?? 20),
          }
        } catch { /* use defaults */ }
      }
      setUserPrefs(prefs)
      loadSuggestions('all', prefs)
    }
    init()
  }, [user])

  function handleFilterChange(key) {
    setActiveFilter(key)
    loadSuggestions(key, userPrefs)
  }

  const displayMovies = hideWatched
    ? movies.filter((m) => !ratings[String(m.tmdb_id)])
    : movies

  return (
    <div className="min-h-screen bg-bg pb-28">
      {/* Header */}
      <div className="px-4 pt-12 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={20} className="text-accent" />
          <h1 className="font-heading font-bold text-text text-2xl">Suggestions</h1>
        </div>
        <p className="text-text-secondary font-body text-sm">
          Movies picked to match your taste — beyond what's in theaters
        </p>
      </div>

      {/* Filter pills + hide-watched toggle */}
      <div className="px-4 pb-3 flex items-center gap-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-none flex-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => handleFilterChange(f.key)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-body font-medium transition-colors ${
                activeFilter === f.key
                  ? 'bg-accent text-white'
                  : 'bg-surface text-text-secondary border border-accent-secondary/20 hover:text-text'
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
          title="Hide movies you've already rated"
        >
          <EyeOff size={13} />
          Hide seen
        </button>
      </div>

      {/* Content */}
      <div className="px-4 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw size={24} className="text-accent animate-spin" />
            <p className="text-text-secondary font-body text-sm">Finding films for you…</p>
          </div>
        ) : displayMovies.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-text-secondary font-body">
              {hideWatched && movies.length > 0
                ? "You've seen everything here — turn off 'Hide seen' to show them."
                : 'No suggestions found. Try a different filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayMovies.map((movie) => (
              <SuggestionCard key={movie.id} movie={movie} onOpen={() => navigate(`/movie/${movie.tmdb_id}`)} />
            ))}
          </div>
        )}
      </div>

      <TabBar />
    </div>
  )
}

function SuggestionCard({ movie, onOpen }) {
  const { title, poster_path, genres, score, bucket, imdb_score, rt_critic, letterboxd_score, release_date } = movie
  const year = release_date ? new Date(release_date).getFullYear() : null

  return (
    <div className="bg-surface rounded-2xl overflow-hidden flex gap-0 shadow-sm">
      <button className="flex-shrink-0 w-24" onClick={onOpen} aria-label={`View ${title}`}>
        {poster_path ? (
          <img
            src={`https://image.tmdb.org/t/p/w185${poster_path}`}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-24 h-36 bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900 flex items-end p-2">
            <span className="text-white/30 text-xs font-heading italic line-clamp-2">{title}</span>
          </div>
        )}
      </button>

      <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
        <div>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div>
              <h3 className="font-heading font-semibold text-text text-base leading-tight line-clamp-1">{title}</h3>
              {year && <span className="text-text-secondary/50 text-xs font-body">{year}</span>}
            </div>
          </div>
          <BucketBadge bucket={bucket} className="mb-2" />
          <div className="flex flex-wrap gap-1.5 mb-2">
            {imdb_score != null && (
              <span className="text-xs font-body text-text-secondary"><span className="text-text-secondary/60">IMDb</span> {imdb_score}</span>
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
          <div className="flex flex-wrap gap-1">
            {(genres || []).slice(0, 3).map((g) => (
              <span key={g.id} className="px-2 py-0.5 bg-bg rounded-full text-xs text-text-secondary border border-accent-secondary/20 font-body">
                {g.name}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-accent font-heading font-bold text-lg leading-none">{score}</span>
              <span className="text-text-secondary text-xs font-body">/100</span>
            </div>
            <StreamingBadges tmdbId={movie.tmdb_id} compact />
          </div>
          <button onClick={onOpen} className="text-accent text-sm font-medium font-body hover:opacity-80 transition-opacity">
            Details →
          </button>
        </div>
      </div>
    </div>
  )
}
