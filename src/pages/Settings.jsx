import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../lib/supabase'
import { DEFAULT_MOCK_PREFS } from '../lib/mockData'
import TabBar from '../components/TabBar'
import GenrePicker from '../components/GenrePicker'
import PeopleSearch from '../components/PeopleSearch'
import SMSPreview from '../components/SMSPreview'
import { ChevronRight, LogOut, Bell, Palette, Users, Film, Phone, Send, RefreshCw } from 'lucide-react'

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

  const [cadence, setCadence] = useState('weekly')
  const [smsTime, setSmsTime] = useState('10:00')
  const [smsDay, setSmsDay] = useState(1)
  const [phone, setPhone] = useState('')
  const [zip, setZip] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testSmsSending, setTestSmsSending] = useState(false)
  const [testSmsResult, setTestSmsResult] = useState(null)

  // Genre preferences
  const [genrePrefs, setGenrePrefs] = useState(DEFAULT_MOCK_PREFS.genrePreferences)

  // People preferences
  const [peoplePref, setPeoplePref] = useState(DEFAULT_MOCK_PREFS.peoplePreferences)

  useEffect(() => {
    if (!user) return
    setPhone(user.user_metadata?.phone_number || '')
    setZip(user.user_metadata?.zip_code || '')
    setCadence(user.user_metadata?.sms_cadence || 'weekly')
    setSmsTime(user.user_metadata?.sms_time || '10:00')
    setSmsDay(user.user_metadata?.sms_day ?? 1)

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
          data: { phone_number: phone, zip_code: zip, sms_cadence: cadence, sms_time: smsTime, sms_day: smsDay }
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
    </div>
  )
}
