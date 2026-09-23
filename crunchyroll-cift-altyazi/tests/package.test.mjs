// Paketleme betiği için testler: üretilen zip'i geri okuyup doğrular (node --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';

import { collectFiles, crc32, createZip } from '../tools/package.mjs';

// Merkez dizini okuyup her girdinin adını ve açılmış içeriğini döndürür
function readZip(zip) {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(eocd >= 0, 'dizin sonu kaydı bulunmalı');
  const count = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  const files = [];
  for (let i = 0; i < count; i++) {
    assert.equal(zip.readUInt32LE(p), 0x02014b50);
    const method = zip.readUInt16LE(p + 10);
    const crc = zip.readUInt32LE(p + 16);
    const size = zip.readUInt32LE(p + 20);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const name = zip.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    const dataStart = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const raw = zip.subarray(dataStart, dataStart + size);
    const data = method === 8 ? inflateRawSync(raw) : raw;
    assert.equal(crc32(data), crc, `${name} CRC tutmalı`);
    files.push({ name, data });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

test('crc32 bilinen değeri üretir', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});

test('zip yazıcısı: sıkıştırılmış ve sıkıştırılmamış girdiler geri okunur', () => {
  const big = Buffer.from('Merhaba dünya! '.repeat(200));
  const tiny = Buffer.from('{}');
  const zip = createZip([{ name: 'manifest.json', data: tiny }, { name: 'src/klasör/metin.txt', data: big }]);
  const files = readZip(zip);
  assert.deepEqual(files.map((f) => f.name), ['manifest.json', 'src/klasör/metin.txt']);
  assert.deepEqual(files[0].data, tiny);
  assert.deepEqual(files[1].data, big);
  assert.ok(zip.length < big.length, 'tekrarlı metin sıkıştırılmalı');
});

test('pakete yalnızca eklentinin çalışma dosyaları girer', () => {
  const files = collectFiles();
  assert.equal(files[0], 'manifest.json');
  for (const needed of ['src/background/background.js', 'src/background/vendor/anthropic-sdk.mjs', 'src/content/content.js', 'src/page/hook.js', 'src/popup/popup.html', 'icons/icon128.png']) {
    assert.ok(files.includes(needed), `${needed} pakette olmalı`);
  }
  assert.ok(files.every((f) => /^(manifest\.json|icons\/|src\/)/.test(f)), 'testler, deneme sayfası ve araçlar pakete girmemeli');
  assert.ok(files.every((f) => !f.includes('\\')), 'yol ayırıcı her zaman "/"');
});
