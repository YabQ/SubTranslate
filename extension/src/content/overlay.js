/* =========================================================
   overlay.js — Videonun üzerine çift altyazıyı çizen katman.
   Shadow DOM içinde çalışır; sayfanın stilleri onu, o da sayfayı
   etkilemez. Video karesinin gerçek alanını (siyah bantlar hariç)
   hesaplar, tam ekranda da videoyla birlikte kalır.
   ========================================================= */
(() => {
  const CRDS = (globalThis.CRDS = globalThis.CRDS || {});

  const CSS = `
    :host { all: initial; }
    .stage {
      position: absolute; left: 0; top: 0; width: 100%; height: 100%;
      --base: 24px; --prim: #fff; --sec: #ffd84d; --hot: #4dd2ff; --bg: .35; --sec-scale: 1;
      --font: "Noto Sans", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    }
    .stack {
      position: absolute; left: 3%; right: 3%;
      display: flex; flex-direction: column; align-items: center; gap: .12em;
      text-align: center; font-size: var(--base);
    }
    .bottom { bottom: 7%; transition: bottom .25s ease; }
    .top { top: 4%; }
    .line {
      max-width: 100%; line-height: 1.28; font-family: var(--font);
      font-weight: 600; letter-spacing: .005em; overflow-wrap: anywhere;
    }
    .line > span {
      white-space: pre-line; padding: .04em .32em; border-radius: .18em;
      background: rgba(0, 0, 0, var(--bg));
      -webkit-box-decoration-break: clone; box-decoration-break: clone;
      text-shadow:
        0 0 .08em #000, .045em .045em .06em #000, -.045em -.045em .06em #000,
        .045em -.045em .06em #000, -.045em .045em .06em #000, 0 .06em .14em rgba(0, 0, 0, .55);
    }
    .prim { color: var(--prim); }
    .sec { color: var(--sec); font-size: calc(var(--sec-scale) * 1em); }
    .sign { font-size: .78em; }
    .sign.sec { font-size: calc(var(--sec-scale) * .78em); }
    .italic > span, i { font-style: italic; }
    .upright { font-style: normal; }
    .w.hot { color: var(--hot); }
    /* Yalnızca üzerinde durulan kelime tıklanabilir olur; katmanın geri kalanı
       tıklamaları oynatıcıya geçirmeye devam eder */
    .w.hot.savable { pointer-events: auto; cursor: pointer; }
    .tip {
      position: absolute; left: 0; top: 0; z-index: 3; display: none; max-width: 74%;
      font: 600 max(11px, calc(var(--base) * .42))/1.34 var(--font); color: #fff;
      background: rgba(14, 15, 19, .93); border: 1px solid rgba(255, 255, 255, .14);
      border-radius: .5em; padding: .34em .6em; box-shadow: 0 6px 20px rgba(0, 0, 0, .45);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .tip.show { display: block; }
    .tip b { display: block; color: var(--hot); font-size: .92em; }
    .tip u { display: block; color: #e9eaee; text-decoration: none; }
    .tip s { display: block; color: #9aa0ab; font-size: .86em; text-decoration: none; }
    .toast {
      position: absolute; left: 12px; top: 12px; max-width: min(70%, 520px);
      font: 600 13px/1.4 "Segoe UI", system-ui, sans-serif; color: #fff;
      background: rgba(20, 21, 25, .86); border-left: 3px solid #f47521;
      padding: 6px 10px; border-radius: 6px;
      opacity: 0; transform: translateY(-4px); transition: opacity .25s, transform .25s;
    }
    .toast.show { opacity: 1; transform: none; }
  `;

  function div(className) {
    const el = document.createElement('div');
    el.className = className;
    return el;
  }

  // Videonun ekrandaki gerçek görüntü alanı (object-fit: contain siyah bantları hariç)
  function contentRect(video) {
    const r = video.getBoundingClientRect();
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh || !r.width || !r.height) return r;
    const fit = getComputedStyle(video).objectFit;
    if (fit === 'fill' || fit === 'cover') return r;
    let scale = Math.min(r.width / vw, r.height / vh);
    if (fit === 'none') scale = 1;
    else if (fit === 'scale-down') scale = Math.min(1, scale);
    const w = Math.min(r.width, vw * scale);
    const h = Math.min(r.height, vh * scale);
    return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h };
  }

  // Kelime sözlüğü açıkken satır kelime kelime kutulanır: fare vuruş testi ve
  // "bu kelime" renklendirmesi bu span'ler üzerinden yürür.
  function buildWords(span, line) {
    const hot = line.hot || [];
    for (const [i, tok] of CRDS.words.tokenize(line.text).entries()) {
      if (!tok.w) {
        span.append(tok.text);
        continue;
      }
      const word = document.createElement('span');
      const isHot = hot.includes(i);
      word.className = isHot ? (line.savable ? 'w hot savable' : 'w hot') : 'w';
      word.dataset.i = String(i);
      word.textContent = tok.text;
      span.append(word);
    }
  }

  function buildLine(line) {
    const el = div(`line ${line.cls}${line.italic ? ' italic' : ''}`);
    const span = document.createElement('span');
    const mixed = line.segs && line.segs.some((s) => s.italic !== line.italic);
    if (line.words && !mixed) {
      buildWords(span, line);
      if (line.hover) {
        el.dataset.hover = '1';
        el.dataset.text = line.text;
      }
    } else if (!mixed) {
      span.textContent = line.text;
    } else {
      for (const seg of line.segs) {
        if (seg.italic === line.italic) {
          span.append(seg.text);
        } else {
          const part = document.createElement(seg.italic ? 'i' : 'span');
          if (!seg.italic) part.className = 'upright';
          part.textContent = seg.text;
          span.append(part);
        }
      }
    }
    el.append(span);
    return el;
  }

  class Overlay {
    constructor() {
      this.host = document.createElement('div');
      this.host.setAttribute('data-crds-overlay', '');
      this.host.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2147483000;overflow:hidden;display:block;';
      const root = this.host.attachShadow({ mode: 'closed' });
      try {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(CSS);
        root.adoptedStyleSheets = [sheet];
      } catch (_) {
        const style = document.createElement('style');
        style.textContent = CSS;
        root.append(style);
      }
      this.stage = div('stage');
      this.topStack = div('stack top');
      this.bottomStack = div('stack bottom');
      this.toastEl = div('toast');
      this.tipEl = div('tip');
      this.stage.append(this.topStack, this.bottomStack, this.tipEl);

      // Kelimeye tıklama: olay oynatıcıya geçmesin, yoksa video duraklar
      this.onWordClick = null;
      const swallow = (event) => {
        if (event.target.closest && event.target.closest('.w.savable')) event.stopPropagation();
      };
      this.stage.addEventListener('pointerdown', swallow);
      this.stage.addEventListener('mousedown', swallow);
      this.stage.addEventListener('click', (event) => {
        const el = event.target.closest && event.target.closest('.w.savable');
        if (!el) return;
        event.preventDefault();
        event.stopPropagation();
        if (this.onWordClick) this.onWordClick(el.textContent, Number(el.dataset.i));
      });
      root.append(this.stage, this.toastEl);

      this.video = null;
      this.keys = { top: '', bottom: '' };
      this.fontScale = 1;
      this.bottomOffset = 7;
      this.lifted = false;
      this.toastTimer = 0;
      this.resizeObserver = new ResizeObserver(() => this.layout());
      this.onFullscreen = () => {
        this.ensureAttached();
        this.layout();
      };
      document.addEventListener('fullscreenchange', this.onFullscreen);
    }

    attach(video) {
      if (this.video !== video) {
        this.resizeObserver.disconnect();
        this.video = video;
        this.keys = { top: '', bottom: '' };
        if (video) this.resizeObserver.observe(video);
      }
      if (!video) {
        this.host.remove();
        return;
      }
      this.ensureAttached();
      this.layout();
    }

    // Katmanı videonun kapsayıcısına yerleştirir (tam ekranda da içinde kalır)
    ensureAttached() {
      const parent = this.video && this.video.parentElement;
      if (!parent || this.host.parentElement === parent) return;
      if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
      parent.appendChild(this.host);
      this.resizeObserver.observe(parent);
    }

    layout() {
      const video = this.video;
      const parent = this.host.parentElement;
      if (!video || !parent || !video.isConnected) return;
      const r = contentRect(video);
      if (!r.width || !r.height) return;
      const pr = parent.getBoundingClientRect();
      const s = this.stage.style;
      s.left = `${r.left - pr.left - parent.clientLeft}px`;
      s.top = `${r.top - pr.top - parent.clientTop}px`;
      s.width = `${r.width}px`;
      s.height = `${r.height}px`;
      const base = Math.max(11, Math.min(r.height * 0.052, r.width * 0.034) * this.fontScale);
      s.setProperty('--base', `${base.toFixed(1)}px`);
    }

    applySettings(settings) {
      const s = this.stage.style;
      s.setProperty('--prim', settings.originalColor);
      s.setProperty('--sec', settings.translationColor);
      s.setProperty('--hot', settings.lookupColor);
      s.setProperty('--bg', String(settings.bgOpacity));
      s.setProperty('--sec-scale', String(settings.translationScale));
      this.fontScale = settings.fontScale;
      this.bottomOffset = settings.bottomOffset;
      this.setLift(this.lifted, true);
      this.layout();
    }

    // Oynatıcı kontrolleri açıkken alt satırları biraz yukarı taşır
    setLift(lifted, force) {
      if (lifted === this.lifted && !force) return;
      this.lifted = lifted;
      this.bottomStack.style.bottom = `${this.bottomOffset + (lifted ? 11 : 0)}%`;
    }

    // Bitmovin arayüzü varsa kontrol çubuğunun görünür olup olmadığı; yoksa null.
    // Her karede çağrıldığı için arayüz öğesi önbelleğe alınır.
    nativeControlsVisible() {
      if (!this.uiEl || !this.uiEl.isConnected) {
        this.uiEl = null;
        const now = Date.now();
        if (now - (this.uiLookupAt || 0) < 2000) return null;
        this.uiLookupAt = now;
        const scope = this.host.parentElement;
        this.uiEl = scope ? scope.querySelector('.bmpui-ui-uicontainer') : null;
        if (!this.uiEl) return null;
      }
      return this.uiEl.classList.contains('bmpui-controls-shown');
    }

    setVisible(visible) {
      this.host.style.display = visible ? 'block' : 'none';
    }

    render(model) {
      this.renderStack(this.topStack, model ? model.top : [], 'top');
      this.renderStack(this.bottomStack, model ? model.bottom : [], 'bottom');
    }

    renderStack(el, lines, slot) {
      const key = lines
        .map((l) => `${l.cls}\u0001${l.italic ? 1 : 0}\u0001${l.words ? 1 : 0}${l.savable ? 1 : 0}\u0001${(l.hot || []).join()}\u0001${l.text}`)
        .join('\u0002');
      if (key === this.keys[slot]) return;
      this.keys[slot] = key;
      el.replaceChildren(...lines.map(buildLine));
    }

    /* ---------- Kelime sözlüğü ---------- */

    // Katman tıklamaları geçirdiği için (pointer-events: none) fare konumu
    // elle sınanır: hangi kelime kutusunun içinde kaldığına bakılır.
    hitTest(x, y) {
      for (const line of this.stage.querySelectorAll('.line[data-hover]')) {
        for (const el of line.querySelectorAll('.w')) {
          for (const r of el.getClientRects()) {
            if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
              return { index: Number(el.dataset.i), word: el.textContent, lineText: line.dataset.text };
            }
          }
        }
      }
      return null;
    }

    showTip(word, meanings, note) {
      const parts = [];
      const title = document.createElement('b');
      title.textContent = word;
      parts.push(title);
      for (const meaning of meanings || []) {
        const line = document.createElement('u');
        line.textContent = meaning;
        parts.push(line);
      }
      if (note) {
        const hint = document.createElement('s');
        hint.textContent = note;
        parts.push(hint);
      }
      this.tipEl.replaceChildren(...parts);
      this.tipEl.classList.add('show');
      this.placeTip();
    }

    // Balonu, renklenen kelimenin üstüne (yer yoksa altına) hizalar.
    // Kontroller açılıp altyazı kaydığında da yeniden çağrılır.
    placeTip() {
      if (!this.tipEl.classList.contains('show')) return;
      const hot = this.stage.querySelector('.line[data-hover] .w.hot');
      if (!hot) {
        this.hideTip();
        return;
      }
      const r = hot.getBoundingClientRect();
      // Dikey hizada satırın değil, satır yığınının dışına çıkılır: balon
      // çeviri satırını (yani renklenen karşılığı) örtmemeli
      const block = (hot.closest('.stack') || hot).getBoundingClientRect();
      const stage = this.stage.getBoundingClientRect();
      if (!stage.width) return;
      const tipW = this.tipEl.offsetWidth;
      const tipH = this.tipEl.offsetHeight;
      const gap = Math.max(6, tipH * 0.22);
      const above = block.top - stage.top - gap - tipH >= 0;
      const x = Math.min(Math.max(r.left + r.width / 2 - stage.left, tipW / 2 + 6), stage.width - tipW / 2 - 6);
      const y = above
        ? block.top - stage.top - gap
        : Math.min(block.bottom - stage.top + gap, stage.height - tipH - 4);
      this.tipEl.style.left = `${x}px`;
      this.tipEl.style.top = `${y}px`;
      this.tipEl.style.transform = `translate(-50%, ${above ? '-100%' : '0'})`;
    }

    hideTip() {
      this.tipEl.classList.remove('show');
    }

    toast(message, ms = 4000) {
      clearTimeout(this.toastTimer);
      this.toastEl.textContent = message;
      this.toastEl.classList.add('show');
      this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), ms);
    }

    hideToast() {
      clearTimeout(this.toastTimer);
      this.toastEl.classList.remove('show');
    }
  }

  CRDS.Overlay = Overlay;
})();
