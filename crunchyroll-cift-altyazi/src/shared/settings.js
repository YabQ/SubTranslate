/* =========================================================
   settings.js — Varsayılan ayarlar, doğrulama ve depolama.
   Ayarlar ve API anahtarları chrome.storage.local'da tutulur (sync'in
   dakika başına yazma kotası kaydırıcılarla hızla dolardı).
   ========================================================= */
(() => {
  const CRDS = (globalThis.CRDS = globalThis.CRDS || {});
  const KEY = 'settings';

  const PROVIDERS = ['google', 'deepl', 'claude', 'gemini'];

  // Bu servisler manifest'te isteğe bağlı izindir (optional_host_permissions);
  // kullanıcı servisi seçtiğinde popup'tan istenir.
  const PROVIDER_ORIGINS = {
    deepl: ['https://api-free.deepl.com/*', 'https://api.deepl.com/*'],
    claude: ['https://api.anthropic.com/*'],
    gemini: ['https://generativelanguage.googleapis.com/*'],
  };

  // Ücretsiz katmanda hangi modelin açık olduğu ve sınırları Google AI Studio'da görünür
  const GEMINI_MODELS = [
    { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash — en iyi kalite' },
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash — dengeli' },
    { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite — en hızlı, en geniş kota' },
  ];

  const CLAUDE_MODELS = [
    { id: 'claude-opus-5', label: 'Claude Opus 5 — en iyi kalite' },
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 — dengeli' },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — en hızlı / ucuz' },
  ];

  const DEFAULTS = Object.freeze({
    enabled: true,
    primaryLang: 'en-US',        // Üstte gösterilecek orijinal Crunchyroll altyazısı
    targetLang: 'tr',            // Çeviri dili
    preferOfficial: true,        // Hedef dilde resmi CR altyazısı varsa çeviri yerine onu kullan
    provider: 'google',          // google | deepl | claude
    claudeModel: 'claude-opus-5',
    geminiModel: 'gemini-3.5-flash',
    llmInstructions: '',         // Claude / Gemini için ek çeviri talimatları (üslup, onur ekleri vb.)
    mergeSentences: true,        // Satırlara bölünmüş cümleleri tek parça çevir
    showOriginal: true,
    showTranslation: true,
    showSigns: true,             // Tabela / ekran yazılarını (ve çevirilerini) üstte göster
    wordLookup: true,            // Kelimenin üzerine gelince anlamı + çevirideki karşılığı
    notebook: true,              // Kelimeye tıklayınca kelime defterine kaydet
    translationOnTop: true,      // Çeviri satırı orijinalin üstünde mi?
    stripHardsubs: true,         // Crunchyroll'un videoya gömdüğü altyazıyı kaldır (temiz görüntü)
    hideNativeSubs: true,        // Oynatıcının kendi altyazı katmanını gizle
    liftWithControls: true,      // Oynatıcı kontrolleri görünürken altyazıyı yukarı kaydır
    fontScale: 1,
    translationScale: 1,
    originalColor: '#ffffff',
    translationColor: '#ffd84d',
    lookupColor: '#4dd2ff',      // Üzerine gelinen kelime ve çevirideki karşılığı
    bgOpacity: 0.35,
    bottomOffset: 7,             // Video yüksekliğinin yüzdesi
    retryToken: 0,               // Popup'taki "Yeniden dene" her basışta değiştirir
  });

  const RANGES = {
    fontScale: [0.5, 2.5],
    translationScale: [0.5, 1.5],
    bgOpacity: [0, 1],
    bottomOffset: [0, 30],
  };

  function sanitize(raw) {
    const out = { ...DEFAULTS };
    if (!raw || typeof raw !== 'object') return out;
    for (const [key, def] of Object.entries(DEFAULTS)) {
      const val = raw[key];
      if (val === undefined || val === null) continue;
      if (typeof def === 'boolean') out[key] = Boolean(val);
      else if (typeof def === 'number') {
        const n = Number(val);
        if (Number.isFinite(n)) {
          const [min, max] = RANGES[key] || [-Infinity, Infinity];
          out[key] = Math.min(max, Math.max(min, n));
        }
      } else if (typeof def === 'string') out[key] = String(val);
    }
    if (!PROVIDERS.includes(out.provider)) out.provider = DEFAULTS.provider;
    if (!CLAUDE_MODELS.some((m) => m.id === out.claudeModel)) out.claudeModel = DEFAULTS.claudeModel;
    if (!GEMINI_MODELS.some((m) => m.id === out.geminiModel)) out.geminiModel = DEFAULTS.geminiModel;
    for (const key of ['originalColor', 'translationColor', 'lookupColor']) {
      if (!/^#[0-9a-f]{6}$/i.test(out[key])) out[key] = DEFAULTS[key];
    }
    // Talimatlar önce yalnızca Claude'a aitti; eski kayıt yeni adla taşınır
    if (!raw.llmInstructions && typeof raw.claudeInstructions === 'string') out.llmInstructions = raw.claudeInstructions;
    out.llmInstructions = out.llmInstructions.slice(0, 1500);
    return out;
  }

  async function load() {
    try {
      const res = await chrome.storage.local.get(KEY);
      return sanitize(res[KEY]);
    } catch (_) {
      return { ...DEFAULTS };
    }
  }

  async function save(patch) {
    const next = sanitize({ ...(await load()), ...patch });
    await chrome.storage.local.set({ [KEY]: next });
    return next;
  }

  function onChange(callback) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[KEY]) {
        callback(sanitize(changes[KEY].newValue), sanitize(changes[KEY].oldValue));
      }
    });
  }

  // Bu ayarlardan biri değişince çeviri satırı baştan hazırlanır
  const SECONDARY_KEYS = ['targetLang', 'preferOfficial', 'provider', 'claudeModel', 'geminiModel', 'llmInstructions', 'mergeSentences', 'showTranslation'];

  CRDS.settings = { KEY, DEFAULTS, PROVIDERS, PROVIDER_ORIGINS, CLAUDE_MODELS, GEMINI_MODELS, SECONDARY_KEYS, sanitize, load, save, onChange };
})();
