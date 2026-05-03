'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Lobby, type LobbyParticipant } from '@/components/duel/Lobby'
import { Leaderboard, type LeaderboardEntry } from '@/components/duel/Leaderboard'
import { DuelRoundCard } from '@/components/duel/DuelRoundCard'

interface Room {
  id: string
  host_id: string
  status: 'waiting' | 'active' | 'completed'
  rounds_total: number
  current_round: number
  cefr_level: string
}

interface Participant {
  id: number
  user_id: string
  username: string
  score: number
  joined: boolean
}

interface Round {
  round_no: number
  word_id: number
  english: string
  sentence: string
  translation: string
  options: string[]
}

interface AnswerRow {
  user_id: string
  round_no: number
  answer: string
  correct: boolean
}

const COUNTDOWN = 15

export default function DuelRoomPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [myId, setMyId] = useState<string | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [answers, setAnswers] = useState<AnswerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const currentRound = useMemo(
    () => rounds.find(r => r.round_no === room?.current_round) ?? null,
    [rounds, room?.current_round]
  )

  const myAnswerForRound = useMemo(
    () => answers.find(a => a.user_id === myId && a.round_no === room?.current_round) ?? null,
    [answers, myId, room?.current_round]
  )

  const joinedParticipants = useMemo(() => participants.filter(p => p.joined), [participants])

  const answersThisRound = useMemo(
    () => answers.filter(a => a.round_no === room?.current_round),
    [answers, room?.current_round]
  )

  // İlk yükleme + auto-join
  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null

    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setMyId(user.id)

      // Room
      const { data: r } = await supabase.from('duel_rooms').select('*').eq('id', id).single()
      if (!r) { toast.error('Düello bulunamadı'); router.push('/duel'); return }
      setRoom(r as Room)

      // Henüz joined değilsem otomatik join (davet linkini açtım demek)
      const { data: myPart } = await supabase
        .from('duel_participants').select('joined').eq('room_id', id).eq('user_id', user.id).maybeSingle()
      if (myPart && !myPart.joined && r.status === 'waiting') {
        await fetch(`/api/duel/${id}/join`, { method: 'POST' })
      }

      await Promise.all([loadParticipants(), loadRounds(), loadAnswers()])
      setLoading(false)

      // Realtime
      channel = supabase
        .channel(`duel_${id}`)
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'duel_rooms', filter: `id=eq.${id}` },
          payload => { setRoom(payload.new as Room); setSelected(null) }
        )
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'duel_participants', filter: `room_id=eq.${id}` },
          () => { loadParticipants() }
        )
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'duel_answers', filter: `room_id=eq.${id}` },
          payload => { setAnswers(prev => [...prev, payload.new as AnswerRow]) }
        )
        .subscribe()
    }
    init()
    return () => { if (channel) channel.unsubscribe() }
  }, [id, router])

  // Round değişince selected sıfırlansın
  useEffect(() => { setSelected(null) }, [room?.current_round])

  const loadParticipants = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('duel_participants')
      .select('id, user_id, score, joined, profiles!inner(username)')
      .eq('room_id', id)
      .order('id')
    if (!data) return
    setParticipants(
      data.map(p => {
        const profileField = (p as unknown as { profiles: { username: string } | { username: string }[] }).profiles
        const profile = Array.isArray(profileField) ? profileField[0] : profileField
        return {
          id: p.id,
          user_id: p.user_id,
          score: p.score,
          joined: p.joined,
          username: profile?.username ?? '?',
        }
      })
    )
  }, [id])

  const loadRounds = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('duel_rounds')
      .select('round_no, word_id, sentence, translation, options, words!inner(english)')
      .eq('room_id', id)
      .order('round_no')
    if (!data) return
    setRounds(
      data.map(r => {
        const wordsField = (r as unknown as { words: { english: string } | { english: string }[] }).words
        const word = Array.isArray(wordsField) ? wordsField[0] : wordsField
        return {
          round_no: r.round_no,
          word_id: r.word_id,
          english: word?.english ?? '',
          sentence: r.sentence,
          translation: r.translation,
          options: r.options,
        }
      })
    )
  }, [id])

  const loadAnswers = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('duel_answers')
      .select('user_id, round_no, answer, correct')
      .eq('room_id', id)
    setAnswers((data as AnswerRow[]) ?? [])
  }, [id])

  async function handleStart() {
    if (!room) return
    setStarting(true)
    const res = await fetch(`/api/duel/${id}/start`, { method: 'POST' })
    setStarting(false)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? 'Başlatılamadı')
    }
  }

  const handleAnswer = useCallback(async (option: string | null) => {
    if (!room || myAnswerForRound) return
    setSelected(option)
    await fetch(`/api/duel/${id}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roundNo: room.current_round, answer: option }),
    })
  }, [id, room, myAnswerForRound])

  if (loading) return <div className="text-center text-slate-500 py-20">Yükleniyor...</div>
  if (!room) return null

  // === LOBBY ===
  if (room.status === 'waiting') {
    const lobbyData: LobbyParticipant[] = participants.map(p => ({
      user_id: p.user_id,
      username: p.username,
      joined: p.joined,
      is_host: p.user_id === room.host_id,
      is_me: p.user_id === myId,
    }))
    return (
      <Lobby
        participants={lobbyData}
        rounds={room.rounds_total}
        level={room.cefr_level}
        amHost={myId === room.host_id}
        starting={starting}
        onStart={handleStart}
      />
    )
  }

  // === COMPLETED ===
  if (room.status === 'completed') {
    const entries: LeaderboardEntry[] = participants.map(p => ({
      user_id: p.user_id,
      username: p.username,
      score: p.score,
      is_me: p.user_id === myId,
    }))
    return <Leaderboard entries={entries} roundsTotal={room.rounds_total} />
  }

  // === ACTIVE ===
  if (!currentRound) {
    return <div className="text-center text-slate-500 py-20">Tur yükleniyor...</div>
  }

  return (
    <div className="space-y-4">
      {/* Mini scoreboard + tur indikatörü */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-slate-400 font-semibold">
            Tur {room.current_round}/{room.rounds_total}
          </p>
          <p className="text-xs text-slate-400">{room.cefr_level}</p>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${joinedParticipants.length}, 1fr)` }}>
          {joinedParticipants.map(p => {
            const isMe = p.user_id === myId
            return (
              <div key={p.user_id} className={`text-center rounded-xl py-2 ${isMe ? 'bg-white/10' : ''}`}>
                <p className="text-xl font-bold text-white">{p.score}</p>
                <p className="text-[10px] text-slate-400 truncate">{isMe ? 'Sen' : p.username}</p>
              </div>
            )
          })}
        </div>
      </div>

      <DuelRoundCard
        key={room.current_round}
        sentence={currentRound.sentence}
        translation={currentRound.translation}
        options={currentRound.options}
        correctAnswer={currentRound.english}
        countdownSeconds={COUNTDOWN}
        myAnswered={!!myAnswerForRound}
        selected={selected ?? myAnswerForRound?.answer ?? null}
        participantsAnswered={answersThisRound.length}
        participantsTotal={joinedParticipants.length}
        onAnswer={handleAnswer}
      />
    </div>
  )
}
