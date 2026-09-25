// Kelime defteri kayıtları: tür seçimi, kayıt biçimi ve tekrar eden kelimeler
import { test } from 'node:test';
import assert from 'node:assert/strict';

import '../src/shared/vocab.js';

const V = globalThis.CRDS.vocab;

const entries = [
  { pos: 'verb', terms: ['yakalamak', 'tutmak', 'kapmak'] },
  { pos: 'noun', terms: ['av', 'yakalama'] },
];

test('posLabel: Google türleri Türkçeye çevrilir', () => {
  assert.equal(V.posLabel('verb'), 'fiil');
  assert.equal(V.posLabel('Noun'), 'isim');
  assert.equal(V.posLabel('adjective'), 'sıfat');
  assert.equal(V.posLabel(''), '');
  assert.equal(V.posLabel('particle'), 'particle', 'bilinmeyen tür olduğu gibi kalır');
});

test('pickPos: cümlede kullanılan anlam hangi türdeyse o seçilir', () => {
  assert.equal(V.pickPos(entries, 'tutmak'), 'fiil');
  assert.equal(V.pickPos(entries, 'av'), 'isim');
  assert.equal(V.pickPos(entries, 'bilinmeyen'), 'fiil', 'eşleşme yoksa en sık tür');
  assert.equal(V.pickPos([], 'tutmak'), '');
});

test('buildEntry: en fazla iki anlam, kimlik ve zaman damgası', () => {
  const entry = V.buildEntry({
    word: ' Catch ', source: 'en-US', target: 'tr', pos: 'fiil',
    meanings: ['yakalamak', 'tutmak', 'kapmak'], sense: 'yakalamak',
    line: '...we can still catch the meteor shower.',
    lineTr: 'Acele edersek hâlâ meteor yağmurunu yakalayabiliriz.',
    show: 'Frieren', episode: 'Bölüm 12', url: 'https://www.crunchyroll.com/watch/GG1', time: 28.9,
    at: 1000,
  });
  assert.equal(entry.id, 'catch|en-us|tr');
  assert.equal(entry.word, 'Catch');
  assert.deepEqual(entry.meanings, ['yakalamak', 'tutmak']);
  assert.equal(entry.sense, 'yakalamak');
  assert.equal(entry.count, 1);
  assert.equal(entry.firstAt, 1000);
  assert.equal(entry.time, 28.9);
});

test('merge: aynı kelime satırı çoğaltmaz, sayacı artırır ve başa alır', () => {
  const first = V.buildEntry({ word: 'catch', source: 'en-US', target: 'tr', meanings: ['yakalamak'], show: 'Frieren', episode: 'Bölüm 12', at: 1000 });
  const other = V.buildEntry({ word: 'letter', source: 'en-US', target: 'tr', meanings: ['mektup'], at: 2000 });
  let list = V.merge([], first).list;
  list = V.merge(list, other).list;
  assert.deepEqual(list.map((e) => e.word), ['letter', 'catch']);

  const again = V.buildEntry({
    word: 'catch', source: 'en-US', target: 'tr', meanings: ['yakalamak'],
    show: 'Dandadan', episode: 'Bölüm 3', at: 3000,
  });
  const res = V.merge(list, again);
  assert.equal(res.added, false);
  assert.equal(res.count, 2);
  assert.equal(res.list.length, 2, 'yeni satır açılmamalı');
  assert.equal(res.list[0].word, 'catch', 'son görülen başa gelir');
  assert.equal(res.list[0].show, 'Dandadan', 'bağlam son görüldüğü yere göre güncellenir');
  assert.equal(res.list[0].firstAt, 1000, 'ilk görülme tarihi korunur');
});

test('merge: eski kaydın örnek cümlesi boş yeni kayıtla silinmez', () => {
  const withExample = V.buildEntry({
    word: 'catch', source: 'en-US', target: 'tr', meanings: ['yakalamak'],
    example: 'He tried to catch the ball.', exampleTr: 'Topu yakalamaya çalıştı.', at: 1000,
  });
  const withoutExample = V.buildEntry({ word: 'catch', source: 'en-US', target: 'tr', meanings: ['yakalamak'], at: 2000 });
  const res = V.merge([withExample], withoutExample);
  assert.equal(res.list[0].example, 'He tried to catch the ball.');
  assert.equal(res.list[0].exampleTr, 'Topu yakalamaya çalıştı.');
});
