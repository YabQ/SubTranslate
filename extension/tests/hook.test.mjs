// Sayfa kancası (hook.js) için testler: sahte bir tarayıcı ortamında
// gerçek fetch sarmalayıcısını çalıştırır (node --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const HOOK_SOURCE = readFileSync(new URL('../src/page/hook.js', import.meta.url), 'utf8');
const PLAY_URL = 'https://www.crunchyroll.com/playback/v3/GG1U2J3XV/web/chrome/play';

const PLAYBACK = {
  audioLocale: 'ja-JP',
  burnedInLocale: '',
  url: 'https://cdn.example/clean/manifest.mpd',
  hardSubs: {
    'en-US': { hlang: 'en-US', url: 'https://cdn.example/en/manifest.mpd' },
    'de-DE': { hlang: 'de-DE', url: 'https://cdn.example/de/manifest.mpd' },
    none: { hlang: 'none', url: 'https://cdn.example/clean/manifest.mpd' },
  },
  subtitles: {
    'en-US': { format: 'ass', language: 'en-US', url: 'https://v.vrv.co/evs3/abc/en.txt?sig=1' },
    'es-419': { format: 'ass', language: 'es-419', url: 'https://v.vrv.co/evs3/abc/es.txt?sig=1' },
    none: { format: 'ass', language: 'none' },
  },
  captions: {},
  token: 'tok',
};

function makeEnv({ strip = '1', respond } = {}) {
  const events = [];
  const document = new EventTarget();
  const attrs = strip === null ? {} : { 'data-crds-strip': strip };
  document.documentElement = { getAttribute: (name) => (name in attrs ? attrs[name] : null) };
  document.addEventListener('crds:hook', (e) => events.push(JSON.parse(e.detail)));

  const calls = [];
  const nativeFetch = async (input, init) => {
    calls.push({ input, init });
    return respond(typeof input === 'string' ? input : input.url, init);
  };
  class FakeXHR {
    open() {}
    send() {}
    addEventListener() {}
  }
  const window = {
    fetch: nativeFetch,
    XMLHttpRequest: FakeXHR,
    location: new URL('https://www.crunchyroll.com/watch/GG1U2J3XV/some-episode'),
  };
  const context = vm.createContext({
    window, document, location: window.location, CustomEvent, Response, Headers, URL, Symbol, JSON,
    setInterval, clearInterval, setTimeout, clearTimeout, Promise, Object, Number, String, Math, Date,
  });
  vm.runInContext(HOOK_SOURCE, context);
  return { window, document, events, calls, attrs };
}

const jsonResponse = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

test('playback yanıtından altyazı listesi çıkarılır', async () => {
  const env = makeEnv({ strip: '0', respond: () => jsonResponse(PLAYBACK) });
  const res = await env.window.fetch(PLAY_URL, { headers: { authorization: 'Bearer x' } });
  const body = await res.json();
  assert.deepEqual(body, PLAYBACK, 'ayar kapalıyken yanıt değişmemeli');

  const tracksEvent = env.events.find((e) => e.type === 'tracks');
  assert.ok(tracksEvent, 'tracks olayı yayınlanmalı');
  const { data } = tracksEvent;
  assert.equal(data.contentId, 'GG1U2J3XV');
  assert.equal(data.audioLocale, 'ja-JP');
  assert.deepEqual(data.tracks.map((t) => [t.lang, t.kind, t.format]), [['en-US', 'subtitles', 'ass'], ['es-419', 'subtitles', 'ass']]);
  assert.match(data.id, /^GG1U2J3XV:[0-9a-f]{16}$/);
});

test('gömülü altyazılı akışlar temiz akışla değiştirilir', async () => {
  const env = makeEnv({ strip: '1', respond: () => jsonResponse(structuredClone(PLAYBACK)) });
  const res = await env.window.fetch(PLAY_URL);
  const body = await res.json();
  for (const [lang, entry] of Object.entries(body.hardSubs)) {
    assert.equal(entry.url, 'https://cdn.example/clean/manifest.mpd', `${lang} temiz olmalı`);
  }
  assert.equal(res.status, 200);
  assert.equal(res.url, '', 'sahte Response adresi korunur (burada boş)');
  assert.ok(env.events.some((e) => e.type === 'hardsubs-stripped' && e.data.count === 2));
});

test('üst düzey url gömülüyse o da temizlenir', async () => {
  const data = structuredClone(PLAYBACK);
  data.url = 'https://cdn.example/en/manifest.mpd';
  data.burnedInLocale = 'en-US';
  const env = makeEnv({ strip: '1', respond: () => jsonResponse(data) });
  const body = await (await env.window.fetch(PLAY_URL)).json();
  assert.equal(body.url, 'https://cdn.example/clean/manifest.mpd');
  assert.equal(body.burnedInLocale, '');
});

test('çizilecek altyazı yoksa gömülü altyazıya dokunulmaz', async () => {
  const data = structuredClone(PLAYBACK);
  data.subtitles = { none: { language: 'none', format: 'ass' } };
  const env = makeEnv({ strip: '1', respond: () => jsonResponse(data) });
  const body = await (await env.window.fetch(PLAY_URL)).json();
  assert.equal(body.hardSubs['en-US'].url, 'https://cdn.example/en/manifest.mpd');
  assert.equal(env.events.length, 0);
});

test('ayar henüz gelmediyse kısa süre beklenir', async () => {
  const env = makeEnv({ strip: null, respond: () => jsonResponse(structuredClone(PLAYBACK)) });
  setTimeout(() => {
    env.attrs['data-crds-strip'] = '1';
  }, 100);
  const body = await (await env.window.fetch(PLAY_URL)).json();
  assert.equal(body.hardSubs['en-US'].url, 'https://cdn.example/clean/manifest.mpd');
});

test('ilgisiz istekler bekletilmeden aynen döner', async () => {
  const env = makeEnv({ respond: () => new Response('binary', { headers: { 'content-type': 'video/mp4' } }) });
  const res = await env.window.fetch('https://www.crunchyroll.com/segment.m4s');
  assert.equal(await res.text(), 'binary');

  const env2 = makeEnv({ respond: () => jsonResponse(PLAYBACK) });
  const res2 = await env2.window.fetch(PLAY_URL, { method: 'POST', body: '{}' });
  assert.deepEqual(await res2.json(), PLAYBACK, 'POST istekleri incelenmez');
  assert.equal(env2.events.length, 0);

  const env3 = makeEnv({ respond: () => jsonResponse(PLAYBACK) });
  await env3.window.fetch('https://example.com/playback/v3/GG1U2J3XV/web/chrome/play');
  assert.equal(env3.events.length, 0, 'başka alan adları izlenmez');
});

test('diğer JSON yanıtları arka planda taranır ve replay son listeyi yeniden yollar', async () => {
  const other = { data: [{ streams: { subtitles: [{ locale: 'enUS', url: 'https://v.vrv.co/x/en.vtt', format: 'vtt' }] } }] };
  const env = makeEnv({ respond: () => jsonResponse(other) });
  const res = await env.window.fetch('https://www.crunchyroll.com/content/v2/cms/objects/GG1U2J3XV');
  assert.deepEqual(await res.json(), other);
  await new Promise((r) => setTimeout(r, 20));
  const ev = env.events.find((e) => e.type === 'tracks');
  assert.ok(ev);
  assert.deepEqual(ev.data.tracks[0], { lang: 'enUS', url: 'https://v.vrv.co/x/en.vtt', format: 'vtt', kind: 'subtitles', title: '' });

  env.events.length = 0;
  env.document.dispatchEvent(new CustomEvent('crds:replay'));
  assert.equal(env.events.length, 1);
  assert.equal(env.events[0].type, 'tracks');
});
