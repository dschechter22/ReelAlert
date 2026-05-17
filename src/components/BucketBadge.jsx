import { BUCKET_LABELS } from '../lib/reelScore'

const BUCKET_STYLES = {
  'must-see': 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  'worth-watching': 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  'if-youre-interested': 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  'not-for-you': 'bg-red-500/20 text-red-400 border border-red-500/30',
}

const BUCKET_DOTS = {
  'must-see': 'bg-emerald-400',
  'worth-watching': 'bg-blue-400',
  'if-youre-interested': 'bg-yellow-400',
  'not-for-you': 'bg-red-400',
}

export default function BucketBadge({ bucket, className = '' }) {
  const label = BUCKET_LABELS[bucket] || bucket
  const style = BUCKET_STYLES[bucket] || 'bg-surface text-text-secondary border border-accent-secondary/30'
  const dot = BUCKET_DOTS[bucket] || 'bg-accent'

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium font-body ${style} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  )
}
