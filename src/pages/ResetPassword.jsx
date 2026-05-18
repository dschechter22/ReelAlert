import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Film, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  // Supabase sends the user back with a token in the URL hash.
  // The JS client picks it up automatically via onAuthStateChange.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setSessionReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }

    setLoading(true)
    try {
      await updatePassword(password)
      setDone(true)
      setTimeout(() => navigate('/dashboard'), 2500)
    } catch (err) {
      setError(err.message || 'Failed to update password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4 font-body">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Film size={22} className="text-accent" />
          <span className="font-heading font-bold text-text text-xl">ReelAlert</span>
        </div>

        <div className="bg-surface border border-accent-secondary/20 rounded-2xl p-8 shadow-xl">
          {done ? (
            <div className="text-center py-4">
              <CheckCircle size={40} className="text-emerald-400 mx-auto mb-4" />
              <h2 className="font-heading font-bold text-text text-xl mb-2">Password updated</h2>
              <p className="text-text-secondary text-sm">Redirecting you to the app…</p>
            </div>
          ) : !sessionReady ? (
            <div className="text-center py-4">
              <h2 className="font-heading font-bold text-text text-xl mb-3">Checking link…</h2>
              <p className="text-text-secondary text-sm">
                If this page doesn't load, your reset link may have expired.{' '}
                <button onClick={() => navigate('/')} className="text-accent hover:underline">
                  Request a new one
                </button>.
              </p>
            </div>
          ) : (
            <>
              <h2 className="font-heading font-bold text-text text-xl mb-1">Set new password</h2>
              <p className="text-text-secondary text-sm font-body mb-6">Choose a strong password for your account.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-text-secondary text-sm font-body mb-1.5">New password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="w-full bg-bg border border-accent-secondary/20 rounded-xl px-4 py-3 pr-11 text-text font-body text-sm placeholder-text-secondary focus:outline-none focus:border-accent/50 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-text-secondary text-sm font-body mb-1.5">Confirm password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
                    className="w-full bg-bg border border-accent-secondary/20 rounded-xl px-4 py-3 text-text font-body text-sm placeholder-text-secondary focus:outline-none focus:border-accent/50 transition-colors"
                  />
                </div>

                {error && (
                  <p className="text-red-400 text-sm font-body bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-accent text-white rounded-xl font-medium font-body hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {loading ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
