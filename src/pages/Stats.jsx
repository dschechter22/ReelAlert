import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRatings } from '../contexts/RatingsContext'
import { getMovieDetails } from '../lib/tmdb'
import { TMDB_GENRES } from '../lib/tmdb'
import { ArrowLeft, RefreshCw, BarChart3, X } from 'lucide-react'
import TabBar from '../components/TabBar'

const GENRE_MAP = Object.fromEntries(TMDB_GENRES.map((g) => [String(g.id), g.name]))

const RATING_COLORS = {
  liked:          'bg-emerald-500',
  disliked:       'bg-red-500',
  seen:           'bg-accent',
  not_interested: 'bg-text-secondary/40',
}
const RATING_LABELS = {
  liked: 'Liked', disliked: 'Disliked', seen: 'Seen', not_interested: 'Not Interested',
}

// ── helpers ──────────────────────────────────────────────────────────────────

function weightColor(w) {
  if (w >= 1.5) return 'text-emerald-400'
  if (w > 0.2)  return 'text-green-400'
  if (w > -0.2) return 'text-text-secondary'
  return 'text-red-400'
}

function weightLabel(w) {
  if (w >= 2)   return 'Loved'
  if (w >= 1)   return 'Liked'
  if (w >= 0)   return 'Neutral'
  if (w >= -1)  return 'Mixed'
  return 'Disliked'
}

function topN(obj, n, sortKey = 'count') {
  return Object.entries(obj)
    .map(([key, v]) => ({ key, ...v, avg: v.count > 0 ? v.total / v.count : 0 }))
    .sort((a, b) => b[sortKey] - a[sortKey])
    .slice(0, n)
}

function computeStats(rows, enrichCache) {
  const merged = rows.map((r) => ({
    ...r,
    release_year:   r.release_year   ?? enrichCache[r.tmdb_id]?.release_year   ?? null,
    director_name:  r.director_name  ?? enrichCache[r.tmdb_id]?.director_name  ?? null,
    top_cast:       r.top_cast       ?? enrichCache[r.tmdb_id]?.top_cast       ?? [],
    origin_country: r.origin_country ?? enrichCache[r.tmdb_id]?.origin_country ?? null,
    studio:         r.studio         ?? enrichCache[r.tmdb_id]?.studio         ?? null,
    collection:     r.collection     ?? enrichCache[r.tmdb_id]?.collection     ?? null,
  }))

  const byType = { liked: 0, disliked: 0, seen: 0, not_interested: 0 }
  const genres = {}, decades = {}, directors = {}, actors = {}, keywords = {}
  const countries = {}, studios = {}, collections = {}, activity = {}

  for (const r of merged) {
    byType[r.rating] = (byType[r.rating] || 0) + 1
    const w = r.taste_weight ?? 0

    // genres
    for (const id of r.genre_ids || []) {
      const k = String(id)
      if (!genres[k]) genres[k] = { count: 0, total: 0, name: GENRE_MAP[k] || `Genre ${k}` }
      genres[k].count++; genres[k].total += w
    }

    // decades — pre-1950 all bucket as 'classics'
    if (r.release_year) {
      const d = r.release_year < 1950 ? 'classics' : Math.floor(r.release_year / 10) * 10
      if (!decades[d]) decades[d] = { count: 0, total: 0 }
      decades[d].count++; decades[d].total += w
    }

    // directors
    if (r.director_name) {
      if (!directors[r.director_name]) directors[r.director_name] = { count: 0, total: 0 }
      directors[r.director_name].count++; directors[r.director_name].total += w
    }

    // actors
    for (const name of r.top_cast || []) {
      if (!actors[name]) actors[name] = { count: 0, total: 0 }
      actors[name].count++; actors[name].total += w
    }

    // keywords (only for non-neutral)
    if (Math.abs(w) >= 0.5) {
      for (const kw of r.keywords || []) {
        if (!keywords[kw]) keywords[kw] = { count: 0, total: 0 }
        keywords[kw].count++; keywords[kw].total += w
      }
    }

    // countries
    if (r.origin_country) {
      if (!countries[r.origin_country]) countries[r.origin_country] = { count: 0, total: 0 }
      countries[r.origin_country].count++; countries[r.origin_country].total += w
    }

    // studios
    if (r.studio) {
      if (!studios[r.studio]) studios[r.studio] = { count: 0, total: 0 }
      studios[r.studio].count++; studios[r.studio].total += w
    }

    // collections
    if (r.collection) {
      if (!collections[r.collection]) collections[r.collection] = { count: 0, total: 0 }
      collections[r.collection].count++; collections[r.collection].total += w
    }

    // activity by month
    if (r.rated_at) {
      const m = r.rated_at.slice(0, 7)
      activity[m] = (activity[m] || 0) + 1
    }
  }

  return {
    total: merged.length,
    byType,
    genres:      topN(genres, 20),
    decades:     Object.entries(decades)
      .map(([d, v]) => ({ key: d, ...v, avg: v.count > 0 ? v.total / v.count : 0 }))
      .sort((a, b) => {
        if (a.key === 'classics') return 1
        if (b.key === 'classics') return -1
        return Number(b.key) - Number(a.key)
      }),
    directors:   topN(directors, 20),
    actors:      topN(actors, 20),
    keywords:    topN(keywords, 30, 'total'),
    countries:   topN(countries, 15),
    studios:     topN(studios, 15),
    collections: topN(collections, 15),
    activity:    Object.entries(activity).sort(([a], [b]) => a.localeCompare(b)).slice(-18),
    enrichmentCoverage: merged.filter((r) => r.release_year !== null).length,
  }
}

// ── filter helpers ────────────────────────────────────────────────────────────

const FILTER_DIMS = [
  { key: 'decade',     label: 'Decade' },
  { key: 'genre',      label: 'Genre' },
  { key: 'director',   label: 'Director' },
  { key: 'actor',      label: 'Actor' },
  { key: 'country',    label: 'Country' },
  { key: 'studio',     label: 'Studio' },
  { key: 'collection', label: 'Franchise' },
]

function filterRows(rows, enrichCache, activeFilter) {
  if (!activeFilter) return rows
  const merged = rows.map((r) => ({
    ...r,
    release_year:   r.release_year   ?? enrichCache[r.tmdb_id]?.release_year   ?? null,
    director_name:  r.director_name  ?? enrichCache[r.tmdb_id]?.director_name  ?? null,
    top_cast:       r.top_cast       ?? enrichCache[r.tmdb_id]?.top_cast       ?? [],
    origin_country: r.origin_country ?? enrichCache[r.tmdb_id]?.origin_country ?? null,
    studio:         r.studio         ?? enrichCache[r.tmdb_id]?.studio         ?? null,
    collection:     r.collection     ?? enrichCache[r.tmdb_id]?.collection     ?? null,
  }))
  const { dim, value } = activeFilter
  return merged.filter((r) => {
    if (dim === 'decade') {
      if (value === 'classics') return r.release_year && r.release_year < 1950
      return r.release_year && Math.floor(r.release_year / 10) * 10 === Number(value)
    }
    if (dim === 'genre') return (r.genre_ids || []).map(String).includes(String(value))
    if (dim === 'director') return r.director_name === value
    if (dim === 'actor') return (r.top_cast || []).includes(value)
    if (dim === 'country') return r.origin_country === value
    if (dim === 'studio') return r.studio === value
    if (dim === 'collection') return r.collection === value
    return true
  })
}

// ── sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, sub }) {
  return (
    <div className="mb-3">
      <h2 className="font-heading font-semibold text-text text-lg">{title}</h2>
      {sub && <p className="text-text-secondary text-xs font-body">{sub}</p>}
    </div>
  )
}

function StatRow({ label, count, avg, maxCount, onFilter }) {
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0
  return (
    <button
      onClick={onFilter}
      className="w-full flex items-center gap-3 py-2 hover:bg-surface/60 rounded-lg px-1 transition-colors text-left"
    >
      <span className="text-text font-body text-sm w-36 truncate flex-shrink-0">{label}</span>
      <div className="flex-1 bg-surface rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-text-secondary text-xs font-body w-6 text-right">{count}</span>
      {avg !== undefined && (
        <span className={`text-xs font-body font-medium w-14 text-right ${weightColor(avg)}`}>
          {weightLabel(avg)}
        </span>
      )}
    </button>
  )
}

function DecadeBar({ decade, count, avg, maxCount, onFilter }) {
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0
  const label = decade === 'classics' ? 'Pre-1950s' : `${decade}s`
  return (
    <button
      onClick={onFilter}
      className="w-full flex items-center gap-3 py-2 hover:bg-surface/60 rounded-lg px-1 transition-colors"
    >
      <span className="text-text font-body text-sm w-16 flex-shrink-0">{label}</span>
      <div className="flex-1 bg-surface rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${avg >= 1 ? 'bg-emerald-500' : avg >= 0 ? 'bg-accent' : 'bg-red-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-text-secondary text-xs font-body w-6 text-right">{count}</span>
    </button>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function Stats() {
  const { ratingRows } = useRatings()
  const navigate = useNavigate()

  const [enrichCache, setEnrichCache] = useState({})
  const [enriching, setEnriching] = useState(false)
  const [enrichProgress, setEnrichProgress] = useState(null)
  const [activeFilter, setActiveFilter] = useState(null) // { dim, value, label }

  const needsEnrichment = useMemo(
    () => ratingRows.filter((r) => !r.release_year && !enrichCache[r.tmdb_id]),
    [ratingRows, enrichCache]
  )

  const loadFullStats = useCallback(async () => {
    if (!needsEnrichment.length) return
    setEnriching(true)
    const total = needsEnrichment.length
    setEnrichProgress({ done: 0, total })

    for (let i = 0; i < total; i += 5) {
      const batch = needsEnrichment.slice(i, i + 5)
      const results = await Promise.allSettled(batch.map((r) => getMovieDetails(r.tmdb_id)))
      const patch = {}
      results.forEach((res, j) => {
        if (res.status !== 'fulfilled') return
        const d = res.value
        patch[batch[j].tmdb_id] = {
          release_year:   d.release_date ? new Date(d.release_date).getFullYear() : null,
          director_name:  d.credits?.crew?.find((c) => c.job === 'Director')?.name ?? null,
          top_cast:       (d.credits?.cast || []).slice(0, 5).map((c) => c.name).filter(Boolean),
          origin_country: d.production_countries?.[0]?.name ?? null,
          studio:         d.production_companies?.[0]?.name ?? null,
          collection:     d.belongs_to_collection?.name ?? null,
        }
      })
      setEnrichCache((prev) => ({ ...prev, ...patch }))
      setEnrichProgress({ done: Math.min(i + 5, total), total })
      if (i + 5 < total) await new Promise((r) => setTimeout(r, 350))
    }
    setEnriching(false)
    setEnrichProgress(null)
  }, [needsEnrichment])

  const filteredRows = useMemo(
    () => filterRows(ratingRows, enrichCache, activeFilter),
    [ratingRows, enrichCache, activeFilter]
  )

  const stats = useMemo(() => computeStats(filteredRows, enrichCache), [filteredRows, enrichCache])

  function setFilter(dim, value, label) {
    setActiveFilter((prev) =>
      prev?.dim === dim && prev?.value === String(value) ? null : { dim, value: String(value), label }
    )
  }

  const total = stats.total
  const maxGenre     = Math.max(...stats.genres.map((g) => g.count), 1)
  const maxDecade    = Math.max(...stats.decades.map((d) => d.count), 1)
  const maxDirector  = Math.max(...stats.directors.map((d) => d.count), 1)
  const maxActor     = Math.max(...stats.actors.map((a) => a.count), 1)
  const maxCountry   = Math.max(...stats.countries.map((c) => c.count), 1)
  const maxStudio    = Math.max(...stats.studios.map((s) => s.count), 1)
  const maxActivity  = Math.max(...stats.activity.map(([, v]) => v), 1)

  const likedKw    = stats.keywords.filter((k) => k.avg > 0.3).slice(0, 12)
  const dislikedKw = stats.keywords.filter((k) => k.avg < -0.3).slice(0, 8)

  if (!ratingRows.length) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center">
        <div className="text-center px-8">
          <BarChart3 size={40} className="text-text-secondary mx-auto mb-4" />
          <h2 className="font-heading font-semibold text-text text-xl mb-2">No data yet</h2>
          <p className="text-text-secondary font-body text-sm">
            Rate some movies to see your taste stats here.
          </p>
        </div>
        <TabBar />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg pb-28">
      {/* Header */}
      <header
        className="sticky top-0 z-20 border-b border-accent-secondary/15 px-4 pt-safe"
        style={{ background: 'rgb(var(--color-bg) / 0.9)', backdropFilter: 'blur(12px)' }}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-3 py-4">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg text-text-secondary hover:text-text transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="font-heading font-bold text-text text-xl leading-none">Taste Stats</h1>
            <p className="text-text-secondary font-body text-xs mt-0.5">
              {ratingRows.length} film{ratingRows.length !== 1 ? 's' : ''} rated
              {activeFilter && ` · filtered by ${activeFilter.label}`}
            </p>
          </div>
          {activeFilter && (
            <button
              onClick={() => setActiveFilter(null)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-accent text-white text-xs font-body"
            >
              <X size={11} /> Clear filter
            </button>
          )}
        </div>

        {/* Filter dimension chips */}
        <div className="max-w-2xl mx-auto pb-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {FILTER_DIMS.map((d) => (
              <button
                key={d.key}
                onClick={() => activeFilter?.dim === d.key && setActiveFilter(null)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-body border transition-colors ${
                  activeFilter?.dim === d.key
                    ? 'bg-accent text-white border-accent'
                    : 'bg-surface text-text-secondary border-accent-secondary/20'
                }`}
              >
                {d.label}
                {activeFilter?.dim === d.key && `: ${activeFilter.label}`}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-8">

        {/* ── Overview ─────────────────────────────────────────────────── */}
        <section>
          <SectionHeader title="Overview" sub={activeFilter ? `Showing ${total} films matching filter` : undefined} />

          {/* Rating type breakdown */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {Object.entries(RATING_LABELS).map(([type, label]) => {
              const count = stats.byType[type] || 0
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={type} className="bg-surface rounded-xl p-3 text-center border border-accent-secondary/10">
                  <div className="font-heading font-bold text-text text-xl">{count}</div>
                  <div className="text-text-secondary text-xs font-body mt-0.5">{label}</div>
                  <div className={`text-xs font-body mt-1 ${RATING_COLORS[type].replace('bg-', 'text-').replace('-500', '-400').replace('/40', '')}`}>
                    {pct}%
                  </div>
                </div>
              )
            })}
          </div>

          {/* Stacked bar */}
          <div className="flex rounded-full overflow-hidden h-2 gap-px">
            {Object.entries(RATING_LABELS).map(([type]) => {
              const count = stats.byType[type] || 0
              const pct = total > 0 ? (count / total) * 100 : 0
              return pct > 0 ? (
                <div key={type} className={`${RATING_COLORS[type]} h-full`} style={{ width: `${pct}%` }} />
              ) : null
            })}
          </div>
        </section>

        {/* ── Enrichment CTA ───────────────────────────────────────────── */}
        {needsEnrichment.length > 0 && (
          <section className="bg-surface rounded-2xl p-4 border border-accent/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-body text-sm text-text font-medium">Load full analysis</p>
                <p className="font-body text-xs text-text-secondary mt-0.5">
                  {needsEnrichment.length} film{needsEnrichment.length !== 1 ? 's' : ''} need extra data for decade, country, studio, and franchise stats.
                </p>
                {enrichProgress && (
                  <div className="mt-2">
                    <div className="bg-bg rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-accent transition-all"
                        style={{ width: `${Math.round((enrichProgress.done / enrichProgress.total) * 100)}%` }}
                      />
                    </div>
                    <p className="text-text-secondary text-xs font-body mt-1">
                      {enrichProgress.done} / {enrichProgress.total}
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={loadFullStats}
                disabled={enriching}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-xl text-sm font-body font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {enriching ? <RefreshCw size={13} className="animate-spin" /> : <BarChart3 size={13} />}
                {enriching ? 'Loading…' : 'Load'}
              </button>
            </div>
          </section>
        )}

        {/* ── Genres ───────────────────────────────────────────────────── */}
        {stats.genres.length > 0 && (
          <section>
            <SectionHeader title="Genres" sub="Click to filter all stats by genre" />
            <div className="space-y-0.5">
              {stats.genres.map((g) => (
                <StatRow
                  key={g.key}
                  label={g.name}
                  count={g.count}
                  avg={g.avg}
                  maxCount={maxGenre}
                  onFilter={() => setFilter('genre', g.key, g.name)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Decades ──────────────────────────────────────────────────── */}
        {stats.decades.length > 0 && (
          <section>
            <SectionHeader title="By Decade" />
            <div className="space-y-0.5">
              {stats.decades.map((d) => (
                <DecadeBar
                  key={d.key}
                  decade={d.key === 'classics' ? 'classics' : Number(d.key)}
                  count={d.count}
                  avg={d.avg}
                  maxCount={maxDecade}
                  onFilter={() => setFilter('decade', d.key, d.key === 'classics' ? 'Pre-1950s' : `${d.key}s`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Directors ────────────────────────────────────────────────── */}
        {stats.directors.length > 0 && (
          <section>
            <SectionHeader title="Directors" sub="By films rated — click to filter" />
            <div className="space-y-0.5">
              {stats.directors.map((d) => (
                <StatRow
                  key={d.key}
                  label={d.key}
                  count={d.count}
                  avg={d.avg}
                  maxCount={maxDirector}
                  onFilter={() => setFilter('director', d.key, d.key)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Actors ───────────────────────────────────────────────────── */}
        {stats.actors.length > 0 && (
          <section>
            <SectionHeader title="Actors" sub="Across all rated films" />
            <div className="space-y-0.5">
              {stats.actors.map((a) => (
                <StatRow
                  key={a.key}
                  label={a.key}
                  count={a.count}
                  avg={a.avg}
                  maxCount={maxActor}
                  onFilter={() => setFilter('actor', a.key, a.key)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Themes ───────────────────────────────────────────────────── */}
        {(likedKw.length > 0 || dislikedKw.length > 0) && (
          <section>
            <SectionHeader title="Themes & Keywords" sub="Derived from movies you rated strongly" />
            {likedKw.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-body text-emerald-400 uppercase tracking-wide mb-2">Themes you enjoy</p>
                <div className="flex flex-wrap gap-2">
                  {likedKw.map((k) => (
                    <span key={k.key} className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-400 font-body capitalize">
                      {k.key}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {dislikedKw.length > 0 && (
              <div>
                <p className="text-xs font-body text-red-400 uppercase tracking-wide mb-2">Themes you avoid</p>
                <div className="flex flex-wrap gap-2">
                  {dislikedKw.map((k) => (
                    <span key={k.key} className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-xs text-red-400 font-body capitalize">
                      {k.key}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Countries ────────────────────────────────────────────────── */}
        {stats.countries.length > 0 && (
          <section>
            <SectionHeader title="Countries" />
            <div className="space-y-0.5">
              {stats.countries.map((c) => (
                <StatRow
                  key={c.key}
                  label={c.key}
                  count={c.count}
                  avg={c.avg}
                  maxCount={maxCountry}
                  onFilter={() => setFilter('country', c.key, c.key)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Studios ──────────────────────────────────────────────────── */}
        {stats.studios.length > 0 && (
          <section>
            <SectionHeader title="Studios" />
            <div className="space-y-0.5">
              {stats.studios.map((s) => (
                <StatRow
                  key={s.key}
                  label={s.key}
                  count={s.count}
                  avg={s.avg}
                  maxCount={maxStudio}
                  onFilter={() => setFilter('studio', s.key, s.key)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Franchises ───────────────────────────────────────────────── */}
        {stats.collections.length > 0 && (
          <section>
            <SectionHeader title="Franchises & Series" />
            <div className="space-y-0.5">
              {stats.collections.map((c) => (
                <StatRow
                  key={c.key}
                  label={c.key}
                  count={c.count}
                  maxCount={Math.max(...stats.collections.map((x) => x.count), 1)}
                  onFilter={() => setFilter('collection', c.key, c.key)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Rating Activity ───────────────────────────────────────────── */}
        {stats.activity.length > 0 && (
          <section>
            <SectionHeader title="Rating Activity" sub="Last 18 months" />
            <div className="flex items-end gap-1 h-16">
              {stats.activity.map(([month, count]) => {
                const pct = maxActivity > 0 ? (count / maxActivity) * 100 : 0
                const label = new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' })
                return (
                  <div key={month} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-accent/60 rounded-sm"
                      style={{ height: `${Math.max(pct, 4)}%` }}
                      title={`${label}: ${count}`}
                    />
                    {stats.activity.length <= 12 && (
                      <span className="text-text-secondary/50 text-xs font-body" style={{ fontSize: '9px' }}>{label}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

      </main>

      <TabBar />
    </div>
  )
}
