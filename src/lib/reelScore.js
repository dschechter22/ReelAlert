/**
 * ReelScore computation module.
 *
 * computeReelScore(movie, userPrefs) → { score, bucket, breakdown }
 *
 * Buckets:
 *   must-see          — cleared all thresholds + high-priority genre or favorited person
 *   worth-watching    — cleared global thresholds, neutral genre
 *   if-youre-interested — cleared genre-specific relaxed thresholds but not global
 *   not-for-you       — failed thresholds or contains a never genre
 */

const BUCKET_LABELS = {
  'must-see': 'Must See',
  'worth-watching': 'Worth Watching',
  'if-youre-interested': "If You're Interested",
  'not-for-you': 'Not For You',
}

/**
 * Evaluate whether a movie passes a single threshold layer.
 *
 * @param {object} movie  – { tmdb_score, rt_critic, rt_audience, letterboxd_score }
 * @param {Array}  thresholds – [{ source, min_score, and_or_operator }]
 * @returns {{ passed: boolean, results: object }}
 */
function evaluateThresholds(movie, thresholds) {
  if (!thresholds || thresholds.length === 0) {
    return { passed: true, results: {} }
  }

  const scoreMap = {
    tmdb: movie.tmdb_score,
    rt_critic: movie.rt_critic,
    rt_audience: movie.rt_audience,
    letterboxd: movie.letterboxd_score,
  }

  // Group by AND/OR operator (use first entry's operator as the combinator)
  // Simple approach: the and_or_operator on each threshold says how to combine
  // We treat it as: all thresholds with "and" must pass; any threshold with "or" counts
  const andThresholds = thresholds.filter((t) => t.and_or_operator === 'and')
  const orThresholds = thresholds.filter((t) => t.and_or_operator === 'or')

  const results = {}

  for (const t of thresholds) {
    const actual = scoreMap[t.source]
    results[t.source] = {
      required: t.min_score,
      actual: actual ?? null,
      passed: actual != null && actual >= t.min_score,
    }
  }

  let passed = true

  if (andThresholds.length > 0) {
    const andPassed = andThresholds.every((t) => results[t.source].passed)
    passed = passed && andPassed
  }

  if (orThresholds.length > 0) {
    const orPassed = orThresholds.some((t) => results[t.source].passed)
    passed = passed && orPassed
  }

  // If only one operator type exists, use that result
  if (andThresholds.length === 0 && orThresholds.length > 0) {
    passed = orThresholds.some((t) => results[t.source].passed)
  }
  if (orThresholds.length === 0 && andThresholds.length > 0) {
    passed = andThresholds.every((t) => results[t.source].passed)
  }

  return { passed, results }
}

/**
 * Compute a numeric ReelScore (0–100) based on weighted ratings.
 */
function computeNumericScore(movie) {
  const weights = {
    tmdb: 0.25,
    rt_critic: 0.35,
    rt_audience: 0.2,
    letterboxd: 0.2,
  }

  // Normalize all scores to 0–100
  const normalize = {
    tmdb: movie.tmdb_score != null ? (movie.tmdb_score / 10) * 100 : null,
    rt_critic: movie.rt_critic,
    rt_audience: movie.rt_audience,
    letterboxd: movie.letterboxd_score != null ? (movie.letterboxd_score / 5) * 100 : null,
  }

  let totalWeight = 0
  let weightedSum = 0

  for (const [source, weight] of Object.entries(weights)) {
    if (normalize[source] != null) {
      weightedSum += normalize[source] * weight
      totalWeight += weight
    }
  }

  if (totalWeight === 0) return 50
  return Math.round(weightedSum / totalWeight)
}

/**
 * Main export: compute the ReelScore for a movie given user preferences.
 *
 * @param {object} movie
 * @param {object} userPrefs
 *   - globalThresholds: Array<{ source, min_score, and_or_operator }>
 *   - genreThresholds: Array<{ genre_id, source, min_score, and_or_operator }>
 *   - genrePreferences: Array<{ genre_id, priority }>  priority: must_see | fine | never
 *   - peoplePreferences: Array<{ tmdb_person_id, preference_type }>  preference_type: favorite | excluded
 *
 * @returns {{ score: number, bucket: string, bucketLabel: string, breakdown: object }}
 */
export function computeReelScore(movie, userPrefs = {}) {
  const {
    globalThresholds = [],
    genreThresholds = [],
    genrePreferences = [],
    peoplePreferences = [],
  } = userPrefs

  const movieGenreIds = (movie.genres || []).map((g) => (typeof g === 'object' ? g.id : g))
  const movieCastIds = (movie.cast || []).map((c) => (typeof c === 'object' ? c.id : c))
  const directorId = movie.director?.id || movie.director

  // --- Genre analysis ---
  const neverGenres = genrePreferences
    .filter((gp) => gp.priority === 'never')
    .map((gp) => gp.genre_id)
  const mustSeeGenres = genrePreferences
    .filter((gp) => gp.priority === 'must_see')
    .map((gp) => gp.genre_id)

  const hasNeverGenre = neverGenres.some((id) => movieGenreIds.includes(id))
  const hasMustSeeGenre = mustSeeGenres.some((id) => movieGenreIds.includes(id))

  // --- People analysis ---
  const favoriteIds = peoplePreferences
    .filter((p) => p.preference_type === 'favorite')
    .map((p) => p.tmdb_person_id)
  const excludedIds = peoplePreferences
    .filter((p) => p.preference_type === 'excluded')
    .map((p) => p.tmdb_person_id)

  const hasFavoritePerson =
    favoriteIds.some((id) => movieCastIds.includes(id)) ||
    (directorId && favoriteIds.includes(directorId))
  const hasExcludedPerson =
    excludedIds.some((id) => movieCastIds.includes(id)) ||
    (directorId && excludedIds.includes(directorId))

  // --- Score computation ---
  const numericScore = computeNumericScore(movie)

  // --- Global threshold check ---
  const { passed: globalPassed, results: globalResults } = evaluateThresholds(
    movie,
    globalThresholds
  )

  // --- Genre-specific threshold check ---
  const relevantGenreThresholds = genreThresholds.filter((gt) =>
    movieGenreIds.includes(gt.genre_id)
  )
  const { passed: genrePassed, results: genreResults } = evaluateThresholds(
    movie,
    relevantGenreThresholds
  )

  // --- Bucket determination ---
  let bucket

  if (hasNeverGenre || hasExcludedPerson) {
    bucket = 'not-for-you'
  } else if (globalPassed && (hasMustSeeGenre || hasFavoritePerson)) {
    bucket = 'must-see'
  } else if (globalPassed) {
    bucket = 'worth-watching'
  } else if (genrePassed && relevantGenreThresholds.length > 0) {
    bucket = 'if-youre-interested'
  } else {
    bucket = 'not-for-you'
  }

  // Boost/reduce score based on bucket
  let adjustedScore = numericScore
  if (bucket === 'must-see') adjustedScore = Math.min(100, numericScore + 10)
  if (bucket === 'not-for-you') adjustedScore = Math.max(0, numericScore - 15)

  return {
    score: adjustedScore,
    bucket,
    bucketLabel: BUCKET_LABELS[bucket],
    breakdown: {
      numericScore,
      globalThresholds: globalResults,
      globalPassed,
      genreThresholds: genreResults,
      genrePassed,
      hasMustSeeGenre,
      hasNeverGenre,
      hasFavoritePerson,
      hasExcludedPerson,
      sources: {
        tmdb: { value: movie.tmdb_score, displayValue: movie.tmdb_score ? `${movie.tmdb_score}/10` : 'N/A' },
        rt_critic: { value: movie.rt_critic, displayValue: movie.rt_critic ? `${movie.rt_critic}%` : 'N/A' },
        rt_audience: { value: movie.rt_audience, displayValue: movie.rt_audience ? `${movie.rt_audience}%` : 'N/A' },
        letterboxd: { value: movie.letterboxd_score, displayValue: movie.letterboxd_score ? `${movie.letterboxd_score}/5` : 'N/A' },
      },
    },
  }
}

export { BUCKET_LABELS }
