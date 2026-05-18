const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY
const TMDB_BASE_URL = import.meta.env.VITE_TMDB_BASE_URL || 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

function tmdbFetch(path, params = {}) {
  const url = new URL(`${TMDB_BASE_URL}${path}`)
  url.searchParams.set('api_key', TMDB_API_KEY)
  for (const [key, val] of Object.entries(params)) {
    url.searchParams.set(key, val)
  }
  return fetch(url.toString()).then((res) => {
    if (!res.ok) throw new Error(`TMDB error ${res.status}: ${path}`)
    return res.json()
  })
}

/**
 * Get movies currently in theaters.
 */
export async function getNowPlaying(page = 1) {
  return tmdbFetch('/movie/now_playing', { page })
}

/**
 * Discover movies filtered by genre IDs (OR logic) and optionally people (cast OR crew).
 * withCast: matches actors only. withPeople: matches cast OR crew (use for directors too).
 */
export async function discoverMovies({ genreIds = [], page = 1, sortBy = 'vote_average.desc', minVotes = 200, withCast = [], withPeople = [] } = {}) {
  return tmdbFetch('/discover/movie', {
    page,
    sort_by: sortBy,
    'vote_count.gte': minVotes,
    ...(genreIds.length ? { with_genres: genreIds.join('|') } : {}),
    ...(withPeople.length ? { with_people: withPeople.join(',') } : withCast.length ? { with_cast: withCast.join(',') } : {}),
  })
}

/**
 * Get top-rated movies.
 */
export async function getTopRated(page = 1) {
  return tmdbFetch('/movie/top_rated', { page })
}

/**
 * Get streaming/rental/purchase availability for a movie.
 * Returns US providers by default. Data sourced from JustWatch via TMDB.
 */
export async function getWatchProviders(tmdbId, region = 'US') {
  const data = await tmdbFetch(`/movie/${tmdbId}/watch/providers`)
  return data.results?.[region] ?? null
}

/**
 * Get detailed movie info.
 */
export async function getMovieDetails(tmdbId) {
  return tmdbFetch(`/movie/${tmdbId}`, {
    append_to_response: 'credits,videos,release_dates,keywords',
  })
}

/**
 * Get keywords for a movie (extracted from getMovieDetails if already fetched,
 * or fetched standalone when needed at rating time).
 */
export async function getMovieKeywords(tmdbId) {
  const data = await tmdbFetch(`/movie/${tmdbId}/keywords`)
  return (data.keywords || []).map((k) => k.name)
}

/**
 * Search for movies.
 */
export async function searchMovies(query, page = 1, year = null) {
  const params = { query, page }
  if (year) params.primary_release_year = year
  return tmdbFetch('/search/movie', params)
}

/**
 * Search for people (actors, directors).
 */
export async function searchPeople(query, page = 1) {
  return tmdbFetch('/search/person', { query, page })
}

/**
 * Get person details.
 */
export async function getPersonDetails(personId) {
  return tmdbFetch(`/person/${personId}`, {
    append_to_response: 'movie_credits',
  })
}

/**
 * Get genre list.
 */
export async function getGenres() {
  return tmdbFetch('/genre/movie/list')
}

/**
 * Build a full image URL from a TMDB poster path.
 */
export function posterUrl(path, size = 'w342') {
  if (!path) return null
  return `${TMDB_IMAGE_BASE}/${size}${path}`
}

/**
 * Build a backdrop URL.
 */
export function backdropUrl(path, size = 'w1280') {
  if (!path) return null
  return `${TMDB_IMAGE_BASE}/${size}${path}`
}

/**
 * Static TMDB genre list (avoid an extra API call during rendering).
 */
export const TMDB_GENRES = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' },
  { id: 27, name: 'Horror' },
  { id: 10402, name: 'Music' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Science Fiction' },
  { id: 10770, name: 'TV Movie' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' },
]
