import { useState, useEffect, useCallback } from 'react'
import { MapPin, Clock, ExternalLink, Search, RefreshCw, Calendar } from 'lucide-react'
import TabBar from '../components/TabBar'
import { getTheatresNearZip, getTheatreShowtimes } from '../lib/amc'

const FORMAT_STYLES = {
  IMAX: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  Dolby: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  '4DX': 'bg-green-500/15 text-green-400 border-green-500/25',
  'Prime': 'bg-amber-500/15 text-amber-400 border-amber-500/25',
}

function formatShowtime(iso) {
  if (!iso) return iso
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  } catch {
    return iso
  }
}

function extractTheatreData(theatreGroup) {
  const t = theatreGroup.theatre
  const showtimesRaw = theatreGroup.showtimes || []

  // Group showtimes by movie
  const byMovie = new Map()
  for (const s of showtimesRaw) {
    const movie = s._embedded?.movie || s.movie || {}
    const title = movie.name || movie.title || s.movieName || 'Unknown'
    const format = s.attributeIds?.[0] || s.format || 'Standard'
    const time = s.showDateTimeLocal || s.performanceTime || s.startTime
    if (!byMovie.has(title)) byMovie.set(title, { movieTitle: title, format, times: [] })
    if (time) byMovie.get(title).times.push(time)
  }

  return {
    id: String(t.id),
    name: t.name,
    address: [t.street, t.city, t.state, t.postalCode].filter(Boolean).join(', '),
    showtimes: Array.from(byMovie.values()),
  }
}

const MOCK_THEATERS = [
  {
    id: 'amc-demo-1',
    name: 'AMC Lincoln Square 13',
    address: '1998 Broadway, New York, NY 10023',
    showtimes: [
      { movieTitle: 'Now Playing', times: ['11:30 AM', '2:10 PM', '5:00 PM', '8:20 PM'], format: 'Standard' },
    ],
  },
]

export default function Theaters() {
  const [zip, setZip] = useState('')
  const [inputZip, setInputZip] = useState('')
  const [theatres, setTheatres] = useState([])
  const [selectedTheatre, setSelectedTheatre] = useState(null)
  const [showtimes, setShowtimes] = useState([])
  const [loading, setLoading] = useState(false)
  const [showtimesLoading, setShowtimesLoading] = useState(false)
  const [error, setError] = useState(null)
  const [usingMock, setUsingMock] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  const searchTheatres = useCallback(async (z, date) => {
    if (!z?.trim()) return
    setLoading(true)
    setError(null)
    setUsingMock(false)
    setTheatres([])
    setSelectedTheatre(null)
    setShowtimes([])
    try {
      const results = await getTheatresNearZip(z.trim(), date)
      if (!results.length) throw new Error('No theatres found near that zip code.')
      const mapped = results.map(extractTheatreData)
      setTheatres(mapped)
      setSelectedTheatre(mapped[0])
      setShowtimes(mapped[0].showtimes)
    } catch (err) {
      const msg = err.message?.includes('503')
        ? 'AMC API key not configured — showing demo data.'
        : err.message?.includes('403')
        ? 'AMC API key invalid or access denied — showing demo data.'
        : err.message
      setError(msg)
      setUsingMock(true)
      setTheatres(MOCK_THEATERS)
      setSelectedTheatre(MOCK_THEATERS[0])
      setShowtimes(MOCK_THEATERS[0].showtimes)
    } finally {
      setLoading(false)
    }
  }, [])

  async function loadShowtimes(theatre, date) {
    setShowtimesLoading(true)
    try {
      const data = await getTheatreShowtimes(theatre.id, date)
      const raw = data?._embedded?.showtimes || data?.showtimes || []
      const byMovie = new Map()
      for (const s of raw) {
        const movie = s._embedded?.movie || s.movie || {}
        const title = movie.name || movie.title || s.movieName || 'Unknown'
        const format = s.attributeIds?.[0] || s.format || 'Standard'
        const time = s.showDateTimeLocal || s.performanceTime || s.startTime
        if (!byMovie.has(title)) byMovie.set(title, { movieTitle: title, format, times: [] })
        if (time) byMovie.get(title).times.push(time)
      }
      setShowtimes(Array.from(byMovie.values()))
    } catch {
      setShowtimes(theatre.showtimes || [])
    } finally {
      setShowtimesLoading(false)
    }
  }

  function handleTheatreSelect(theatre) {
    setSelectedTheatre(theatre)
    if (!usingMock) {
      loadShowtimes(theatre, selectedDate)
    } else {
      setShowtimes(theatre.showtimes || [])
    }
  }

  function handleDateChange(date) {
    setSelectedDate(date)
    if (selectedTheatre && !usingMock) {
      loadShowtimes(selectedTheatre, date)
    }
  }

  function handleSearch(e) {
    e.preventDefault()
    setZip(inputZip)
    searchTheatres(inputZip, selectedDate)
  }

  const nextSevenDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return {
      value: d.toISOString().split('T')[0],
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    }
  })

  return (
    <div className="min-h-screen bg-bg pb-24">
      <header
        className="sticky top-0 z-20 border-b border-accent-secondary/15 px-4 pt-safe"
        style={{ background: 'rgb(var(--color-bg) / 0.9)', backdropFilter: 'blur(12px)' }}
      >
        <div className="max-w-2xl mx-auto py-4 space-y-3">
          <h1 className="font-heading font-bold text-text text-xl">Nearby Theaters</h1>

          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
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
              {loading ? <RefreshCw size={14} className="animate-spin" /> : null}
              Search
            </button>
          </form>

          {theatres.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {nextSevenDays.map((d) => (
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
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-4">
        {usingMock && (
          <div className="mb-4 p-3 bg-accent/8 border border-accent/20 rounded-xl text-xs font-body text-accent">
            Showing demo data — AMC API returned an error. Enter a zip code to retry.
          </div>
        )}

        {!theatres.length && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MapPin size={32} className="text-text-secondary/40 mb-3" />
            <p className="font-body text-text-secondary text-sm">Enter your zip code to find nearby AMC theaters.</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw size={24} className="text-accent animate-spin mb-3" />
            <p className="font-body text-text-secondary text-sm">Finding theaters near {inputZip}…</p>
          </div>
        )}

        {theatres.length > 0 && !loading && (
          <>
            <div className="space-y-2 mb-6">
              {theatres.map((theatre) => (
                <button
                  key={theatre.id}
                  onClick={() => handleTheatreSelect(theatre)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-150 ${
                    selectedTheatre?.id === theatre.id
                      ? 'bg-accent/10 border-accent/30'
                      : 'bg-surface border-accent-secondary/15 hover:border-accent/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className={`font-heading font-semibold text-sm mb-0.5 ${selectedTheatre?.id === theatre.id ? 'text-accent' : 'text-text'}`}>
                        {theatre.name}
                      </p>
                      <p className="text-text-secondary font-body text-xs truncate">{theatre.address}</p>
                    </div>
                    <MapPin size={13} className="text-text-secondary flex-shrink-0 mt-0.5" />
                  </div>
                </button>
              ))}
            </div>

            {selectedTheatre && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-heading font-semibold text-text text-base">{selectedTheatre.name}</h2>
                  <a
                    href={`https://www.amctheatres.com/movies`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-accent text-xs font-body hover:underline"
                  >
                    Book tickets <ExternalLink size={11} />
                  </a>
                </div>

                {showtimesLoading ? (
                  <div className="flex items-center gap-2 py-6 text-text-secondary font-body text-sm">
                    <RefreshCw size={14} className="animate-spin" />
                    Loading showtimes…
                  </div>
                ) : showtimes.length === 0 ? (
                  <p className="text-text-secondary font-body text-sm py-6 text-center">No showtimes available for this date.</p>
                ) : (
                  <div className="space-y-3">
                    {showtimes.map((show, i) => (
                      <div key={i} className="bg-surface rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-heading font-semibold text-text text-sm leading-tight flex-1 mr-3">{show.movieTitle}</h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-body font-medium border flex-shrink-0 ${
                            FORMAT_STYLES[show.format] || 'bg-surface text-text-secondary border-accent-secondary/20'
                          }`}>
                            {show.format}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {show.times.map((t, ti) => (
                            <button
                              key={ti}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-bg border border-accent-secondary/20 rounded-xl text-xs font-body text-text hover:border-accent/40 hover:text-accent transition-colors"
                            >
                              <Clock size={11} />
                              {formatShowtime(t)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <TabBar />
    </div>
  )
}
