# LexiMate — Edinim Sistemi Yön Değişikliği

**Tarih:** 2026-07-26
**Durum:** onaylandı, uygulama başladı

## Problem

LexiMate 80 gündür dokunulmamıştı. Kullanıcının tespiti: "proje iyi bir aşamada ama tam olarak istediğim kıvamda değil."

Teşhis **kod kalitesi sorunu değil, sistem tasarımı sorunu.** Uygulama şunu yapıyordu:

> günde 10 yeni kelime → çoktan seçmeli → SM2 tekrar → düelloda yarış

Bu, dil edinimi literatürünün reddettiği yaklaşımın iyi tasarlanmış hali. Doğru şeyi yapan bir uygulama değil, yanlış şeyi iyi yapan bir uygulama.

## Kullanıcı profili

Tasarımı bu belirledi:

- Kelime dağarcığı **200-300** (temel + teknik) → kelime kapsam eğrisinin en dik bölgesinde
- Konuşma pratiği **yok**
- **Telaffuz iyi** → shadowing'in en zor kısmı (fonolojik düzeltme) zaten geçilmiş
- Bol İngilizce film izlemiş, **Türkçe altyazıyla** → literatüre göre bu ses algısına zarar veriyor
- Hedef **akademik değil mesleki**: Stellar/Avalanche network, hackathon, pitch, demo Q&A

Asıl engel disiplin değil, **karar çerçevesi yokluğu**: "nasıl öğrenilmesi gerektiği konusunda her kafadan bir ses çıkıyor, o yüzden sistem kurmadan başlayamıyorum."

## Kanıt tabanı

Tam tarama ve kaynaklar vault'ta: `research/ingilizce-edinim-metodoloji-2026-07.md`. Tasarımı doğrudan belirleyen bulgular:

| Bulgu | Kaynak | Tasarıma etkisi |
|---|---|---|
| Akıcılığın %28-59'u (bazı ölçümlerde %70'e kadarı) formulaic sequence'lardan geliyor | Pawley & Syder (1983); Conklin & Schmitt | Çekirdek birim kelime değil **kalıp** |
| İlk 1000 kelime konuşmada ~%80-85 kapsam; 1000→2000 sadece +%7-10 | Nation | 1000 kelime hedefi korunur, ama ikinci öncelik |
| Cooperative learning competitive'i geçiyor (122 çalışma, ~0.5-0.6 etki) | Johnson et al. | **Düello silinir** |
| Leaderboard'lar düşük performans gösterenlerde utanç yaratıyor | Sailer & Homner | Sıralama yok |
| Performans-koşullu ödüller intrinsic motivation'ı düşürüyor (d = -0.28..-0.40) | Deci, Koestner & Ryan (128 deney) | Puan/XP yok |
| Shadowing'de 4-5 tekrar reproduction rate'i platoya getiriyor | Shiki et al. (2010) | `shadow` tekrar sayacı alır |
| 13 haftalık shadowing: reproduction %57.5→%75.0, r=.805 | Ohnawa (2018) | Shadowing yüzeyi büyütülür |
| L1 altyazı ses algısına zarar veriyor, L2 altyazı 25 dk'da fayda | Mitterer & McQueen (2009) | Dinleme logu L2-altyazı varsayar |
| Input tek başına konuşmayı açmıyor | Swain, Output Hypothesis | Sistem çıktı ağırlıklı |
| 20 yeni kart/gün → birkaç haftada ~200 review/gün | AnkiWeb | Günlük yeni kalıp tavanı **3-5** |

## Tasarım

### Değişiklikler

| # | Ne | Kapsam |
|---|---|---|
| 1 | **Düello tamamen kaldırılır** | `app/(app)/duel/`, `app/api/duel/`, `components/duel/`, nav girişi, dashboard promo, profil istatistikleri, `duel_*` tabloları |
| 2 | **Kalıp (phrase) birimi** eklenir, durum bazlı gruplanmış | `phrases` + `user_phrases` tabloları, tipler |
| 3 | `learn` akışı kalıp üzerine kurulur | SM2 aynı kalır — çalışıyor, dokunulmuyor |
| 4 | `shadow` gerçek protokole çevrilir | Klip + 4-5 tekrar sayacı + kendi kaydını orijinalle karşılaştırma |
| 5 | **Dinleme logu** eklenir | Günlük dakika + kümülatif saat |

### Korunanlar

- Mevcut kelime sistemi (`words`, 2444 kayıt, `learn`, `review`) — 1000 kelime hedefi geçerli, ikinci öncelik
- `lib/srs/sm2.ts` — çalışıyor
- Gemini cümle üretimi, TTS, onboarding, profil

### Ertelenenler

- **Grup/sosyal katman.** Kullanıcı önce 2-3 hafta bireysel protokolü oturtacak. Aktive olunca: haftalık check-in + 4/3/2 konuşma turu, rekabet yok.

### Veri modeli

```
phrases
  id            bigserial pk
  english       text not null
  turkish       text not null
  situation     text not null      -- 'intro' | 'pitch' | 'qa' | 'standup' | ...
  register      text               -- 'casual' | 'neutral' | 'formal'
  audio_url     text
  UNIQUE (english, situation)      -- doğal key, upsert için

user_phrases
  id                bigserial pk
  user_id           uuid → auth.users
  phrase_id         bigint → phrases
  status            'new'|'learning'|'review'|'mastered'
  ease_factor       real
  interval_days     int
  next_review_date  date
  correct_count     int
  incorrect_count   int
  last_reviewed_at  timestamptz
  UNIQUE (user_id, phrase_id)

listening_log
  id          bigserial pk
  user_id     uuid → auth.users
  log_date    date
  minutes     int
  source      text
  UNIQUE (user_id, log_date, source)
```

`situation` ayrı tablo değil, text alan + kod tarafında sabit liste. 3 kullanıcılık uygulamada ayrı tablo gereksiz karmaşıklık.

`UNIQUE (english, situation)` bilinçli: aynı kalıp farklı durumlarda meşru olarak tekrar edebilir, ama aynı durum içinde tekrar etmemeli. 2026-05-06'daki duplicate faciasının tekrarını önler.

## Blocker

**Kalıp havuzu üretimi kullanıcının 30 durum listesini bekliyor.** Müfredat gramer sırasından değil, ESP needs analysis'ten doğuyor: kullanıcı hangi durumlarda konuşması gerektiğini kendi hayatından yazacak, kalıp havuzları (durum başına 5-10, toplam ~150-200) o listeden üretilecek.

Bu gelene kadar ilerleyebilecek işler: düello temizliği, şema, tipler.

## Uygulama sırası

1. Düello sayfaları kaldırılır
2. Düello API'leri kaldırılır
3. Düello componentleri kaldırılır
4. Navigasyon + dashboard referansları temizlenir
5. Profil düello istatistikleri kaldırılır
6. `duel_*` tabloları düşürülür (migration)
7. `phrases` / `user_phrases` / `listening_log` şeması (migration)
8. Tipler
9. *(blocker sonrası)* kalıp üretim scripti, `learn` akışı, `shadow` protokolü, dinleme logu UI
