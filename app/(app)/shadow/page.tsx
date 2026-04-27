'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mic, MicOff, Volume2, ChevronRight, RotateCcw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import type { Word } from '@/lib/types'

type Phase = 'idle' | 'listening' | 'evaluating' | 'result'

interface Result {
  score: number
  feedback: string
}

export default function ShadowPage() {
  const [words, setWords] = useState<Word[]>([])
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [transcript, setTranscript] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(true)
  const [completed, setCompleted] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  useEffect(() => { loadWords() }, [])

  async function loadWords() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('user_words')
      .select('word:words(*)')
      .eq('user_id', user.id)
      .neq('status', 'new')
      .order('last_reviewed_at', { ascending: false })
      .limit(15)

    const extracted = (data ?? []).map((r: any) => r.word as Word).filter(Boolean)
    setWords(extracted)
    setLoading(false)
  }

  async function handleSpeak() {
    const word = words[index]
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
        u.rate = 0.8
        window.speechSynthesis.speak(u)
      }
    }
  }

  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      alert('Tarayıcın mikrofon tanıma desteklemiyor. Chrome kullan.')
      return
    }

    const recognition = new SR()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition

    setPhase('listening')
    setTranscript('')
    setResult(null)

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript
      setTranscript(text)
      setPhase('evaluating')
      await evaluate(text)
    }

    recognition.onerror = (event: any) => {
      setPhase('idle')
      if (event.error !== 'aborted') toast.error('Mikrofon hatası: ' + event.error)
    }

    recognition.onend = () => {
      if (phase === 'listening') setPhase('idle')
    }

    recognition.start()
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setPhase('idle')
  }

  async function evaluate(text: string) {
    const word = words[index]
    const res = await fetch('/api/shadow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: word.english, transcript: text }),
    })
    const data = await res.json()
    setResult(data)
    setPhase('result')
  }

  function next() {
    if (index + 1 >= words.length) {
      setCompleted(true)
    } else {
      setIndex(i => i + 1)
      setPhase('idle')
      setTranscript('')
      setResult(null)
    }
  }

  function retry() {
    setPhase('idle')
    setTranscript('')
    setResult(null)
  }

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-2 w-full rounded-full" />
      <Skeleton className="h-52 rounded-3xl" />
      <Skeleton className="h-12 rounded-2xl" />
      <Skeleton className="h-16 rounded-2xl" />
    </div>
  )

  if (words.length === 0) {
    return (
      <div className="text-center py-20 space-y-4">
        <div className="text-5xl">🎙️</div>
        <h2 className="text-xl font-bold text-slate-800">Önce kelime öğren</h2>
        <p className="text-slate-500 text-sm">Gölgeleme için en az birkaç kelime öğrenmiş olman gerekiyor</p>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="text-center py-16 space-y-6">
        <div className="text-6xl">🎙️</div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Oturum Bitti!</h2>
          <p className="text-slate-500 mt-1">{words.length} kelimeyi seslendirdin</p>
        </div>
        <a href="/" className="block w-full py-4 rounded-2xl text-white font-bold text-center"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
          Ana Sayfaya Dön
        </a>
      </div>
    )
  }

  const word = words[index]
  const scoreColor = result ? result.score >= 80 ? '#10b981' : result.score >= 50 ? '#f59e0b' : '#ef4444' : '#6366f1'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900">Gölgeleme</h1>
          <p className="text-slate-400 text-xs">Telaffuz pratiği yap</p>
        </div>
        <span className="text-sm font-semibold text-slate-400">{index + 1}/{words.length}</span>
      </div>

      {/* Progress */}
      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${((index) / words.length) * 100}%`, background: 'linear-gradient(90deg, #3b82f6, #6366f1)' }} />
      </div>

      {/* Word card */}
      <div className="bg-white rounded-3xl shadow-[0_4px_32px_rgba(0,0,0,0.08)] p-8 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">Telaffuz Et</p>
        <p className="text-5xl font-black text-slate-900 mb-2">{word.english}</p>
        <p className="text-slate-400 text-sm">{word.turkish}</p>
        {word.example_sentence && (
          <p className="text-slate-300 text-xs italic mt-3">"{word.example_sentence}"</p>
        )}
      </div>

      {/* Listen button */}
      <button
        onClick={handleSpeak}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm"
      >
        <Volume2 size={16} />
        Önce Dinle
      </button>

      {/* Mic section */}
      {phase === 'idle' && (
        <button
          onClick={startListening}
          className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl text-white font-bold text-base transition-all active:scale-95 shadow-[0_4px_20px_rgba(99,102,241,0.4)]"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          <Mic size={22} />
          Konuş
        </button>
      )}

      {phase === 'listening' && (
        <button
          onClick={stopListening}
          className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl text-white font-bold text-base animate-pulse"
          style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
        >
          <MicOff size={22} />
          Durdur
        </button>
      )}

      {phase === 'evaluating' && (
        <div className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl bg-slate-100 text-slate-500 font-semibold">
          <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
          Değerlendiriliyor...
        </div>
      )}

      {phase === 'result' && result && (
        <div className="space-y-3">
          {/* Score */}
          <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-6 text-center">
            <div className="relative w-24 h-24 mx-auto mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke={scoreColor} strokeWidth="3"
                  strokeDasharray={`${result.score} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-black" style={{ color: scoreColor }}>{result.score}</span>
              </div>
            </div>
            {transcript && (
              <p className="text-slate-500 text-sm mb-2">Duyulan: <span className="font-semibold text-slate-700">"{transcript}"</span></p>
            )}
            <p className="text-slate-700 text-sm font-medium">{result.feedback}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={retry}
              className="flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors"
            >
              <RotateCcw size={16} />
              Tekrar
            </button>
            <button
              onClick={next}
              className="flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-bold text-sm transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
            >
              Sonraki
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
