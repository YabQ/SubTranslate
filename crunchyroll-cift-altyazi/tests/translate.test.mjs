// Çeviri servisleri için testler: ağ istekleri sahte fetch ile yakalanır (node --test)
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import '../src/shared/settings.js';
import { translate, pickExample } from '../src/background/translate.js';

const DEFAULTS = globalThis.CRDS.settings.DEFAULTS;
let calls = [];
let handler = null;

beforeEach(() => {
  calls = [];
  handler = null;
  globalThis.fetch = async (url, init = {}) => {
    const req = { url: String(url), method: init.method || 'GET', headers: Object.fromEntries(new Headers(init.headers).entries()), body: init.body };
    calls.push(req);
    return handler(req);
  };
});

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const run = (provider, texts, extra = {}) => translate({
  provider, texts, source: 'en-US', target: 'tr', context: [], title: 'Frieren', settings: { ...DEFAULTS, ...(extra.settings || {}) }, keys: extra.keys || {},
});

/* ---------- Google ---------- */

// Sahte Google: her satırın başına "TR:" ekler; merge=false ise satırları birleştirip bozar
function fakeGoogle({ breakNewlines = false } = {}) {
  return (req) => {
    const q = decodeURIComponent(req.body.replace(/^q=/, ''));
    const lines = q.split('\n').map((l) => `TR:${l}`);
    const text = breakNewlines && lines.length > 1 ? lines.join(' ') : lines.join('\n');
    return json({ sentences: [{ trans: text.slice(0, 5), orig: '' }, { trans: text.slice(5), orig: '' }], src: 'en' });
  };
}

test('google: satırlar tek istekte "\\n" ile gider, sıra korunur', async () => {
  handler = fakeGoogle();
  const out = await run('google', ['Hello.', 'How are\nyou?', 'Bye.']);
  assert.deepEqual(out, ['TR:Hello.', 'TR:How are you?', 'TR:Bye.']);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /translate_a\/single\?client=gtx.*&sl=en&tl=tr$/);
  assert.equal(calls[0].method, 'POST');
});

test('google: satır sayısı tutmazsa tek tek çevrilir', async () => {
  handler = fakeGoogle({ breakNewlines: true });
  const out = await run('google', ['One.', 'Two.', 'Three.']);
  assert.deepEqual(out, ['TR:One.', 'TR:Two.', 'TR:Three.']);
  assert.equal(calls.length, 4, '1 toplu + 3 tekli istek');
});

test('google: uzun listeler karakter sınırına göre bölünür', async () => {
  handler = fakeGoogle();
  const texts = Array.from({ length: 150 }, (_, i) => `Line number ${i} with some padding text to be longer.`);
  const out = await run('google', texts);
  assert.equal(out.length, 150);
  assert.equal(out[149], `TR:${texts[149]}`);
  assert.ok(calls.length >= 2);
  for (const c of calls) assert.ok(decodeURIComponent(c.body).length <= 4100);
});

test('google: 429 tekrar denenebilir hata verir', async () => {
  handler = () => new Response('', { status: 429 });
  await assert.rejects(run('google', ['Hi']), (err) => err.retryable === true && err.retryAfter > 0 && !err.fatal);
});

/* ---------- DeepL ---------- */

test('deepl: ücretsiz anahtar api-free uç noktasına gider', async () => {
  handler = (req) => json({ translations: JSON.parse(req.body).text.map((t) => ({ text: `TR:${t}` })) });
  const out = await run('deepl', ['Hello.', 'Bye.'], { keys: { deeplKey: 'abc:fx' } });
  assert.deepEqual(out, ['TR:Hello.', 'TR:Bye.']);
  assert.equal(calls[0].url, 'https://api-free.deepl.com/v2/translate');
  assert.equal(calls[0].headers.authorization, 'DeepL-Auth-Key abc:fx');
  const body = JSON.parse(calls[0].body);
  assert.equal(body.target_lang, 'TR');
  assert.equal(body.source_lang, 'EN');
});

test('deepl: pro anahtar, 50 satırlık paketler; hatalar sınıflandırılır', async () => {
  handler = (req) => json({ translations: JSON.parse(req.body).text.map((t) => ({ text: t })) });
  await run('deepl', Array.from({ length: 120 }, (_, i) => `L${i}`), { keys: { deeplKey: 'pro-key' } });
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, 'https://api.deepl.com/v2/translate');

  handler = () => new Response('', { status: 403 });
  await assert.rejects(run('deepl', ['x'], { keys: { deeplKey: 'bad' } }), (e) => e.fatal && !e.retryable);
  handler = () => new Response('', { status: 456 });
  await assert.rejects(run('deepl', ['x'], { keys: { deeplKey: 'k' } }), (e) => e.fatal && /kota/.test(e.message));
  await assert.rejects(run('deepl', ['x']), (e) => e.fatal && /anahtar/.test(e.message));
});

/* ---------- Gemini ---------- */

const geminiReply = (list) => json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ translations: list }) }] }, finishReason: 'STOP' }] });

test('gemini: anahtar başlıkta gider, yapılandırılmış çıktı istenir', async () => {
  handler = (req) => geminiReply(JSON.parse(req.body).contents[0].parts[0].text.match(/[.*]/s) ? ['Merhaba.', 'Görüşürüz.'] : []);
  const out = await run('gemini', ['Hello.', 'Bye.'], { keys: { geminiKey: 'AIza-test' } });
  assert.deepEqual(out, ['Merhaba.', 'Görüşürüz.']);

  const call = calls[0];
  assert.equal(call.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent');
  assert.equal(call.headers['x-goog-api-key'], 'AIza-test', 'anahtar başlıkta olmalı, adreste değil');
  assert.ok(!call.url.includes('AIza'), 'anahtar adres satırına yazılmamalı');
  const body = JSON.parse(call.body);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(body.generationConfig.responseSchema.required, ['translations']);
  assert.equal(body.safetySettings.length, 4);
  assert.match(body.systemInstruction.parts[0].text, /Frieren/);
});

test('gemini: satır sayısı tutmazsa ikiye bölünür, model ayardan gelir', async () => {
  handler = (req) => {
    const text = JSON.parse(req.body).contents[0].parts[0].text;
    const count = (text.match(/Translate these (\d+) lines/) || [])[1];
    return geminiReply(count === '4' ? ['tek satır'] : Array.from({ length: Number(count) }, (_, i) => 'T' + i));
  };
  const out = await run('gemini', ['a', 'b', 'c', 'd'], { keys: { geminiKey: 'k' }, settings: { geminiModel: 'gemini-3.8-flash' } });
  assert.deepEqual(out, ['T0', 'T1', 'T0', 'T1']);
  assert.ok(calls[0].url.includes('gemini-3.8-flash'));
  assert.equal(calls.length, 3);
});

test('gemini: hatalar Türkçe ve doğru sınıfta', async () => {
  handler = () => json({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.' } }, 400);
  await assert.rejects(run('gemini', ['x'], { keys: { geminiKey: 'bad' } }), (e) => e.fatal && /anahtar/.test(e.message));

  handler = () => json({ error: { code: 429, message: 'Quota exceeded' } }, 429);
  await assert.rejects(run('gemini', ['x'], { keys: { geminiKey: 'k' } }), (e) => e.retryable && e.retryAfter > 0);

  handler = () => json({ error: { code: 503 } }, 503);
  await assert.rejects(run('gemini', ['x'], { keys: { geminiKey: 'k' } }), (e) => e.retryable);

  await assert.rejects(run('gemini', ['x']), (e) => e.fatal && /anahtar/.test(e.message));
});

/* ---------- Claude ---------- */

function claudeReply(translations, stop = 'end_turn') {
  return json({
    id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5', stop_reason: stop,
    content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'text', text: JSON.stringify({ translations }) }],
    usage: { input_tokens: 10, output_tokens: 10 },
  });
}

test('claude (Opus 5): yapılandırılmış çıktı, düşük effort ve yedek model', async () => {
  handler = (req) => claudeReply(JSON.parse(JSON.parse(req.body).messages[0].content.split('\n').pop()).map((t) => `TR:${t}`));
  const out = await run('claude', ['Hello.', 'Bye.'], { keys: { claudeKey: 'sk-ant-test' }, settings: { llmInstructions: 'Samimi ol.' } });
  assert.deepEqual(out, ['TR:Hello.', 'TR:Bye.']);

  const req = calls[0];
  assert.equal(req.url, 'https://api.anthropic.com/v1/messages?beta=true');
  assert.equal(req.headers['x-api-key'], 'sk-ant-test');
  assert.equal(req.headers['anthropic-version'], '2023-06-01');
  assert.equal(req.headers['anthropic-dangerous-direct-browser-access'], 'true');
  assert.equal(req.headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  const body = JSON.parse(req.body);
  assert.equal(body.model, 'claude-opus-5');
  assert.equal(body.fallbacks, 'default');
  assert.equal(body.output_config.effort, 'low');
  assert.equal(body.output_config.format.type, 'json_schema');
  assert.deepEqual(body.output_config.format.schema.required, ['translations']);
  assert.match(body.system, /into Turkish/);
  assert.match(body.system, /Frieren/);
  assert.match(body.system, /Samimi ol\./);
});

test('claude (Haiku 4.5): effort ve fallbacks gönderilmez', async () => {
  handler = () => claudeReply(['TR']);
  await run('claude', ['Hi'], { keys: { claudeKey: 'k' }, settings: { claudeModel: 'claude-haiku-4-5' } });
  const body = JSON.parse(calls[0].body);
  assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages');
  assert.equal(body.model, 'claude-haiku-4-5');
  assert.equal(body.fallbacks, undefined);
  assert.equal(body.output_config.effort, undefined);
});

test('claude: satır sayısı tutmazsa ikiye bölüp yeniden dener', async () => {
  handler = (req) => {
    const lines = JSON.parse(JSON.parse(req.body).messages[0].content.split('\n').pop());
    return claudeReply(lines.length > 2 ? ['only one'] : lines.map((t) => `TR:${t}`));
  };
  const out = await run('claude', ['a', 'b', 'c', 'd'], { keys: { claudeKey: 'k' } });
  assert.deepEqual(out, ['TR:a', 'TR:b', 'TR:c', 'TR:d']);
  assert.equal(calls.length, 3);
  assert.match(JSON.parse(calls[2].body).messages[0].content, /Earlier lines/, 'ikinci yarı bağlam alır');
});

test('claude: hatalar Türkçe ve doğru sınıfta', async () => {
  handler = () => json({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 401);
  await assert.rejects(run('claude', ['x'], { keys: { claudeKey: 'bad' } }), (e) => e.fatal && /geçersiz/.test(e.message));

  handler = () => claudeReply([], 'refusal');
  await assert.rejects(run('claude', ['x'], { keys: { claudeKey: 'k' } }), (e) => /reddetti/.test(e.message) && !e.retryable);

  await assert.rejects(run('claude', ['x']), (e) => e.fatal && /anahtar/.test(e.message));
});

test('pickExample: tam cümleye benzeyen örnek seçilir', () => {
  const examples = [
    "he bellowed something Jess couldn't catch",
    'He ran fast enough to catch the last train.',
    'catch',
    'She will catch the ball.',
  ];
  assert.equal(
    pickExample(examples, 'catch', ''),
    'He ran fast enough to catch the last train.',
    'büyük harfle başlayıp noktayla biten ve makul uzunlukta olan kazanır',
  );
  assert.equal(pickExample(examples, 'letter', ''), '', 'kelimeyi içermeyen örnek seçilmez');
  assert.equal(
    pickExample(['He ran fast enough to catch the last train.'], 'catch', 'he ran fast enough to catch the last train.'),
    '',
    'altyazı satırının kendisi örnek olarak verilmez',
  );
})
