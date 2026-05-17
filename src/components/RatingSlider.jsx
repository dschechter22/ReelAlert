const SOURCE_CONFIG = {
  tmdb: { label: 'TMDB', min: 0, max: 10, step: 0.1, format: (v) => `${v}/10` },
  rt_critic: { label: 'RT Critic', min: 0, max: 100, step: 1, format: (v) => `${v}%` },
  rt_audience: { label: 'RT Audience', min: 0, max: 100, step: 1, format: (v) => `${v}%` },
  letterboxd: { label: 'Letterboxd', min: 0, max: 5, step: 0.1, format: (v) => `${v}/5` },
}

export default function RatingSlider({ source, value, operator, onChange, onOperatorChange }) {
  const config = SOURCE_CONFIG[source] || { label: source, min: 0, max: 100, step: 1, format: (v) => v }

  return (
    <div className="bg-surface rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-text font-body text-sm font-medium">{config.label}</span>
        <div className="flex items-center gap-2">
          {onOperatorChange && (
            <button
              onClick={() => onOperatorChange(operator === 'and' ? 'or' : 'and')}
              className={`px-2.5 py-1 rounded-lg text-xs font-body font-semibold border transition-colors ${
                operator === 'and'
                  ? 'bg-accent/20 text-accent border-accent/30'
                  : 'bg-surface text-text-secondary border-accent-secondary/30'
              }`}
            >
              {operator?.toUpperCase() || 'AND'}
            </button>
          )}
          <span className="text-accent font-body text-sm font-bold min-w-[4rem] text-right">
            {config.format(value ?? config.min)}
          </span>
        </div>
      </div>

      <input
        type="range"
        min={config.min}
        max={config.max}
        step={config.step}
        value={value ?? config.min}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
        aria-label={`Minimum ${config.label} score`}
      />

      <div className="flex justify-between text-text-secondary text-xs font-body">
        <span>{config.format(config.min)}</span>
        <span>{config.format(config.max)}</span>
      </div>
    </div>
  )
}
