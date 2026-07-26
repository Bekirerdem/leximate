-- Kalıp (phrase) sistemi — sistemin yeni çekirdek birimi.
--
-- Gerekçe (docs/superpowers/specs/2026-07-26-edinim-sistemi-design.md):
-- akıcılığın %28-59'u formulaic sequence'lardan geliyor (Pawley & Syder;
-- Conklin & Schmitt). Tek tek kelime yanlış birim — blok doğru birim.
--
-- words tablosu kaldırılmıyor: 1000 kelime hedefi geçerli, sadece ikinci öncelik.

-- Durum bazlı kalıp havuzu. Müfredat CEFR sırasından değil, ESP needs
-- analysis'ten doğuyor: kullanıcının "hangi durumda konuşacağım" listesi.
create table phrases (
  id bigserial primary key,
  english text not null,
  turkish text not null,
  situation text not null,
  register text not null default 'neutral' check (register in ('casual','neutral','formal')),
  audio_url text,
  created_at timestamptz not null default now(),
  -- Doğal key. Aynı kalıp farklı durumlarda meşru olarak tekrar edebilir,
  -- ama aynı durum içinde tekrar etmemeli. 2026-05-06 duplicate faciasının
  -- tekrarını önler; üretim script'i upsert kullanacak.
  unique(english, situation)
);

-- Kullanıcı başına SRS kartları. user_words ile aynı SM2 alanları —
-- lib/srs/sm2.ts değişmeden çalışsın diye bilinçli olarak aynı şema.
create table user_phrases (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  phrase_id bigint references phrases(id) on delete cascade not null,
  status text not null default 'new' check (status in ('new','learning','review','mastered')),
  ease_factor real not null default 2.5,
  interval_days integer not null default 1,
  next_review_date date not null default current_date,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  last_reviewed_at timestamptz,
  unique(user_id, phrase_id)
);

-- Dinleme logu. Sistemin tek objektif metriği: kümülatif saat.
-- Puan/XP/rozet bilinçli olarak yok (vanity metric).
create table listening_log (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  log_date date not null default current_date,
  minutes integer not null check (minutes > 0),
  source text not null default 'other',
  created_at timestamptz not null default now(),
  unique(user_id, log_date, source)
);

alter table phrases enable row level security;
alter table user_phrases enable row level security;
alter table listening_log enable row level security;

create policy "phrases_select_all" on phrases for select using (true);
create policy "user_phrases_own" on user_phrases for all using (auth.uid() = user_id);
create policy "listening_log_own" on listening_log for all using (auth.uid() = user_id);

create index user_phrases_due_idx on user_phrases (user_id, next_review_date);
create index phrases_situation_idx on phrases (situation);
create index listening_log_user_date_idx on listening_log (user_id, log_date desc);
