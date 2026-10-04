// Kelime sözlüğünün metin işlemleri: bölme, sadeleştirme, kök eşleştirme
import { test } from 'node:test';
import assert from 'node:assert/strict';

import '../src/shared/words.js';

const W = globalThis.CRDS.words;

test('tokenize: kelimeler ve aralar ayrılır, metin aynen geri gelir', () => {
  const text = "I don't know if he will come back.";
  const toks = W.tokenize(text);
  assert.equal(toks.map((t) => t.text).join(''), text);
  assert.deepEqual(
    toks.filter((t) => t.w).map((t) => t.text),
    ['I', "don't", 'know', 'if', 'he', 'will', 'come', 'back'],
  );

  const multi = W.tokenize('Bölüm 12 —\nDönüş Yolu');
  assert.deepEqual(multi.filter((t) => t.w).map((t) => t.text), ['Bölüm', '12', 'Dönüş', 'Yolu']);
  assert.equal(multi.map((t) => t.text).join(''), 'Bölüm 12 —\nDönüş Yolu');
});

test('fold: Türkçe büyük harf ve aksan sadeleşir', () => {
  assert.equal(W.fold('İstanbul'), 'istanbul');
  assert.equal(W.fold('IŞIK'), 'isik');
  assert.equal(W.fold('Çocuğu'), 'cocugu');
  assert.equal(W.fold('café'), 'cafe');
});

test('stemScore: ek almış ve ünsüzü yumuşamış kökler tutar', () => {
  const s = (a, b) => W.stemScore(W.fold(a), W.fold(b));
  assert.ok(s('mektup', 'mektubu') > 0, 'mektup → mektubu (p/b yumuşaması)');
  assert.ok(s('çocuk', 'çocuğu') > 0, 'çocuk → çocuğu (k/ğ yumuşaması)');
  assert.ok(s('gel', 'gelmeyeceğini') > 0, 'kısa kök tamamen geçiyorsa tutar');
  assert.ok(s('kitap', 'kitaplarından') > 0);
  assert.equal(s('mektup', 'mektup'), 100);

  assert.equal(s('el', 'elma'), 0, 'iki harfli kök eşleşmemeli');
  assert.equal(s('kalem', 'kapı'), 0, 'ortak ön ek kısa kalırsa eşleşmemeli');
  assert.equal(s('gelmek', 'gitmek'), 0);
});

test('bestMatch: karşılık çeviri satırında bulunur', () => {
  const line = 'Bu mektubu sana bıraktı.';
  const match = W.bestMatch(line, ['mektup', 'harf']);
  assert.ok(match, 'eşleşme bulunmalı');
  const toks = W.tokenize(line);
  assert.deepEqual(match.indexes.map((i) => toks[i].text), ['mektubu']);

  const none = W.bestMatch(line, ['pencere', 'gökyüzü']);
  assert.equal(none, null, 'alakasız karşılıklar eşleşmemeli');
});

test('bestMatch: çok kelimeli karşılık ve durak kelimeleri', () => {
  const line = 'Geri gelip gelmeyeceğini bilmiyorum.';
  const match = W.bestMatch(line, ['geri gel', 'bir şey']);
  assert.ok(match);
  const toks = W.tokenize(line);
  const words = match.indexes.map((i) => toks[i].text);
  assert.ok(words.includes('Geri'), 'çok kelimeli karşılığın her parçası aranır');
  assert.ok(words.includes('gelip') || words.includes('gelmeyeceğini'));

  // "bir" durak kelimesidir, tek başına eşleşme saymaz
  assert.equal(W.bestMatch('Bir şey söyleme.', ['bir']), null);
});

test('orderBySense: cümlede kullanılan anlam öne alınır', () => {
  assert.deepEqual(W.orderBySense(['duş', 'sağanak', 'yağmur'], 'yağmur'), ['yağmur', 'duş', 'sağanak']);
  assert.deepEqual(W.orderBySense(['yakalamak', 'tutmak'], 'yakalamak'), ['yakalamak', 'tutmak'], 'zaten baştaysa dokunulmaz');
  assert.deepEqual(W.orderBySense(['duş', 'sağanak'], ''), ['duş', 'sağanak'], 'anlam yoksa sıra bozulmaz');
  assert.deepEqual(W.orderBySense(['duş'], 'yağmura tutmak'), ['yağmura tutmak', 'duş'], 'listede yoksa başa eklenir');
})
