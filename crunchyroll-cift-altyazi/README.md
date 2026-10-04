# Dual Subtitles for Crunchyroll

A Chrome extension that shows **the original subtitle (English, say) and its translation into the language you pick (Turkish, say) at the same time** while you watch an episode on Crunchyroll.

When Crunchyroll has no subtitle in your language, the extension translates the English one and draws both as two lines. When Crunchyroll does have an official subtitle in that language (Spanish, for instance), it shows that one instead of a machine translation.

```
   Geri gelip gelmeyeceğini bilmiyorum.     ← translation (yellow)
            I don't know if                 ← original (white)
```

## Features

- **Two subtitle lines:** original + translation, or only one of them.
- **Four translation services:**
  - **Google Translate:** free, no key, used by default.
  - **DeepL:** with your own API key. 500,000 characters a month on the free plan.
  - **Gemini:** with your own API key. Google AI Studio's free tier is enough; the only free option that reads the scene and the previous lines.
  - **Claude (Anthropic):** with your own API key. Reads the scene and the previous lines and raises the quality the most. You can describe the tone you want ("keep it casual", "leave the honorifics alone").
- **Word lookup:** with dual subtitles on, hovering a word colours it, shows two meanings in a small bubble and colours the word that carries it in the translated line. Matching survives suffixes and consonant softening, which Turkish needs ("catch" → "yakalamak" → "yakalayabiliriz" in the line).
- **The translation does not stop halfway:** if a DeepL, Gemini or Claude key is invalid or its quota runs out, the remaining lines are finished with Google Translate. The status card says "Gemini → Google Translate (backup)". An episode that fell back is not cached, so fixing the key and watching again gives you the service you chose.
- **TV mode:** one button in the Look tab sets the font size, backdrop opacity and bottom offset for watching from across a room. The "Desktop" button puts them back.
- **Word notebook:** clicking a word files it. The notebook keeps the word's part of speech (verb / noun / adjective), the meaning it carries in that line plus one alternative, the subtitle line with its translation, an example sentence in the same sense, and which episode of which show it came from. Filing the same word again raises a counter instead of adding a row. Nothing is ever removed on its own. The notebook exports as an **Anki deck**, CSV or JSON; the Anki file is ready to import (word and its sentence on the front, meaning, part of speech, translation and example on the back).
- **Split sentences:** a sentence broken across two lines ("I don't know if" / "he will come back.") is translated as one.
- **A clean picture:** the subtitle Crunchyroll burns into the video (hardsub) is removed, so the lines do not overlap.
- **Signs and on-screen text** (episode titles, phone messages and so on) are translated too, at the top in a smaller size.
- **Where you are watching is translated first.** The rest of the episode is translated in the background, and skipping ahead moves the queue with you.
- **Cache:** a translated episode is kept, so watching it again sends no requests and costs nothing.
- **Appearance:** text size, translation size, colours (original, translation, word), backdrop opacity, bottom offset, translation above or below. The subtitle lifts itself when the player controls appear.
- Stays in the right place in fullscreen and on letterboxed video.

## Languages

The interface opens in the browser's language: English in an English Chrome, Turkish in a Turkish one. It can also be set by hand from **Languages → Menu language** in the popup, and the choice applies at once. The strings live in `_locales/en` and `_locales/tr`; adding a language is a matter of copying that folder and translating it.

On a fresh install the target language is taken from the browser as well (German in a German browser), and can be changed afterwards.

## Install (Chrome, Edge, Brave, Opera)

Once it is published, the extension installs from the Chrome Web Store in one click. The publishing steps are in [store/README.md](store/README.md).

By hand:

1. Open `chrome://extensions` (`edge://extensions` in Edge).
2. Turn on **Developer mode** in the top right.
3. Press **Load unpacked** and pick this folder (`crunchyroll-cift-altyazi`).
4. Pin the extension from the puzzle icon in the toolbar.
5. If a Crunchyroll tab is already open, **reload it once.**

## Using it

1. Open an episode on Crunchyroll and play it. The dual subtitles appear on their own. Out of the box that is the English subtitle plus a translation through Google Translate.
   - Hover a word you are curious about: it is coloured, its meaning appears, and its counterpart in the translation is coloured as well. Pausing makes it easier to read; the colouring drops when the line changes.
   - **Clicking the word files it in the notebook.** Only the word you are hovering is clickable; clicking anywhere else on the subtitle still pauses the video. The notebook opens from **Open the word notebook** in the popup.
2. Clicking the toolbar icon opens the menu. A **status card** stays at the top (the subtitle languages in this episode, the translation's progress, errors) and five tabs sit below it; only the chosen tab's settings are on screen:
   - **Languages:** the original subtitle language and the target language.
   - **Service:** switch between Google / DeepL / Gemini / Claude, the API key and the model. **Test the service** tries the key.
   - **Look:** a small **live sample** sits at the top; changing a colour, a size, the backdrop opacity or the line order shows what the subtitle will look like straight away.
   - **Player:** removing the burned-in subtitle, hiding the player's own subtitle layer, lifting the lines when the controls appear.
   - **Notebook:** the word lookup and notebook switches, how many words are filed, and the button that opens the notebook.

   The menu reopens on the tab you left it on. The menu and the notebook page follow Crunchyroll's own look: square corners, orange accents, an underlined tab bar.
3. Keyboard shortcuts:
   - `Alt+Shift+S`: turn the dual subtitles on or off
   - `Alt+Shift+Y`: show or hide the translation line

   They can be changed at `chrome://extensions/shortcuts`.

> **Crunchyroll's own subtitle setting:** while the extension is on, the picture arrives clean whatever is selected in Crunchyroll, and the extension draws the subtitles. To turn the extension off and go back to Crunchyroll's own subtitle, reload the page. This behaviour can be switched off with **Player → Remove the subtitle burned into the video**.

## Translation services

| Service | Key | Quality | Cost (24-minute episode) |
|---|---|---|---|
| Google Translate | Not needed | Good, line by line | Free |
| DeepL | [DeepL API](https://www.deepl.com/pro-api) (Free or Pro) | Very good | ~25–30 episodes a month on the free plan |
| Gemini | [Google AI Studio key](https://aistudio.google.com/apikey) | Very good, reads context | Free tier, with request limits |
| Claude | [Anthropic API key](https://console.anthropic.com/) | Best, reads context | Opus 5 ≈ $0.30–0.45 · Sonnet 5 ≈ $0.12–0.18 · Haiku 4.5 ≈ $0.06 |

- Claude's default model is **Claude Opus 5**. For something cheaper, pick Sonnet 5 or Haiku 4.5 in the menu. The costs are rough. The same episode comes from the cache and is never charged twice.
- With Opus 5, if a request trips the safety classifier, Anthropic's server finishes it with a fallback model (`fallbacks: "default"`).
- Gemini translates an episode in 5–6 requests, so it does not hit the free tier's per-minute limit. Which model your key may use, and the current limits, are shown in your [AI Studio](https://aistudio.google.com/apikey) account. Google may use content submitted on the free tier to improve its products; if that bothers you, use DeepL or Claude.
- Claude and Gemini share the same "your translation notes" box, so your preference survives switching between them.
- API keys are kept only in this browser's extension storage and sent only to that service.
- Permission to reach DeepL, Anthropic and Google AI is not requested at install time. The browser asks the first time you select the service in the menu. If it is refused, Google Translate carries on.

## How it works

1. When the Crunchyroll player opens an episode it fetches a JSON from `…/playback/v3/<episode>/web/<browser>/play`. That JSON holds the address of the subtitle file in every language (`subtitles`, `captions`) and the video streams with burned-in subtitles (`hardSubs`).
2. `src/page/hook.js` runs in the page's own world (MAIN world) and reads that response **without making a request of its own**, so Crunchyroll never sees an extra playback request that would count against the concurrent-streams limit. If asked to, it swaps the hardsubbed stream addresses for the clean one.
3. `src/content/content.js` downloads the `.ass` / `.vtt` file for the chosen language and parses it with `subtitles.js`. Dialogue, top lines and signs are separated, and ASS drawing commands are dropped.
4. Translation happens in the background service worker (`src/background/translate.js`) in chunks of 50–60 lines. The result is cached per episode.
5. `overlay.js` draws the two lines in a Shadow DOM over the video's real picture area and keeps them in sync with `video.currentTime` on every frame.
6. With the word lookup on, lines are boxed word by word. Because the overlay lets clicks through (`pointer-events: none`), the pointer position is tested by hand; only the hovered word becomes clickable. A word's meanings, part of speech and example sentences come from Google's dictionary endpoint (`dt=bd`, `dt=ex`), and `words.js` looks for those meanings in the translated line by stem similarity.
7. A filed word lives in a single array (`vocab`) in `chrome.storage.local`. While choosing an example sentence the candidates are translated and the ones whose translation does not carry the sense used in the line are dropped; if none survives, no example is stored.

## Troubleshooting

| Symptom | What to do |
|---|---|
| No subtitles at all | Reload the page. The extension has to catch the playback response as the episode opens. Check the status card in the menu. |
| "Waiting for the subtitle list" | The episode may not have started playing, or Crunchyroll's API may have changed. Reload and try again. |
| Dual subtitles appear, but Crunchyroll's own subtitle shows too | The burned-in subtitle is only removed while the episode loads. Reload the page. If that does not help, pick **Off** in the Crunchyroll player's subtitle menu. |
| "Translation stopped: … key is not valid" | Fix the key in the menu. The translation restarts on its own; if it does not, press **Try again**. |
| The subtitle collides with the control bar | Raise **Look → Distance from the bottom**. |
| Google "request limit" error | Wait a few minutes. The extension retries by itself. If it happens often, use DeepL, Gemini or Claude. |
| Hovering a word does nothing | The lookup only works with dual subtitles: the original and the translation must both be on. Check **Notebook → Show a word's meaning on hover**. |
| The word is coloured but its counterpart is not | The translation may carry that word with another construction (an idiom, a compound verb, a dropped subject). The meanings still appear in the bubble. |
| Clicking a word does not file it | **Notebook → Click a word to file it in the notebook** may be off. Also, only the word you are hovering (the coloured one) is clickable. |
| No example sentence was filed | Google's example pool had nothing for that word in the sense used in the line. Rather than file an example with the wrong sense, the field is left empty; the subtitle line itself is already stored. |

## Privacy

- Subtitle text is sent **only to the translation service you choose** (Google, DeepL, Google AI or Anthropic). No data goes anywhere else. The details are in the [privacy policy](store/gizlilik-politikasi.html).
- Your Crunchyroll session, cookies and account details are never touched. Subtitle files are downloaded from the addresses the player itself uses.
- It is for personal use. It does not download video, it only draws subtitles.

## Development

```
crunchyroll-cift-altyazi/
├── manifest.json
├── _locales/                   Interface strings (en, tr)
├── src/
│   ├── page/hook.js            Page world: reads the playback response, removes the hardsub
│   ├── content/                Content scripts: parser, overlay, orchestration
│   ├── background/             Service worker: translation services, dictionary, cache, status
│   │   └── vendor/             Bundled Anthropic SDK (single file)
│   ├── popup/                  The extension menu
│   ├── notebook/               The word notebook page
│   └── shared/                 Language codes, settings, i18n, stem matching, notebook records
├── store/                      Publishing guide, privacy policy, store images
├── tests/                      node --test tests and sample subtitles
├── test-page/                  End-to-end try-out page, store image pages
├── tools/                      Packaging script, SDK bundling entry, icon generator
└── dist/                       npm run package output (not in git)
```

- **Tests:** `npm test` (Node 20+). 52 tests covering the parsers, the hook, the translation services, stem matching, notebook records, the background worker and packaging.
- **Package:** `npm run package` writes the store package and the manual-install package (with `KURULUM.txt` inside) into `dist/`.
- **Try-out page:** serve the folder over HTTP (`npx http-server crunchyroll-cift-altyazi -p 5612`) and open `http://localhost:5612/test-page/index.html`. The real scripts run against a fake Bitmovin player and a fake `chrome` API. `test-page/popup-preview.html` shows the menu (`?lang=en|tr`, `?tab=…`), `test-page/notebook-preview.html` the notebook (`?s=empty` for the empty state). The store images are screenshots of `store-shot.html?view=altyazi|tabela|menu|servisler` at 1280×800 (and `tile` / `marquee` at 440×280 and 1400×560). The Opera store wants 612×408 on a white background, so its images come from `opera-shot.html?view=altyazi|tabela|menu|servisler|tanitim`.
- **Updating the Anthropic SDK:** `npm install`, then `npm run vendor`.
- **Icons:** `powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1`

Source comments are in Turkish, the author's language; everything the user sees goes through `_locales`.

## Limits

- Crunchyroll changes its web player and API often. The extension scans the response generically (looking for `subtitles` / `captions` at any depth), but a large change may still need an update.
- Chromium-based browsers only (Chrome 111+, Edge, Brave, Opera). Firefox is not supported.
- Machine translation makes mistakes. Anime slang and wordplay come out best with Claude.
- A word's part of speech and "the meaning used in this line" are guesses drawn from free dictionary data. The counterpart is looked for by stem similarity, so in compounds like "meteor shower" the part of speech can come out wrong (verb instead of noun). The subtitle line and its translation filed in the notebook are always correct.
