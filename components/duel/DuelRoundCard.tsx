'use client'

import { useEffect, useState } from 'react'
import { Volume2, Clock, CheckCircle2, XCircle } from 'lucide-react'

export interface DuelRoundCardProps {
  sentence: string
  translation: string
  options: string[]
  correctAnswer: string  // bu yalnızca cevap verildikten sonra UI'da gösterilir
  countdownSeconds: number
  myAnswered: boolean
  selected: string | null
  participantsAnswered: number   // şu ana kadar cevap veren toplam (joined üzerinden)
  participantsTotal: number
  onAnswer: (option: string | null) => void
}

function blankSentence(sentence: string, word: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`\\b${escaped}\\b`, 'i')
  return sentence.replace(regex, '＿＿＿＿')
}

export function DuelRoundCard({
  sentence, translation, options, correctAnswer,
  countdownSeconds, myAnswered, selected,
  participantsAnswered, participantsTotal,
  onAnswer,
}: DuelRoundCardProps) {
  const [countdown, setCountdown] = useState(countdownSeconds)
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => { setCountdown(countdownSeconds) }, [countdownSeconds])

  useEffect(() => {
    if (myAnswered) return
    if (countdown <= 0) { onAnswer(null); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown, myAnswered, onAnswer])

  const blanked = blankSentence(sentence, correctAnswer)

  async function handleSpeak() {
    if (speaking) return
    setSpeaking(true)
    const text = myAnswered ? sentence : blanked.replace('＿＿＿＿', 'blank')
    try {
      const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}`)
      if (!res.ok) throw new Error()
      const buf = await res.arrayBuffer()
      const ctx = new AudioContext()
      const decoded = await ctx.decodeAudioData(buf)
      const src = ctx.createBufferSource()
      src.buffer = decoded
      src.connect(ctx.destination)
      src.onended = () => setSpeaking(false)
      src.start()
    } catch {
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text)
        u.lang = 'en-US'; u.rate = 0.85
        u.onend = () => setSpeaking(false)
        window.speechSynthesis.speak(u)
      } else setSpeaking(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-3xl shadow-[0_4px_32px_rgba(0,0,0,0.08)] p-7">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-500">Boşluğu Doldur</p>
          <div className={`flex items-center gap-1 text-xs font-bold ${countdown <= 5 && !myAnswered ? 'text-red-500' : 'text-slate-400'}`}>
            <Clock size={12} />
            {myAnswered ? '✓' : `${countdown}s`}
          </div>
        </div>

        <p className="text-xl font-semibold text-slate-800 text-center leading-relaxed">
          {blanked.split('＿＿＿＿').map((part, i, arr) => (
            <span key={i}>
              {part}
              {i < arr.length - 1 && (
                <span className={`inline-block mx-1 px-3 rounded-lg font-bold ${
                  selected
                    ? selected.toLowerCase() === correctAnswer.toLowerCase()
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                    : 'bg-slate-100 text-slate-400'
                }`}>
                  {selected || '?????'}
                </span>
              )}
            </span>
          ))}
        </p>

        <div className="mt-5 pt-4 border-t border-slate-100">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 text-center">Türkçe</p>
          <p className="text-sm text-slate-600 text-center italic leading-relaxed">{translation}</p>
        </div>
      </div>

      <button
        onClick={handleSpeak}
        disabled={speaking}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border border-slate-150 text-slate-500 text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-60"
      >
        <Volume2 size={16} className={speaking ? 'animate-pulse' : ''} />
        {speaking ? 'Çalıyor...' : 'Cümleyi Dinle'}
      </button>

      <div className="grid grid-cols-2 gap-2.5">
        {options.map(opt => {
          const isSelected = selected === opt
          const isCorrect = opt.toLowerCase() === correctAnswer.toLowerCase()

          let cls = 'py-4 px-3 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2 active:scale-95 border-2 '
          if (!myAnswered) {
            cls += 'bg-white border-slate-150 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 shadow-sm'
          } else if (isCorrect) {
            cls += 'bg-emerald-500 border-emerald-500 text-white shadow-[0_4px_14px_rgba(16,185,129,0.35)]'
          } else if (isSelected) {
            cls += 'bg-red-500 border-red-500 text-white'
          } else {
            cls += 'bg-white border-slate-100 text-slate-300'
          }

          return (
            <button key={opt} onClick={() => onAnswer(opt)} disabled={myAnswered} className={cls}>
              {opt}
              {myAnswered && isCorrect && <CheckCircle2 size={14} />}
              {isSelected && !isCorrect && <XCircle size={14} />}
            </button>
          )
        })}
      </div>

      {/* Cevap durumu */}
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-center">
        <p className="text-xs text-slate-500 font-medium">
          Cevap veren: <span className="text-slate-800 font-bold">{participantsAnswered}/{participantsTotal}</span>
          {participantsAnswered === participantsTotal && ' · Sıradaki tura geçiliyor...'}
        </p>
      </div>
    </div>
  )
}
