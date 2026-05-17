import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getNowPlaying, getMovieDetails, posterUrl, backdropUrl, TMDB_GENRES } from '../lib/tmdb'
import { MOCK_MOVIES, DEFAULT_MOCK_PREFS } from '../lib/mockData'
import { computeReelScore } from '../lib/reelScore'
import { fetchOMDbRatings } from '../lib/omdb'

const GENRE_MAP = Object.fromEntries(TMDB_GENRES.map((g) => [g.id, g.name]))

function mapTMDBBasic(m) {
  return {
    id: `tmdb-${m.id}`,
    tmdb_id: m.id,
    title: m.title,
    synopsis: m.overview,
    tmdb_score: m.vote_average,
    rt_critic: null,
    rt_audience: null,
    letterboxd_score: null,
    poster_path: m.poster_path,
    backdrop_path: m.backdrop_path,
    poster_url: posterUrl(m.poster_path),
    backdrop_url: backdropUrl(m.backdrop_path),
    genres: (m.genre_ids || []).map((id) => ({ id, name: GENRE_MAP[id] || 'Unknown' })),
    release_date: m.release_date,
    in_theaters_until: null,
    trailer_url: null,
    cast: [],
    director: null,
  }
}

function mapTMDBDetail(detail) {
  const director = detail.credits?.crew?.find((c) => c.job === 'Director') || null
  const cast = (detail.credits?.cast || []).slice(0, 10).map((c) => ({ id: c.id, name: c.name }))
  const trailer = detail.videos?.results?.find(
    (v) => v.type === 'Trailer' && v.site === 'YouTube'
  )
  return {
    id: `tmdb-${detail.id}`,
    tmdb_id: detail.id,
    imdb_id: detail.imdb_id || null,
    title: detail.title,
    synopsis: detail.overview,
    tmdb_score: detail.vote_average,
    imdb_score: null,
    rt_critic: null,
    rt_audience: null,
    letterboxd_score: null,
    poster_path: detail.poster_path,
    backdrop_path: detail.backdrop_path,
    poster_url: posterUrl(detail.poster_path),
    backdrop_url: backdropUrl(detail.backdrop_path, 'original'),
    genres: (detail.genres || []).map((g) => ({ id: g.id, name: g.name })),
    release_date: detail.release_date,
    in_theaters_until: null,
    trailer_url: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
    cast,
    director: director ? { id: director.id, name: director.name } : null,
  }
}

async function fetchLiveTMDB(userPrefs) {
  const tmdbKey = import.meta.env.VITE_TMDB_API_KEY
  if (!tmdbKey) throw new Error('No TMDB key')

  const { results } = await getNowPlaying()
  if (!results?.length) throw new Error('Empty TMDB response')

  // Fetch full details in parallel (capped to 20)
  const slice = results.slice(0, 20)
  const details = await Promise.allSettled(slice.map((m) => getMovieDetails(m.id)))

  const movies = details.map((res, i) => {
    if (res.status === 'fulfilled') return mapTMDBDetail(res.value)
    return mapTMDBBasic(slice[i])
  })

  // Enrich with IMDb + RT scores from OMDb (fails silently if key not set)
  const omdbResults = await Promise.allSettled(
    movies.map((m) => fetchOMDbRatings(m.imdb_id))
  )
  const enriched = movies.map((m, i) => {
    const omdb = omdbResults[i].status === 'fulfilled' ? omdbResults[i].value : null
    return {
      ...m,
      imdb_score: omdb?.imdb_score ?? null,
      rt_critic: omdb?.rt_critic ?? null,
      letterboxd_score: omdb?.letterboxd_score ?? null,
    }
  })

  return enriched.map((m) => ({ ...m, ...computeReelScore(m, userPrefs) }))
}

export function useMovies(userId) {
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadMovies = useCallback(
    async (uid) => {
      setLoading(true)
      setError(null)
      try {
        const prefs = uid ? await fetchUserPrefs(uid) : DEFAULT_MOCK_PREFS
        const scored = await fetchLiveTMDB(prefs)
        scored.sort((a, b) => b.score - a.score)
        setMovies(scored)
      } catch (err) {
        console.warn('useMovies falling back to mock data:', err.message)
        setError(err.message)
        const prefs = uid ? await fetchUserPrefs(uid).catch(() => DEFAULT_MOCK_PREFS) : DEFAULT_MOCK_PREFS
        const scored = MOCK_MOVIES.map((m) => ({ ...m, ...computeReelScore(m, prefs) }))
        scored.sort((a, b) => b.score - a.score)
        setMovies(scored)
      } finally {
        setLoading(false)
      }
    },
    [userId]
  )

  useEffect(() => {
    loadMovies(userId)
  }, [loadMovies])

  return { movies, loading, error, reload: () => loadMovies(userId) }
}

async function fetchUserPrefs(userId) {
  const [genrePrefsRes, peoplePrefsRes, { data: { user } }] = await Promise.all([
    supabase.from('user_genre_preferences').select('*').eq('user_id', userId),
    supabase.from('user_people_preferences').select('*').eq('user_id', userId),
    supabase.auth.getUser(),
  ])

  const sw = user?.user_metadata?.scoring_weights ?? { imdb: 33, rt: 33, lb: 34 }

  return {
    genrePreferences: genrePrefsRes.data?.length ? genrePrefsRes.data : DEFAULT_MOCK_PREFS.genrePreferences,
    peoplePreferences: peoplePrefsRes.data || [],
    scoringWeights: sw,
  }
}

export function useWatchlist(userId) {
  const [watchlist, setWatchlist] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    fetchWatchlist(userId)
  }, [userId])

  async function fetchWatchlist(uid) {
    setLoading(true)
    const { data } = await supabase
      .from('user_watchlist')
      .select('movie_id, added_at')
      .eq('user_id', uid)
      .order('added_at', { ascending: false })
    setWatchlist(data || [])
    setLoading(false)
  }

  async function addToWatchlist(movieId) {
    if (!userId) return
    await supabase.from('user_watchlist').upsert({ user_id: userId, movie_id: movieId })
    fetchWatchlist(userId)
  }

  async function removeFromWatchlist(movieId) {
    if (!userId) return
    await supabase.from('user_watchlist').delete().eq('user_id', userId).eq('movie_id', movieId)
    fetchWatchlist(userId)
  }

  function isInWatchlist(movieId) {
    return watchlist.some((w) => w.movie_id === movieId)
  }

  return { watchlist, loading, addToWatchlist, removeFromWatchlist, isInWatchlist }
}
