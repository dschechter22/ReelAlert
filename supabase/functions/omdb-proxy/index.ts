/**
 * Ratings proxy — fetches IMDb, RT (via OMDb), and Letterboxd scores
 * server-side so API keys and scraping stay out of the browser.
 *
 * Usage:
 *   GET /functions/v1/omdb-proxy?imdb_id=tt1234567
 *
 * Returns: { imdb_score, rt_critic, letterboxd_score }
 *
 * Required Supabase secret:
 *   OMDB_API_KEY
 */

const OMDB_API_KEY = Deno.env.get('OMDB_API_KEY')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function fetchLetterboxdRating(imdbId: string): Promise<number | null> {
  try {
    const res = await fetch(`https://letterboxd.com/imdb/${imdbId}/`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ReelAlert/1.0; +https://reelalert.app)' },
      redirect: 'follow',
    })
    if (!res.ok) return null
    const html = await res.text()

    // Try JSON-LD structured data first (most reliable)
    const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    if (ldMatch) {
      try {
        const ld = JSON.parse(ldMatch[1])
        const rating = ld?.aggregateRating?.ratingValue
        if (rating != null) return parseFloat(rating)
      } catch { /* fall through */ }
    }

    // Fallback: meta tag "X.XX out of 5"
    const metaMatch = html.match(/content="([\d.]+) out of 5"/)
    if (metaMatch) return parseFloat(metaMatch[1])

    return null
  } catch {
    return null
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: CORS })

  if (!OMDB_API_KEY) {
    return new Response(JSON.stringify({ error: 'OMDB_API_KEY not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  const reqUrl = new URL(req.url)
  const imdbId = reqUrl.searchParams.get('imdb_id')

  if (!imdbId) {
    return new Response(JSON.stringify({ error: 'Missing imdb_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  // Fetch OMDb and Letterboxd in parallel
  const [omdbRes, letterboxdScore] = await Promise.all([
    fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}`).then((r) => r.json()).catch(() => null),
    fetchLetterboxdRating(imdbId),
  ])

  const rtEntry = (omdbRes?.Ratings || []).find((r: any) => r.Source === 'Rotten Tomatoes')
  const imdbRating = omdbRes?.imdbRating && omdbRes.imdbRating !== 'N/A' ? parseFloat(omdbRes.imdbRating) : null
  const rtCritic = rtEntry ? parseInt(rtEntry.Value.replace('%', ''), 10) : null

  return new Response(
    JSON.stringify({ imdb_score: imdbRating, rt_critic: rtCritic, letterboxd_score: letterboxdScore }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } }
  )
})
