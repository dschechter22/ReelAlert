const OMDB_API_KEY = import.meta.env.VITE_OMDB_API_KEY
const OMDB_BASE = 'https://www.omdbapi.com'

// In-memory cache so the same movie isn't fetched twice per session
const _cache = new Map()

export async function fetchOMDbRatings(imdbId) {
  if (!imdbId) return null
  if (_cache.has(imdbId)) return _cache.get(imdbId)
  if (!OMDB_API_KEY) return null

  try {
    const url = new URL(OMDB_BASE)
    url.searchParams.set('i', imdbId)
    url.searchParams.set('apikey', OMDB_API_KEY)

    const res = await fetch(url.toString())
    if (!res.ok) return null
    const data = await res.json()
    if (data.Response === 'False') return null

    const rtEntry = (data.Ratings || []).find((r) => r.Source === 'Rotten Tomatoes')
    const imdbParsed = data.imdbRating && data.imdbRating !== 'N/A' ? parseFloat(data.imdbRating) : null
    const rtParsed = rtEntry ? parseInt(rtEntry.Value.replace('%', ''), 10) : null
    const result = {
      imdb_score: Number.isFinite(imdbParsed) ? imdbParsed : null,
      rt_critic: Number.isFinite(rtParsed) ? rtParsed : null,
      letterboxd_score: null,
    }
    _cache.set(imdbId, result)
    return result
  } catch {
    return null
  }
}
