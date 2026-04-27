# LexiMate — Tasarım Dokümanı

**Tarih:** 2026-04-27  
**Durum:** Onaylandı  
**Hedef:** Türkçe konuşanlar için ücretsiz, kişiselleştirilmiş İngilizce öğrenme PWA'sı

---

## 1. Ürün Vizyonu

Mevcut ücretli uygulamaların (Duolingo, Babbel, ELSA) kapsamadığı boşlukları kapatan, bilimsel olarak kanıtlanmış öğrenme metodlarını (SRS, shadowing, comprehensible input) bir araya getiren, Türkçe-İngilizce odaklı ücretsiz web uygulaması.

**Hedef kullanıcı:** A0-A2 seviyesinde başlayan, B2 → C1/C2 hedefleyen Türkçe konuşanlar  
**Ölçek:** Max ~10 kullanıcı (kişisel çevre)  
**Platform:** PWA — tarayıcıda çalışır, telefona ana ekrana eklenebilir  
**İnternet:** 7/24 bağlantı varsayımı, offline destek gerekmez

---

## 2. Mimari

### Stack

```
Frontend:   Next.js 14 (App Router) + TypeScript + Tailwind CSS
Backend:    Next.js API Routes / Server Actions
Auth:       Supabase Auth (email + şifre)
Database:   Supabase PostgreSQL + Realtime
Storage:    Supabase Storage (TTS audio cache)
AI:         Gemini Pro API (cümle üretimi, shadowing değerlendirme, konuşma partneri)
TTS:        Google Cloud TTS Neural2 (en-US, cache'li) + Web Speech API (fallback)
Deploy:     Vercel
```

### Mimari Kararlar

- **Monolith:** Tek Next.js repo, server actions ile backend. Max 10 kullanıcı için ayrı API servisi gereksiz overhead.
- **TTS Cache:** Kelime/cümle sesi ilk üretildiğinde MP3 olarak Supabase Storage'a yazılır. Tekrar API çağrısı yapılmaz.
- **Realtime:** Supabase Realtime ile `user_words` ve `shadowing_sessions` subscribe edilir. Duo paneli canlı güncellenir.
- **İki ayrı Google API key:** Gemini API (AI) + Google Cloud TTS (ses) — aynı Google Cloud projesinden, ayrı roller.

---

## 3. Öğrenme Sistemi

### CEFR Müfredatı

```
A0 → A1 → A2 → B1 → B2 → C1 → C2
```

- Kayıtta 15 soruluk seviye testi, CEFR otomatik ataması
- Her seviyede Oxford 5000 + CEFR wordlist bazlı kelime havuzu
- Her 50 kelimede bir kısa test, seviye geçişi otomatik teklif

### Günlük Öğrenme Döngüsü (3 Aşama)

**Aşama 1 — Kelime**
- 10-15 yeni kelime
- Kart çevir → ses dinle (TTS) → Türkçe gör → bildin/bilmedin

**Aşama 2 — Cümle**
- Gemini, günün kelimelerinden 5 cümle üretir (kullanıcının CEFR seviyesine göre)
- TTS okurken kelimeler highlight edilir (word-level timing)
- Kullanıcı Türkçeye çevirir → Gemini kontrol eder

**Aşama 3 — Shadowing**
- Cümleyi dinle → mikrofon açılır → sesli tekrar et
- Web Speech API → speech-to-text
- Gemini: kelime doğruluğu, vurgu geri bildirimi, akıcılık skoru (0-100)
- Yanlışsa spesifik geri bildirim: *"'comfortable' → com-FOR-ta-ble olmalı"*

### SRS Algoritması (SM-2)

- Doğru cevap → interval uzar (1→3→7→21 gün)
- Yanlış cevap → interval sıfırlanır
- 3+ kez yanlış → Gemini o kelime için yeni bağlamda cümleler üretir

### Tekrar Merkezi

| Bölüm | İçerik |
|---|---|
| Günlük Tekrar | SRS kuyruğu — bugün tekrar edilmesi gereken kartlar |
| Zayıf Noktalar | 3+ kez yanlış kelimeler, Gemini yeni cümle üretir |
| Haftalık Sprint | Haftanın son günü, tüm haftanın kelime + shadowing turu |
| Seviye Testi | Her 50 kelimede bir, otomatik seviye geçiş teklifi |

---

## 4. Kullanıcı Profilleri & Duo Modu

### Profil

- Email/şifre kayıt
- CEFR seviyesi (seviye testinden)
- Streak sayısı ve son tarih
- Toplam kelime, shadowing ortalama skoru, seviye rozeti

### Duo Modu

- İki kullanıcı birbirini arkadaş olarak ekler
- Ana sayfada canlı yan panel (Supabase Realtime):

```
Sen                     Kardeşin
──────────────────      ──────────────────
🔥 7 gün streak        🔥 7 gün streak
312 kelime             187 kelime
Bugün: ✓ tamam         Bugün: devam ediyor...
Shadowing: 87%         Shadowing: —
```

- Kardeşin bir görevi tamamladığında anında bildirim

### Duel Modu

- İki kullanıcı aynı kelimeyi öğrendikten sonra "Meydan Oku" butonu aktif
- Kim daha hızlı doğru cevap verir? Kim daha yüksek shadowing skoru alır?
- Duel geçmişi, kazanma/kaybetme istatistikleri

---

## 5. Ses Sistemi

### TTS Akışı

```
İstek gelir
    ↓
Supabase Storage'da cache var mı?
    ├── Evet → direkt MP3 URL döner
    └── Hayır → Google Cloud TTS Neural2 API çağrısı
                    ↓
               MP3 Supabase Storage'a yazılır
                    ↓
               URL döner + DB'ye kaydedilir
```

- Fallback: Google Cloud erişilemezse Web Speech API devreye girer
- Kelime highlight: Google Cloud TTS → SSML `<mark>` tag'leri ile word-level timing. Web Speech API fallback'te → `onboundary` event ile aynı davranış sağlanır.

### Shadowing Akışı

```
1. TTS cümleyi okur (highlight ile)
2. "Tekrar Et" butonu → mikrofon açılır
3. Kullanıcı cümleyi sesli tekrar eder
4. Web Speech API → yazıya döker
5. Gemini karşılaştırır → skor + geri bildirim
6. ✓ geç / ✗ tekrar et
```

---

## 6. Veri Modeli (Supabase)

```sql
profiles          → kullanıcı profilleri (cefr_level, streak, username)
words             → CEFR kelime havuzu (english, turkish, audio_url, cefr_level)
user_words        → kullanıcı başına SRS kartları (ease_factor, interval, next_review_date)
sentences         → Gemini üretimi + cache (english, turkish, audio_url, word_ids)
                   Not: Cümleler on-demand üretilir (kullanıcı aşamaya geçince), önceden batch üretilmez.
shadowing_sessions → oturum kayıtları (spoken_text, accuracy_score, gemini_feedback)
friendships       → duo bağlantıları (user_id_1, user_id_2, status)
duels             → duel geçmişi (challenger, opponent, scores, winner)
```

**RLS (Row Level Security):** Her kullanıcı sadece kendi verisine erişir. Duo paneli için arkadaşın izin verilen alanları read-only.

---

## 7. Ekranlar & Navigasyon

### 5 Ana Sekme

| Sekme | İçerik |
|---|---|
| 🏠 Ana Sayfa | Günlük görev özeti, streak, duo paneli (canlı) |
| 📚 Öğren | Kelime → Cümle → Shadowing günlük döngüsü |
| 🔄 Tekrar | SRS kuyruğu, zayıf noktalar, haftalık sprint |
| ⚔️ Düello | Meydan okuma, duel geçmişi, skorboard |
| 👤 Profil | İstatistikler, rozet, CEFR seviyesi, ayarlar |

### PWA

- `manifest.json` + service worker
- Telefona "Ana Ekrana Ekle" → splash screen + tam ekran, tarayıcı çubuğu yok
- 7/24 internet varsayımı — offline destek yok, tüm içerik sunucudan gelir

---

## 8. Kapsamdışı (Bu Sürümde Yok)

- Ödeme sistemi / premium tier
- İngilizce dışında dil desteği
- Sosyal feed / public profil
- Native iOS/Android uygulama
- Video içerik entegrasyonu (Netflix/YouTube)
- Offline mod

---

## 9. Başarı Kriterleri

- Günlük öğrenme döngüsü (kelime + cümle + shadowing) 15-20 dakikada tamamlanabilir
- SRS algoritması doğru çalışıyor: tekrar tarihleri SM-2'ye uygun hesaplanıyor
- Duo paneli 1 saniye içinde güncelleniyor (Realtime)
- TTS cache: aynı kelime ikinci istekte API çağrısı yapmıyor
- PWA telefona ana ekrana eklenebiliyor
