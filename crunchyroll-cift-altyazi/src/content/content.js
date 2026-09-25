/* =========================================================
   content.js — İzole içerik betiği (her Crunchyroll çerçevesinde).
   Altyazı listesini kancadan (hook.js) ya da arka plandan alır,
   dosyaları indirir, çeviriyi parça parça yönetir ve katmanı
   videonun zamanıyla senkron çizer.
   ========================================================= */
(() => {
  if (globalThis.__crdsContent) return;
  globalThis.__crdsContent = true;

  const { settings: Settings, lang: L, subtitles: Subs, words: Words, Overlay } = globalThis.CRDS;

  const CHUNK_SIZE = { google: 60, deepl: 50, claude: 60, gemini: 60 };
  const CONCURRENCY = { google: 2, deepl: 2, claude: 3, gemini: 2 };
  const PROVIDER_NAMES = { google: 'Google Çeviri', deepl: 'DeepL', claude: 'Claude', gemini: 'Gemini' };
  const VIDEO_EVENTS = ['play', 'playing', 'pause', 'seeked', 'timeupdate', 'loadedmetadata'];

  const state = {
    settings: { ...Settings.DEFAULTS },
    loaded: false,
    payload: null,       // son yakalanan altyazı listesi
    video: null,
    overlay: null,
    session: null,       // bölüm başına: orijinal + çeviri durumu
    seq: 0,
    raf: 0,
    lastPointer: 0,
    statusTimer: 0,
    hardsubsStripped: false,
    transLine: '',       // o an gösterilen çeviri satırı (kelime eşleştirmesi için)
  };

  // Fareyle üzerine gelinen kelime: orijinaldeki konumu, anlamları ve
  // çeviri satırında eşleşen kelimelerin konumları
  const lookup = {
    word: '',
    origText: '',
    index: -1,
    meanings: [],
    shown: [],
    sense: '',
    transText: '',
    transHot: [],
    seq: 0,
    raf: 0,
    x: 0,
    y: 0,
    cache: new Map(),
  };
  const LOOKUP_CACHE_MAX = 300;

  /* ---------- Yardımcılar ---------- */

  function send(msg) {
    try {
      return chrome.runtime.sendMessage(msg).catch(() => null);
    } catch (_) {
      return Promise.resolve(null); // eklenti yeniden yüklendiyse bağlam geçersizdir
    }
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function hash(str) {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
  }

  function ensureOverlay() {
    if (!state.video) return null;
    if (!state.overlay) {
      state.overlay = new Overlay();
      state.overlay.applySettings(state.settings);
      state.overlay.onWordClick = saveWord;
    }
    state.overlay.attach(state.video);
    return state.overlay;
  }

  function toast(message, ms) {
    const overlay = ensureOverlay();
    if (overlay) overlay.toast(message, ms);
  }

  // Üst çerçevede adres /watch/<id> biçimindedir (eski iframe oynatıcıda null)
  function currentWatchId() {
    const m = /\/watch\/([A-Za-z0-9]{6,})/.exec(location.pathname);
    return m ? m[1].toUpperCase() : null;
  }

  // Liste alındıktan sonra başka bir bölüme geçildiyse eski altyazıyı gösterme
  function payloadMismatch(payload) {
    const now = currentWatchId();
    return !!(now && payload.watchId && now !== payload.watchId);
  }

  /* ---------- Sayfa kancasıyla köprü ---------- */

  function applyPageFlags() {
    const root = document.documentElement;
    if (!root) return;
    const s = state.settings;
    root.setAttribute('data-crds-strip', s.enabled && s.stripHardsubs ? '1' : '0');
    root.setAttribute('data-crds-hide-native', s.enabled && s.hideNativeSubs ? '1' : '0');
  }

  document.addEventListener('crds:hook', (event) => {
    let msg;
    try {
      msg = JSON.parse(event.detail);
    } catch (_) {
      return;
    }
    if (msg.type === 'tracks') acceptPayload(msg.data, true);
    else if (msg.type === 'hardsubs-stripped') {
      state.hardsubsStripped = true;
      pushStatus();
    }
  });

  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === 'tracks') acceptPayload(msg.data, false);
    });
  } catch (_) {
    /* bağlam geçersiz */
  }

  function acceptPayload(payload, fromThisFrame) {
    if (!payload || !Array.isArray(payload.tracks) || !payload.tracks.length) return;
    if (state.payload && state.payload.id === payload.id) return;
    const watchId = currentWatchId();
    // Arka planda kalmış önceki bölümün listesi yeni sayfaya uygulanmasın
    if (!fromThisFrame && watchId && payload.contentId && watchId !== payload.contentId) return;
    state.payload = { ...payload, watchId };
    // Video başka bir çerçevedeyse (eski oynatıcı) oraya da ulaşsın
    if (fromThisFrame) send({ type: 'tracks', data: payload });
    if (state.video) startSession();
    else pushStatus();
  }

  /* ---------- Video takibi ---------- */

  function findVideo() {
    let best = null;
    let bestScore = 0;
    for (const video of document.querySelectorAll('video')) {
      const r = video.getBoundingClientRect();
      const area = r.width * r.height;
      if (area < 40000) continue; // küçük önizleme videolarını atla
      let score = area;
      if (video.readyState >= 1) score *= 2;
      if (video.duration > 120) score *= 2;
      if (!video.paused) score *= 1.5;
      if (score > bestScore) {
        best = video;
        bestScore = score;
      }
    }
    return best;
  }

  function checkVideo() {
    if (!state.loaded) return;
    const video = findVideo();
    if (video !== state.video) bindVideo(video);
    else if (state.overlay && state.session) {
      state.overlay.ensureAttached();
      state.overlay.layout();
    }
  }

  function onVideoEvent(event) {
    if (event.type === 'play' || event.type === 'playing') startLoop();
    else if (event.type === 'loadedmetadata' && state.overlay) state.overlay.layout();
    else if (event.type === 'seeked') reprioritize();
    renderNow();
  }

  function bindVideo(video) {
    if (state.video) for (const type of VIDEO_EVENTS) state.video.removeEventListener(type, onVideoEvent);
    state.video = video;
    if (!video) {
      if (state.overlay) state.overlay.attach(null);
      pushStatus();
      return;
    }
    for (const type of VIDEO_EVENTS) video.addEventListener(type, onVideoEvent);
    if (state.payload && (!state.session || state.session.payload !== state.payload)) {
      startSession();
    } else {
      if (state.session) ensureOverlay();
      renderNow();
      pushStatus();
    }
    startLoop();
  }

  /* ---------- Oturum: orijinal altyazı ---------- */

  const alive = (sess) => state.session === sess && sess.token === state.seq;

  function stopSession() {
    if (state.session && state.session.secondary) state.session.secondary.cancelled = true;
    state.session = null;
    state.seq++;
  }

  function pickPrimary(tracks, preferred) {
    const usable = tracks.filter((t) => t.url && L.normalizeLocale(t.lang) !== 'none');
    const subs = usable.filter((t) => t.kind === 'subtitles');
    const caps = usable.filter((t) => t.kind !== 'subtitles');
    const exact = (list, code) => list.find((t) => L.normalizeLocale(t.lang) === L.normalizeLocale(code));
    const base = (list, code) => list.find((t) => L.baseLang(t.lang) === L.baseLang(code));
    return exact(subs, preferred) || exact(caps, preferred) || base(subs, preferred) || base(caps, preferred) ||
      exact(subs, 'en-US') || base(subs, 'en') || base(caps, 'en') || subs[0] || caps[0] || null;
  }

  async function fetchText(url) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        if (text) return text;
      }
    } catch (_) {
      /* CORS vb. — arka plan üzerinden dene */
    }
    const res = await send({ type: 'fetch-text', url });
    if (res && res.ok) return res.text;
    throw new Error(`Altyazı dosyası indirilemedi${res && res.error ? ` (${res.error})` : ''}`);
  }

  async function startSession() {
    stopSession();
    const s = state.settings;
    const payload = state.payload;
    if (!state.loaded || !s.enabled || !payload || !state.video) {
      renderNow();
      pushStatus();
      return;
    }
    const sess = { token: state.seq, payload, primary: null, secondary: null, status: 'loading', error: null };
    state.session = sess;
    pushStatus();
    try {
      const track = pickPrimary(payload.tracks, s.primaryLang);
      if (!track) throw new Error('Bu bölümde kullanılabilir altyazı yok');
      const text = await fetchText(track.url);
      if (!alive(sess)) return;
      const parsed = Subs.parse(text, track.format);
      if (!parsed.cues.length) throw new Error(`Altyazı dosyası okunamadı (${parsed.format || track.format || 'bilinmeyen biçim'})`);
      sess.primary = { track, cues: parsed.cues, format: parsed.format };
      sess.status = 'ready';
      ensureOverlay();
      renderNow();
      pushStatus();
      await setupSecondary(sess);
    } catch (err) {
      if (!alive(sess)) return;
      sess.status = 'error';
      sess.error = String((err && err.message) || err);
      toast(`Çift altyazı: ${sess.error}`, 8000);
      pushStatus();
    }
  }

  /* ---------- Oturum: ikinci satır (resmi altyazı ya da çeviri) ---------- */

  async function setupSecondary(sess) {
    const s = state.settings;
    if (sess.secondary) sess.secondary.cancelled = true;
    sess.secondary = null;
    if (!s.showTranslation) {
      sess.secondary = { mode: 'off' };
      pushStatus();
      return;
    }
    const primaryTrack = sess.primary.track;
    if (s.preferOfficial) {
      const candidates = sess.payload.tracks.filter((t) => t.url !== primaryTrack.url && L.sameLanguage(s.targetLang, t.lang));
      const official = candidates.find((t) => t.kind === 'subtitles') || candidates[0];
      if (official) {
        try {
          const parsed = Subs.parse(await fetchText(official.url), official.format);
          if (!alive(sess)) return;
          if (parsed.cues.length) {
            sess.secondary = { mode: 'track', track: official, cues: parsed.cues };
            renderNow();
            pushStatus();
            return;
          }
        } catch (_) {
          /* resmi altyazı alınamazsa makine çevirisine geç */
        }
        if (!alive(sess)) return;
      }
    }
    if (L.sameLanguage(s.targetLang, primaryTrack.lang)) {
      sess.secondary = { mode: 'same' };
      pushStatus();
      return;
    }
    await startTranslation(sess);
  }

  function restartSecondary() {
    const sess = state.session;
    if (!sess || !sess.primary) return;
    setupSecondary(sess).catch((err) => {
      if (!alive(sess)) return;
      sess.secondary = { mode: 'translate', error: String((err && err.message) || err), done: 0, failed: 1, finished: true };
      pushStatus();
    });
  }

  const jobAlive = (sess, job) => alive(sess) && sess.secondary === job && !job.cancelled;

  async function startTranslation(sess) {
    const s = state.settings;
    const { units, unitOfCue } = Subs.buildUnits(sess.primary.cues, s.mergeSentences);
    // Aynı metin (ör. "Evet.") bir kez çevrilir
    const uniq = [];
    const index = new Map();
    const unitToUniq = new Int32Array(units.length);
    units.forEach((unit, i) => {
      let k = index.get(unit.text);
      if (k === undefined) {
        k = uniq.length;
        uniq.push(unit.text);
        index.set(unit.text, k);
      }
      unitToUniq[i] = k;
    });

    const source = L.normalizeLocale(sess.primary.track.lang) || 'auto';
    const job = {
      mode: 'translate', provider: s.provider, source, target: s.targetLang,
      unitOfCue, unitToUniq, uniq, out: new Array(uniq.length).fill(null),
      chunks: [], queue: [], active: 0, done: 0, failed: 0, error: null,
      cancelled: false, finished: false, cached: false, cacheKey: '',
    };
    sess.secondary = job;
    if (!uniq.length) {
      job.finished = true;
      pushStatus();
      return;
    }

    const model = s.provider === 'claude' ? s.claudeModel : s.provider === 'gemini' ? s.geminiModel : '';
    const variant = model ? `${model}~${hash(s.llmInstructions)}` : '';
    job.cacheKey = ['v1', s.provider, variant, source, s.targetLang, s.mergeSentences ? 'm' : 's', uniq.length, hash(uniq.join('\u0001'))].join('|');
    const cached = await send({ type: 'cache-get', key: job.cacheKey });
    if (!jobAlive(sess, job)) return;
    if (Array.isArray(cached) && cached.length === uniq.length) {
      job.out = cached;
      job.done = uniq.length;
      job.finished = true;
      job.cached = true;
      renderNow();
      pushStatus();
      return;
    }

    const size = CHUNK_SIZE[job.provider] || 50;
    for (let i = 0; i < uniq.length; i += size) job.chunks.push({ start: i, end: Math.min(uniq.length, i + size), tries: 0 });
    job.queue = orderChunks(job, job.chunks);
    toast(`Çeviri hazırlanıyor… (${PROVIDER_NAMES[job.provider]})`, 4000);
    pushStatus();
    pump(sess, job);
  }

  // O an izlenen yerin çevirisi önce gelsin: kuyruğu oynatma konumuna göre sırala
  function orderChunks(job, chunks) {
    const size = CHUNK_SIZE[job.provider] || 50;
    const cues = state.session && state.session.primary ? state.session.primary.cues : [];
    const t = state.video ? state.video.currentTime : 0;
    let focus = 0;
    let seen = 0;
    for (const cue of cues) {
      if (cue.end <= t) continue;
      const u = job.unitOfCue[cue.id];
      if (u >= 0) focus = Math.max(focus, job.unitToUniq[u]);
      if (++seen >= 5) break;
    }
    const current = Math.floor(focus / size);
    const rank = (chunk) => {
      const c = Math.floor(chunk.start / size);
      return c >= current ? c - current : 1e6 + (current - c);
    };
    return chunks.slice().sort((a, b) => rank(a) - rank(b));
  }

  function reprioritize() {
    const job = state.session && state.session.secondary;
    if (job && job.mode === 'translate' && !job.finished && job.queue && job.queue.length) job.queue = orderChunks(job, job.queue);
  }

  function pump(sess, job) {
    const limit = CONCURRENCY[job.provider] || 2;
    while (jobAlive(sess, job) && job.active < limit && job.queue.length) {
      const chunk = job.queue.shift();
      job.active++;
      runChunk(sess, job, chunk).finally(() => {
        job.active--;
        if (!jobAlive(sess, job)) return;
        if (job.queue.length) pump(sess, job);
        else if (!job.active) finishJob(job);
      });
    }
  }

  async function runChunk(sess, job, chunk) {
    const texts = job.uniq.slice(chunk.start, chunk.end);
    const context = job.uniq.slice(Math.max(0, chunk.start - 6), chunk.start);
    const res = await send({ type: 'translate', provider: job.provider, source: job.source, target: job.target, texts, context });
    if (!jobAlive(sess, job)) return;

    if (res && res.ok && Array.isArray(res.translations) && res.translations.length === texts.length) {
      res.translations.forEach((t, i) => {
        job.out[chunk.start + i] = typeof t === 'string' ? t : '';
      });
      const first = job.done === 0;
      job.done += texts.length;
      if (first && state.overlay) state.overlay.hideToast();
      renderNow();
      pushStatus();
      return;
    }

    const error = (res && res.error) || 'Çeviri servisine ulaşılamadı';
    chunk.tries++;
    if (res && res.fatal) {
      // Geçersiz anahtar, kota vb.: kalan parçaları deneme
      job.queue = [];
      job.error = error;
      job.failed = job.uniq.length - job.done;
      toast(`Çeviri durdu: ${error}`, 9000);
      pushStatus();
      return;
    }
    if ((!res || res.retryable !== false) && chunk.tries < 3) {
      await sleep(Math.max((res && res.retryAfter) || 0, 1500 * chunk.tries));
      if (jobAlive(sess, job)) job.queue.unshift(chunk);
      return;
    }
    job.failed += texts.length;
    job.error = error;
    toast(`Çeviri hatası: ${error}`, 8000);
    pushStatus();
  }

  function finishJob(job) {
    if (job.finished) return;
    job.finished = true;
    if (!job.failed && job.done === job.uniq.length) send({ type: 'cache-put', key: job.cacheKey, value: job.out });
    pushStatus();
  }

  /* ---------- Kelime sözlüğü ----------
     Fare altyazıdaki bir kelimenin üzerine gelince o kelime renklenir,
     anlamları balonda gösterilir ve çeviri satırındaki karşılığı aynı
     renge boyanır. Karşılık arama Türkçe eklere dayanıklıdır (words.js). */

  function clearLookup(render = true) {
    if (!lookup.origText) return;
    lookup.word = '';
    lookup.origText = '';
    lookup.index = -1;
    lookup.meanings = [];
    lookup.shown = [];
    lookup.sense = '';
    lookup.transText = '';
    lookup.transHot = [];
    lookup.seq++;
    if (state.overlay) state.overlay.hideTip();
    if (render) renderNow();
  }

  async function runLookup(word, origText, index) {
    const sess = state.session;
    const source = (sess && sess.primary && sess.primary.lang) || state.settings.primaryLang;
    const target = state.settings.targetLang;
    const key = `${source}|${target}|${word.toLowerCase()}`;
    const seq = ++lookup.seq;
    let res = lookup.cache.get(key);
    if (!res) {
      res = await send({ type: 'lookup-word', word, source, target });
      if (res && Array.isArray(res.meanings)) {
        if (lookup.cache.size >= LOOKUP_CACHE_MAX) lookup.cache.delete(lookup.cache.keys().next().value);
        lookup.cache.set(key, res);
      }
    }
    // Bu sırada fare başka kelimeye geçtiyse sonucu at
    if (seq !== lookup.seq || lookup.origText !== origText || lookup.index !== index) return;
    const meanings = (res && res.meanings) || [];
    lookup.meanings = meanings;
    const match = meanings.length && state.transLine ? Words.bestMatch(state.transLine, meanings) : null;
    lookup.transText = match ? state.transLine : '';
    lookup.transHot = match ? match.indexes : [];
    // Cümlede kullanılan anlam: çeviri satırında karşılığı tutan aday
    lookup.sense = match ? match.meaning : meanings[0] || '';
    renderNow();
    const shown = Words.orderBySense(meanings, lookup.sense).slice(0, 2);
    lookup.shown = shown;
    if (state.overlay) state.overlay.showTip(word, shown, tipNote(meanings));
  }

  function tipNote(meanings) {
    if (!meanings.length) return 'Karşılık bulunamadı';
    return state.settings.notebook ? 'Kaydetmek için tıkla' : '';
  }

  // Sekme başlığından dizi adı ve bölüm numarası
  function episodeInfo() {
    const raw = document.title
      .replace(/\s*[-|–—]\s*Watch on Crunchyroll.*$/i, '')
      .replace(/\s*[-|–—]\s*Crunchyroll.*$/i, '')
      .replace(/^\s*Watch\s+/i, '')
      .trim();
    const m = /\b(?:Episode|Bölüm|Folge|Episodio|Épisode|Ep\.?)\s*([0-9]+[A-Za-z]?)/i.exec(raw);
    const show = raw
      .replace(/\s*[-–—:]?\s*(?:Season\s*[0-9]+)?\s*(?:Episode|Bölüm|Folge|Episodio|Épisode|Ep\.?)\s*[0-9].*$/i, '')
      .trim();
    return { show: show || raw, episode: m ? `Bölüm ${m[1]}` : '' };
  }

  // Kelimeye tıklandığında deftere kaydeder; katman tıklamayı oynatıcıya geçirmez
  async function saveWord(word, index) {
    const s = state.settings;
    const overlay = state.overlay;
    if (!s.notebook || !overlay || !lookup.origText || index !== lookup.index) return;
    const sess = state.session;
    const source = (sess && sess.primary && sess.primary.lang) || s.primaryLang;
    const meanings = lookup.shown.length ? lookup.shown : lookup.meanings.slice(0, 2);
    const info = episodeInfo();
    overlay.showTip(word, meanings, 'Kaydediliyor…');
    const res = await send({
      type: 'save-word',
      word,
      source,
      target: s.targetLang,
      sense: lookup.sense,
      line: lookup.origText,
      lineTr: lookup.transText || state.transLine,
      show: info.show,
      episode: info.episode,
      url: location.href,
      time: state.video ? Math.floor(state.video.currentTime) : 0,
    });
    // Bu sırada fare başka kelimeye geçtiyse balonu geri getirme
    if (lookup.index !== index || lookup.word !== word) return;
    if (res && res.ok) {
      overlay.showTip(word, meanings, res.count > 1 ? `Deftere eklendi · ${res.count}. kez` : 'Deftere eklendi');
    } else {
      overlay.showTip(word, meanings, 'Kaydedilemedi');
    }
  }

  function updateHover(x, y) {
    const overlay = state.overlay;
    if (!overlay || !state.settings.enabled || !state.settings.wordLookup) {
      clearLookup();
      return;
    }
    const hit = overlay.hitTest(x, y);
    if (!hit || !hit.word) {
      clearLookup();
      return;
    }
    if (hit.lineText === lookup.origText && hit.index === lookup.index) {
      overlay.placeTip();
      return;
    }
    lookup.word = hit.word;
    lookup.origText = hit.lineText;
    lookup.index = hit.index;
    lookup.meanings = [];
    lookup.shown = [];
    lookup.sense = '';
    lookup.transText = '';
    lookup.transHot = [];
    overlay.hideTip();
    renderNow(); // kelime, anlamı beklenmeden renklensin
    runLookup(hit.word, hit.lineText, hit.index);
  }

  /* ---------- Çizim ---------- */

  function buildModel() {
    const s = state.settings;
    const sess = state.session;
    const video = state.video;
    if (!s.enabled || !sess || !sess.primary || !video || payloadMismatch(sess.payload)) return null;

    const t = video.currentTime;
    const sec = sess.secondary;
    const orig = [];
    const trans = [];
    const seenOrig = new Set();
    const seenTrans = new Set();

    for (const cue of Subs.activeCues(sess.primary.cues, t)) {
      if (cue.kind === 'sign' && !s.showSigns) continue;
      if (s.showOriginal && !seenOrig.has(cue.text)) {
        seenOrig.add(cue.text);
        orig.push({ kind: cue.kind, cls: 'prim', text: cue.text, segs: cue.segs, italic: cue.italic });
      }
      if (s.showTranslation && sec && sec.mode === 'translate' && sec.unitOfCue) {
        const u = sec.unitOfCue[cue.id];
        const text = u >= 0 ? sec.out[sec.unitToUniq[u]] : null;
        if (text && !seenTrans.has(text)) {
          seenTrans.add(text);
          trans.push({ kind: cue.kind, cls: 'sec', text, italic: cue.italic });
        }
      }
    }
    if (s.showTranslation && sec && sec.mode === 'track') {
      for (const cue of Subs.activeCues(sec.cues, t)) {
        if ((cue.kind === 'sign' && !s.showSigns) || seenTrans.has(cue.text)) continue;
        seenTrans.add(cue.text);
        trans.push({ kind: cue.kind, cls: 'sec', text: cue.text, segs: cue.segs, italic: cue.italic });
      }
    }

    const arrange = (a, b) => (s.translationOnTop ? [...b, ...a] : [...a, ...b]);
    const isBottom = (l) => l.kind === 'dialogue';
    const origBottom = orig.filter(isBottom);
    const transBottom = trans.filter(isBottom);

    // Kelime sözlüğü yalnızca çift altyazıda çalışır: orijinal ve çeviri birlikteyken
    if (s.wordLookup && origBottom.length && transBottom.length) {
      const target = transBottom[0];
      state.transLine = target.text;
      for (const line of origBottom) {
        line.words = true;
        line.hover = true;
        line.savable = s.notebook;
        line.hot = line.text === lookup.origText ? [lookup.index] : [];
      }
      for (const line of transBottom) {
        line.words = true;
        line.hot = line === target && target.text === lookup.transText ? lookup.transHot : [];
      }
    } else {
      state.transLine = '';
    }

    const bottom = arrange(origBottom, transBottom);
    const top = arrange(orig.filter((l) => !isBottom(l)).slice(-3), trans.filter((l) => !isBottom(l)).slice(-3))
      .map((l) => (l.kind === 'sign' ? { ...l, cls: `${l.cls} sign` } : l));
    return { top, bottom };
  }

  function renderNow() {
    const overlay = state.overlay;
    if (!overlay) return;
    const s = state.settings;
    overlay.setVisible(s.enabled);
    if (!s.enabled) return;
    const model = buildModel();
    overlay.render(model);
    // Üzerinde durulan satır geçtiyse (replik değişti) seçim düşer
    if (lookup.origText) {
      if (model && model.bottom.some((l) => l.hover && l.text === lookup.origText)) overlay.placeTip();
      else clearLookup(false);
    }
    let lift = false;
    if (s.liftWithControls && state.video) {
      const native = overlay.nativeControlsVisible();
      lift = native !== null ? native : state.video.paused || Date.now() - state.lastPointer < 2500;
    }
    overlay.setLift(lift);
  }

  function startLoop() {
    if (!state.raf) state.raf = requestAnimationFrame(loop);
  }

  function loop() {
    state.raf = 0;
    renderNow();
    const v = state.video;
    if (v && !v.paused && !v.ended) state.raf = requestAnimationFrame(loop);
  }

  /* ---------- Popup için durum raporu ---------- */

  function statusSnapshot() {
    const p = state.payload;
    const sess = state.session;
    const sec = sess && sess.secondary;
    let phase = 'idle';
    if (!state.settings.enabled) phase = 'disabled';
    else if (!p) phase = 'waiting-tracks';
    else if (!state.video) phase = 'waiting-video';
    else if (sess) phase = sess.status;
    return {
      at: Date.now(),
      top: window === window.top,
      video: !!state.video,
      phase,
      contentId: p ? p.contentId : null,
      tracks: p ? p.tracks.map((t) => ({ lang: L.normalizeLocale(t.lang), kind: t.kind, format: t.format })) : [],
      stripped: state.hardsubsStripped,
      error: sess ? sess.error : null,
      primary: sess && sess.primary
        ? { lang: L.normalizeLocale(sess.primary.track.lang), kind: sess.primary.track.kind, format: sess.primary.format, cues: sess.primary.cues.length }
        : null,
      secondary: sec
        ? {
          mode: sec.mode,
          lang: sec.track ? L.normalizeLocale(sec.track.lang) : sec.target || null,
          provider: sec.provider || null,
          done: sec.done || 0,
          total: sec.uniq ? sec.uniq.length : 0,
          failed: sec.failed || 0,
          error: sec.error || null,
          finished: !!sec.finished,
          cached: !!sec.cached,
        }
        : null,
    };
  }

  function pushStatus() {
    clearTimeout(state.statusTimer);
    state.statusTimer = setTimeout(() => {
      if (state.video || window === window.top) send({ type: 'status', data: statusSnapshot() });
    }, 200);
  }

  /* ---------- Ayar değişiklikleri ---------- */

  function onSettingsChanged(next, prev) {
    state.settings = next;
    state.loaded = true;
    applyPageFlags();
    if (!next.enabled || !next.wordLookup || !next.showOriginal || !next.showTranslation) clearLookup(false);
    if (state.overlay) state.overlay.applySettings(next);
    if (!next.enabled) {
      stopSession();
      renderNow();
      pushStatus();
      return;
    }
    if (!prev.enabled || prev.primaryLang !== next.primaryLang || prev.retryToken !== next.retryToken) {
      startSession();
      return;
    }
    const changed = Settings.SECONDARY_KEYS.filter((k) => prev[k] !== next[k]);
    if (changed.length && state.session && state.session.primary) {
      const sec = state.session.secondary;
      const onlyVisibility = changed.length === 1 && changed[0] === 'showTranslation';
      // Çeviri zaten hazırsa yalnızca göster/gizle; baştan hazırlama
      if (!onlyVisibility || (next.showTranslation && (!sec || sec.mode === 'off'))) restartSecondary();
    }
    renderNow();
    pushStatus();
  }

  /* ---------- Başlangıç ---------- */

  const onPointer = () => {
    state.lastPointer = Date.now();
  };
  // Kelime sınaması her karede en fazla bir kez yapılır
  const onPointerMove = (event) => {
    state.lastPointer = Date.now();
    if (!state.overlay || !state.settings.enabled || !state.settings.wordLookup) return;
    lookup.x = event.clientX;
    lookup.y = event.clientY;
    if (lookup.raf) return;
    lookup.raf = requestAnimationFrame(() => {
      lookup.raf = 0;
      updateHover(lookup.x, lookup.y);
    });
  };
  document.addEventListener('pointermove', onPointerMove, { passive: true, capture: true });
  document.addEventListener('touchstart', onPointer, { passive: true, capture: true });
  document.addEventListener('loadedmetadata', (e) => {
    if (e.target instanceof HTMLVideoElement) checkVideo();
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') startLoop();
  });

  try {
    Settings.onChange(onSettingsChanged);
  } catch (_) {
    /* bağlam geçersiz */
  }

  Settings.load().then((s) => {
    state.settings = s;
    state.loaded = true;
    applyPageFlags();
    checkVideo();
    pushStatus();
  });

  send({ type: 'get-tracks' }).then((payload) => {
    if (payload) acceptPayload(payload, false);
  });
  document.dispatchEvent(new CustomEvent('crds:replay'));
  setInterval(checkVideo, 1000);
})();
