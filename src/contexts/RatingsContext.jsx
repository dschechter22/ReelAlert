import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getMovieKeywords } from '../lib/tmdb'
import { buildTasteProfile } from '../lib/tasteProfile'
import { useAuth } from './AuthContext'

const RatingsContext = createContext(null)

export function RatingsProvider({ children }) {
  const { user } = useAuth()
  const [ratings, setRatings] = useState({})     // tmdb_id (string) → rating string
  const [ratingRows, setRatingRows] = useState([]) // full rows for profile computation
  const [tasteProfile, setTasteProfile] = useState(null)
  const [loading, setLoading] = useState(false)

  const loadRatings = useCallback(async (uid) => {
    setLoading(true)
    const { data } = await supabase
      .from('user_movie_ratings')
      .select('*')
      .eq('user_id', uid)
    if (data) {
      const map = {}
      for (const row of data) map[String(row.tmdb_id)] = row.rating
      setRatings(map)
      setRatingRows(data)
      setTasteProfile(buildTasteProfile(data))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (user) loadRatings(user.id)
    else { setRatings({}); setRatingRows([]); setTasteProfile(null) }
  }, [user, loadRatings])

  const rate = useCallback(async (movie, ratingValue) => {
    if (!user) return

    const tmdbId = movie.tmdb_id ?? movie.id
    const key = String(tmdbId)

    // Optimistic update
    setRatings((prev) => ({ ...prev, [key]: ratingValue }))

    // Fetch keywords if not already on the movie object
    let keywords = movie.keywords || []
    if (!keywords.length && tmdbId) {
      keywords = await getMovieKeywords(tmdbId).catch(() => [])
    }

    const genreIds = (movie.genres || []).map((g) => (typeof g === 'object' ? g.id : g))
    const directorId = movie.director?.id ?? null

    const row = {
      user_id: user.id,
      tmdb_id: tmdbId,
      title: movie.title,
      poster_path: movie.poster_path ?? null,
      genre_ids: genreIds,
      keywords,
      director_id: directorId,
      rating: ratingValue,
      rated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('user_movie_ratings')
      .upsert(row, { onConflict: 'user_id,tmdb_id' })

    if (error) {
      console.error('Rating save failed:', error)
      return
    }

    // Recompute taste profile from updated rows
    setRatingRows((prev) => {
      const updated = prev.filter((r) => r.tmdb_id !== tmdbId).concat(row)
      setTasteProfile(buildTasteProfile(updated))
      return updated
    })
  }, [user])

  const removeRating = useCallback(async (tmdbId) => {
    if (!user) return
    const key = String(tmdbId)
    setRatings((prev) => { const n = { ...prev }; delete n[key]; return n })
    await supabase
      .from('user_movie_ratings')
      .delete()
      .eq('user_id', user.id)
      .eq('tmdb_id', tmdbId)
    setRatingRows((prev) => {
      const updated = prev.filter((r) => r.tmdb_id !== tmdbId)
      setTasteProfile(buildTasteProfile(updated))
      return updated
    })
  }, [user])

  const getRating = useCallback((tmdbId) => ratings[String(tmdbId)] ?? null, [ratings])

  return (
    <RatingsContext.Provider value={{ ratings, ratingRows, tasteProfile, loading, rate, removeRating, getRating }}>
      {children}
    </RatingsContext.Provider>
  )
}

export function useRatings() {
  const ctx = useContext(RatingsContext)
  if (!ctx) throw new Error('useRatings must be used within RatingsProvider')
  return ctx
}
