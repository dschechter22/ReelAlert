/**
 * Multi-chain theater showtimes aggregator.
 *
 * Fetches from AMC (official API), Cinemark (internal JSON API), and Regal
 * (internal JSON API) concurrently. Each chain is independently error-isolated
 * — if one fails the others still return.
 *
 * Query params:
 *   lat      – decimal latitude (required)
 *   lon      – decimal longitude (required)
 *   radius   – search radius in miles (default 15)
 *   date     – YYYY-MM-DD (default today)
 *   chains   – comma-separated list: amc,cinemark,regal (default all)
 *
 * Required Supabase secrets:
 *   AMC_API_KEY  (optional — AMC results skipped when absent)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BROWSER_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

// ── type ─────────────────────────────────────────────────────────────────────

interface ShowBlock {
  format: string
  times: string[]
}

interface MovieEntry {
  movieTitle: string
  posterPath?: string
  tmdbId?: number
  formats: ShowBlock[]
}

interface Theater {
  id: string
  chain: 'amc' | 'cinemark' | 'regal' | 'other'
  name: string
  address: string
  distance?: number
  ticketUrl?: string
  showtimes: MovieEntry[]
}

// ── helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  } catch {
    return iso
  }
}

// ── AMC ──────────────────────────────────────────────────────────────────────

async function fetchAmc(lat: number, lon: number, radius: number, date: string): Promise<Theater[]> {
  const AMC_API_KEY = Deno.env.get('AMC_API_KEY')
  if (!AMC_API_KEY) return []

  const url = `https://api.amctheatres.com/v2/showtimes/views/current-location/${date}/${lat}/${lon}`
  const res = await fetch(url, {
    headers: { 'X-AMC-Vendor-Key': AMC_API_KEY, Accept: 'application/json' },
  })
  if (!res.ok) return []
  const data = await res.json()

  const allShowtimes = data?._embedded?.showtimes ?? data?.showtimes ?? []
  const theatreMap = new Map<string | number, Theater>()

  for (const s of allShowtimes) {
    const t = s._embedded?.theatre ?? s.theatre
    if (!t) continue
    const id = String(t.id)

    if (!theatreMap.has(id)) {
      theatreMap.set(id, {
        id: `amc-${id}`,
        chain: 'amc',
        name: t.name,
        address: [t.street, t.city, t.state, t.postalCode].filter(Boolean).join(', '),
        ticketUrl: `https://www.amctheatres.com/movie-theatres/${id}`,
        showtimes: [],
      })
    }

    const theatre = theatreMap.get(id)!
    const movie = s._embedded?.movie ?? s.movie ?? {}
    const title = movie.name ?? movie.title ?? s.movieName ?? 'Unknown'
    const format = s.attributeIds?.[0] ?? s.format ?? 'Standard'
    const time = s.showDateTimeLocal ?? s.performanceTime ?? s.startTime
    if (!time) continue

    let entry = theatre.showtimes.find((e) => e.movieTitle === title)
    if (!entry) {
      entry = { movieTitle: title, formats: [] }
      theatre.showtimes.push(entry)
    }
    let block = entry.formats.find((f) => f.format === format)
    if (!block) { block = { format, times: [] }; entry.formats.push(block) }
    block.times.push(fmtTime(time))
  }

  return Array.from(theatreMap.values())
}

// ── Cinemark ──────────────────────────────────────────────────────────────────

async function fetchCinemark(lat: number, lon: number, radius: number, date: string): Promise<Theater[]> {
  // Cinemark's internal mobile/web API — no auth required
  const nearbyUrl = `https://www.cinemark.com/api/v1/theaters/nearby?lat=${lat}&lng=${lon}&radius=${radius}`
  const nearbyRes = await fetch(nearbyUrl, {
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
  })
  if (!nearbyRes.ok) return []
  const nearbyData = await nearbyRes.json()

  const theaters: Array<{ id: string; name: string; address: string; city: string; state: string; zip: string; distance?: number }> =
    nearbyData?.theaters ?? nearbyData?.data ?? []

  if (!theaters.length) return []

  // Fetch showtimes for all theaters in parallel (limit to first 10 to avoid timeout)
  const results = await Promise.allSettled(
    theaters.slice(0, 10).map(async (t) => {
      const addr = [t.address, t.city, t.state, t.zip].filter(Boolean).join(', ')
      const theater: Theater = {
        id: `cinemark-${t.id}`,
        chain: 'cinemark',
        name: t.name,
        address: addr,
        distance: t.distance,
        ticketUrl: `https://www.cinemark.com/theatre/${t.id}`,
        showtimes: [],
      }

      try {
        const stUrl = `https://www.cinemark.com/api/v1/showtimes/${t.id}/${date}`
        const stRes = await fetch(stUrl, {
          headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
        })
        if (stRes.ok) {
          const stData = await stRes.json()
          const movies: unknown[] = stData?.movies ?? stData?.data?.movies ?? stData?.showtimes ?? []

          for (const m of movies as Record<string, unknown>[]) {
            const title = (m.title ?? m.name ?? m.movieTitle) as string
            if (!title) continue
            const entry: MovieEntry = { movieTitle: title, formats: [] }

            // Cinemark groups by experience/format
            const experiences: unknown[] = (m.experiences ?? m.formats ?? m.showtimes ?? []) as unknown[]
            for (const exp of experiences as Record<string, unknown>[]) {
              const fmt = (exp.experience ?? exp.format ?? exp.name ?? 'Standard') as string
              const rawTimes: unknown[] = (exp.times ?? exp.showtimes ?? []) as unknown[]
              const times = rawTimes
                .map((t: unknown) => {
                  const ts = (typeof t === 'object' && t !== null)
                    ? ((t as Record<string, unknown>).time ?? (t as Record<string, unknown>).startTime ?? '') as string
                    : String(t)
                  return ts ? fmtTime(ts) : null
                })
                .filter(Boolean) as string[]

              if (times.length) entry.formats.push({ format: fmt, times })
            }

            if (entry.formats.length) theater.showtimes.push(entry)
          }
        }
      } catch {
        // showtime fetch failed — return theater without showtimes
      }

      return theater
    }),
  )

  return results
    .filter((r): r is PromiseFulfilledResult<Theater> => r.status === 'fulfilled')
    .map((r) => r.value)
}

// ── Regal ─────────────────────────────────────────────────────────────────────

async function fetchRegal(lat: number, lon: number, radius: number, date: string): Promise<Theater[]> {
  // Regal uses DX (digital experience) platform — their internal API
  const nearbyUrl = `https://www.regmovies.com/api/v1/theaters/search?lat=${lat}&lon=${lon}&radius=${radius}`
  const nearbyRes = await fetch(nearbyUrl, {
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
  })
  if (!nearbyRes.ok) return []
  const nearbyData = await nearbyRes.json()

  const theaters: Array<{ id: string; slug?: string; name: string; address1?: string; city?: string; state?: string; zip?: string; distance?: number }> =
    nearbyData?.theaters ?? nearbyData?.data ?? nearbyData?.results ?? []

  if (!theaters.length) return []

  const results = await Promise.allSettled(
    theaters.slice(0, 10).map(async (t) => {
      const addr = [t.address1, t.city, t.state, t.zip].filter(Boolean).join(', ')
      const theater: Theater = {
        id: `regal-${t.id}`,
        chain: 'regal',
        name: t.name,
        address: addr,
        distance: t.distance,
        ticketUrl: t.slug
          ? `https://www.regmovies.com/theaters/${t.slug}/${t.id}`
          : `https://www.regmovies.com`,
        showtimes: [],
      }

      try {
        const stUrl = `https://www.regmovies.com/api/v1/showtimes/theater/${t.id}/${date}`
        const stRes = await fetch(stUrl, {
          headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
        })
        if (stRes.ok) {
          const stData = await stRes.json()
          const movies: unknown[] = stData?.movies ?? stData?.data ?? stData?.showtimes ?? []

          for (const m of movies as Record<string, unknown>[]) {
            const title = (m.title ?? m.name ?? m.movieTitle) as string
            if (!title) continue
            const entry: MovieEntry = { movieTitle: title, formats: [] }

            const variants: unknown[] = (m.variants ?? m.formats ?? m.experiences ?? []) as unknown[]
            for (const v of variants as Record<string, unknown>[]) {
              const fmt = (v.format ?? v.name ?? v.experience ?? 'Standard') as string
              const rawTimes: unknown[] = (v.times ?? v.showtimes ?? []) as unknown[]
              const times = rawTimes
                .map((t: unknown) => {
                  const ts = typeof t === 'string' ? t :
                    (t as Record<string, unknown>)?.performanceTime as string ?? ''
                  return ts ? fmtTime(ts) : null
                })
                .filter(Boolean) as string[]

              if (times.length) entry.formats.push({ format: fmt, times })
            }

            if (entry.formats.length) theater.showtimes.push(entry)
          }
        }
      } catch {
        // showtime fetch failed
      }

      return theater
    }),
  )

  return results
    .filter((r): r is PromiseFulfilledResult<Theater> => r.status === 'fulfilled')
    .map((r) => r.value)
}

// ── main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: CORS })

  const url = new URL(req.url)
  const lat = parseFloat(url.searchParams.get('lat') ?? '')
  const lon = parseFloat(url.searchParams.get('lon') ?? '')
  const radius = parseFloat(url.searchParams.get('radius') ?? '15')
  const date = url.searchParams.get('date') ?? todayStr()
  const chainsParam = url.searchParams.get('chains') ?? 'amc,cinemark,regal'
  const chains = chainsParam.split(',').map((c) => c.trim().toLowerCase())

  if (isNaN(lat) || isNaN(lon)) {
    return new Response(JSON.stringify({ error: 'lat and lon are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  const fetchers: Promise<Theater[]>[] = []
  if (chains.includes('amc'))      fetchers.push(fetchAmc(lat, lon, radius, date).catch(() => []))
  if (chains.includes('cinemark')) fetchers.push(fetchCinemark(lat, lon, radius, date).catch(() => []))
  if (chains.includes('regal'))    fetchers.push(fetchRegal(lat, lon, radius, date).catch(() => []))

  const allResults = await Promise.all(fetchers)
  const theaters = allResults.flat()

  // Sort by distance (theaters without distance go to end)
  theaters.sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999))

  return new Response(JSON.stringify({ theaters }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
})
