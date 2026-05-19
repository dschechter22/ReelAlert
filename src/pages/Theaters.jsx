import { useState, useCallback } from 'react'
import { MapPin, Clock, ExternalLink, Search, RefreshCw, SlidersHorizontal, X } from 'lucide-react'
import TabBar from '../components/TabBar'
import { getTheatersNearZip } from '../lib/theaters'

// ── chain metadata ────────────────────────────────────────────────────────────

const CHAINS = [
  { value: 'all',      label: 'All Chains' },
  { value: 'amc',      label: 'AMC',       color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' },
  { value: 'cinemark', label: 'Cinemark',  color: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  { value: 'regal',    label: 'Regal',     color: 'bg-red-500/15 text-red-400 border-red-500/25' },
  { value: 'alamo',    label: 'Alamo',     color: 'bg-orange-500/15 text-orange-400 border-orange-500/25' },
  { value: 'other',    label: 'Other',     color: 'bg-surface text-text-secondary border-accent-secondary/20' },
]

const CHAIN_MAP = Object.fromEntries(CHAINS.map((c) => [c.value, c]))

const RADIUS_OPTIONS = [
  { value: 5,  label: '5 mi' },
  { value: 10, label: '10 mi' },
  { value: 15, label: '15 mi' },
  { value: 25, label: '25 mi' },
  { value: 50, label: '50 mi' },
]

const FORMAT_STYLES = {
  IMAX:    'bg-blue-500/15 text-blue-400 border-blue-500/25',
  Dolby:   'bg-purple-500/15 text-purple-400 border-purple-500/25',
  '4DX':   'bg-green-500/15 text-green-400 border-green-500/25',
  'Prime': 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  XD:      'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  'RPX':   'bg-red-500/15 text-red-400 border-red-500/25',
  'UltraAVX': 'bg-violet-500/15 text-violet-400 border-violet-500/25',
}

// ── helpers ───────────────────────────────────────────────────────────────────

function chainBadge(chain) {
  const meta = CHAIN_MAP[chain] ?? CHAIN_MAP.other
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-body font-medium border ${meta.color ?? CHAIN_MAP.other.color}`}>
      {meta.label}
    </span>
  )
}

function nextSevenDays() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return {
      value: d.toISOString().split('T')[0],
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    }
  })
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Theaters() {
  const [inputZip, setInputZip] = useState('')
  const [searchedZip, setSearchedZip] = useState('')
  const [radius, setRadius] = useState(15)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [chainFilter, setChainFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  const [allTheaters, setAllTheaters] = useState([])
  const [selectedTheater, setSelectedTheater] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const dates = nextSevenDays()

  // Filtered theater list
  const theaters = chainFilter === 'all'
    ? allTheaters
    : allTheaters.filter((t) => {
        if (chainFilter === 'other') {
          return !['amc', 'cinemark', 'regal', 'alamo', 'marcus', 'landmark', 'ipic'].includes(t.chain)
        }
        return t.chain === chainFilter
      })

  // Chain counts for badge display
  const chainCounts = allTheaters.reduce((acc, t) => {
    const key = ['amc', 'cinemark', 'regal', 'alamo'].includes(t.chain) ? t.chain : 'other'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const search = useCallback(async (zip, date, r) => {
    if (!zip?.trim()) return
    setLoading(true)
    setError(null)
    setAllTheaters([])
    setSelectedTheater(null)
    try {
      const results = await getTheatersNearZip(zip.trim(), date, r)
      if (!results.length) throw new Error(`No theaters found within ${r} miles of ${zip}.`)
      setAllTheaters(results)
      setSelectedTheater(results[0])
    } catch (err) {
      setError(err.message ?? 'Failed to load theaters.')
    } finally {
      setLoading(false)
    }
  }, [])

  function handleSearch(e) {
    e.preventDefault()
    setSearchedZip(inputZip)
    search(inputZip, selectedDate, radius)
  }

  function handleDateChange(date) {
    setSelectedDate(date)
    if (searchedZip) search(searchedZip, date, radius)
  }

  function handleRadiusChange(r) {
    setRadius(r)
    if (searchedZip) search(searchedZip, selectedDate, r)
  }

  const showtimes = selectedTheater?.showtimes ?? []

  return (
    <div className="min-h-screen bg-bg pb-24">
      {/* ── header ── */}
      <header
        className="sticky top-0 z-20 border-b border-accent-secondary/15 px-4 pt-safe"
        style={{ background: 'rgb(var(--color-bg) / 0.9)', backdropFilter: 'blur(12px)' }}
      >
        <div className="max-w-2xl mx-auto py-4 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="font-heading font-bold text-text text-xl">Nearby Theaters</h1>
            {allTheaters.length > 0 && (
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-body font-medium border transition-colors ${
                  showFilters ? 'bg-accent/15 border-accent/40 text-accent' : 'bg-surface border-accent-secondary/20 text-text-secondary hover:border-accent/30'
                }`}
              >
                <SlidersHorizontal size={13} />
                Filters
                {chainFilter !== 'all' && (
                  <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-accent inline-block" />
                )}
              </button>
            )}
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                inputMode="numeric"
                value={inputZip}
                onChange={(e) => setInputZip(e.target.value)}
                placeholder="Enter zip code…"
                className="w-full bg-surface border border-accent-secondary/20 rounded-xl pl-9 pr-4 py-2.5 text-sm text-text font-body placeholder-text-secondary focus:outline-none focus:border-accent/40"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !inputZip.trim()}
              className="px-4 py-2.5 bg-accent text-white text-sm font-body font-medium rounded-xl disabled:opacity-40 hover:bg-accent/90 transition-colors flex items-center gap-1.5"
            >
              {loading && <RefreshCw size={14} className="animate-spin" />}
              Search
            </button>
          </form>

          {/* Radius + date row — shown after first search */}
          {(allTheaters.length > 0 || loading) && (
            <div className="space-y-2">
              {/* Radius chips */}
              <div className="flex gap-2 overflow-x-auto scrollbar-none">
                <span className="flex-shrink-0 text-xs font-body text-text-secondary self-center">Radius:</span>
                {RADIUS_OPTIONS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => handleRadiusChange(r.value)}
                    className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-body border transition-colors ${
                      radius === r.value
                        ? 'bg-accent/15 border-accent/40 text-accent'
                        : 'bg-surface border-accent-secondary/20 text-text-secondary hover:border-accent/25'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Date chips */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {dates.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => handleDateChange(d.value)}
                    className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-body border transition-colors ${
                      selectedDate === d.value
                        ? 'bg-accent/15 border-accent/40 text-accent'
                        : 'bg-surface border-accent-secondary/20 text-text-secondary hover:border-accent/25'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chain filter panel */}
          {showFilters && allTheaters.length > 0 && (
            <div className="pb-2">
              <p className="text-xs font-body text-text-secondary mb-2">Filter by chain:</p>
              <div className="flex flex-wrap gap-2">
                {CHAINS.map((c) => {
                  const count = c.value === 'all'
                    ? allTheaters.length
                    : c.value === 'other'
                    ? (chainCounts.other ?? 0)
                    : (chainCounts[c.value] ?? 0)
                  if (c.value !== 'all' && count === 0) return null
                  return (
                    <button
                      key={c.value}
                      onClick={() => setChainFilter(c.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-body font-medium border transition-colors ${
                        chainFilter === c.value
                          ? 'bg-accent text-white border-accent'
                          : 'bg-surface text-text-secondary border-accent-secondary/20 hover:border-accent/30'
                      }`}
                    >
                      {c.label}
                      <span className={`text-xs font-mono ${chainFilter === c.value ? 'text-white/70' : 'text-text-secondary/60'}`}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── body ── */}
      <div className="max-w-2xl mx-auto px-4 pt-4">

        {/* Empty state */}
        {!allTheaters.length && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MapPin size={32} className="text-text-secondary/40 mb-3" />
            <p className="font-body text-text-secondary text-sm">
              Enter your zip code to find theaters from all major chains.
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw size={24} className="text-accent animate-spin mb-3" />
            <p className="font-body text-text-secondary text-sm">
              Finding theaters within {radius} miles of {inputZip}…
            </p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <p className="font-body text-text-secondary text-sm max-w-xs">{error}</p>
            <button
              onClick={() => search(searchedZip, selectedDate, radius)}
              className="px-4 py-2 bg-accent text-white rounded-xl text-sm font-body font-medium hover:opacity-90 transition-opacity"
            >
              Retry
            </button>
          </div>
        )}

        {/* Theater list + showtimes */}
        {theaters.length > 0 && !loading && (
          <>
            {/* Theater count summary */}
            <p className="text-xs font-body text-text-secondary mb-3">
              {allTheaters.length} theater{allTheaters.length !== 1 ? 's' : ''} within {radius} miles of {searchedZip}
              {chainFilter !== 'all' && ` · filtered to ${CHAIN_MAP[chainFilter]?.label ?? chainFilter}`}
            </p>

            {/* Theater selector list */}
            <div className="space-y-2 mb-6">
              {theaters.map((theater) => (
                <button
                  key={theater.id}
                  onClick={() => setSelectedTheater(theater)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-150 ${
                    selectedTheater?.id === theater.id
                      ? 'bg-accent/10 border-accent/30'
                      : 'bg-surface border-accent-secondary/15 hover:border-accent/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className={`font-heading font-semibold text-sm ${selectedTheater?.id === theater.id ? 'text-accent' : 'text-text'}`}>
                          {theater.name}
                        </p>
                        {chainBadge(theater.chain)}
                      </div>
                      <p className="text-text-secondary font-body text-xs truncate">{theater.address}</p>
                      {theater.distance != null && (
                        <p className="text-text-secondary/60 font-body text-xs mt-0.5">
                          {theater.distance.toFixed(1)} mi away
                        </p>
                      )}
                    </div>
                    <MapPin size={13} className="text-text-secondary flex-shrink-0 mt-0.5" />
                  </div>
                </button>
              ))}
            </div>

            {/* Showtimes panel */}
            {selectedTheater && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-heading font-semibold text-text text-base">{selectedTheater.name}</h2>
                  {selectedTheater.ticketUrl && (
                    <a
                      href={selectedTheater.ticketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-accent text-xs font-body hover:underline"
                    >
                      Get tickets <ExternalLink size={11} />
                    </a>
                  )}
                </div>

                {showtimes.length === 0 ? (
                  <p className="text-text-secondary font-body text-sm py-6 text-center">
                    No showtimes available for this date.
                  </p>
                ) : (
                  <div className="space-y-3 pb-4">
                    {showtimes.map((show, i) => (
                      <div key={i} className="bg-surface rounded-2xl p-4">
                        <p className="font-heading font-semibold text-text text-sm mb-3 leading-snug">
                          {show.movieTitle}
                        </p>

                        {(show.formats ?? []).map((block, bi) => (
                          <div key={bi} className="mb-2 last:mb-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-body font-medium border ${
                                FORMAT_STYLES[block.format] ?? 'bg-surface text-text-secondary border-accent-secondary/20'
                              }`}>
                                {block.format}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {block.times.map((t, ti) => (
                                <span
                                  key={ti}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-bg border border-accent-secondary/20 rounded-xl text-xs font-body text-text"
                                >
                                  <Clock size={11} />
                                  {t}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* No match after chain filter */}
            {theaters.length === 0 && chainFilter !== 'all' && (
              <div className="flex flex-col items-center py-12 text-center gap-3">
                <p className="font-body text-text-secondary text-sm">
                  No {CHAIN_MAP[chainFilter]?.label} theaters within {radius} miles.
                </p>
                <button
                  onClick={() => setChainFilter('all')}
                  className="flex items-center gap-1.5 text-accent text-xs font-body hover:underline"
                >
                  <X size={12} /> Clear filter
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <TabBar />
    </div>
  )
}
