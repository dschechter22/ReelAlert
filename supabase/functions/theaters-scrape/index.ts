/**
 * Theater showtimes via SerpAPI Google Showtimes.
 *
 * Searches Google for "movies near [zip]" and extracts the structured
 * showtimes panel that Google renders for all major chains.
 *
 * Query params:
 *   zip      – US zip code (required)
 *   date     – YYYY-MM-DD (default today; used to select the right day bucket)
 *   radius   – ignored here, Google uses its own proximity logic
 *
 * Required Supabase secret:
 *   SERPAPI_KEY
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── types ─────────────────────────────────────────────────────────────────────

interface ShowBlock {
  format: string
  times: string[]
}

interface MovieEntry {
  movieTitle: string
  formats: ShowBlock[]
}

interface Theater {
  id: string
  chain: string
  name: string
  address: string
  distance?: number
  ticketUrl?: string
  showtimes: MovieEntry[]
}

// ── chain detection ───────────────────────────────────────────────────────────

function detectChain(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('amc'))      return 'amc'
  if (n.includes('regal'))    return 'regal'
  if (n.includes('cinemark')) return 'cinemark'
  if (n.includes('alamo'))    return 'alamo'
  if (n.includes('marcus'))   return 'marcus'
  if (n.includes('landmark')) return 'landmark'
  if (n.includes('ipic'))     return 'ipic'
  if (n.includes('harkins'))  return 'harkins'
  if (n.includes('showcase')) return 'showcase'
  if (n.includes('bow tie') || n.includes('bow-tie')) return 'bowtie'
  return 'other'
}

function parseDistance(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  const m = raw.match(/([\d.]+)/)
  return m ? parseFloat(m[1]) : undefined
}

// ── SerpAPI call ──────────────────────────────────────────────────────────────

async function fetchSerpShowtimes(zip: string, date: string, apiKey: string): Promise<Theater[]> {
  const params = new URLSearchParams({
    engine:  'google',
    q:       `movies near ${zip}`,
    location: zip,
    hl:      'en',
    gl:      'us',
    api_key: apiKey,
  })

  const res = await fetch(`https://serpapi.com/search.json?${params}`)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`SerpAPI ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json()

  // SerpAPI returns showtimes as an array of day buckets.
  // Each bucket: { day: "Today"|"Tomorrow"|weekday, date: "Nov 8", theaters: [...] }
  // or: { day, date, movies: [...] } depending on how Google renders it.
  const buckets: unknown[] = data.showtimes ?? []
  if (!buckets.length) return []

  // Pick the bucket matching the requested date
  const targetBucket = pickBucket(buckets, date)
  if (!targetBucket) return []

  return parseTheaters(targetBucket)
}

// ── date bucket matching ──────────────────────────────────────────────────────

function pickBucket(buckets: unknown[], date: string): Record<string, unknown> | null {
  const target = new Date(date + 'T12:00:00')
  const today  = new Date()
  today.setHours(12, 0, 0, 0)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000)

  // Try matching by day label first
  const dayLabels: Record<number, string[]> = {
    0: ['today'],
    1: ['tomorrow'],
    2: ['in 2 days'],
  }
  const labels = dayLabels[diffDays] ?? []

  for (const bucket of buckets as Record<string, unknown>[]) {
    const day = String(bucket.day ?? '').toLowerCase()
    if (labels.some((l) => day.includes(l))) return bucket

    // Fall back to matching the date string (e.g. "Nov 8" vs "2026-11-08")
    const dateStr = String(bucket.date ?? '')
    if (dateStr && matchesDate(dateStr, date)) return bucket
  }

  // Default to first bucket (today)
  return (buckets[0] as Record<string, unknown>) ?? null
}

function matchesDate(serpDate: string, isoDate: string): boolean {
  try {
    const parsed = new Date(`${serpDate} ${new Date().getFullYear()}`)
    return parsed.toISOString().startsWith(isoDate)
  } catch {
    return false
  }
}

// ── theater/showtime parsing ──────────────────────────────────────────────────
// Google's panel can be structured two ways depending on the search:
//   A) theater-first: bucket.theaters[].{name,address,movies[].{name,showing[].{type,time[]}}}
//   B) movie-first:   bucket.movies[].{name,showing[].{theater.{name,address},type,time[]}}
// We handle both.

function parseTheaters(bucket: Record<string, unknown>): Theater[] {
  if (Array.isArray(bucket.theaters) && bucket.theaters.length) {
    return parseTheaterFirst(bucket.theaters as Record<string, unknown>[])
  }
  if (Array.isArray(bucket.movies) && bucket.movies.length) {
    return parseMovieFirst(bucket.movies as Record<string, unknown>[])
  }
  return []
}

function parseTheaterFirst(theaters: Record<string, unknown>[]): Theater[] {
  return theaters.map((t, i) => {
    const movies: MovieEntry[] = []

    for (const m of (t.movies ?? []) as Record<string, unknown>[]) {
      const title = String(m.name ?? m.title ?? 'Unknown')
      const formats: ShowBlock[] = []

      for (const s of (m.showing ?? m.showtimes ?? []) as Record<string, unknown>[]) {
        const fmt = String(s.type ?? s.format ?? 'Standard')
        const times = normaliseTimeArray(s.time ?? s.times ?? [])
        if (times.length) formats.push({ format: fmt, times })
      }

      if (formats.length) movies.push({ movieTitle: title, formats })
    }

    const name = String(t.name ?? `Theater ${i + 1}`)
    return {
      id:        `serp-${i}-${name.replace(/\W/g, '').toLowerCase()}`,
      chain:     detectChain(name),
      name,
      address:   String(t.address ?? ''),
      distance:  parseDistance(t.distance as string),
      ticketUrl: t.link as string | undefined,
      showtimes: movies,
    }
  })
}

function parseMovieFirst(movies: Record<string, unknown>[]): Theater[] {
  // Pivot: collect theaters, attach movies to them
  const theaterMap = new Map<string, Theater>()

  for (const m of movies) {
    const title = String(m.name ?? m.title ?? 'Unknown')

    for (const s of (m.showing ?? m.showtimes ?? []) as Record<string, unknown>[]) {
      const theater = (s.theater ?? s.theatre ?? {}) as Record<string, unknown>
      const name    = String(theater.name ?? 'Unknown Theater')
      const key     = name.toLowerCase().replace(/\W/g, '')

      if (!theaterMap.has(key)) {
        theaterMap.set(key, {
          id:        `serp-${key}`,
          chain:     detectChain(name),
          name,
          address:   String(theater.address ?? ''),
          distance:  parseDistance(theater.distance as string),
          ticketUrl: theater.link as string | undefined,
          showtimes: [],
        })
      }

      const fmt   = String(s.type ?? s.format ?? 'Standard')
      const times = normaliseTimeArray(s.time ?? s.times ?? [])
      if (!times.length) continue

      const entry = theaterMap.get(key)!
      let movie = entry.showtimes.find((e) => e.movieTitle === title)
      if (!movie) { movie = { movieTitle: title, formats: [] }; entry.showtimes.push(movie) }

      let block = movie.formats.find((f) => f.format === fmt)
      if (!block) { block = { format: fmt, times: [] }; movie.formats.push(block) }
      block.times.push(...times)
    }
  }

  return Array.from(theaterMap.values())
}

function normaliseTimeArray(raw: unknown): string[] {
  if (!raw) return []
  const arr = Array.isArray(raw) ? raw : [raw]
  return arr
    .map((t) => (typeof t === 'string' ? t : String((t as Record<string,unknown>)?.time ?? t)))
    .filter(Boolean)
}

// ── main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'GET')    return new Response('Method not allowed', { status: 405, headers: CORS })

  const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY')
  if (!SERPAPI_KEY) {
    return new Response(JSON.stringify({ error: 'SERPAPI_KEY secret is not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  const url  = new URL(req.url)
  const zip  = url.searchParams.get('zip')?.trim()
  const date = url.searchParams.get('date') ?? new Date().toISOString().split('T')[0]

  if (!zip) {
    return new Response(JSON.stringify({ error: 'zip param is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  try {
    const theaters = await fetchSerpShowtimes(zip, date, SERPAPI_KEY)
    theaters.sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999))

    return new Response(JSON.stringify({ theaters }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
