'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ReviewCard } from '@/components/review/ReviewCard'
import { SessionProgress } from '@/components/learn/SessionProgress'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { UserWord } from '@/lib/types'
import Link from 'next/link'

export default function ReviewPage() {
  const [cards, setCards] = useState<UserWord[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const total = cards.length

  useEffect(() => {
    loadDueCards()
  }, [])

  async function loadDueCards() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const today = new Date().toISOString().split('T')[0]

    const { data } = await supabase
      .from('user_words')
      .select('*, word:words(*)')
      .eq('user_id', user.id)
      .lte('next_review_date', today)
      .neq('status', 'new')
      .order('next_review_date', { ascending: true })
      .limit(20)

    setCards(data as UserWord[] ?? [])
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

  if (loading) return <div className="text-center text-slate-500 py-20">Yükleniyor...</div>

  if (cards.length === 0) {
    return (
      <div className="text-center space-y-4 py-20">
        <div className="text-4xl">✅</div>
        <p className="text-slate-600 font-medium">Bugün tekrar edilecek kart yok!</p>
        <Link href="/learn" className={cn(buttonVariants({ variant: 'outline' }))}>
          Yeni Kelime Öğren
        </Link>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="text-center space-y-6 py-20">
        <div className="text-5xl">🏆</div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{total} kartı tamamladın</h2>
          <p className="text-slate-500 mt-1">Harika iş!</p>
        </div>
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
