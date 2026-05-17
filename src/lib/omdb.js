import { supabase } from './supabase'

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const PROXY_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/omdb-proxy`

// In-memory cache so the same movie isn't fetched twice per session
const _cache = new Map()

export async function fetchOMDbRatings(imdbId) {
  if (!imdbId) return null
  if (_cache.has(imdbId)) return _cache.get(imdbId)

  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token ?? SUPABASE_ANON_KEY

    const url = new URL(PROXY_BASE)
    url.searchParams.set('imdb_id', imdbId)

    const res = await fetch(url.toString(), {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    })

    if (!res.ok) return null
    const data = await res.json()
    _cache.set(imdbId, data)
    return data
  } catch {
    return null
  }
}
