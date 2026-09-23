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
