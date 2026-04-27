'use client'

import { useState } from 'react'
import { Volume2 } from 'lucide-react'
import type { UserWord } from '@/lib/types'

interface ReviewCardProps {
  userWord: UserWord
  onResult: (quality: number) => void
}

const POS_LABELS: Record<string, { label: string; color: string }> = {
  noun:      { label: 'isim',  color: 'bg-blue-100 text-blue-600' },
  verb:      { label: 'fiil',  color: 'bg-violet-100 text-violet-600' },
  adjective: { label: 'sıfat', color: 'bg-amber-100 text-amber-600' },
  adverb:    { label: 'zarf',  color: 'bg-green-100 text-green-600' },
  phrase:    { label: 'ifade', color: 'bg-rose-100 text-rose-600' },
}

export function ReviewCard({ userWord, onResult }: ReviewCardProps) {
  const [flipped, setFlipped] = useState(false)
  const word = userWord.word!
  const pos = POS_LABELS[word.part_of_speech] ?? { label: word.part_of_speech, color: 'bg-slate-100 text-slate-600' }

  async function handleSpeak() {
    try {
      const res = await fetch(`/api/tts?text=${encodeURIComponent(word.english)}`)
      if (!res.ok) throw new Error()
      const buffer = await res.arrayBuffer()
      const ctx = new AudioContext()
      const decoded = await ctx.decodeAudioData(buffer)
      const source = ctx.createBufferSource()
      source.buffer = decoded
      source.connect(ctx.destination)
      source.start()
    } catch {
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(word.english)
        u.lang = 'en-US'
        u.rate = 0.85
        window.speechSynthesis.speak(u)
      }
    }
  }

  return (
    <div className="space-y-3">
      {/* Flip card */}
      <div
        className="[perspective:1400px] h-64 cursor-pointer select-none"
        onClick={() => !flipped && setFlipped(true)}
      >
        <div className={`relative w-full h-full [transform-style:preserve-3d] transition-transform duration-500 ease-out ${flipped ? '[transform:rotateY(180deg)]' : ''}`}>
          {/* Front */}
          <div className="absolute inset-0 [backface-visibility:hidden] bg-white rounded-3xl shadow-[0_4px_32px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center p-8">
            <span className={`text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-5 ${pos.color}`}>
              {pos.label}
            </span>
            <p className="text-5xl font-black text-slate-900 text-center leading-tight">{word.english}</p>
            <div className="mt-6 flex items-center gap-1.5 text-slate-300">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
              <p className="text-xs font-medium">Türkçesini hatırla</p>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
            </div>
          </div>
          {/* Back */}
          <div
            className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-3xl shadow-[0_4px_32px_rgba(139,92,246,0.25)] flex flex-col items-center justify-center p-8 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)' }}
          >
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 70%, white 0%, transparent 60%)' }} />
            <p className="text-4xl font-black text-white text-center mb-3 relative">{word.turkish}</p>
            {word.example_sentence && (
              <p className="text-purple-200 text-sm italic text-center leading-relaxed relative max-w-[240px]">
                "{word.example_sentence}"
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Listen */}
      <button
        onClick={handleSpeak}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border border-slate-150 text-slate-500 text-sm font-semibold hover:bg-slate-50 hover:text-slate-700 transition-colors shadow-sm"
      >
        <Volume2 size={16} />
        Dinle
      </button>

      {/* Quality buttons */}
      {flipped && (
        <div className="space-y-2">
          <p className="text-center text-xs text-slate-400 font-semibold tracking-wide uppercase">Ne kadar kolaydı?</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onResult(1)}
              className="py-4 rounded-2xl border-2 border-red-100 bg-red-50 text-red-600 font-bold text-sm hover:bg-red-100 active:scale-95 transition-all"
            >
              Zor
            </button>
            <button
              onClick={() => onResult(3)}
              className="py-4 rounded-2xl border-2 border-amber-100 bg-amber-50 text-amber-600 font-bold text-sm hover:bg-amber-100 active:scale-95 transition-all"
            >
              Orta
            </button>
            <button
              onClick={() => onResult(5)}
              className="py-4 rounded-2xl text-white font-bold text-sm hover:opacity-90 active:scale-95 transition-all shadow-[0_4px_14px_rgba(16,185,129,0.35)]"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
            >
              Kolay
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
