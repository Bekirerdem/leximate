'use client'

import { useState } from 'react'
import { Volume2, CheckCircle2, XCircle } from 'lucide-react'
import type { Word } from '@/lib/types'

interface MultipleChoiceCardProps {
  word: Word
  options: string[]
  onResult: (correct: boolean) => void
}

export function MultipleChoiceCard({ word, options, onResult }: MultipleChoiceCardProps) {
  const [selected, setSelected] = useState<string | null>(null)

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

  function handleSelect(option: string) {
    if (selected) return
    setSelected(option)
    setTimeout(() => onResult(option === word.turkish), 1000)
  }

  return (
    <div className="space-y-3">
      {/* Question card */}
      <div className="bg-white rounded-3xl shadow-[0_4px_32px_rgba(0,0,0,0.08)] p-8 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-4">Türkçesi nedir?</p>
        <p className="text-5xl font-black text-slate-900">{word.english}</p>
        {word.example_sentence && (
          <p className="text-slate-400 text-sm mt-4 italic leading-relaxed">"{word.example_sentence}"</p>
        )}
      </div>

      {/* Listen */}
      <button
        onClick={handleSpeak}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border border-slate-150 text-slate-500 text-sm font-semibold hover:bg-slate-50 hover:text-slate-700 transition-colors shadow-sm"
      >
        <Volume2 size={16} />
        Dinle
      </button>

      {/* Options */}
      <div className="grid grid-cols-2 gap-2.5">
        {options.map(opt => {
          const isSelected = selected === opt
          const isCorrect = opt === word.turkish

          let cls = 'py-5 px-3 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2 active:scale-95 border-2 '

          if (!selected) {
            cls += 'bg-white border-slate-150 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 shadow-sm'
          } else if (isCorrect) {
            cls += 'bg-emerald-500 border-emerald-500 text-white shadow-[0_4px_14px_rgba(16,185,129,0.35)]'
          } else if (isSelected) {
            cls += 'bg-red-500 border-red-500 text-white'
          } else {
            cls += 'bg-white border-slate-100 text-slate-300'
          }

          return (
            <button key={opt} onClick={() => handleSelect(opt)} disabled={!!selected} className={cls}>
              {opt}
              {selected && isCorrect && <CheckCircle2 size={14} />}
              {isSelected && !isCorrect && <XCircle size={14} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
