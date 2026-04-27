'use client'

import { useState } from 'react'
import { Volume2 } from 'lucide-react'
import type { Word } from '@/lib/types'

interface WordCardProps {
  word: Word
  onResult: (correct: boolean) => void
}

const POS_LABELS: Record<string, { label: string; color: string }> = {
  noun:      { label: 'isim',  color: 'bg-blue-100 text-blue-600' },
  verb:      { label: 'fiil',  color: 'bg-violet-100 text-violet-600' },
  adjective: { label: 'sıfat', color: 'bg-amber-100 text-amber-600' },
  adverb:    { label: 'zarf',  color: 'bg-green-100 text-green-600' },
  phrase:    { label: 'ifade', color: 'bg-rose-100 text-rose-600' },
}

export function WordCard({ word, onResult }: WordCardProps) {
  const [flipped, setFlipped] = useState(false)
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
              <p className="text-xs font-medium">kartı çevir</p>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
            </div>
          </div>
          {/* Back */}
          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-3xl shadow-[0_4px_32px_rgba(99,102,241,0.25)] flex flex-col items-center justify-center p-8 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}>
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 70%, white 0%, transparent 60%)' }} />
            <p className="text-4xl font-black text-white text-center mb-3 relative">{word.turkish}</p>
            {word.example_sentence && (
              <p className="text-indigo-200 text-sm italic text-center leading-relaxed relative max-w-[240px]">
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

      {/* Answer buttons */}
      {flipped && (
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={() => onResult(false)}
            className="py-4 rounded-2xl border-2 border-red-100 bg-red-50 text-red-600 font-bold text-sm hover:bg-red-100 active:scale-95 transition-all"
          >
            ✗ Bilmedim
          </button>
          <button
            onClick={() => onResult(true)}
            className="py-4 rounded-2xl text-white font-bold text-sm hover:opacity-90 active:scale-95 transition-all shadow-[0_4px_14px_rgba(16,185,129,0.35)]"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
          >
            ✓ Bildim
          </button>
        </div>
      )}
    </div>
  )
}
