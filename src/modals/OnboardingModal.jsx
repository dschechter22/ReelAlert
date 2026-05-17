import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import GenrePicker from '../components/GenrePicker'
import { ChevronRight, ChevronLeft, X, MapPin, Film, Star, Bell, Check } from 'lucide-react'

const QUALITY_PRESETS = {
  low: { label: 'Relaxed', desc: 'Show most movies in theaters', rt: 50, tmdb: 5.5 },
  medium: { label: 'Balanced', desc: 'Good quality bar, not too strict', rt: 70, tmdb: 6.5 },
  high: { label: 'Selective', desc: 'Only well-reviewed films', rt: 85, tmdb: 7.5 },
}

const CADENCE_OPTIONS = [
  { value: 'daily', label: 'Daily', desc: 'Every morning' },
  { value: 'weekly', label: 'Weekly', desc: 'Every Friday' },
  { value: 'biweekly', label: 'Bi-weekly', desc: 'Every other Friday' },
]

const STEPS = [
  { id: 'welcome', title: 'Welcome to ReelAlert', icon: Film },
  { id: 'location', title: 'Where are you?', icon: MapPin },
  { id: 'genres', title: 'Your taste in genres', icon: Film },
  { id: 'quality', title: 'Quality bar', icon: Star },
  { id: 'cadence', title: 'How often?', icon: Bell },
]

export default function OnboardingModal({ onComplete, onClose }) {
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [zip, setZip] = useState('')
  const [phone, setPhone] = useState('')
  const [genrePrefs, setGenrePrefs] = useState([])
  const [quality, setQuality] = useState('medium')
  const [cadence, setCadence] = useState('weekly')
  const [saving, setSaving] = useState(false)

  const currentStep = STEPS[step]
  const totalSteps = STEPS.length

  function next() {
    if (step < totalSteps - 1) setStep(step + 1)
  }
  function back() {
    if (step > 0) setStep(step - 1)
  }

  async function finish() {
    setSaving(true)
    try {
      if (user) {
        const preset = QUALITY_PRESETS[quality]
        // Save user metadata
        await supabase.auth.updateUser({
          data: { zip_code: zip, phone_number: phone, sms_cadence: cadence }
        })
        // Save thresholds
        await supabase.from('user_rating_thresholds').upsert([
          { user_id: user.id, source: 'rt_critic', min_score: preset.rt, and_or_operator: 'and' },
          { user_id: user.id, source: 'tmdb', min_score: preset.tmdb, and_or_operator: 'and' },
        ])
        // Save genre prefs
        if (genrePrefs.length > 0) {
          await supabase.from('user_genre_preferences').upsert(
            genrePrefs.map((gp) => ({ ...gp, user_id: user.id })),
            { onConflict: 'user_id,genre_id' }
          )
        }
      }
    } catch (err) {
      console.error('Onboarding save error:', err)
    } finally {
      setSaving(false)
      onComplete?.()
    }
  }

  const canAdvance = () => {
    if (currentStep.id === 'location') return zip.trim().length >= 5
    return true
  }

  return (
    <>
      {/* Blurred backdrop */}
      <div className="fixed inset-0 z-40 backdrop-blur-md bg-black/50 fade-in" />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="w-full max-w-md bg-bg border border-accent-secondary/20 rounded-3xl shadow-2xl modal-scale-in overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-surface">
            <div
              className="h-full bg-accent transition-all duration-500 ease-out"
              style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            />
          </div>

          {/* Close */}
          <div className="flex justify-between items-center px-5 pt-4 pb-2">
            <span className="text-text-secondary font-body text-xs">
              Step {step + 1} of {totalSteps}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-text-secondary hover:text-text transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="px-5 pb-5">
            {/* Welcome step */}
            {currentStep.id === 'welcome' && (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-5">
                  <Film size={28} className="text-accent" />
                </div>
                <h2 className="font-heading font-bold text-text text-2xl mb-3">Welcome to ReelAlert</h2>
                <p className="text-text-secondary font-body text-sm leading-relaxed mb-6">
                  Let's spend 2 minutes setting up your taste profile. We'll use it to rank every film currently in theaters and text you the ones worth your time.
                </p>
                <div className="space-y-2 text-left">
                  {['Set your genre priorities', 'Configure quality thresholds', 'Choose your SMS cadence'].map((item) => (
                    <div key={item} className="flex items-center gap-3 px-4 py-2.5 bg-surface rounded-xl">
                      <Check size={14} className="text-accent flex-shrink-0" />
                      <span className="text-text font-body text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Location step */}
            {currentStep.id === 'location' && (
              <div className="py-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
                  <MapPin size={22} className="text-accent" />
                </div>
                <h2 className="font-heading font-bold text-text text-2xl mb-2">Where are you?</h2>
                <p className="text-text-secondary font-body text-sm mb-5">
                  We'll find AMC theaters near you and include showtimes in your digest.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-text-secondary text-xs font-body uppercase tracking-wide mb-1.5">
                      Zip code <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      placeholder="10023"
                      maxLength={10}
                      className="w-full bg-surface border border-accent-secondary/20 rounded-xl px-4 py-3 text-text font-body text-base placeholder-text-secondary focus:outline-none focus:border-accent/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary text-xs font-body uppercase tracking-wide mb-1.5">
                      Phone number (for SMS)
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full bg-surface border border-accent-secondary/20 rounded-xl px-4 py-3 text-text font-body text-base placeholder-text-secondary focus:outline-none focus:border-accent/50 transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Genres step */}
            {currentStep.id === 'genres' && (
              <div className="py-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
                  <Film size={22} className="text-accent" />
                </div>
                <h2 className="font-heading font-bold text-text text-2xl mb-2">Your genre taste</h2>
                <p className="text-text-secondary font-body text-sm mb-5">
                  Tap each genre to mark it as Must See, Fine, or Never. This shapes your ReelScore.
                </p>
                <div className="max-h-64 overflow-y-auto">
                  <GenrePicker preferences={genrePrefs} onChange={setGenrePrefs} />
                </div>
              </div>
            )}

            {/* Quality step */}
            {currentStep.id === 'quality' && (
              <div className="py-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
                  <Star size={22} className="text-accent" />
                </div>
                <h2 className="font-heading font-bold text-text text-2xl mb-2">Quality bar</h2>
                <p className="text-text-secondary font-body text-sm mb-5">
                  Choose how selective you want ReelAlert to be when scoring films.
                </p>
                <div className="space-y-3">
                  {Object.entries(QUALITY_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => setQuality(key)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                        quality === key
                          ? 'bg-accent/10 border-accent/30'
                          : 'bg-surface border-accent-secondary/20 hover:border-accent/20'
                      }`}
                    >
                      <div>
                        <p className={`font-heading font-semibold text-base ${quality === key ? 'text-accent' : 'text-text'}`}>
                          {preset.label}
                        </p>
                        <p className="text-text-secondary font-body text-xs">{preset.desc}</p>
                      </div>
                      <div className="text-right text-xs font-body text-text-secondary">
                        <p>RT ≥ {preset.rt}%</p>
                        <p>TMDB ≥ {preset.tmdb}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Cadence step */}
            {currentStep.id === 'cadence' && (
              <div className="py-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
                  <Bell size={22} className="text-accent" />
                </div>
                <h2 className="font-heading font-bold text-text text-2xl mb-2">How often?</h2>
                <p className="text-text-secondary font-body text-sm mb-5">
                  Choose how frequently you'd like to receive your SMS digest.
                </p>
                <div className="space-y-3">
                  {CADENCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setCadence(opt.value)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                        cadence === opt.value
                          ? 'bg-accent/10 border-accent/30'
                          : 'bg-surface border-accent-secondary/20 hover:border-accent/20'
                      }`}
                    >
                      <div>
                        <p className={`font-heading font-semibold text-base ${cadence === opt.value ? 'text-accent' : 'text-text'}`}>
                          {opt.label}
                        </p>
                        <p className="text-text-secondary font-body text-xs">{opt.desc}</p>
                      </div>
                      {cadence === opt.value && (
                        <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                          <Check size={12} className="text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 mt-6">
              {step > 0 && (
                <button
                  onClick={back}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-surface border border-accent-secondary/20 rounded-xl text-text-secondary text-sm font-body hover:text-text transition-colors"
                >
                  <ChevronLeft size={16} />
                  Back
                </button>
              )}
              <button
                onClick={step === totalSteps - 1 ? finish : next}
                disabled={!canAdvance() || saving}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-accent text-white rounded-xl text-sm font-medium font-body hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? 'Saving…' : step === totalSteps - 1 ? 'All done!' : (
                  <>Next <ChevronRight size={16} /></>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
