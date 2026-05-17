import { useState, useEffect, useRef } from 'react'
import { Search, X, Star, Ban } from 'lucide-react'
import { searchPeople } from '../lib/tmdb'

export default function PeopleSearch({ people, onChange }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (query.trim().length < 2) { setResults([]); return }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await searchPeople(query)
        setResults((data.results || []).slice(0, 6))
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 400)
  }, [query])

  function addPerson(person, type) {
    const existing = people?.find((p) => p.tmdb_person_id === person.id)
    if (existing) return
    const next = [...(people || []), {
      tmdb_person_id: person.id,
      person_name: person.name,
      preference_type: type,
    }]
    onChange(next)
    setQuery('')
    setResults([])
  }

  function removePerson(personId) {
    onChange((people || []).filter((p) => p.tmdb_person_id !== personId))
  }

  const favorites = (people || []).filter((p) => p.preference_type === 'favorite')
  const excluded = (people || []).filter((p) => p.preference_type === 'excluded')

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search actors, directors…"
          className="w-full bg-surface border border-accent-secondary/20 rounded-xl pl-9 pr-4 py-2.5 text-sm text-text font-body placeholder-text-secondary focus:outline-none focus:border-accent/50 transition-colors"
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Results dropdown */}
      {results.length > 0 && (
        <div className="bg-surface border border-accent-secondary/20 rounded-xl overflow-hidden shadow-lg">
          {results.map((person) => (
            <div
              key={person.id}
              className="flex items-center justify-between px-4 py-3 border-b border-accent-secondary/10 last:border-0"
            >
              <div>
                <p className="text-text font-body text-sm font-medium">{person.name}</p>
                {person.known_for_department && (
                  <p className="text-text-secondary font-body text-xs">{person.known_for_department}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => addPerson(person, 'favorite')}
                  className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-body font-medium hover:bg-emerald-500/25 transition-colors"
                >
                  <Star size={11} /> Fav
                </button>
                <button
                  onClick={() => addPerson(person, 'excluded')}
                  className="flex items-center gap-1 px-2.5 py-1 bg-red-500/15 text-red-400 border border-red-500/30 rounded-lg text-xs font-body font-medium hover:bg-red-500/25 transition-colors"
                >
                  <Ban size={11} /> Excl
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Favorites */}
      {favorites.length > 0 && (
        <div>
          <p className="text-text-secondary text-xs font-body font-medium uppercase tracking-wide mb-2">Favorites</p>
          <div className="flex flex-wrap gap-2">
            {favorites.map((p) => (
              <span
                key={p.tmdb_person_id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full text-sm font-body"
              >
                <Star size={11} />
                {p.person_name}
                <button onClick={() => removePerson(p.tmdb_person_id)} className="hover:opacity-70">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Excluded */}
      {excluded.length > 0 && (
        <div>
          <p className="text-text-secondary text-xs font-body font-medium uppercase tracking-wide mb-2">Excluded</p>
          <div className="flex flex-wrap gap-2">
            {excluded.map((p) => (
              <span
                key={p.tmdb_person_id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 text-red-400 border border-red-500/30 rounded-full text-sm font-body"
              >
                <Ban size={11} />
                {p.person_name}
                <button onClick={() => removePerson(p.tmdb_person_id)} className="hover:opacity-70">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
