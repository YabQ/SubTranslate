/* =========================================================
   languages.js — Dil kodları, adları ve karşılaştırma yardımcıları.
   İçerik betiği, arka plan ve popup tarafından ortak kullanılır.
   ========================================================= */
(() => {
  const CRDS = (globalThis.CRDS = globalThis.CRDS || {});

  // Crunchyroll'da sık görülen altyazı dilleri (açılır listede bu sırayla)
  const CR_LOCALES = [
    'en-US', 'es-419', 'es-ES', 'pt-BR', 'pt-PT', 'fr-FR', 'de-DE', 'it-IT',
    'ru-RU', 'ar-SA', 'hi-IN', 'id-ID', 'ms-MY', 'th-TH', 'vi-VN', 'zh-CN',
    'zh-HK', 'zh-TW', 'ko-KR', 'ja-JP', 'pl-PL', 'ca-ES', 'ta-IN', 'te-IN', 'tr-TR',
  ];

  // Çeviri hedefi olarak sunulan diller
  const TARGET_LANGS = [
    'tr', 'en', 'de', 'fr', 'es', 'it', 'pt', 'pt-BR', 'ru', 'uk', 'pl', 'nl',
    'az', 'ar', 'fa', 'ja', 'ko', 'zh-CN', 'zh-TW', 'id', 'hi', 'el', 'sv',
    'ro', 'hu', 'cs', 'bg',
  ];

  // 'enUS' / 'en_us' / 'EN-us' → 'en-US', 'esLA' → 'es-419', 'zh-hant' → 'zh-Hant'
  function normalizeLocale(code) {
    if (!code) return '';
    let s = String(code).trim().replace(/_/g, '-');
    if (/^[a-z]{2}[A-Z]{2}$/.test(s)) s = `${s.slice(0, 2)}-${s.slice(2)}`;
    const m = /^([a-zA-Z]{2,3})(?:-([a-zA-Z0-9]{2,8}))?$/.exec(s);
    if (!m) return s.toLowerCase();
    const lang = m[1].toLowerCase();
    let region = m[2] || '';
    if (/^\d+$/.test(region)) {
      // 419 gibi sayısal bölgeler olduğu gibi kalır
    } else if (region.length === 4) {
      region = region[0].toUpperCase() + region.slice(1).toLowerCase();
    } else {
      region = region.toUpperCase();
    }
    if (lang === 'es' && (region === 'LA' || region === 'LATAM')) region = '419';
    return region ? `${lang}-${region}` : lang;
  }

  function baseLang(code) {
    return normalizeLocale(code).split('-')[0];
  }

  // Çince için yazı sistemi: Geleneksel (TW/HK/MO) ya da Basitleştirilmiş
  function zhScript(code) {
    return /-(TW|HK|MO|Hant)$/i.test(normalizeLocale(code)) ? 'Hant' : 'Hans';
  }

  // Hedef dil kodu ile Crunchyroll altyazı dilinin aynı dili gösterip göstermediği.
  // 'tr' ~ 'tr-TR', 'es' ~ 'es-419', 'pt-BR' ≠ 'pt-PT', 'zh-CN' ≠ 'zh-TW'
  function sameLanguage(target, locale) {
    const t = normalizeLocale(target);
    const l = normalizeLocale(locale);
    if (!t || !l || baseLang(t) !== baseLang(l)) return false;
    if (baseLang(t) === 'zh') return zhScript(t) === zhScript(l);
    const region = t.split('-')[1];
    return !region || t === l;
  }

  const displayNames = {};
  function displayName(code, uiLang = 'tr') {
    const c = normalizeLocale(code);
    if (!c || c === 'none' || c === 'unknown') return uiLang === 'tr' ? 'Bilinmeyen dil' : 'Unknown language';
    try {
      displayNames[uiLang] = displayNames[uiLang] || new Intl.DisplayNames([uiLang], { type: 'language' });
      let name = displayNames[uiLang].of(c);
      // "Almanca (Almanya)" gibi gereksiz ülke eklerini at; ama Crunchyroll'da birden
      // fazla çeşidi olan dillerde (es-419/es-ES, pt-BR/pt-PT, zh-*) bölge ayırt edicidir
      const base = baseLang(c);
      const variants = CR_LOCALES.filter((x) => x.split('-')[0] === base).length;
      if (name && / \(.+\)$/.test(name) && variants <= 1 && base !== 'zh') name = displayNames[uiLang].of(base);
      if (name && name.toLowerCase() !== c.toLowerCase()) {
        return name.charAt(0).toLocaleUpperCase(uiLang) + name.slice(1);
      }
    } catch (_) {
      /* tanınmayan kod: aşağıda kodun kendisi döner */
    }
    return c;
  }

  CRDS.lang = { CR_LOCALES, TARGET_LANGS, normalizeLocale, baseLang, sameLanguage, displayName };
})();
