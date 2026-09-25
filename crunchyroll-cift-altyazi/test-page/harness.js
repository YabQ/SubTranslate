/* =========================================================
   harness.js — Deneme sayfası için sahte "chrome" API'si ve sahte
   arka plan. İçerik betikleri bu sayfada eklentideymiş gibi çalışır;
   çeviri isteği gerçek translate.js modülüne (Google) gider.
   ========================================================= */
(() => {
  const listeners = [];
  const store = {};
  const log = (...args) => window.dispatchEvent(new CustomEvent('harness:log', { detail: args }));

  function pick(keys) {
    if (keys == null) return { ...store };
    const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
    const out = {};
    for (const k of list) if (k in store) out[k] = structuredClone(store[k]);
    return out;
  }

  const local = {
    async get(keys) {
      return pick(keys);
    },
    async set(obj) {
      const changes = {};
      for (const [k, v] of Object.entries(obj)) {
        changes[k] = { oldValue: store[k], newValue: structuredClone(v) };
        store[k] = structuredClone(v);
      }
      for (const fn of listeners) fn(changes, 'local');
    },
    async remove(keys) {
      for (const k of [].concat(keys)) delete store[k];
    },
  };

  const cache = new Map();
  const background = {
    async 'get-tracks'() {
      return null;
    },
    async tracks(msg) {
      log('arka plan: altyazı listesi alındı', msg.data.tracks.map((t) => t.lang).join(', '));
    },
    async status(msg) {
      window.dispatchEvent(new CustomEvent('harness:status', { detail: msg.data }));
    },
    async 'fetch-text'(msg) {
      const res = await fetch(msg.url);
      return res.ok ? { ok: true, text: await res.text() } : { ok: false, error: `HTTP ${res.status}` };
    },
    async translate(msg) {
      const mode = document.querySelector('#provider').value;
      if (mode === 'fake') {
        await new Promise((r) => setTimeout(r, 400));
        return { ok: true, translations: msg.texts.map((t) => `[TR] ${t}`) };
      }
      try {
        const { translate } = await import('../src/background/translate.js');
        const settings = await globalThis.CRDS.settings.load();
        const translations = await translate({ ...msg, title: 'Frieren', settings, keys: {} });
        log(`çeviri: ${msg.texts.length} satır (${msg.provider})`);
        return { ok: true, translations };
      } catch (err) {
        return { ok: false, error: String(err.message || err), retryable: err.retryable !== false, fatal: !!err.fatal };
      }
    },
    async 'lookup-word'(msg) {
      if (document.querySelector('#provider').value === 'fake') {
        await new Promise((r) => setTimeout(r, 150));
        return { word: msg.word, meanings: [`[TR] ${msg.word}`, `[TR] ${msg.word} (2)`] };
      }
      try {
        const { lookupWord } = await import('../src/background/translate.js');
        const res = await lookupWord(msg);
        log(`sözlük: ${msg.word} → ${res.meanings.slice(0, 2).join(', ') || 'karşılık yok'}`);
        return res;
      } catch (err) {
        log(`sözlük hatası: ${err.message || err}`);
        return { word: msg.word, meanings: [] };
      }
    },
    async 'save-word'(msg) {
      const Vocab = globalThis.CRDS.vocab;
      const { rankExamples, translate } = await import('../src/background/translate.js');
      const found = (await background['lookup-word'](msg)) || { meanings: [] };
      // Arka plandaki seçimin aynısı: örneğin çevirisi cümledeki anlamı taşımalı
      const candidates = rankExamples(found.examples, msg.word, msg.line).slice(0, 3);
      let example = '';
      let exampleTr = '';
      if (candidates.length) {
        try {
          const list = await translate({ provider: 'google', texts: candidates, source: msg.source, target: msg.target, settings: {}, keys: {} });
          for (let i = 0; i < candidates.length; i++) {
            if (msg.sense && !globalThis.CRDS.words.bestMatch(list[i] || '', [msg.sense])) continue;
            example = candidates[i];
            exampleTr = list[i];
            break;
          }
        } catch (_) {
          example = '';
        }
      }
      const entry = Vocab.buildEntry({
        ...msg,
        meanings: globalThis.CRDS.words.orderBySense(found.meanings || [], msg.sense),
        pos: Vocab.pickPos(found.entries, msg.sense),
        example,
        exampleTr,
      });
      const { list, added, count } = Vocab.merge(await Vocab.load(), entry);
      await Vocab.save(list);
      log(`deftere kaydedildi: ${entry.word} (${entry.pos || 'tür yok'}) · ${count} kez`);
      return { ok: true, added, count, word: entry.word, pos: entry.pos };
    },
    async 'cache-get'(msg) {
      return cache.get(msg.key) || null;
    },
    async 'cache-put'(msg) {
      cache.set(msg.key, msg.value);
      log(`önbelleğe yazıldı (${msg.value.length} satır)`);
      return true;
    },
  };

  // Sahte Crunchyroll "playback" uç noktası: kanca (hook.js) bunu sarmalar
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!/\/fake\/playback\/v3\//.test(url)) return nativeFetch(input, init);
    const origin = location.origin;
    const body = {
      audioLocale: 'ja-JP',
      burnedInLocale: '',
      hardSubs: {
        'en-US': { hlang: 'en-US', url: `${origin}/fake/hardsub-en.mpd` },
        none: { hlang: 'none', url: `${origin}/fake/clean.mpd` },
      },
      subtitles: {
        'en-US': { format: 'ass', language: 'en-US', url: `${origin}/tests/fixtures/sample.ass` },
        'es-419': { format: 'vtt', language: 'es-419', url: `${origin}/tests/fixtures/sample-es.vtt` },
        none: { format: 'ass', language: 'none' },
      },
      captions: {},
    };
    return Promise.resolve(new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }));
  };

  window.chrome = {
    runtime: {
      id: 'harness',
      sendMessage(msg) {
        const fn = background[msg && msg.type];
        return fn ? fn(msg) : Promise.resolve(null);
      },
      onMessage: { addListener() {} },
    },
    storage: {
      local,
      onChanged: {
        addListener(fn) {
          listeners.push(fn);
        },
      },
    },
  };
})();
