/* =========================================================
   translate.js — Çeviri servisleri (arka plan servis çalışanı).
     google : ücretsiz, anahtar gerektirmez (varsayılan)
     deepl  : DeepL API anahtarı (Free ya da Pro)
     claude : Anthropic API anahtarı, bağlama duyarlı en iyi kalite
   Hepsi aynı sözleşmeyi uygular: n satır alır, sırası korunmuş n çeviri döndürür.
   ========================================================= */
import '../shared/languages.js';
import Anthropic from './vendor/anthropic-sdk.mjs';

const L = globalThis.CRDS.lang;

export class TranslateError extends Error {
  constructor(message, { retryable = true, fatal = false, retryAfter = 0 } = {}) {
    super(message);
    this.retryable = retryable;
    this.fatal = fatal;
    this.retryAfter = retryAfter;
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

let englishNames = null;
function englishName(code) {
  try {
    englishNames = englishNames || new Intl.DisplayNames(['en'], { type: 'language' });
    return englishNames.of(L.normalizeLocale(code)) || code;
  } catch (_) {
    return code;
  }
}

/* ---------- Google Çeviri (ücretsiz uç nokta) ---------- */

const GOOGLE_URL = 'https://translate.googleapis.com/translate_a/single';
const GOOGLE_MAX_CHARS = 4000;
const GOOGLE_MAX_LINES = 80;

function googleCode(code) {
  const c = L.normalizeLocale(code);
  if (!c || c === 'auto' || c === 'unknown') return 'auto';
  const base = L.baseLang(c);
  if (base === 'zh') return /-(TW|HK|MO|Hant)$/i.test(c) ? 'zh-TW' : 'zh-CN';
  if (c === 'pt-PT') return 'pt-PT';
  if (base === 'fil') return 'tl';
  return base;
}

async function googleRequest(text, sl, tl) {
  const url = `${GOOGLE_URL}?client=gtx&dt=t&dj=1&ie=UTF-8&oe=UTF-8&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: `q=${encodeURIComponent(text)}`,
      credentials: 'omit',
    });
  } catch (_) {
    throw new TranslateError("Google Çeviri'ye bağlanılamadı");
  }
  if (res.status === 429) throw new TranslateError('Google Çeviri istek sınırına ulaşıldı, birazdan tekrar denenecek', { retryAfter: 8000 });
  if (!res.ok) throw new TranslateError(`Google Çeviri hatası (HTTP ${res.status})`, { retryable: res.status >= 500 });
  const data = await res.json();
  return (data.sentences || []).map((s) => s.trans || '').join('');
}

// Satırlar "\n" ile birleştirilip tek istekte çevrilir; satır sayısı tutmazsa
// o grup satır satır yeniden çevrilir.
async function google(texts, source, target) {
  const sl = googleCode(source);
  const tl = googleCode(target);
  const out = new Array(texts.length);
  let start = 0;
  while (start < texts.length) {
    let end = start;
    let chars = 0;
    while (end < texts.length && end - start < GOOGLE_MAX_LINES && (end === start || chars + texts[end].length + 1 <= GOOGLE_MAX_CHARS)) {
      chars += texts[end].length + 1;
      end++;
    }
    const part = texts.slice(start, end);
    let lines = (await googleRequest(part.join('\n'), sl, tl)).split('\n');
    if (lines.length !== part.length) lines = await mapLimit(part, 3, (t) => googleRequest(t, sl, tl));
    lines.forEach((line, i) => {
      out[start + i] = line.trim();
    });
    start = end;
  }
  return out;
}

/* ---------- DeepL ---------- */

const DEEPL_SOURCES = new Set(['AR', 'BG', 'CS', 'DA', 'DE', 'EL', 'EN', 'ES', 'ET', 'FI', 'FR', 'HE', 'HU', 'ID', 'IT', 'JA', 'KO', 'LT', 'LV', 'NB', 'NL', 'PL', 'PT', 'RO', 'RU', 'SK', 'SL', 'SV', 'TH', 'TR', 'UK', 'VI', 'ZH']);

function deeplTarget(code) {
  const c = L.normalizeLocale(code);
  const base = L.baseLang(c).toUpperCase();
  if (base === 'EN') return c === 'en-GB' ? 'EN-GB' : 'EN-US';
  if (base === 'PT') return c === 'pt-PT' ? 'PT-PT' : 'PT-BR';
  if (base === 'ZH') return /-(TW|HK|MO|Hant)$/i.test(c) ? 'ZH-HANT' : 'ZH-HANS';
  return base;
}

async function deepl(texts, source, target, apiKey, context) {
  const key = (apiKey || '').trim();
  if (!key) throw new TranslateError('DeepL API anahtarı girilmemiş (eklenti menüsünden ekleyin)', { retryable: false, fatal: true });
  const endpoint = key.endsWith(':fx') ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';
  const sourceLang = L.baseLang(source).toUpperCase();
  const out = [];
  for (let i = 0; i < texts.length; i += 50) {
    const body = { text: texts.slice(i, i + 50), target_lang: deeplTarget(target), preserve_formatting: true };
    if (DEEPL_SOURCES.has(sourceLang)) body.source_lang = sourceLang;
    if (context && context.length) body.context = context.join('\n');
    let res;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'omit',
      });
    } catch (_) {
      throw new TranslateError('DeepL sunucusuna bağlanılamadı');
    }
    if (res.status === 401 || res.status === 403) throw new TranslateError('DeepL API anahtarı geçersiz', { retryable: false, fatal: true });
    if (res.status === 456) throw new TranslateError('DeepL karakter kotası doldu', { retryable: false, fatal: true });
    if (res.status === 429) throw new TranslateError('DeepL istek sınırına ulaşıldı, birazdan tekrar denenecek', { retryAfter: 8000 });
    if (!res.ok) throw new TranslateError(`DeepL hatası (HTTP ${res.status})`, { retryable: res.status >= 500 });
    const data = await res.json();
    out.push(...(data.translations || []).map((t) => t.text || ''));
  }
  if (out.length !== texts.length) throw new TranslateError('DeepL beklenmeyen bir yanıt döndürdü');
  return out;
}

/* ---------- Claude (Anthropic API) ---------- */

const EFFORT_MODELS = new Set(['claude-opus-5', 'claude-sonnet-5']);
const FALLBACK_MODELS = new Set(['claude-opus-5']);
const CLAUDE_SCHEMA = {
  type: 'object',
  properties: { translations: { type: 'array', items: { type: 'string' } } },
  required: ['translations'],
  additionalProperties: false,
};

function claudeSystem(source, target, title, instructions) {
  const src = source && source !== 'auto' ? englishName(source) : 'the original language';
  const tgt = englishName(target);
  return [
    `You translate ${title ? `the subtitles of the anime "${title}"` : 'anime subtitles'} from ${src} into ${tgt}.`,
    `Return a JSON object whose "translations" array holds exactly one ${tgt} string per input line, in the same order.`,
    'Write natural, conversational subtitles that fit each speaker and the scene, short enough to read at a glance.',
    'A sentence may continue across consecutive lines; translate so that each line still reads naturally on its own.',
    'Keep character names as they are, and keep Japanese honorifics such as -san, -kun, -chan, -sama, -senpai and -sensei.',
    'Leave lines that are only names, sound effects or music notes unchanged unless they have a natural equivalent.',
    instructions ? `\nThe viewer's own preferences, which take priority over the style notes above:\n${instructions}` : '',
  ].filter(Boolean).join('\n');
}

function claudeUser(texts, context) {
  const parts = [];
  if (context && context.length) parts.push(`Earlier lines, for context only (do not translate them):\n${JSON.stringify(context)}`);
  parts.push(`Translate these ${texts.length} lines:\n${JSON.stringify(texts)}`);
  return parts.join('\n\n');
}

function claudeError(err) {
  if (err instanceof Anthropic.AuthenticationError) return new TranslateError('Claude API anahtarı geçersiz', { retryable: false, fatal: true });
  if (err instanceof Anthropic.PermissionDeniedError) return new TranslateError('Bu API anahtarının seçilen modele erişimi yok', { retryable: false, fatal: true });
  if (err instanceof Anthropic.NotFoundError) return new TranslateError('Seçilen Claude modeli bulunamadı', { retryable: false, fatal: true });
  if (err instanceof Anthropic.RateLimitError) return new TranslateError('Claude istek sınırına ulaşıldı, birazdan tekrar denenecek', { retryAfter: 15000 });
  if (err instanceof Anthropic.BadRequestError) return new TranslateError(`Claude isteği kabul etmedi: ${String(err.message).slice(0, 160)}`, { retryable: false });
  if (err instanceof Anthropic.APIConnectionError) return new TranslateError('Claude sunucusuna bağlanılamadı');
  if (err instanceof Anthropic.APIError) {
    if (err.type === 'billing_error' || err.status === 402) return new TranslateError('Anthropic hesabında yeterli kredi yok', { retryable: false, fatal: true });
    return new TranslateError(`Claude API hatası (${err.status || 'bilinmiyor'})`, { retryable: !err.status || err.status >= 500 });
  }
  return new TranslateError(String((err && err.message) || err));
}

async function claudeChunk(client, texts, source, target, opts, depth) {
  const params = {
    model: opts.model,
    max_tokens: 16000,
    system: claudeSystem(source, target, opts.title, opts.instructions),
    messages: [{ role: 'user', content: claudeUser(texts, opts.context) }],
    output_config: { format: { type: 'json_schema', schema: CLAUDE_SCHEMA } },
  };
  // Çeviri basit ve yüksek hacimli bir iş: düşük "effort" yeterli ve ucuz
  if (EFFORT_MODELS.has(opts.model)) params.output_config.effort = 'low';

  let response;
  try {
    // Opus 5'te güvenlik sınıflandırıcısı reddederse istek sunucu tarafında yedek modele yönlenir
    response = FALLBACK_MODELS.has(opts.model)
      ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      : await client.messages.create(params);
  } catch (err) {
    throw claudeError(err);
  }
  if (response.stop_reason === 'refusal') throw new TranslateError('Claude bu satırları çevirmeyi reddetti', { retryable: false });

  let list = null;
  if (response.stop_reason !== 'max_tokens') {
    const block = response.content.filter((b) => b.type === 'text').pop();
    try {
      list = JSON.parse(block ? block.text : '').translations;
    } catch (_) {
      list = null;
    }
  }
  if (Array.isArray(list) && list.length === texts.length && list.every((x) => typeof x === 'string')) return list;

  // Satır sayısı tutmadıysa (ya da yanıt yarım kaldıysa) ikiye bölüp yeniden dene
  if (texts.length > 1 && depth < 3) {
    const mid = Math.ceil(texts.length / 2);
    const first = await claudeChunk(client, texts.slice(0, mid), source, target, opts, depth + 1);
    const context = [...(opts.context || []), ...texts.slice(0, mid)].slice(-6);
    const second = await claudeChunk(client, texts.slice(mid), source, target, { ...opts, context }, depth + 1);
    return first.concat(second);
  }
  throw new TranslateError('Claude beklenmeyen bir yanıt döndürdü');
}

async function claude(texts, source, target, opts) {
  const apiKey = (opts.apiKey || '').trim();
  if (!apiKey) throw new TranslateError('Claude API anahtarı girilmemiş (eklenti menüsünden ekleyin)', { retryable: false, fatal: true });
  // Anahtar kullanıcının kendi tarayıcısında kalır; istek doğrudan Anthropic'e gider
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2, timeout: 180000 });
  return claudeChunk(client, texts, source, target, opts, 0);
}

/* ---------- Giriş noktası ---------- */

export async function translate({ provider, texts, source, target, context, title, settings, keys }) {
  if (!Array.isArray(texts) || !texts.length) return [];
  const clean = texts.map((t) => String(t || '').replace(/\s*\n\s*/g, ' ').trim());
  if (provider === 'deepl') return deepl(clean, source, target, keys.deeplKey, context);
  if (provider === 'claude') {
    return claude(clean, source, target, {
      apiKey: keys.claudeKey,
      model: settings.claudeModel,
      instructions: settings.claudeInstructions,
      context,
      title,
    });
  }
  return google(clean, source, target);
}
