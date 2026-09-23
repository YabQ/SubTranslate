// Mağaza ve elle kurulum paketlerini dist/ klasörüne üretir: npm run package
//   crunchyroll-cift-altyazi-<sürüm>-magaza.zip : Chrome Web Mağazası'na yüklenecek paket
//   crunchyroll-cift-altyazi-<sürüm>.zip        : elle kurulum için (KURULUM.txt dahil)
// Zip yazıcısı bağımlılıksızdır; yol ayırıcıları her zaman "/" olur (Windows'taki
// Compress-Archive'ın "\" kullanması mağazanın paketi reddetmesine yol açabiliyor).
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RUNTIME = ['manifest.json', 'icons', 'src'];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

// entries: [{ name: 'src/a.js', data: Buffer }] → zip dosyasının baytları
export function createZip(entries, date = new Date()) {
  const { time, day } = dosDateTime(date);
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const deflated = deflateRawSync(data, { level: 9 });
    const method = deflated.length < data.length ? 8 : 0;
    const body = method === 8 ? deflated : data;
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // çıkarmak için gereken sürüm
    local.writeUInt16LE(0x0800, 6); // dosya adları UTF-8
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4); // Unix'te oluşturuldu (dosya izinleri korunur)
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38); // normal dosya, rw-r--r--
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

// Pakete girecek çalışma dosyaları (testler, deneme sayfası, araçlar hariç)
export function collectFiles(root = ROOT) {
  const out = [];
  const walk = (rel) => {
    const abs = join(root, rel);
    if (statSync(abs).isDirectory()) {
      for (const name of readdirSync(abs).sort()) walk(`${rel}/${name}`);
    } else {
      out.push(rel);
    }
  };
  for (const item of RUNTIME) walk(item);
  return out;
}

// Not Defteri'nde Türkçe karakterler doğru görünsün: UTF-8 BOM + CRLF
function windowsText(text) {
  const crlf = text.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(crlf, 'utf8')]);
}

function main() {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
  const entries = collectFiles().map((name) => ({ name, data: readFileSync(join(ROOT, name)) }));
  const guide = { name: 'KURULUM.txt', data: windowsText(readFileSync(join(ROOT, 'tools', 'KURULUM.txt'), 'utf8')) };
  const base = `crunchyroll-cift-altyazi-${manifest.version}`;
  const outDir = join(ROOT, 'dist');
  mkdirSync(outDir, { recursive: true });
  for (const [file, list] of [[`${base}-magaza.zip`, entries], [`${base}.zip`, [guide, ...entries]]]) {
    const zip = createZip(list);
    writeFileSync(join(outDir, file), zip);
    console.log(`dist/${file}  ${list.length} dosya, ${(zip.length / 1024).toFixed(1)} KB`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
