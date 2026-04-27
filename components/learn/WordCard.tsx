'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Word } from '@/lib/types'

interface WordCardProps {
  word: Word
  onResult: (correct: boolean) => void
}

export function WordCard({ word, onResult }: WordCardProps) {
  const [flipped, setFlipped] = useState(false)

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
        className="cursor-pointer min-h-48 flex items-center justify-center transition-all hover:shadow-md"
        onClick={() => !flipped && setFlipped(true)}
      >
        <CardContent className="text-center p-8">
          {!flipped ? (
            <div className="space-y-3">
              <Badge variant="outline">{word.part_of_speech}</Badge>
              <p className="text-3xl font-bold text-slate-900">{word.english}</p>
              <p className="text-sm text-slate-400">Türkçesini biliyor musun? Karta tıkla</p>
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
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => onResult(false)}
          >
            ✗ Bilmedim
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={() => onResult(true)}
          >
            ✓ Bildim
          </Button>
        </div>
      )}
    </div>
  )
}
