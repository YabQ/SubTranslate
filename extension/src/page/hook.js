/* =========================================================
   hook.js — Sayfanın kendi dünyasında (MAIN world) çalışır.

   Crunchyroll oynatıcısı bölümü açarken ".../playback/v3/<id>/web/<tarayıcı>/play"
   adresinden bir JSON alır; içinde tüm dillerdeki altyazı dosyalarının
   adresleri ("subtitles" / "captions") ve videoya gömülü altyazılı akışlar
   ("hardSubs") bulunur. Bu betik:
     1) fetch/XHR yanıtlarını okuyup altyazı listesini yakalar,
     2) istenirse gömülü altyazılı akışları temiz akışla değiştirir.
   İzole içerik betiğiyle document üzerindeki CustomEvent'lerle konuşur.
   ========================================================= */
(() => {
  const MARK = Symbol.for('crds.hook');
  if (window[MARK]) return;
  window[MARK] = true;

  const EVT_OUT = 'crds:hook';
  const EVT_REPLAY = 'crds:replay';
  const FLAG_STRIP = 'data-crds-strip';
  const TRACK_KEYS = { subtitles: 'subtitles', captions: 'captions', closed_captions: 'captions', closedcaptions: 'captions' };
  const MAX_JSON_BYTES = 3e6;

  let lastPayload = null;

  function emit(type, data) {
    try {
      document.dispatchEvent(new CustomEvent(EVT_OUT, { detail: JSON.stringify({ type, data }) }));
    } catch (_) {
      /* belge henüz hazır değilse sessizce geç */
    }
  }

  // İçerik betiği geç yüklenirse son bulunan listeyi yeniden ister
  document.addEventListener(EVT_REPLAY, () => {
    if (lastPayload) emit('tracks', lastPayload);
  });

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

  function safeParse(text) {
    try {
      return JSON.parse(text);
    } catch (_) {
      return null;
    }
  }

  function absoluteUrl(url) {
    try {
      return new URL(url, location.href);
    } catch (_) {
      return null;
    }
  }

  /* ---------- Altyazı listesini JSON içinden çıkar ---------- */

  // "subtitles" / "captions" anahtarlarını her derinlikte arar. Hem
  // { "en-US": { language, format, url } } haritasını hem de dizi biçimini tanır.
  function extractTracks(root) {
    const tracks = [];
    const seen = new Set();
    const visit = (node, depth) => {
      if (!node || typeof node !== 'object' || depth > 7) return;
      if (Array.isArray(node)) {
        for (const item of node) visit(item, depth + 1);
        return;
      }
      for (const [key, value] of Object.entries(node)) {
        const kind = TRACK_KEYS[key.toLowerCase()];
        if (kind && value && typeof value === 'object') {
          const entries = Array.isArray(value) ? value.map((v) => [null, v]) : Object.entries(value);
          for (const [mapKey, entry] of entries) {
            if (!entry || typeof entry !== 'object') continue;
            const url = typeof entry.url === 'string' ? entry.url : '';
            if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
            seen.add(url);
            tracks.push({
              lang: String(entry.language || entry.locale || entry.lang || mapKey || 'unknown'),
              url,
              format: String(entry.format || entry.type || '').toLowerCase(),
              kind,
              title: String(entry.title || entry.name || ''),
            });
          }
        } else if (value && typeof value === 'object') {
          visit(value, depth + 1);
        }
      }
    };
    visit(root, 0);
    return tracks;
  }

  // .../playback/v3/GG1U2J3XV/web/chrome/play → GG1U2J3XV
  function contentIdFrom(url) {
    const m = /\/([A-Z0-9]{8,14})\/[a-z_]+\/[a-z_]+\/play\b/i.exec(url);
    return m ? m[1].toUpperCase() : null;
  }

  function buildPayload(url, data) {
    const tracks = extractTracks(data);
    if (!tracks.length) return null;
    const contentId = contentIdFrom(url);
    return {
      id: `${contentId || 'x'}:${hash(tracks.map((t) => t.url).join('|'))}`,
      contentId,
      audioLocale: data.audioLocale || data.audio_locale || null,
      source: url.split('?')[0],
      tracks,
      at: Date.now(),
    };
  }

  function publish(payload) {
    if (lastPayload && lastPayload.id === payload.id) return;
    lastPayload = payload;
    emit('tracks', payload);
  }

  /* ---------- Gömülü altyazıyı (hardsub) kaldırma ---------- */

  // İçerik betiği ayarı <html data-crds-strip="1|0"> olarak yazar. Ayar
  // henüz gelmediyse kısa bir süre bekler.
  function stripWanted() {
    const read = () => (document.documentElement ? document.documentElement.getAttribute(FLAG_STRIP) : null);
    const now = read();
    if (now !== null) return Promise.resolve(now === '1');
    return new Promise((resolve) => {
      const started = Date.now();
      const timer = setInterval(() => {
        const v = read();
        if (v !== null || Date.now() - started > 2000) {
          clearInterval(timer);
          resolve(v === '1');
        }
      }, 25);
    });
  }

  // Tüm altyazılı akış adreslerini temiz ("none") akışla değiştirir.
  // Değiştirilen adres sayısını döndürür.
  function rewriteHardsubs(data) {
    const hardSubs = data && (data.hardSubs || data.hard_subs);
    if (!hardSubs || typeof hardSubs !== 'object') return 0;
    const clean = (hardSubs.none && typeof hardSubs.none.url === 'string' && hardSubs.none.url) ||
      (!data.burnedInLocale && typeof data.url === 'string' ? data.url : null);
    if (!clean) return 0;
    let changed = 0;
    for (const [key, entry] of Object.entries(hardSubs)) {
      if (key === 'none' || !entry || typeof entry !== 'object' || typeof entry.url !== 'string') continue;
      if (entry.url !== clean) {
        entry.url = clean;
        changed++;
      }
    }
    if (typeof data.url === 'string' && data.burnedInLocale && data.url !== clean) {
      data.url = clean;
      data.burnedInLocale = '';
      changed++;
    }
    return changed;
  }

  function withBody(res, body) {
    const headers = new Headers(res.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    const out = new Response(body, { status: res.status, statusText: res.statusText, headers });
    for (const prop of ['url', 'redirected']) {
      try {
        Object.defineProperty(out, prop, { value: res[prop] });
      } catch (_) {
        /* salt okunur özellik tanımlanamadıysa önemli değil */
      }
    }
    return out;
  }

  /* ---------- İstekleri izleme ---------- */

  function isWatched(u) {
    return !!u && (u.origin === location.origin || /(^|\.)(crunchyroll\.com|crunchyrollsvc\.com|vrv\.co)$/i.test(u.hostname));
  }

  function isPlayback(u) {
    return /\/play$/i.test(u.pathname) || (/\/playback\/v\d+\//i.test(u.pathname) && !/\/token\//i.test(u.pathname));
  }

  function scan(url, text) {
    if (!text || (text.indexOf('"subtitles"') < 0 && text.indexOf('"captions"') < 0)) return;
    const data = safeParse(text);
    const payload = data && buildPayload(url, data);
    if (payload) publish(payload);
  }

  async function handleFetchResponse(res, u) {
    if (!res || !res.ok || res.type === 'opaque') return res;
    if (!/json/i.test(res.headers.get('content-type') || '')) return res;
    if (Number(res.headers.get('content-length') || 0) > MAX_JSON_BYTES) return res;

    // Diğer JSON yanıtları sayfayı bekletmeden arka planda taranır
    if (!isPlayback(u)) {
      res.clone().text().then((t) => scan(u.href, t)).catch(() => {});
      return res;
    }

    const data = safeParse(await res.clone().text());
    const payload = data && buildPayload(u.href, data);
    if (!payload) return res;
    publish(payload);

    // Gömülü altyazıyı ancak kendi çizebileceğimiz bir altyazı varsa kaldır
    if (!(await stripWanted())) return res;
    const changed = rewriteHardsubs(data);
    if (!changed) return res;
    emit('hardsubs-stripped', { count: changed, contentId: payload.contentId });
    return withBody(res, JSON.stringify(data));
  }

  const nativeFetch = window.fetch;
  if (typeof nativeFetch === 'function') {
    const fetch = function (input, init) {
      const promise = nativeFetch.apply(this, arguments);
      let u = null;
      let method = 'GET';
      try {
        const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : (input && input.url) || '';
        u = absoluteUrl(raw);
        method = String((init && init.method) || (input && typeof input === 'object' && input.method) || 'GET').toUpperCase();
      } catch (_) {
        u = null;
      }
      if (method !== 'GET' || !isWatched(u)) return promise;
      return promise.then((res) => handleFetchResponse(res, u).catch(() => res));
    };
    try {
      Object.defineProperty(fetch, 'toString', { value: () => nativeFetch.toString() });
    } catch (_) {
      /* önemsiz */
    }
    window.fetch = fetch;
  }

  const XHR = window.XMLHttpRequest;
  if (XHR && XHR.prototype) {
    const nativeOpen = XHR.prototype.open;
    const nativeSend = XHR.prototype.send;
    const onLoad = function () {
      try {
        if (!/json/i.test(this.getResponseHeader('content-type') || '')) return;
        let text = null;
        if (this.responseType === '' || this.responseType === 'text') text = this.responseText;
        else if (this.responseType === 'json' && this.response) text = JSON.stringify(this.response);
        if (text && text.length <= MAX_JSON_BYTES) scan(this.responseURL || this.__crdsUrl.href, text);
      } catch (_) {
        /* okunamayan yanıtları yok say */
      }
    };
    XHR.prototype.open = function (method, url) {
      try {
        this.__crdsUrl = absoluteUrl(String(url));
        this.__crdsMethod = String(method || 'GET').toUpperCase();
      } catch (_) {
        this.__crdsUrl = null;
      }
      return nativeOpen.apply(this, arguments);
    };
    XHR.prototype.send = function () {
      if (this.__crdsMethod === 'GET' && isWatched(this.__crdsUrl)) this.addEventListener('load', onLoad);
      return nativeSend.apply(this, arguments);
    };
  }
})();
