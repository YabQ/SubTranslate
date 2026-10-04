# SubTranslate — Dual Subtitles for Crunchyroll

A Chrome extension that shows the **original Crunchyroll subtitle and its translation at the same time**, as two lines over the video — for watching a show in a language your Crunchyroll account has no subtitles for.

![The original subtitle and its translation over the video](crunchyroll-cift-altyazi/store/gorseller/1-cift-altyazi.png)

## What it does

- **Two lines at once:** the original subtitle and its translation into the language you pick.
- **Your choice of service:** Google Translate (free, no key), DeepL, Google Gemini or Anthropic Claude with your own API key. If a key or quota runs out mid-episode, the rest is finished with Google Translate instead of stopping.
- **Word lookup:** hover a word to see two meanings of it and which word carries it in the translation.
- **Word notebook:** click that word to file it with its part of speech, the sentence it came from, an example and the episode. Exports as an Anki deck, CSV or JSON.
- **Interface in English or Turkish**, following the browser and switchable in the menu.

![The menu in English and in Turkish](crunchyroll-cift-altyazi/store/gorseller/3-menu.png)

## Install

The extension lives in [`crunchyroll-cift-altyazi/`](crunchyroll-cift-altyazi/). To run it from source: open `chrome://extensions`, turn on Developer mode, press **Load unpacked** and pick that folder.

Everything else — features, settings, how it reads the player, troubleshooting — is in the [extension's README](crunchyroll-cift-altyazi/README.md).

## Privacy

Subtitle text is sent only to the translation service you select; nothing goes to the developer, and there is no analytics or tracking code. API keys stay in your browser. The full policy, in English and Turkish, is at [gizlilik-politikasi.html](https://yabq.github.io/SubTranslate/gizlilik-politikasi.html).

## Notes

This extension is not affiliated with or endorsed by Crunchyroll. Crunchyroll is a trademark of Crunchyroll, LLC. You need the right to watch the episode; the extension does not download video, it only draws subtitles.
