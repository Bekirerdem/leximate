-- Tüm kullanıcıların ilerlemesini sıfırla, words tablosundaki duplicate'leri temizle, UNIQUE constraint ekle.
-- Sebep: words tablosunda 169 duplicate (english+cefr aynı, farklı id) → Hamza'nın "öğrendiği kelime tekrar yeniymiş gibi geliyor" bug'ı.

-- 1) Progress reset
delete from user_word_sentences;
delete from user_words;
delete from daily_sessions;

update profiles set
  streak_count = 0,
  streak_last_date = null;

-- 2) Words tablosundaki duplicate'leri temizle (case-insensitive, küçük id kanonik)
delete from words
where id in (
  select id from (
    select id, row_number() over (
      partition by lower(english), cefr_level
      order by id
    ) as rn
    from words
  ) ranked
  where rn > 1
);

-- 3) İleride duplicate önle: case-insensitive UNIQUE expression index
create unique index if not exists words_english_level_unique_idx
  on words (lower(english), cefr_level);
