import { createClient } from '@/lib/supabase/server'
import { calculateNextReview } from '@/lib/srs/sm2'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { wordId, correct } = await request.json()

  const { data: existing } = await supabase
    .from('user_words')
    .select('*')
    .eq('user_id', user.id)
    .eq('word_id', wordId)
    .single()

  const quality = correct ? 4 : 1

  if (!existing) {
    const result = calculateNextReview({ ease_factor: 2.5, interval_days: 1, correct_count: 0, quality })
    await supabase.from('user_words').insert({
      user_id: user.id,
      word_id: wordId,
      status: result.status,
      ease_factor: result.ease_factor,
      interval_days: result.interval_days,
      next_review_date: result.next_review_date,
      correct_count: correct ? 1 : 0,
      incorrect_count: correct ? 0 : 1,
      last_reviewed_at: new Date().toISOString(),
    })
  } else {
    const result = calculateNextReview({
      ease_factor: existing.ease_factor,
      interval_days: existing.interval_days,
      correct_count: existing.correct_count,
      quality,
    })
    await supabase.from('user_words').update({
      status: result.status,
      ease_factor: result.ease_factor,
      interval_days: result.interval_days,
      next_review_date: result.next_review_date,
      correct_count: existing.correct_count + (correct ? 1 : 0),
      incorrect_count: existing.incorrect_count + (correct ? 0 : 1),
      last_reviewed_at: new Date().toISOString(),
    }).eq('id', existing.id)
  }

  // Günlük session güncelle ve streak kontrol et
  const today = new Date().toISOString().split('T')[0]
  const { data: dailySession } = await supabase
    .from('daily_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('session_date', today)
    .single()

  if (dailySession) {
    const newWordsLearned = dailySession.words_learned + (!existing ? 1 : 0)
    const newWordsReviewed = dailySession.words_reviewed + (existing ? 1 : 0)
    const completed = newWordsLearned >= 10

    await supabase
      .from('daily_sessions')
      .update({ words_learned: newWordsLearned, words_reviewed: newWordsReviewed, completed })
      .eq('id', dailySession.id)

    if (completed && !dailySession.completed) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('streak_count, streak_last_date')
        .eq('id', user.id)
        .single()

      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      const newStreak = profile?.streak_last_date === yesterdayStr
        ? (profile.streak_count ?? 0) + 1
        : 1

      await supabase
        .from('profiles')
        .update({ streak_count: newStreak, streak_last_date: today })
        .eq('id', user.id)
    }
  } else {
    await supabase.from('daily_sessions').insert({
      user_id: user.id,
      session_date: today,
      words_learned: !existing ? 1 : 0,
      words_reviewed: existing ? 1 : 0,
      completed: false,
    })
  }

  return NextResponse.json({ success: true })
}
