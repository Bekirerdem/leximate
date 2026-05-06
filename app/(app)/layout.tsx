'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Home, BookOpen, RotateCcw, Swords, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/', icon: Home, label: 'Ana Sayfa' },
  { href: '/learn', icon: BookOpen, label: 'Öğren' },
  { href: '/review', icon: RotateCcw, label: 'Tekrar' },
  { href: '/duel', icon: Swords, label: 'Düello' },
  { href: '/profile', icon: User, label: 'Profil' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isOnboarding = pathname === '/onboarding'

  useEffect(() => {
    if (isOnboarding) return
    const done = localStorage.getItem('leximate_onboarded')
    if (done) return

    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Profil tamamlanmış mı (cefr_level set edilmiş mi) kontrol et.
      // user_words sayısı kullanılmamalı: progress reset edildiğinde de tetiklenir.
      const { data: profile } = await supabase
        .from('profiles')
        .select('cefr_level')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile?.cefr_level) {
        router.push('/onboarding')
      } else {
        localStorage.setItem('leximate_onboarded', '1')
      }
    }
    check()
  }, [isOnboarding, router])

  if (isOnboarding) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: '#f1f5f9' }}>
      <main className="max-w-lg mx-auto px-4 py-5">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-50" style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 -4px 24px rgba(0,0,0,0.06)' }}>
        <div className="max-w-lg mx-auto flex justify-around items-center h-[68px] px-2">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-1 min-w-[3.5rem] py-1"
              >
                <div className={`flex items-center justify-center w-10 h-10 rounded-2xl transition-all ${active ? 'text-white shadow-[0_4px_12px_rgba(59,130,246,0.35)]' : 'text-slate-400'}`}
                  style={active ? { background: 'linear-gradient(135deg, #3b82f6, #6366f1)' } : {}}>
                  <Icon size={19} />
                </div>
                <span className={`text-[10px] font-semibold transition-colors ${active ? 'text-blue-600' : 'text-slate-400'}`}>
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
