'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ReviewCard } from '@/components/review/ReviewCard'
import { SentenceCard } from '@/components/learn/SentenceCard'
import { SessionProgress } from '@/components/learn/SessionProgress'
import { ReviewSkeleton } from '@/components/ui/skeleton'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { UserWord, Word, WordStatus } from '@/lib/types'
import Link from 'next/link'
import { BookOpen, Sparkles, Search, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react'

const PRACTICE_SIZE = 10

type ReviewExercise =
  | { type: 'flip'; userWord: UserWord }
  | { type: 'sentence'; word: Word; options: string[]; sentence: string; translation: string }

type Mode = 'home' | 'practice'

const STATUS_INFO: Record<Exclude<WordStatus, 'new'>, { label: string; color: string }> = {
  learning: { label: 'Öğreniyor', color: 'bg-amber-100 text-amber-700' },
  review:   { label: 'Tekrar',    color: 'bg-blue-100 text-blue-700' },
  mastered: { label: 'Ezber',     color: 'bg-emerald-100 text-emerald-700' },
}

export default function ReviewPage() {
  const [mode, setMode] = useState<Mode>('home')
  const [allLearned, setAllLearned] = useState<UserWord[]>([])
  const [poolEnglish, setPoolEnglish] = useState<string[]>([])
  const [exercises, setExercises] = useState<ReviewExercise[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [practiceLoading, setPracticeLoading] = useState(false)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [flipCount, setFlipCount] = useState(0)
  const [search, setSearch] = useState('')

  useEffect(() => { loadLearned() }, [])

  async function loadLearned() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: learned }, { data: profile }] = await Promise.all([
      supabase
        .from('user_words')
        .select('*, word:words(*)')
        .eq('user_id', user.id)
        .neq('status', 'new')
        .order('last_reviewed_at', { ascending: false }),
      supabase.from('profiles').select('cefr_level').eq('id', user.id).single(),
    ])

    const learnedRows = (learned as UserWord[]) ?? []
    const level = profile?.cefr_level ?? 'A1'

    const { data: poolWords } = await supabase
      .from('words').select('english').eq('cefr_level', level).limit(200)

    setAllLearned(learnedRows)
    setPoolEnglish((poolWords ?? []).map(p => p.english))
    setLoading(false)
  }

  async function startPractice() {
    if (allLearned.length === 0) return
    setPracticeLoading(true)
    setCurrentIndex(0)
    setCompleted(false)
    setScore({ correct: 0, total: 0 })

    const shuffled = [...allLearned].sort(() => Math.random() - 0.5)
    const sample = shuffled.slice(0, Math.min(PRACTICE_SIZE, allLearned.length))

    const flipExercises: ReviewExercise[] = sample.map(uw => ({ type: 'flip', userWord: uw }))
    const wordsWithIds = sample.filter(uw => !!uw.word).map(uw => uw.word!)
    const reviewEnglish = new Set(wordsWithIds.map(w => w.english.toLowerCase()))

    const sentenceResults = await Promise.all(
      wordsWithIds.map(async w => {
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

    const sentenceExercises: ReviewExercise[] = wordsWithIds
      .map((word, i) => ({ word, data: sentenceResults[i] }))
      .filter((x): x is { word: Word; data: { sentence: string; translation: string } } => !!x.data)
      .map(({ word, data }) => {
        const distractors = poolEnglish
          .filter(e => e.toLowerCase() !== word.english.toLowerCase() && !reviewEnglish.has(e.toLowerCase()))
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
        const options = [...distractors, word.english].sort(() => Math.random() - 0.5)
        return { type: 'sentence', word, options, sentence: data.sentence, translation: data.translation }
      })

    setFlipCount(flipExercises.length)
    setExercises([...flipExercises, ...sentenceExercises])
    setMode('practice')
    setPracticeLoading(false)
  }

  function backToHome() {
    setMode('home')
    setExercises([])
    setCompleted(false)
    setCurrentIndex(0)
    loadLearned()
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

  if (mode === 'home') return (
    <HomeView
      allLearned={allLearned}
      search={search}
      setSearch={setSearch}
      onStart={startPractice}
      practiceLoading={practiceLoading}
    />
  )

  if (practiceLoading) return <ReviewSkeleton />

  if (completed) return (
    <CompletedView
      flipCount={flipCount}
      score={score}
      onRestart={startPractice}
      onHome={backToHome}
    />
  )

  const ex = exercises[currentIndex]
  if (!ex) return null
  const isFlipPhase = currentIndex < flipCount
  const phaseIndex = isFlipPhase ? currentIndex : currentIndex - flipCount
  const phaseTotal = isFlipPhase ? flipCount : exercises.length - flipCount

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={backToHome}
          className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors shrink-0"
          aria-label="Çık"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <SessionProgress
            current={phaseIndex}
            total={phaseTotal}
            phase={isFlipPhase ? 'review' : 'sentences'}
          />
        </div>
      </div>
      {ex.type === 'flip' && (
        <ReviewCard key={ex.userWord.id} userWord={ex.userWord} onResult={handleFlipResult} />
      )}
      {ex.type === 'sentence' && (
        <SentenceCard
          key={`s-${ex.word.id}`}
          word={ex.word}
          options={ex.options}
          sentence={ex.sentence}
          translation={ex.translation}
          onResult={handleSentenceResult}
        />
      )}
    </div>
  )
}

function HomeView({
  allLearned,
  search,
  setSearch,
  onStart,
  practiceLoading,
}: {
  allLearned: UserWord[]
  search: string
  setSearch: (s: string) => void
  onStart: () => void
  practiceLoading: boolean
}) {
  if (allLearned.length === 0) {
    return (
      <div className="space-y-4 py-8">
        <div className="bg-white rounded-3xl shadow-[0_4px_32px_rgba(0,0,0,0.06)] p-8 text-center">
          <div className="text-5xl mb-4">📚</div>
          <h2 className="text-xl font-bold text-slate-800">Henüz öğrenilen kelime yok</h2>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            Önce yeni kelime öğren, sonra burada<br />tekrar edip pekiştirebilirsin
          </p>
        </div>
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

  const q = search.trim().toLowerCase()
  const filtered = q
    ? allLearned.filter(uw =>
        uw.word?.english?.toLowerCase().includes(q) ||
        uw.word?.turkish?.toLowerCase().includes(q),
      )
    : allLearned

  const masteredCount  = allLearned.filter(uw => uw.status === 'mastered').length
  const reviewCount    = allLearned.filter(uw => uw.status === 'review').length
  const learningCount  = allLearned.filter(uw => uw.status === 'learning').length

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="relative rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #6d28d9 0%, #6366f1 50%, #2563eb 100%)' }}>
        <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.5) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(196,181,253,0.6) 0%, transparent 50%)' }} />
        <div className="relative p-6 text-white">
          <div className="flex items-center gap-1.5 text-purple-200 text-[11px] font-bold uppercase tracking-[0.18em] mb-2">
            <Sparkles size={12} />
            Tekrar
          </div>
          <h1 className="text-[28px] font-black leading-tight">Öğrendiklerini<br />pekiştir</h1>
          <p className="text-purple-100 text-sm mt-2.5 leading-relaxed max-w-[280px]">
            <span className="font-bold text-white">{allLearned.length}</span> kelime öğrendin · cümleler içinde tekrar et, kalıcı olsun
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <StatChip label="Öğreniyor" value={learningCount} />
            <StatChip label="Tekrarda"  value={reviewCount} />
            <StatChip label="Ezbere"    value={masteredCount} />
          </div>
        </div>
      </div>

      {/* Practice CTA */}
      <button
        onClick={onStart}
        disabled={practiceLoading}
        className="group w-full flex items-center justify-between gap-4 p-5 rounded-3xl text-white font-bold text-left shadow-[0_8px_24px_rgba(99,102,241,0.32)] hover:shadow-[0_10px_28px_rgba(99,102,241,0.42)] active:scale-[0.99] transition-all disabled:opacity-70 disabled:cursor-wait"
        style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/20">
            <RotateCcw size={20} className={practiceLoading ? 'animate-spin' : ''} />
          </div>
          <div className="min-w-0">
            <p className="text-base leading-tight">Pratik Turuna Başla</p>
            <p className="text-indigo-200 text-[11px] font-medium mt-1">
              {Math.min(PRACTICE_SIZE, allLearned.length)} kelime · kart + cümle pekiştirme
            </p>
          </div>
        </div>
        <ArrowRight size={20} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
      </button>

      {/* Word list */}
      <div className="bg-white rounded-3xl shadow-[0_2px_16px_rgba(0,0,0,0.04)] border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-bold text-slate-800">Öğrendiğim Kelimeler</h2>
            <span className="text-xs font-bold text-slate-400 tabular-nums">{filtered.length}/{allLearned.length}</span>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="İngilizce veya Türkçe ara..."
              className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-100 text-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-300 focus:bg-white focus:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] transition-all"
            />
          </div>
        </div>

        <div className="max-h-[460px] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-10">
              <span className="block text-2xl mb-2">🔍</span>
              <span className="text-slate-700 font-semibold">{search}</span> eşleşmedi
            </p>
          ) : (
            filtered.map(uw => {
              const w = uw.word
              if (!w) return null
              const statusInfo = STATUS_INFO[(uw.status === 'new' ? 'learning' : uw.status) as Exclude<WordStatus, 'new'>]
              return (
                <div
                  key={uw.id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 truncate">{w.english}</p>
                    <p className="text-slate-500 text-sm truncate">{w.turkish}</p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full whitespace-nowrap ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white/12 backdrop-blur-sm rounded-2xl px-3 py-2.5 border border-white/15">
      <p className="text-[22px] font-black leading-none tabular-nums">{value}</p>
      <p className="text-purple-200 text-[10px] mt-1.5 font-semibold tracking-wide">{label}</p>
    </div>
  )
}

function CompletedView({
  flipCount,
  score,
  onRestart,
  onHome,
}: {
  flipCount: number
  score: { correct: number; total: number }
  onRestart: () => void
  onHome: () => void
}) {
  const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0
  const emoji = pct >= 80 ? '🏆' : pct >= 50 ? '⭐' : '💪'
  return (
    <div className="text-center space-y-6 py-10">
      <div className="text-6xl">{emoji}</div>
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Pratik Tamamlandı</h2>
        <p className="text-slate-500 text-sm mt-1">{flipCount} kelime · cümle pekiştirme</p>
      </div>
      {score.total > 0 && (
        <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-5">
          <div className="text-4xl font-black text-indigo-600 tabular-nums">{pct}%</div>
          <p className="text-slate-500 text-sm mt-1 tabular-nums">Cümle başarısı · {score.correct}/{score.total} doğru</p>
        </div>
      )}
      <div className="flex flex-col gap-3">
        <button
          onClick={onRestart}
          className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl text-white font-bold shadow-[0_4px_14px_rgba(99,102,241,0.35)] hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}
        >
          <RotateCcw size={16} />
          Yeniden Pratik
        </button>
        <button onClick={onHome} className={cn(buttonVariants({ variant: 'outline' }), 'justify-center')}>
          Tekrar Ana Sayfasına Dön
        </button>
      </div>
    </div>
  )
}
