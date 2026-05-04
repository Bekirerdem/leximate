-- Profil arama RPC'si + realtime publication'ın idempotent garantisi.
-- profiles RLS'i sadece kendi profil + aktif arkadaşı görmeye izin veriyor;
-- yabancı kullanıcı aramak için security definer RPC ekliyoruz (sadece username ilike eşleşmesi).

create or replace function public.search_profile_by_username(query text)
returns table (id uuid, username text, cefr_level text, streak_count integer)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.username, p.cefr_level, p.streak_count
  from profiles p
  where p.username ilike query
    and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  limit 5;
$$;

revoke all on function public.search_profile_by_username(text) from public;
grant execute on function public.search_profile_by_username(text) to authenticated;

-- Realtime publication idempotent ekleme — tablo zaten ekli ise hata atmasın.
do $$
declare
  t text;
  pub_tables text[] := array['duel_rooms','duel_participants','duel_rounds','duel_answers'];
begin
  foreach t in array pub_tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
