/**
 * AMC API proxy — forwards requests to the AMC Developer API, injecting the
 * vendor key server-side so it's never exposed to the browser.
 *
 * Usage from the frontend:
 *   GET /functions/v1/amc-proxy?path=/v2/theatres&page-number=1&page-size=50
 *   GET /functions/v1/amc-proxy?path=/v2/theatres/42/showtimes/2025-06-01
 *   GET /functions/v1/amc-proxy?path=/v2/showtimes/views/current-location/2025-06-01/40.71/-74.01
 *
 * Required Supabase secret:
 *   AMC_API_KEY
 */

const AMC_BASE = 'https://api.amctheatres.com'
const AMC_API_KEY = Deno.env.get('AMC_API_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: CORS })
  }

  const reqUrl = new URL(req.url)
  const path = reqUrl.searchParams.get('path')
  if (!path || !path.startsWith('/v2/')) {
    return new Response(JSON.stringify({ error: 'Missing or invalid path' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  // Forward all query params except 'path'
  const targetUrl = new URL(`${AMC_BASE}${path}`)
  for (const [k, v] of reqUrl.searchParams.entries()) {
    if (k !== 'path') targetUrl.searchParams.set(k, v)
  }

  try {
    const amcRes = await fetch(targetUrl.toString(), {
      headers: {
        'X-AMC-Vendor-Key': AMC_API_KEY,
        Accept: 'application/json',
      },
    })

    const body = await amcRes.text()
    return new Response(body, {
      status: amcRes.status,
      headers: {
        'Content-Type': amcRes.headers.get('Content-Type') || 'application/json',
        ...CORS,
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
