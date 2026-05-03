'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WordCard } from '@/components/learn/WordCard'
import { MultipleChoiceCard } from '@/components/learn/MultipleChoiceCard'
import { SentenceCard } from '@/components/learn/SentenceCard'
import { SessionProgress } from '@/components/learn/SessionProgress'
import { LearnSkeleton } from '@/components/ui/skeleton'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Word } from '@/lib/types'
import Link from 'next/link'

const DAILY_WORD_COUNT = 10

type Exercise =
  | { type: 'flip'; word: Word }
  | { type: 'mc'; word: Word; options: string[] }
  | { type: 'sentence'; word: Word; options: string[]; sentence: string; translation: string }

export default function LearnPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [leveledUp, setLeveledUp] = useState(false)

  useEffect(() => { loadSession() }, [])

  async function loadSession() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles').select('cefr_level').eq('id', user.id).single()
    const level = profile?.cefr_level ?? 'A1'

    const { data: seenWordIds } = await supabase
      .from('user_words').select('word_id').eq('user_id', user.id)
    const excludeIds = seenWordIds?.map(r => r.word_id) ?? []

    let query = supabase.from('words').select('*').eq('cefr_level', level).limit(DAILY_WORD_COUNT)
    if (excludeIds.length > 0) query = query.not('id', 'in', `(${excludeIds.join(',')})`)
    const { data: newWords } = await query

    if (!newWords || newWords.length === 0) {
      setExercises([])
      setLoading(false)
      return
    }

    // Distractor pool (Turkish for MC, English for sentence)
    const { data: poolWords } = await supabase
      .from('words').select('english, turkish').eq('cefr_level', level).limit(150)

    const pool = poolWords ?? []
    const learnTurkish = new Set(newWords.map(w => w.turkish))
    const learnEnglish = new Set(newWords.map(w => w.english.toLowerCase()))

    // Phase 1: Flip cards (learn)
    const flipExercises: Exercise[] = newWords.map(w => ({ type: 'flip', word: w }))

    // Phase 2: Multiple choice — show English, pick Turkish
    const mcExercises: Exercise[] = newWords.map(w => {
      const distractors = pool
        .map(p => p.turkish)
        .filter(t => t !== w.turkish && !learnTurkish.has(t))
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
      const options = [...distractors, w.turkish].sort(() => Math.random() - 0.5)
      return { type: 'mc', word: w, options }
    })

    // Phase 3: Sentence completion — Gemini'den context-aware cümle çek (paralel)
    const sentenceResults = await Promise.all(
      newWords.map(async w => {
        try {
          const res = await fetch('/api/sentence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wordId: w.id }),
          })
          if (!res.ok) return null
          return (await res.json()) as { sentence: string; translation: string }
        } catch {
          return null
        }
      })
    )

    const sentenceExercises: Exercise[] = newWords
      .map((w, i) => ({ word: w, data: sentenceResults[i] }))
      .filter((x): x is { word: Word; data: { sentence: string; translation: string } } => !!x.data)
      .map(({ word: w, data }) => {
        const distractors = pool
          .map(p => p.english)
          .filter(e => e.toLowerCase() !== w.english.toLowerCase() && !learnEnglish.has(e.toLowerCase()))
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
        const options = [...distractors, w.english].sort(() => Math.random() - 0.5)
        return { type: 'sentence', word: w, options, sentence: data.sentence, translation: data.translation }
      })

    // Cümle üretemediğimiz kelimeler için MC fallback
    const sentenceFiller: Exercise[] = newWords
      .filter((_, i) => !sentenceResults[i])
      .map(w => {
        const distractors = pool
          .map(p => p.turkish)
          .filter(t => t !== w.turkish && !learnTurkish.has(t))
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
        const options = [...distractors, w.turkish].sort(() => Math.random() - 0.5)
        return { type: 'mc', word: w, options }
      })

    setExercises([...flipExercises, ...mcExercises, ...sentenceExercises, ...sentenceFiller])
    setLoading(false)
  }

  async function handleResult(correct: boolean) {
    const ex = exercises[currentIndex]

    if (ex.type === 'flip') {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordId: ex.word.id, correct }),
      })
      const data = await res.json()
      if (data.leveledUp) setLeveledUp(true)
    } else {
      setScore(s => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }))
    }

    if (currentIndex + 1 >= exercises.length) {
      setCompleted(true)
    } else {
      setCurrentIndex(i => i + 1)
    }
  }

  if (loading) return <LearnSkeleton />

  if (exercises.length === 0) {
    return (
      <div className="text-center space-y-4 py-20">
        <p className="text-5xl">🎉</p>
        <p className="text-slate-700 font-bold text-lg">Bu seviyede yeni kelime kalmadı!</p>
        <Link href="/review" className={cn(buttonVariants({ variant: 'outline' }))}>Tekrar Yapmaya Git</Link>
      </div>
    )
  }

  if (completed) {
    const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0
    const emoji = pct >= 80 ? '🏆' : pct >= 50 ? '📚' : '💪'
    const wordCount = exercises.filter(e => e.type === 'flip').length
    return (
      <div className="text-center space-y-5 py-8">
        {leveledUp && (
          <div className="rounded-3xl p-5 text-white text-center" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
            <p className="text-4xl mb-2">🎊</p>
            <p className="text-xl font-black">Seviye Atladın!</p>
            <p className="text-white/80 text-sm mt-1">Tebrikler, bir üst seviyeye geçtin</p>
          </div>
        )}
        <div className="text-6xl">{emoji}</div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Tur Tamamlandı!</h2>
          <p className="text-slate-500 mt-1">{wordCount} yeni kelime · 3 aşama</p>
        </div>
        <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-5">
          <div className="text-4xl font-black text-indigo-600">{pct}%</div>
          <p className="text-slate-500 text-sm mt-1">Pratik başarısı · {score.correct}/{score.total} doğru</p>
        </div>
        <div className="flex flex-col gap-3">
          <Link
            href="/shadow"
            className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl text-white font-bold shadow-[0_4px_14px_rgba(139,92,246,0.35)]"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
          >
            🎙️ Telaffuz Pratiği Yap
          </Link>
          <Link href="/review" className={cn(buttonVariants(), 'justify-center')}>
            Tekrar Turuna Geç
          </Link>
          <Link href="/" className={cn(buttonVariants({ variant: 'outline' }), 'justify-center')}>
            Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    )
  }

  const ex = exercises[currentIndex]
  const flipCount = exercises.filter(e => e.type === 'flip').length
  const mcCount = exercises.filter(e => e.type === 'mc').length

  let phase: 'words' | 'practice' | 'sentences'
  let phaseIndex: number
  let phaseTotal: number

  if (currentIndex < flipCount) {
    phase = 'words'
    phaseIndex = currentIndex
    phaseTotal = flipCount
  } else if (currentIndex < flipCount + mcCount) {
    phase = 'practice'
    phaseIndex = currentIndex - flipCount
    phaseTotal = mcCount
  } else {
    phase = 'sentences'
    phaseIndex = currentIndex - flipCount - mcCount
    phaseTotal = exercises.length - flipCount - mcCount
  }

  return (
    <div className="space-y-6">
      <SessionProgress current={phaseIndex} total={phaseTotal} phase={phase === 'sentences' ? 'sentences' : phase === 'practice' ? 'practice' : 'words'} />
      {ex.type === 'flip' && (
        <WordCard key={ex.word.id} word={ex.word} onResult={handleResult} />
      )}
      {ex.type === 'mc' && (
        <MultipleChoiceCard key={`mc-${ex.word.id}`} word={ex.word} options={ex.options} onResult={handleResult} />
      )}
      {ex.type === 'sentence' && (
        <SentenceCard
          key={`s-${ex.word.id}`}
          word={ex.word}
          options={ex.options}
          sentence={ex.sentence}
          translation={ex.translation}
          onResult={handleResult}
        />
      )}
    </div>
  )
}
