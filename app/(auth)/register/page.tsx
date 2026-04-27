'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

const LEVEL_OPTIONS = [
  { value: 'A0', label: 'A0 — Hiç bilmiyorum' },
  { value: 'A1', label: 'A1 — Çok az biliyorum' },
  { value: 'A2', label: 'A2 — Temel bilgim var' },
  { value: 'B1', label: 'B1 — Orta seviye' },
]

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [level, setLevel] = useState('A1')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: signUpError } = await supabase.auth.signUp({ email, password })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('profiles')
        .update({ username, cefr_level: level })
        .eq('id', user.id)
    }

    router.push('/')
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kayıt Ol</CardTitle>
      </CardHeader>
      <form onSubmit={handleRegister}>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="username">Kullanıcı adı</Label>
            <Input id="username" value={username} onChange={e => setUsername(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Şifre</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="level">İngilizce seviyeniz</Label>
            <select
              id="level"
              value={level}
              onChange={e => setLevel(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {LEVEL_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Kaydediliyor...' : 'Kayıt Ol'}
          </Button>
          <p className="text-sm text-slate-500">
            Zaten hesabın var mı?{' '}
            <Link href="/login" className="text-blue-600 hover:underline">Giriş Yap</Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
