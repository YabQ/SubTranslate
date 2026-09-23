// Altyazı çözümleyicileri ve çeviri birimleri için testler (node --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import '../src/shared/languages.js';
import '../src/content/subtitles.js';

const Subs = globalThis.CRDS.subtitles;
const L = globalThis.CRDS.lang;
const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('ASS: diyalog, italik, satır sonu, tabela ve çizim ayrımı', () => {
  const { format, cues } = Subs.parse(fixture('sample.ass'), 'ass');
  assert.equal(format, 'ass');

  const texts = cues.map((c) => c.text);
  assert.ok(!texts.some((t) => t.includes('yorumdur')), 'Comment satırı atlanmalı');
  assert.ok(!texts.some((t) => /m 0 0 l/.test(t)), 'çizim komutları metin olmamalı');

  const first = cues[0];
  assert.equal(first.text, 'We defeated the Demon King.');
  assert.equal(first.start, 1);
  assert.equal(first.end, 3.5);
  assert.equal(first.kind, 'dialogue');

  const narrator = cues.find((c) => c.text.startsWith('Fifty'));
  assert.equal(narrator.italic, true, 'Italics stili italik olmalı');

  const heiter = cues.find((c) => c.text.startsWith('Well'));
  assert.equal(heiter.text, "Well, well,\nit's been a while, Frieren.", 'virgüller ve \\N korunmalı');

  const mixed = cues.find((c) => c.text.startsWith('Himmel was'));
  assert.equal(mixed.italic, false);
  assert.deepEqual(mixed.segs, [
    { text: 'Himmel', italic: true },
    { text: ' was always like that.', italic: false },
  ]);

  assert.equal(cues.find((c) => c.text === 'Are you coming with us?').kind, 'top', 'On Top stili üstte');
  assert.equal(cues.find((c) => c.text === 'Half a century later').kind, 'top', '{\\an8} üstte');
  assert.equal(cues.find((c) => c.text === "The Journey's End").kind, 'sign', '\\pos içeren satır tabela');
  assert.equal(cues.find((c) => c.text === 'La la la~').text, 'La la la~', 'karaoke etiketleri temizlenmeli');
});

test('ASS: satırlar başlangıç zamanına göre sıralanır ve id alır', () => {
  const { cues } = Subs.parse(fixture('sample.ass'));
  for (let i = 1; i < cues.length; i++) assert.ok(cues[i - 1].start <= cues[i].start);
  cues.forEach((c, i) => assert.equal(c.id, i));
  const lala = cues.findIndex((c) => c.text === 'La la la~');
  const meteorStart = cues.findIndex((c) => c.text === 'If we hurry...');
  assert.ok(lala < meteorStart, 'dosyada sonra gelen ama erken başlayan satır öne alınmalı');
});

test('WebVTT: etiketler, varlıklar ve konum', () => {
  const vtt = [
    'WEBVTT',
    '',
    'NOTE bu bir not',
    '',
    '1',
    '00:00:01.000 --> 00:00:03.000',
    '<v Frieren>Hello &amp; <i>welcome</i></v>',
    '',
    '00:04.500 --> 00:06.000 line:0 align:center',
    'Top text',
    '',
    '00:00:07.000 --> 00:00:09.250',
    'Two',
    'lines',
  ].join('\n');
  const { format, cues } = Subs.parse(vtt);
  assert.equal(format, 'vtt');
  assert.equal(cues.length, 3);
  assert.equal(cues[0].text, 'Hello & welcome');
  assert.deepEqual(cues[0].segs, [{ text: 'Hello & ', italic: false }, { text: 'welcome', italic: true }]);
  assert.equal(cues[1].start, 4.5);
  assert.equal(cues[1].kind, 'top');
  assert.equal(cues[2].text, 'Two\nlines');
  assert.equal(cues[2].end, 9.25);
});

test('SRT: virgüllü zaman ve {\\an8}', () => {
  const srt = '1\r\n00:00:01,000 --> 00:00:02,500\r\n{\\an8}Up here\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\n<i>Down here</i>\r\n';
  const { format, cues } = Subs.parse(srt);
  assert.equal(format, 'srt');
  assert.equal(cues[0].kind, 'top');
  assert.equal(cues[0].end, 2.5);
  assert.equal(cues[1].italic, true);
});

test('activeCues: aynı anda görünen satırlar', () => {
  const { cues } = Subs.parse(fixture('sample.ass'));
  const at18 = Subs.activeCues(cues, 18).map((c) => c.text);
  assert.deepEqual(at18.sort(), ['- Hey!\n- What?', 'Are you coming with us?']);
  assert.deepEqual(Subs.activeCues(cues, 3.5), [], 'bitiş anı dahil değil');
  assert.deepEqual(Subs.activeCues(cues, 0.5), []);
});

test('buildUnits: bölünmüş cümleler birleşir, diğerleri ayrı kalır', () => {
  const { cues } = Subs.parse(fixture('sample.ass'));
  const { units, unitOfCue } = Subs.buildUnits(cues, true);
  const byText = (t) => cues.find((c) => c.text === t);

  const a = byText("I don't know if");
  const b = byText('he will come back.');
  assert.equal(unitOfCue[a.id], unitOfCue[b.id]);
  assert.equal(units[unitOfCue[a.id]].text, "I don't know if he will come back.");

  const c = byText('If we hurry...');
  const d = byText('...we can still catch the meteor shower.');
  assert.equal(unitOfCue[c.id], unitOfCue[d.id]);
  assert.equal(units[unitOfCue[c.id]].text, 'If we hurry we can still catch the meteor shower.');

  const heiter = cues.find((x) => x.text.startsWith('Well'));
  assert.equal(units[unitOfCue[heiter.id]].text, "Well, well, it's been a while, Frieren.", 'satır sonu boşluk olur');

  const dash = byText('- Hey!\n- What?');
  assert.equal(units[unitOfCue[dash.id]].cueIds.length, 1, 'tireli satır birleşmez');

  assert.equal(unitOfCue[byText('♪ ♪').id], -1, 'harf içermeyen satır çevrilmez');
  assert.equal(unitOfCue[byText("The Journey's End").id] >= 0, true, 'tabelalar da çevrilir');

  const separate = Subs.buildUnits(cues, false);
  assert.notEqual(separate.unitOfCue[a.id], separate.unitOfCue[b.id], 'birleştirme kapalıyken ayrı');
});

test('dil kodları: normalleştirme ve eşleştirme', () => {
  assert.equal(L.normalizeLocale('enUS'), 'en-US');
  assert.equal(L.normalizeLocale('es_la'), 'es-419');
  assert.equal(L.normalizeLocale('zh-hant'), 'zh-Hant');
  assert.equal(L.normalizeLocale('PT-br'), 'pt-BR');
  assert.equal(L.baseLang('ar-SA'), 'ar');
  assert.ok(L.sameLanguage('tr', 'tr-TR'));
  assert.ok(L.sameLanguage('es', 'es-419'));
  assert.ok(!L.sameLanguage('pt-BR', 'pt-PT'));
  assert.ok(!L.sameLanguage('zh-CN', 'zh-TW'));
  assert.ok(L.sameLanguage('zh-TW', 'zh-HK'));
  assert.ok(!L.sameLanguage('tr', 'en-US'));
  assert.equal(L.displayName('tr'), 'Türkçe');
  assert.equal(L.displayName('de-DE'), 'Almanca', 'tek çeşitli dilde ülke eki atılır');
  assert.notEqual(L.displayName('es-419'), L.displayName('es-ES'), 'İspanyolca çeşitleri ayırt edilir');
  assert.notEqual(L.displayName('pt-BR'), L.displayName('pt-PT'));
  assert.notEqual(L.displayName('zh-CN'), L.displayName('zh-TW'));
});
