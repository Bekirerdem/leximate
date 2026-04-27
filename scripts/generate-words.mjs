import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Her seviye için hedef kelime sayısı
const TARGETS = {
  A0: 150,
  A1: 400,
  A2: 500,
  B1: 600,
  B2: 700,
  C1: 300,
  C2: 200,
}

const BATCH_SIZE = 150

const LEVEL_DESCRIPTIONS = {
  A0: 'absolute beginner (first 150 most essential words: greetings, numbers, colors, family, simple objects)',
  A1: 'beginner (everyday objects, basic actions, family, food, weather, time, simple descriptions)',
  A2: 'elementary (daily routines, shopping, travel basics, emotions, work, health, hobbies)',
  B1: 'intermediate (opinions, abstract concepts, current events, culture, environment, technology basics)',
  B2: 'upper-intermediate (nuanced vocabulary, idioms, academic topics, business, complex emotions, literature)',
  C1: 'advanced (sophisticated concepts, academic/professional vocabulary, nuanced meanings, formal register)',
  C2: 'proficient (rare/specialized vocabulary, literary terms, formal academic/professional language)',
}

async function generateBatch(level, batchNum, existingEnglish) {
  const existing = Array.from(existingEnglish).slice(0, 100).join(', ')
  const prompt = `Generate exactly ${BATCH_SIZE} unique English vocabulary words for ${level} CEFR level (${LEVEL_DESCRIPTIONS[level]}).

IMPORTANT: Do NOT include any of these already-used words: ${existing || 'none yet'}

For each word provide:
- english: the English word (single word or very common 2-word phrase)
- turkish: accurate Turkish translation
- part_of_speech: one of: noun, verb, adjective, adverb, phrase
- example_sentence: one natural example sentence (8-14 words, appropriate for ${level} level)

Return ONLY a valid JSON array, no markdown, no explanation:
[{"english":"...","turkish":"...","part_of_speech":"...","example_sentence":"..."},...]

Rules:
- Exactly ${BATCH_SIZE} items
- No duplicates within this batch
- No proper nouns, no brand names
- Turkish must be accurate and natural
- Example sentences must feel native, not robotic
- Spread across different topics and parts of speech`

  const result = await model.generateContent(prompt)
  const text = result.response.text().trim()

  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const words = JSON.parse(cleaned)
    return words.map(w => ({ ...w, cefr_level: level }))
  } catch (e) {
    console.error(`  Parse hatası (batch ${batchNum}):`, e.message)
    return []
  }
}

async function getExistingWords() {
  const { data } = await supabase.from('words').select('english, cefr_level')
  const byLevel = {}
  const global = new Set()
  for (const w of data ?? []) {
    const key = w.english.toLowerCase()
    global.add(key)
    if (!byLevel[w.cefr_level]) byLevel[w.cefr_level] = new Set()
    byLevel[w.cefr_level].add(key)
  }
  return { global, byLevel }
}

async function getCurrentCounts() {
  const levels = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const counts = {}
  await Promise.all(levels.map(async (level) => {
    const { count } = await supabase
      .from('words')
      .select('*', { count: 'exact', head: true })
      .eq('cefr_level', level)
    counts[level] = count ?? 0
  }))
  return counts
}

async function main() {
  console.log('Mevcut kelimeler alınıyor...')
  const { global: globalSet, byLevel } = await getExistingWords()
  const counts = await getCurrentCounts()

  console.log('\nMevcut durum:')
  for (const [level, target] of Object.entries(TARGETS)) {
    const have = counts[level] ?? 0
    const need = Math.max(0, target - have)
    console.log(`  ${level}: ${have}/${target} (${need} kelime gerekli)`)
  }

  const validPos = ['noun', 'verb', 'adjective', 'adverb', 'phrase']

  for (const [level, target] of Object.entries(TARGETS)) {
    const current = counts[level] ?? 0
    if (current >= target) {
      console.log(`\n✓ ${level} zaten tamamlandı (${current}/${target})`)
      continue
    }

    const needed = target - current
    const batches = Math.ceil(needed / BATCH_SIZE)
    console.log(`\n${level}: ${needed} kelime gerekli, ${batches} batch çalışacak...`)

    const levelExisting = byLevel[level] ?? new Set()

    for (let b = 0; b < batches; b++) {
      const currentCount = (await getCurrentCounts())[level] ?? 0
      if (currentCount >= target) break

      console.log(`  Batch ${b + 1}/${batches} üretiliyor...`)
      const words = await generateBatch(level, b + 1, levelExisting)

      const newWords = words.filter(w => {
        const key = w.english?.toLowerCase()
        return (
          key &&
          w.turkish &&
          w.part_of_speech &&
          w.example_sentence &&
          !globalSet.has(key) &&
          validPos.includes(w.part_of_speech)
        )
      })

      if (newWords.length === 0) {
        console.log('  Batch boş, atlanıyor')
        continue
      }

      const { error } = await supabase.from('words').insert(newWords)
      if (error) {
        console.error(`  Insert hatası:`, error.message)
      } else {
        console.log(`  ✓ ${newWords.length} kelime eklendi`)
        newWords.forEach(w => {
          globalSet.add(w.english.toLowerCase())
          levelExisting.add(w.english.toLowerCase())
        })
      }

      // Rate limit
      if (b < batches - 1) await new Promise(r => setTimeout(r, 4000))
    }
  }

  const finalCounts = await getCurrentCounts()
  console.log('\n=== SONUÇ ===')
  let total = 0
  for (const [level, target] of Object.entries(TARGETS)) {
    const have = finalCounts[level] ?? 0
    total += have
    console.log(`  ${level}: ${have}/${target} ${have >= target ? '✓' : `(${target - have} eksik)`}`)
  }
  console.log(`  TOPLAM: ${total} kelime`)
}

main().catch(console.error)
