import { Progress } from '@/components/ui/progress'

interface SessionProgressProps {
  current: number
  total: number
  phase: 'words' | 'sentences' | 'review'
}

const phaseLabels = {
  words: 'Kelime Turu',
  sentences: 'Cümle Turu',
  review: 'Tekrar',
}

export function SessionProgress({ current, total, phase }: SessionProgressProps) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-slate-500">
        <span>{phaseLabels[phase]}</span>
        <span>{current}/{total}</span>
      </div>
      <Progress value={percent} className="h-2" />
    </div>
  )
}
