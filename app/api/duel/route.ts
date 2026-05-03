import { createClient } from '@/lib/supabase/server'
import { generateContextualSentence } from '@/lib/gemini'
import { NextResponse } from 'next/server'

const LEVEL_ORDER = ['A0','A1','A2','B1','B2','C1','C2']
const MAX_PARTICIPANTS = 3   // host + 3 davetli = 4 kişi
const DEFAULT_ROUNDS = 7
const MIN_ROUNDS = 3
const MAX_ROUNDS = 15

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as { participantIds?: string[]; rounds?: number }
  const participantIds = (body.participantIds ?? []).filter(id => id !== user.id)

  if (participantIds.length < 1 || participantIds.length > MAX_PARTICIPANTS) {
    return NextResponse.json({ error: `1-${MAX_PARTICIPANTS} katılımcı seçmelisin` }, { status: 400 })
  }
  const roundsTotal = Math.max(MIN_ROUNDS, Math.min(MAX_ROUNDS, body.rounds ?? DEFAULT_ROUNDS))

  // Tüm katılımcıların seviyesi → en düşüğünü baz al
  const allIds = [user.id, ...participantIds]
  const { data: profiles } = await supabase
    .from('profiles').select('id, cefr_level').in('id', allIds)

  if (!profiles || profiles.length !== allIds.length) {
    return NextResponse.json({ error: 'katılımcılardan biri bulunamadı' }, { status: 400 })
  }
  const minIdx = Math.min(...profiles.map(p => LEVEL_ORDER.indexOf(p.cefr_level)))
  const sharedLevel = LEVEL_ORDER[minIdx]

  // O seviyenin tüm kelime havuzu (vocab list + distractor pool)
  const { data: levelWords } = await supabase
    .from('words').select('id, english, turkish, part_of_speech').eq('cefr_level', sharedLevel)

  if (!levelWords || levelWords.length < roundsTotal + 3) {
    return NextResponse.json({ error: 'bu seviyede yeterli kelime yok' }, { status: 400 })
  }
  const allEnglish = levelWords.map(w => w.english)

  // N kelime random seç (distinct)
  const shuffled = [...levelWords].sort(() => Math.random() - 0.5)
  const targets = shuffled.slice(0, roundsTotal)

  // Her kelime için Gemini cümle prefetch (paralel)
  const sentences = await Promise.all(
    targets.map(w =>
      generateContextualSentence(
        { english: w.english, turkish: w.turkish, part_of_speech: w.part_of_speech },
        allEnglish
      )
    )
  )

  // Her round için 4 seçenek (1 doğru + 3 distractor) hazırla
  const roundData = targets.map((w, i) => {
    const distractors = shuffled
      .filter(x => x.id !== w.id)
      .slice(0, 3)
      .map(x => x.english)
    const options = [...distractors, w.english].sort(() => Math.random() - 0.5)
    return {
      round_no: i + 1,
      word_id: w.id,
      sentence: sentences[i].sentence,
      translation: sentences[i].translation,
      options,
    }
  })

  // 1) Oda
  const { data: room, error: roomErr } = await supabase
    .from('duel_rooms')
    .insert({
      host_id: user.id,
      cefr_level: sharedLevel,
      rounds_total: roundsTotal,
      status: 'waiting',
      current_round: 0,
    })
    .select().single()

  if (roomErr || !room) {
    return NextResponse.json({ error: roomErr?.message ?? 'oda yaratılamadı' }, { status: 500 })
  }

  // 2) Participants (host = joined:true, davetliler = joined:false)
  const participantRows = [
    { room_id: room.id, user_id: user.id, joined: true, score: 0 },
    ...participantIds.map(pid => ({ room_id: room.id, user_id: pid, joined: false, score: 0 })),
  ]
  const { error: pErr } = await supabase.from('duel_participants').insert(participantRows)
  if (pErr) {
    await supabase.from('duel_rooms').delete().eq('id', room.id)
    return NextResponse.json({ error: pErr.message }, { status: 500 })
  }

  // 3) Rounds
  const roundRows = roundData.map(r => ({ ...r, room_id: room.id }))
  const { error: rErr } = await supabase.from('duel_rounds').insert(roundRows)
  if (rErr) {
    await supabase.from('duel_rooms').delete().eq('id', room.id)
    return NextResponse.json({ error: rErr.message }, { status: 500 })
  }

  return NextResponse.json({ id: room.id })
}
