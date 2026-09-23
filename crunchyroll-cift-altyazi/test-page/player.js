/* =========================================================
   player.js — Deneme sayfasının sahte oynatıcısı.
   Canvas'tan üretilen canlı bir video akışı ve ileri/geri
   sarılabilen sahte bir saat (video.currentTime) sağlar.
   ========================================================= */
(() => {
  const DURATION = 45;
  const PLAY_URL = `${location.origin}/fake/playback/v3/GTEST00001/web/chrome/play`;
  const $ = (sel) => document.querySelector(sel);
  const video = $('#video');
  const ui = $('#ui');
  const log = (...args) => window.dispatchEvent(new CustomEvent('harness:log', { detail: args }));

  // Mağaza ekran görüntüsü modu: ?shot&caption=Başlık&sub=Alt satır
  const params = new URLSearchParams(location.search);
  const shot = params.has('shot');
  if (shot) {
    document.body.classList.add('shot');
    if (params.get('caption')) {
      const cap = document.createElement('div');
      cap.className = `shot-caption${params.get('pos') === 'bottom' ? ' bottom' : ''}`;
      cap.textContent = params.get('caption');
      if (params.get('sub')) {
        const sub = document.createElement('small');
        sub.textContent = params.get('sub');
        cap.append(sub);
      }
      $('#player').append(cap);
    }
  }

  /* ---------- Sahte saat ---------- */
  const clock = { t: 0, playing: false, last: performance.now() };
  const now = () => Math.min(DURATION, clock.playing ? clock.t + (performance.now() - clock.last) / 1000 : clock.t);
  Object.defineProperty(video, 'currentTime', {
    configurable: true,
    get: now,
    set(v) {
      clock.t = Math.max(0, Math.min(DURATION, Number(v) || 0));
      clock.last = performance.now();
      video.dispatchEvent(new Event('seeked'));
    },
  });
  Object.defineProperty(video, 'paused', { configurable: true, get: () => !clock.playing });
  Object.defineProperty(video, 'ended', { configurable: true, get: () => now() >= DURATION });
  Object.defineProperty(video, 'duration', { configurable: true, get: () => DURATION });

  function play() {
    clock.t = now() >= DURATION ? 0 : now();
    clock.last = performance.now();
    clock.playing = true;
    video.dispatchEvent(new Event('play'));
    video.dispatchEvent(new Event('playing'));
  }
  function pause() {
    clock.t = now();
    clock.playing = false;
    video.dispatchEvent(new Event('pause'));
  }

  /* ---------- Canvas sahnesi ---------- */
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = shot ? 800 : 720;
  const ctx = canvas.getContext('2d');
  const stars = Array.from({ length: 70 }, (_, i) => [(i * 173) % 1280, (i * 97) % 380, 0.5 + ((i * 7) % 10) / 10]);
  const fmt = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(1).padStart(4, '0')}`;

  function draw() {
    const t = now();
    ctx.setTransform(1, 0, 0, canvas.height / 720, 0, 0); // sahne 1280x720 düzleminde çizilir
    const sky = ctx.createLinearGradient(0, 0, 0, 720);
    sky.addColorStop(0, '#141a3a');
    sky.addColorStop(0.55, '#5b3b6e');
    sky.addColorStop(1, '#e8906a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1280, 720);
    for (const [x, y, s] of stars) {
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * s + x));
      ctx.fillStyle = '#fff';
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath();
    // Dikey ölçeklemede (çekim modu) ay daire kalsın diye yarıçap ters oranlanır
    ctx.ellipse(200 + t * 20, 170 + Math.sin(t / 3) * 20, 60, (60 * 720) / canvas.height, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2140';
    ctx.beginPath();
    ctx.moveTo(0, 720);
    for (let x = 0; x <= 1280; x += 40) ctx.lineTo(x, 470 + Math.sin(x / 140) * 60 + Math.cos(x / 60) * 15);
    ctx.lineTo(1280, 720);
    ctx.fill();
    ctx.fillStyle = '#17122a';
    ctx.beginPath();
    ctx.moveTo(0, 720);
    for (let x = 0; x <= 1280; x += 40) ctx.lineTo(x, 560 + Math.sin(x / 90 + 1) * 40);
    ctx.lineTo(1280, 720);
    ctx.fill();
    if (!shot) {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.font = '600 28px Segoe UI, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`DENEME VİDEOSU  ${fmt(t)}`, 1250, 50);
    }
    $('#time').textContent = `${fmt(t)} / ${fmt(DURATION)}`;
    if (document.activeElement !== $('#seek')) $('#seek').value = String(t);
    $('#play').textContent = clock.playing ? '❚❚ Duraklat' : '▶ Oynat';
    requestAnimationFrame(draw);
  }
  draw();
  video.srcObject = canvas.captureStream(30);
  HTMLMediaElement.prototype.play.call(video).catch(() => {});

  /* ---------- Denetimler ---------- */
  $('#play').addEventListener('click', () => (clock.playing ? pause() : play()));
  $('#seek').max = String(DURATION);
  $('#seek').addEventListener('input', (e) => {
    video.currentTime = Number(e.target.value);
  });
  $('#fullscreen').addEventListener('click', () => $('#player').requestFullscreen());
  $('#controls').addEventListener('click', () => {
    const shown = ui.classList.toggle('bmpui-controls-shown');
    ui.classList.toggle('bmpui-controls-hidden', !shown);
  });
  $('#aspect').addEventListener('click', () => $('#player').classList.toggle('tall'));
  document.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.toggle;
      const s = await globalThis.CRDS.settings.load();
      await globalThis.CRDS.settings.save({ [key]: !s[key] });
    });
  });
  document.querySelectorAll('[data-scale]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const s = await globalThis.CRDS.settings.load();
      await globalThis.CRDS.settings.save({ fontScale: s.fontScale + Number(btn.dataset.scale) });
    });
  });
  $('#target').addEventListener('change', (e) => globalThis.CRDS.settings.save({ targetLang: e.target.value }));

  /* ---------- Günlük ve durum panelleri ---------- */
  window.addEventListener('harness:log', (e) => {
    const line = document.createElement('div');
    line.textContent = `${new Date().toLocaleTimeString('tr-TR')}  ${e.detail.join(' ')}`;
    $('#log').prepend(line);
  });
  window.addEventListener('harness:status', (e) => {
    $('#status').textContent = JSON.stringify(e.detail, null, 2);
  });

  // Oynatıcı açılır açılmaz Crunchyroll'un yaptığı gibi playback isteği at
  setTimeout(async () => {
    const res = await fetch(PLAY_URL, { headers: { authorization: 'Bearer test' } });
    const data = await res.json();
    const stripped = data.hardSubs['en-US'].url === data.hardSubs.none.url;
    log(`playback yanıtı alındı — gömülü altyazı ${stripped ? 'kaldırıldı ✓' : 'olduğu gibi'}`);
    play();
  }, 400);
})();
