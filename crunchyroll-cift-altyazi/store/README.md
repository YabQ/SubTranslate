# Chrome Web Mağazası'nda yayınlama rehberi

Bu klasör, eklentiyi Chrome Web Mağazası'na yüklerken gereken her şeyi içerir. Formlardaki metinleri buradan kopyalayıp yapıştırabilirsin.

| Dosya | Ne işe yarar |
|---|---|
| `../dist/crunchyroll-cift-altyazi-<sürüm>-magaza.zip` | Mağazaya yüklenecek paket (`npm run package` ile üretilir) |
| `gizlilik-politikasi.html` | Gizlilik politikası sayfası. Herkese açık bir adrese yüklenmeli |
| `gorseller/magaza-simgesi-128.png` | Mağaza simgesi (128×128) |
| `gorseller/1-…png` – `4-…png` | Ekran görüntüleri (1280×800) |
| `gorseller/kucuk-tanitim-440x280.png` | Küçük tanıtım kutusu |
| `gorseller/buyuk-afis-1400x560.png` | Büyük afiş (isteğe bağlı) |
| `gorseller/opera/*-612x408.png` | Opera mağazası için ekran görüntüleri (beyaz zemin) |
| `gorseller/opera/tanitim-300x188.png` | Opera tanıtım görseli |

## 1. Senin yapman gerekenler

1. **Geliştirici hesabı aç:** [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) adresinde Google hesabınla giriş yap. Hesap bir kerelik **5 $** kayıt ücreti ister ve Google hesabında **2 adımlı doğrulama** açık olmalıdır.
2. **Gizlilik politikasını yayınla:** Önce `gizlilik-politikasi.html` içindeki `ILETISIM-EPOSTASI` yazan iki yeri kendi iletişim e-postanla değiştir. Sonra dosyayı herkese açık bir adrese koy:
   - Kendi web siten varsa oraya yükle.
   - Ya da ücretsiz **GitHub Pages** kullan: herkese açık bir depo aç, dosyayı `index.html` adıyla yükle, *Settings → Pages* bölümünden yayını aç.

   Çıkan adres (ör. `https://kullaniciadin.github.io/cift-altyazi/`) formda istenecek.

## 2. Paketi hazırla

Eklenti klasöründe şu komutu çalıştır:

```bash
npm run package
```

Komut `dist/` klasörüne iki dosya üretir:
- `crunchyroll-cift-altyazi-<sürüm>-magaza.zip`: mağazaya bunu yükle.
- `crunchyroll-cift-altyazi-<sürüm>.zip`: arkadaşlarına elle kurulum için. İçinde `KURULUM.txt` var.

## 3. Yükleme

Kontrol panelinde **Yeni öğe** düğmesine bas ve `…-magaza.zip` dosyasını seç. Ardından aşağıdaki sekmeleri doldur.

### Mağaza girişi (Store listing)

- **Başlık ve özet:** paketten otomatik gelir ("Crunchyroll için Çift Altyazı").
- **Kategori:** Eğlence
- **Dil:** Türkçe
- **Görseller:** simge, 4 ekran görüntüsü ve küçük tanıtım kutusunu `gorseller/` klasöründen yükle. Büyük afiş isteğe bağlıdır.
- **Açıklama:** aşağıdaki metni olduğu gibi yapıştır.

```
Crunchyroll'da Türkçe altyazı mı yok? Bu eklenti, izlediğin bölümün orijinal altyazısını (ör. İngilizce) ve Türkçe çevirisini aynı anda, iki satır halinde videonun üzerinde gösterir.

NASIL ÇALIŞIR
• Bölümü açtığında eklenti, Crunchyroll oynatıcısının yüklediği altyazıyı alır ve seçtiğin dile çevirir.
• Crunchyroll'da o dilde resmi altyazı varsa çeviri yerine onu gösterir.
• İki satır da videonun görüntü alanında durur, tam ekranda da görünür.

ÖZELLİKLER
• Çeviri servisi seçimi: Google Çeviri (ücretsiz, varsayılan), DeepL, Gemini veya Claude (kendi API anahtarınla).
• İki satıra bölünmüş cümleler bütün olarak çevrilir, çeviri daha doğal olur.
• Merak ettiğin kelimenin üzerine fareyle gel: kelime renklenir, iki Türkçe anlamı çıkar ve çeviri satırında o kelimeyi karşılayan sözcük de aynı renge boyanır.
• Çeviri önce izlediğin yerden başlar, ileri sardığında sıra oraya kayar.
• Çevrilen bölümler tarayıcında saklanır, aynı bölüm tekrar çevrilmez.
• Tabela ve ekran yazıları da çevrilir.
• Yazı boyutu, renkler, arka plan koyuluğu ve konum ayarlanabilir.
• Klavye kısayolları: Alt+Shift+S (aç/kapat), Alt+Shift+Y (çeviri satırı).
• Altyazılar üst üste binmesin diye, Crunchyroll'un videoya gömdüğü altyazı yerine altyazı kapalıyken gelen görüntü kullanılır (ayarlardan kapatılabilir).

GİZLİLİK
• Veri toplanmaz. Reklam, analiz ya da izleme kodu yoktur.
• Altyazı metni yalnızca seçtiğin çeviri servisine gönderilir.
• API anahtarların yalnızca tarayıcında saklanır.
• Crunchyroll hesabına, çerezlerine ve izleme geçmişine erişilmez.

NOTLAR
• Bölümü Crunchyroll'da izleme hakkın olmalıdır. Eklenti video indirmez, yalnızca altyazıları gösterir.
• Chrome ve Chromium tabanlı tarayıcılarda (Edge, Brave, Opera) çalışır.

Bu eklenti Crunchyroll ile bağlantılı değildir ve Crunchyroll tarafından onaylanmamıştır. Crunchyroll, Crunchyroll, LLC'nin ticari markasıdır.
```

### Gizlilik uygulamaları (Privacy practices)

İnceleme ekibi İngilizce metinleri daha hızlı değerlendirir. Bu yüzden gerekçeler İngilizce.

**Tek amaç (Single purpose):**

```
Shows the original Crunchyroll subtitle and its translation into a language the user chooses at the same time, as two lines over the Crunchyroll video player.
```

**storage izni gerekçesi:**

```
Saves the user's settings (languages, translation service, appearance), the optional DeepL/Anthropic API keys the user enters, and a local cache of finished translations so that an episode is not translated twice. Nothing is sent to the developer.
```

**Host izni gerekçesi (Host permission justification):**

```
https://*.crunchyroll.com/* — the content scripts run on Crunchyroll watch pages. They read the subtitle list that the Crunchyroll player itself loads, download the selected subtitle file and draw the original and translated lines over the video.
https://translate.googleapis.com/* — the default translation service. The background service worker sends the subtitle lines to Google Translate to translate them into the language the user chose.
Optional host permissions (requested at runtime only when the user selects that service in the popup): https://api-free.deepl.com/* and https://api.deepl.com/* for DeepL, https://generativelanguage.googleapis.com/* for Gemini, https://api.anthropic.com/* for Claude. They are called with the user's own API key.
```

**Uzaktan kod (Remote code):** "No, I am not using remote code" seçeneğini işaretle. Gerekçe istenirse:

```
All JavaScript, including the bundled open-source Anthropic SDK (MIT license), is included in the package. No code is downloaded or evaluated at runtime.
```

**Veri kullanımı (Data usage).** Yalnızca şu iki kutuyu işaretle:
- **Website content:** izlenen videonun altyazı metni, kullanıcının seçtiği çeviri servisine gönderilir.
- **Authentication information:** kullanıcının girdiği DeepL / Google AI / Anthropic API anahtarı. Yalnızca tarayıcıda saklanır ve yalnızca o servise gönderilir.

Alttaki üç beyanın (veriler satılmaz, amaç dışı kullanılmaz, kredi değerlendirmesinde kullanılmaz) hepsini işaretle.

**Gizlilik politikası URL'si:** 1. adımda yayınladığın adres.

### Test talimatları (Test instructions)

**Kimlik bilgisi (kullanıcı adı / şifre) alanlarını boş bırak.** Kendi Crunchyroll hesabının bilgilerini kimseye verme; inceleme ekibi ücretsiz hesap açıp reklamlı bölümlerle deneyebiliyor. Gerekirse bu iş için ayrı bir hesap açılır, kişisel hesap paylaşılmaz.

**Ek talimatlar alanı en fazla 500 karakter.** Sığan hali (498 karakter):

```
Open https://www.crunchyroll.com and play any episode (a Crunchyroll account with access to it is required). Within a few seconds the English subtitle (white) and its Turkish translation (yellow) appear over the video. No API key is needed: the default service is Google Translate. Hover a word in the white line: it is highlighted, two meanings appear above it, and the word carrying it in the yellow line is highlighted too. The toolbar icon opens the settings; Alt+Shift+S toggles the subtitles.
```

Sınır olmayan bir alana (ör. Opera) uzun hali yazılabilir:

```
1. Open https://www.crunchyroll.com and play any episode (a Crunchyroll account with access to the episode is required).
2. Within a few seconds the original English subtitle (white) and its Turkish translation (yellow) appear over the video. No API key is needed: the default translation service is Google Translate.
3. Click the toolbar icon to see the status card and to change the languages, the translation service or the appearance. Alt+Shift+S toggles the subtitles.
DeepL, Gemini and Claude are optional, need the user's own API key, and the browser asks for permission to reach them only when they are selected.
```

İstersen buraya bir test hesabı da ekleyebilirsin. Kişisel hesabını değil, bunun için ayrıca açtığın bir hesabı kullan.

### Dağıtım (Distribution)

- **Ücret:** Ücretsiz
- **Görünürlük:**
  - *Herkese açık:* mağazada aranıp bulunur.
  - *Liste dışı (Unlisted):* yalnızca bağlantıyı bilen kurabilir. Arkadaşlarınla paylaşmak için yeterli, yine de incelemeden geçer.
- **Bölgeler:** Tüm bölgeler ya da yalnızca Türkiye.

Son olarak **İncelemeye gönder** düğmesine bas. İnceleme genellikle birkaç gün sürer. Yeni hesaplarda daha uzun sürebilir.

## 4. Güncelleme yayınlamak

1. `manifest.json` içindeki `version` değerini artır (ör. `1.0.1`). Mağaza aynı sürümü ikinci kez kabul etmez.
2. `npm run package` komutunu çalıştır.
3. Kontrol panelinde **Paket → Yeni paket yükle** ile yeni `…-magaza.zip` dosyasını yükle ve incelemeye gönder.

## Reddedilme riskleri ve alınan önlemler

| Risk | Önlem |
|---|---|
| Ticari marka / resmi ürün izlenimi | Ad "Crunchyroll **için** Çift Altyazı". Simgede Crunchyroll logosu yok. Açıklama ve gizlilik politikasında "bağlantılı değildir" notu var. |
| Gereğinden fazla izin | Zorunlu izinler yalnızca crunchyroll.com ve Google Çeviri. DeepL ve Anthropic isteğe bağlı; kullanıcı seçince isteniyor. |
| İnceleme ekibinin Crunchyroll hesabı olmayabilir | Test talimatları eklendi. Reddedilirse yanıtta ekran kaydı videosu göndermek işe yarar. |
| Google Çeviri'nin resmî olmayan ücretsiz uç noktası | Yaygın kullanılıyor ama Google'ın resmî API'si değil. Sorun çıkarsa varsayılan servis değiştirilebilir ya da resmî Google Cloud Translation API (anahtarlı) eklenebilir. |
| Sayfa davranışını değiştirme | Gömülü altyazının kaldırılması açıklamada yazılı ve ayarlardan kapatılabiliyor. Ödeme duvarı ya da DRM atlatılmıyor; kullanıcı zaten izleme hakkı olan bölümü izliyor. |

## Diğer mağazalar

Aynı `…-magaza.zip` dosyası Opera ve Edge mağazalarına da yüklenebilir; ikisinde de kayıt ücreti yoktur.

### Opera Eklentileri

1. [addons.opera.com/developer](https://addons.opera.com/developer/) adresinde hesap aç, **Upload** ile `dist/crunchyroll-cift-altyazi-<sürüm>-magaza.zip` dosyasını yükle.
2. **General** sekmesi:
   - **Category:** Entertainment. Listede yoksa Fun.
   - **I want my extension to be available for auto-publishing:** işaretle. Otomatik analizden geçerse elle inceleme kuyruğunu beklemeden yayınlanır.
   - **Hide the add-on from search results:** yalnızca bağlantıyı bilenlere dağıtmak istiyorsan işaretle. Chrome'daki "Liste dışı"nın karşılığı.
3. **Promotional Image** sekmesi: `gorseller/opera/tanitim-300x188.png`. İsteğe bağlı ama Opera editörleri eklentiyi öne çıkarmaya karar verirse bu görseli kullanıyor.
4. **Versions → sürüm** sayfasındaki alanlar:
   - **Ekran görüntüleri:** `gorseller/opera/` klasöründeki dört görsel. Opera **612×408** (en fazla 800×600) ve **beyaz zemin** istiyor; 1280×800'lük Chrome görselleri kabul edilmez.
   - **Özet ve açıklama:** Chrome'daki metinlerin aynısı.
   - **Service website URL:** boş bırak. Bu alan, eklentinin bağlandığı servisin sahibi olanlar içindir; buraya `crunchyroll.com` yazmak "eklentiyi Crunchyroll yapıyor" izlenimi verir ve marka gerekçesiyle reddedilir.
   - **Extension support page URL:** deponun Issues sayfası ya da gizlilik politikası adresi. Boş bırakılırsa reddedilebiliyor.
   - **Extension source code URL (public / for Opera moderators):** **zorunlu.** Pakette küçültülmüş tek dosya var (`src/background/vendor/anthropic-sdk.mjs`, esbuild `--minify` çıktısı) ve Opera, kod küçültülmüş ya da birleştirilmişse kaynak bağlantısı istiyor. Herkese açık depo adresini iki alana da yaz.
   - **Build instructions:** aşağıdaki metin.
   - **License URL / Full license text:** boş bırakılırsa standart telif hakkı geçerli olur. Depoda bir LICENSE dosyası varsa adresini ver ya da metni buraya yapıştır.
   - **Privacy policy URL:** yayınladığın gizlilik politikası adresi. URL verilince "Full privacy policy text" alanını doldurmak gerekmiyor.
5. İnceleme elle yapılıyor, genelde 1–2 hafta sürüyor.

**Build instructions** alanına yapıştırılacak metin (her yeni sürümde kaynak bağlantısı o sürüme karşılık gelmeli):

```
Only one file in the package is minified: src/background/vendor/anthropic-sdk.mjs.
It is the official open-source Anthropic SDK (MIT licence, version 0.127.0), bundled
with esbuild. Its licence text is kept at the end of that file and in
src/background/vendor/anthropic-sdk.LICENSE.txt. Every other file is hand-written
and shipped unmodified.

Requirements: Node.js 20 or newer, npm.

1. Download the source from the link above.
2. cd crunchyroll-cift-altyazi
3. npm install
   (installs @anthropic-ai/sdk 0.127.0 and esbuild 0.28.2 as dev dependencies)
4. npm run vendor
   Rebuilds the bundled file with exactly this command:
   esbuild tools/anthropic-entry.js --bundle --format=esm --platform=browser
     --target=chrome111 --minify --legal-comments=eof
     --outfile=src/background/vendor/anthropic-sdk.mjs
   tools/anthropic-entry.js only re-exports the SDK client used by the extension.
5. npm test
   Runs 34 unit tests for the subtitle parsers, the player hook, the translation
   services and the packaging script.
6. npm run package
   Writes the store package in dist/, which is the archive
   uploaded to the store.
```

Opera kullanıcıları, eklenti Chrome Web Mağazası'nda yayınlandıktan sonra onu [Install Chrome Extensions](https://addons.opera.com/en/extensions/details/install-chrome-extensions/) eklentisiyle de kurabiliyor. Opera mağazası şart değil, yalnızca mağazada aranınca bulunmak için gerekiyor.

Opera 136'da denendi: paket MV3 olarak yükleniyor, kurulum izinleri yalnızca `crunchyroll.com` + `translate.googleapis.com` + `storage` olarak görünüyor ve MAIN dünyasındaki kanca crunchyroll.com'da `fetch` ile `XMLHttpRequest`'i sarıyor.

**İngilizce liste metni.** Opera'da liste dili sekmesi **English (en)** geliyor ve paketteki Türkçe özet oraya düşüyor; İngilizce sekmesine İngilizce metin yazılmalı. Dil eklenemiyor: Opera liste dillerini paketteki `_locales` klasöründen alıyor, bizim pakette `_locales` yok. Türkçe kullanıcılar için, İngilizce açıklamanın sonuna kısa bir Türkçe paragraf eklemek yeterli. Gerçek bir Türkçe liste istenirse eklentiye `default_locale` + `_locales/en` + `_locales/tr` eklenip yeni sürüm yüklenmeli (aynısı Chrome tarafı için de geçerli).

Summary:

```
Shows the original Crunchyroll subtitle and its translation into the language you choose at the same time.
```

Description:

```
Crunchyroll does not offer subtitles in every language. This extension shows the original subtitle of the episode you are watching (English, for example) together with its translation into the language you choose, as two lines over the video.

HOW IT WORKS
• When you open an episode, the extension reads the subtitle that the Crunchyroll player itself loads and translates it into the language you picked.
• If Crunchyroll already has an official subtitle in that language, it shows that one instead of a machine translation.
• Both lines stay inside the picture area of the video and remain visible in fullscreen.

FEATURES
• Pick your translation service: Google Translate (free, used by default), DeepL, Gemini or Claude with your own API key.
• Sentences split across two subtitle lines are translated as one, so the result reads naturally.
• Hover a word in the original line to colour it, see two meanings of it and see which word in the translated line carries it.
• Translation starts at the point you are watching and follows you when you skip ahead.
• Translated episodes are kept in your browser, so the same episode is never translated twice.
• Signs and on-screen text are translated as well, in a smaller size at the top.
• Font size, colours, background opacity and position are adjustable.
• Keyboard shortcuts: Alt+Shift+S turns the subtitles on and off, Alt+Shift+Y hides the translation line.
• So the lines do not overlap the subtitles burned into the video, the extension uses the stream Crunchyroll serves with subtitles turned off. This can be switched off in the settings.

PRIVACY
• No data is collected. There is no advertising, analytics or tracking code.
• Subtitle text is sent only to the translation service you select.
• Your API keys are stored only in your browser.
• Your Crunchyroll account, cookies and watch history are never accessed.

NOTES
• You need the right to watch the episode on Crunchyroll. The extension does not download video, it only draws subtitles.
• Works in Opera and other Chromium-based browsers.

This extension is not affiliated with or endorsed by Crunchyroll. Crunchyroll is a trademark of Crunchyroll, LLC.
```

Açıklamanın sonuna eklenecek Türkçe paragraf:

```
TÜRKÇE
Crunchyroll'da Türkçe altyazı yoksa bu eklenti bölümün İngilizce altyazısını alır ve Türkçe çevirisiyle birlikte, iki satır halinde videonun üzerinde gösterir. Çeviri servisi olarak ücretsiz Google Çeviri, ya da kendi API anahtarınla DeepL veya Claude kullanılabilir. Eklentinin menüsü Türkçedir.
```

Changelog:

```
1.0.2
Click a word to keep it in a word notebook with its part of speech, the
meaning it carries in that line, the subtitle sentence and the episode it
came from. New translation service: Gemini, which has a free tier and,
unlike Google Translate, reads the surrounding lines.

1.0.1
Hover a word in the original subtitle to see two meanings of it. The word
and the word that carries it in the translated line are highlighted in the
same colour. It can be switched off, and its colour changed, in the popup.

1.0.0
First release.
```

### Microsoft Edge Eklentileri

[Partner Center](https://partner.microsoft.com/dashboard/microsoftedge) üzerinden aynı paket yüklenir. Görseller Chrome'dakiyle aynı ölçülerde kabul edilir.
