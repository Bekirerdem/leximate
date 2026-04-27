# LexiMate — Phase 1: Foundation & Core Loop

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Çalışan Next.js PWA — kullanıcı kayıt/giriş yapabilir, günlük kelime kartı turunu tamamlayabilir, SRS ile tekrar takibi başlar.

**Architecture:** Next.js 14 App Router monolith. Supabase Auth + PostgreSQL + Realtime. SM-2 pure TypeScript. shadcn/ui komponentleri. Supabase Storage TTS cache için hazır (Phase 2'de kullanılacak).

**Tech Stack:** Next.js 14, TypeScript strict, Tailwind CSS, shadcn/ui, Supabase, Vitest

---

## Dosya Yapısı

```
Desktop/leximate/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx          ← bottom nav
│   │   ├── page.tsx            ← dashboard/home
│   │   ├── learn/page.tsx      ← günlük öğrenme döngüsü
│   │   └── review/page.tsx     ← SRS tekrar kuyruğu
│   ├── api/
│   │   └── session/route.ts    ← günlük session API
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── learn/
│   │   ├── WordCard.tsx        ← kelime kartı (flip animasyonu)
│   │   ├── SentenceCard.tsx    ← cümle gösterim kartı
│   │   └── SessionProgress.tsx ← ilerleme çubuğu
│   ├── dashboard/
│   │   ├── StreakCard.tsx
│   │   └── DailyGoalCard.tsx
│   └── review/
│       └── ReviewCard.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts           ← browser client
│   │   ├── server.ts           ← server client
│   │   └── middleware.ts
│   ├── srs/
│   │   ├── sm2.ts              ← SM-2 algoritması
│   │   └── sm2.test.ts
│   └── types.ts                ← tüm tip tanımları
├── supabase/
│   └── migrations/
│       └── 20260427000000_initial.sql
├── public/
│   └── manifest.json
├── middleware.ts
├── vitest.config.ts
└── package.json
```

---

## Task 1: Proje Kurulumu

**Files:**
- Create: `Desktop/leximate/` (tüm proje)
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`

- [ ] **Step 1: Next.js projesi oluştur**

```bash
cd C:/Users/l3eki/Desktop
npx create-next-app@latest leximate --typescript --tailwind --app --no-src-dir --import-alias="@/*" --no-git
cd leximate
```

- [ ] **Step 2: Bağımlılıkları kur**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
npx shadcn@latest init
```

shadcn init sorularına cevap:
```
Style: Default
Base color: Slate
CSS variables: Yes
```

- [ ] **Step 3: shadcn komponentleri ekle**

```bash
npx shadcn@latest add button card input label badge progress separator
```

- [ ] **Step 4: `vitest.config.ts` oluştur**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 5: `vitest.setup.ts` oluştur**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 6: `package.json` test scriptini ekle**

`package.json` içindeki `scripts` bloğuna ekle:
```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 7: `.env.local` oluştur**

```bash
# Supabase (Task 2'de doldurulacak)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Gemini (Phase 2'de kullanılacak)
GEMINI_API_KEY=

# Google Cloud TTS (Phase 2'de kullanılacak)
GOOGLE_TTS_API_KEY=
```

- [ ] **Step 8: İlk commit**

```bash
git init
git add .
git commit -m "chore: initial Next.js project setup with Supabase and Vitest"
```

---

## Task 2: Supabase Kurulumu & Veritabanı Şeması

**Files:**
- Create: `supabase/migrations/20260427000000_initial.sql`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/types.ts`

- [ ] **Step 1: Supabase projesi oluştur**

[supabase.com](https://supabase.com) → New Project → "leximate"

Project URL ve Anon Key'i `.env.local` dosyasına yaz.

- [ ] **Step 2: Migration SQL yaz**

`supabase/migrations/20260427000000_initial.sql`:

```sql
-- Kullanıcı profilleri
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  cefr_level text not null default 'A1' check (cefr_level in ('A0','A1','A2','B1','B2','C1','C2')),
  streak_count integer not null default 0,
  streak_last_date date,
  created_at timestamptz not null default now()
);

-- CEFR kelime havuzu
create table words (
  id bigserial primary key,
  english text not null,
  turkish text not null,
  cefr_level text not null check (cefr_level in ('A0','A1','A2','B1','B2','C1','C2')),
  part_of_speech text not null check (part_of_speech in ('noun','verb','adjective','adverb','phrase')),
  example_sentence text,
  audio_url text,
  created_at timestamptz not null default now()
);

-- Kullanıcı başına SRS kartları
create table user_words (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  word_id bigint references words(id) on delete cascade not null,
  status text not null default 'new' check (status in ('new','learning','review','mastered')),
  ease_factor real not null default 2.5,
  interval_days integer not null default 1,
  next_review_date date not null default current_date,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  last_reviewed_at timestamptz,
  unique(user_id, word_id)
);

-- Günlük öğrenme oturumları
create table daily_sessions (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  session_date date not null default current_date,
  words_learned integer not null default 0,
  words_reviewed integer not null default 0,
  completed boolean not null default false,
  unique(user_id, session_date)
);

-- Arkadaşlıklar
create table friendships (
  id bigserial primary key,
  user_id_1 uuid references profiles(id) on delete cascade not null,
  user_id_2 uuid references profiles(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending','active')),
  created_at timestamptz not null default now(),
  unique(user_id_1, user_id_2)
);

-- RLS aktif et
alter table profiles enable row level security;
alter table words enable row level security;
alter table user_words enable row level security;
alter table daily_sessions enable row level security;
alter table friendships enable row level security;

-- Profiles: herkes kendi profilini okuyup güncelleyebilir
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);

-- Arkadaşların profillerini görebilsin (duo panel için)
create policy "profiles_select_friends" on profiles for select using (
  exists (
    select 1 from friendships
    where status = 'active'
    and ((user_id_1 = auth.uid() and user_id_2 = id) or (user_id_2 = auth.uid() and user_id_1 = id))
  )
);

-- Words: herkes okuyabilir (public müfredat)
create policy "words_select_all" on words for select using (true);

-- User words: sadece kendi kartları
create policy "user_words_own" on user_words for all using (auth.uid() = user_id);

-- Daily sessions: sadece kendi oturumları
create policy "daily_sessions_own" on daily_sessions for all using (auth.uid() = user_id);

-- Friendships: kendi bağlantıları
create policy "friendships_own" on friendships for all using (
  auth.uid() = user_id_1 or auth.uid() = user_id_2
);

-- Profil otomatik oluşturma trigger
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, username)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
```

- [ ] **Step 3: Migration'ı Supabase'e uygula**

Supabase Dashboard → SQL Editor → migration SQL'i yapıştır → Run

- [ ] **Step 4: `lib/types.ts` oluştur**

```typescript
export type CefrLevel = 'A0' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'phrase'
export type WordStatus = 'new' | 'learning' | 'review' | 'mastered'

export interface Profile {
  id: string
  username: string
  cefr_level: CefrLevel
  streak_count: number
  streak_last_date: string | null
  created_at: string
}

export interface Word {
  id: number
  english: string
  turkish: string
  cefr_level: CefrLevel
  part_of_speech: PartOfSpeech
  example_sentence: string | null
  audio_url: string | null
}

export interface UserWord {
  id: number
  user_id: string
  word_id: number
  status: WordStatus
  ease_factor: number
  interval_days: number
  next_review_date: string
  correct_count: number
  incorrect_count: number
  last_reviewed_at: string | null
  word?: Word
}

export interface DailySession {
  id: number
  user_id: string
  session_date: string
  words_learned: number
  words_reviewed: number
  completed: boolean
}
```

- [ ] **Step 5: `lib/supabase/client.ts` oluştur**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 6: `lib/supabase/server.ts` oluştur**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 7: `middleware.ts` oluştur (proje kökünde)**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/register')

  if (!user && !isAuthRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
```

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: Supabase setup, database schema, and client utilities"
```

---

## Task 3: Authentication Sayfaları

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/register/page.tsx`
- Create: `app/(auth)/layout.tsx`

- [ ] **Step 1: Auth layout oluştur**

`app/(auth)/layout.tsx`:
```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">LexiMate</h1>
          <p className="text-slate-500 mt-1">İngilizce öğrenme yolculuğun başlıyor</p>
        </div>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Login sayfası oluştur**

`app/(auth)/login/page.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('E-posta veya şifre hatalı.')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Giriş Yap</CardTitle>
      </CardHeader>
      <form onSubmit={handleLogin}>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Şifre</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </Button>
          <p className="text-sm text-slate-500">
            Hesabın yok mu?{' '}
            <Link href="/register" className="text-blue-600 hover:underline">
              Kayıt Ol
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
```

- [ ] **Step 3: Register sayfası oluştur**

`app/(auth)/register/page.tsx`:
```typescript
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
```

- [ ] **Step 4: Test — auth akışını elle dene**

```bash
npm run dev
```

`http://localhost:3000` → login sayfasına yönlendirmeli  
Kayıt ol → ana sayfaya yönlendirmeli  
Supabase Dashboard → Authentication → Users'da yeni kullanıcı görünmeli

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: login and register pages with Supabase Auth"
```

---

## Task 4: SM-2 Algoritması

**Files:**
- Create: `lib/srs/sm2.ts`
- Create: `lib/srs/sm2.test.ts`

- [ ] **Step 1: Test dosyasını yaz (önce test)**

`lib/srs/sm2.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { calculateNextReview } from './sm2'

describe('SM-2 algorithm', () => {
  it('ilk doğru cevap — interval 1 gün, ease_factor değişmez', () => {
    const result = calculateNextReview({
      ease_factor: 2.5,
      interval_days: 1,
      correct_count: 0,
      quality: 4,
    })
    expect(result.interval_days).toBe(1)
    expect(result.ease_factor).toBeCloseTo(2.5)
  })

  it('ikinci doğru cevap — interval 6 güne çıkar', () => {
    const result = calculateNextReview({
      ease_factor: 2.5,
      interval_days: 1,
      correct_count: 1,
      quality: 4,
    })
    expect(result.interval_days).toBe(6)
  })

  it('üçüncü+ doğru cevap — interval ease_factor ile çarpılır', () => {
    const result = calculateNextReview({
      ease_factor: 2.5,
      interval_days: 6,
      correct_count: 2,
      quality: 4,
    })
    expect(result.interval_days).toBe(15) // 6 * 2.5 = 15
  })

  it('yanlış cevap — interval 1e sıfırlanır', () => {
    const result = calculateNextReview({
      ease_factor: 2.5,
      interval_days: 15,
      correct_count: 5,
      quality: 1,
    })
    expect(result.interval_days).toBe(1)
  })

  it('ease_factor 1.3 altına düşmez', () => {
    const result = calculateNextReview({
      ease_factor: 1.4,
      interval_days: 3,
      correct_count: 1,
      quality: 0,
    })
    expect(result.ease_factor).toBeGreaterThanOrEqual(1.3)
  })

  it('kaliteli cevap (5) ease_factor yükseltir', () => {
    const result = calculateNextReview({
      ease_factor: 2.5,
      interval_days: 1,
      correct_count: 1,
      quality: 5,
    })
    expect(result.ease_factor).toBeGreaterThan(2.5)
  })

  it('next_review_date bugünden itibaren interval_days sonra', () => {
    const result = calculateNextReview({
      ease_factor: 2.5,
      interval_days: 1,
      correct_count: 1,
      quality: 4,
    })
    const expected = new Date()
    expected.setDate(expected.getDate() + 6)
    expect(result.next_review_date).toBe(expected.toISOString().split('T')[0])
  })
})
```

- [ ] **Step 2: Testi çalıştır — başarısız olmalı**

```bash
npm run test:run
```

Beklenen: `Cannot find module './sm2'`

- [ ] **Step 3: SM-2 implementasyonunu yaz**

`lib/srs/sm2.ts`:
```typescript
interface SM2Input {
  ease_factor: number
  interval_days: number
  correct_count: number
  quality: number // 0-5: 0-2 yanlış, 3-5 doğru
}

interface SM2Output {
  ease_factor: number
  interval_days: number
  next_review_date: string
  status: 'learning' | 'review' | 'mastered'
}

export function calculateNextReview(input: SM2Input): SM2Output {
  const { ease_factor, interval_days, correct_count, quality } = input

  const isCorrect = quality >= 3

  let newInterval: number
  let newEaseFactor: number

  if (!isCorrect) {
    newInterval = 1
    newEaseFactor = Math.max(1.3, ease_factor - 0.2)
  } else {
    newEaseFactor = Math.max(
      1.3,
      ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    )

    if (correct_count === 0) {
      newInterval = 1
    } else if (correct_count === 1) {
      newInterval = 6
    } else {
      newInterval = Math.round(interval_days * ease_factor)
    }
  }

  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + newInterval)
  const next_review_date = nextDate.toISOString().split('T')[0]

  const status = newInterval >= 21 ? 'mastered' : newInterval >= 3 ? 'review' : 'learning'

  return { ease_factor: newEaseFactor, interval_days: newInterval, next_review_date, status }
}
```

- [ ] **Step 4: Testi çalıştır — başarılı olmalı**

```bash
npm run test:run
```

Beklenen: tüm testler PASS

- [ ] **Step 5: Commit**

```bash
git add lib/srs/
git commit -m "feat: SM-2 spaced repetition algorithm with tests"
```

---

## Task 5: Kelime Veritabanı Seed

**Files:**
- Create: `supabase/seed.sql`

- [ ] **Step 1: A1 kelime seed'ini oluştur**

`supabase/seed.sql` (ilk 60 A1 kelimesi — tam seed için Oxford 5000 listesinden genişletilecek):

```sql
insert into words (english, turkish, cefr_level, part_of_speech, example_sentence) values
('hello', 'merhaba', 'A1', 'phrase', 'Hello, how are you?'),
('goodbye', 'güle güle', 'A1', 'phrase', 'Goodbye, see you tomorrow.'),
('thank you', 'teşekkür ederim', 'A1', 'phrase', 'Thank you for your help.'),
('please', 'lütfen', 'A1', 'adverb', 'Please sit down.'),
('yes', 'evet', 'A1', 'adverb', 'Yes, I understand.'),
('no', 'hayır', 'A1', 'adverb', 'No, I do not agree.'),
('water', 'su', 'A1', 'noun', 'Can I have some water?'),
('food', 'yemek', 'A1', 'noun', 'The food is delicious.'),
('house', 'ev', 'A1', 'noun', 'This is my house.'),
('family', 'aile', 'A1', 'noun', 'I love my family.'),
('friend', 'arkadaş', 'A1', 'noun', 'She is my best friend.'),
('school', 'okul', 'A1', 'noun', 'I go to school every day.'),
('book', 'kitap', 'A1', 'noun', 'I am reading a book.'),
('day', 'gün', 'A1', 'noun', 'Today is a good day.'),
('time', 'zaman', 'A1', 'noun', 'What time is it?'),
('work', 'çalışmak', 'A1', 'verb', 'I work at a hospital.'),
('eat', 'yemek yemek', 'A1', 'verb', 'I eat breakfast every morning.'),
('drink', 'içmek', 'A1', 'verb', 'I drink coffee in the morning.'),
('go', 'gitmek', 'A1', 'verb', 'I go to work by bus.'),
('come', 'gelmek', 'A1', 'verb', 'Please come here.'),
('see', 'görmek', 'A1', 'verb', 'I can see the mountains.'),
('know', 'bilmek', 'A1', 'verb', 'Do you know the answer?'),
('want', 'istemek', 'A1', 'verb', 'I want to learn English.'),
('like', 'beğenmek', 'A1', 'verb', 'I like chocolate.'),
('have', 'sahip olmak', 'A1', 'verb', 'I have two cats.'),
('big', 'büyük', 'A1', 'adjective', 'This is a big house.'),
('small', 'küçük', 'A1', 'adjective', 'She has a small dog.'),
('good', 'iyi', 'A1', 'adjective', 'You are doing a good job.'),
('new', 'yeni', 'A1', 'adjective', 'I have a new phone.'),
('old', 'eski', 'A1', 'adjective', 'This is an old building.'),
('happy', 'mutlu', 'A1', 'adjective', 'I am very happy today.'),
('tired', 'yorgun', 'A1', 'adjective', 'I am tired after work.'),
('name', 'isim', 'A1', 'noun', 'My name is Alex.'),
('city', 'şehir', 'A1', 'noun', 'Istanbul is a beautiful city.'),
('country', 'ülke', 'A1', 'noun', 'Turkey is a beautiful country.'),
('money', 'para', 'A1', 'noun', 'I need some money.'),
('car', 'araba', 'A1', 'noun', 'I drive my car to work.'),
('phone', 'telefon', 'A1', 'noun', 'My phone is in my bag.'),
('computer', 'bilgisayar', 'A1', 'noun', 'I use a computer at work.'),
('door', 'kapı', 'A1', 'noun', 'Please close the door.'),
('street', 'sokak', 'A1', 'noun', 'The shop is on this street.'),
('morning', 'sabah', 'A1', 'noun', 'Good morning!'),
('night', 'gece', 'A1', 'noun', 'Good night!'),
('week', 'hafta', 'A1', 'noun', 'I work five days a week.'),
('year', 'yıl', 'A1', 'noun', 'I study English every year.'),
('help', 'yardım etmek', 'A1', 'verb', 'Can you help me?'),
('speak', 'konuşmak', 'A1', 'verb', 'Do you speak English?'),
('read', 'okumak', 'A1', 'verb', 'I read a book every night.'),
('write', 'yazmak', 'A1', 'verb', 'Please write your name here.'),
('open', 'açmak', 'A1', 'verb', 'Please open the window.'),
('close', 'kapatmak', 'A1', 'verb', 'Please close the door.'),
('fast', 'hızlı', 'A1', 'adjective', 'He runs very fast.'),
('slow', 'yavaş', 'A1', 'adjective', 'The bus is very slow today.'),
('hot', 'sıcak', 'A1', 'adjective', 'The tea is very hot.'),
('cold', 'soğuk', 'A1', 'adjective', 'It is cold outside.'),
('beautiful', 'güzel', 'A1', 'adjective', 'The view is beautiful.'),
('easy', 'kolay', 'A1', 'adjective', 'This exercise is easy.'),
('difficult', 'zor', 'A1', 'adjective', 'This question is difficult.'),
('wait', 'beklemek', 'A1', 'verb', 'Please wait a moment.'),
('start', 'başlamak', 'A1', 'verb', 'Let us start the lesson.'),
('finish', 'bitirmek', 'A1', 'verb', 'I will finish this today.');
```

- [ ] **Step 2: Seed'i Supabase'e uygula**

Supabase Dashboard → SQL Editor → seed.sql içeriğini yapıştır → Run

- [ ] **Step 3: Verify**

```sql
select count(*) from words;
-- Beklenen: 60
```

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: A1 vocabulary seed data (60 words)"
```

---

## Task 6: App Layout & Dashboard

**Files:**
- Create: `app/(app)/layout.tsx`
- Create: `app/(app)/page.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Root layout güncelle**

`app/layout.tsx`:
```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LexiMate',
  description: 'Kişiselleştirilmiş İngilizce öğrenme uygulaması',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: App layout (bottom nav) oluştur**

`app/(app)/layout.tsx`:
```typescript
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
```

- [ ] **Step 3: lucide-react kur**

```bash
npm install lucide-react
```

- [ ] **Step 4: Dashboard sayfası oluştur**

`app/(app)/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: session } = await supabase
    .from('daily_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('session_date', new Date().toISOString().split('T')[0])
    .single()

  const { count: totalWords } = await supabase
    .from('user_words')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .neq('status', 'new')

  const { count: dueToday } = await supabase
    .from('user_words')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .lte('next_review_date', new Date().toISOString().split('T')[0])
    .neq('status', 'new')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Merhaba, {profile?.username}!
          </h1>
          <p className="text-slate-500 text-sm">Bugün harika bir gün öğrenmek için</p>
        </div>
        <Badge variant="outline" className="text-sm font-semibold">
          {profile?.cefr_level}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-orange-500">🔥 {profile?.streak_count}</div>
            <div className="text-xs text-slate-500 mt-1">Gün serisi</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-blue-600">{totalWords ?? 0}</div>
            <div className="text-xs text-slate-500 mt-1">Kelime</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-green-600">{dueToday ?? 0}</div>
            <div className="text-xs text-slate-500 mt-1">Tekrar</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Bugünkü Hedef</CardTitle>
        </CardHeader>
        <CardContent>
          {session?.completed ? (
            <p className="text-green-600 font-medium">✓ Bugünkü görevini tamamladın!</p>
          ) : (
            <div className="space-y-3">
              <p className="text-slate-600 text-sm">10 yeni kelime + 5 cümle seni bekliyor</p>
              <Button asChild className="w-full">
                <Link href="/learn">Öğrenmeye Başla</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {(dueToday ?? 0) > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-amber-800">{dueToday} kelime tekrar bekliyor</p>
              <p className="text-sm text-amber-600">Hatırlama gücünü koru</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/review">Tekrar Et</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Test — dashboard açılıyor mu**

```bash
npm run dev
```

Giriş yap → dashboard görünmeli, istatistik kartları 0 göstermeli

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: app layout with bottom nav and dashboard page"
```

---

## Task 7: Günlük Öğrenme Döngüsü — Kelime Kartı

**Files:**
- Create: `components/learn/WordCard.tsx`
- Create: `components/learn/SessionProgress.tsx`
- Create: `app/(app)/learn/page.tsx`
- Create: `app/api/session/route.ts`

- [ ] **Step 1: SessionProgress komponenti oluştur**

`components/learn/SessionProgress.tsx`:
```typescript
import { Progress } from '@/components/ui/progress'

interface SessionProgressProps {
  current: number
  total: number
  phase: 'words' | 'sentences' | 'review'
}

const phaseLabels = {
  words: 'Kelime Turu',
  sentences: 'Cümle Turu',
  review: 'Tekrar',
}

export function SessionProgress({ current, total, phase }: SessionProgressProps) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-slate-500">
        <span>{phaseLabels[phase]}</span>
        <span>{current}/{total}</span>
      </div>
      <Progress value={percent} className="h-2" />
    </div>
  )
}
```

- [ ] **Step 2: WordCard komponenti oluştur**

`components/learn/WordCard.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Word } from '@/lib/types'

interface WordCardProps {
  word: Word
  onResult: (correct: boolean) => void
}

export function WordCard({ word, onResult }: WordCardProps) {
  const [flipped, setFlipped] = useState(false)

  function handleSpeak() {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word.english)
      utterance.lang = 'en-US'
      utterance.rate = 0.9
      window.speechSynthesis.speak(utterance)
    }
  }

  return (
    <div className="space-y-4">
      <Card
        className="cursor-pointer min-h-48 flex items-center justify-center transition-all hover:shadow-md"
        onClick={() => !flipped && setFlipped(true)}
      >
        <CardContent className="text-center p-8">
          {!flipped ? (
            <div className="space-y-3">
              <Badge variant="outline">{word.part_of_speech}</Badge>
              <p className="text-3xl font-bold text-slate-900">{word.english}</p>
              <p className="text-sm text-slate-400">Türkçesini biliyor musun? Karta tıkla</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-2xl font-bold text-blue-600">{word.turkish}</p>
              {word.example_sentence && (
                <p className="text-sm text-slate-500 italic">"{word.example_sentence}"</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={handleSpeak}
      >
        🔊 Dinle
      </Button>

      {flipped && (
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => onResult(false)}
          >
            ✗ Bilmedim
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={() => onResult(true)}
          >
            ✓ Bildim
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Session API route oluştur**

`app/api/session/route.ts`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { calculateNextReview } from '@/lib/srs/sm2'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { wordId, correct } = await request.json()

  const { data: existing } = await supabase
    .from('user_words')
    .select('*')
    .eq('user_id', user.id)
    .eq('word_id', wordId)
    .single()

  const quality = correct ? 4 : 1

  if (!existing) {
    const result = calculateNextReview({ ease_factor: 2.5, interval_days: 1, correct_count: 0, quality })
    await supabase.from('user_words').insert({
      user_id: user.id,
      word_id: wordId,
      status: result.status,
      ease_factor: result.ease_factor,
      interval_days: result.interval_days,
      next_review_date: result.next_review_date,
      correct_count: correct ? 1 : 0,
      incorrect_count: correct ? 0 : 1,
      last_reviewed_at: new Date().toISOString(),
    })
  } else {
    const result = calculateNextReview({
      ease_factor: existing.ease_factor,
      interval_days: existing.interval_days,
      correct_count: existing.correct_count,
      quality,
    })
    await supabase.from('user_words').update({
      status: result.status,
      ease_factor: result.ease_factor,
      interval_days: result.interval_days,
      next_review_date: result.next_review_date,
      correct_count: existing.correct_count + (correct ? 1 : 0),
      incorrect_count: existing.incorrect_count + (correct ? 0 : 1),
      last_reviewed_at: new Date().toISOString(),
    }).eq('id', existing.id)
  }

  // Günlük session güncelle ve streak kontrol et
  const today = new Date().toISOString().split('T')[0]
  const { data: dailySession } = await supabase
    .from('daily_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('session_date', today)
    .single()

  if (dailySession) {
    const newWordsLearned = dailySession.words_learned + (!existing ? 1 : 0)
    const newWordsReviewed = dailySession.words_reviewed + (existing ? 1 : 0)
    const completed = newWordsLearned >= 10

    await supabase
      .from('daily_sessions')
      .update({ words_learned: newWordsLearned, words_reviewed: newWordsReviewed, completed })
      .eq('id', dailySession.id)

    // Streak güncelle: gün tamamlanınca streak artır
    if (completed && !dailySession.completed) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('streak_count, streak_last_date')
        .eq('id', user.id)
        .single()

      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      const newStreak = profile?.streak_last_date === yesterdayStr
        ? (profile.streak_count ?? 0) + 1
        : 1

      await supabase
        .from('profiles')
        .update({ streak_count: newStreak, streak_last_date: today })
        .eq('id', user.id)
    }
  } else {
    await supabase.from('daily_sessions').insert({
      user_id: user.id,
      session_date: today,
      words_learned: !existing ? 1 : 0,
      words_reviewed: existing ? 1 : 0,
      completed: false,
    })
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Learn sayfası oluştur**

`app/(app)/learn/page.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WordCard } from '@/components/learn/WordCard'
import { SessionProgress } from '@/components/learn/SessionProgress'
import { Button } from '@/components/ui/button'
import type { Word } from '@/lib/types'
import Link from 'next/link'

const DAILY_WORD_COUNT = 10

export default function LearnPage() {
  const [words, setWords] = useState<Word[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTodaysWords()
  }, [])

  async function loadTodaysWords() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('cefr_level')
      .eq('id', user.id)
      .single()

    // Kullanıcının henüz görmediği kelimeleri getir
    const { data: seenWordIds } = await supabase
      .from('user_words')
      .select('word_id')
      .eq('user_id', user.id)

    const excludeIds = seenWordIds?.map(r => r.word_id) ?? []

    let query = supabase
      .from('words')
      .select('*')
      .eq('cefr_level', profile?.cefr_level ?? 'A1')
      .limit(DAILY_WORD_COUNT)

    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`)
    }

    const { data: newWords } = await query
    setWords(newWords ?? [])
    setLoading(false)
  }

  async function handleResult(correct: boolean) {
    const word = words[currentIndex]

    await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId: word.id, correct }),
    })

    if (currentIndex + 1 >= words.length) {
      setCompleted(true)
    } else {
      setCurrentIndex(i => i + 1)
    }
  }

  if (loading) {
    return <div className="text-center text-slate-500 py-20">Yükleniyor...</div>
  }

  if (words.length === 0) {
    return (
      <div className="text-center space-y-4 py-20">
        <p className="text-slate-600">Bu seviyede yeni kelime kalmadı 🎉</p>
        <Button asChild variant="outline">
          <Link href="/review">Tekrar Yapmaya Git</Link>
        </Button>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="text-center space-y-6 py-20">
        <div className="text-5xl">🎉</div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Harika!</h2>
          <p className="text-slate-500 mt-1">Bugünkü kelime turunu tamamladın</p>
        </div>
        <div className="flex flex-col gap-3">
          <Button asChild>
            <Link href="/review">Tekrar Turuna Geç</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Ana Sayfaya Dön</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SessionProgress
        current={currentIndex}
        total={words.length}
        phase="words"
      />
      <WordCard
        key={words[currentIndex].id}
        word={words[currentIndex]}
        onResult={handleResult}
      />
    </div>
  )
}
```

- [ ] **Step 5: Test — öğrenme döngüsü çalışıyor mu**

```bash
npm run dev
```

- Giriş yap → "Öğrenmeye Başla" → kelime kartları görünmeli
- Karta tıkla → Türkçesi görünmeli
- 🔊 butonu → ses çıkmalı (Web Speech API)
- "Bildim" / "Bilmedim" → sonraki karta geçmeli
- 10 kelime sonunda tamamlandı ekranı görünmeli
- Supabase Dashboard → `user_words` tablosunda kayıtlar oluşmuş olmalı

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: daily learning session with word cards and SRS integration"
```

---

## Task 8: Tekrar (Review) Sayfası

**Files:**
- Create: `components/review/ReviewCard.tsx`
- Create: `app/(app)/review/page.tsx`

- [ ] **Step 1: ReviewCard komponenti oluştur**

`components/review/ReviewCard.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { UserWord } from '@/lib/types'

interface ReviewCardProps {
  userWord: UserWord
  onResult: (quality: number) => void
}

export function ReviewCard({ userWord, onResult }: ReviewCardProps) {
  const [flipped, setFlipped] = useState(false)
  const word = userWord.word!

  function handleSpeak() {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word.english)
      utterance.lang = 'en-US'
      utterance.rate = 0.9
      window.speechSynthesis.speak(utterance)
    }
  }

  return (
    <div className="space-y-4">
      <Card
        className="cursor-pointer min-h-48 flex items-center justify-center hover:shadow-md transition-all"
        onClick={() => !flipped && setFlipped(true)}
      >
        <CardContent className="text-center p-8">
          {!flipped ? (
            <div className="space-y-3">
              <Badge variant="secondary">{word.part_of_speech}</Badge>
              <p className="text-3xl font-bold text-slate-900">{word.english}</p>
              <p className="text-sm text-slate-400">Türkçesini hatırlıyor musun? Karta tıkla</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-2xl font-bold text-blue-600">{word.turkish}</p>
              {word.example_sentence && (
                <p className="text-sm text-slate-500 italic">"{word.example_sentence}"</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Button variant="outline" size="sm" className="w-full" onClick={handleSpeak}>
        🔊 Dinle
      </Button>

      {flipped && (
        <div className="space-y-2">
          <p className="text-center text-sm text-slate-500">Ne kadar kolaydı?</p>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50 text-xs"
              onClick={() => onResult(1)}
            >
              ✗ Zor
            </Button>
            <Button
              variant="outline"
              className="border-yellow-200 text-yellow-600 hover:bg-yellow-50 text-xs"
              onClick={() => onResult(3)}
            >
              ≈ Orta
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-xs"
              onClick={() => onResult(5)}
            >
              ✓ Kolay
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Review sayfası oluştur**

`app/(app)/review/page.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ReviewCard } from '@/components/review/ReviewCard'
import { SessionProgress } from '@/components/learn/SessionProgress'
import { Button } from '@/components/ui/button'
import type { UserWord } from '@/lib/types'
import Link from 'next/link'

export default function ReviewPage() {
  const [cards, setCards] = useState<UserWord[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const total = cards.length

  useEffect(() => {
    loadDueCards()
  }, [])

  async function loadDueCards() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const today = new Date().toISOString().split('T')[0]

    const { data } = await supabase
      .from('user_words')
      .select('*, word:words(*)')
      .eq('user_id', user.id)
      .lte('next_review_date', today)
      .neq('status', 'new')
      .order('next_review_date', { ascending: true })
      .limit(20)

    setCards(data as UserWord[] ?? [])
    setLoading(false)
  }

  async function handleResult(quality: number) {
    const card = cards[currentIndex]

    await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId: card.word_id, correct: quality >= 3 }),
    })

    if (currentIndex + 1 >= cards.length) {
      setCompleted(true)
    } else {
      setCurrentIndex(i => i + 1)
    }
  }

  if (loading) return <div className="text-center text-slate-500 py-20">Yükleniyor...</div>

  if (cards.length === 0) {
    return (
      <div className="text-center space-y-4 py-20">
        <div className="text-4xl">✅</div>
        <p className="text-slate-600 font-medium">Bugün tekrar edilecek kart yok!</p>
        <Button asChild variant="outline">
          <Link href="/learn">Yeni Kelime Öğren</Link>
        </Button>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="text-center space-y-6 py-20">
        <div className="text-5xl">🏆</div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{total} kartı tamamladın</h2>
          <p className="text-slate-500 mt-1">Harika iş!</p>
        </div>
        <Button asChild>
          <Link href="/">Ana Sayfaya Dön</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SessionProgress current={currentIndex} total={total} phase="review" />
      <ReviewCard
        key={cards[currentIndex].id}
        userWord={cards[currentIndex]}
        onResult={handleResult}
      />
    </div>
  )
}
```

- [ ] **Step 3: Test — review sayfası çalışıyor mu**

```bash
npm run dev
```

- Birkaç kelime öğren → review sayfasına git
- `user_words` tablosunda `next_review_date = bugün` olanlar görünmeli
- Kart tamamlayınca `next_review_date` güncellenmeli

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: review page with SRS-based card queue"
```

---

## Task 9: PWA Manifest

**Files:**
- Create: `public/manifest.json`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Manifest oluştur**

`public/manifest.json`:
```json
{
  "name": "LexiMate",
  "short_name": "LexiMate",
  "description": "Kişiselleştirilmiş İngilizce öğrenme uygulaması",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f8fafc",
  "theme_color": "#2563eb",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

- [ ] **Step 2: 192x192 ve 512x512 ikonları `public/` klasörüne ekle**

Geçici olarak herhangi bir PNG dosyasını `icon-192.png` ve `icon-512.png` olarak kopyala. Tasarım aşamasında gerçek ikonla değiştirilecek.

- [ ] **Step 3: Layout'a manifest link ekle**

`app/layout.tsx` içindeki `metadata` objesini güncelle:
```typescript
export const metadata: Metadata = {
  title: 'LexiMate',
  description: 'Kişiselleştirilmiş İngilizce öğrenme uygulaması',
  manifest: '/manifest.json',
  themeColor: '#2563eb',
}
```

- [ ] **Step 4: Test — PWA kurulumu**

```bash
npm run build && npm run start
```

Chrome → Adres çubuğuna sağ tıkla → "LexiMate'i yükle" seçeneği görünmeli  
Mobilde: tarayıcı menüsü → "Ana ekrana ekle" görünmeli

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: PWA manifest for home screen installation"
```

---

## Özet — Phase 1 Tamamlandı

Phase 1 sonunda çalışan sistem:
- ✅ Kullanıcı kayıt/giriş
- ✅ CEFR seviyesi atama
- ✅ 60 A1 kelimesi ile başlayan müfredat
- ✅ Günlük kelime kartı turu (10 kelime)
- ✅ SM-2 SRS algoritması
- ✅ Tekrar kuyruğu
- ✅ Streak takibi (dashboard)
- ✅ Web Speech API ile ses
- ✅ PWA (telefona eklenebilir)

**Sonraki:** `2026-04-27-ai-audio-social.md` — Gemini cümle üretimi, Google Cloud TTS, shadowing modu, duo paneli, duel sistemi
