'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const LEVELS = [
  {
    level: 'A0',
    title: 'Sıfırdan Başlıyorum',
    desc: 'İngilizce hiç bilmiyorum veya çok azını biliyorum',
    examples: 'hello, yes, no, water',
    color: 'from-slate-400 to-slate-500',
    bg: 'bg-slate-50 border-slate-200',
    active: 'bg-slate-700 border-slate-700',
  },
  {
    level: 'A1',
    title: 'Temel Seviye',
    desc: 'Günlük basit cümleleri anlayabilirim',
    examples: 'family, school, food, colors',
    color: 'from-green-400 to-emerald-500',
    bg: 'bg-emerald-50 border-emerald-200',
    active: 'bg-emerald-600 border-emerald-600',
  },
  {
    level: 'A2',
    title: 'Başlangıç Üstü',
    desc: 'Kısa, basit metinleri okuyabiliyorum',
    examples: 'weather, travel, shopping',
    color: 'from-blue-400 to-blue-500',
    bg: 'bg-blue-50 border-blue-200',
    active: 'bg-blue-600 border-blue-600',
  },
  {
    level: 'B1',
    title: 'Orta Seviye',
    desc: 'Tanıdık konularda kendimi ifade edebiliyorum',
    examples: 'politics, environment, culture',
    color: 'from-indigo-400 to-indigo-500',
    bg: 'bg-indigo-50 border-indigo-200',
    active: 'bg-indigo-600 border-indigo-600',
  },
  {
    level: 'B2',
    title: 'Orta-Üst Seviye',
    desc: 'Karmaşık metinleri anlayabiliyorum',
    examples: 'negotiation, economics, philosophy',
    color: 'from-purple-400 to-purple-500',
    bg: 'bg-purple-50 border-purple-200',
    active: 'bg-purple-600 border-purple-600',
  },
]

export default function OnboardingPage() {
  const [selected, setSelected] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function handleStart() {
    if (!selected) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({ cefr_level: selected }).eq('id', user.id)
    }
    localStorage.setItem('leximate_onboarded', '1')
    router.push('/learn')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-5xl mb-4 block">📚</span>
          <h1 className="text-2xl font-bold text-white">Seviyeni Belirle</h1>
          <p className="text-blue-200 text-sm mt-2">
            Sana özel kelime listesi hazırlamak için İngilizce seviyeni seç
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {LEVELS.map(({ level, title, desc, examples, bg, active }) => {
            const isSelected = selected === level
            return (
              <button
                key={level}
                onClick={() => setSelected(level)}
                className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${
                  isSelected
                    ? `${active} text-white shadow-lg scale-[1.02]`
                    : `${bg} text-slate-700 hover:scale-[1.01]`
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${isSelected ? 'bg-white/20 text-white' : 'bg-white text-slate-500'}`}>
                    {level}
                  </span>
                  <div className="flex-1">
                    <p className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-slate-800'}`}>{title}</p>
                    <p className={`text-xs mt-0.5 ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>{desc}</p>
                    <p className={`text-[10px] mt-1 italic ${isSelected ? 'text-white/60' : 'text-slate-400'}`}>{examples}…</p>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center shrink-0 mt-0.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-white" />
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        <button
          onClick={handleStart}
          disabled={!selected || saving}
          className="w-full py-4 rounded-2xl bg-white text-blue-700 font-bold text-base shadow-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-50 transition-colors"
        >
          {saving ? 'Ayarlanıyor...' : 'Öğrenmeye Başla →'}
        </button>
      </div>
    </div>
  )
}
