import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../lib/supabase'
import { DEFAULT_MOCK_PREFS } from '../lib/mockData'
import TabBar from '../components/TabBar'
import GenrePicker from '../components/GenrePicker'
import PeopleSearch from '../components/PeopleSearch'
import RatingSlider from '../components/RatingSlider'
import SMSPreview from '../components/SMSPreview'
import { ChevronRight, LogOut, Bell, Palette, Users, BarChart3, Film, Phone } from 'lucide-react'

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

const QUALITY_PRESETS = {
  low: { rt_critic: 50, tmdb: 5.5, letterboxd: 2.5, rt_audience: 50 },
  medium: { rt_critic: 70, tmdb: 6.5, letterboxd: 3.0, rt_audience: 65 },
  high: { rt_critic: 85, tmdb: 7.5, letterboxd: 3.8, rt_audience: 80 },
}

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

  const [cadence, setCadence] = useState('weekly')
  const [smsTime, setSmsTime] = useState('10:00')
  const [phone, setPhone] = useState('')
  const [zip, setZip] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Rating thresholds state
  const [thresholds, setThresholds] = useState({
    rt_critic: { value: 70, operator: 'and' },
    rt_audience: { value: 65, operator: 'or' },
    tmdb: { value: 6.5, operator: 'and' },
    letterboxd: { value: 3.0, operator: 'or' },
  })

  // Genre preferences
  const [genrePrefs, setGenrePrefs] = useState(DEFAULT_MOCK_PREFS.genrePreferences)

  // People preferences
  const [peoplePref, setPeoplePref] = useState(DEFAULT_MOCK_PREFS.peoplePreferences)

  useEffect(() => {
    if (user) {
      setPhone(user.user_metadata?.phone_number || '')
      setZip(user.user_metadata?.zip_code || '')
      setCadence(user.user_metadata?.sms_cadence || 'weekly')
    }
  }, [user])

  function applyQualityPreset(preset) {
    const vals = QUALITY_PRESETS[preset]
    setThresholds((prev) => ({
      rt_critic: { value: vals.rt_critic, operator: prev.rt_critic.operator },
      rt_audience: { value: vals.rt_audience, operator: prev.rt_audience.operator },
      tmdb: { value: vals.tmdb, operator: prev.tmdb.operator },
      letterboxd: { value: vals.letterboxd, operator: prev.letterboxd.operator },
    }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      // Save to Supabase if user exists
      if (user) {
        await supabase.auth.updateUser({
          data: { phone_number: phone, zip_code: zip, sms_cadence: cadence, sms_time: smsTime }
        })
        const threshArr = Object.entries(thresholds).map(([source, t]) => ({
          user_id: user.id, source, min_score: t.value, and_or_operator: t.operator,
        }))
        await supabase.from('user_rating_thresholds').upsert(threshArr, { onConflict: 'user_id,source' })
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

  // Build prefs for live SMS preview
  const previewPrefs = {
    globalThresholds: Object.entries(thresholds).map(([source, t]) => ({
      source, min_score: t.value, and_or_operator: t.operator,
    })),
    genreThresholds: [],
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
          <div>
            <label className="block text-text-secondary text-xs font-body uppercase tracking-wide mb-2">Send time</label>
            <input
              type="time"
              value={smsTime}
              onChange={(e) => setSmsTime(e.target.value)}
              className="w-full bg-bg border border-accent-secondary/20 rounded-xl px-4 py-2.5 text-text font-body text-sm focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>
        </div>

        {/* SMS Preview */}
        <SectionHeader icon={Phone} title="Digest Preview" />
        <SMSPreview cadence={cadence} prefs={previewPrefs} />

        {/* Genre Preferences */}
        <SectionHeader icon={Film} title="Genre Preferences" />
        <div className="bg-surface rounded-2xl p-4">
          <p className="text-text-secondary text-xs font-body mb-3">
            Tap each genre to cycle: <span className="text-emerald-400">Must See</span> → <span className="text-blue-400">Fine</span> → <span className="text-red-400">Never</span> → unset
          </p>
          <GenrePicker preferences={genrePrefs} onChange={setGenrePrefs} />
        </div>

        {/* Rating Thresholds */}
        <SectionHeader icon={BarChart3} title="Rating Thresholds" />
        <div className="space-y-3">
          {/* Presets */}
          <div className="flex gap-2">
            {Object.keys(QUALITY_PRESETS).map((preset) => (
              <button
                key={preset}
                onClick={() => applyQualityPreset(preset)}
                className="flex-1 py-2 rounded-xl text-sm font-body font-medium border bg-surface text-text-secondary border-accent-secondary/20 hover:border-accent/30 hover:text-text capitalize transition-colors"
              >
                {preset}
              </button>
            ))}
          </div>
          {Object.entries(thresholds).map(([source, t]) => (
            <RatingSlider
              key={source}
              source={source}
              value={t.value}
              operator={t.operator}
              onChange={(val) => setThresholds((prev) => ({ ...prev, [source]: { ...prev[source], value: val } }))}
              onOperatorChange={(op) => setThresholds((prev) => ({ ...prev, [source]: { ...prev[source], operator: op } }))}
            />
          ))}
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
    </div>
  )
}
