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
  - **Claude (Anthropic):** Kendi API anahtarınla. Sahneyi ve önceki satırları dikkate alır, kaliteyi en çok o yükseltir. İstediğin üslubu yazabilirsin ("samimi konuş", "onur eklerini çevirme" gibi).
- **Bölünmüş cümleler:** İki satıra bölünmüş cümleler ("I don't know if" / "he will come back.") bütün olarak çevrilir.
- **Temiz görüntü:** Crunchyroll'un videoya gömdüğü (hardsub) altyazıyı kaldırır, böylece altyazılar üst üste binmez.
- **Tabela ve ekran yazıları** (bölüm başlığı, telefon mesajı vb.) çevirileriyle birlikte ekranın üstünde, küçük puntoyla gösterilir.
- **Önce izlediğin yer çevrilir.** Bölümün kalanı arka planda çevrilir, ileri sardığında sıra oraya kayar.
- **Önbellek:** Çevrilen bölüm saklanır, tekrar izlerken çeviri isteği gitmez ve ücret ödenmez.
- **Görünüm ayarları:** Yazı boyutu, çeviri boyutu, renkler, arka plan koyuluğu, alttan boşluk, çeviri üstte/altta. Oynatıcı kontrolleri açılınca altyazı otomatik yukarı kayar.
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
2. Eklenti simgesine tıklayınca menü açılır:
   - **Durum kartı:** Bölümde bulunan altyazı dilleri, çevirinin ilerlemesi ve hatalar burada görünür.
   - **Diller:** Orijinal altyazı dilini ve çeviri dilini seç.
   - **Çeviri servisi:** Google / DeepL / Claude arasında geçiş yap. **Servisi test et** düğmesi API anahtarını dener.
   - **Görünüm** ve **Crunchyroll oynatıcısı** bölümlerinde ince ayarlar var.
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
| Claude | [Anthropic API anahtarı](https://console.anthropic.com/) | En iyi, bağlama duyarlı | Opus 5 ≈ 0,30–0,45 $ · Sonnet 5 ≈ 0,12–0,18 $ · Haiku 4.5 ≈ 0,06 $ |

- Claude'un varsayılan modeli **Claude Opus 5**'tir. Daha ucuzu için menüden Sonnet 5 ya da Haiku 4.5'i seçebilirsin. Maliyetler yaklaşık değerlerdir. Aynı bölüm önbellekten gelir ve tekrar ücretlendirilmez.
- Opus 5 seçiliyken bir istek güvenlik sınıflandırıcısına takılırsa Anthropic sunucusu isteği otomatik olarak yedek modelle tamamlar (`fallbacks: "default"`).
- API anahtarları yalnızca bu tarayıcının yerel eklenti depolamasında tutulur ve sadece ilgili servise gönderilir.
- DeepL ve Anthropic'e bağlanma izni kurulumda istenmez. Servisi menüden ilk kez seçtiğinde tarayıcı izin sorar. İzin verilmezse Google ile devam edilir.

## Nasıl çalışır?

1. Crunchyroll oynatıcısı bölümü açarken `…/playback/v3/<bölüm>/web/<tarayıcı>/play` adresinden bir JSON alır. Bu JSON'da her dildeki altyazı dosyasının adresi (`subtitles`, `captions`) ve gömülü altyazılı video akışları (`hardSubs`) bulunur.
2. `src/page/hook.js` sayfanın kendi dünyasında (MAIN world) çalışır ve bu yanıtı **yeni bir istek atmadan** okur. Aynı anda izleme sınırına takılmamak için Crunchyroll'a ek bir playback isteği gönderilmez. İstenirse gömülü altyazılı akış adresleri temiz akışla değiştirilir.
3. `src/content/content.js`, seçilen dildeki `.ass` / `.vtt` dosyasını indirir ve `subtitles.js` ile çözümler. Diyalog, üst satır ve tabelalar ayrılır, ASS çizim komutları atılır.
4. Çeviri, arka plan servis çalışanında (`src/background/translate.js`) 50–60 satırlık parçalar halinde yapılır. Sonuç bölüm bazında önbelleğe yazılır.
5. `overlay.js`, videonun gerçek görüntü alanının üzerine Shadow DOM içinde iki satırı çizer ve `video.currentTime` ile her karede eşitler.

## Sorun giderme

| Belirti | Çözüm |
|---|---|
| Hiç altyazı çıkmıyor | Sayfayı yenile. Eklenti, bölüm açılırken gelen playback yanıtını yakalamalıdır. Menüdeki durum kartına bak. |
| "Altyazı bilgisi bekleniyor" | Bölüm oynamaya başlamamış olabilir ya da Crunchyroll API'si değişmiş olabilir. Sayfayı yenileyip tekrar dene. |
| Çift altyazı var ama Crunchyroll'un altyazısı da görünüyor | Gömülü altyazı yalnızca bölüm yüklenirken kaldırılır. Sayfayı yenile. Düzelmezse Crunchyroll oynatıcısının altyazı menüsünden **Kapalı**'yı seç. |
| "Çeviri durdu: … anahtarı geçersiz" | Menüde anahtarı düzelt. Çeviri kendiliğinden yeniden başlar, başlamazsa **Yeniden dene**'ye bas. |
| Altyazı kontrol çubuğuyla çakışıyor | **Görünüm → Alttan boşluk** değerini artır. |
| Google "istek sınırı" hatası | Birkaç dakika bekle. Eklenti kendisi tekrar dener. Sık oluyorsa DeepL ya da Claude kullan. |

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
│   ├── background/             Servis çalışanı: çeviri servisleri, önbellek, durum
│   │   └── vendor/             Paketlenmiş Anthropic SDK (tek dosya)
│   ├── popup/                  Eklenti menüsü
│   └── shared/                 Dil kodları ve ayarlar
├── store/                      Mağaza yayın rehberi, gizlilik politikası, görseller
├── tests/                      node --test testleri ve örnek altyazılar
├── test-page/                  Tarayıcıda uçtan uca deneme sayfası, mağaza görseli sayfaları
├── tools/                      Paketleme betiği, SDK paketleme girişi, simge üretici
└── dist/                       npm run package çıktısı (git'e girmez)
```

- **Testler:** `npm test` (Node 20+). Çözümleyiciler, kanca, çeviri servisleri, arka plan ve paketleme için 34 test var.
- **Paket:** `npm run package` komutu `dist/` altına mağaza paketini ve elle kurulum paketini (içinde `KURULUM.txt`) üretir.
- **Deneme sayfası:** Klasörü bir HTTP sunucusuyla aç (`npx http-server crunchyroll-cift-altyazi -p 5612`) ve `http://localhost:5612/test-page/index.html` adresine git. Gerçek betikler sahte bir Bitmovin oynatıcısında ve sahte `chrome` API'siyle çalışır. `test-page/popup-preview.html` menünün tasarımını gösterir. Mağaza görselleri `index.html?shot` ve `store-shot.html?view=popup|services|tile|marquee` sayfalarının 1280×800 (tanıtım kutuları için 440×280 ve 1400×560) ekran görüntüleridir. Opera mağazası 612×408 ve beyaz zemin istediği için onun görselleri ayrı bir sayfadan alınır: `opera-shot.html?view=altyazi|tabela|menu|servisler`.
- **Anthropic SDK'sını güncellemek:** `npm install` sonra `npm run vendor`.
- **Simgeler:** `powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1`

## Sınırlamalar

- Crunchyroll web oynatıcısını ve API'sini sık değiştirir. Eklenti yanıtı genel bir yöntemle tarar (her derinlikte `subtitles` / `captions` arar), yine de büyük bir değişiklikte güncelleme gerekebilir.
- Yalnızca Chromium tabanlı tarayıcılarda (Chrome 111+, Edge, Brave, Opera) çalışır. Firefox desteklenmez.
- Makine çevirisi hata yapabilir. Anime argosu ve kelime oyunlarında en iyi sonucu Claude verir.
