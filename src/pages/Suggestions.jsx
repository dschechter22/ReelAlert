import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, RefreshCw, Shuffle, EyeOff, Search, X, SlidersHorizontal, BookmarkPlus, Bookmark } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useRatings } from '../contexts/RatingsContext'
import { supabase } from '../lib/supabase'
import { discoverMovies, getMovieDetails, getPersonDetails, searchPeople, getWatchProviders, TMDB_GENRES } from '../lib/tmdb'
import { computeReelScore, DEFAULT_SCORING_WEIGHTS } from '../lib/reelScore'
import { fetchOMDbRatings } from '../lib/omdb'
import { DEFAULT_MOCK_PREFS } from '../lib/mockData'
import BucketBadge from '../components/BucketBadge'
import StreamingBadges from '../components/StreamingBadges'
import TabBar from '../components/TabBar'

const BUCKET_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'must-see', label: 'Must See' },
  { value: 'worth-watching', label: 'Worth Watching' },
  { value: 'if-youre-interested', label: "If You're Interested" },
]

const YEAR_PRESETS = [
  { value: '2020s',    label: '2020s' },
  { value: '2010s',    label: '2010s' },
  { value: '2000s',    label: '2000s' },
  { value: '1990s',    label: '1990s' },
  { value: '1980s',    label: '1980s' },
  { value: '1970s',    label: '1970s' },
  { value: '1960s',    label: '1960s' },
  { value: '1950s',    label: '1950s' },
  { value: 'classics', label: 'Pre-1950s' },
]

const ORIGIN_COUNTRIES = [
  { code: 'US', label: 'American' },
  { code: 'GB', label: 'British' },
  { code: 'FR', label: 'French' },
  { code: 'DE', label: 'German' },
  { code: 'IT', label: 'Italian' },
  { code: 'ES', label: 'Spanish' },
  { code: 'JP', label: 'Japanese' },
  { code: 'KR', label: 'Korean' },
  { code: 'CN', label: 'Chinese' },
  { code: 'IN', label: 'Indian' },
  { code: 'MX', label: 'Mexican' },
  { code: 'BR', label: 'Brazilian' },
  { code: 'AU', label: 'Australian' },
  { code: 'CA', label: 'Canadian' },
]

const CERTIFICATIONS = ['G', 'PG', 'PG-13', 'R', 'NC-17', 'NR']

const STREAMING_SERVICES = [
  { id: 8,    name: 'Netflix' },
  { id: 9,    name: 'Prime Video' },
  { id: 337,  name: 'Disney+' },
  { id: 1899, name: 'Max' },
  { id: 15,   name: 'Hulu' },
  { id: 350,  name: 'Apple TV+' },
  { id: 386,  name: 'Peacock' },
  { id: 531,  name: 'Paramount+' },
]

const CURRENT_YEAR = new Date().getFullYear()

function yearPresetToRange(preset) {
  switch (preset) {
    case '2020s':    return { yearFrom: 2020, yearTo: CURRENT_YEAR }
    case '2010s':    return { yearFrom: 2010, yearTo: 2019 }
    case '2000s':    return { yearFrom: 2000, yearTo: 2009 }
    case '1990s':    return { yearFrom: 1990, yearTo: 1999 }
    case '1980s':    return { yearFrom: 1980, yearTo: 1989 }
    case '1970s':    return { yearFrom: 1970, yearTo: 1979 }
    case '1960s':    return { yearFrom: 1960, yearTo: 1969 }
    case '1950s':    return { yearFrom: 1950, yearTo: 1959 }
    case 'classics': return { yearFrom: null, yearTo: 1949 }
    default: return { yearFrom: null, yearTo: null }
  }
}

function getTopGenreIds(tasteProfile, limit = 6) {
  if (!tasteProfile?.genre_affinities) return []
  return Object.entries(tasteProfile.genre_affinities)
    .filter(([, score]) => score > 0.15)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => Number(id))
}

function pickRandomPages(count = 3) {
  return Array.from({ length: 10 }, (_, i) => i + 1)
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
}

const FILTERS_KEY = 'ra-suggestions-filters'
const PRESETS_KEY = 'ra-filter-presets'

function loadSavedFilters() {
  try { return JSON.parse(localStorage.getItem(FILTERS_KEY) || '{}') } catch { return {} }
}

function loadSavedPresets() {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]') } catch { return [] }
}

function FilterChip({ label, state, onClick }) {
  const isInclude = state === 'include'
  const isExclude = state === 'exclude'
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-body font-medium border transition-colors ${
        isInclude
          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
          : isExclude
          ? 'bg-red-500/15 text-red-400 border-red-500/30'
          : 'bg-bg text-text-secondary border-accent-secondary/20 hover:border-accent/40'
      }`}
    >
      <span className="inline-block w-2.5 text-center shrink-0 mr-0.5">
        {isInclude ? '+' : isExclude ? '−' : ''}
      </span>
      {label}
    </button>
  )
}

// Collect movie IDs from a person's filmography.
// Directors: only movies where job === 'Director' (excludes EP, Producer, etc.)
// Others: acting credits.
async function getFilmographyIds(personId) {
  const details = await getPersonDetails(personId)
  const directedIds = (details.movie_credits?.crew || [])
    .filter((m) => m.job === 'Director' && (m.vote_count ?? 0) > 5)
    .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
    .map((m) => m.id)

  const actingIds = (details.movie_credits?.cast || [])
    .filter((m) => (m.vote_count ?? 0) > 5)
    .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
    .map((m) => m.id)

  // If they have directed credits, use those first; otherwise fall back to acting
  const ids = directedIds.length > 0 ? directedIds : actingIds
  return [...new Set(ids)].slice(0, 30)
}

export default function Suggestions() {
  const { user } = useAuth()
  const { ratings, tasteProfile } = useRatings()
  const navigate = useNavigate()

  const [rawMovies, setRawMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [bucketFilter, setBucketFilter] = useState('all')
  // selectedPeople: array of { tmdb_person_id, person_name }
  const [selectedPeople, setSelectedPeople] = useState([])
  const [hideWatched, setHideWatched] = useState(false)
  const [pages, setPages] = useState(() => pickRandomPages())
  const [favoritePeople, setFavoritePeople] = useState([])
  const [userPrefs, setUserPrefs] = useState(null)

  // Filter panel — persisted to localStorage
  const [filterOpen, setFilterOpen] = useState(false)
  const [yearFilter, setYearFilter] = useState(() => loadSavedFilters().yearFilter ?? {})
  const [genreFilter, setGenreFilter] = useState(() => loadSavedFilters().genreFilter ?? {})
  const [countryFilter, setCountryFilter] = useState(() => loadSavedFilters().countryFilter ?? {})
  const [certFilter, setCertFilter] = useState(() => loadSavedFilters().certFilter ?? {})
  const [streamingServices, setStreamingServices] = useState(() => loadSavedFilters().streamingServices ?? [])
  const [streamingOnly, setStreamingOnly] = useState(() => loadSavedFilters().streamingOnly ?? false)

  // Saved presets
  const [savedPresets, setSavedPresets] = useState(loadSavedPresets)
  const [presetName, setPresetName] = useState('')
  const [savingPreset, setSavingPreset] = useState(false)

  // People search
  const [peopleQuery, setPeopleQuery] = useState('')
  const [peopleResults, setPeopleResults] = useState([])
  const [searchingPeople, setSearchingPeople] = useState(false)
  const searchDebounceRef = useRef(null)

  // Load prefs + favourited people once
  useEffect(() => {
    async function init() {
      let prefs = { ...DEFAULT_MOCK_PREFS, tasteMaxAdjustment: 20 }
      if (user) {
        try {
          const [genreRes, peopleRes, { data: { user: authUser } }] = await Promise.all([
            supabase.from('user_genre_preferences').select('*').eq('user_id', user.id),
            supabase.from('user_people_preferences').select('*').eq('user_id', user.id),
            supabase.auth.getUser(),
          ])
          const raw = authUser?.user_metadata?.scoring_weights
          prefs = {
            genrePreferences: genreRes.data?.length ? genreRes.data : DEFAULT_MOCK_PREFS.genrePreferences,
            peoplePreferences: peopleRes.data || [],
            scoringWeights: raw
              ? { imdb: Number(raw.imdb) || 33, rt: Number(raw.rt) || 33, lb: Number(raw.lb) || 34 }
              : DEFAULT_SCORING_WEIGHTS,
            tasteMaxAdjustment: Number(authUser?.user_metadata?.taste_max_adjustment ?? 20),
          }
          setFavoritePeople((peopleRes.data || []).filter((p) => p.preference_type === 'favorite'))
        } catch { /* use defaults */ }
      }
      setUserPrefs(prefs)
    }
    init()
  }, [user])

  // Persist filters to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify({
        yearFilter, genreFilter, countryFilter, certFilter, streamingServices, streamingOnly,
      }))
    } catch {}
  }, [yearFilter, genreFilter, countryFilter, certFilter, streamingServices, streamingOnly])

  // Debounced people search
  useEffect(() => {
    if (!peopleQuery.trim()) { setPeopleResults([]); return }
    clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(async () => {
      setSearchingPeople(true)
      try {
        const { results } = await searchPeople(peopleQuery)
        setPeopleResults((results || []).slice(0, 6))
      } catch { setPeopleResults([]) }
      finally { setSearchingPeople(false) }
    }, 300)
    return () => clearTimeout(searchDebounceRef.current)
  }, [peopleQuery])

  // Core fetch — uses filmography when people are selected, discover otherwise
  const fetchMovies = useCallback(async (currentPages, prefs, tasteProf, people, filters) => {
    if (!prefs) return
    setLoading(true)
    const { yearFilter: yf, genreFilter: gf, countryFilter: cf, certFilter: certf, streamingServices: ss, streamingOnly: so } = filters || {}
    const includedDecades = Object.entries(yf || {}).filter(([, v]) => v === 'include').map(([k]) => k)
    const excludedDecades = Object.entries(yf || {}).filter(([, v]) => v === 'exclude').map(([k]) => k)
    // For API call: use broadest range of all included decades
    let yearFrom = null, yearTo = null
    if (includedDecades.length > 0) {
      const ranges = includedDecades.map((d) => yearPresetToRange(d))
      const froms = ranges.map((r) => r.yearFrom).filter(Boolean)
      const tos = ranges.map((r) => r.yearTo).filter(Boolean)
      yearFrom = froms.length > 0 ? Math.min(...froms) : null
      yearTo = tos.length > 0 ? Math.max(...tos) : null
    }
    const includeGenres = Object.entries(gf || {}).filter(([, v]) => v === 'include').map(([id]) => Number(id))
    const excludeGenres = Object.entries(gf || {}).filter(([, v]) => v === 'exclude').map(([id]) => Number(id))
    const includeCountries = Object.entries(cf || {}).filter(([, v]) => v === 'include').map(([k]) => k)
    const excludeCountries = Object.entries(cf || {}).filter(([, v]) => v === 'exclude').map(([k]) => k)
    const includeCerts = Object.entries(certf || {}).filter(([, v]) => v === 'include').map(([k]) => k)
    const excludeCerts = Object.entries(certf || {}).filter(([, v]) => v === 'exclude').map(([k]) => k)
    const watchProviders = ss || []
    const useStreamingFilter = so || watchProviders.length > 0

    try {
      let rawList = [] // array of movie objects (either stubs or full details later)

      if (people.length > 0) {
        // Filmography-based: bypasses genre filter entirely so directors show correctly
        const filmographyResults = await Promise.allSettled(
          people.map((p) => getFilmographyIds(p.tmdb_person_id))
        )
        // Union across all selected people
        const idSet = new Set(
          filmographyResults.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
        )
        let movieIds = [...idSet].slice(0, 60)

        // Fetch full details for client-side filtering
        const detailResults = await Promise.allSettled(movieIds.map((id) => getMovieDetails(id)))
        let detailList = detailResults
          .filter((r) => r.status === 'fulfilled')
          .map((r) => r.value)

        // Client-side year filter
        if (includedDecades.length > 0 || excludedDecades.length > 0) {
          detailList = detailList.filter((m) => {
            const y = m.release_date ? new Date(m.release_date).getFullYear() : null
            if (!y) return false
            if (includedDecades.length > 0 && !includedDecades.some((d) => {
              const r = yearPresetToRange(d)
              return (!r.yearFrom || y >= r.yearFrom) && (!r.yearTo || y <= r.yearTo)
            })) return false
            if (excludedDecades.some((d) => {
              const r = yearPresetToRange(d)
              return (!r.yearFrom || y >= r.yearFrom) && (!r.yearTo || y <= r.yearTo)
            })) return false
            return true
          })
        }

        // Client-side genre filter
        if (includeGenres.length > 0) {
          detailList = detailList.filter((m) =>
            (m.genres || []).some((g) => includeGenres.includes(g.id))
          )
        }
        if (excludeGenres.length > 0) {
          detailList = detailList.filter((m) =>
            !(m.genres || []).some((g) => excludeGenres.includes(g.id))
          )
        }

        // Client-side country filter
        if (includeCountries.length > 0 || excludeCountries.length > 0) {
          detailList = detailList.filter((m) => {
            const countries = m.origin_country || []
            if (includeCountries.length > 0 && !includeCountries.some((c) => countries.includes(c))) return false
            if (excludeCountries.some((c) => countries.includes(c))) return false
            return true
          })
        }

        // Client-side certification filter
        if (includeCerts.length > 0 || excludeCerts.length > 0) {
          detailList = detailList.filter((m) => {
            const usCert = (m.release_dates?.results || [])
              .find((r) => r.iso_3166_1 === 'US')?.release_dates?.[0]?.certification || ''
            if (includeCerts.length > 0 && !includeCerts.includes(usCert)) return false
            if (excludeCerts.includes(usCert)) return false
            return true
          })
        }

        // Client-side streaming filter
        if (useStreamingFilter) {
          const providerResults = await Promise.allSettled(
            detailList.map((m) => getWatchProviders(m.id))
          )
          detailList = detailList.filter((_, i) => {
            const prov = providerResults[i].status === 'fulfilled' ? providerResults[i].value : null
            if (!prov) return false
            const flatrate = prov.flatrate || []
            if (watchProviders.length > 0) {
              return flatrate.some((p) => watchProviders.includes(p.provider_id))
            }
            // streamingOnly with no specific services — any flatrate
            return flatrate.length > 0
          })
        }

        rawList = detailList.slice(0, 30)
        // Fetch OMDb for this list
        const omdbResults = await Promise.allSettled(
          rawList.map((d) => fetchOMDbRatings(d.imdb_id))
        )
        const enriched = rawList.map((detail, i) => {
          const omdb = omdbResults[i].status === 'fulfilled' ? omdbResults[i].value : null
          const director = detail.credits?.crew?.find((c) => c.job === 'Director') || null
          const cast = (detail.credits?.cast || []).slice(0, 10).map((c) => ({ id: c.id, name: c.name }))
          const keywords = (detail.keywords?.keywords || []).map((k) => k.name)
          return {
            id: `tmdb-${detail.id}`,
            tmdb_id: detail.id,
            imdb_id: detail.imdb_id || null,
            title: detail.title,
            synopsis: detail.overview,
            poster_path: detail.poster_path,
            release_date: detail.release_date,
            genres: (detail.genres || []).map((g) => ({ id: g.id, name: g.name })),
            keywords,
            cast,
            director: director ? { id: director.id, name: director.name } : null,
            imdb_score: omdb?.imdb_score ?? null,
            rt_critic: omdb?.rt_critic ?? null,
            letterboxd_score: omdb?.letterboxd_score ?? null,
          }
        })
        setRawMovies(enriched)
      } else {
        // Personalized discover by taste genres
        const mustSeeIds = (prefs.genrePreferences || [])
          .filter((g) => g.priority === 'must_see')
          .map((g) => g.genre_id)
        const tasteGenreIds = getTopGenreIds(tasteProf)
        // Use explicit include genres if set, otherwise fall back to taste genres
        const genreIds = includeGenres.length > 0
          ? includeGenres
          : [...new Set([...mustSeeIds, ...tasteGenreIds])]

        const fetches = await Promise.allSettled(
          currentPages.map((page) => discoverMovies({
            genreIds,
            excludeGenreIds: excludeGenres,
            page,
            minVotes: 100,
            watchProviders: useStreamingFilter ? (watchProviders.length > 0 ? watchProviders : []) : [],
            yearFrom,
            yearTo,
            originCountries: includeCountries,
            certifications: includeCerts,
          }))
        )
        const results = fetches
          .filter((r) => r.status === 'fulfilled')
          .flatMap((r) => r.value?.results || [])
        const seen = new Set()
        const movieIds = results
          .filter((m) => { if (seen.has(m.id)) return false; seen.add(m.id); return true })
          .slice(0, 20)
          .map((m) => m.id)

        // Fetch full details + OMDb
        const details = await Promise.allSettled(movieIds.map((id) => getMovieDetails(id)))
        const omdbResults = await Promise.allSettled(
          details.map((d) =>
            d.status === 'fulfilled' ? fetchOMDbRatings(d.value.imdb_id) : Promise.resolve(null)
          )
        )

        const enriched = details
          .map((res, i) => {
            if (res.status !== 'fulfilled') return null
            const detail = res.value

            // Client-side exclude filters (include handled by API)
            if (excludeCountries.length > 0) {
              const countries = detail.origin_country || []
              if (excludeCountries.some((c) => countries.includes(c))) return null
            }
            if (excludeCerts.length > 0) {
              const usCert = (detail.release_dates?.results || [])
                .find((r) => r.iso_3166_1 === 'US')?.release_dates?.[0]?.certification || ''
              if (excludeCerts.includes(usCert)) return null
            }
            // Also apply included decade client-side filter when needed
            if (includedDecades.length > 0 || excludedDecades.length > 0) {
              const y = detail.release_date ? new Date(detail.release_date).getFullYear() : null
              if (!y) return null
              if (includedDecades.length > 0 && !includedDecades.some((d) => {
                const r = yearPresetToRange(d)
                return (!r.yearFrom || y >= r.yearFrom) && (!r.yearTo || y <= r.yearTo)
              })) return null
              if (excludedDecades.some((d) => {
                const r = yearPresetToRange(d)
                return (!r.yearFrom || y >= r.yearFrom) && (!r.yearTo || y <= r.yearTo)
              })) return null
            }

            const omdb = omdbResults[i].status === 'fulfilled' ? omdbResults[i].value : null
            const director = detail.credits?.crew?.find((c) => c.job === 'Director') || null
            const cast = (detail.credits?.cast || []).slice(0, 10).map((c) => ({ id: c.id, name: c.name }))
            const keywords = (detail.keywords?.keywords || []).map((k) => k.name)
            return {
              id: `tmdb-${detail.id}`,
              tmdb_id: detail.id,
              imdb_id: detail.imdb_id || null,
              title: detail.title,
              synopsis: detail.overview,
              poster_path: detail.poster_path,
              release_date: detail.release_date,
              genres: (detail.genres || []).map((g) => ({ id: g.id, name: g.name })),
              keywords,
              cast,
              director: director ? { id: director.id, name: director.name } : null,
              imdb_score: omdb?.imdb_score ?? null,
              rt_critic: omdb?.rt_critic ?? null,
              letterboxd_score: omdb?.letterboxd_score ?? null,
            }
          })
          .filter(Boolean)

        setRawMovies(enriched)
      }
    } catch (err) {
      console.warn('Suggestions fetch failed:', err.message)
      setRawMovies([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Re-fetch when pages, people, prefs, or filters change (not on tasteProfile — rescoring is in-memory)
  useEffect(() => {
    if (userPrefs) fetchMovies(pages, userPrefs, tasteProfile, selectedPeople, { yearFilter, genreFilter, countryFilter, certFilter, streamingServices, streamingOnly })
  }, [pages, selectedPeople, userPrefs, JSON.stringify(yearFilter), JSON.stringify(genreFilter), JSON.stringify(countryFilter), JSON.stringify(certFilter), streamingServices, streamingOnly])

  // Rescore in memory when taste profile changes — no API calls
  const movies = useMemo(() => {
    if (!userPrefs) return []
    const enrichedPrefs = { ...userPrefs, tasteProfile }
    return rawMovies
      .map((m) => ({ ...m, ...computeReelScore(m, enrichedPrefs) }))
      .sort((a, b) => b.score - a.score)
  }, [rawMovies, userPrefs, tasteProfile])

  const displayMovies = useMemo(() => {
    let list = movies
    if (hideWatched) list = list.filter((m) => !ratings[String(m.tmdb_id)])
    if (bucketFilter !== 'all') list = list.filter((m) => m.bucket === bucketFilter)
    return list
  }, [movies, hideWatched, bucketFilter, ratings])

  function addPerson(person) {
    const id = person.id ?? person.tmdb_person_id
    if (selectedPeople.some((p) => p.tmdb_person_id === id)) return
    setSelectedPeople((prev) => [...prev, { tmdb_person_id: id, person_name: person.name ?? person.person_name }])
    setPeopleQuery('')
    setPeopleResults([])
  }

  function removePerson(id) {
    setSelectedPeople((prev) => prev.filter((p) => p.tmdb_person_id !== id))
  }

  function toggleFavoritePerson(fav) {
    const active = selectedPeople.some((p) => p.tmdb_person_id === fav.tmdb_person_id)
    if (active) removePerson(fav.tmdb_person_id)
    else addPerson({ id: fav.tmdb_person_id, name: fav.person_name })
  }

  const selectedIds = new Set(selectedPeople.map((p) => p.tmdb_person_id))
  // People from search results not already in favorites list
  const searchResultsToShow = peopleResults.filter(
    (r) => !favoritePeople.some((f) => f.tmdb_person_id === r.id)
  )

  // Count active filters for badge
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (Object.values(yearFilter).some((v) => v === 'include' || v === 'exclude')) count++
    if (Object.values(genreFilter).some((v) => v === 'include' || v === 'exclude')) count++
    if (Object.values(countryFilter).some((v) => v === 'include' || v === 'exclude')) count++
    if (Object.values(certFilter).some((v) => v === 'include' || v === 'exclude')) count++
    if (streamingServices.length > 0 || streamingOnly) count++
    return count
  }, [yearFilter, genreFilter, countryFilter, certFilter, streamingServices, streamingOnly])

  function cycleYearFilter(key) {
    setYearFilter((prev) => {
      const current = prev[key]
      if (!current) return { ...prev, [key]: 'include' }
      if (current === 'include') return { ...prev, [key]: 'exclude' }
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function cycleCountry(code) {
    setCountryFilter((prev) => {
      const current = prev[code]
      if (!current) return { ...prev, [code]: 'include' }
      if (current === 'include') return { ...prev, [code]: 'exclude' }
      const next = { ...prev }
      delete next[code]
      return next
    })
  }

  function cycleCert(cert) {
    setCertFilter((prev) => {
      const current = prev[cert]
      if (!current) return { ...prev, [cert]: 'include' }
      if (current === 'include') return { ...prev, [cert]: 'exclude' }
      const next = { ...prev }
      delete next[cert]
      return next
    })
  }

  function savePreset() {
    if (!presetName.trim()) return
    const preset = {
      id: Date.now(),
      name: presetName.trim(),
      yearFilter, genreFilter, countryFilter, certFilter, streamingServices, streamingOnly,
    }
    const updated = [...savedPresets, preset]
    setSavedPresets(updated)
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify(updated)) } catch {}
    setPresetName('')
    setSavingPreset(false)
  }

  function applyPreset(preset) {
    setYearFilter(preset.yearFilter || {})
    setGenreFilter(preset.genreFilter || {})
    setCountryFilter(preset.countryFilter || {})
    setCertFilter(preset.certFilter || {})
    setStreamingServices(preset.streamingServices || [])
    setStreamingOnly(preset.streamingOnly || false)
  }

  function deletePreset(id) {
    const updated = savedPresets.filter((p) => p.id !== id)
    setSavedPresets(updated)
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify(updated)) } catch {}
  }

  function cycleGenre(genreId) {
    setGenreFilter((prev) => {
      const current = prev[genreId]
      if (!current) return { ...prev, [genreId]: 'include' }
      if (current === 'include') return { ...prev, [genreId]: 'exclude' }
      const next = { ...prev }
      delete next[genreId]
      return next
    })
  }

  function toggleStreamingService(id) {
    setStreamingServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  return (
    <div className="min-h-screen bg-bg pb-28">
      <header
        className="sticky top-0 z-20 border-b border-accent-secondary/15 px-4 pt-safe"
        style={{ background: 'rgb(var(--color-bg) / 0.9)', backdropFilter: 'blur(12px)' }}
      >
        <div className="max-w-2xl mx-auto">
          {/* Title row */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-accent" />
              <div>
                <h1 className="font-heading font-bold text-text text-xl leading-none">For You</h1>
                <p className="text-text-secondary font-body text-xs mt-0.5">Ranked by your taste</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterOpen((v) => !v)}
                className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-body transition-colors ${
                  filterOpen || activeFilterCount > 0
                    ? 'bg-accent/10 border-accent/30 text-accent'
                    : 'bg-surface border-accent-secondary/20 text-text-secondary hover:text-accent hover:border-accent/30'
                }`}
              >
                <SlidersHorizontal size={14} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center leading-none">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setPages(pickRandomPages())}
                disabled={loading}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface border border-accent-secondary/20 text-text-secondary text-sm font-body hover:text-accent hover:border-accent/30 transition-colors disabled:opacity-40"
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Shuffle size={14} />}
                {loading ? 'Loading…' : 'Shuffle'}
              </button>
            </div>
          </div>

          {/* People filter */}
          <div className="mb-3">
            {/* Search input */}
            <div className="relative mb-2">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                value={peopleQuery}
                onChange={(e) => setPeopleQuery(e.target.value)}
                placeholder="Filter by actor or director…"
                className="w-full bg-surface border border-accent-secondary/20 rounded-xl pl-8 pr-4 py-2 text-sm text-text font-body placeholder-text-secondary focus:outline-none focus:border-accent/40"
              />
              {searchingPeople && (
                <RefreshCw size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary animate-spin" />
              )}
            </div>

            {/* Search results */}
            {searchResultsToShow.length > 0 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 mb-2">
                {searchResultsToShow.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addPerson(p)}
                    className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-body font-medium border transition-colors ${
                      selectedIds.has(p.id)
                        ? 'bg-accent text-white border-accent'
                        : 'bg-surface text-text-secondary border-accent-secondary/20 hover:border-accent/40'
                    }`}
                  >
                    {p.name}
                    {p.known_for_department && (
                      <span className="ml-1 opacity-60">· {p.known_for_department}</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Favourite people chips */}
            {favoritePeople.length > 0 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                {favoritePeople.map((p) => {
                  const active = selectedIds.has(p.tmdb_person_id)
                  return (
                    <button
                      key={p.tmdb_person_id}
                      onClick={() => toggleFavoritePerson(p)}
                      className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-body font-medium border transition-colors ${
                        active
                          ? 'bg-accent text-white border-accent'
                          : 'bg-surface text-text-secondary border-accent-secondary/20 hover:border-accent/40'
                      }`}
                    >
                      ★ {p.person_name}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Active people added via search (non-favorites) */}
            {selectedPeople.filter((p) => !favoritePeople.some((f) => f.tmdb_person_id === p.tmdb_person_id)).length > 0 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 mt-2">
                {selectedPeople
                  .filter((p) => !favoritePeople.some((f) => f.tmdb_person_id === p.tmdb_person_id))
                  .map((p) => (
                    <span
                      key={p.tmdb_person_id}
                      className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-body font-medium bg-accent text-white border border-accent"
                    >
                      {p.person_name}
                      <button onClick={() => removePerson(p.tmdb_person_id)} className="hover:opacity-70 ml-0.5">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
              </div>
            )}
          </div>

          {/* Collapsible filter panel */}
          {filterOpen && (
            <div className="mb-3 rounded-2xl bg-surface border border-accent-secondary/15 p-4 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 180px)' }}>

              {/* Presets */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-text-secondary text-xs font-body font-medium uppercase tracking-wide">Presets</p>
                  <button
                    onClick={() => setSavingPreset((v) => !v)}
                    className="flex items-center gap-1 text-xs font-body text-accent hover:opacity-80 transition-opacity"
                  >
                    <BookmarkPlus size={13} />
                    Save current
                  </button>
                </div>
                {savingPreset && (
                  <div className="flex gap-2 mb-2">
                    <input
                      autoFocus
                      type="text"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') savePreset(); if (e.key === 'Escape') setSavingPreset(false) }}
                      placeholder="Preset name…"
                      className="flex-1 bg-bg border border-accent-secondary/20 rounded-xl px-3 py-1.5 text-xs text-text font-body placeholder-text-secondary focus:outline-none focus:border-accent/40"
                    />
                    <button
                      onClick={savePreset}
                      disabled={!presetName.trim()}
                      className="px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-body font-medium disabled:opacity-40"
                    >
                      Save
                    </button>
                  </div>
                )}
                {savedPresets.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {savedPresets.map((p) => (
                      <span key={p.id} className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1.5 rounded-full text-xs font-body font-medium bg-accent/10 text-accent border border-accent/20">
                        <Bookmark size={10} className="shrink-0" />
                        <button onClick={() => applyPreset(p)} className="hover:underline">{p.name}</button>
                        <button onClick={() => deletePreset(p.id)} className="ml-0.5 hover:opacity-70">
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  !savingPreset && <p className="text-text-secondary/50 text-xs font-body">No saved presets yet.</p>
                )}
              </div>

              <div className="border-t border-accent-secondary/10" />

              {/* Release Year */}
              <div>
                <p className="text-text-secondary text-xs font-body font-medium uppercase tracking-wide mb-2">Release Year</p>
                <div className="flex flex-wrap gap-2">
                  {YEAR_PRESETS.map((p) => (
                    <FilterChip key={p.value} label={p.label} state={yearFilter[p.value]} onClick={() => cycleYearFilter(p.value)} />
                  ))}
                </div>
              </div>

              {/* Genres */}
              <div>
                <p className="text-text-secondary text-xs font-body font-medium uppercase tracking-wide mb-2">Genres</p>
                <div className="flex flex-wrap gap-2">
                  {TMDB_GENRES.map((g) => (
                    <FilterChip key={g.id} label={g.name} state={genreFilter[g.id]} onClick={() => cycleGenre(g.id)} />
                  ))}
                </div>
              </div>

              {/* Country of Origin */}
              <div>
                <p className="text-text-secondary text-xs font-body font-medium uppercase tracking-wide mb-2">Country of Origin</p>
                <div className="flex flex-wrap gap-2">
                  {ORIGIN_COUNTRIES.map((c) => (
                    <FilterChip key={c.code} label={c.label} state={countryFilter[c.code]} onClick={() => cycleCountry(c.code)} />
                  ))}
                </div>
              </div>

              {/* Rating */}
              <div>
                <p className="text-text-secondary text-xs font-body font-medium uppercase tracking-wide mb-2">Rating</p>
                <div className="flex flex-wrap gap-2">
                  {CERTIFICATIONS.map((cert) => (
                    <FilterChip key={cert} label={cert} state={certFilter[cert]} onClick={() => cycleCert(cert)} />
                  ))}
                </div>
              </div>

              {/* Streaming */}
              <div>
                <p className="text-text-secondary text-xs font-body font-medium uppercase tracking-wide mb-2">Streaming</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setStreamingOnly((v) => !v)}
                    className={`px-3 py-1.5 rounded-full text-xs font-body font-medium border transition-colors flex items-center gap-1.5 ${
                      streamingOnly
                        ? 'bg-accent text-white border-accent'
                        : 'bg-bg text-text-secondary border-accent-secondary/20 hover:border-accent/40'
                    }`}
                  >
                    <span className="text-[10px]">●</span> Streaming only
                  </button>
                  {STREAMING_SERVICES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => toggleStreamingService(s.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-body font-medium border transition-colors ${
                        streamingServices.includes(s.id)
                          ? 'bg-accent text-white border-accent'
                          : 'bg-bg text-text-secondary border-accent-secondary/20 hover:border-accent/40'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Bucket filters + hide-seen */}
          <div className="flex items-center gap-2 pb-3">
            <div className="flex gap-2 overflow-x-auto scrollbar-none flex-1">
              {BUCKET_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setBucketFilter(f.value)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-body font-medium border transition-colors ${
                    bucketFilter === f.value
                      ? 'bg-accent text-white border-accent'
                      : 'bg-surface text-text-secondary border-accent-secondary/20 hover:border-accent/40'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setHideWatched((v) => !v)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body font-medium border transition-colors ${
                hideWatched
                  ? 'bg-accent text-white border-accent'
                  : 'bg-surface text-text-secondary border-accent-secondary/20 hover:border-accent/40'
              }`}
            >
              <EyeOff size={13} />
              Hide seen
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw size={24} className="text-accent animate-spin" />
            <p className="text-text-secondary font-body text-sm">
              {selectedPeople.length > 0 ? `Loading filmography…` : 'Finding films for you…'}
            </p>
          </div>
        ) : displayMovies.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <p className="text-text-secondary font-body text-sm">
              {hideWatched && movies.length > 0
                ? "You've seen everything here."
                : bucketFilter !== 'all' && movies.length > 0
                ? 'No films in this category — try a different filter.'
                : selectedPeople.length > 0
                ? 'No results found for the selected people.'
                : 'Nothing found.'}
            </p>
            {selectedPeople.length === 0 && (
              <button
                onClick={() => setPages(pickRandomPages())}
                className="text-accent text-sm font-body hover:opacity-80 transition-opacity"
              >
                Shuffle for new picks →
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="text-text-secondary text-xs font-body mb-3">
              {displayMovies.length} film{displayMovies.length !== 1 ? 's' : ''} · sorted by your ReelScore
            </p>
            <div className="space-y-3">
              {displayMovies.map((movie) => (
                <SuggestionCard
                  key={movie.id}
                  movie={movie}
                  onOpen={() => navigate(`/movie/${movie.tmdb_id}`)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      <TabBar />
    </div>
  )
}

function SuggestionCard({ movie, onOpen }) {
  const { title, poster_path, genres, score, bucket, imdb_score, rt_critic, letterboxd_score, release_date, director, breakdown } = movie
  const year = release_date ? new Date(release_date).getFullYear() : null

  return (
    <div className="bg-surface rounded-2xl overflow-hidden flex shadow-sm">
      <button className="flex-shrink-0 w-24" onClick={onOpen} aria-label={`View ${title}`}>
        {poster_path ? (
          <img
            src={`https://image.tmdb.org/t/p/w185${poster_path}`}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-24 h-36 bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900 flex items-end p-2">
            <span className="text-white/30 text-xs font-heading italic line-clamp-2">{title}</span>
          </div>
        )}
      </button>

      <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
        <div>
          <h3 className="font-heading font-semibold text-text text-base leading-tight line-clamp-1 mb-0.5">{title}</h3>
          <div className="flex items-center gap-2 mb-1.5">
            {year && <span className="text-text-secondary/50 text-xs font-body">{year}</span>}
            {director && <span className="text-text-secondary/50 text-xs font-body">· {director.name}</span>}
          </div>

          <BucketBadge bucket={bucket} className="mb-2" />

          <div className="flex flex-wrap gap-1.5 mb-2">
            {imdb_score != null && (
              <span className="text-xs font-body text-text-secondary">
                <span className="text-text-secondary/60">IMDb</span> {imdb_score}
              </span>
            )}
            {rt_critic != null && (
              <span className="text-xs font-body text-text-secondary">
                {imdb_score != null && <span className="mr-1.5 text-text-secondary/30">·</span>}
                <span className="text-text-secondary/60">RT</span> {rt_critic}%
              </span>
            )}
            {letterboxd_score != null && (
              <span className="text-xs font-body text-text-secondary">
                {(imdb_score != null || rt_critic != null) && <span className="mr-1.5 text-text-secondary/30">·</span>}
                <span className="text-text-secondary/60">LB</span> {letterboxd_score}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            {(genres || []).slice(0, 3).map((g) => (
              <span key={g.id} className="px-2 py-0.5 bg-bg rounded-full text-xs text-text-secondary border border-accent-secondary/20 font-body">
                {g.name}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <div className="flex items-baseline gap-1">
              <span className="text-accent font-heading font-bold text-lg leading-none">{score}</span>
              <span className="text-text-secondary text-xs font-body">/100</span>
            </div>
            {!!breakdown?.tasteBonus && (
              <span className={`text-xs font-body font-medium ${breakdown.tasteBonus > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {breakdown.tasteBonus > 0 ? `+${breakdown.tasteBonus}` : breakdown.tasteBonus} taste
              </span>
            )}
            <StreamingBadges tmdbId={movie.tmdb_id} compact />
          </div>
          <button onClick={onOpen} className="text-accent text-sm font-medium font-body hover:opacity-80 transition-opacity">
            Details →
          </button>
        </div>
      </div>
    </div>
  )
}
