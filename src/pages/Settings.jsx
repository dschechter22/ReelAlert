import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useRatings } from '../contexts/RatingsContext'
import { supabase } from '../lib/supabase'
import { DEFAULT_MOCK_PREFS } from '../lib/mockData'
import { searchMovies, getMovieDetails } from '../lib/tmdb'
import TabBar from '../components/TabBar'
import GenrePicker from '../components/GenrePicker'
import PeopleSearch from '../components/PeopleSearch'
import SMSPreview from '../components/SMSPreview'
import CalibrationModal from '../components/CalibrationModal'
import { ChevronRight, LogOut, Bell, Palette, Users, Film, Phone, Send, RefreshCw, BarChart3, Sparkles, Upload, Trash2 } from 'lucide-react'
import { DEFAULT_SCORING_WEIGHTS } from '../lib/reelScore'
import { summarizeTasteProfile } from '../lib/tasteProfile'
import { TMDB_GENRES } from '../lib/tmdb'

const GENRE_MAP = Object.fromEntries(TMDB_GENRES.map((g) => [String(g.id), g.name]))

const THEME_OPTIONS = [
  { value: 'minimalist-light', label: 'Minimalist Light', desc: 'Clean & warm' },
  { value: 'minimalist-dark', label: 'Minimalist Dark', desc: 'Dark & warm' },
  { value: 'cinematic-light', label: 'Cinematic Light', desc: 'Dramatic & bright' },
  { value: 'cinematic-dark', label: 'Cinematic Dark', desc: 'Dramatic & moody' },
]

const TYPOGRAPHY_OPTIONS = [
  { value: 'editorial', label: 'Editorial', desc: 'Playfair Display + Inter' },
  { value: 'silver-screen', label: 'Silver Screen', desc: 'Cormorant Garamond + Outfit' },
]

const CADENCE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
]

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2.5 mb-4 mt-6 first:mt-0">
      <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
        <Icon size={16} className="text-accent" />
      </div>
      <h2 className="font-heading font-semibold text-text text-lg">{title}</h2>
    </div>
  )
}

export default function Settings() {
  const { user, signOut } = useAuth()
  const { theme, setTheme, typography, setTypography } = useTheme()
  const { tasteProfile, ratingRows, rate, removeRating } = useRatings()

  const [cadence, setCadence] = useState('weekly')
  const [smsTime, setSmsTime] = useState('10:00')
  const [smsDay, setSmsDay] = useState(1)
  const [phone, setPhone] = useState('')
  const [zip, setZip] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testSmsSending, setTestSmsSending] = useState(false)
  const [testSmsResult, setTestSmsResult] = useState(null)
  const [tasteMaxAdjustment, setTasteMaxAdjustment] = useState(20)
  const [showCalibration, setShowCalibration] = useState(false)
  const [lbImporting, setLbImporting] = useState(false)
  const [lbResult, setLbResult] = useState(null)
  const [lbProgress, setLbProgress] = useState(null) // { current, total }
  const lbInputRef = useRef(null)
  const [lbUsername, setLbUsername] = useState('')
  const [lbUsernameImporting, setLbUsernameImporting] = useState(false)
  const [lbUsernameResult, setLbUsernameResult] = useState(null)

  // Scoring weights (raw units, normalized to 100% internally)
  const [scoringWeights, setScoringWeights] = useState(DEFAULT_SCORING_WEIGHTS)

  // Genre preferences
  const [genrePrefs, setGenrePrefs] = useState(DEFAULT_MOCK_PREFS.genrePreferences)

  // People preferences
  const [peoplePref, setPeoplePref] = useState(DEFAULT_MOCK_PREFS.peoplePreferences)

  const tasteSummary = summarizeTasteProfile(tasteProfile, GENRE_MAP)

  useEffect(() => {
    if (!user) return
    setPhone(user.user_metadata?.phone_number || '')
    setZip(user.user_metadata?.zip_code || '')
    setCadence(user.user_metadata?.sms_cadence || 'weekly')
    setSmsTime(user.user_metadata?.sms_time || '10:00')
    setSmsDay(user.user_metadata?.sms_day ?? 1)
    setScoringWeights(user.user_metadata?.scoring_weights ?? DEFAULT_SCORING_WEIGHTS)
    setTasteMaxAdjustment(Number(user.user_metadata?.taste_max_adjustment ?? 20))

    Promise.all([
      supabase.from('user_genre_preferences').select('*').eq('user_id', user.id),
      supabase.from('user_people_preferences').select('*').eq('user_id', user.id),
    ]).then(([genreRes, peopleRes]) => {
      if (genreRes.data?.length) setGenrePrefs(genreRes.data)
      if (peopleRes.data?.length) setPeoplePref(peopleRes.data)
    })
  }, [user])

  async function handleSave() {
    setSaving(true)
    try {
      // Save to Supabase if user exists
      if (user) {
        await supabase.auth.updateUser({
          data: { phone_number: phone, zip_code: zip, sms_cadence: cadence, sms_time: smsTime, sms_day: smsDay, scoring_weights: scoringWeights, taste_max_adjustment: tasteMaxAdjustment }
        })
        await supabase.from('user_genre_preferences').upsert(
          genrePrefs.map((gp) => ({ ...gp, user_id: user.id })),
          { onConflict: 'user_id,genre_id' }
        )
        await supabase.from('user_people_preferences').upsert(
          peoplePref.map((pp) => ({ ...pp, user_id: user.id })),
          { onConflict: 'user_id,tmdb_person_id' }
        )
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleTestSMS() {
    if (!phone) return
    setTestSmsSending(true)
    setTestSmsResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-digest?test=true`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      setTestSmsResult('success')
    } catch (err) {
      setTestSmsResult(err.message || 'Failed to send test message')
    } finally {
      setTestSmsSending(false)
      setTimeout(() => setTestSmsResult(null), 5000)
    }
  }

  async function handleLetterboxdImport(e) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setLbImporting(true)
    setLbResult(null)

    try {
      const text = await file.text()
      const lines = text.trim().split('\n').filter(Boolean)

      // Auto-detect delimiter (tab or comma)
      const delim = lines[0].includes('\t') ? '\t' : ','
      const header = lines[0].split(delim).map((h) => h.trim().replace(/^"|"$/g, ''))

      const nameIdx   = header.findIndex((h) => h === 'Name')
      const yearIdx   = header.findIndex((h) => h === 'Year')
      const ratingIdx = header.findIndex((h) => h === 'Rating')

      if (nameIdx === -1) { setLbResult({ error: 'Could not find a "Name" column. Make sure you\'re uploading the correct Letterboxd ratings file.' }); return }

      const rows = lines.slice(1).map((line) => {
        const cols = line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ''))
        return {
          name: cols[nameIdx],
          year: yearIdx !== -1 ? cols[yearIdx] : '',
          rating: ratingIdx !== -1 ? parseFloat(cols[ratingIdx]) : NaN,
        }
      }).filter((r) => r.name)

      let imported = 0
      let failed = 0
      setLbProgress({ current: 0, total: rows.length })

      for (let i = 0; i < rows.length; i++) {
        const { name, year, rating: lbRating } = rows[i]
        setLbProgress({ current: i + 1, total: rows.length })

        try {
          // Search with year as a separate param first, fall back without year
          let match = null
          for (const searchYear of [year, null]) {
            const { results } = await searchMovies(name, 1, searchYear || undefined)
            if (!results?.length) continue
            // Prefer exact title match, fall back to first result
            const normalized = name.toLowerCase().trim()
            match = results.find((r) =>
              r.title?.toLowerCase().trim() === normalized ||
              r.original_title?.toLowerCase().trim() === normalized
            ) || results[0]
            if (match) break
          }

          if (!match) { failed++; continue }

          const detail = await getMovieDetails(match.id)
          const keywords = (detail.keywords?.keywords || []).map((k) => k.name)
          const director = detail.credits?.crew?.find((c) => c.job === 'Director')

          // Map Letterboxd stars to rating bucket + explicit taste weight
          let ratingValue, tasteWeight
          if (isNaN(lbRating)) {
            ratingValue = 'seen'; tasteWeight = 0
          } else if (lbRating >= 4.5) {
            ratingValue = 'liked'; tasteWeight = 3
          } else if (lbRating >= 4.0) {
            ratingValue = 'liked'; tasteWeight = 2
          } else if (lbRating >= 3.5) {
            ratingValue = 'liked'; tasteWeight = 1
          } else if (lbRating >= 3.0) {
            ratingValue = 'seen'; tasteWeight = 0
          } else if (lbRating >= 2.5) {
            ratingValue = 'disliked'; tasteWeight = -1
          } else if (lbRating >= 2.0) {
            ratingValue = 'disliked'; tasteWeight = -2
          } else {
            ratingValue = 'disliked'; tasteWeight = -3
          }

          await rate({
            tmdb_id: match.id,
            title: match.title,
            poster_path: match.poster_path,
            genres: detail.genres || [],
            keywords,
            director: director ? { id: director.id, name: director.name } : null,
            taste_weight: tasteWeight,
          }, ratingValue)
          imported++
        } catch {
          failed++
        }

        // Respect TMDB rate limit (~40 req/10s) — small delay between movies
        await new Promise((r) => setTimeout(r, 275))
      }

      setLbResult({ imported, failed })
    } catch (err) {
      setLbResult({ error: err.message })
    } finally {
      setLbImporting(false)
      setLbProgress(null)
      if (lbInputRef.current) lbInputRef.current.value = ''
    }
  }

  async function handleLetterboxdUsernameImport(e) {
    e.preventDefault()
    if (!lbUsername.trim()) return
    setLbUsernameImporting(true)
    setLbUsernameResult(null)

    try {
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? SUPABASE_ANON_KEY

      const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/letterboxd-scrape`)
      url.searchParams.set('username', lbUsername.trim())

      const res = await fetch(url.toString(), {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Failed (${res.status})`)

      const films = data.films ?? []
      if (!films.length) throw new Error('No rated films found on that profile. Make sure the account is public.')

      // Import using same logic as CSV — map rating → bucket + taste_weight
      let imported = 0, failed = 0
      setLbProgress({ current: 0, total: films.length })

      for (const film of films) {
        try {
          const searchRes = await searchMovies(film.title, 1, film.year ?? null)
          const match = searchRes?.results?.[0]
          if (!match) { failed++; continue }

          const lb = film.rating  // 0.5–5.0
          let rating = 'seen', tasteWeight = 0
          if (lb != null) {
            if (lb >= 4.5)      { rating = 'liked';    tasteWeight = 3 }
            else if (lb >= 4.0) { rating = 'liked';    tasteWeight = 2 }
            else if (lb >= 3.5) { rating = 'liked';    tasteWeight = 1 }
            else if (lb >= 3.0) { rating = 'seen';     tasteWeight = 0 }
            else if (lb >= 2.5) { rating = 'disliked'; tasteWeight = -1 }
            else if (lb >= 2.0) { rating = 'disliked'; tasteWeight = -2 }
            else                { rating = 'disliked'; tasteWeight = -3 }
          }

          await rate(match, rating, tasteWeight)
          imported++
          setLbProgress({ current: imported + failed, total: films.length })
          await new Promise((r) => setTimeout(r, 275))
        } catch {
          failed++
        }
      }

      setLbUsernameResult({ imported, failed })
    } catch (err) {
      setLbUsernameResult({ error: err.message })
    } finally {
      setLbUsernameImporting(false)
      setLbProgress(null)
    }
  }

  // Build prefs for live SMS preview
  const previewPrefs = {
    genrePreferences: genrePrefs,
    peoplePreferences: peoplePref,
  }

  return (
    <div className="min-h-screen bg-bg pb-28">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-accent-secondary/15 px-4 py-4 pt-safe"
        style={{ background: 'rgb(var(--color-bg) / 0.9)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="font-heading font-bold text-text text-xl">Settings</h1>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium font-body transition-all ${
              saved
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-accent text-white hover:opacity-90'
            } disabled:opacity-60`}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-1">

        {/* SMS Preferences */}
        <SectionHeader icon={Bell} title="SMS Preferences" />
        <div className="bg-surface rounded-2xl p-4 space-y-4">
          <div>
            <label className="block text-text-secondary text-xs font-body uppercase tracking-wide mb-2">Phone number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full bg-bg border border-accent-secondary/20 rounded-xl px-4 py-2.5 text-text font-body text-sm placeholder-text-secondary focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>
          <div>
            <label className="block text-text-secondary text-xs font-body uppercase tracking-wide mb-2">Zip code</label>
            <input
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="10023"
              maxLength={10}
              className="w-full bg-bg border border-accent-secondary/20 rounded-xl px-4 py-2.5 text-text font-body text-sm placeholder-text-secondary focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>
          <div>
            <label className="block text-text-secondary text-xs font-body uppercase tracking-wide mb-2">Digest cadence</label>
            <div className="flex gap-2">
              {CADENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setCadence(opt.value)}
                  className={`flex-1 py-2 rounded-xl text-sm font-body font-medium border transition-colors ${
                    cadence === opt.value
                      ? 'bg-accent/15 text-accent border-accent/30'
                      : 'bg-bg text-text-secondary border-accent-secondary/20 hover:border-accent/30'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {(cadence === 'weekly' || cadence === 'biweekly') && (
            <div>
              <label className="block text-text-secondary text-xs font-body uppercase tracking-wide mb-2">Send day</label>
              <div className="flex gap-1.5">
                {DAYS_OF_WEEK.map((day, i) => (
                  <button
                    key={i}
                    onClick={() => setSmsDay(i)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-body font-medium border transition-colors ${
                      smsDay === i
                        ? 'bg-accent/15 text-accent border-accent/30'
                        : 'bg-bg text-text-secondary border-accent-secondary/20 hover:border-accent/30'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-text-secondary text-xs font-body uppercase tracking-wide mb-2">Send time</label>
            <input
              type="time"
              value={smsTime}
              onChange={(e) => setSmsTime(e.target.value)}
              className="w-full bg-bg border border-accent-secondary/20 rounded-xl px-4 py-2.5 text-text font-body text-sm focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>
          <div>
            <button
              onClick={handleTestSMS}
              disabled={testSmsSending || !phone}
              className="w-full py-2.5 rounded-xl text-sm font-body font-medium border transition-colors bg-bg border-accent/30 text-accent hover:bg-accent/5 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {testSmsSending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              {testSmsSending ? 'Sending…' : 'Send Test Text'}
            </button>
            {testSmsResult && (
              <p className={`text-xs font-body mt-2 text-center ${testSmsResult === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                {testSmsResult === 'success' ? '✓ Test message sent!' : testSmsResult}
              </p>
            )}
          </div>
        </div>

        {/* SMS Preview */}
        <SectionHeader icon={Phone} title="Digest Preview" />
        <SMSPreview cadence={cadence} prefs={previewPrefs} />

        {/* Scoring Weights */}
        <SectionHeader icon={BarChart3} title="Scoring Weights" />
        <div className="bg-surface rounded-2xl p-4 space-y-4">
          <p className="text-text-secondary text-xs font-body">
            Adjust how much each rating source influences the ReelScore. Weights are normalized automatically.
          </p>
          {[
            { key: 'imdb', label: 'IMDb' },
            { key: 'rt',   label: 'RT Critic' },
            { key: 'lb',   label: 'Letterboxd' },
          ].map(({ key, label }) => {
            const total = (scoringWeights.imdb ?? 0) + (scoringWeights.rt ?? 0) + (scoringWeights.lb ?? 0) || 1
            const pct = Math.round((scoringWeights[key] ?? 0) / total * 100)
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-text font-body text-sm">{label}</span>
                  <span className="text-accent font-body text-sm font-medium tabular-nums">{pct}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={scoringWeights[key] ?? 0}
                  onChange={(e) => setScoringWeights((w) => ({ ...w, [key]: Number(e.target.value) }))}
                  className="w-full accent-accent"
                />
              </div>
            )
          })}
          <button
            onClick={() => setScoringWeights(DEFAULT_SCORING_WEIGHTS)}
            className="text-xs font-body text-text-secondary hover:text-accent transition-colors"
          >
            Reset to default (33 / 33 / 34)
          </button>
        </div>

        {/* Taste Profile */}
        <SectionHeader icon={Sparkles} title="Your Taste DNA" />
        <div className="bg-surface rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-text-secondary font-body text-xs">Based on {ratingRows.length} rated film{ratingRows.length !== 1 ? 's' : ''}</p>
            <button
              onClick={() => setShowCalibration(true)}
              className="text-accent font-body text-xs hover:underline"
            >
              + Rate more films
            </button>
          </div>

          {tasteSummary.liked.length === 0 && tasteSummary.disliked.length === 0 ? (
            <p className="text-text-secondary/50 font-body text-sm text-center py-4">
              Rate some films to see your taste profile here.
            </p>
          ) : (
            <>
              {tasteSummary.liked.length > 0 && (
                <div>
                  <p className="text-emerald-400 font-body text-xs font-medium mb-2">Drawn to</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tasteSummary.liked.map((tag) => (
                      <span key={tag} className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-400 font-body capitalize">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {tasteSummary.disliked.length > 0 && (
                <div>
                  <p className="text-red-400 font-body text-xs font-medium mb-2">Tend to avoid</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tasteSummary.disliked.map((tag) => (
                      <span key={tag} className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-xs text-red-400 font-body capitalize">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Taste influence slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-text font-body text-sm">Taste influence on score</p>
              <span className="text-accent font-body text-sm font-medium">±{tasteMaxAdjustment} pts</span>
            </div>
            <input
              type="range"
              min={0}
              max={50}
              step={5}
              value={tasteMaxAdjustment}
              onChange={(e) => setTasteMaxAdjustment(Number(e.target.value))}
              className="w-full accent-accent"
            />
            <div className="flex justify-between text-text-secondary/50 font-body text-xs mt-1">
              <span>Off</span><span>±25</span><span>Max (±50)</span>
            </div>
          </div>

          {/* Clear ratings */}
          {ratingRows.length > 0 && (
            <button
              onClick={async () => {
                if (!confirm('Clear all your ratings and taste profile? This cannot be undone.')) return
                for (const r of ratingRows) await removeRating(r.tmdb_id)
              }}
              className="flex items-center gap-1.5 text-red-400/70 font-body text-xs hover:text-red-400 transition-colors"
            >
              <Trash2 size={12} /> Reset taste profile
            </button>
          )}
        </div>

        {/* Letterboxd Import */}
        <SectionHeader icon={Upload} title="Import from Letterboxd" />
        <div className="bg-surface rounded-2xl p-4 space-y-4">
          <p className="text-text-secondary font-body text-sm">
            Import your Letterboxd ratings to instantly calibrate your taste profile.
          </p>

          {/* Username import */}
          <div className="space-y-2">
            <p className="text-text font-body text-xs font-medium">Import by username</p>
            <form onSubmit={handleLetterboxdUsernameImport} className="flex gap-2">
              <input
                type="text"
                value={lbUsername}
                onChange={(e) => setLbUsername(e.target.value)}
                placeholder="letterboxd username"
                className="flex-1 bg-bg border border-accent-secondary/20 rounded-xl px-3 py-2 text-sm text-text font-body placeholder-text-secondary focus:outline-none focus:border-accent/40"
              />
              <button
                type="submit"
                disabled={lbUsernameImporting || !lbUsername.trim()}
                className="px-4 py-2 bg-accent text-white rounded-xl text-sm font-body font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1.5"
              >
                {lbUsernameImporting && <RefreshCw size={13} className="animate-spin" />}
                Import
              </button>
            </form>
            {lbUsernameResult && (
              <p className={`font-body text-sm ${lbUsernameResult.error ? 'text-red-400' : 'text-emerald-400'}`}>
                {lbUsernameResult.error
                  ? `Import failed: ${lbUsernameResult.error}`
                  : `Imported ${lbUsernameResult.imported} films${lbUsernameResult.failed ? ` · ${lbUsernameResult.failed} not matched` : ''}.`}
              </p>
            )}
          </div>

          <div className="border-t border-accent-secondary/15 pt-3 space-y-2">
            <p className="text-text font-body text-xs font-medium">Or upload ratings.csv</p>
            <ol className="text-text-secondary/70 font-body text-xs space-y-1 list-decimal ml-4">
              <li>Go to letterboxd.com → Settings → Import & Export</li>
              <li>Click "Export Your Data" and download the ZIP</li>
              <li>Extract the ZIP and upload the <span className="text-text font-medium">ratings.csv</span> file below</li>
            </ol>
            <input
              ref={lbInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleLetterboxdImport}
            />
            <button
              onClick={() => lbInputRef.current?.click()}
              disabled={lbImporting}
              className="flex items-center gap-2 px-4 py-2.5 bg-bg border border-accent-secondary/20 rounded-xl text-text font-body text-sm hover:border-accent/30 transition-colors disabled:opacity-60"
            >
              <Upload size={15} />
              {lbImporting ? 'Importing…' : 'Upload ratings.csv'}
            </button>
          </div>
          {lbProgress && (
            <div>
              <div className="flex justify-between text-xs font-body text-text-secondary mb-1">
                <span>Matching films on TMDB…</span>
                <span>{lbProgress.current} / {lbProgress.total}</span>
              </div>
              <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-200"
                  style={{ width: `${(lbProgress.current / lbProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
          {lbResult && (
            <p className={`font-body text-sm ${lbResult.error ? 'text-red-400' : 'text-emerald-400'}`}>
              {lbResult.error
                ? `Import failed: ${lbResult.error}`
                : `Imported ${lbResult.imported} films${lbResult.failed ? ` · ${lbResult.failed} not matched` : ''}.`}
            </p>
          )}
        </div>

        {/* Genre Preferences */}
        <SectionHeader icon={Film} title="Genre Preferences" />
        <div className="bg-surface rounded-2xl p-4">
          <p className="text-text-secondary text-xs font-body mb-3">
            Tap each genre to cycle: <span className="text-emerald-400">Must See</span> → <span className="text-blue-400">Fine</span> → <span className="text-red-400">Never</span> → unset
          </p>
          <GenrePicker preferences={genrePrefs} onChange={setGenrePrefs} />
        </div>

        {/* People Preferences */}
        <SectionHeader icon={Users} title="People" />
        <div className="bg-surface rounded-2xl p-4">
          <PeopleSearch people={peoplePref} onChange={setPeoplePref} />
        </div>

        {/* Display */}
        <SectionHeader icon={Palette} title="Display" />
        <div className="bg-surface rounded-2xl p-4 space-y-4">
          <div>
            <p className="text-text-secondary text-xs font-body uppercase tracking-wide mb-3">Theme</p>
            <div className="grid grid-cols-2 gap-2">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={`flex flex-col items-start p-3 rounded-xl border transition-all text-left ${
                    theme === opt.value
                      ? 'bg-accent/10 border-accent/30'
                      : 'bg-bg border-accent-secondary/20 hover:border-accent/20'
                  }`}
                >
                  <span className={`font-body text-sm font-medium ${theme === opt.value ? 'text-accent' : 'text-text'}`}>
                    {opt.label}
                  </span>
                  <span className="text-text-secondary font-body text-xs">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-text-secondary text-xs font-body uppercase tracking-wide mb-3">Typography</p>
            <div className="grid grid-cols-2 gap-2">
              {TYPOGRAPHY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTypography(opt.value)}
                  className={`flex flex-col items-start p-3 rounded-xl border transition-all text-left ${
                    typography === opt.value
                      ? 'bg-accent/10 border-accent/30'
                      : 'bg-bg border-accent-secondary/20 hover:border-accent/20'
                  }`}
                >
                  <span className={`font-body text-sm font-medium ${typography === opt.value ? 'text-accent' : 'text-text'}`}>
                    {opt.label}
                  </span>
                  <span className="text-text-secondary font-body text-xs">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Account */}
        <SectionHeader icon={Users} title="Account" />
        <div className="bg-surface rounded-2xl overflow-hidden">
          {user && (
            <div className="px-4 py-3 border-b border-accent-secondary/10">
              <p className="text-text-secondary font-body text-xs">Signed in as</p>
              <p className="text-text font-body text-sm font-medium">{user.email}</p>
            </div>
          )}
          <button
            onClick={signOut}
            className="w-full flex items-center justify-between px-4 py-3.5 text-red-400 hover:bg-red-500/5 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <LogOut size={16} />
              <span className="font-body text-sm">Sign out</span>
            </div>
            <ChevronRight size={16} className="text-red-400/50" />
          </button>
        </div>

        <div className="h-4" />
      </div>

      <TabBar />
      {showCalibration && <CalibrationModal onClose={() => setShowCalibration(false)} />}
    </div>
  )
}
