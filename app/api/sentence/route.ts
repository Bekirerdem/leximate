import { createClient } from '@/lib/supabase/server'
import { generateContextualSentence } from '@/lib/gemini'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { wordId } = (await request.json()) as { wordId: number }
  if (!wordId) return NextResponse.json({ error: 'wordId required' }, { status: 400 })

  // 1) Cache hit?
  const { data: cached } = await supabase
    .from('user_word_sentences')
    .select('sentence, translation')
    .eq('user_id', user.id)
    .eq('word_id', wordId)
    .maybeSingle()

  if (cached) {
    return NextResponse.json({ sentence: cached.sentence, translation: cached.translation })
  }

  // 2) Hedef kelime
  const { data: target } = await supabase
    .from('words')
    .select('english, turkish, part_of_speech')
    .eq('id', wordId)
    .single()

  if (!target) return NextResponse.json({ error: 'word not found' }, { status: 404 })

  // 3) Kullanıcının bildiği English kelimeler (henüz 'new' olmayanlar)
  const { data: knownRows } = await supabase
    .from('user_words')
    .select('words!inner(english)')
    .eq('user_id', user.id)
    .neq('status', 'new')
    .limit(500)

  const knownEnglish: string[] =
    (knownRows ?? [])
      .map(r => (r as { words: { english: string } | { english: string }[] }).words)
      .flatMap(w => (Array.isArray(w) ? w.map(x => x.english) : [w.english]))

  // 4) Üret
  const result = await generateContextualSentence(
    { english: target.english, turkish: target.turkish, part_of_speech: target.part_of_speech },
    knownEnglish
  )

  // 5) Cache yaz (ignore conflict — race olabilir)
  await supabase
    .from('user_word_sentences')
    .upsert(
      {
        user_id: user.id,
        word_id: wordId,
        sentence: result.sentence,
        translation: result.translation,
      },
      { onConflict: 'user_id,word_id', ignoreDuplicates: true }
    )

  return NextResponse.json(result)
}
