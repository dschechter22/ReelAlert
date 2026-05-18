import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Film, Bell, Star, ChevronRight, Check } from 'lucide-react'

const FEATURES = [
  {
    icon: '🎯',
    title: 'Taste-matched picks',
    desc: 'Set your genre preferences, rating floors, and favorite filmmakers. We do the rest.',
  },
  {
    icon: '📱',
    title: 'SMS digests, on your schedule',
    desc: 'Get a curated shortlist texted to you — daily, weekly, or bi-weekly. No app to open.',
  },
  {
    icon: '🎬',
    title: 'ReelScore rankings',
    desc: 'Every film gets a personalized ReelScore blending TMDB, Rotten Tomatoes, and Letterboxd.',
  },
  {
    icon: '🎭',
    title: 'Showtime integration',
    desc: 'See showtimes at your preferred AMC theaters directly in the app.',
  },
]

const STEPS = [
  { num: '01', title: 'Set your taste', desc: 'Pick genres, quality thresholds, and your must-see filmmakers in 2 minutes.' },
  { num: '02', title: 'We rank what\'s in theaters', desc: 'Our ReelScore algorithm evaluates every current release against your personal filters.' },
  { num: '03', title: 'Receive your digest', desc: 'A ranked shortlist lands in your texts on whatever cadence works for you.' },
]

const MOCK_SMS = `🎬 ReelAlert Weekly Digest

Top picks for you this week:

1. The Cartographer's Daughter
   Must See · 94/100
   Drama, Fantasy

2. Veil of the Departed
   Worth Watching · 82/100
   Horror, Mystery

3. Lullaby for the End of the World
   Must See · 91/100
   Drama, Romance

Full details at reelalert.app
Reply STOP to unsubscribe.`

export default function Landing() {
  const [showAuth, setShowAuth] = useState(null) // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const { signIn, signUp, user } = useAuth()
  const navigate = useNavigate()

  if (user) {
    navigate('/dashboard', { replace: true })
    return null
  }

  async function handleAuth(e) {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)
    try {
      if (showAuth === 'login') {
        await signIn(email, password)
        navigate('/dashboard')
      } else {
        await signUp(email, password)
        navigate('/dashboard')
      }
    } catch (err) {
      setAuthError(err.message || 'Authentication failed.')
    } finally {
      setAuthLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg font-body">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-20 border-b border-accent-secondary/15 backdrop-blur-sm"
        style={{ background: 'rgb(var(--color-bg) / 0.85)' }}>
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film size={22} className="text-accent" />
            <span className="font-heading font-bold text-text text-lg tracking-tight">ReelAlert</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAuth('login')}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text transition-colors font-body"
            >
              Log in
            </button>
            <button
              onClick={() => setShowAuth('signup')}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-accent text-white hover:opacity-90 transition-opacity font-body"
            >
              Sign up
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-28 pb-20 px-5 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-medium font-body mb-6">
          <Bell size={12} />
          Now in beta — SMS digests for cinephiles
        </div>
        <h1 className="font-heading font-bold text-text text-4xl sm:text-5xl md:text-6xl leading-tight mb-6">
          Your taste.<br />
          In theaters.<br />
          <span className="text-accent">In your texts.</span>
        </h1>
        <p className="text-text-secondary text-lg sm:text-xl font-body leading-relaxed max-w-xl mx-auto mb-8">
          ReelAlert ranks every movie currently in theaters against your personal taste profile —
          then texts you a curated shortlist so you never miss a film made for you.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => setShowAuth('signup')}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-accent text-white rounded-xl font-medium text-base hover:opacity-90 transition-opacity font-body"
          >
            Get started free
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => setShowAuth('login')}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-surface text-text rounded-xl font-medium text-base hover:opacity-80 transition-opacity border border-accent-secondary/30 font-body"
          >
            I have an account
          </button>
        </div>
      </section>

      {/* SMS Preview */}
      <section className="py-16 px-5">
        <div className="max-w-md mx-auto">
          <p className="text-center text-text-secondary text-sm font-body uppercase tracking-widest mb-8">
            What your digest looks like
          </p>
          {/* Phone mockup */}
          <div className="bg-gray-900 rounded-3xl p-4 shadow-2xl border border-gray-700 mx-auto max-w-xs">
            <div className="flex justify-between items-center px-1 py-1 mb-3">
              <span className="text-white text-xs font-medium">9:41</span>
              <div className="w-16 h-5 bg-gray-800 rounded-full" />
            </div>
            <div className="text-center py-2 border-b border-gray-700 mb-4">
              <p className="text-gray-300 text-sm font-semibold">ReelAlert</p>
              <p className="text-gray-500 text-xs">Today 9:41 AM</p>
            </div>
            <div className="flex justify-start mb-4 px-1">
              <div className="max-w-[85%] bg-gray-700 rounded-2xl rounded-tl-sm px-3.5 py-3">
                <pre className="text-white text-xs leading-relaxed whitespace-pre-wrap font-sans">{MOCK_SMS}</pre>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-gray-800 rounded-full px-4 py-2">
              <span className="flex-1 text-gray-500 text-xs">iMessage</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-5 max-w-4xl mx-auto">
        <h2 className="font-heading font-bold text-text text-3xl text-center mb-12">
          Built for people who actually care about film
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-surface rounded-2xl p-6 border border-accent-secondary/15">
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-heading font-semibold text-text text-lg mb-2">{f.title}</h3>
              <p className="text-text-secondary font-body text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-5 max-w-3xl mx-auto">
        <h2 className="font-heading font-bold text-text text-3xl text-center mb-12">
          How it works
        </h2>
        <div className="space-y-6">
          {STEPS.map((step, i) => (
            <div key={step.num} className="flex gap-5 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                <span className="text-accent font-heading font-bold text-sm">{step.num}</span>
              </div>
              <div className="pt-1.5">
                <h3 className="font-heading font-semibold text-text text-lg mb-1">{step.title}</h3>
                <p className="text-text-secondary font-body text-sm leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-5 text-center">
        <div className="max-w-xl mx-auto bg-surface border border-accent-secondary/20 rounded-3xl p-10">
          <Star className="mx-auto text-accent mb-4" size={32} />
          <h2 className="font-heading font-bold text-text text-3xl mb-4">
            Start your first digest for free
          </h2>
          <p className="text-text-secondary font-body mb-6">
            No credit card required. Setup takes under 2 minutes.
          </p>
          <button
            onClick={() => setShowAuth('signup')}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-accent text-white rounded-xl font-medium hover:opacity-90 transition-opacity font-body"
          >
            Create free account
            <ChevronRight size={18} />
          </button>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-6 text-text-secondary text-sm font-body">
            {['Free forever', 'No spam', 'SMS-only', 'Cancel anytime'].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <Check size={14} className="text-accent" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-accent-secondary/15 py-6 px-5 text-center text-text-secondary text-sm font-body">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Film size={16} className="text-accent" />
          <span className="font-heading font-semibold text-text">ReelAlert</span>
        </div>
        <p className="mb-3">Your taste. In theaters. In your texts.</p>
        <div className="flex items-center justify-center gap-4 text-xs text-text-secondary/60">
          <Link to="/terms" className="hover:text-text-secondary transition-colors">Terms of Service</Link>
          <span>·</span>
          <Link to="/privacy" className="hover:text-text-secondary transition-colors">Privacy Policy</Link>
        </div>
      </footer>

      {/* Auth Modal */}
      {showAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAuth(null)}
          />
          <div className="relative bg-bg border border-accent-secondary/20 rounded-2xl p-8 w-full max-w-sm shadow-2xl modal-scale-in">
            <div className="flex items-center gap-2 mb-6">
              <Film size={20} className="text-accent" />
              <span className="font-heading font-bold text-text text-lg">
                {showAuth === 'login' ? 'Welcome back' : 'Create your account'}
              </span>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-text-secondary text-sm font-body mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-surface border border-accent-secondary/20 rounded-xl px-4 py-3 text-text font-body text-sm placeholder-text-secondary focus:outline-none focus:border-accent/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-text-secondary text-sm font-body mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full bg-surface border border-accent-secondary/20 rounded-xl px-4 py-3 text-text font-body text-sm placeholder-text-secondary focus:outline-none focus:border-accent/50 transition-colors"
                />
              </div>

              {authError && (
                <p className="text-red-400 text-sm font-body bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 bg-accent text-white rounded-xl font-medium font-body hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {authLoading ? 'Please wait…' : showAuth === 'login' ? 'Log in' : 'Create account'}
              </button>
            </form>

            <p className="mt-4 text-center text-text-secondary text-sm font-body">
              {showAuth === 'login' ? (
                <>No account? <button onClick={() => setShowAuth('signup')} className="text-accent hover:underline">Sign up</button></>
              ) : (
                <>Already a member? <button onClick={() => setShowAuth('login')} className="text-accent hover:underline">Log in</button></>
              )}
            </p>
            {showAuth === 'signup' && (
              <p className="mt-3 text-center text-text-secondary/50 text-xs font-body">
                By signing up, you agree to our{' '}
                <Link to="/terms" className="underline hover:text-text-secondary">Terms of Service</Link>
                {' '}and{' '}
                <Link to="/privacy" className="underline hover:text-text-secondary">Privacy Policy</Link>.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
