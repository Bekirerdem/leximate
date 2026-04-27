import { evaluatePronunciation } from '@/lib/gemini'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { word, transcript } = await request.json()
  if (!word || !transcript) {
    return NextResponse.json({ score: 0, feedback: 'Geçersiz istek.' }, { status: 400 })
  }
  const result = await evaluatePronunciation(word, transcript)
  return NextResponse.json(result)
}
