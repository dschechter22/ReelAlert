import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, RefreshCw, Shuffle, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useRatings } from '../contexts/RatingsContext'
import { supabase } from '../lib/supabase'
import { discoverMovies, getMovieDetails } from '../lib/tmdb'
import { computeReelScore, DEFAULT_SCORING_WEIGHTS } from '../lib/reelScore'
import { fetchOMDbRatings } from '../lib/omdb'
import { DEFAULT_MOCK_PREFS } from '../lib/mockData'
import BucketBadge from '../components/BucketBadge'
import StreamingBadges from '../components/StreamingBadges'
import TabBar from '../components/TabBar'

const BUCKET_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'must-see', label: 'Must See' },
  { value: 'worth-watching', label: 'Worth Watching' },
  { value: 'if-youre-interested', label: "If You're Interested" },
]

function getTopGenreIds(tasteProfile, limit = 6) {
  if (!tasteProfile?.genre_affinities) return []
  return Object.entries(tasteProfile.genre_affinities)
    .filter(([, score]) => score > 0.15)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => Number(id))
}

function pickRandomPages(count = 3) {
  const pool = Array.from({ length: 10 }, (_, i) => i + 1)
  const shuffled = pool.sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

export default function Suggestions() {
  const { user } = useAuth()
  const { ratings, tasteProfile } = useRatings()
  const navigate = useNavigate()

  const [rawMovies, setRawMovies] = useState([])   // unscored, from TMDB + OMDb
  const [loading, setLoading] = useState(true)
  const [bucketFilter, setBucketFilter] = useState('all')
  const [selectedPeople, setSelectedPeople] = useState([])  // array of tmdb_person_id
  const [hideWatched, setHideWatched] = useState(false)
  const [pages, setPages] = useState(() => pickRandomPages())
  const [favoritePeople, setFavoritePeople] = useState([])
  const [userPrefs, setUserPrefs] = useState(null)

  // Load prefs + favourite people once
  useEffect(() => {
    async function init() {
      let prefs = { ...DEFAULT_MOCK_PREFS, tasteMaxAdjustment: 20 }
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
          setFavoritePeople(
            (peopleRes.data || []).filter((p) => p.preference_type === 'favorite')
          )
        } catch { /* use defaults */ }
      }
      setUserPrefs(prefs)
    }
    init()
  }, [user])

  // Fetch raw movie data (API calls). Re-runs on pages or people filter change.
  const fetchMovies = useCallback(async (currentPages, prefs, tasteProf, personIds) => {
    if (!prefs) return
    setLoading(true)
    try {
      // Build genre pool: must-see genres + top taste genres
      const mustSeeIds = (prefs.genrePreferences || [])
        .filter((g) => g.priority === 'must_see')
        .map((g) => g.genre_id)
      const tasteGenreIds = getTopGenreIds(tasteProf)
      const genreIds = [...new Set([...mustSeeIds, ...tasteGenreIds])]

      let allResults = []

      if (personIds.length > 0) {
        // One discover call per person, then union results
        const perPersonFetches = await Promise.allSettled(
          personIds.flatMap((personId) =>
            currentPages.map((page) =>
              discoverMovies({ genreIds, page, minVotes: 30, withPeople: [personId] })
            )
          )
        )
        allResults = perPersonFetches
          .filter((r) => r.status === 'fulfilled')
          .flatMap((r) => r.value?.results || [])
      } else {
        const fetches = await Promise.allSettled(
          currentPages.map((page) => discoverMovies({ genreIds, page, minVotes: 100 }))
        )
        allResults = fetches
          .filter((r) => r.status === 'fulfilled')
          .flatMap((r) => r.value?.results || [])
      }

      // Deduplicate
      const seen = new Set()
      allResults = allResults.filter((m) => {
        if (seen.has(m.id)) return false
        seen.add(m.id)
        return true
      })

      // Enrich top 20 with full details + OMDb scores
      const slice = allResults.slice(0, 20)
      const details = await Promise.allSettled(slice.map((m) => getMovieDetails(m.id)))
      const omdbResults = await Promise.allSettled(
        details.map((d) =>
          d.status === 'fulfilled' ? fetchOMDbRatings(d.value.imdb_id) : Promise.resolve(null)
        )
      )

      const enriched = details
        .map((res, i) => {
          if (res.status !== 'fulfilled') return null
          const detail = res.value
          const omdb = omdbResults[i].status === 'fulfilled' ? omdbResults[i].value : null
          const director = detail.credits?.crew?.find((c) => c.job === 'Director') || null
          const cast = (detail.credits?.cast || []).slice(0, 10).map((c) => ({ id: c.id, name: c.name }))
          const keywords = (detail.keywords?.keywords || []).map((k) => k.name)
          return {
            id: `tmdb-${detail.id}`,
            tmdb_id: detail.id,
            imdb_id: detail.imdb_id || null,
            title: detail.title,
            synopsis: detail.overview,
            poster_path: detail.poster_path,
            release_date: detail.release_date,
            genres: (detail.genres || []).map((g) => ({ id: g.id, name: g.name })),
            keywords,
            cast,
            director: director ? { id: director.id, name: director.name } : null,
            imdb_score: omdb?.imdb_score ?? null,
            rt_critic: omdb?.rt_critic ?? null,
            letterboxd_score: omdb?.letterboxd_score ?? null,
          }
        })
        .filter(Boolean)

      setRawMovies(enriched)
    } catch (err) {
      console.warn('Suggestions fetch failed:', err.message)
      setRawMovies([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Re-fetch when pages or people filter changes (or on first load)
  useEffect(() => {
    if (userPrefs) fetchMovies(pages, userPrefs, tasteProfile, selectedPeople)
  }, [pages, selectedPeople, userPrefs]) // intentionally omit tasteProfile — rescoring is in-memory

  // Score + sort in memory whenever raw data or taste profile changes (no API calls)
  const movies = useMemo(() => {
    if (!userPrefs) return []
    const enrichedPrefs = { ...userPrefs, tasteProfile }
    return rawMovies
      .map((m) => ({ ...m, ...computeReelScore(m, enrichedPrefs) }))
      .sort((a, b) => b.score - a.score)
  }, [rawMovies, userPrefs, tasteProfile])

  // Apply client-side filters
  const displayMovies = useMemo(() => {
    let list = movies
    if (hideWatched) list = list.filter((m) => !ratings[String(m.tmdb_id)])
    if (bucketFilter !== 'all') list = list.filter((m) => m.bucket === bucketFilter)
    return list
  }, [movies, hideWatched, bucketFilter, ratings])

  function handleShuffle() {
    setPages(pickRandomPages())
  }

  function togglePerson(id) {
    setSelectedPeople((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  return (
    <div className="min-h-screen bg-bg pb-28">
      {/* Header */}
      <header
        className="sticky top-0 z-20 border-b border-accent-secondary/15 px-4 pt-safe"
        style={{ background: 'rgb(var(--color-bg) / 0.9)', backdropFilter: 'blur(12px)' }}
      >
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-accent" />
              <div>
                <h1 className="font-heading font-bold text-text text-xl leading-none">For You</h1>
                <p className="text-text-secondary font-body text-xs mt-0.5">Ranked by your taste</p>
              </div>
            </div>
            <button
              onClick={handleShuffle}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface border border-accent-secondary/20 text-text-secondary text-sm font-body hover:text-accent hover:border-accent/30 transition-colors disabled:opacity-40"
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Shuffle size={14} />}
              {loading ? 'Loading…' : 'Shuffle'}
            </button>
          </div>

          {/* Favourite people filter */}
          {favoritePeople.length > 0 && (
            <div className="mb-2">
              <p className="text-text-secondary/60 text-xs font-body uppercase tracking-wide mb-1.5">
                Filter by person
              </p>
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                {favoritePeople.map((p) => {
                  const active = selectedPeople.includes(p.tmdb_person_id)
                  return (
                    <button
                      key={p.tmdb_person_id}
                      onClick={() => togglePerson(p.tmdb_person_id)}
                      className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-body font-medium border transition-colors ${
                        active
                          ? 'bg-accent text-white border-accent'
                          : 'bg-surface text-text-secondary border-accent-secondary/20 hover:border-accent/40'
                      }`}
                    >
                      {p.person_name || p.tmdb_person_id}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Bucket filter + hide-seen toggle */}
          <div className="flex items-center gap-2 pb-3">
            <div className="flex gap-2 overflow-x-auto scrollbar-none flex-1">
              {BUCKET_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setBucketFilter(f.value)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-body font-medium border transition-colors ${
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

      {/* Movie list */}
      <main className="max-w-2xl mx-auto px-4 pt-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw size={24} className="text-accent animate-spin" />
            <p className="text-text-secondary font-body text-sm">Finding films for you…</p>
          </div>
        ) : displayMovies.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <p className="text-text-secondary font-body text-sm">
              {hideWatched && movies.length > 0
                ? "You've seen everything here."
                : bucketFilter !== 'all' && movies.length > 0
                ? 'No films in this category — try a different filter.'
                : selectedPeople.length > 0
                ? 'No results for the selected people — try shuffling.'
                : 'Nothing found.'}
            </p>
            <button
              onClick={handleShuffle}
              className="text-accent text-sm font-body hover:opacity-80 transition-opacity"
            >
              Shuffle for new picks →
            </button>
          </div>
        ) : (
          <>
            <p className="text-text-secondary text-xs font-body mb-3">
              {displayMovies.length} film{displayMovies.length !== 1 ? 's' : ''} · sorted by your ReelScore
            </p>
            <div className="space-y-3">
              {displayMovies.map((movie) => (
                <SuggestionCard
                  key={movie.id}
                  movie={movie}
                  onOpen={() => navigate(`/movie/${movie.tmdb_id}`)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      <TabBar />
    </div>
  )
}

function SuggestionCard({ movie, onOpen }) {
  const { title, poster_path, genres, score, bucket, imdb_score, rt_critic, letterboxd_score, release_date, director, breakdown } = movie
  const year = release_date ? new Date(release_date).getFullYear() : null

  return (
    <div className="bg-surface rounded-2xl overflow-hidden flex shadow-sm">
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
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <h3 className="font-heading font-semibold text-text text-base leading-tight line-clamp-1">{title}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                {year && <span className="text-text-secondary/50 text-xs font-body">{year}</span>}
                {director && <span className="text-text-secondary/50 text-xs font-body">· {director.name}</span>}
              </div>
            </div>
          </div>

          <BucketBadge bucket={bucket} className="mb-2" />

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

          <div className="flex flex-wrap gap-1">
            {(genres || []).slice(0, 3).map((g) => (
              <span
                key={g.id}
                className="px-2 py-0.5 bg-bg rounded-full text-xs text-text-secondary border border-accent-secondary/20 font-body"
              >
                {g.name}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <div className="flex items-baseline gap-1">
              <span className="text-accent font-heading font-bold text-lg leading-none">{score}</span>
              <span className="text-text-secondary text-xs font-body">/100</span>
            </div>
            {breakdown?.tasteBonus !== 0 && breakdown?.tasteBonus != null && (
              <span className={`text-xs font-body font-medium ${breakdown.tasteBonus > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {breakdown.tasteBonus > 0 ? `+${breakdown.tasteBonus}` : breakdown.tasteBonus} taste
              </span>
            )}
            <StreamingBadges tmdbId={movie.tmdb_id} compact />
          </div>
          <button
            onClick={onOpen}
            className="text-accent text-sm font-medium font-body hover:opacity-80 transition-opacity"
          >
            Details →
          </button>
        </div>
      </div>
    </div>
  )
}
