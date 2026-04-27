'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ReviewCard } from '@/components/review/ReviewCard'
import { SessionProgress } from '@/components/learn/SessionProgress'
import { ReviewSkeleton } from '@/components/ui/skeleton'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { UserWord } from '@/lib/types'
import Link from 'next/link'
import { Clock, BookOpen } from 'lucide-react'

export default function ReviewPage() {
  const [cards, setCards] = useState<UserWord[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tomorrowCount, setTomorrowCount] = useState(0)
  const total = cards.length

  useEffect(() => { loadDueCards() }, [])

  async function loadDueCards() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const today = new Date().toISOString().split('T')[0]
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    const [{ data }, { count }] = await Promise.all([
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
    ])

    setCards((data as UserWord[]) ?? [])
    setTomorrowCount(count ?? 0)
    setLoading(false)
  }

  async function handleResult(quality: number) {
    const card = cards[currentIndex]
    await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId: card.word_id, correct: quality >= 3 }),
    })
    if (currentIndex + 1 >= cards.length) {
      setCompleted(true)
    } else {
      setCurrentIndex(i => i + 1)
    }
  }

  if (loading) return <ReviewSkeleton />

  if (cards.length === 0) {
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
    return (
      <div className="text-center space-y-6 py-12">
        <div className="text-6xl">🏆</div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{total} kart tamamlandı</h2>
          <p className="text-slate-500 mt-1">Harika iş, hafızan güçleniyor!</p>
        </div>
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

  return (
    <div className="space-y-6">
      <SessionProgress current={currentIndex} total={total} phase="review" />
      <ReviewCard key={cards[currentIndex].id} userWord={cards[currentIndex]} onResult={handleResult} />
    </div>
  )
}
