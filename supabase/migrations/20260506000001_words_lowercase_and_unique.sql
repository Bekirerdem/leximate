-- Words.english'i case-insensitive sözlük yap: tümünü lowercase normalize et + column UNIQUE constraint.
-- Önceki migration'daki expression unique index PostgREST upsert(onConflict) ile çalışmaz; kaldırıp gerçek constraint koyuyoruz.

drop index if exists words_english_level_unique_idx;

update words set english = lower(english) where english <> lower(english);

-- Normalize sonrası yeni ortaya çıkan duplicate'leri temizle (küçük id kanonik)
delete from words
where id in (
  select id from (
    select id, row_number() over (
      partition by english, cefr_level
      order by id
    ) as rn
    from words
  ) ranked
  where rn > 1
);

alter table words add constraint words_english_level_unique unique (english, cefr_level);
