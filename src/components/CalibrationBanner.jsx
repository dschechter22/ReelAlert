import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import CalibrationModal from './CalibrationModal'

const KEY = 'ra-calibration-dismissed'

export default function CalibrationBanner({ ratingCount }) {
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(KEY))
  const [showModal, setShowModal] = useState(false)

  if (dismissed || ratingCount >= 5) return null

  function dismiss() {
    localStorage.setItem(KEY, '1')
    setDismissed(true)
  }

  return (
    <>
      <div className="mx-4 mb-3 rounded-2xl border border-accent/25 bg-accent/8 px-4 py-3 flex items-center gap-3">
        <Sparkles size={18} className="text-accent flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-text font-body text-sm font-medium leading-tight">Calibrate your taste</p>
          <p className="text-text-secondary font-body text-xs mt-0.5">Rate a few movies to personalize your suggestions.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex-shrink-0 px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-body font-medium hover:opacity-90 transition-opacity"
        >
          Start
        </button>
        <button onClick={dismiss} className="flex-shrink-0 text-text-secondary/50 hover:text-text-secondary transition-colors" aria-label="Dismiss">
          <X size={15} />
        </button>
      </div>

      {showModal && <CalibrationModal onClose={() => setShowModal(false)} />}
    </>
  )
}
