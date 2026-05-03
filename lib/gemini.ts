import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview' })

export async function evaluatePronunciation(
  word: string,
  transcript: string
): Promise<{ score: number; feedback: string }> {
  const prompt = `A language learner tried to pronounce the English word "${word}".
The speech recognition captured: "${transcript}"

Rate the pronunciation accuracy from 0 to 100 and give brief Turkish feedback (1 sentence).
Respond in JSON format only: {"score": number, "feedback": "Turkish feedback here"}`

  const result = await model.generateContent(prompt)
  const text = result.response.text().trim()
  try {
    const json = text.replace(/```json\n?|\n?```/g, '')
    return JSON.parse(json)
  } catch {
    return { score: 50, feedback: 'Tekrar deneyin.' }
  }
}

// İngilizcede sayılmayan ama herkes için "ücretsiz" olan function words
// Bu liste user'ın bildiği kelimelere her zaman eklenir
const FREE_FUNCTION_WORDS = [
  'a','an','the','this','that','these','those',
  'i','you','he','she','it','we','they','me','him','her','us','them',
  'my','your','his','her','its','our','their',
  'is','am','are','was','were','be','been','being',
  'do','does','did','have','has','had','will','would','can','could','should','may','might','must',
  'and','or','but','so','because','if','when','then','than','as','of',
  'in','on','at','to','from','for','with','by','about','into','out','up','down','over','under',
  'not','no','yes','very','too','also','only','just','more','most','some','any','all','one','two',
  'what','who','where','why','how','which',
  'good','bad','new','old','big','small',
]

export interface ContextSentence {
  sentence: string
  translation: string
}

/**
 * Hedef kelimeyi, kullanıcının bildiği kelime havuzundan basit bir cümle içinde kullanır.
 * Cümlenin Türkçe çevirisini de döndürür.
 */
export async function generateContextualSentence(
  target: { english: string; turkish: string; part_of_speech: string },
  knownEnglishWords: string[]
): Promise<ContextSentence> {
  const vocab = Array.from(
    new Set([
      ...knownEnglishWords.map(w => w.toLowerCase()),
      ...FREE_FUNCTION_WORDS,
      target.english.toLowerCase(),
    ])
  )

  const vocabList = vocab.slice(0, 400).join(', ')

  const prompt = `You are creating a vocabulary practice sentence for a Turkish speaker learning English.

TARGET WORD: "${target.english}" (${target.part_of_speech}, Turkish: "${target.turkish}")

ALLOWED VOCABULARY (use ONLY these English words, no others):
${vocabList}

RULES:
1. Write ONE natural English sentence between 6 and 12 words.
2. The sentence MUST contain the target word "${target.english}" exactly once.
3. Use ONLY words from the ALLOWED VOCABULARY list. Do not introduce any new word.
4. Conjugations and plurals of allowed words ARE allowed (e.g. allowed "go" → "goes/went/going" OK).
5. The sentence must be grammatically correct and feel natural, not robotic.
6. Provide an accurate, natural Turkish translation.

Return ONLY valid JSON, no markdown:
{"sentence": "...", "translation": "..."}`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const json = text.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(json) as ContextSentence

    if (
      typeof parsed.sentence === 'string' &&
      typeof parsed.translation === 'string' &&
      parsed.sentence.toLowerCase().includes(target.english.toLowerCase())
    ) {
      return parsed
    }
    throw new Error('invalid response shape')
  } catch {
    // Fallback: basit, garantili cümle
    return {
      sentence: `I know the word "${target.english}".`,
      translation: `"${target.turkish}" kelimesini biliyorum.`,
    }
  }
}
