/* =========================================================
   notebook.js — Kelime defteri sayfası.
   Salt okunur bir koleksiyondur: kayıtlar burada düzenlenmez.
   Kelimeye tıklanınca kopyala / sil menüsü açılır, her cümlenin
   sonunda kendi kopyalama düğmesi vardır.
   ========================================================= */
(() => {
  const Vocab = globalThis.CRDS.vocab;
  const Settings = globalThis.CRDS.settings;
  const I18n = globalThis.CRDS.i18n;
  const T = (key, subs) => I18n.t(key, subs);
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

  const fold = (value) => String(value || '').toLocaleLowerCase(I18n.lang);
  const dateText = (ms) => new Date(Number(ms) || 0).toLocaleDateString(I18n.lang, { day: 'numeric', month: 'long', year: 'numeric' });

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
      toast(T('nb_copied', label));
    } catch (_) {
      toast(T('nb_copy_failed'));
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
    button.title = T('nb_copy_sentence');
    button.addEventListener('click', () => copy(text, T('nb_sentence')));
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
    word.title = T('nb_word_title');
    word.addEventListener('click', (event) => openMenu(event.currentTarget, entry));
    head.append(word);
    if (entry.pos) {
      const pos = document.createElement('span');
      pos.className = 'pos';
      pos.textContent = Vocab.posLabel(entry.pos, T);
      head.append(pos);
    }
    if (Number(entry.count) > 1) {
      const count = document.createElement('span');
      count.className = 'count';
      count.textContent = T('nb_met_times', entry.count);
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
    if (entry.line) lines.append(sentenceRow(T('nb_label_line'), entry.line));
    if (entry.lineTr) lines.append(sentenceRow(T('nb_label_tr'), entry.lineTr, 'tr'));
    if (entry.example) lines.append(sentenceRow(T('nb_label_example'), entry.example));
    if (entry.exampleTr) lines.append(sentenceRow(T('nb_label_example'), entry.exampleTr, 'tr'));
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
      link.textContent = T('nb_go_to', clock(entry.time));
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
    else if (by === 'az') list = list.slice().sort((a, b) => a.word.localeCompare(b.word, I18n.lang));
    else if (by === 'count') list = list.slice().sort((a, b) => (b.count || 1) - (a.count || 1) || (b.at || 0) - (a.at || 0));
    else list = list.slice().sort((a, b) => (b.at || 0) - (a.at || 0));
    return list;
  }

  function fillOptions(select, values, keep, label) {
    const first = select.firstElementChild;
    select.replaceChildren(first);
    for (const value of values) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label ? label(value) : value;
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
      el.empty.textContent = T('nb_empty_filtered');
    } else if (!entries.length) {
      el.empty.textContent = T('nb_empty');
    }
    const shows = new Set(entries.map((e) => e.show).filter(Boolean));
    const total = entries.reduce((sum, e) => sum + (Number(e.count) || 1), 0);
    el.summary.textContent = entries.length
      ? T('nb_summary', [entries.length, total, shows.size])
      : T('nb_summary_empty');
  }

  function refreshFilters() {
    const shows = [...new Set(entries.map((e) => e.show).filter(Boolean))].sort((a, b) => a.localeCompare(b, I18n.lang));
    const poses = [...new Set(entries.map((e) => e.pos).filter(Boolean))].sort((a, b) => a.localeCompare(b, I18n.lang));
    fillOptions(el.show, shows, el.show.value, (value) => Vocab.posLabel(value, T) || value);
    fillOptions(el.pos, poses, el.pos.value, (value) => Vocab.posLabel(value, T) || value);
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
      await copy(entry.word, T('nb_word'));
      return;
    }
    await Vocab.remove(entry.id);
    entries = entries.filter((item) => item.id !== entry.id);
    refreshFilters();
    render();
    toast(T('nb_deleted', entry.word));
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

  // Anki: sekmeyle ayrılmış iki alan (ön yüz / arka yüz) ve başlıkta içe aktarma
  // ayarları. Alan içindeki sekme ve satır sonu kartı bozar, ikisi de temizlenir.
  function anki() {
    const esc = (value) => String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\t/g, ' ').replace(/\r?\n/g, '<br>').trim();
    const mark = (sentence, word) => {
      const text = esc(sentence);
      if (!word) return text;
      const safe = esc(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return text.replace(new RegExp(`(^|[^\\p{L}])(${safe})(?![\\p{L}])`, 'iu'), '$1<b>$2</b>');
    };
    const rows = visible().map((e) => {
      const front = [`<b>${esc(e.word)}</b>`, e.line ? `<div>${mark(e.line, e.word)}</div>` : ''].filter(Boolean).join('');
      const back = [
        (e.meanings || []).map(esc).join(' · '),
        e.pos ? `<div><i>${esc(e.pos)}</i></div>` : '',
        e.lineTr ? `<div>${esc(e.lineTr)}</div>` : '',
        e.example ? `<div>${mark(e.example, e.word)}</div>` : '',
        e.exampleTr ? `<div>${esc(e.exampleTr)}</div>` : '',
        e.show ? `<div><small>${esc([e.show, e.episode].filter(Boolean).join(' · '))}</small></div>` : '',
      ].filter(Boolean).join('');
      return `${front}\t${back}`;
    });
    return ['#separator:tab', '#html:true', '#notetype:Basic', `#deck:${T('nb_anki_deck')}`, ...rows].join('\n');
  }

  $('#exportAnki').addEventListener('click', () => {
    download('kelime-defteri-anki.txt', anki(), 'text/plain;charset=utf-8');
    toast(T('nb_anki_done'));
  });

  $('#exportJson').addEventListener('click', () => {
    download('kelime-defteri.json', JSON.stringify(visible(), null, 2), 'application/json');
    toast(T('nb_json_done'));
  });
  $('#exportCsv').addEventListener('click', () => {
    download('kelime-defteri.csv', csv(), 'text/csv;charset=utf-8');
    toast(T('nb_csv_done'));
  });

  $('#clearAll').addEventListener('click', async () => {
    if (!entries.length) return;
    const ok = confirm(T('nb_confirm_clear', entries.length));
    if (!ok) return;
    await Vocab.clear();
    entries = [];
    refreshFilters();
    render();
    toast(T('nb_cleared'));
  });

  for (const node of [el.search, el.show, el.pos, el.sort]) {
    node.addEventListener('input', render);
  }

  /* ---------- Başlangıç ---------- */

  // Menü dili önce yüklenir, sonra sayfa çizilir; dil değişirse sayfa tazelenir
  Settings.load()
    .then((s) => I18n.load(s.uiLang))
    .catch(() => I18n.load('auto'))
    .then(() => {
      I18n.apply(document);
      document.title = T('nb_title');
      return Vocab.load();
    })
    .then((list) => {
      entries = list;
      refreshFilters();
      render();
    });

  Settings.onChange(async (next, prev) => {
    if (next.uiLang === prev.uiLang) return;
    await I18n.load(next.uiLang);
    I18n.apply(document);
    document.title = T('nb_title');
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
