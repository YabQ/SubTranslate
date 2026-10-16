/* =========================================================
   i18n.js — Arayüz dili.
   Varsayılan olarak tarayıcının dili kullanılır; kullanıcı menüden
   başka bir dil seçerse o dil geçerli olur. chrome.i18n yalnızca
   tarayıcının dilini verdiği için metinler _locales altından elle
   okunur; böylece seçim anında değişebilir.
   ========================================================= */
(() => {
  const CRDS = (globalThis.CRDS = globalThis.CRDS || {});

  // Dil kodları BCP-47 biçiminde tutulur (pt-BR); klasör ve anahtar adı için
  // fileId() ile alt çizgiye çevrilir
  const SUPPORTED = ['en', 'tr', 'de', 'es', 'fr', 'pt-BR'];
  const FALLBACK = 'en';

  // Küçük harfli koddan asıl yazımına: 'pt-br' → 'pt-BR'
  const BY_TAG = new Map(SUPPORTED.map((code) => [code.toLowerCase(), code]));

  let messages = {};
  let active = FALLBACK;

  // Chrome klasör adlarında ve mesaj anahtarlarında alt çizgi ister: pt-BR → pt_BR
  function fileId(code) {
    return String(code).replace('-', '_');
  }

  // 'de-DE' → 'de'; 'pt' ya da 'pt-PT' → 'pt-BR'. Bölge tam tutmasa da aynı
  // dilin paketi, İngilizceye düşmekten iyidir.
  function resolve(tag) {
    const want = tag.toLowerCase().replace('_', '-');
    if (BY_TAG.has(want)) return BY_TAG.get(want);
    const base = want.split('-')[0];
    if (!base) return FALLBACK;
    if (BY_TAG.has(base)) return BY_TAG.get(base);
    for (const [key, code] of BY_TAG) {
      if (key.split('-')[0] === base) return code;
    }
    return FALLBACK;
  }

  // 'auto' ise tarayıcının dili, desteklenmiyorsa yedek dil
  function pick(lang) {
    const want = String(lang || 'auto').toLowerCase();
    if (want !== 'auto') return resolve(want);
    let ui = '';
    try {
      ui = chrome.i18n.getUILanguage() || '';
    } catch (_) {
      ui = String(globalThis.navigator ? navigator.language || '' : '');
    }
    return resolve(ui);
  }

  async function fetchBundle(code) {
    const url = chrome.runtime.getURL(`_locales/${fileId(code)}/messages.json`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    // Gelen şey gerçekten bir metin paketi mi: beklenmedik bir yanıt
    // eldeki metinlerin yerine geçmemeli
    const first = data && typeof data === 'object' ? Object.values(data)[0] : null;
    if (!first || typeof first.message !== 'string') throw new Error('bundle');
    return data;
  }

  // Dosya okunamazsa eldeki metinler korunur: boş bir pakete düşmektense
  // bir önceki dil (ya da chrome.i18n) ile devam etmek daha iyidir.
  async function load(lang) {
    const code = pick(lang);
    try {
      messages = await fetchBundle(code);
      active = code;
      return active;
    } catch (_) {
      /* yedek dili dene */
    }
    if (code !== FALLBACK) {
      try {
        messages = await fetchBundle(FALLBACK);
        active = FALLBACK;
      } catch (_err) {
        /* eldekiyle devam */
      }
    }
    return active;
  }

  // $1, $2 … yerine geçen değerler; metin bulunamazsa chrome.i18n denenir
  function t(key, subs) {
    const entry = messages[key];
    const text = entry && typeof entry.message === 'string' ? entry.message : '';
    if (!text) {
      try {
        const native = chrome.i18n.getMessage(key, subs == null ? undefined : [].concat(subs).map(String));
        if (native) return native;
      } catch (_) {
        /* bağlam yok */
      }
      return key;
    }
    const list = subs == null ? [] : [].concat(subs);
    // Yalnızca $1..$9 yer tutucudur; "$0.30" gibi para tutarları olduğu gibi kalır
    return text.replace(/\$([1-9])/g, (_m, i) => {
      const value = list[Number(i) - 1];
      return value == null ? '' : String(value);
    });
  }

  // data-i18n: metin, data-i18n-ph: yer tutucu, data-i18n-title: ipucu
  function apply(root) {
    const scope = root || document;
    // Büyük harf dönüşümü dile duyarlıdır (tr: i → İ); belge dili güncellenir
    if (document.documentElement) document.documentElement.lang = active;
    for (const el of scope.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
    for (const el of scope.querySelectorAll('[data-i18n-ph]')) el.placeholder = t(el.dataset.i18nPh);
    for (const el of scope.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
    const title = scope.querySelector('[data-i18n-doc-title]');
    if (title && scope.ownerDocument !== undefined) document.title = t(title.dataset.i18nDocTitle);
  }

  // Testler ve sahte ortamlar için: paketi doğrudan ver
  function use(bundle, code) {
    messages = bundle && typeof bundle === 'object' ? bundle : {};
    active = code || FALLBACK;
    return active;
  }

  CRDS.i18n = { SUPPORTED, FALLBACK, load, use, t, apply, pick, fileId, get lang() { return active; } };
})();
