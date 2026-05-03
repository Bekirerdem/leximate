'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, Volume2 } from 'lucide-react'
import type { Word } from '@/lib/types'

interface SentenceCardProps {
  word: Word
  options: string[]  // English word options (correct + distractors)
  sentence: string
  translation: string
  onResult: (correct: boolean) => void
}

function blankSentence(sentence: string, word: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // word boundary ile sadece tam kelimeyi yakala (substring değil)
  const regex = new RegExp(`\\b${escaped}\\b`, 'i')
  return sentence.replace(regex, '＿＿＿＿')
}

export function SentenceCard({ word, options, sentence, translation, onResult }: SentenceCardProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [speaking, setSpeaking] = useState(false)

  const blanked = blankSentence(sentence, word.english)
  const sentenceChanged = blanked !== sentence

  function handleSelect(option: string) {
    if (selected) return
    setSelected(option)
    setTimeout(() => onResult(option.toLowerCase() === word.english.toLowerCase()), 1000)
  }

  async function handleSpeak() {
    if (speaking) return
    setSpeaking(true)
    // Cevap verildiyse boşluksuz cümleyi seslendir, verilmediyse boşluğun yerine "blank" koy
    const textToSpeak = selected
      ? sentence
      : blanked.replace('＿＿＿＿', 'blank')

    try {
      const res = await fetch(`/api/tts?text=${encodeURIComponent(textToSpeak)}`)
      if (!res.ok) throw new Error()
      const buffer = await res.arrayBuffer()
      const ctx = new AudioContext()
      const decoded = await ctx.decodeAudioData(buffer)
      const source = ctx.createBufferSource()
      source.buffer = decoded
      source.connect(ctx.destination)
      source.onended = () => setSpeaking(false)
      source.start()
    } catch {
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(textToSpeak)
        u.lang = 'en-US'
        u.rate = 0.85
        u.onend = () => setSpeaking(false)
        window.speechSynthesis.speak(u)
      } else {
        setSpeaking(false)
      }
    }
  }

  return (
    <div className="space-y-3">
      {/* Context card */}
      <div className="bg-white rounded-3xl shadow-[0_4px_32px_rgba(0,0,0,0.08)] p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-4 text-center">
          Boşluğu Doldur
        </p>

        {sentenceChanged ? (
          <p className="text-xl font-semibold text-slate-800 text-center leading-relaxed">
            {blanked.split('＿＿＿＿').map((part, i, arr) => (
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
          // Fallback: hedef kelime cümlede bulunamadıysa düz Türkçe→İngilizce sor
          <div className="text-center">
            <p className="text-slate-500 text-sm mb-2">"{word.turkish}" kelimesinin İngilizcesi nedir?</p>
            <p className="text-4xl font-black text-slate-900">{word.turkish}</p>
          </div>
        )}

        {/* Türkçe çeviri her zaman görünür — yeni öğrenmede yardımcı */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 text-center">
            Türkçe
          </p>
          <p className="text-sm text-slate-600 text-center italic leading-relaxed">
            {translation}
          </p>
        </div>
      </div>

      {/* Listen */}
      <button
        onClick={handleSpeak}
        disabled={speaking}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border border-slate-150 text-slate-500 text-sm font-semibold hover:bg-slate-50 hover:text-slate-700 transition-colors shadow-sm disabled:opacity-60"
      >
        <Volume2 size={16} className={speaking ? 'animate-pulse' : ''} />
        {speaking ? 'Çalıyor...' : 'Cümleyi Dinle'}
      </button>

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
