/* =========================================================
   vocab.js — Kelime defteri: kayıt biçimi ve depolama.
   Kayıtlar chrome.storage.local içinde tek bir dizide durur
   (en yeni başta). Hiçbir kayıt kendiliğinden silinmez;
   silme yalnızca kullanıcının isteğiyle olur.
   ========================================================= */
(() => {
  const CRDS = (globalThis.CRDS = globalThis.CRDS || {});
  const KEY = 'vocab';

  // Google'ın sözlük yanıtındaki kelime türleri
  const POS = {
    noun: 'isim',
    verb: 'fiil',
    adjective: 'sıfat',
    adverb: 'zarf',
    pronoun: 'zamir',
    preposition: 'edat',
    conjunction: 'bağlaç',
    interjection: 'ünlem',
    exclamation: 'ünlem',
    determiner: 'belirteç',
    article: 'tanımlık',
    numeral: 'sayı',
    number: 'sayı',
    abbreviation: 'kısaltma',
    phrase: 'deyim',
    prefix: 'ön ek',
    suffix: 'son ek',
  };

  const clean = (value) => String(value == null ? '' : value).trim();
  const lower = (value) => clean(value).toLocaleLowerCase('tr');

  function posLabel(pos) {
    const key = clean(pos).toLowerCase();
    return POS[key] || (key ? key : '');
  }

  function entryId({ word, source, target }) {
    return `${lower(word)}|${clean(source).toLowerCase()}|${clean(target).toLowerCase()}`;
  }

  // Cümlede kullanılan anlam hangi tür girdisindeyse kelimenin türü odur;
  // eşleşme yoksa sözlüğün ilk (en sık) türü alınır.
  function pickPos(entries, sense) {
    const list = Array.isArray(entries) ? entries : [];
    const want = lower(sense);
    if (want) {
      for (const entry of list) {
        if ((entry.terms || []).some((term) => lower(term) === want)) return posLabel(entry.pos);
      }
    }
    return list.length ? posLabel(list[0].pos) : '';
  }

  function buildEntry(input) {
    const now = Number(input.at) || Date.now();
    const meanings = (input.meanings || []).map(clean).filter(Boolean).slice(0, 2);
    const sense = clean(input.sense) || meanings[0] || '';
    return {
      id: entryId(input),
      word: clean(input.word),
      source: clean(input.source),
      target: clean(input.target),
      pos: clean(input.pos),
      meanings,
      sense,
      line: clean(input.line),
      lineTr: clean(input.lineTr),
      example: clean(input.example),
      exampleTr: clean(input.exampleTr),
      show: clean(input.show),
      episode: clean(input.episode),
      url: clean(input.url),
      time: Number(input.time) || 0,
      count: 1,
      firstAt: now,
      at: now,
    };
  }

  // Aynı kelime yeniden kaydedilirse satır çoğalmaz: sayaç artar, bağlam
  // en son görüldüğü yere göre güncellenir ve kayıt başa alınır.
  function merge(list, entry) {
    const out = Array.isArray(list) ? list.slice() : [];
    const index = out.findIndex((item) => item.id === entry.id);
    if (index < 0) {
      out.unshift(entry);
      return { list: out, added: true, count: 1 };
    }
    const old = out[index];
    const next = {
      ...old,
      ...entry,
      meanings: entry.meanings.length ? entry.meanings : old.meanings,
      example: entry.example || old.example,
      exampleTr: entry.exampleTr || old.exampleTr,
      count: (Number(old.count) || 1) + 1,
      firstAt: Number(old.firstAt) || Number(old.at) || entry.at,
    };
    out.splice(index, 1);
    out.unshift(next);
    return { list: out, added: false, count: next.count };
  }

  async function load() {
    try {
      const data = await chrome.storage.local.get(KEY);
      return Array.isArray(data[KEY]) ? data[KEY] : [];
    } catch (_) {
      return [];
    }
  }

  async function save(list) {
    await chrome.storage.local.set({ [KEY]: list });
  }

  async function remove(id) {
    const list = await load();
    const next = list.filter((item) => item.id !== id);
    await save(next);
    return list.length - next.length;
  }

  async function clear() {
    const list = await load();
    await chrome.storage.local.remove(KEY);
    return list.length;
  }

  function onChange(fn) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[KEY]) fn(Array.isArray(changes[KEY].newValue) ? changes[KEY].newValue : []);
    });
  }

  CRDS.vocab = { KEY, POS, posLabel, entryId, pickPos, buildEntry, merge, load, save, remove, clear, onChange };
})();
