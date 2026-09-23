/* =========================================================
   subtitles.js — Altyazı dosyası çözümleyicileri (ASS/SSA, WebVTT, SRT)
   ve çeviri birimlerinin hazırlanması.

   Her altyazı satırı (cue) şu biçime dönüştürülür:
     { id, start, end, text, segs: [{ text, italic }], italic, kind, style }
   kind: 'dialogue' (alt) | 'top' (üst) | 'sign' (tabela / ekran yazısı)
   ========================================================= */
(() => {
  const CRDS = (globalThis.CRDS = globalThis.CRDS || {});

  // SSA'nın eski hizalama numaraları → ASS (numpad) numaraları
  const LEGACY_ALIGN = { 1: 1, 2: 2, 3: 3, 5: 7, 6: 8, 7: 9, 9: 4, 10: 5, 11: 6 };
  const DEFAULT_EVENT_FORMAT = ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'];
  const SIGN_STYLE = /(^|[\s_-])(sign|signs|typeset|ts|screen|title)([\s_-]|$)|^sign/i;

  /* ---------- Ortak yardımcılar ---------- */

  function parseClock(str) {
    const m = /^\s*(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?\s*$/.exec(str || '');
    if (!m) return NaN;
    const frac = m[4] ? Number(`0.${m[4].padEnd(3, '0')}`) : 0;
    return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + frac;
  }

  const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', lrm: '', rlm: '' };
  function decodeEntities(s) {
    return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code) => {
      if (code[0] === '#') {
        const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : all;
      }
      const v = ENTITIES[code.toLowerCase()];
      return v === undefined ? all : v;
    });
  }

  // Parçaların boşluklarını sadeleştirir, satır başı/sonu boşluklarını atar
  function finishCue(start, end, segs, kind, order, style) {
    const clean = [];
    for (const seg of segs) {
      const text = seg.text.replace(/\u00A0/g, ' ').replace(/[ \t\f\v]+/g, ' ');
      if (!text) continue;
      const prev = clean[clean.length - 1];
      if (prev && prev.italic === seg.italic) prev.text += text;
      else clean.push({ text, italic: seg.italic });
    }
    for (const seg of clean) seg.text = seg.text.replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n');
    if (clean.length) {
      clean[0].text = clean[0].text.replace(/^\s+/, '');
      clean[clean.length - 1].text = clean[clean.length - 1].text.replace(/\s+$/, '');
    }
    const segsOut = clean.filter((s) => s.text);
    const text = segsOut.map((s) => s.text).join('').replace(/\n{2,}/g, '\n').trim();
    if (!text) return null;
    const italicChars = segsOut.reduce((n, s) => n + (s.italic ? s.text.length : 0), 0);
    return {
      id: -1,
      order,
      start,
      end,
      text,
      segs: segsOut,
      italic: italicChars / text.length >= 0.6,
      kind,
      style: style || '',
    };
  }

  /* ---------- ASS / SSA ---------- */

  function splitFields(value, count) {
    const out = [];
    let idx = 0;
    for (let i = 0; i < count - 1; i++) {
      const j = value.indexOf(',', idx);
      if (j < 0) break;
      out.push(value.slice(idx, j));
      idx = j + 1;
    }
    out.push(value.slice(idx));
    return out;
  }

  // Satır içi {\etiket} bloklarını işler: italik, çizim modu, konum, hizalama
  function assText(raw, style, styles) {
    let italic = style.italic;
    let drawing = false;
    let positioned = false;
    let align = 0;
    const segs = [];
    const push = (chunk) => {
      if (!chunk || drawing) return;
      const text = chunk.replace(/\\N/g, '\n').replace(/\\n/g, ' ').replace(/\\h/g, '\u00A0');
      if (text) segs.push({ text, italic });
    };
    const re = /\{([^}]*)\}/g;
    let last = 0;
    let m;
    while ((m = re.exec(raw))) {
      push(raw.slice(last, m.index));
      last = re.lastIndex;
      const block = m[1].replace(/\\t\([^)]*\)/g, '');
      for (const token of block.split('\\')) {
        const tag = token.trim();
        let t;
        if (!tag) continue;
        if ((t = /^i(\d?)$/.exec(tag))) italic = t[1] === '' ? style.italic : t[1] !== '0';
        else if ((t = /^p(\d+(?:\.\d+)?)$/.exec(tag))) drawing = parseFloat(t[1]) > 0;
        else if (/^(pos|move|org)\s*\(/.test(tag)) positioned = true;
        else if ((t = /^an(\d)$/.exec(tag))) align = Number(t[1]);
        else if ((t = /^a(\d{1,2})$/.exec(tag))) align = LEGACY_ALIGN[Number(t[1])] || align;
        else if ((t = /^r(.*)$/.exec(tag))) italic = (styles[t[1].trim()] || style).italic;
      }
    }
    push(raw.slice(last));
    return { segs, positioned, align: align || style.align || 2 };
  }

  function parseAss(text) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
    const styles = {};
    let section = '';
    let styleFormat = null;
    let eventFormat = null;
    let legacy = false;
    const cues = [];
    let order = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed[0] === ';') continue;
      if (/^\[.+\]$/.test(trimmed)) {
        section = trimmed.toLowerCase();
        legacy = section === '[v4 styles]';
        continue;
      }
      const colon = trimmed.indexOf(':');
      if (colon < 0) continue;
      const type = trimmed.slice(0, colon).trim().toLowerCase();
      const value = trimmed.slice(colon + 1).replace(/^\s+/, '');

      if (section.includes('styles')) {
        if (type === 'format') styleFormat = value.split(',').map((f) => f.trim().toLowerCase());
        else if (type === 'style') {
          const format = styleFormat || ['name', 'fontname', 'fontsize', 'primarycolour', 'secondarycolour', 'outlinecolour', 'backcolour', 'bold', 'italic'];
          const fields = splitFields(value, format.length);
          const get = (k) => (format.indexOf(k) >= 0 ? (fields[format.indexOf(k)] || '').trim() : '');
          const name = get('name');
          let alignNum = Number(get('alignment')) || 2;
          if (legacy) alignNum = LEGACY_ALIGN[alignNum] || 2;
          styles[name] = { name, italic: get('italic') === '-1' || get('italic') === '1', align: alignNum };
        }
      } else if (section === '[events]') {
        if (type === 'format') eventFormat = value.split(',').map((f) => f.trim().toLowerCase());
        else if (type === 'dialogue') {
          const format = eventFormat || DEFAULT_EVENT_FORMAT;
          const fields = splitFields(value, format.length);
          const get = (k) => (format.indexOf(k) >= 0 ? fields[format.indexOf(k)] || '' : '');
          const start = parseClock(get('start'));
          const end = parseClock(get('end'));
          if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
          const styleName = get('style').trim();
          const style = styles[styleName] || styles[styleName.replace(/^\*/, '')] || styles.Default || { name: styleName, italic: false, align: 2 };
          const info = assText(get('text'), style, styles);
          let kind = 'dialogue';
          if (info.positioned || SIGN_STYLE.test(styleName)) kind = 'sign';
          else if (info.align >= 7) kind = 'top';
          else if (info.align >= 4) kind = 'sign';
          const cue = finishCue(start, end, info.segs, kind, order++, styleName);
          if (cue) cues.push(cue);
        }
      }
    }
    return cues;
  }

  /* ---------- WebVTT / SRT ---------- */

  // <i>, <b>, <c.renk>, <v Konuşan> etiketleri ve SRT'deki {\an8} hizalamaları
  function markupText(body) {
    let align = 0;
    body = body.replace(/\{\\(an?)(\d{1,2})\}/g, (all, tag, num) => {
      align = tag === 'an' ? Number(num) : LEGACY_ALIGN[Number(num)] || 0;
      return '';
    });
    body = body.replace(/\{\\[^}]*\}/g, '');
    const segs = [];
    let italicDepth = 0;
    const re = /<\/?([a-zA-Z0-9.]+)[^>]*>/g;
    let last = 0;
    let m;
    const add = (t) => {
      if (t) segs.push({ text: decodeEntities(t), italic: italicDepth > 0 });
    };
    while ((m = re.exec(body))) {
      add(body.slice(last, m.index));
      last = re.lastIndex;
      if (m[1].toLowerCase() === 'i') italicDepth = Math.max(0, italicDepth + (m[0][1] === '/' ? -1 : 1));
    }
    add(body.slice(last));
    return { segs, align };
  }

  function parseCueBlocks(text, isVtt) {
    const blocks = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
    const cues = [];
    let order = 0;
    for (const block of blocks) {
      const lines = block.split('\n');
      const ti = lines.findIndex((l) => l.includes('-->'));
      if (ti < 0) continue;
      if (isVtt && /^(NOTE|STYLE|REGION)\b/.test(lines[0])) continue;
      const m = /^\s*(\S+)\s*-->\s*(\S+)(.*)$/.exec(lines[ti]);
      if (!m) continue;
      const start = parseClock(m[1]);
      const end = parseClock(m[2]);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      const { segs, align } = markupText(lines.slice(ti + 1).join('\n'));
      let top = align >= 7;
      const line = /\bline:(-?\d+(?:\.\d+)?)(%?)/.exec(m[3] || '');
      if (line) {
        const v = parseFloat(line[1]);
        top = line[2] ? v < 40 : v >= 0 && v <= 3;
      }
      const cue = finishCue(start, end, segs, top ? 'top' : 'dialogue', order++, '');
      if (cue) cues.push(cue);
    }
    return cues;
  }

  /* ---------- Giriş noktası ---------- */

  function detectFormat(text, hint) {
    const head = text.slice(0, 4000).replace(/^\uFEFF/, '').trimStart();
    if (/^\[Script Info\]/i.test(head) || /^\[(V4\+? Styles|Events)\]/im.test(head)) return 'ass';
    if (/^WEBVTT/.test(head)) return 'vtt';
    if (/^\d+\s*\r?\n\s*[\d:]+,\d{1,3}\s*-->/.test(head)) return 'srt';
    const h = String(hint || '').toLowerCase();
    if (h === 'ass' || h === 'ssa') return /\[Events\]/i.test(text) ? 'ass' : '';
    if (h === 'vtt' || h === 'webvtt') return 'vtt';
    if (h === 'srt') return 'srt';
    if (/-->/.test(head)) return /\d,\d{3}\s*-->/.test(head) ? 'srt' : 'vtt';
    return '';
  }

  function parse(text, hint) {
    const source = String(text || '');
    const format = detectFormat(source, hint);
    let cues = [];
    if (format === 'ass') cues = parseAss(source);
    else if (format === 'vtt') cues = parseCueBlocks(source, true);
    else if (format === 'srt') cues = parseCueBlocks(source, false);
    cues.sort((a, b) => a.start - b.start || a.order - b.order);
    cues.forEach((c, i) => {
      c.id = i;
    });
    return { format, cues };
  }

  // Zaman t'de görünen satırlar (dizi başlangıca göre sıralı)
  function activeCues(cues, t) {
    const out = [];
    for (const cue of cues) {
      if (cue.start > t) break;
      if (t < cue.end) out.push(cue);
    }
    return out;
  }

  /* ---------- Çeviri birimleri ---------- */

  // Çeviriye gidecek düz metin: satır sonları boşluk olur, harf içermeyen
  // satırlar (ör. "♪♪", "...") çevrilmez.
  function translationText(text) {
    const t = text.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
    return /\p{L}/u.test(t) ? t : '';
  }

  const TERMINAL = /[.!?…♪」』"”’)\]~]$/;
  const ELLIPSIS_END = /(\.\.\.|…)$/;
  const ELLIPSIS_START = /^(\.\.\.|…)/;

  // Bir cümle iki satıra bölünmüş mü? ("I don't know if" + "he will come back.")
  function continues(prev, next) {
    if (next.start - prev.end > 1.2 || next.start < prev.end - 0.05) return false;
    const a = prev.text.trim();
    const b = next.text.trim();
    if (/^[-–—]/.test(b) || /(^|\n)[-–—]/.test(a)) return false; // tireli satırlar farklı konuşmacılar
    if (!TERMINAL.test(a)) return true;
    return ELLIPSIS_END.test(a) && (ELLIPSIS_START.test(b) || /^\p{Ll}/u.test(b));
  }

  function joinText(a, b) {
    if (ELLIPSIS_END.test(a) && ELLIPSIS_START.test(b)) {
      return `${a.replace(/\s*(\.\.\.|…)$/, '')} ${b.replace(/^(\.\.\.|…)\s*/, '')}`;
    }
    return `${a} ${b}`;
  }

  // Satırları çeviri birimlerine ayırır. merge açıksa bölünmüş cümleler
  // birleştirilir ve birimin çevirisi her iki satır boyunca gösterilir.
  function buildUnits(cues, merge) {
    const unitOfCue = new Array(cues.length).fill(-1);
    const units = [];
    let prevDialogue = null;
    for (const cue of cues) {
      const text = translationText(cue.text);
      if (!text) continue;
      if (merge && cue.kind === 'dialogue' && prevDialogue && continues(prevDialogue, cue)) {
        const unit = units[unitOfCue[prevDialogue.id]];
        if (unit && unit.cueIds.length < 3 && unit.text.length + text.length < 280) {
          unit.text = joinText(unit.text, text);
          unit.cueIds.push(cue.id);
          unitOfCue[cue.id] = unitOfCue[prevDialogue.id];
          prevDialogue = cue;
          continue;
        }
      }
      unitOfCue[cue.id] = units.length;
      units.push({ text, cueIds: [cue.id] });
      if (cue.kind === 'dialogue') prevDialogue = cue;
    }
    return { units, unitOfCue };
  }

  CRDS.subtitles = { parse, detectFormat, activeCues, buildUnits, translationText, parseClock };
})();
