-- Kullanıcının bildiği kelimelerle Gemini tarafından üretilmiş context-aware cümleler
-- Her (user, word) için bir kez üretilir, cache'lenir
create table user_word_sentences (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  word_id bigint references words(id) on delete cascade not null,
  sentence text not null,
  translation text not null,
  created_at timestamptz not null default now(),
  unique(user_id, word_id)
);

create index user_word_sentences_user_word_idx on user_word_sentences(user_id, word_id);

alter table user_word_sentences enable row level security;

create policy "user_word_sentences_own"
  on user_word_sentences
  for all
  using (auth.uid() = user_id);
