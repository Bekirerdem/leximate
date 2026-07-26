-- Düello sistemi kaldırılıyor.
--
-- Gerekçe (docs/superpowers/specs/2026-07-26-edinim-sistemi-design.md):
-- cooperative learning competitive yapıyı geçiyor (Johnson et al., 122 çalışma);
-- leaderboard düşük performans gösteren üyede utanç yaratıyor (Sailer & Homner);
-- performans-koşullu ödül intrinsic motivation'ı düşürüyor (Deci/Koestner/Ryan).
-- 3 kişilik bir grupta rekabet mekaniği en zayıf üyeyi sistemden atıyor.
--
-- friendships tablosu KORUNUYOR: düellodan bağımsız, ileride grup katmanı kullanacak.
-- Tablolar drop edilince supabase_realtime publication üyelikleri de düşer.

drop table if exists duel_answers cascade;
drop table if exists duel_rounds cascade;
drop table if exists duel_participants cascade;
drop table if exists duel_rooms cascade;

drop function if exists public.is_duel_host(uuid);
drop function if exists public.is_duel_participant(uuid);
