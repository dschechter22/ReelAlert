import { MOCK_MOVIES } from '../lib/mockData'
import { computeReelScore } from '../lib/reelScore'
import { DEFAULT_MOCK_PREFS } from '../lib/mockData'

function buildDigestText(movies, cadence) {
  const top = movies.slice(0, 3)
  const cadenceLabel = cadence === 'daily' ? 'Daily' : cadence === 'weekly' ? 'Weekly' : 'Bi-weekly'
  const lines = [
    `🎬 ReelAlert ${cadenceLabel} Digest`,
    `Top picks for you this week:`,
    '',
    ...top.map((m, i) => [
      `${i + 1}. ${m.title}`,
      `   ${m.bucketLabel} · ${m.score}/100`,
      `   ${(m.genres || []).slice(0,2).map(g => typeof g === 'object' ? g.name : g).join(', ')}`,
    ]).flat(),
    '',
    `Full details at reelalert.app`,
    `Reply STOP to unsubscribe.`,
  ]
  return lines.join('\n')
}

export default function SMSPreview({ cadence = 'weekly', prefs }) {
  const movies = MOCK_MOVIES.map((m) => {
    const result = computeReelScore(m, prefs || DEFAULT_MOCK_PREFS)
    return { ...m, ...result }
  }).sort((a, b) => b.score - a.score)

  const text = buildDigestText(movies, cadence)

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Phone mockup */}
      <div className="w-full max-w-xs bg-gray-900 rounded-3xl p-3 shadow-2xl border border-gray-700">
        {/* Status bar */}
        <div className="flex justify-between items-center px-2 py-1 mb-2">
          <span className="text-white text-xs font-medium">9:41</span>
          <div className="flex gap-1 items-center">
            <div className="flex gap-0.5">
              {[1,2,3,4].map(i => (
                <div key={i} className="bg-white rounded-sm" style={{ width: 3, height: 3 + i * 2 }} />
              ))}
            </div>
            <div className="w-4 h-2 border border-white rounded-sm ml-1">
              <div className="w-3/4 h-full bg-white rounded-sm" />
            </div>
          </div>
        </div>

        {/* Messages header */}
        <div className="text-center py-2 border-b border-gray-700 mb-3">
          <p className="text-gray-400 text-xs">ReelAlert</p>
          <p className="text-gray-500 text-xs">Today</p>
        </div>

        {/* Message bubble */}
        <div className="flex justify-start mb-4">
          <div className="max-w-[85%] bg-gray-700 rounded-2xl rounded-tl-md px-3 py-2.5">
            <pre className="text-white text-xs leading-relaxed whitespace-pre-wrap font-sans">
              {text}
            </pre>
          </div>
        </div>

        {/* Input bar */}
        <div className="flex items-center gap-2 bg-gray-800 rounded-full px-3 py-2 mt-1">
          <div className="flex-1 text-gray-500 text-xs">iMessage</div>
          <div className="w-5 h-5 bg-gray-600 rounded-full" />
        </div>
      </div>
      <p className="text-text-secondary text-xs font-body text-center">
        Preview of your next SMS digest
      </p>
    </div>
  )
}
