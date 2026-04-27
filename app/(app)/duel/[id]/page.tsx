'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Swords, Trophy, Clock } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import type { Word } from '@/lib/types'

interface Room {
  id: string
  challenger_id: string
  opponent_id: string
  status: string
  challenger_score: number
  opponent_score: number
  current_word_id: number
  rounds_total: number
}

interface Answer {
  user_id: string
  correct: boolean
}

export default function DuelRoomPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [room, setRoom] = useState<Room | null>(null)
  const [word, setWord] = useState<Word | null>(null)
  const [options, setOptions] = useState<string[]>([])
  const [myId, setMyId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [myAnswered, setMyAnswered] = useState(false)
  const [opponentAnswered, setOpponentAnswered] = useState(false)
  const [roundAnswers, setRoundAnswers] = useState<Answer[]>([])
  const [roundResult, setRoundResult] = useState<'win' | 'lose' | 'draw' | null>(null)
  const [loading, setLoading] = useState(true)
  const [waitingForOpponent, setWaitingForOpponent] = useState(false)
  const [countdown, setCountdown] = useState(15)

  const loadWordAndOptions = useCallback(async (wordId: number) => {
    const supabase = createClient()
    const { data: w } = await supabase.from('words').select('*').eq('id', wordId).single()
    if (!w) return
    setWord(w as Word)
    setSelected(null)
    setMyAnswered(false)
    setOpponentAnswered(false)
    setRoundResult(null)
    setRoundAnswers([])
    setCountdown(15)

    const { data: pool } = await supabase
      .from('words').select('turkish').eq('cefr_level', w.cefr_level).limit(50)
    const distractors = (pool ?? [])
      .map(p => p.turkish)
      .filter(t => t !== w.turkish)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
    setOptions([...distractors, w.turkish].sort(() => Math.random() - 0.5))
  }, [])

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setMyId(user.id)

      const { data: r } = await supabase
        .from('duel_rooms').select('*').eq('id', id).single()
      if (!r) { router.push('/duel'); return }

      setRoom(r as Room)
      if (r.current_word_id) await loadWordAndOptions(r.current_word_id)

      if (r.status === 'waiting' && r.opponent_id === user.id) {
        await supabase.from('duel_rooms').update({ status: 'active' }).eq('id', id)
        setRoom(prev => prev ? { ...prev, status: 'active' } : prev)
      }

      setLoading(false)

      // Realtime subscription
      const channel = supabase
        .channel(`duel_${id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'duel_rooms', filter: `id=eq.${id}` }, payload => {
          const updated = payload.new as Room
          setRoom(updated)
          if (updated.current_word_id !== r.current_word_id) {
            loadWordAndOptions(updated.current_word_id)
          }
          if (updated.status === 'completed') {
            setLoading(false)
          }
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'duel_answers', filter: `room_id=eq.${id}` }, payload => {
          const answer = payload.new as Answer & { word_id: number }
          setRoundAnswers(prev => {
            const next = [...prev, answer]
            if (answer.user_id !== user.id) setOpponentAnswered(true)
            return next
          })
        })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }
    init()
  }, [id, router, loadWordAndOptions])

  // Countdown timer
  useEffect(() => {
    if (!word || myAnswered || room?.status !== 'active') return
    if (countdown <= 0) { handleAnswer(null); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown, myAnswered, word, room?.status])

  // Check if both answered
  useEffect(() => {
    if (!myId || !room) return
    const myAnswer = roundAnswers.find(a => a.user_id === myId)
    const opAnswer = roundAnswers.find(a => a.user_id !== myId)

    if (myAnswer && opAnswer) {
      if (myAnswer.correct && !opAnswer.correct) setRoundResult('win')
      else if (!myAnswer.correct && opAnswer.correct) setRoundResult('lose')
      else setRoundResult('draw')

      // Advance round after 2s
      setTimeout(() => advanceRound(myAnswer.correct, opAnswer.correct), 2000)
    }
  }, [roundAnswers, myId, room])

  async function handleAnswer(answer: string | null) {
    if (myAnswered || !word || !myId || !room) return
    setMyAnswered(true)
    setSelected(answer)
    const correct = answer === word.turkish
    setWaitingForOpponent(true)

    const supabase = createClient()
    await supabase.from('duel_answers').insert({
      room_id: id,
      user_id: myId,
      word_id: word.id,
      answer: answer ?? '',
      correct,
    })
  }

  async function advanceRound(mCorrect: boolean, opCorrect: boolean) {
    setWaitingForOpponent(false)
    const supabase = createClient()
    const newChallengerScore = room!.challenger_id === myId
      ? room!.challenger_score + (mCorrect ? 1 : 0)
      : room!.challenger_score + (opCorrect ? 1 : 0)
    const newOpponentScore = room!.opponent_id === myId
      ? room!.opponent_score + (mCorrect ? 1 : 0)
      : room!.opponent_score + (opCorrect ? 1 : 0)

    // Get next word
    const { data: words } = await supabase.from('words').select('id').limit(100)
    const nextWord = words?.[Math.floor(Math.random() * (words?.length ?? 1))]

    const totalRoundsPlayed = roundAnswers.length > 0 ? room!.rounds_total - 1 : room!.rounds_total - 1
    const isLastRound = totalRoundsPlayed <= 0

    await supabase.from('duel_rooms').update({
      challenger_score: newChallengerScore,
      opponent_score: newOpponentScore,
      current_word_id: nextWord?.id,
      rounds_total: room!.rounds_total - 1,
      status: isLastRound ? 'completed' : 'active',
    }).eq('id', id)
  }

  if (loading) return <div className="text-center text-slate-500 py-20">Yükleniyor...</div>

  if (!room) return null

  const amChallenger = myId === room.challenger_id
  const myScore = amChallenger ? room.challenger_score : room.opponent_score
  const opScore = amChallenger ? room.opponent_score : room.challenger_score

  if (room.status === 'waiting') {
    return (
      <div className="text-center py-20 space-y-4">
        <div className="text-4xl animate-pulse">⚔️</div>
        <h2 className="text-xl font-bold text-slate-800">Rakip bekleniyor...</h2>
        <p className="text-slate-500 text-sm">Rakibin düelloyu kabul etmesi bekleniyor</p>
      </div>
    )
  }

  if (room.status === 'completed') {
    const iWon = myScore > opScore
    const isDraw = myScore === opScore
    return (
      <div className="text-center py-12 space-y-6">
        <div className="text-6xl">{isDraw ? '🤝' : iWon ? '🏆' : '😔'}</div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {isDraw ? 'Beraberlik!' : iWon ? 'Kazandın!' : 'Kaybettin!'}
          </h2>
          <p className="text-slate-500 mt-1">Düello tamamlandı</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex justify-around">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{myScore}</p>
              <p className="text-xs text-slate-500 mt-1">Sen</p>
            </div>
            <div className="text-slate-300 font-bold text-2xl self-center">—</div>
            <div className="text-center">
              <p className="text-3xl font-bold text-slate-600">{opScore}</p>
              <p className="text-xs text-slate-500 mt-1">Rakip</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => router.push('/duel')}
          className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-semibold"
        >
          Düello Sayfasına Dön
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Scoreboard */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{myScore}</p>
            <p className="text-xs text-slate-400">Sen</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Swords size={16} className="text-slate-400" />
            <p className="text-xs text-slate-500">{room.rounds_total} tur kaldı</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{opScore}</p>
            <p className="text-xs text-slate-400">Rakip</p>
          </div>
        </div>
      </div>

      {/* Round result */}
      {roundResult && (
        <div className={`rounded-2xl p-4 text-center font-bold text-lg ${
          roundResult === 'win' ? 'bg-emerald-100 text-emerald-700' :
          roundResult === 'lose' ? 'bg-red-100 text-red-700' :
          'bg-amber-100 text-amber-700'
        }`}>
          {roundResult === 'win' ? '✓ Bu turu kazandın!' : roundResult === 'lose' ? '✗ Bu turu kaybettin' : '~ Beraberlik'}
        </div>
      )}

      {/* Question */}
      {word && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-400">Türkçesi nedir?</p>
              <div className={`flex items-center gap-1 text-xs font-bold ${countdown <= 5 ? 'text-red-500' : 'text-slate-400'}`}>
                <Clock size={12} />
                {countdown}s
              </div>
            </div>
            <p className="text-4xl font-bold text-slate-900">{word.english}</p>
          </div>

          {!myAnswered ? (
            <div className="grid grid-cols-2 gap-3">
              {options.map(opt => (
                <button
                  key={opt}
                  onClick={() => handleAnswer(opt)}
                  className="py-4 px-3 rounded-xl font-medium text-sm border-2 border-slate-100 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 active:scale-95 transition-all"
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {options.map(opt => {
                  const isCorrect = opt === word.turkish
                  const isSelected = selected === opt
                  let cls = 'py-4 px-3 rounded-xl font-medium text-sm border-2 '
                  if (isCorrect) cls += 'border-emerald-400 bg-emerald-50 text-emerald-700'
                  else if (isSelected) cls += 'border-red-400 bg-red-50 text-red-700'
                  else cls += 'border-slate-100 bg-white text-slate-300'
                  return <div key={opt} className={cls}>{opt}</div>
                })}
              </div>
              {waitingForOpponent && !opponentAnswered && (
                <div className="text-center text-slate-400 text-sm py-2 animate-pulse">
                  Rakip yanıtlıyor...
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
