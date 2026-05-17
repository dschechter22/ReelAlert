import { useState } from 'react'
import { MapPin, Clock, ExternalLink, Search } from 'lucide-react'
import TabBar from '../components/TabBar'

// Mock AMC theaters and showtimes for demo
const MOCK_THEATERS = [
  {
    id: 'amc-1',
    name: 'AMC Lincoln Square 13',
    address: '1998 Broadway, New York, NY 10023',
    distance: '0.4 mi',
    showtimes: [
      { movieTitle: 'Veil of the Departed', times: ['11:30 AM', '2:10 PM', '5:00 PM', '8:20 PM', '10:50 PM'], format: 'Standard' },
      { movieTitle: 'The Cartographer\'s Daughter', times: ['12:00 PM', '3:30 PM', '7:00 PM'], format: 'IMAX' },
      { movieTitle: 'Overdrive', times: ['1:00 PM', '4:15 PM', '7:30 PM', '10:00 PM'], format: 'Standard' },
    ],
  },
  {
    id: 'amc-2',
    name: 'AMC 84th Street 6',
    address: '2310 Broadway, New York, NY 10024',
    distance: '0.9 mi',
    showtimes: [
      { movieTitle: 'Lullaby for the End of the World', times: ['10:45 AM', '1:30 PM', '4:00 PM', '6:45 PM', '9:30 PM'], format: 'Standard' },
      { movieTitle: 'Still Waters', times: ['12:30 PM', '3:15 PM', '6:00 PM', '8:45 PM'], format: 'Standard' },
    ],
  },
  {
    id: 'amc-3',
    name: 'AMC Empire 25',
    address: '234 W 42nd St, New York, NY 10036',
    distance: '2.1 mi',
    showtimes: [
      { movieTitle: 'Punchline', times: ['10:00 AM', '12:45 PM', '3:30 PM', '6:15 PM', '9:00 PM'], format: 'Standard' },
      { movieTitle: 'Brood', times: ['11:00 AM', '1:45 PM', '4:30 PM', '7:15 PM', '10:15 PM'], format: 'Standard' },
      { movieTitle: 'The Cartographer\'s Daughter', times: ['2:00 PM', '5:00 PM', '8:00 PM'], format: 'Dolby' },
    ],
  },
]

export default function Theaters() {
  const [selectedTheater, setSelectedTheater] = useState(MOCK_THEATERS[0])
  const [zip, setZip] = useState('')

  return (
    <div className="min-h-screen bg-bg pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-accent-secondary/15 px-4 pt-safe"
        style={{ background: 'color-mix(in srgb, var(--color-bg) 90%, transparent)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-2xl mx-auto py-4">
          <h1 className="font-heading font-bold text-text text-xl mb-3">Nearby Theaters</h1>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="Enter zip code to update…"
              className="w-full bg-surface border border-accent-secondary/20 rounded-xl pl-9 pr-4 py-2.5 text-sm text-text font-body placeholder-text-secondary focus:outline-none focus:border-accent/40"
            />
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-4">
        {/* Theater list */}
        <div className="space-y-2 mb-6">
          {MOCK_THEATERS.map((theater) => (
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
                  <p className={`font-heading font-semibold text-sm mb-0.5 ${selectedTheater?.id === theater.id ? 'text-accent' : 'text-text'}`}>
                    {theater.name}
                  </p>
                  <p className="text-text-secondary font-body text-xs truncate">{theater.address}</p>
                </div>
                <span className="flex-shrink-0 inline-flex items-center gap-1 text-text-secondary text-xs font-body">
                  <MapPin size={11} />
                  {theater.distance}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Showtimes */}
        {selectedTheater && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-heading font-semibold text-text text-lg">{selectedTheater.name}</h2>
              <a
                href={`https://www.amctheatres.com`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-accent text-xs font-body hover:underline"
              >
                Book <ExternalLink size={11} />
              </a>
            </div>

            <div className="space-y-3">
              {selectedTheater.showtimes.map((show, i) => (
                <div key={i} className="bg-surface rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-heading font-semibold text-text text-sm leading-tight">{show.movieTitle}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-body font-medium border ${
                      show.format === 'IMAX'
                        ? 'bg-blue-500/15 text-blue-400 border-blue-500/25'
                        : show.format === 'Dolby'
                        ? 'bg-purple-500/15 text-purple-400 border-purple-500/25'
                        : 'bg-surface text-text-secondary border-accent-secondary/20'
                    }`}>
                      {show.format}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {show.times.map((t) => (
                      <button
                        key={t}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-bg border border-accent-secondary/20 rounded-xl text-xs font-body text-text hover:border-accent/40 hover:text-accent transition-colors"
                      >
                        <Clock size={11} />
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="mt-6 text-text-secondary text-xs font-body text-center">
          Showtimes shown are for demonstration. Connect your AMC API key in settings for live data.
        </p>
      </div>

      <TabBar />
    </div>
  )
}
