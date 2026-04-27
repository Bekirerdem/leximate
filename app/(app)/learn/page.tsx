'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WordCard } from '@/components/learn/WordCard'
import { SessionProgress } from '@/components/learn/SessionProgress'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Word } from '@/lib/types'
import Link from 'next/link'

const DAILY_WORD_COUNT = 10

export default function LearnPage() {
  const [words, setWords] = useState<Word[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTodaysWords()
  }, [])

  async function loadTodaysWords() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('cefr_level')
      .eq('id', user.id)
      .single()

    const { data: seenWordIds } = await supabase
      .from('user_words')
      .select('word_id')
      .eq('user_id', user.id)

    const excludeIds = seenWordIds?.map(r => r.word_id) ?? []

    let query = supabase
      .from('words')
      .select('*')
      .eq('cefr_level', profile?.cefr_level ?? 'A1')
      .limit(DAILY_WORD_COUNT)

    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`)
    }

    const { data: newWords } = await query
    setWords(newWords ?? [])
    setLoading(false)
  }

  async function handleResult(correct: boolean) {
    const word = words[currentIndex]

    await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId: word.id, correct }),
    })

    if (currentIndex + 1 >= words.length) {
      setCompleted(true)
    } else {
      setCurrentIndex(i => i + 1)
    }
  }

  if (loading) {
    return <div className="text-center text-slate-500 py-20">Yükleniyor...</div>
  }

  if (words.length === 0) {
    return (
      <div className="text-center space-y-4 py-20">
        <p className="text-slate-600">Bu seviyede yeni kelime kalmadı 🎉</p>
        <Link href="/review" className={cn(buttonVariants({ variant: 'outline' }))}>
          Tekrar Yapmaya Git
        </Link>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="text-center space-y-6 py-20">
        <div className="text-5xl">🎉</div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Harika!</h2>
          <p className="text-slate-500 mt-1">Bugünkü kelime turunu tamamladın</p>
        </div>
        <div className="flex flex-col gap-3">
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

  return (
    <div className="space-y-6">
      <SessionProgress current={currentIndex} total={words.length} phase="words" />
      <WordCard key={words[currentIndex].id} word={words[currentIndex]} onResult={handleResult} />
    </div>
  )
}
