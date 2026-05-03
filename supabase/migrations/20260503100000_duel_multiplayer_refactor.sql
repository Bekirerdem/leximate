-- Mevcut 1v1 duello tablolarını çoklu kişilik (max 4) yapıya yeniden yaz.
-- Eski schema'da challenger_id/opponent_id 2 kişiye baked'di, sentence-based
-- soru yapısı yoktu, leaderboard yoktu. Yeni schema: duel_rooms + participants +
-- rounds (prefetched Gemini cümleleri) + answers.

drop table if exists duel_answers cascade;
drop table if exists duel_rooms cascade;

create table duel_rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid references profiles(id) on delete cascade not null,
  status text not null default 'waiting' check (status in ('waiting','active','completed')),
  rounds_total int not null default 7,
  current_round int not null default 0,
  cefr_level text not null,
  created_at timestamptz not null default now()
);
create index duel_rooms_host_idx on duel_rooms(host_id);

create table duel_participants (
  id bigserial primary key,
  room_id uuid references duel_rooms(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  score int not null default 0,
  joined boolean not null default false,
  joined_at timestamptz not null default now(),
  unique(room_id, user_id)
);
create index duel_participants_user_idx on duel_participants(user_id);
create index duel_participants_room_idx on duel_participants(room_id);

create table duel_rounds (
  id bigserial primary key,
  room_id uuid references duel_rooms(id) on delete cascade not null,
  round_no int not null,
  word_id bigint references words(id) on delete cascade not null,
  sentence text not null,
  translation text not null,
  options text[] not null,
  unique(room_id, round_no)
);
create index duel_rounds_room_idx on duel_rounds(room_id);

create table duel_answers (
  id bigserial primary key,
  room_id uuid references duel_rooms(id) on delete cascade not null,
  round_no int not null,
  user_id uuid references profiles(id) on delete cascade not null,
  answer text not null,
  correct boolean not null,
  answered_at timestamptz not null default now(),
  unique(room_id, round_no, user_id)
);
create index duel_answers_room_round_idx on duel_answers(room_id, round_no);

alter table duel_rooms enable row level security;
alter table duel_participants enable row level security;
alter table duel_rounds enable row level security;
alter table duel_answers enable row level security;

create policy "duel_rooms_access" on duel_rooms for all using (
  host_id = auth.uid()
  or exists (select 1 from duel_participants dp where dp.room_id = duel_rooms.id and dp.user_id = auth.uid())
);

create policy "duel_participants_select" on duel_participants for select using (
  user_id = auth.uid()
  or exists (select 1 from duel_participants dp2 where dp2.room_id = duel_participants.room_id and dp2.user_id = auth.uid())
  or exists (select 1 from duel_rooms r where r.id = duel_participants.room_id and r.host_id = auth.uid())
);
create policy "duel_participants_insert" on duel_participants for insert with check (
  exists (select 1 from duel_rooms r where r.id = duel_participants.room_id and r.host_id = auth.uid())
);
create policy "duel_participants_update" on duel_participants for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "duel_rounds_select" on duel_rounds for select using (
  exists (select 1 from duel_participants dp where dp.room_id = duel_rounds.room_id and dp.user_id = auth.uid())
  or exists (select 1 from duel_rooms r where r.id = duel_rounds.room_id and r.host_id = auth.uid())
);
create policy "duel_rounds_insert" on duel_rounds for insert with check (
  exists (select 1 from duel_rooms r where r.id = duel_rounds.room_id and r.host_id = auth.uid())
);

create policy "duel_answers_select" on duel_answers for select using (
  exists (select 1 from duel_participants dp where dp.room_id = duel_answers.room_id and dp.user_id = auth.uid())
  or exists (select 1 from duel_rooms r where r.id = duel_answers.room_id and r.host_id = auth.uid())
);
create policy "duel_answers_insert" on duel_answers for insert with check (user_id = auth.uid());

alter publication supabase_realtime add table public.duel_rooms;
alter publication supabase_realtime add table public.duel_participants;
alter publication supabase_realtime add table public.duel_answers;
