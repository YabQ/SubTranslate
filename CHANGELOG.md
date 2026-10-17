# Changelog

The version here is the version published on the
[Chrome Web Store](https://chromewebstore.google.com/detail/dual-subtitles-for-crunch/dokkeifgjdekkeacknhhhkdhmpiooaek).
Each release is tagged, so `v1.0.6` in this repository is the build the store
is serving as 1.0.6.

## 1.0.7

- **Every dub language, not just English.** 1.0.6 only half fixed this. The
  signs track Crunchyroll serves for a dub also carries the song lyrics, and
  those sit at the bottom of the screen like ordinary lines, so the extension
  read the track as though it held dialogue and never went looking for the
  real one. The test fixture put the lyrics at the top of the screen, which
  is why the gap slipped through. The rule is no longer "does this track have
  any dialogue" but "how much": the tracks in that language are compared and
  the fullest one wins.
- The menu footer shows the version, so a reported problem can be matched to
  the build it came from.

## 1.0.6

- **Dubbed episodes show the spoken lines again.** On an episode watched with
  an English dub, Crunchyroll puts only signs and song lyrics in the subtitle
  track for that language and keeps the dialogue in a separate captions
  track. The extension always preferred the subtitle track, so those episodes
  showed the episode title and the odd street sign and nothing anyone said. A
  track with no dialogue in it is now treated as a hint rather than an answer:
  the other tracks in the same language are tried, captions first, and the
  signs from the original track are merged back in.
- **The interface speaks six languages:** English, Turkish, German, Spanish,
  Brazilian Portuguese and French, picked from the browser and switchable in
  the menu.
- **A welcome page opens on the first install**, explaining that the extension
  already works and where the settings are.
- The name on the toolbar button follows the interface language instead of
  always being Turkish.

## 1.0.4

- The interface is available in English as well as Turkish. It opens in the
  language of the browser and can be switched from the menu at any time.
- The translation language is also picked from the browser on first install.

## 1.0.3

- The menu and the notebook page follow Crunchyroll's own look: square
  corners, orange accents and an underlined tab bar.
- The translation no longer stops when a key or quota runs out: the rest of
  the episode is finished with Google Translate and the status card says so.
- The word notebook can be exported as an Anki deck.
- A TV preset sets the font, backdrop and offset for watching from a distance
  in one click.

## 1.0.2

- Click a word to keep it in a word notebook with its part of speech, the
  meaning it carries in that line, the subtitle sentence and the episode it
  came from.
- New translation service: Gemini, which has a free tier and, unlike Google
  Translate, reads the surrounding lines.

## 1.0.1

- Hover a word in the original subtitle to see two meanings of it. The word
  and the word that carries it in the translated line are highlighted in the
  same colour. It can be switched off, and its colour changed, in the popup.

## 1.0.0

- First release.

<!-- 1.0.5 was built but never published; its changes went out as part of 1.0.6. -->
