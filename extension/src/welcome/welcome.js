/* =========================================================
   welcome.js — Kurulumdan sonra bir kez açılan karşılama sayfası.
   Eklenti kurulur kurulmaz çalıştığı için sayfanın tek işi anlatmaktır.
   Ayar menüsü buradan açılamaz (chrome.action.openPopup eklenti
   sayfalarına kapalıdır), bu yüzden yalnızca kelime defteri düğmesi
   ve araç çubuğu simgesini gösteren bir satır vardır.
   ========================================================= */
(() => {
  const Settings = globalThis.CRDS.settings;
  const I18n = globalThis.CRDS.i18n;
  const T = (key, subs) => I18n.t(key, subs);
  const $ = (sel) => document.querySelector(sel);

  // Chrome Web Mağazası'nın bu eklentiye verdiği kimlik: mağaza kaydı
  // değişirse (yeni bir listeleme açılırsa) burası da güncellenmelidir.
  const STORE_ID = 'dokkeifgjdekkeacknhhhkdhmpiooaek';
  const REVIEW_URL = `https://chromewebstore.google.com/detail/${STORE_ID}/reviews`;

  $('#review').href = REVIEW_URL;

  // Defteri açma işini servis çalışanı yapar (popup'taki düğmeyle aynı yol)
  $('#openNotebook').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'open-notebook' }).catch(() => {});
  });

  function draw() {
    I18n.apply(document);
    document.title = T('wc_doc_title');
  }

  /* ---------- Başlangıç ---------- */

  // Metinler yerleşmeden önce menü dili yüklenir
  Settings.load()
    .then((s) => I18n.load(s.uiLang))
    .catch(() => I18n.load('auto'))
    .then(draw);

  // Menü dili başka bir sekmede değiştirilirse bu sayfa da o dile döner
  Settings.onChange(async (next, prev) => {
    if (next.uiLang === prev.uiLang) return;
    await I18n.load(next.uiLang);
    draw();
  });
})();
