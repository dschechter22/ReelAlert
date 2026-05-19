export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { imdb_id } = req.query
  if (!imdb_id) return res.status(400).json({ error: 'Missing imdb_id' })

  const OMDB_API_KEY = process.env.OMDB_API_KEY || process.env.VITE_OMDB_API_KEY
  if (!OMDB_API_KEY) {
    return res.status(503).json({ error: 'OMDB_API_KEY not configured' })
  }

  try {
    const [omdbData, lbRes] = await Promise.all([
      fetch(`https://www.omdbapi.com/?i=${imdb_id}&apikey=${OMDB_API_KEY}`)
        .then((r) => r.json())
        .catch(() => null),
      fetch(`https://letterboxd.com/imdb/${imdb_id}/`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        redirect: 'follow',
      }).catch(() => null),
    ])

    // Parse OMDb
    if (!omdbData) {
      console.error('[omdb-proxy] OMDb fetch failed (network error)')
    } else if (omdbData.Response === 'False') {
      console.error('[omdb-proxy] OMDb API error:', omdbData.Error)
    }
    const rtEntry = (omdbData?.Ratings || []).find((r) => r.Source === 'Rotten Tomatoes')
    const imdb_score =
      omdbData?.imdbRating && omdbData.imdbRating !== 'N/A'
        ? parseFloat(omdbData.imdbRating)
        : null
    const rt_critic = rtEntry ? parseInt(rtEntry.Value.replace('%', ''), 10) : null

    // Parse Letterboxd
    let letterboxd_score = null
    if (lbRes?.ok) {
      const html = await lbRes.text()
      const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
      if (ldMatch) {
        try {
          const ld = JSON.parse(ldMatch[1])
          const r = ld?.aggregateRating?.ratingValue
          if (r != null) letterboxd_score = parseFloat(r)
        } catch { /* fall through */ }
      }
      if (letterboxd_score == null) {
        const metaMatch = html.match(/content="([\d.]+) out of 5"/)
        if (metaMatch) letterboxd_score = parseFloat(metaMatch[1])
      }
    }

    return res.status(200).json({
      imdb_score: Number.isFinite(imdb_score) ? imdb_score : null,
      rt_critic: Number.isFinite(rt_critic) ? rt_critic : null,
      letterboxd_score: Number.isFinite(letterboxd_score) ? letterboxd_score : null,
      _omdb_error: omdbData?.Response === 'False' ? omdbData.Error : undefined,
    })
  } catch {
    return res.status(200).json({ imdb_score: null, rt_critic: null, letterboxd_score: null })
  }
}
