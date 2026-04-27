interface SessionProgressProps {
  current: number
  total: number
  phase: 'words' | 'sentences' | 'review' | 'practice'
}

const phaseConfig = {
  words:    { label: 'Öğren',     gradient: 'linear-gradient(90deg, #3b82f6, #6366f1)' },
  sentences:{ label: 'Cümle Turu',gradient: 'linear-gradient(90deg, #6366f1, #8b5cf6)' },
  review:   { label: 'Tekrar',    gradient: 'linear-gradient(90deg, #8b5cf6, #a855f7)' },
  practice: { label: 'Pratik Yap',gradient: 'linear-gradient(90deg, #6366f1, #8b5cf6)' },
}

export function SessionProgress({ current, total, phase }: SessionProgressProps) {
  const { label, gradient } = phaseConfig[phase]
  const percent = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-bold text-slate-700">{label}</span>
        <span className="text-sm font-bold text-slate-400">{current}<span className="text-slate-300 font-normal">/{total}</span></span>
      </div>
      <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, background: gradient }}
        />
      </div>
    </div>
  )
}
