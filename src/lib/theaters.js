/**
 * Multi-chain theater + showtime client.
 *
 * Calls are routed through the `theaters-scrape` Supabase edge function which
 * aggregates AMC, Cinemark, and Regal concurrently.
 */

import { supabase } from './supabase'

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const PROXY_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/theaters-scrape`

/**
 * Geocode a US zip code to { lat, lon } via OpenStreetMap Nominatim (free, no key).
 */
export async function geocodeZip(zip) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(zip)}&countrycodes=us&format=json&limit=1`
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
  if (!res.ok) throw new Error(`Geocode failed: ${res.status}`)
  const data = await res.json()
  if (!data.length) throw new Error(`No location found for zip: ${zip}`)
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
}

/**
 * Detect the theater chain from the theater name.
 */
export function detectChain(name = '') {
  const n = name.toLowerCase()
  if (n.includes('amc'))      return 'amc'
  if (n.includes('regal'))    return 'regal'
  if (n.includes('cinemark')) return 'cinemark'
  if (n.includes('alamo'))    return 'alamo'
  if (n.includes('marcus'))   return 'marcus'
  if (n.includes('landmark')) return 'landmark'
  if (n.includes('ipic'))     return 'ipic'
  return 'other'
}

/**
 * Fetch theaters and showtimes near a zip code.
 *
 * @param {string} zip
 * @param {string} date  YYYY-MM-DD
 * @param {number} radiusMiles  default 15
 * @param {string[]} chains  default all
 * @returns {Promise<Theater[]>}
 */
export async function getTheatersNearZip(zip, date, radiusMiles = 15, chains = ['amc', 'cinemark', 'regal']) {
  const { lat, lon } = await geocodeZip(zip)

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token ?? SUPABASE_ANON_KEY

  const url = new URL(PROXY_BASE)
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lon))
  url.searchParams.set('radius', String(radiusMiles))
  url.searchParams.set('date', date)
  url.searchParams.set('chains', chains.join(','))

  const res = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) throw new Error(`Theaters proxy ${res.status}`)
  const data = await res.json()

  // Attach chain detection for any theaters the backend couldn't classify
  return (data.theaters ?? []).map((t) => ({
    ...t,
    chain: t.chain ?? detectChain(t.name),
  }))
}
