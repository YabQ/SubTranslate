/* =========================================================
   popup.js — Eklenti menüsü: ayarlar, API anahtarları ve
   etkin Crunchyroll sekmesinin canlı durumu.
   ========================================================= */
(() => {
  const { settings: S, lang: L } = globalThis.CRDS;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const PROVIDER_NAMES = { google: 'Google Çeviri', deepl: 'DeepL', claude: 'Claude' };
  const KEY_FIELDS = ['deeplKey', 'claudeKey'];
  const FORMATTERS = {
    fontScale: (v) => `%${Math.round(v * 100)}`,
    translationScale: (v) => `%${Math.round(v * 100)}`,
    bgOpacity: (v) => `%${Math.round(v * 100)}`,
    bottomOffset: (v) => `%${Math.round(v)}`,
  };

  let current = { ...S.DEFAULTS };
  let activeTab = null;
  let tabState = null;

  /* ---------- Kaydetme ---------- */

  // Kayıtlar sırayla yapılır ki art arda gelen değişiklikler birbirini ezmesin
  let saving = Promise.resolve();
  function save(patch) {
    Object.assign(current, patch);
    saving = saving.then(() => S.save(patch)).catch(() => {});
    return saving;
  }

  const timers = {};
  function later(key, fn, ms) {
    clearTimeout(timers[key]);
    timers[key] = setTimeout(fn, ms);
  }

  async function flushKeys() {
    const patch = {};
    for (const id of KEY_FIELDS) {
      clearTimeout(timers[id]);
      patch[id] = $(`#${id}`).value.trim();
    }
    await chrome.storage.local.set(patch);
  }

  /* ---------- Form ---------- */

  function option(value, label) {
    const el = document.createElement('option');
    el.value = value;
    el.textContent = label;
    return el;
  }

  function detectedLocales() {
    const tracks = (tabState && tabState.tracks && tabState.tracks.tracks) || [];
    return [...new Set(tracks.map((t) => L.normalizeLocale(t.lang)).filter((c) => c && c !== 'none'))];
  }

  function fillPrimary() {
    const detected = new Set(detectedLocales());
    const codes = [...new Set([...detected, ...L.CR_LOCALES, current.primaryLang])];
    codes.sort((a, b) => Number(detected.has(b)) - Number(detected.has(a)));
    $('#primaryLang').replaceChildren(
      ...codes.map((c) => option(c, `${L.displayName(c)}${detected.has(c) ? '  •  bu bölümde var' : ''}`)),
    );
    $('#primaryLang').value = current.primaryLang;
  }

  function fillStatic() {
    const targets = [...new Set([...L.TARGET_LANGS, current.targetLang])];
    $('#targetLang').replaceChildren(...targets.map((c) => option(c, L.displayName(c))));
    $('#claudeModel').replaceChildren(...S.CLAUDE_MODELS.map((m) => option(m.id, m.label)));
  }

  function updateOutput(key, value) {
    const out = document.querySelector(`output[data-for="${key}"]`);
    if (out) out.textContent = (FORMATTERS[key] || String)(value);
  }

  function showProviderPanel(provider) {
    for (const panel of $$('.provider-panel')) panel.classList.toggle('active', panel.dataset.provider === provider);
  }

  function applyToForm(s) {
    for (const el of $$('[data-setting]')) {
      const key = el.dataset.setting;
      if (el.type === 'checkbox') el.checked = Boolean(s[key]);
      else el.value = String(s[key]);
      if (el.type === 'range') updateOutput(key, s[key]);
    }
    for (const radio of $$('input[name="provider"]')) radio.checked = radio.value === s.provider;
    showProviderPanel(s.provider);
  }

  function readValue(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'range') return Number(el.value);
    return el.value;
  }

  function bindForm() {
    for (const el of $$('[data-setting]')) {
      const key = el.dataset.setting;
      const live = el.type === 'range' || el.type === 'color' || el.tagName === 'TEXTAREA';
      el.addEventListener(live ? 'input' : 'change', () => {
        const value = readValue(el);
        current[key] = value;
        if (el.type === 'range') updateOutput(key, value);
        if (live) later(key, () => save({ [key]: value }), el.tagName === 'TEXTAREA' ? 700 : 250);
        else save({ [key]: value });
        if (key === 'enabled') renderStatus();
      });
    }

    for (const radio of $$('input[name="provider"]')) {
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        const provider = radio.value;
        requestProviderPermission(provider).then((granted) => {
          if (granted) {
            save({ provider });
            showProviderPanel(provider);
            setTestResult('', '');
          } else {
            // İzin verilmezse önceki servisle devam et
            for (const r of $$('input[name="provider"]')) r.checked = r.value === current.provider;
            setTestResult(`✗ ${PROVIDER_NAMES[provider]} için izin verilmedi; önceki servis kullanılmaya devam ediyor.`, 'err');
          }
          updatePermissionNotice();
        });
      });
    }

    $('#permGrant').addEventListener('click', () => {
      requestProviderPermission(current.provider).then((granted) => {
        updatePermissionNotice();
        // İzin yüzünden duran çeviriyi yeniden başlat
        if (granted) save({ retryToken: Date.now() });
      });
    });

    for (const id of KEY_FIELDS) {
      $(`#${id}`).addEventListener('input', () => {
        later(id, async () => {
          await chrome.storage.local.set({ [id]: $(`#${id}`).value.trim() });
          // Anahtar yüzünden duran bir çeviri varsa yeniden başlat
          const st = pickStatus(tabState);
          if (st && st.secondary && st.secondary.error) save({ retryToken: Date.now() });
        }, 500);
      });
    }

    $('#testProvider').addEventListener('click', testProvider);
    $('#clearCache').addEventListener('click', clearCache);
    $('#retry').addEventListener('click', () => save({ retryToken: Date.now() }));
  }

  /* ---------- İsteğe bağlı izinler (DeepL, Claude) ---------- */

  // chrome.permissions.request yalnızca bir tıklamanın içinde çağrılabilir; bu yüzden
  // tıklama işleyicisinde, herhangi bir await'ten önce çağrılmalıdır.
  function requestProviderPermission(provider) {
    const origins = S.PROVIDER_ORIGINS[provider];
    if (!origins) return Promise.resolve(true);
    return chrome.permissions.request({ origins }).catch(() => false);
  }

  async function updatePermissionNotice() {
    const origins = S.PROVIDER_ORIGINS[current.provider];
    const granted = !origins || (await chrome.permissions.contains({ origins }).catch(() => false));
    $('#permNotice').hidden = granted;
    if (!granted) $('#permText').textContent = `${PROVIDER_NAMES[current.provider]} kullanmak için izin gerekiyor.`;
  }

  /* ---------- Servis testi ve önbellek ---------- */

  function setTestResult(text, tone) {
    const el = $('#testResult');
    el.textContent = text;
    el.className = `test-result ${tone}`;
  }

  function testProvider() {
    runTest(requestProviderPermission(current.provider));
  }

  async function runTest(permission) {
    const btn = $('#testProvider');
    btn.disabled = true;
    setTestResult('Deneniyor…', '');
    const granted = await permission;
    updatePermissionNotice();
    if (!granted) {
      btn.disabled = false;
      setTestResult(`✗ ${PROVIDER_NAMES[current.provider]} için izin verilmedi`, 'err');
      return;
    }
    await flushKeys();
    const res = await chrome.runtime
      .sendMessage({ type: 'test-provider', provider: current.provider, target: current.targetLang })
      .catch((err) => ({ ok: false, error: String((err && err.message) || err) }));
    btn.disabled = false;
    if (res && res.ok) setTestResult(`✓ ${res.translations[0]}`, 'ok');
    else setTestResult(`✗ ${(res && res.error) || 'Yanıt alınamadı'}`, 'err');
  }

  async function clearCache() {
    const count = await chrome.runtime.sendMessage({ type: 'cache-clear' }).catch(() => 0);
    $('#footerNote').textContent = `${count || 0} bölümün çevirisi silindi`;
  }

  /* ---------- Canlı durum ---------- */

  function pickStatus(tab) {
    const list = Object.values((tab && tab.frames) || {}).sort((a, b) => b.at - a.at);
    return list.find((s) => s.video) || list[0] || null;
  }

  function isCrunchyroll(tab) {
    return !!tab && /^https:\/\/([a-z0-9-]+\.)*crunchyroll\.com\//i.test(tab.url || '');
  }

  function renderStatus() {
    const st = pickStatus(tabState);
    const tracks = (tabState && tabState.tracks && tabState.tracks.tracks) || (st && st.tracks) || [];
    const lines = [];
    let heading = 'Bekleniyor';
    let tone = '';
    let progress = null;
    let canRetry = false;

    if (!current.enabled) {
      heading = 'Kapalı';
      lines.push('Sağ üstteki anahtarla açabilirsin.');
    } else if (!isCrunchyroll(activeTab)) {
      heading = 'Crunchyroll sekmesi değil';
      lines.push("Crunchyroll'da bir bölüm açınca durum burada görünür.");
    } else if (!st || (!tracks.length && st.phase === 'waiting-tracks')) {
      heading = 'Altyazı bilgisi bekleniyor';
      tone = 'busy';
      lines.push('Bir bölümü oynatmaya başla. Eklentiyi yeni kurduysan sayfayı bir kez yenile.');
    } else if (st.phase === 'waiting-video' || st.phase === 'idle') {
      heading = 'Video bekleniyor';
      tone = 'busy';
    } else if (st.phase === 'loading') {
      heading = 'Altyazı yükleniyor…';
      tone = 'busy';
    } else if (st.phase === 'error') {
      heading = 'Altyazı yüklenemedi';
      tone = 'err';
      lines.push({ error: st.error });
      canRetry = true;
    } else if (st.phase === 'ready' && st.primary) {
      const sec = st.secondary;
      lines.push(`Orijinal: ${L.displayName(st.primary.lang)} · ${st.primary.cues} satır`);
      heading = 'Hazır';
      tone = 'ok';
      if (!sec) {
        heading = 'Hazırlanıyor…';
        tone = 'busy';
      } else if (sec.mode === 'track') {
        lines.push(`Çeviri: Crunchyroll'un resmi ${L.displayName(sec.lang)} altyazısı`);
      } else if (sec.mode === 'same') {
        lines.push('Çeviri dili orijinalle aynı; ikinci satır gösterilmiyor.');
      } else if (sec.mode === 'off') {
        lines.push('Çeviri satırı kapalı.');
      } else if (sec.error) {
        heading = sec.done ? 'Çeviri yarım kaldı' : 'Çeviri yapılamadı';
        tone = 'err';
        lines.push({ error: sec.error });
        if (sec.total) progress = sec.done / sec.total;
        canRetry = true;
      } else if (!sec.finished) {
        heading = 'Çevriliyor…';
        tone = 'busy';
        progress = sec.total ? sec.done / sec.total : 0;
        lines.push(`${L.displayName(sec.lang)} · ${PROVIDER_NAMES[sec.provider] || sec.provider} · ${sec.done}/${sec.total}`);
      } else {
        lines.push(`Çeviri: ${L.displayName(sec.lang)} · ${PROVIDER_NAMES[sec.provider] || sec.provider}${sec.cached ? ' (önbellekten)' : ''}`);
      }
      if (st.stripped) lines.push('Videoya gömülü altyazı kaldırıldı.');
    }

    $('#statusDot').className = `dot ${tone}`;
    $('#statusTitle').textContent = heading;
    $('#statusBody').replaceChildren(
      ...lines.map((line) => {
        const el = document.createElement('div');
        if (typeof line === 'object') {
          el.className = 'error';
          el.textContent = line.error || 'Bilinmeyen hata';
        } else {
          el.textContent = line;
        }
        return el;
      }),
    );
    $('#retry').hidden = !canRetry;

    const bar = $('#statusProgress');
    bar.hidden = progress === null;
    if (progress !== null) bar.firstElementChild.style.width = `${Math.round(progress * 100)}%`;

    const activeLangs = new Set([st && st.primary && st.primary.lang, st && st.secondary && st.secondary.mode === 'track' && st.secondary.lang]);
    $('#statusTracks').replaceChildren(
      ...tracks.map((t) => {
        const code = L.normalizeLocale(t.lang);
        const chip = document.createElement('span');
        chip.className = `chip${activeLangs.has(code) ? ' active' : ''}`;
        chip.textContent = `${L.displayName(code)}${t.kind === 'captions' ? ' [CC]' : ''}`;
        chip.title = `${code} · ${t.format || 'biçim bilinmiyor'}`;
        return chip;
      }),
    );
  }

  async function watchActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tab || null;
    if (!isCrunchyroll(activeTab)) return;
    const key = `tab:${activeTab.id}`;
    tabState = (await chrome.storage.session.get(key))[key] || null;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'session' || !changes[key]) return;
      const before = detectedLocales().join();
      tabState = changes[key].newValue || null;
      if (detectedLocales().join() !== before) fillPrimary();
      renderStatus();
    });
  }

  /* ---------- Başlangıç ---------- */

  (async () => {
    const [settings, keys] = await Promise.all([S.load(), chrome.storage.local.get(KEY_FIELDS)]);
    current = settings;
    for (const id of KEY_FIELDS) $(`#${id}`).value = keys[id] || '';
    await watchActiveTab().catch(() => {});
    fillStatic();
    fillPrimary();
    applyToForm(current);
    bindForm();
    renderStatus();
    updatePermissionNotice();
  })();
})();
