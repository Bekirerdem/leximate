import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview' })

export async function generateExampleSentence(word: string, level: string): Promise<string> {
  const prompt = `Generate one simple English example sentence using the word "${word}" appropriate for ${level} CEFR level learners.
Return ONLY the sentence, nothing else. Keep it short (max 10 words) and natural.`

  const result = await model.generateContent(prompt)
  return result.response.text().trim().replace(/^["']|["']$/g, '')
}

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
