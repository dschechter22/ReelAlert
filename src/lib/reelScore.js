import { computeTasteBonus } from './tasteProfile.js'

/**
 * ReelScore computation — IMDb, RT Critic, and Letterboxd, weighted by user
 * preference, adjusted by genre/people preferences.
 *
 * Default weights: IMDb 33%, RT 33%, Letterboxd 34%
 * Weights redistribute automatically when a source has no data.
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

export const DEFAULT_SCORING_WEIGHTS = { imdb: 33, rt: 33, lb: 34 }

function weightedBase(movie, weights = DEFAULT_SCORING_WEIGHTS) {
  const sources = []
  if (Number.isFinite(movie.imdb_score))
    sources.push({ value: Math.round(movie.imdb_score * 10), weight: weights.imdb })
  if (Number.isFinite(movie.rt_critic))
    sources.push({ value: movie.rt_critic, weight: weights.rt })
  if (Number.isFinite(movie.letterboxd_score))
    sources.push({ value: Math.round(movie.letterboxd_score * 20), weight: weights.lb })

  if (!sources.length) return 50
  const totalWeight = sources.reduce((s, x) => s + x.weight, 0)
  return Math.round(sources.reduce((s, x) => s + x.value * x.weight, 0) / totalWeight)
}

/**
 * @param {object} movie      – imdb_score, rt_critic, letterboxd_score, genres, cast, director
 * @param {object} userPrefs
 *   - genrePreferences:   Array<{ genre_id, priority }>  priority: must_see | fine | never
 *   - peoplePreferences:  Array<{ tmdb_person_id, preference_type }>  favorite | excluded
 *   - scoringWeights:     { imdb, rt, lb }  raw weight units (normalized internally)
 * @returns {{ score, bucket, bucketLabel, breakdown }}
 */
export function computeReelScore(movie, userPrefs = {}) {
  const {
    genrePreferences = [],
    peoplePreferences = [],
    scoringWeights = DEFAULT_SCORING_WEIGHTS,
    tasteProfile = null,
    tasteMaxAdjustment = 10,
  } = userPrefs

  const movieGenreIds = (movie.genres || []).map((g) => (typeof g === 'object' ? g.id : g))
  const movieCastIds = (movie.cast || []).map((c) => (typeof c === 'object' ? c.id : c))
  const directorId = movie.director?.id ?? movie.director

  const neverGenreIds   = genrePreferences.filter((gp) => gp.priority === 'never').map((gp) => gp.genre_id)
  const mustSeeGenreIds = genrePreferences.filter((gp) => gp.priority === 'must_see').map((gp) => gp.genre_id)
  const hasNeverGenre   = neverGenreIds.some((id) => movieGenreIds.includes(id))
  const hasMustSeeGenre = mustSeeGenreIds.some((id) => movieGenreIds.includes(id))

  const favoriteIds = peoplePreferences.filter((p) => p.preference_type === 'favorite').map((p) => p.tmdb_person_id)
  const excludedIds = peoplePreferences.filter((p) => p.preference_type === 'excluded').map((p) => p.tmdb_person_id)
  const hasFavoritePerson =
    favoriteIds.some((id) => movieCastIds.includes(id)) ||
    (directorId != null && favoriteIds.includes(directorId))
  const hasExcludedPerson =
    excludedIds.some((id) => movieCastIds.includes(id)) ||
    (directorId != null && excludedIds.includes(directorId))

  const baseScore = weightedBase(movie, scoringWeights)

  let score = Number.isFinite(baseScore) ? baseScore : 50
  if (hasMustSeeGenre)   score = Math.min(100, score + 10)
  if (hasFavoritePerson) score = Math.min(100, score + 15)
  if (hasNeverGenre)     score = Math.max(0,   score - 25)
  if (hasExcludedPerson) score = Math.max(0,   score - 30)
  const tasteBonus = computeTasteBonus(movie, tasteProfile, tasteMaxAdjustment)
  score = Math.min(100, Math.max(0, score + tasteBonus))
  score = Number.isFinite(score) ? score : 50

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

  // Compute effective percentages for display
  const total = (scoringWeights.imdb ?? 0) + (scoringWeights.rt ?? 0) + (scoringWeights.lb ?? 0) || 1
  const pct = {
    imdb: Math.round(scoringWeights.imdb / total * 100),
    rt:   Math.round(scoringWeights.rt   / total * 100),
    lb:   Math.round(scoringWeights.lb   / total * 100),
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
      tasteBonus,
      weightPct: pct,
      sources: {
        imdb: {
          value: Number.isFinite(movie.imdb_score) ? movie.imdb_score : null,
          displayValue: Number.isFinite(movie.imdb_score) ? `${movie.imdb_score}/10` : 'N/A',
        },
        rt_critic: {
          value: Number.isFinite(movie.rt_critic) ? movie.rt_critic : null,
          displayValue: Number.isFinite(movie.rt_critic) ? `${movie.rt_critic}%` : 'N/A',
        },
        letterboxd: {
          value: Number.isFinite(movie.letterboxd_score) ? movie.letterboxd_score : null,
          displayValue: Number.isFinite(movie.letterboxd_score) ? `${movie.letterboxd_score}/5` : 'N/A',
        },
      },
    },
  }
}
