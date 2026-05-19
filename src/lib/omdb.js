// In-memory cache so the same movie isn't fetched twice per session
const _cache = new Map()

export async function fetchOMDbRatings(imdbId) {
  if (!imdbId) return null
  if (_cache.has(imdbId)) return _cache.get(imdbId)

  try {
    const res = await fetch(`/api/omdb?imdb_id=${imdbId}`)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      console.error(`[omdb] ${res.status} for ${imdbId}:`, body.error ?? res.statusText)
      return null
    }
    const data = await res.json()

    if (data._omdb_error) {
      console.error(`[omdb] API error for ${imdbId}: ${data._omdb_error}`)
    }

    const result = {
      imdb_score: Number.isFinite(data.imdb_score) ? data.imdb_score : null,
      rt_critic: Number.isFinite(data.rt_critic) ? data.rt_critic : null,
      letterboxd_score: Number.isFinite(data.letterboxd_score) ? data.letterboxd_score : null,
    }
    _cache.set(imdbId, result)
    return result
  } catch (err) {
    console.error(`[omdb] fetch failed for ${imdbId}:`, err.message)
    return null
  }
}
