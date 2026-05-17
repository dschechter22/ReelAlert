const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const PROXY_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/omdb-proxy`

// In-memory cache so the same movie isn't fetched twice per session
const _cache = new Map()

export async function fetchOMDbRatings(imdbId) {
  if (!imdbId) return null
  if (_cache.has(imdbId)) return _cache.get(imdbId)

  try {
    // Pass apikey as a query param (not a header) so the browser sends a
    // simple GET with no custom headers — avoiding a CORS preflight entirely.
    const url = new URL(PROXY_BASE)
    url.searchParams.set('imdb_id', imdbId)
    url.searchParams.set('apikey', SUPABASE_ANON_KEY)

    const res = await fetch(url.toString())
    if (!res.ok) return null
    const data = await res.json()
    _cache.set(imdbId, data)
    return data
  } catch {
    return null
  }
}
