/**
 * ReelScore computation — based solely on TMDB score + genre/people preferences.
 *
 * Buckets:
 *   must-see            — good TMDB score AND a must-see genre or favorited person
 *   worth-watching      — good TMDB score, neutral genres
 *   if-youre-interested — mediocre TMDB score but not disqualified
 *   not-for-you         — low score, never genre, or excluded person
 */

export const BUCKET_LABELS = {
  'must-see': 'Must See',
  'worth-watching': 'Worth Watching',
  'if-youre-interested': "If You're Interested",
  'not-for-you': 'Not For You',
}

/**
 * Compute a 0–100 ReelScore for a movie given user genre/people preferences.
 *
 * @param {object} movie      – must have tmdb_score, genres, cast, director
 * @param {object} userPrefs
 *   - genrePreferences:   Array<{ genre_id, priority }>  priority: must_see | fine | never
 *   - peoplePreferences:  Array<{ tmdb_person_id, preference_type }>  favorite | excluded
 *
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
  const favoriteIds    = peoplePreferences.filter((p) => p.preference_type === 'favorite').map((p) => p.tmdb_person_id)
  const excludedIds    = peoplePreferences.filter((p) => p.preference_type === 'excluded').map((p) => p.tmdb_person_id)
  const hasFavoritePerson =
    favoriteIds.some((id) => movieCastIds.includes(id)) ||
    (directorId != null && favoriteIds.includes(directorId))
  const hasExcludedPerson =
    excludedIds.some((id) => movieCastIds.includes(id)) ||
    (directorId != null && excludedIds.includes(directorId))

  // Base score: TMDB vote_average scaled to 0–100 (default 50 if missing)
  const baseScore = movie.tmdb_score != null ? Math.round(movie.tmdb_score * 10) : 50

  // Preference adjustments
  let score = baseScore
  if (hasMustSeeGenre)   score = Math.min(100, score + 10)
  if (hasFavoritePerson) score = Math.min(100, score + 15)
  if (hasNeverGenre)     score = Math.max(0,   score - 25)
  if (hasExcludedPerson) score = Math.max(0,   score - 30)

  // Bucket
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
        tmdb: {
          value: movie.tmdb_score,
          displayValue: movie.tmdb_score != null ? `${movie.tmdb_score}/10` : 'N/A',
        },
        rt_critic: {
          value: movie.rt_critic,
          displayValue: movie.rt_critic != null ? `${movie.rt_critic}%` : 'N/A',
        },
        rt_audience: {
          value: movie.rt_audience,
          displayValue: movie.rt_audience != null ? `${movie.rt_audience}%` : 'N/A',
        },
        letterboxd: {
          value: movie.letterboxd_score,
          displayValue: movie.letterboxd_score != null ? `${movie.letterboxd_score}/5` : 'N/A',
        },
      },
    },
  }
}
