/* =========================================================
   background.js — Servis çalışanı (Manifest V3, module).
   - Sekme başına altyazı listesi ve durum (chrome.storage.session)
   - Altyazı dosyası indirme vekili ve çeviri istekleri
   - Bölüm bazlı çeviri önbelleği (chrome.storage.local)
   - Klavye kısayolları ve araç çubuğu rozeti
   ========================================================= */
import '../shared/languages.js';
import '../shared/settings.js';
import { translate } from './translate.js';

const Settings = globalThis.CRDS.settings;

const TAB_PREFIX = 'tab:';
const CACHE_PREFIX = 'tc:';
const CACHE_INDEX = 'tcIndex';
const CACHE_MAX = 80;
// Yalnızca manifest'teki host izniyle erişilebilen alan adları. Altyazı dosyası
// normalde içerik betiğinden indirilir; bu vekil yalnızca yedek yoldur.
const FETCH_HOSTS = /(^|\.)crunchyroll\.com$/i;
const PROVIDER_LABELS = { deepl: 'DeepL', claude: 'Claude' };

// Aynı anahtar üzerindeki oku-değiştir-yaz işlemlerini sıraya koyar
const locks = new Map();
function withLock(key, fn) {
  const run = (locks.get(key) || Promise.resolve()).then(() => fn());
  locks.set(key, run.catch(() => {}));
  return run;
}

/* ---------- Sekme durumu ---------- */

async function getTab(tabId) {
  const key = TAB_PREFIX + tabId;
  const res = await chrome.storage.session.get(key);
  return res[key] || null;
}

function updateTab(tabId, mutate) {
  const key = TAB_PREFIX + tabId;
  return withLock(key, async () => {
    const res = await chrome.storage.session.get(key);
    const next = mutate(res[key] || { tracks: null, frames: {} });
    await chrome.storage.session.set({ [key]: next });
    return next;
  });
}

async function onTracks(tabId, payload) {
  if (!payload || !Array.isArray(payload.tracks)) return;
  let changed = false;
  await updateTab(tabId, (tab) => {
    changed = !tab.tracks || tab.tracks.id !== payload.id;
    return changed ? { ...tab, tracks: payload } : tab;
  });
  // Tüm çerçevelere duyur: video başka bir çerçevedeyse (eski oynatıcı) oradan alınır
  if (changed) chrome.tabs.sendMessage(tabId, { type: 'tracks', data: payload }).catch(() => {});
}

// Videoyu bulan çerçevenin raporu önceliklidir
function pickStatus(tab) {
  const list = Object.values((tab && tab.frames) || {}).sort((a, b) => b.at - a.at);
  return list.find((s) => s.video) || list[0] || null;
}

function updateBadge(tabId, status) {
  let text = '';
  let color = '#f47521';
  const sec = status && status.secondary;
  if (status && (status.phase === 'error' || (sec && sec.error))) {
    text = '!';
    color = '#d93025';
  } else if (sec && sec.mode === 'translate' && !sec.finished && sec.total) {
    text = `${Math.floor((sec.done * 100) / sec.total)}%`;
  }
  chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  if (text) chrome.action.setBadgeBackgroundColor({ tabId, color }).catch(() => {});
}

async function saveStatus(tabId, frameId, status) {
  const tab = await updateTab(tabId, (t) => ({ ...t, frames: { ...(t.frames || {}), [frameId]: status } }));
  updateBadge(tabId, pickStatus(tab));
}

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(TAB_PREFIX + tabId).catch(() => {});
});

/* ---------- Altyazı dosyası indirme vekili ---------- */

async function fetchText(url) {
  let u;
  try {
    u = new URL(url);
  } catch (_) {
    return { ok: false, error: 'geçersiz adres' };
  }
  if (u.protocol !== 'https:' || !FETCH_HOSTS.test(u.hostname)) return { ok: false, error: `izin verilmeyen alan adı: ${u.hostname}` };
  try {
    const res = await fetch(u.href, { credentials: 'omit' });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, text: await res.text() };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

/* ---------- Çeviri ---------- */

function cleanTitle(title) {
  if (!title) return '';
  return title
    .replace(/\s*[-|–]\s*(Watch on\s+|İzle\s+)?Crunchyroll.*$/i, '')
    .replace(/^(Watch|İzle)\s+/i, '')
    .trim()
    .slice(0, 120);
}

async function doTranslate(msg, sender) {
  try {
    // DeepL ve Claude isteğe bağlı izindir; izin yoksa fetch anlaşılmaz bir ağ hatası verir
    const origins = Settings.PROVIDER_ORIGINS[msg.provider];
    if (origins && !(await chrome.permissions.contains({ origins }))) {
      return {
        ok: false,
        error: `${PROVIDER_LABELS[msg.provider]} için izin verilmemiş. Eklenti menüsünde servisi seçip izin ver.`,
        retryable: false,
        fatal: true,
        retryAfter: 0,
      };
    }
    const [settings, keys] = await Promise.all([Settings.load(), chrome.storage.local.get(['deeplKey', 'claudeKey'])]);
    const translations = await translate({
      provider: msg.provider,
      texts: msg.texts,
      source: msg.source,
      target: msg.target,
      context: msg.context || [],
      title: cleanTitle(sender && sender.tab && sender.tab.title),
      settings,
      keys,
    });
    return { ok: true, translations };
  } catch (err) {
    return {
      ok: false,
      error: String((err && err.message) || err),
      retryable: !(err && err.retryable === false),
      fatal: !!(err && err.fatal),
      retryAfter: (err && err.retryAfter) || 0,
    };
  }
}

/* ---------- Çeviri önbelleği (bölüm başına) ---------- */

async function cacheGet(key) {
  const k = CACHE_PREFIX + key;
  const res = await chrome.storage.local.get(k);
  return res[k] ? res[k].v : null;
}

function cachePut(key, value) {
  const k = CACHE_PREFIX + key;
  return withLock('cache', async () => {
    const res = await chrome.storage.local.get(CACHE_INDEX);
    let index = (res[CACHE_INDEX] || []).filter((e) => e.k !== k);
    index.push({ k, t: Date.now() });
    let drop = index.length > CACHE_MAX ? index.slice(0, index.length - CACHE_MAX) : [];
    index = index.slice(drop.length);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (drop.length) await chrome.storage.local.remove(drop.map((e) => e.k));
        await chrome.storage.local.set({ [k]: { v: value, t: Date.now() }, [CACHE_INDEX]: index });
        return;
      } catch (_) {
        // Depolama kotası dolduysa en eski yarıyı silip yeniden dene
        const half = Math.max(1, Math.floor((index.length - 1) / 2));
        drop = index.slice(0, half);
        index = index.slice(half);
      }
    }
  });
}

async function cacheClear() {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith(CACHE_PREFIX) || k === CACHE_INDEX);
  if (keys.length) await chrome.storage.local.remove(keys);
  return keys.filter((k) => k !== CACHE_INDEX).length;
}

/* ---------- Mesajlar ---------- */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab ? sender.tab.id : undefined;
  switch (msg && msg.type) {
    case 'tracks':
      if (tabId !== undefined) onTracks(tabId, msg.data);
      return false;
    case 'get-tracks':
      if (tabId === undefined) return false;
      getTab(tabId).then((tab) => sendResponse((tab && tab.tracks) || null), () => sendResponse(null));
      return true;
    case 'status':
      if (tabId !== undefined) saveStatus(tabId, sender.frameId || 0, msg.data);
      return false;
    case 'fetch-text':
      fetchText(msg.url).then(sendResponse);
      return true;
    case 'translate':
      doTranslate(msg, sender).then(sendResponse);
      return true;
    case 'test-provider':
      doTranslate({ provider: msg.provider, texts: ['Hey, long time no see! How have you been?'], source: 'en-US', target: msg.target }, sender).then(sendResponse);
      return true;
    case 'cache-get':
      cacheGet(msg.key).then(sendResponse, () => sendResponse(null));
      return true;
    case 'cache-put':
      cachePut(msg.key, msg.value).then(() => sendResponse(true), () => sendResponse(false));
      return true;
    case 'cache-clear':
      cacheClear().then(sendResponse, () => sendResponse(0));
      return true;
    default:
      return false;
  }
});

/* ---------- Klavye kısayolları ---------- */

chrome.commands.onCommand.addListener(async (command) => {
  const s = await Settings.load();
  if (command === 'toggle-overlay') await Settings.save({ enabled: !s.enabled });
  else if (command === 'toggle-translation') await Settings.save({ showTranslation: !s.showTranslation });
});
