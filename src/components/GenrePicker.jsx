import { TMDB_GENRES } from '../lib/tmdb'

const PRIORITY_OPTIONS = [
  { value: 'must_see', label: 'Must See', color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' },
  { value: 'fine', label: 'Fine', color: 'text-blue-400 bg-blue-500/15 border-blue-500/30' },
  { value: 'never', label: 'Never', color: 'text-red-400 bg-red-500/15 border-red-500/30' },
]

export default function GenrePicker({ preferences, onChange }) {
  function getGenrePriority(genreId) {
    const pref = preferences?.find((p) => p.genre_id === genreId)
    return pref?.priority || null
  }

  function setGenrePriority(genreId, priority) {
    const existing = preferences?.filter((p) => p.genre_id !== genreId) || []
    if (priority === null) {
      onChange(existing)
    } else {
      onChange([...existing, { genre_id: genreId, priority }])
    }
  }

  function cyclePriority(genreId) {
    const current = getGenrePriority(genreId)
    const cycle = [null, 'must_see', 'fine', 'never']
    const idx = cycle.indexOf(current)
    const next = cycle[(idx + 1) % cycle.length]
    setGenrePriority(genreId, next)
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {TMDB_GENRES.map((genre) => {
        const priority = getGenrePriority(genre.id)
        const opt = PRIORITY_OPTIONS.find((o) => o.value === priority)

        return (
          <button
            key={genre.id}
            onClick={() => cyclePriority(genre.id)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all duration-150 font-body text-sm ${
              opt
                ? `${opt.color} border`
                : 'bg-surface text-text border-accent-secondary/20 hover:border-accent/40'
            }`}
          >
            <span>{genre.name}</span>
            {opt && (
              <span className="text-xs font-medium ml-1 opacity-80">{opt.label}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
