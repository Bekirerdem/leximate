'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const LEVELS = [
  {
    level: 'A0',
    title: 'Sıfırdan Başlıyorum',
    desc: 'İngilizce hiç bilmiyorum — en temel kelimelerle başla',
    examples: 'hello, yes, no, water, one, two',
    bg: 'bg-slate-50 border-slate-200',
    active: 'bg-slate-700 border-slate-700',
    badge: '~150 kelime',
  },
  {
    level: 'A1',
    title: 'Başlangıç',
    desc: 'Temel günlük kelimeleri ve kısa cümleleri biliyorum',
    examples: 'family, school, food, color, time',
    bg: 'bg-emerald-50 border-emerald-200',
    active: 'bg-emerald-600 border-emerald-600',
    badge: '~500 kelime hedefi',
  },
  {
    level: 'A2',
    title: 'Temel',
    desc: 'Basit konularda kendinizi ifade edebiliyorsunuz',
    examples: 'weather, travel, shopping, health',
    bg: 'bg-blue-50 border-blue-200',
    active: 'bg-blue-600 border-blue-600',
    badge: '~1.000 kelime hedefi',
  },
  {
    level: 'B1',
    title: 'Orta',
    desc: 'Tanıdık konularda akıcı iletişim kurabiliyorsunuz',
    examples: 'opinion, environment, culture, work',
    bg: 'bg-indigo-50 border-indigo-200',
    active: 'bg-indigo-600 border-indigo-600',
    badge: '~2.000 kelime hedefi',
  },
  {
    level: 'B2',
    title: 'Orta-İleri',
    desc: 'Karmaşık metinleri anlayabiliyorsunuz',
    examples: 'economics, debate, nuance, idioms',
    bg: 'bg-purple-50 border-purple-200',
    active: 'bg-purple-600 border-purple-600',
    badge: '~3.500 kelime hedefi',
  },
  {
    level: 'C1',
    title: 'İleri',
    desc: 'Akademik ve profesyonel dilde rahatsınız',
    examples: 'rhetoric, legislation, inference',
    bg: 'bg-rose-50 border-rose-200',
    active: 'bg-rose-600 border-rose-600',
    badge: '~5.000 kelime hedefi',
  },
  {
    level: 'C2',
    title: 'Ustalık',
    desc: 'Neredeyse anadil düzeyinde İngilizce biliyorsunuz',
    examples: 'erudite, vernacular, nuanced prose',
    bg: 'bg-amber-50 border-amber-200',
    active: 'bg-amber-600 border-amber-600',
    badge: '~8.000 kelime hedefi',
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
          {LEVELS.map(({ level, title, desc, examples, bg, active, badge }) => {
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
                    <span className={`inline-block text-[10px] font-semibold mt-1.5 px-1.5 py-0.5 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>{badge}</span>
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
