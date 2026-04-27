'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ReviewCard } from '@/components/review/ReviewCard'
import { SentenceCard } from '@/components/learn/SentenceCard'
import { SessionProgress } from '@/components/learn/SessionProgress'
import { ReviewSkeleton } from '@/components/ui/skeleton'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { UserWord, Word } from '@/lib/types'
import Link from 'next/link'
import { Clock, BookOpen } from 'lucide-react'

type ReviewExercise =
  | { type: 'flip'; userWord: UserWord }
  | { type: 'sentence'; word: Word; options: string[] }

export default function ReviewPage() {
  const [exercises, setExercises] = useState<ReviewExercise[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tomorrowCount, setTomorrowCount] = useState(0)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [flipCount, setFlipCount] = useState(0)

  useEffect(() => { loadDueCards() }, [])

  async function loadDueCards() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const today = new Date().toISOString().split('T')[0]
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    const [{ data }, { count }, { data: profile }] = await Promise.all([
      supabase
        .from('user_words')
        .select('*, word:words(*)')
        .eq('user_id', user.id)
        .lte('next_review_date', today)
        .neq('status', 'new')
        .order('next_review_date', { ascending: true })
        .limit(20),
      supabase
        .from('user_words')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('next_review_date', tomorrowStr)
        .neq('status', 'new'),
      supabase.from('profiles').select('cefr_level').eq('id', user.id).single(),
    ])

    const cards = (data as UserWord[]) ?? []
    const level = profile?.cefr_level ?? 'A1'

    const { data: poolWords } = await supabase
      .from('words').select('english').eq('cefr_level', level).limit(150)

    const pool = poolWords ?? []
    const reviewEnglish = new Set(cards.map(c => c.word?.english?.toLowerCase()).filter(Boolean))

    const flipExercises: ReviewExercise[] = cards.map(uw => ({ type: 'flip', userWord: uw }))

    const sentenceExercises: ReviewExercise[] = cards
      .filter(uw => !!uw.word?.example_sentence)
      .map(uw => {
        const word = uw.word!
        const distractors = pool
          .map(p => p.english)
          .filter(e => e.toLowerCase() !== word.english.toLowerCase() && !reviewEnglish.has(e.toLowerCase()))
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
        const options = [...distractors, word.english].sort(() => Math.random() - 0.5)
        return { type: 'sentence', word, options } as ReviewExercise
      })

    setFlipCount(flipExercises.length)
    setExercises([...flipExercises, ...sentenceExercises])
    setTomorrowCount(count ?? 0)
    setLoading(false)
  }

  function advance() {
    if (currentIndex + 1 >= exercises.length) {
      setCompleted(true)
    } else {
      setCurrentIndex(i => i + 1)
    }
  }

  async function handleFlipResult(quality: number) {
    const ex = exercises[currentIndex] as { type: 'flip'; userWord: UserWord }
    await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId: ex.userWord.word_id, correct: quality >= 3 }),
    })
    advance()
  }

  function handleSentenceResult(correct: boolean) {
    setScore(s => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }))
    advance()
  }

  if (loading) return <ReviewSkeleton />

  if (exercises.length === 0) {
    return (
      <div className="space-y-4 py-10">
        <div className="bg-white rounded-3xl shadow-[0_4px_32px_rgba(0,0,0,0.06)] p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-slate-800">Bugün tekrar yok!</h2>
          <p className="text-slate-500 text-sm mt-2">
            Tüm kartların güncel — kelimeler SM2 algoritmasıyla planlandı
          </p>
        </div>

        {tomorrowCount > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
              <Clock size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-amber-900 text-sm">Yarın {tomorrowCount} kart seni bekliyor</p>
              <p className="text-amber-600 text-xs">Yarın geri gel ve streak'ini koru</p>
            </div>
          </div>
        )}

        <Link
          href="/learn"
          className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl text-white font-bold shadow-[0_4px_14px_rgba(59,130,246,0.35)] hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
        >
          <BookOpen size={18} />
          Yeni Kelime Öğren
        </Link>
      </div>
    )
  }

  if (completed) {
    const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0
    return (
      <div className="text-center space-y-6 py-12">
        <div className="text-6xl">🏆</div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{flipCount} kart tamamlandı</h2>
          <p className="text-slate-500 mt-1">Harika iş, hafızan güçleniyor!</p>
        </div>
        {score.total > 0 && (
          <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-5">
            <div className="text-4xl font-black text-indigo-600">{pct}%</div>
            <p className="text-slate-500 text-sm mt-1">Cümle turu · {score.correct}/{score.total} doğru</p>
          </div>
        )}
        {tomorrowCount > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-amber-700 font-medium">
            Yarın {tomorrowCount} kart daha bekliyor
          </div>
        )}
        <Link href="/" className={cn(buttonVariants(), 'justify-center')}>
          Ana Sayfaya Dön
        </Link>
      </div>
    )
  }

  const ex = exercises[currentIndex]
  const isFlipPhase = currentIndex < flipCount
  const phaseIndex = isFlipPhase ? currentIndex : currentIndex - flipCount
  const phaseTotal = isFlipPhase ? flipCount : exercises.length - flipCount

  return (
    <div className="space-y-6">
      <SessionProgress
        current={phaseIndex}
        total={phaseTotal}
        phase={isFlipPhase ? 'review' : 'sentences'}
      />
      {ex.type === 'flip' && (
        <ReviewCard
          key={ex.userWord.id}
          userWord={ex.userWord}
          onResult={handleFlipResult}
        />
      )}
      {ex.type === 'sentence' && (
        <SentenceCard
          key={`s-${ex.word.id}`}
          word={ex.word}
          options={ex.options}
          onResult={handleSentenceResult}
        />
      )}
    </div>
  )
}
