export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { imdb_id } = req.query
  if (!imdb_id) return res.status(400).json({ error: 'Missing imdb_id' })

  try {
    const response = await fetch(`https://letterboxd.com/imdb/${imdb_id}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    })

    if (!response.ok) return res.status(200).json({ letterboxd_score: null })

    const html = await response.text()

    // Try JSON-LD structured data first
    const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    if (ldMatch) {
      try {
        const ld = JSON.parse(ldMatch[1])
        const rating = ld?.aggregateRating?.ratingValue
        if (rating != null) {
          const score = parseFloat(rating)
          if (Number.isFinite(score)) return res.status(200).json({ letterboxd_score: score })
        }
      } catch { /* fall through */ }
    }

    // Fallback: meta tag "X.XX out of 5"
    const metaMatch = html.match(/content="([\d.]+) out of 5"/)
    if (metaMatch) {
      const score = parseFloat(metaMatch[1])
      if (Number.isFinite(score)) return res.status(200).json({ letterboxd_score: score })
    }

    return res.status(200).json({ letterboxd_score: null })
  } catch {
    return res.status(200).json({ letterboxd_score: null })
  }
}
