/* =========================================================
   words.js — Kelime sözlüğü için metin yardımcıları (saf işlevler).
   Altyazı satırını kelime/ayraç parçalarına böler, karşılaştırma için
   sadeleştirir ve bir kelimenin karşılığını çeviri satırında arar.

   Türkçe sondan eklemeli olduğu için birebir eşleşme yetmez:
   "mektup" karşılığı satırda "mektubu" diye geçer. Bu yüzden kök
   benzerliğine ve sondaki ünsüz yumuşamasına (p→b, t→d, k→g) bakılır.
   ========================================================= */
(() => {
  const CRDS = (globalThis.CRDS = globalThis.CRDS || {});

  // Harf ya da rakam dizileri kelimedir; aralarındaki kesme ve tire kelimeyi bölmez
  const WORD_RE = /[\p{L}\p{N}]+(?:['’ʼ-][\p{L}\p{N}]+)*/gu;

  // Sadeleştirmeden sonra da sık geçtikleri için eşleştirmeye girmeyen kelimeler
  const STOP = new Set([
    'bir', 've', 'ile', 'icin', 'olarak', 'gibi', 'cok', 'daha', 'de', 'da', 'ki', 'mi',
    'the', 'a', 'an', 'to', 'of', 'in', 'on', 'it', 'is',
  ]);

  // Sondaki ünsüz yumuşaması: sadeleştirme ç→c ve ğ→g yaptığı için geriye bunlar kalır
  const SOFT = { p: 'b', b: 'p', t: 'd', d: 't', k: 'g', g: 'k' };

  const TR = { 'ı': 'i', 'ş': 's', 'ğ': 'g', 'ç': 'c', 'ö': 'o', 'ü': 'u' };

  // Metni {w, text} parçalarına ayırır; parçalar birleştirilince metin aynen geri gelir
  function tokenize(text) {
    const src = text == null ? '' : String(text);
    const out = [];
    let last = 0;
    for (const m of src.matchAll(WORD_RE)) {
      if (m.index > last) out.push({ w: false, text: src.slice(last, m.index) });
      out.push({ w: true, text: m[0] });
      last = m.index + m[0].length;
    }
    if (last < src.length) out.push({ w: false, text: src.slice(last) });
    return out;
  }

  // Karşılaştırma biçimi: Türkçeye uygun küçük harf + aksan ve Türkçe harfleri sadeleştirme
  function fold(str) {
    let out = '';
    for (const ch of String(str == null ? '' : str)) {
      const c = ch === 'I' ? 'ı' : ch === 'İ' ? 'i' : ch.toLowerCase();
      out += TR[c] || c;
    }
    return out.normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // İki kökün benzerliği. 0 = eşleşmez. Sadeleştirilmiş metin bekler.
  function stemScore(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 100;
    const min = Math.min(a.length, b.length);
    if (min < 3) return 0;
    let p = 0;
    while (p < min && a[p] === b[p]) p++;
    // "mektup" / "mektubu": son ünsüz yumuşamışsa kök yine de tamamlanmış sayılır
    if (p === min - 1 && SOFT[a[p]] === b[p]) p = min;
    // Kısa kökte (gel → gelmeyeceğini) kökün tamamı, uzun kökte en az 4 harf tutmalı
    if (p < min && p < 4) return 0;
    return p * 10 - Math.min(9, Math.abs(a.length - b.length)) / 10;
  }

  // Adaylardan (bir kelimenin karşılıkları) satırda en iyi tutanı bulur.
  // Dönen indexes, tokenize(text) dizisindeki konumlardır.
  function bestMatch(text, candidates) {
    const toks = tokenize(text);
    const folded = toks.map((t) => (t.w ? fold(t.text) : ''));
    let best = null;
    for (const candidate of candidates || []) {
      const parts = tokenize(candidate)
        .filter((t) => t.w)
        .map((t) => fold(t.text))
        .filter((w) => w && !STOP.has(w));
      if (!parts.length) continue;
      const indexes = [];
      let total = 0;
      for (const part of parts) {
        let bestIdx = -1;
        let bestScore = 0;
        for (let i = 0; i < folded.length; i++) {
          if (!folded[i] || indexes.includes(i)) continue;
          const score = stemScore(part, folded[i]);
          if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
          }
        }
        if (bestIdx >= 0) {
          indexes.push(bestIdx);
          total += bestScore;
        }
      }
      if (!indexes.length) continue;
      const score = total / parts.length;
      if (!best || score > best.score) {
        best = { score, indexes: indexes.sort((x, y) => x - y), meaning: String(candidate) };
      }
    }
    return best && best.score >= 25 ? best : null;
  }

  // Cümlede kullanılan anlam listenin başına alınır; kullanıcıya ilk gösterilen
  // iki karşılıktan biri her zaman o cümledeki anlam olur.
  function orderBySense(meanings, sense) {
    const list = (meanings || []).map((m) => String(m)).filter(Boolean);
    const want = fold(sense);
    if (!want) return list;
    const index = list.findIndex((m) => fold(m) === want);
    if (index < 0) return [String(sense), ...list];
    if (index === 0) return list;
    const out = list.slice();
    out.unshift(out.splice(index, 1)[0]);
    return out;
  }

  CRDS.words = { tokenize, fold, stemScore, bestMatch, orderBySense };
})();
