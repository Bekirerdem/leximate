-- Duello tablolarını Supabase Realtime publication'a ekle
-- Aksi halde DuelRoomPage'deki postgres_changes subscription'ları hiç tetiklenmez
alter publication supabase_realtime add table public.duel_rooms;
alter publication supabase_realtime add table public.duel_answers;
