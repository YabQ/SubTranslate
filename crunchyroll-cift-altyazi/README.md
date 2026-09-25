# Crunchyroll için Çift Altyazı

Crunchyroll'da bölüm izlerken **orijinal altyazıyı (ör. İngilizce) ve seçtiğin dile çevirisini (ör. Türkçe) aynı anda** gösteren bir Chrome eklentisi.

Crunchyroll'da Türkçe altyazı yoksa eklenti İngilizce altyazıyı çevirip iki satır halinde gösterir. Bir dilde Crunchyroll'un resmi altyazısı varsa (ör. İspanyolca) çeviri yerine onu kullanır.

```
   Geri gelip gelmeyeceğini bilmiyorum.     ← çeviri (sarı)
            I don't know if                 ← orijinal (beyaz)
```

## Özellikler

- **İki satır altyazı:** Orijinal + çeviri, istersen yalnızca biri.
- **Üç çeviri servisi:**
  - **Google Çeviri:** Ücretsiz, anahtar istemez (varsayılan).
  - **DeepL:** Kendi API anahtarınla. Ücretsiz planda ayda 500.000 karakter.
  - **Gemini:** Kendi API anahtarınla. Google AI Studio'nun ücretsiz katmanı yeter; sahneyi ve önceki satırları dikkate alan tek ücretsiz seçenek.
  - **Claude (Anthropic):** Kendi API anahtarınla. Sahneyi ve önceki satırları dikkate alır, kaliteyi en çok o yükseltir. İstediğin üslubu yazabilirsin ("samimi konuş", "onur eklerini çevirme" gibi).
- **Kelime sözlüğü:** Çift altyazı açıkken bir kelimenin üzerine gelince kelime renklenir, iki Türkçe anlamı küçük bir balonda çıkar ve çeviri satırındaki karşılığı da aynı renge boyanır. Karşılık arama Türkçe eklere ve ünsüz yumuşamasına dayanıklıdır ("catch" → "yakalamak" → satırdaki "yakalayabiliriz").
- **Kelime defteri:** Kelimeye tıklayınca kaydedilir. Defterde kelimenin türü (fiil / isim / sıfat), o cümlede kullanılan anlamı ve bir alternatifi, geçtiği altyazı satırı çevirisiyle birlikte, aynı anlamda bir örnek cümle ve hangi animenin hangi bölümünde geçtiği durur. Aynı kelimeyi tekrar kaydedince yeni satır açılmaz, sayacı artar. Hiçbir kayıt kendiliğinden silinmez.
- **Bölünmüş cümleler:** İki satıra bölünmüş cümleler ("I don't know if" / "he will come back.") bütün olarak çevrilir.
- **Temiz görüntü:** Crunchyroll'un videoya gömdüğü (hardsub) altyazıyı kaldırır, böylece altyazılar üst üste binmez.
- **Tabela ve ekran yazıları** (bölüm başlığı, telefon mesajı vb.) çevirileriyle birlikte ekranın üstünde, küçük puntoyla gösterilir.
- **Önce izlediğin yer çevrilir.** Bölümün kalanı arka planda çevrilir, ileri sardığında sıra oraya kayar.
- **Önbellek:** Çevrilen bölüm saklanır, tekrar izlerken çeviri isteği gitmez ve ücret ödenmez.
- **Görünüm ayarları:** Yazı boyutu, çeviri boyutu, renkler (orijinal, çeviri, kelime), arka plan koyuluğu, alttan boşluk, çeviri üstte/altta. Oynatıcı kontrolleri açılınca altyazı otomatik yukarı kayar.
- Tam ekranda ve siyah bantlı ekranlarda da doğru konumda kalır.

## Kurulum (Chrome, Edge, Brave, Opera)

Mağazada yayınlandıktan sonra eklenti Chrome Web Mağazası'ndan tek tıkla kurulabilir. Yayın adımları [store/README.md](store/README.md) dosyasında.

Elle kurulum:

1. Tarayıcıda `chrome://extensions` adresini aç (Edge'de `edge://extensions`).
2. Sağ üstten **Geliştirici modu**nu aç.
3. **Paketlenmemiş öğe yükle** düğmesine bas ve bu klasörü (`crunchyroll-cift-altyazi`) seç.
4. Araç çubuğundaki yapboz simgesinden eklentiyi sabitle.
5. Crunchyroll sekmesi zaten açıksa **sayfayı bir kez yenile.**

## Kullanım

1. Crunchyroll'da bir bölüm aç ve oynat. Çift altyazı kendiliğinden gelir. Varsayılan ayar İngilizce altyazı + Google ile Türkçe çeviridir.
   - Merak ettiğin bir kelimenin üzerine fareyle gel: kelime renklenir, anlamı çıkar, çevirideki karşılığı da aynı renge boyanır. Rahat okumak için videoyu duraklatabilirsin; replik değişince renklendirme düşer.
   - **Kelimeye tıklarsan deftere kaydedilir.** Yalnızca üzerinde durduğun kelime tıklanabilir; altyazının geri kalanına tıklamak videoyu eskisi gibi duraklatır. Defteri menüdeki **Kelime defterini aç** düğmesinden görürsün.
2. Eklenti simgesine tıklayınca menü açılır. Üstte her zaman görünen **durum kartı** (bölümdeki altyazı dilleri, çevirinin ilerlemesi, hatalar) ve altında beş sekme vardır; her seferinde yalnızca seçtiğin sekmenin ayarları görünür:
   - **Diller:** Orijinal altyazı dili ve çeviri dili.
   - **Servis:** Google / DeepL / Gemini / Claude arasında geçiş, API anahtarı ve model. **Servisi test et** düğmesi anahtarı dener.
   - **Görünüm:** En üstte küçük bir **canlı örnek** var; renk, punto, arka plan koyuluğu ya da satır sırasını değiştirdiğinde altyazının nasıl görüneceğini anında orada görürsün.
   - **Oynatıcı:** Gömülü altyazıyı kaldırma, oynatıcının kendi altyazısını gizleme, kontroller açılınca yukarı kaydırma.
   - **Defter:** Kelime sözlüğü ve kelime defteri anahtarları, kaç kelime biriktiği ve defteri açma düğmesi.

   Menü en son bıraktığın sekmeyle açılır.
3. Klavye kısayolları:
   - `Alt+Shift+S`: Çift altyazıyı aç / kapat
   - `Alt+Shift+Y`: Çeviri satırını göster / gizle

   Kısayolları `chrome://extensions/shortcuts` sayfasından değiştirebilirsin.

> **Crunchyroll'un kendi altyazı ayarı:** Eklenti açıkken Crunchyroll'da hangi altyazı seçili olursa olsun görüntü temiz gelir, altyazıları eklenti çizer. Eklentiyi kapatıp Crunchyroll'un kendi altyazısına dönmek istersen sayfayı yenile. Bu davranış **Crunchyroll oynatıcısı → Videoya gömülü altyazıyı kaldır** ayarıyla kapatılabilir.

## Çeviri servisleri

| Servis | Anahtar | Kalite | Maliyet (24 dk'lık bölüm) |
|---|---|---|---|
| Google Çeviri | Gerekmez | İyi, satır satır | Ücretsiz |
| DeepL | [DeepL API](https://www.deepl.com/pro-api) (Free ya da Pro) | Çok iyi | Ücretsiz planda ayda ~25–30 bölüm |
| Gemini | [Google AI Studio anahtarı](https://aistudio.google.com/apikey) | Çok iyi, bağlama duyarlı | Ücretsiz katmanda istek sınırıyla |
| Claude | [Anthropic API anahtarı](https://console.anthropic.com/) | En iyi, bağlama duyarlı | Opus 5 ≈ 0,30–0,45 $ · Sonnet 5 ≈ 0,12–0,18 $ · Haiku 4.5 ≈ 0,06 $ |

- Claude'un varsayılan modeli **Claude Opus 5**'tir. Daha ucuzu için menüden Sonnet 5 ya da Haiku 4.5'i seçebilirsin. Maliyetler yaklaşık değerlerdir. Aynı bölüm önbellekten gelir ve tekrar ücretlendirilmez.
- Opus 5 seçiliyken bir istek güvenlik sınıflandırıcısına takılırsa Anthropic sunucusu isteği otomatik olarak yedek modelle tamamlar (`fallbacks: "default"`).
- Gemini bir bölümü 5–6 istekte çevirir, bu yüzden ücretsiz katmanın dakikalık sınırına takılmaz. Hangi modelin ücretsiz katmanda açık olduğu ve güncel sınırlar [AI Studio](https://aistudio.google.com/apikey) hesabında görünür. Google, ücretsiz katmanda gönderilen içeriği ürünlerini geliştirmek için kullanabiliyor; bu seni rahatsız ediyorsa DeepL ya da Claude kullan.
- Claude ve Gemini aynı "çeviri talimatların" kutusunu paylaşır; üslup tercihin servisi değiştirince kaybolmaz.
- API anahtarları yalnızca bu tarayıcının yerel eklenti depolamasında tutulur ve sadece ilgili servise gönderilir.
- DeepL, Anthropic ve Google AI'ya bağlanma izni kurulumda istenmez. Servisi menüden ilk kez seçtiğinde tarayıcı izin sorar. İzin verilmezse Google Çeviri ile devam edilir.

## Nasıl çalışır?

1. Crunchyroll oynatıcısı bölümü açarken `…/playback/v3/<bölüm>/web/<tarayıcı>/play` adresinden bir JSON alır. Bu JSON'da her dildeki altyazı dosyasının adresi (`subtitles`, `captions`) ve gömülü altyazılı video akışları (`hardSubs`) bulunur.
2. `src/page/hook.js` sayfanın kendi dünyasında (MAIN world) çalışır ve bu yanıtı **yeni bir istek atmadan** okur. Aynı anda izleme sınırına takılmamak için Crunchyroll'a ek bir playback isteği gönderilmez. İstenirse gömülü altyazılı akış adresleri temiz akışla değiştirilir.
3. `src/content/content.js`, seçilen dildeki `.ass` / `.vtt` dosyasını indirir ve `subtitles.js` ile çözümler. Diyalog, üst satır ve tabelalar ayrılır, ASS çizim komutları atılır.
4. Çeviri, arka plan servis çalışanında (`src/background/translate.js`) 50–60 satırlık parçalar halinde yapılır. Sonuç bölüm bazında önbelleğe yazılır.
5. `overlay.js`, videonun gerçek görüntü alanının üzerine Shadow DOM içinde iki satırı çizer ve `video.currentTime` ile her karede eşitler.
6. Kelime sözlüğü açıkken satırlar kelime kelime kutulanır. Katman tıklamaları geçirdiği için (`pointer-events: none`) fare konumu elle sınanır; yalnızca üzerinde durulan kelime tıklanabilir hale gelir. Kelimenin karşılıkları, türü ve örnek cümleleri Google'ın sözlük uç noktasından (`dt=bd`, `dt=ex`) alınır, `words.js` bu karşılıkları çeviri satırında kök benzerliğine göre arar.
7. Kaydedilen kelime `chrome.storage.local` içinde tek bir dizide (`vocab`) durur. Örnek cümle seçilirken adaylar çevrilir ve çevirisinde cümledeki anlamı taşımayanlar elenir; hiçbiri tutmazsa örnek yazılmaz.

## Sorun giderme

| Belirti | Çözüm |
|---|---|
| Hiç altyazı çıkmıyor | Sayfayı yenile. Eklenti, bölüm açılırken gelen playback yanıtını yakalamalıdır. Menüdeki durum kartına bak. |
| "Altyazı bilgisi bekleniyor" | Bölüm oynamaya başlamamış olabilir ya da Crunchyroll API'si değişmiş olabilir. Sayfayı yenileyip tekrar dene. |
| Çift altyazı var ama Crunchyroll'un altyazısı da görünüyor | Gömülü altyazı yalnızca bölüm yüklenirken kaldırılır. Sayfayı yenile. Düzelmezse Crunchyroll oynatıcısının altyazı menüsünden **Kapalı**'yı seç. |
| "Çeviri durdu: … anahtarı geçersiz" | Menüde anahtarı düzelt. Çeviri kendiliğinden yeniden başlar, başlamazsa **Yeniden dene**'ye bas. |
| Altyazı kontrol çubuğuyla çakışıyor | **Görünüm → Alttan boşluk** değerini artır. |
| Google "istek sınırı" hatası | Birkaç dakika bekle. Eklenti kendisi tekrar dener. Sık oluyorsa DeepL ya da Claude kullan. |
| Kelimenin üzerine gelince bir şey olmuyor | Sözlük yalnızca çift altyazıda çalışır: orijinal ve çeviri satırı birlikte açık olmalı. **Görünüm → Kelimenin üzerine gelince anlamını göster** işaretli mi bak. |
| Kelime renkleniyor ama çeviride karşılığı renklenmiyor | Çeviri o kelimeyi başka bir yapıyla karşılamış olabilir (deyim, birleşik fiil, düşen özne). Anlamlar yine de balonda görünür. |
| Kelimeye tıklayınca kaydedilmiyor | **Görünüm → Kelimeye tıklayınca kelime defterine kaydet** kapalı olabilir. Ayrıca yalnızca üzerinde durduğun (renklenen) kelime tıklanabilir. |
| Deftere örnek cümle yazılmamış | Google'ın örnek havuzunda o kelime için cümledeki anlamla örtüşen örnek bulunamamıştır. Yanlış anlamlı örnek yazmak yerine boş bırakılır; altyazı satırı zaten kayıtlıdır. |

## Gizlilik

- Altyazı metni **yalnızca seçtiğin çeviri servisine** gönderilir (Google, DeepL ya da Anthropic). Başka bir sunucuya veri gitmez. Ayrıntılar [gizlilik politikasında](store/gizlilik-politikasi.html).
- Crunchyroll oturumuna, çerezlerine ya da hesap bilgilerine dokunulmaz. Altyazı dosyaları, oynatıcının kullandığı adreslerden indirilir.
- Kişisel kullanım içindir. Video indirmez, sadece altyazıları gösterir.

## Geliştirme

```
crunchyroll-cift-altyazi/
├── manifest.json
├── src/
│   ├── page/hook.js            Sayfa dünyası: playback yanıtını okur, hardsub'ı kaldırır
│   ├── content/                İçerik betikleri: çözümleyici, katman, orkestrasyon
│   ├── background/             Servis çalışanı: çeviri servisleri, sözlük, önbellek, durum
│   │   └── vendor/             Paketlenmiş Anthropic SDK (tek dosya)
│   ├── popup/                  Eklenti menüsü
│   ├── notebook/               Kelime defteri sayfası
│   └── shared/                 Dil kodları, ayarlar, kelime eşleştirme, defter kayıtları
├── store/                      Mağaza yayın rehberi, gizlilik politikası, görseller
├── tests/                      node --test testleri ve örnek altyazılar
├── test-page/                  Tarayıcıda uçtan uca deneme sayfası, mağaza görseli sayfaları
├── tools/                      Paketleme betiği, SDK paketleme girişi, simge üretici
└── dist/                       npm run package çıktısı (git'e girmez)
```

- **Testler:** `npm test` (Node 20+). Çözümleyiciler, kanca, çeviri servisleri, kelime eşleştirme, defter kayıtları, arka plan ve paketleme için 46 test var.
- **Paket:** `npm run package` komutu `dist/` altına mağaza paketini ve elle kurulum paketini (içinde `KURULUM.txt`) üretir.
- **Deneme sayfası:** Klasörü bir HTTP sunucusuyla aç (`npx http-server crunchyroll-cift-altyazi -p 5612`) ve `http://localhost:5612/test-page/index.html` adresine git. Gerçek betikler sahte bir Bitmovin oynatıcısında ve sahte `chrome` API'siyle çalışır. `test-page/popup-preview.html` menünün, `test-page/notebook-preview.html` (`?s=empty` ile boş hali) kelime defterinin tasarımını gösterir. Mağaza görselleri `index.html?shot` ve `store-shot.html?view=popup|services|tile|marquee` sayfalarının 1280×800 (tanıtım kutuları için 440×280 ve 1400×560) ekran görüntüleridir. Opera mağazası 612×408 ve beyaz zemin istediği için onun görselleri ayrı bir sayfadan alınır: `opera-shot.html?view=altyazi|tabela|menu|servisler`.
- **Anthropic SDK'sını güncellemek:** `npm install` sonra `npm run vendor`.
- **Simgeler:** `powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1`

## Sınırlamalar

- Crunchyroll web oynatıcısını ve API'sini sık değiştirir. Eklenti yanıtı genel bir yöntemle tarar (her derinlikte `subtitles` / `captions` arar), yine de büyük bir değişiklikte güncelleme gerekebilir.
- Yalnızca Chromium tabanlı tarayıcılarda (Chrome 111+, Edge, Brave, Opera) çalışır. Firefox desteklenmez.
- Makine çevirisi hata yapabilir. Anime argosu ve kelime oyunlarında en iyi sonucu Claude verir.
- Kelimenin türü ve "cümlede kullanılan anlam", ücretsiz sözlük verisinden çıkarılan tahminlerdir. Karşılık çeviri satırında kök benzerliğiyle aranır; "meteor shower" gibi birleşik kullanımlarda tür yanlış (isim yerine fiil) çıkabilir. Deftere yazılan altyazı satırı ve çevirisi ise her zaman doğrudur.
