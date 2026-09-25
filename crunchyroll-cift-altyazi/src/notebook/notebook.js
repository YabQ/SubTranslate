/* =========================================================
   notebook.js — Kelime defteri sayfası.
   Salt okunur bir koleksiyondur: kayıtlar burada düzenlenmez.
   Kelimeye tıklanınca kopyala / sil menüsü açılır, her cümlenin
   sonunda kendi kopyalama düğmesi vardır.
   ========================================================= */
(() => {
  const Vocab = globalThis.CRDS.vocab;
  const $ = (sel) => document.querySelector(sel);

  const el = {
    list: $('#list'),
    empty: $('#empty'),
    summary: $('#summary'),
    search: $('#search'),
    show: $('#show'),
    pos: $('#pos'),
    sort: $('#sort'),
    menu: $('#menu'),
    toast: $('#toast'),
  };

  let entries = [];
  let menuFor = null;
  let toastTimer = 0;

  const fold = (value) => String(value || '').toLocaleLowerCase('tr');
  const dateText = (ms) => new Date(Number(ms) || 0).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  function clock(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function toast(message) {
    clearTimeout(toastTimer);
    el.toast.textContent = message;
    el.toast.classList.add('show');
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2200);
  }

  async function copy(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label} kopyalandı`);
    } catch (_) {
      toast('Kopyalanamadı');
    }
  }

  /* ---------- Çizim ---------- */

  function sentenceRow(tag, text, className) {
    const row = document.createElement('div');
    row.className = className ? `row ${className}` : 'row';
    const label = document.createElement('span');
    label.className = 'tag';
    label.textContent = tag;
    const p = document.createElement('p');
    p.textContent = text;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy';
    button.textContent = 'Kopyala';
    button.title = 'Cümleyi kopyala';
    button.addEventListener('click', () => copy(text, 'Cümle'));
    row.append(label, p, button);
    return row;
  }

  function card(entry) {
    const node = document.createElement('article');
    node.className = 'card';
    node.dataset.id = entry.id;

    const head = document.createElement('div');
    head.className = 'head';
    const word = document.createElement('button');
    word.type = 'button';
    word.className = 'word';
    word.textContent = entry.word;
    word.title = 'Kopyala ya da sil';
    word.addEventListener('click', (event) => openMenu(event.currentTarget, entry));
    head.append(word);
    if (entry.pos) {
      const pos = document.createElement('span');
      pos.className = 'pos';
      pos.textContent = entry.pos;
      head.append(pos);
    }
    if (Number(entry.count) > 1) {
      const count = document.createElement('span');
      count.className = 'count';
      count.textContent = `${entry.count} kez karşılaştın`;
      head.append(count);
    }
    node.append(head);

    const meanings = document.createElement('p');
    meanings.className = 'meanings';
    (entry.meanings || []).forEach((meaning, i) => {
      if (i) {
        const sep = document.createElement('span');
        sep.className = 'sep';
        sep.textContent = '·';
        meanings.append(sep);
      }
      const span = document.createElement('span');
      // Cümlede hangi anlamıyla geçtiyse o vurgulanır
      if (meaning === entry.sense) span.className = 'sense';
      span.textContent = meaning;
      meanings.append(span);
    });
    node.append(meanings);

    const lines = document.createElement('div');
    lines.className = 'lines';
    if (entry.line) lines.append(sentenceRow('Cümle', entry.line));
    if (entry.lineTr) lines.append(sentenceRow('Çeviri', entry.lineTr, 'tr'));
    if (entry.example) lines.append(sentenceRow('Örnek', entry.example));
    if (entry.exampleTr) lines.append(sentenceRow('Örnek', entry.exampleTr, 'tr'));
    node.append(lines);

    const meta = document.createElement('p');
    meta.className = 'meta';
    const parts = [];
    if (entry.show) parts.push(entry.show);
    if (entry.episode) parts.push(entry.episode);
    parts.push(dateText(entry.at));
    parts.forEach((text, i) => {
      if (i) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.textContent = '·';
        meta.append(dot);
      }
      const span = document.createElement('span');
      span.textContent = text;
      meta.append(span);
    });
    if (entry.url) {
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.textContent = '·';
      const link = document.createElement('a');
      link.href = entry.url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = `bölüme git (${clock(entry.time)})`;
      meta.append(dot, link);
    }
    node.append(meta);
    return node;
  }

  function visible() {
    const query = fold(el.search.value.trim());
    const show = el.show.value;
    const pos = el.pos.value;
    let list = entries.filter((entry) => {
      if (show && entry.show !== show) return false;
      if (pos && entry.pos !== pos) return false;
      if (!query) return true;
      const hay = fold([entry.word, entry.sense, (entry.meanings || []).join(' '), entry.line, entry.lineTr, entry.example, entry.exampleTr].join(' '));
      return hay.includes(query);
    });
    const by = el.sort.value;
    if (by === 'old') list = list.slice().sort((a, b) => (a.at || 0) - (b.at || 0));
    else if (by === 'az') list = list.slice().sort((a, b) => a.word.localeCompare(b.word, 'tr'));
    else if (by === 'count') list = list.slice().sort((a, b) => (b.count || 1) - (a.count || 1) || (b.at || 0) - (a.at || 0));
    else list = list.slice().sort((a, b) => (b.at || 0) - (a.at || 0));
    return list;
  }

  function fillOptions(select, values, keep) {
    const first = select.firstElementChild;
    select.replaceChildren(first);
    for (const value of values) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.append(option);
    }
    select.value = values.includes(keep) ? keep : '';
  }

  function render() {
    const list = visible();
    el.list.replaceChildren(...list.map(card));
    el.empty.hidden = entries.length > 0;
    if (entries.length && !list.length) {
      el.empty.hidden = false;
      el.empty.textContent = 'Bu süzgeçlere uyan kayıt yok.';
    } else if (!entries.length) {
      el.empty.textContent = "Defter boş. Crunchyroll'da çift altyazı açıkken bir kelimenin üzerine gelip tıkladığında burada birikir.";
    }
    const shows = new Set(entries.map((e) => e.show).filter(Boolean));
    const total = entries.reduce((sum, e) => sum + (Number(e.count) || 1), 0);
    el.summary.textContent = entries.length
      ? `${entries.length} kelime · ${total} karşılaşma · ${shows.size} anime`
      : 'Henüz kelime yok';
  }

  function refreshFilters() {
    const shows = [...new Set(entries.map((e) => e.show).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
    const poses = [...new Set(entries.map((e) => e.pos).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
    fillOptions(el.show, shows, el.show.value);
    fillOptions(el.pos, poses, el.pos.value);
  }

  /* ---------- Kelime menüsü ---------- */

  function openMenu(button, entry) {
    menuFor = entry;
    const r = button.getBoundingClientRect();
    el.menu.hidden = false;
    el.menu.style.left = `${Math.round(r.left + scrollX)}px`;
    el.menu.style.top = `${Math.round(r.bottom + scrollY + 6)}px`;
  }

  function closeMenu() {
    el.menu.hidden = true;
    menuFor = null;
  }

  el.menu.addEventListener('click', async (event) => {
    const action = event.target.dataset && event.target.dataset.action;
    if (!action || !menuFor) return;
    const entry = menuFor;
    closeMenu();
    if (action === 'copy') {
      await copy(entry.word, 'Kelime');
      return;
    }
    await Vocab.remove(entry.id);
    entries = entries.filter((item) => item.id !== entry.id);
    refreshFilters();
    render();
    toast(`"${entry.word}" silindi`);
  });

  document.addEventListener('click', (event) => {
    if (el.menu.hidden) return;
    if (!el.menu.contains(event.target) && !(event.target.classList && event.target.classList.contains('word'))) closeMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  /* ---------- Dışa aktarma ---------- */

  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function csv() {
    const head = ['kelime', 'tur', 'anlamlar', 'cumlede', 'cumle', 'ceviri', 'ornek', 'ornek_ceviri', 'anime', 'bolum', 'kez', 'tarih'];
    const esc = (value) => `"${String(value == null ? '' : value).replace(/"/g, '""')}"`;
    const rows = visible().map((e) => [
      e.word, e.pos, (e.meanings || []).join(' / '), e.sense, e.line, e.lineTr,
      e.example, e.exampleTr, e.show, e.episode, e.count || 1, new Date(e.at || 0).toISOString(),
    ].map(esc).join(','));
    return `﻿${head.join(',')}\n${rows.join('\n')}`;
  }

  $('#exportJson').addEventListener('click', () => {
    download('kelime-defteri.json', JSON.stringify(visible(), null, 2), 'application/json');
    toast('JSON indirildi');
  });
  $('#exportCsv').addEventListener('click', () => {
    download('kelime-defteri.csv', csv(), 'text/csv;charset=utf-8');
    toast('CSV indirildi');
  });

  $('#clearAll').addEventListener('click', async () => {
    if (!entries.length) return;
    const ok = confirm(`${entries.length} kelimenin hepsi silinecek. Bu geri alınamaz, emin misin?`);
    if (!ok) return;
    await Vocab.clear();
    entries = [];
    refreshFilters();
    render();
    toast('Defter temizlendi');
  });

  for (const node of [el.search, el.show, el.pos, el.sort]) {
    node.addEventListener('input', render);
  }

  /* ---------- Başlangıç ---------- */

  Vocab.load().then((list) => {
    entries = list;
    refreshFilters();
    render();
  });

  // Başka sekmede kelime eklenirse sayfa kendiliğinden tazelenir
  Vocab.onChange((list) => {
    entries = list;
    refreshFilters();
    render();
  });
})();
