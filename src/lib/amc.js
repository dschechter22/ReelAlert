/**
 * AMC Developer API client.
 *
 * Calls are routed through the Supabase `amc-proxy` edge function so the
 * AMC vendor key is never exposed in the browser bundle.
 *
 * Required Supabase secret (set via `supabase secrets set AMC_API_KEY=...`):
 *   AMC_API_KEY
 *
 * Required frontend env var:
 *   VITE_SUPABASE_URL  (already needed for Supabase auth)
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const PROXY_BASE = `${SUPABASE_URL}/functions/v1/amc-proxy`
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

async function amcFetch(path, params = {}) {
  const url = new URL(PROXY_BASE)
  url.searchParams.set('path', path)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v))
  }
  const res = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  })
  if (!res.ok) throw new Error(`AMC proxy ${res.status}: ${path}`)
  return res.json()
}

export async function getTheatres(pageNumber = 1, pageSize = 50) {
  return amcFetch('/v2/theatres', { 'page-number': pageNumber, 'page-size': pageSize })
}

export async function getTheatreById(theatreId) {
  return amcFetch(`/v2/theatres/${theatreId}`)
}

export async function getTheatreShowtimes(theatreId, date) {
  return amcFetch(`/v2/theatres/${theatreId}/showtimes/${date ?? todayStr()}`)
}

export async function getShowtimesByLocation(lat, lon, date) {
  return amcFetch(`/v2/showtimes/views/current-location/${date ?? todayStr()}/${lat}/${lon}`)
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

/**
 * Geocode a US zip code to { lat, lon } using OpenStreetMap Nominatim (free, no key needed).
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
 * Find theatres near a zip with showtimes for a given date.
 * Returns an array of { theatre, showtimes } from the location endpoint.
 */
export async function getTheatresNearZip(zip, date) {
  const { lat, lon } = await geocodeZip(zip)
  const data = await getShowtimesByLocation(lat, lon, date)
  const allShowtimes = data?._embedded?.showtimes ?? data?.showtimes ?? []

  const theatreMap = new Map()
  for (const s of allShowtimes) {
    const t = s._embedded?.theatre ?? s.theatre
    if (!t) continue
    const id = t.id
    if (!theatreMap.has(id)) theatreMap.set(id, { theatre: t, showtimes: [] })
    theatreMap.get(id).showtimes.push(s)
  }

  return Array.from(theatreMap.values())
}
