/**
 * ReelScore computation — weighted average of IMDb, RT, TMDB, Letterboxd
 * adjusted by genre/people preferences.
 *
 * Source weights (redistributed when a source is unavailable):
 *   IMDb       35%
 *   RT Critic  30%
 *   TMDB       20%
 *   Letterboxd 15%
 *
 * Buckets:
 *   must-see            ≥ 90
 *   worth-watching      ≥ 75
 *   if-youre-interested ≥ 50
 *   not-for-you         < 50, never genre, or excluded person
 */

export const BUCKET_LABELS = {
  'must-see': 'Must See',
  'worth-watching': 'Worth Watching',
  'if-youre-interested': "If You're Interested",
  'not-for-you': 'Not For You',
}

function weightedBase(movie) {
  const sources = []
  if (movie.imdb_score != null)
    sources.push({ value: Math.round(movie.imdb_score * 10), weight: 0.35 })
  if (movie.rt_critic != null)
    sources.push({ value: movie.rt_critic, weight: 0.30 })
  if (movie.tmdb_score != null && movie.tmdb_score > 0)
    sources.push({ value: Math.round(movie.tmdb_score * 10), weight: 0.20 })
  if (movie.letterboxd_score != null)
    sources.push({ value: Math.round(movie.letterboxd_score * 20), weight: 0.15 })

  if (!sources.length) return 50
  const totalWeight = sources.reduce((s, x) => s + x.weight, 0)
  return Math.round(sources.reduce((s, x) => s + x.value * x.weight, 0) / totalWeight)
}

/**
 * @param {object} movie      – tmdb_score, imdb_score, rt_critic, letterboxd_score, genres, cast, director
 * @param {object} userPrefs
 *   - genrePreferences:   Array<{ genre_id, priority }>  priority: must_see | fine | never
 *   - peoplePreferences:  Array<{ tmdb_person_id, preference_type }>  favorite | excluded
 * @returns {{ score, bucket, bucketLabel, breakdown }}
 */
export function computeReelScore(movie, userPrefs = {}) {
  const { genrePreferences = [], peoplePreferences = [] } = userPrefs

  const movieGenreIds = (movie.genres || []).map((g) => (typeof g === 'object' ? g.id : g))
  const movieCastIds = (movie.cast || []).map((c) => (typeof c === 'object' ? c.id : c))
  const directorId = movie.director?.id ?? movie.director

  // Genre flags
  const neverGenreIds   = genrePreferences.filter((gp) => gp.priority === 'never').map((gp) => gp.genre_id)
  const mustSeeGenreIds = genrePreferences.filter((gp) => gp.priority === 'must_see').map((gp) => gp.genre_id)
  const hasNeverGenre   = neverGenreIds.some((id) => movieGenreIds.includes(id))
  const hasMustSeeGenre = mustSeeGenreIds.some((id) => movieGenreIds.includes(id))

  // People flags
  const favoriteIds = peoplePreferences.filter((p) => p.preference_type === 'favorite').map((p) => p.tmdb_person_id)
  const excludedIds = peoplePreferences.filter((p) => p.preference_type === 'excluded').map((p) => p.tmdb_person_id)
  const hasFavoritePerson =
    favoriteIds.some((id) => movieCastIds.includes(id)) ||
    (directorId != null && favoriteIds.includes(directorId))
  const hasExcludedPerson =
    excludedIds.some((id) => movieCastIds.includes(id)) ||
    (directorId != null && excludedIds.includes(directorId))

  const baseScore = weightedBase(movie)

  let score = baseScore
  if (hasMustSeeGenre)   score = Math.min(100, score + 10)
  if (hasFavoritePerson) score = Math.min(100, score + 15)
  if (hasNeverGenre)     score = Math.max(0,   score - 25)
  if (hasExcludedPerson) score = Math.max(0,   score - 30)

  let bucket
  if (hasNeverGenre || hasExcludedPerson) {
    bucket = 'not-for-you'
  } else if (score >= 90) {
    bucket = 'must-see'
  } else if (score >= 75) {
    bucket = 'worth-watching'
  } else if (score >= 50) {
    bucket = 'if-youre-interested'
  } else {
    bucket = 'not-for-you'
  }

  return {
    score,
    bucket,
    bucketLabel: BUCKET_LABELS[bucket],
    breakdown: {
      baseScore,
      hasMustSeeGenre,
      hasNeverGenre,
      hasFavoritePerson,
      hasExcludedPerson,
      sources: {
        imdb: {
          value: movie.imdb_score,
          displayValue: movie.imdb_score != null ? `${movie.imdb_score}/10` : 'N/A',
        },
        rt_critic: {
          value: movie.rt_critic,
          displayValue: movie.rt_critic != null ? `${movie.rt_critic}%` : 'N/A',
        },
        tmdb: {
          value: movie.tmdb_score,
          displayValue: movie.tmdb_score != null ? `${movie.tmdb_score}/10` : 'N/A',
        },
        letterboxd: {
          value: movie.letterboxd_score,
          displayValue: movie.letterboxd_score != null ? `${movie.letterboxd_score}/5` : 'N/A',
        },
      },
    },
  }
}
