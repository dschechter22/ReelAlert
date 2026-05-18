/**
 * Taste profile — derives genre/keyword affinities from movie ratings
 * and computes a bonus/penalty to apply on top of ReelScore.
 *
 * Liked movies push affinities positive, disliked push negative.
 * All affinities are normalized to [-1, 1].
 */

export function buildTasteProfile(ratings = []) {
  const genreRaw = {}
  const keywordRaw = {}

  for (const r of ratings) {
    const weight = r.rating === 'liked' ? 1 : r.rating === 'disliked' ? -1 : 0
    if (weight === 0) continue

    for (const id of (r.genre_ids || [])) {
      genreRaw[id] = (genreRaw[id] || 0) + weight
    }
    for (const kw of (r.keywords || [])) {
      keywordRaw[kw] = (keywordRaw[kw] || 0) + weight
    }
  }

  return {
    genre_affinities: normalize(genreRaw),
    keyword_affinities: normalize(keywordRaw),
  }
}

function normalize(obj) {
  const vals = Object.values(obj)
  if (!vals.length) return {}
  const max = Math.max(...vals.map(Math.abs), 1)
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v / max]))
}

/**
 * Returns a bonus in [-maxAdjustment, +maxAdjustment] based on how well
 * the movie's genres/keywords match the user's taste profile.
 */
export function computeTasteBonus(movie, tasteProfile, maxAdjustment = 10) {
  if (!tasteProfile || maxAdjustment === 0) return 0

  const { genre_affinities = {}, keyword_affinities = {} } = tasteProfile
  const movieGenreIds = (movie.genres || []).map((g) => (typeof g === 'object' ? String(g.id) : String(g)))
  const movieKeywords = movie.keywords || []

  const genreScores = movieGenreIds.map((id) => genre_affinities[id] ?? 0).filter((s) => s !== 0)
  const kwScores = movieKeywords.map((k) => keyword_affinities[k] ?? 0).filter((s) => s !== 0)

  const avgGenre = genreScores.length ? avg(genreScores) : 0
  const avgKw = kwScores.length ? avg(kwScores) : 0

  const combined = kwScores.length ? avgGenre * 0.6 + avgKw * 0.4 : avgGenre

  return Math.round(combined * maxAdjustment)
}

/**
 * Human-readable taste summary for the Settings "Taste DNA" section.
 * Returns top liked and disliked genre/keyword labels.
 */
export function summarizeTasteProfile(tasteProfile, genreMap = {}) {
  if (!tasteProfile) return { liked: [], disliked: [] }

  const { genre_affinities = {}, keyword_affinities = {} } = tasteProfile

  const allEntries = [
    ...Object.entries(genre_affinities).map(([id, score]) => ({ label: genreMap[id] || `Genre ${id}`, score })),
    ...Object.entries(keyword_affinities).map(([kw, score]) => ({ label: kw, score })),
  ]

  allEntries.sort((a, b) => b.score - a.score)

  return {
    liked: allEntries.filter((e) => e.score > 0.2).slice(0, 8).map((e) => e.label),
    disliked: allEntries.filter((e) => e.score < -0.2).slice(0, 8).map((e) => e.label),
  }
}

function avg(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length
}
