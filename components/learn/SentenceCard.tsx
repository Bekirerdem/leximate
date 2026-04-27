'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import type { Word } from '@/lib/types'

interface SentenceCardProps {
  word: Word
  options: string[]  // English word options (correct + distractors)
  onResult: (correct: boolean) => void
}

function blankSentence(sentence: string, word: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(escaped, 'i')
  return sentence.replace(regex, '＿＿＿＿')
}

export function SentenceCard({ word, options, onResult }: SentenceCardProps) {
  const [selected, setSelected] = useState<string | null>(null)

  const hasSentence = !!word.example_sentence
  const blanked = hasSentence ? blankSentence(word.example_sentence!, word.english) : null
  // sentenceChanged: word was found and replaced in the sentence
  const sentenceChanged = hasSentence && blanked !== null && blanked !== word.example_sentence

  function handleSelect(option: string) {
    if (selected) return
    setSelected(option)
    setTimeout(() => onResult(option.toLowerCase() === word.english.toLowerCase()), 1000)
  }

  return (
    <div className="space-y-3">
      {/* Context card */}
      <div className="bg-white rounded-3xl shadow-[0_4px_32px_rgba(0,0,0,0.08)] p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-4 text-center">
          Boşluğu Doldur
        </p>

        {hasSentence && sentenceChanged ? (
          <p className="text-xl font-semibold text-slate-800 text-center leading-relaxed">
            {blanked!.split('＿＿＿＿').map((part, i, arr) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 && (
                  <span className={`inline-block mx-1 px-3 rounded-lg font-bold ${selected ? (selected.toLowerCase() === word.english.toLowerCase() ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700') : 'bg-slate-100 text-slate-400'}`}>
                    {selected || '?????'}
                  </span>
                )}
              </span>
            ))}
          </p>
        ) : (
          <div className="text-center">
            <p className="text-slate-500 text-sm mb-2">"{word.turkish}" kelimesinin İngilizcesi nedir?</p>
            <p className="text-4xl font-black text-slate-900">{word.turkish}</p>
          </div>
        )}

        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="text-xs text-slate-400">Türkçesi:</span>
          <span className="text-xs font-semibold text-slate-600">{word.turkish}</span>
        </div>
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-2.5">
        {options.map(opt => {
          const isSelected = selected === opt
          const isCorrect = opt.toLowerCase() === word.english.toLowerCase()

          let cls = 'py-4 px-3 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2 active:scale-95 border-2 '
          if (!selected) {
            cls += 'bg-white border-slate-150 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 shadow-sm'
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
