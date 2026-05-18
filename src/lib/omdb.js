const OMDB_API_KEY = import.meta.env.VITE_OMDB_API_KEY
const OMDB_BASE = 'https://www.omdbapi.com'
const LETTERBOXD_API = '/api/letterboxd'

// In-memory cache so the same movie isn't fetched twice per session
const _cache = new Map()

async function fetchLetterboxdScore(imdbId) {
  try {
    const res = await fetch(`${LETTERBOXD_API}?imdb_id=${imdbId}`)
    if (!res.ok) return null
    const data = await res.json()
    return Number.isFinite(data.letterboxd_score) ? data.letterboxd_score : null
  } catch {
    return null
  }
}

export async function fetchOMDbRatings(imdbId) {
  if (!imdbId) return null
  if (_cache.has(imdbId)) return _cache.get(imdbId)
  if (!OMDB_API_KEY) return null

  try {
    const url = new URL(OMDB_BASE)
    url.searchParams.set('i', imdbId)
    url.searchParams.set('apikey', OMDB_API_KEY)

    const [omdbRes, letterboxd_score] = await Promise.all([
      fetch(url.toString()).then((r) => r.json()).catch(() => null),
      fetchLetterboxdScore(imdbId),
    ])

    if (!omdbRes || omdbRes.Response === 'False') return null

    const rtEntry = (omdbRes.Ratings || []).find((r) => r.Source === 'Rotten Tomatoes')
    const imdbParsed = omdbRes.imdbRating && omdbRes.imdbRating !== 'N/A' ? parseFloat(omdbRes.imdbRating) : null
    const rtParsed = rtEntry ? parseInt(rtEntry.Value.replace('%', ''), 10) : null

    const result = {
      imdb_score: Number.isFinite(imdbParsed) ? imdbParsed : null,
      rt_critic: Number.isFinite(rtParsed) ? rtParsed : null,
      letterboxd_score,
    }
    _cache.set(imdbId, result)
    return result
  } catch {
    return null
  }
}
