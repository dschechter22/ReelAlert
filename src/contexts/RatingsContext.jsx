import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getMovieDetails } from '../lib/tmdb'
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

    // Fetch full details when needed — gets keywords, cast, production data in one call
    let keywords = movie.keywords || []
    let enrichment = {
      release_year:   movie.release_date ? new Date(movie.release_date).getFullYear() : null,
      director_name:  movie.director?.name ?? null,
      top_cast:       (movie.cast || []).slice(0, 5).map((c) => (typeof c === 'object' ? c.name : c)).filter(Boolean),
      origin_country: movie.origin_country ?? null,
      studio:         movie.studio ?? null,
      collection:     movie.collection ?? null,
    }

    const needsFetch = !keywords.length || !enrichment.origin_country
    if (needsFetch && tmdbId) {
      const details = await getMovieDetails(tmdbId).catch(() => null)
      if (details) {
        if (!keywords.length)
          keywords = (details.keywords?.keywords || []).map((k) => k.name)
        const dir = details.credits?.crew?.find((c) => c.job === 'Director')
        enrichment = {
          release_year:   details.release_date ? new Date(details.release_date).getFullYear() : enrichment.release_year,
          director_name:  dir?.name ?? enrichment.director_name,
          top_cast:       enrichment.top_cast.length
            ? enrichment.top_cast
            : (details.credits?.cast || []).slice(0, 5).map((c) => c.name).filter(Boolean),
          origin_country: details.production_countries?.[0]?.name ?? null,
          studio:         details.production_companies?.[0]?.name ?? null,
          collection:     details.belongs_to_collection?.name ?? null,
        }
      }
    }

    const genreIds = (movie.genres || []).map((g) => (typeof g === 'object' ? g.id : g))
    const directorId = movie.director?.id ?? null

    const defaultWeightMap = { liked: 1, disliked: -1, seen: 0, not_interested: -0.5 }
    const tasteWeight = movie.taste_weight != null ? movie.taste_weight : defaultWeightMap[ratingValue] ?? 0

    const row = {
      user_id: user.id,
      tmdb_id: tmdbId,
      title: movie.title,
      poster_path: movie.poster_path ?? null,
      genre_ids: genreIds,
      keywords,
      director_id: directorId,
      rating: ratingValue,
      taste_weight: tasteWeight,
      rated_at: new Date().toISOString(),
      ...enrichment,
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
