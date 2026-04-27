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
