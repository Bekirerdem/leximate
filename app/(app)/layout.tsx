import Link from 'next/link'
import { Home, BookOpen, RotateCcw, Swords, User } from 'lucide-react'

const navItems = [
  { href: '/', icon: Home, label: 'Ana Sayfa' },
  { href: '/learn', icon: BookOpen, label: 'Öğren' },
  { href: '/review', icon: RotateCcw, label: 'Tekrar' },
  { href: '/duel', icon: Swords, label: 'Düello' },
  { href: '/profile', icon: User, label: 'Profil' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <main className="max-w-lg mx-auto px-4 py-6">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50">
        <div className="max-w-lg mx-auto flex justify-around items-center h-16">
          {navItems.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 text-slate-500 hover:text-blue-600 transition-colors"
            >
              <Icon size={20} />
              <span className="text-xs">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
