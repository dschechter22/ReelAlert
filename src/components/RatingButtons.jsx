import { ThumbsUp, ThumbsDown, Eye, X } from 'lucide-react'
import { useRatings } from '../contexts/RatingsContext'

const BUTTONS = [
  { value: 'liked',        Icon: ThumbsUp,   activeColor: 'text-emerald-400', activeBg: 'bg-emerald-500/15 border-emerald-500/30', label: 'Liked' },
  { value: 'disliked',     Icon: ThumbsDown, activeColor: 'text-red-400',     activeBg: 'bg-red-500/15 border-red-500/30',         label: 'Disliked' },
  { value: 'seen',         Icon: Eye,        activeColor: 'text-accent',       activeBg: 'bg-accent/15 border-accent/30',           label: 'Seen it' },
  { value: 'not_interested', Icon: X,        activeColor: 'text-text-secondary', activeBg: 'bg-surface border-accent-secondary/30', label: 'Not for me' },
]

export default function RatingButtons({ movie, compact = false }) {
  const { getRating, rate, removeRating } = useRatings()
  const tmdbId = movie?.tmdb_id ?? movie?.id
  const current = getRating(tmdbId)

  function handleClick(value) {
    if (current === value) {
      removeRating(tmdbId)
    } else {
      rate(movie, value)
    }
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {BUTTONS.map(({ value, Icon, activeColor, activeBg }) => (
          <button
            key={value}
            onClick={(e) => { e.stopPropagation(); handleClick(value) }}
            className={`p-1 rounded-lg border transition-colors ${
              current === value
                ? `${activeBg} ${activeColor}`
                : 'border-transparent text-text-secondary/40 hover:text-text-secondary'
            }`}
            aria-label={value}
          >
            <Icon size={13} />
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {BUTTONS.map(({ value, Icon, activeColor, activeBg, label }) => (
        <button
          key={value}
          onClick={() => handleClick(value)}
          className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-body transition-colors ${
            current === value
              ? `${activeBg} ${activeColor}`
              : 'border-accent-secondary/15 bg-surface text-text-secondary hover:text-text hover:border-accent-secondary/30'
          }`}
          aria-label={label}
        >
          <Icon size={16} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
