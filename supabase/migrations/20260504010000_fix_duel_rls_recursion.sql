-- duel_participants_select policy kendi tablosunu (dp2) sorguluyor ve
-- duel_rooms_access da duel_participants sorguluyor → karşılıklı sonsuz
-- döngü ("infinite recursion detected in policy for relation duel_participants").
--
-- Çözüm: cross-table katılım/host kontrollerini security definer fonksiyonlara
-- taşı. SECURITY DEFINER fonksiyonlar RLS bypass eder, recursion zincirini keser.

create or replace function public.is_duel_host(p_room_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from duel_rooms where id = p_room_id and host_id = auth.uid()
  );
$$;

create or replace function public.is_duel_participant(p_room_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from duel_participants where room_id = p_room_id and user_id = auth.uid()
  );
$$;

revoke all on function public.is_duel_host(uuid) from public;
revoke all on function public.is_duel_participant(uuid) from public;
grant execute on function public.is_duel_host(uuid) to authenticated;
grant execute on function public.is_duel_participant(uuid) to authenticated;

-- Önceki policy'leri kaldır (yeniden yazacağız)
drop policy if exists "duel_rooms_access" on duel_rooms;
drop policy if exists "duel_participants_select" on duel_participants;
drop policy if exists "duel_participants_insert" on duel_participants;
drop policy if exists "duel_rounds_select" on duel_rounds;
drop policy if exists "duel_rounds_insert" on duel_rounds;
drop policy if exists "duel_answers_select" on duel_answers;

-- duel_rooms: host VEYA katılımcı erişebilir
create policy "duel_rooms_access" on duel_rooms for all using (
  host_id = auth.uid() or public.is_duel_participant(id)
);

-- duel_participants: kendi satırı VEYA aynı odadaki diğer katılımcı VEYA host görebilir
create policy "duel_participants_select" on duel_participants for select using (
  user_id = auth.uid()
  or public.is_duel_participant(room_id)
  or public.is_duel_host(room_id)
);

-- duel_participants: sadece host yeni davet ekleyebilir
create policy "duel_participants_insert" on duel_participants for insert with check (
  public.is_duel_host(room_id)
);

-- duel_rounds: host ve katılımcılar görebilir
create policy "duel_rounds_select" on duel_rounds for select using (
  public.is_duel_host(room_id) or public.is_duel_participant(room_id)
);

create policy "duel_rounds_insert" on duel_rounds for insert with check (
  public.is_duel_host(room_id)
);

-- duel_answers: host ve katılımcılar görebilir
create policy "duel_answers_select" on duel_answers for select using (
  public.is_duel_host(room_id) or public.is_duel_participant(room_id)
);
