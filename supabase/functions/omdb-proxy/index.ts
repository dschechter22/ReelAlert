/**
 * OMDb API proxy — fetches IMDb + Rotten Tomatoes scores server-side
 * so the OMDb API key is never exposed to the browser.
 *
 * Usage:
 *   GET /functions/v1/omdb-proxy?imdb_id=tt1234567
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

  try {
    const res = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}`)
    const data = await res.json()

    if (data.Response === 'False') {
      return new Response(JSON.stringify({ error: data.Error }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const rtEntry = (data.Ratings || []).find((r: any) => r.Source === 'Rotten Tomatoes')
    const imdbRating = data.imdbRating && data.imdbRating !== 'N/A' ? parseFloat(data.imdbRating) : null
    const rtCritic = rtEntry ? parseInt(rtEntry.Value.replace('%', ''), 10) : null

    return new Response(JSON.stringify({ imdb_score: imdbRating, rt_critic: rtCritic }), {
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
