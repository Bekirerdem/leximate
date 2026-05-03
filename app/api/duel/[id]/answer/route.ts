import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { roundNo, answer } = (await req.json()) as { roundNo: number; answer: string | null }
  if (!roundNo) return NextResponse.json({ error: 'roundNo required' }, { status: 400 })

  // Round'un doğru cevabı
  const { data: round } = await supabase
    .from('duel_rounds')
    .select('word_id, words!inner(english)')
    .eq('room_id', id)
    .eq('round_no', roundNo)
    .single()
  if (!round) return NextResponse.json({ error: 'round yok' }, { status: 404 })

  const wordsField = round.words as { english: string } | { english: string }[]
  const correctAnswer = Array.isArray(wordsField) ? wordsField[0].english : wordsField.english
  const isCorrect = !!answer && answer.toLowerCase() === correctAnswer.toLowerCase()

  // Cevap insert (unique constraint duplicate'ı önler)
  const { error: insErr } = await supabase.from('duel_answers').insert({
    room_id: id,
    round_no: roundNo,
    user_id: user.id,
    answer: answer ?? '',
    correct: isCorrect,
  })
  if (insErr && insErr.code !== '23505') {
    // 23505 = unique violation (zaten cevap verdi); diğer hatalar dön
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  // Doğruysa skor +1
  if (isCorrect && !insErr) {
    const { data: cur } = await supabase
      .from('duel_participants').select('score').eq('room_id', id).eq('user_id', user.id).single()
    await supabase
      .from('duel_participants').update({ score: (cur?.score ?? 0) + 1 })
      .eq('room_id', id).eq('user_id', user.id)
  }

  // Tüm joined participants cevap verdi mi? Verdiyse advance
  const { data: room } = await supabase
    .from('duel_rooms').select('current_round, rounds_total, status').eq('id', id).single()
  if (!room || room.current_round !== roundNo || room.status !== 'active') {
    return NextResponse.json({ ok: true, correct: isCorrect })
  }

  const { count: joinedCount } = await supabase
    .from('duel_participants').select('*', { count: 'exact', head: true })
    .eq('room_id', id).eq('joined', true)
  const { count: answerCount } = await supabase
    .from('duel_answers').select('*', { count: 'exact', head: true })
    .eq('room_id', id).eq('round_no', roundNo)

  if ((answerCount ?? 0) >= (joinedCount ?? 0)) {
    const isLast = roundNo >= room.rounds_total
    await supabase.from('duel_rooms').update(
      isLast ? { status: 'completed' } : { current_round: roundNo + 1 }
    ).eq('id', id)
  }

  return NextResponse.json({ ok: true, correct: isCorrect })
}
