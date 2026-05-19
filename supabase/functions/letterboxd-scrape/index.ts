/**
 * Scrape a public Letterboxd profile's rated films.
 *
 * Tries two approaches in order:
 *   1. HTML /films/rated/ pages (full history, but Cloudflare often blocks)
 *   2. RSS feed (recent ~200 diary entries, more Cloudflare-tolerant)
 *
 * Query params:
 *   username  – Letterboxd username (required)
 *   maxPages  – max HTML pages to fetch (default 50 = ~3600 films)
 *
 * Returns: { films, source: "html"|"rss", pages? }
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
  rating: number | null
}

// ── HTML scraping ─────────────────────────────────────────────────────────────

function attr(html: string, name: string): string | null {
  const m = html.match(new RegExp(`${name}="([^"]*)"`) )
  return m ? m[1] : null
}

function parsePage(html: string): Film[] {
  const films: Film[] = []
  const re = /<li[^>]+class="[^"]*poster-container[^"]*"[^>]*>([\s\S]*?)<\/li>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const block = m[1]
    const slug    = attr(block, 'data-film-slug')
    const title   = attr(block, 'data-film-name') ?? attr(block, 'alt') ?? 'Unknown'
    const yearStr = attr(block, 'data-film-release-year')
    const year    = yearStr ? parseInt(yearStr, 10) : null
    const rm      = block.match(/class="rating rated-(\d+)"/)
    const rating  = rm ? parseInt(rm[1], 10) / 2 : null
    if (slug) films.push({ title, year, slug, rating })
  }
  return films
}

async function scrapeHtml(username: string, maxPages: number): Promise<Film[]> {
  const all: Film[] = []
  for (let page = 1; page <= maxPages; page++) {
    const url = page === 1
      ? `https://letterboxd.com/${username}/films/rated/`
      : `https://letterboxd.com/${username}/films/rated/page/${page}/`

    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
    })

    if (res.status === 404) throw new Error(`User "${username}" not found on Letterboxd.`)
    if (res.status === 403 || res.status === 503) throw new Error(`CLOUDFLARE_BLOCKED`)
    if (!res.ok) throw new Error(`Letterboxd returned HTTP ${res.status}.`)

    const html  = await res.text()
    const films = parsePage(html)
    all.push(...films)
    if (!films.length || !html.includes(`/page/${page + 1}/`)) break
    if (page < maxPages) await new Promise((r) => setTimeout(r, 300))
  }
  return all
}

// ── RSS fallback ──────────────────────────────────────────────────────────────
// RSS is limited to ~200 recent diary entries but bypasses Cloudflare more often.

function parseRss(xml: string): Film[] {
  const films: Film[] = []
  const itemRe = /<item>([\s\S]*?)<\/item>/g
  let m: RegExpExecArray | null

  while ((m = itemRe.exec(xml)) !== null) {
    const item = m[1]

    // <letterboxd:filmTitle>...</letterboxd:filmTitle>
    const titleM = item.match(/<letterboxd:filmTitle[^>]*>([\s\S]*?)<\/letterboxd:filmTitle>/)
    const yearM  = item.match(/<letterboxd:filmYear[^>]*>(\d+)<\/letterboxd:filmYear>/)
    const ratingM = item.match(/<letterboxd:memberRating[^>]*>([\d.]+)<\/letterboxd:memberRating>/)

    // extract slug from <link> like https://letterboxd.com/user/film/spirited-away/
    const linkM = item.match(/<link>(https:\/\/letterboxd\.com\/[^/]+\/film\/([^/]+)\/)<\/link>/)

    const title  = titleM ? titleM[1].trim() : null
    const slug   = linkM  ? linkM[2] : null
    const year   = yearM  ? parseInt(yearM[1], 10) : null
    const rating = ratingM ? parseFloat(ratingM[1]) : null

    if (title && slug) films.push({ title, year, slug, rating })
  }

  return films
}

async function scrapeRss(username: string): Promise<Film[]> {
  const res = await fetch(`https://letterboxd.com/${username}/rss/`, {
    headers: { 'User-Agent': UA, Accept: 'application/rss+xml,application/xml,text/xml' },
  })
  if (res.status === 404) throw new Error(`User "${username}" not found on Letterboxd.`)
  if (!res.ok) throw new Error(`RSS feed returned HTTP ${res.status}.`)
  const xml = await res.text()
  return parseRss(xml)
}

// ── main ──────────────────────────────────────────────────────────────────────

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

  // Try HTML first, fall back to RSS if Cloudflare blocks
  try {
    const films = await scrapeHtml(username, maxPages)
    return new Response(JSON.stringify({ films, source: 'html' }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  } catch (htmlErr) {
    const msg = String(htmlErr)
    if (!msg.includes('CLOUDFLARE_BLOCKED') && !msg.includes('not found')) {
      return new Response(JSON.stringify({ error: msg }), {
        status: 502, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }
    if (msg.includes('not found')) {
      return new Response(JSON.stringify({ error: msg.replace('Error: ', '') }), {
        status: 404, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // Cloudflare blocked HTML — try RSS
    try {
      const films = await scrapeRss(username)
      return new Response(JSON.stringify({
        films,
        source: 'rss',
        warning: 'Full history unavailable (Letterboxd blocks server scraping). Imported from RSS feed — covers recent diary entries only.',
      }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    } catch (rssErr) {
      return new Response(JSON.stringify({
        error: 'Letterboxd is blocking server-side access. Please use the CSV export instead: letterboxd.com → Settings → Import & Export → Export Your Data.',
      }), {
        status: 502, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }
  }
})
