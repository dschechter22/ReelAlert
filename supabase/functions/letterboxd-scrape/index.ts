/**
 * Scrape a public Letterboxd profile's rated films.
 *
 * Query params:
 *   username  – Letterboxd username (required)
 *   maxPages  – max pages to fetch (default 50 = ~3600 films)
 *
 * Returns: { films: [{ title, year, slug, rating }] }
 *   rating  – 0.5–5.0 in half-star increments (null if unrated)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

interface Film {
  title: string
  year: number | null
  slug: string
  rating: number | null  // 0.5–5.0
}

// Extract data-attribute value from HTML string
function attr(html: string, name: string): string | null {
  const re = new RegExp(`${name}="([^"]*)"`)
  const m = html.match(re)
  return m ? m[1] : null
}

// Parse one page of HTML → array of Film
function parsePage(html: string): Film[] {
  const films: Film[] = []

  // Each film lives in a <li class="poster-container"> block
  const containerRe = /<li[^>]+class="[^"]*poster-container[^"]*"[^>]*>([\s\S]*?)<\/li>/g
  let m: RegExpExecArray | null

  while ((m = containerRe.exec(html)) !== null) {
    const block = m[1]

    const slug    = attr(block, 'data-film-slug')
    const title   = attr(block, 'data-film-name') ??
                    attr(block, 'alt') ?? 'Unknown'
    const yearStr = attr(block, 'data-film-release-year')
    const year    = yearStr ? parseInt(yearStr, 10) : null

    // Rating: <span class="rating rated-8"> → 8/2 = 4 stars
    const ratingMatch = block.match(/class="rating rated-(\d+)"/)
    const rating = ratingMatch ? parseInt(ratingMatch[1], 10) / 2 : null

    if (slug) films.push({ title, year, slug, rating })
  }

  return films
}

// Check whether a "next page" link exists
function hasNextPage(html: string, currentPage: number): boolean {
  return html.includes(`/page/${currentPage + 1}/`)
}

async function fetchPage(username: string, page: number): Promise<string> {
  const url = page === 1
    ? `https://letterboxd.com/${username}/films/rated/`
    : `https://letterboxd.com/${username}/films/rated/page/${page}/`

  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })

  if (res.status === 404) throw new Error(`Letterboxd user "${username}" not found.`)
  if (!res.ok)            throw new Error(`Letterboxd returned ${res.status} for page ${page}.`)
  return res.text()
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'GET')    return new Response('Method not allowed', { status: 405, headers: CORS })

  const url      = new URL(req.url)
  const username = url.searchParams.get('username')?.trim().toLowerCase()
  const maxPages = Math.min(parseInt(url.searchParams.get('maxPages') ?? '50', 10), 100)

  if (!username) {
    return new Response(JSON.stringify({ error: 'username param is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  try {
    const allFilms: Film[] = []
    let page = 1

    while (page <= maxPages) {
      const html  = await fetchPage(username, page)
      const films = parsePage(html)
      allFilms.push(...films)

      if (!films.length || !hasNextPage(html, page)) break
      page++

      // Small delay to be polite
      if (page <= maxPages) await new Promise((r) => setTimeout(r, 300))
    }

    return new Response(JSON.stringify({ films: allFilms, pages: page }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
