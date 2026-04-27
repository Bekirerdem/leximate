import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get('text')
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_TTS_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: 'en-US', name: 'en-US-Neural2-D' },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 0.85 },
      }),
    }
  )

  if (!res.ok) {
    return NextResponse.json({ error: 'TTS failed' }, { status: 500 })
  }

  const { audioContent } = await res.json()
  const buffer = Buffer.from(audioContent, 'base64')

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
