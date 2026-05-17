import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MOCK_MOVIES, DEFAULT_MOCK_PREFS } from '../lib/mockData'
import { computeReelScore } from '../lib/reelScore'

/**
 * Fetches movies with ReelScores for the current user.
 * Falls back to mock data if TMDB key is unavailable or user has no real data.
 */
export function useMovies(userId) {
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId) {
      // Show mock data with default prefs for demo/preview
      const scored = MOCK_MOVIES.map((m) => ({
        ...m,
        ...computeReelScore(m, DEFAULT_MOCK_PREFS),
      }))
      scored.sort((a, b) => b.score - a.score)
      setMovies(scored)
      setLoading(false)
      return
    }

    loadMovies(userId)
  }, [userId])

  async function loadMovies(uid) {
    setLoading(true)
    setError(null)
    try {
      const prefs = await fetchUserPrefs(uid)
      const scored = MOCK_MOVIES.map((m) => ({
        ...m,
        ...computeReelScore(m, prefs),
      }))
      scored.sort((a, b) => b.score - a.score)
      setMovies(scored)
    } catch (err) {
      console.error('useMovies error:', err)
      setError(err.message)
      // Fallback to mock data with default prefs
      const scored = MOCK_MOVIES.map((m) => ({
        ...m,
        ...computeReelScore(m, DEFAULT_MOCK_PREFS),
      }))
      scored.sort((a, b) => b.score - a.score)
      setMovies(scored)
    } finally {
      setLoading(false)
    }
  }

  return { movies, loading, error, reload: () => loadMovies(userId) }
}

async function fetchUserPrefs(userId) {
  const [thresholdsRes, genreThreshRes, genrePrefsRes, peoplePrefsRes] = await Promise.all([
    supabase.from('user_rating_thresholds').select('*').eq('user_id', userId),
    supabase.from('user_genre_thresholds').select('*').eq('user_id', userId),
    supabase.from('user_genre_preferences').select('*').eq('user_id', userId),
    supabase.from('user_people_preferences').select('*').eq('user_id', userId),
  ])

  return {
    globalThresholds: thresholdsRes.data || DEFAULT_MOCK_PREFS.globalThresholds,
    genreThresholds: genreThreshRes.data || [],
    genrePreferences: genrePrefsRes.data || DEFAULT_MOCK_PREFS.genrePreferences,
    peoplePreferences: peoplePrefsRes.data || DEFAULT_MOCK_PREFS.peoplePreferences,
  }
}

/**
 * Watchlist hook
 */
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
