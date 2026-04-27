'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { UserWord } from '@/lib/types'

interface ReviewCardProps {
  userWord: UserWord
  onResult: (quality: number) => void
}

export function ReviewCard({ userWord, onResult }: ReviewCardProps) {
  const [flipped, setFlipped] = useState(false)
  const word = userWord.word!

  function handleSpeak() {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word.english)
      utterance.lang = 'en-US'
      utterance.rate = 0.9
      window.speechSynthesis.speak(utterance)
    }
  }

  return (
    <div className="space-y-4">
      <Card
        className="cursor-pointer min-h-48 flex items-center justify-center hover:shadow-md transition-all"
        onClick={() => !flipped && setFlipped(true)}
      >
        <CardContent className="text-center p-8">
          {!flipped ? (
            <div className="space-y-3">
              <Badge variant="secondary">{word.part_of_speech}</Badge>
              <p className="text-3xl font-bold text-slate-900">{word.english}</p>
              <p className="text-sm text-slate-400">Türkçesini hatırlıyor musun? Karta tıkla</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-2xl font-bold text-blue-600">{word.turkish}</p>
              {word.example_sentence && (
                <p className="text-sm text-slate-500 italic">&ldquo;{word.example_sentence}&rdquo;</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Button variant="outline" size="sm" className="w-full" onClick={handleSpeak}>
        🔊 Dinle
      </Button>

      {flipped && (
        <div className="space-y-2">
          <p className="text-center text-sm text-slate-500">Ne kadar kolaydı?</p>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50 text-xs"
              onClick={() => onResult(1)}
            >
              ✗ Zor
            </Button>
            <Button
              variant="outline"
              className="border-yellow-200 text-yellow-600 hover:bg-yellow-50 text-xs"
              onClick={() => onResult(3)}
            >
              ≈ Orta
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-xs"
              onClick={() => onResult(5)}
            >
              ✓ Kolay
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
