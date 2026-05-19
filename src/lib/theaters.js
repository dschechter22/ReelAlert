/**
 * Multi-chain theater + showtime client.
 *
 * Calls are routed through the `theaters-scrape` Supabase edge function which
 * uses SerpAPI to pull Google's movie showtime panel — covers all major chains.
 */

import { supabase } from './supabase'

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const PROXY_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/theaters-scrape`

/**
 * Fetch theaters and showtimes near a zip code for a given date.
 *
 * @param {string} zip
 * @param {string} date   YYYY-MM-DD
 * @param {string} [movie]  optional movie title — narrows results to that film
 * @returns {Promise<Theater[]>}
 */
export async function getTheatersNearZip(zip, date, movie) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token ?? SUPABASE_ANON_KEY

  const url = new URL(PROXY_BASE)
  url.searchParams.set('zip', zip.trim())
  url.searchParams.set('date', date)
  if (movie?.trim()) url.searchParams.set('movie', movie.trim())

  const res = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed (${res.status})`)
  }

  const data = await res.json()
  return data.theaters ?? []
}
