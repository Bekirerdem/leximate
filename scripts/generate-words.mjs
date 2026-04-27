import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const LEVELS = ['A0', 'A1', 'A2', 'B1', 'B2']
const COUNT_PER_LEVEL = 150

async function generateWordsForLevel(level) {
  const prompt = `Generate exactly ${COUNT_PER_LEVEL} unique English vocabulary words appropriate for ${level} CEFR level learners.

For each word provide:
- english: the English word or short phrase
- turkish: accurate Turkish translation
- part_of_speech: one of: noun, verb, adjective, adverb, phrase
- example_sentence: one natural example sentence (max 12 words, appropriate for ${level} level)

Return ONLY a valid JSON array, no markdown, no explanation:
[{"english":"...","turkish":"...","part_of_speech":"...","example_sentence":"..."},...]

Rules:
- No duplicates
- No proper nouns
- Appropriate difficulty for ${level}
- Turkish translations must be accurate
- Example sentences must be simple and natural`

  const result = await model.generateContent(prompt)
  const text = result.response.text().trim()

  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const words = JSON.parse(cleaned)
    return words.map(w => ({ ...w, cefr_level: level }))
  } catch (e) {
    console.error(`Parse error for ${level}:`, e.message)
    console.error('Raw response:', text.substring(0, 200))
    return []
  }
}

async function getExistingWords() {
  const { data } = await supabase.from('words').select('english, cefr_level')
  const set = new Set()
  for (const w of data ?? []) set.add(`${w.english.toLowerCase()}|${w.cefr_level}`)
  return set
}

async function main() {
  console.log('Mevcut kelimeler alınıyor...')
  const existing = await getExistingWords()
  console.log(`Mevcut: ${existing.size} kelime`)

  for (const level of LEVELS) {
    console.log(`\n${level} için kelimeler üretiliyor...`)

    const words = await generateWordsForLevel(level)
    console.log(`${words.length} kelime üretildi`)

    const newWords = words.filter(w => {
      const key = `${w.english.toLowerCase()}|${w.cefr_level}`
      return !existing.has(key) && w.english && w.turkish && w.part_of_speech && w.example_sentence
    })

    console.log(`${newWords.length} yeni kelime eklenecek`)

    if (newWords.length === 0) continue

    const validPos = ['noun', 'verb', 'adjective', 'adverb', 'phrase']
    const clean = newWords.filter(w => validPos.includes(w.part_of_speech))

    const { error } = await supabase.from('words').insert(clean)
    if (error) {
      console.error(`Insert hatası (${level}):`, error.message)
    } else {
      console.log(`✓ ${clean.length} kelime eklendi (${level})`)
      clean.forEach(w => existing.add(`${w.english.toLowerCase()}|${w.cefr_level}`))
    }

    // Rate limit için bekle
    await new Promise(r => setTimeout(r, 3000))
  }

  const { count } = await supabase.from('words').select('*', { count: 'exact', head: true })
  console.log(`\nToplam kelime sayısı: ${count}`)
}

main().catch(console.error)
