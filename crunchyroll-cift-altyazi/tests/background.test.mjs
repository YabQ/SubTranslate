// Arka plan servis çalışanı için testler: sahte chrome API'siyle modülü
// yükler ve mesaj işleyicilerini çağırır (node --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';

const listeners = {};
const sent = [];
const badges = [];
const grantedOrigins = new Set();
const onEvent = (name) => ({ addListener: (fn) => { listeners[name] = fn; } });
function area() {
  const data = {};
  return {
    data,
    async get(keys) {
      const list = keys == null ? Object.keys(data) : [].concat(keys);
      return Object.fromEntries(list.filter((k) => k in data).map((k) => [k, structuredClone(data[k])]));
    },
    async set(obj) {
      for (const [k, v] of Object.entries(obj)) data[k] = structuredClone(v);
    },
    async remove(keys) {
      for (const k of [].concat(keys)) delete data[k];
    },
  };
}

globalThis.chrome = {
  storage: { local: area(), session: area(), onChanged: onEvent('storage') },
  runtime: { onMessage: onEvent('message') },
  tabs: { onRemoved: onEvent('removed'), sendMessage: async (...args) => { sent.push(args); } },
  action: { setBadgeText: async (o) => { badges.push(o); }, setBadgeBackgroundColor: async () => {} },
  commands: { onCommand: onEvent('command') },
  permissions: { contains: async ({ origins }) => origins.every((o) => grantedOrigins.has(o)) },
};

await import('../src/background/background.js');

const SENDER = { tab: { id: 5, title: 'Watch Frieren: Beyond Journey’s End - Crunchyroll' }, frameId: 0 };
function call(msg, sender = SENDER) {
  return new Promise((resolve) => {
    const async = listeners.message(msg, sender, resolve);
    if (async !== true) setTimeout(() => resolve(undefined), 20);
  });
}

const PAYLOAD = { id: 'G1:abc', contentId: 'G1', tracks: [{ lang: 'en-US', url: 'https://v.vrv.co/en.txt', format: 'ass', kind: 'subtitles' }] };

test('altyazı listesi saklanır, çerçevelere bir kez duyurulur', async () => {
  await call({ type: 'tracks', data: PAYLOAD });
  await call({ type: 'tracks', data: PAYLOAD });
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0], [5, { type: 'tracks', data: PAYLOAD }]);
  assert.deepEqual(await call({ type: 'get-tracks' }), PAYLOAD);
  assert.equal(await call({ type: 'get-tracks' }, { tab: { id: 99 } }), null);
});

test('durum raporu saklanır ve rozet çeviri yüzdesini gösterir', async () => {
  const status = { at: Date.now(), video: true, phase: 'ready', secondary: { mode: 'translate', done: 30, total: 120, finished: false } };
  await call({ type: 'status', data: status });
  const tab = chrome.storage.session.data['tab:5'];
  assert.deepEqual(tab.frames[0], status);
  assert.deepEqual(badges.at(-1), { tabId: 5, text: '25%' });

  await call({ type: 'status', data: { ...status, secondary: { ...status.secondary, error: 'x' } } });
  assert.equal(badges.at(-1).text, '!');

  listeners.removed(5);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(chrome.storage.session.data['tab:5'], undefined, 'sekme kapanınca temizlenir');
});

test('altyazı indirme vekili yalnızca host izni olan crunchyroll.com adreslerine gider', async () => {
  globalThis.fetch = async (url) => new Response(`içerik:${url}`);
  const ok = await call({ type: 'fetch-text', url: 'https://static.crunchyroll.com/subs/en.ass?sig=1' });
  assert.deepEqual(ok, { ok: true, text: 'içerik:https://static.crunchyroll.com/subs/en.ass?sig=1' });
  for (const url of ['https://evil.example/x', 'https://v.vrv.co/evs3/x/en.txt', 'https://crunchyroll.com.evil.example/x']) {
    const bad = await call({ type: 'fetch-text', url });
    assert.equal(bad.ok, false, url);
    assert.match(bad.error, /izin verilmeyen/);
  }
  assert.equal((await call({ type: 'fetch-text', url: 'http://www.crunchyroll.com/x' })).ok, false, 'http reddedilir');
});

test('DeepL ve Claude isteğe bağlı izin verilmeden çağrılmaz', async () => {
  let fetched = 0;
  globalThis.fetch = async () => {
    fetched++;
    return new Response('{}', { headers: { 'content-type': 'application/json' } });
  };
  for (const provider of ['deepl', 'claude']) {
    const res = await call({ type: 'translate', provider, texts: ['Hi.'], source: 'en-US', target: 'tr' });
    assert.equal(res.ok, false);
    assert.equal(res.fatal, true);
    assert.match(res.error, /izin verilmemiş/);
  }
  assert.equal(fetched, 0, 'izin yokken ağ isteği gitmemeli');

  // İzin verildikten sonra servis çağrılır (burada anahtar olmadığı için anahtar hatası beklenir)
  grantedOrigins.add('https://api-free.deepl.com/*');
  grantedOrigins.add('https://api.deepl.com/*');
  const res = await call({ type: 'translate', provider: 'deepl', texts: ['Hi.'], source: 'en-US', target: 'tr' });
  assert.match(res.error, /anahtarı girilmemiş/);
});

test('çeviri isteği ayarlarla birlikte servise gider, hata bilgisi taşınır', async () => {
  globalThis.fetch = async (url, init) => {
    const q = decodeURIComponent(init.body.slice(2));
    return new Response(JSON.stringify({ sentences: [{ trans: q.split('\n').map((l) => `TR:${l}`).join('\n') }] }), { headers: { 'content-type': 'application/json' } });
  };
  const res = await call({ type: 'translate', provider: 'google', texts: ['Hi.', 'Bye.'], source: 'en-US', target: 'tr', context: [] });
  assert.deepEqual(res, { ok: true, translations: ['TR:Hi.', 'TR:Bye.'] });

  const noKey = await call({ type: 'translate', provider: 'deepl', texts: ['Hi.'], source: 'en-US', target: 'tr' });
  assert.equal(noKey.ok, false);
  assert.equal(noKey.fatal, true);
  assert.equal(noKey.retryable, false);
});

test('önbellek: yaz, oku, 80 bölümden fazlasını at, temizle', async () => {
  assert.equal(await call({ type: 'cache-get', key: 'k1' }), null);
  assert.equal(await call({ type: 'cache-put', key: 'k1', value: ['a', 'b'] }), true);
  assert.deepEqual(await call({ type: 'cache-get', key: 'k1' }), ['a', 'b']);
  for (let i = 2; i <= 85; i++) await call({ type: 'cache-put', key: `k${i}`, value: [String(i)] });
  assert.equal(await call({ type: 'cache-get', key: 'k1' }), null, 'en eskisi atılır');
  assert.deepEqual(await call({ type: 'cache-get', key: 'k85' }), ['85']);
  assert.equal(chrome.storage.local.data.tcIndex.length, 80);
  assert.equal(await call({ type: 'cache-clear' }), 80);
  assert.equal(await call({ type: 'cache-get', key: 'k85' }), null);
});

test('klavye kısayolları ayarları değiştirir', async () => {
  await listeners.command('toggle-overlay');
  assert.equal(chrome.storage.local.data.settings.enabled, false);
  await listeners.command('toggle-translation');
  assert.equal(chrome.storage.local.data.settings.showTranslation, false);
  await listeners.command('toggle-overlay');
  assert.equal(chrome.storage.local.data.settings.enabled, true);
});
