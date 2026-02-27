/**
 * Early Content Script
 * Запускается на этапе document_start для предотвращения мигания (FOUC).
 * Использует паттерн "Ширма" (Curtain): скрывает страницу до применения настроек.
 */
(() => {
  // 1. Мгновенно прячем страницу (до того, как браузер начнет ее рисовать)
  const curtainStyle = document.createElement('style');
  curtainStyle.id = 'cu-curtain-style';
  curtainStyle.textContent = 'html { opacity: 0 !important; transition: none !important; }';
  document.documentElement.appendChild(curtainStyle);

  // Функция для плавного снятия ширмы
  const removeCurtain = () => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        curtainStyle.textContent = 'html { opacity: 1 !important; transition: opacity 0.15s ease-in-out !important; }';
        setTimeout(() => curtainStyle.remove(), 200);
      }, 50);
    });
  };

  // Предохранитель: если хранилище отвечает слишком долго, показываем страницу в любом случае
  const fallbackTimer = setTimeout(removeCurtain, 500);

  const storageApi = (typeof browser !== 'undefined' && browser.storage) ? browser.storage.local : chrome.storage.local;
  const runtimeApi = (typeof browser !== 'undefined' && browser.runtime) ? browser.runtime : chrome.runtime;

  storageApi.get(['compactMode', 'theme', 'accent', 'drawer', 'els', 'hiddenItems', 'editMode'], (res) => {
    clearTimeout(fallbackTimer);

    // 2. Подключаем theme-override-pure.css (единственный файл темы)
    const link = document.createElement('link');
    link.id   = 'cu-theme-stylesheet';
    link.rel  = 'stylesheet';
    link.type = 'text/css';
    link.href = runtimeApi.getURL('theme-override-pure.css');
    (document.head || document.documentElement).appendChild(link);

    // 3. Устанавливаем data-атрибуты для управления темой и акцентом
    const h = document.documentElement;
    h.dataset.theme  = res.theme  || 'system';
    h.dataset.accent = res.accent || 'violet';
    h.dataset.kf     = '1'; // Калужский филиал
    if (res.drawer) h.dataset.drawer = '1';
    if (res.els)    h.dataset.els    = '1';

    // 4. Компактный режим
    if (res.compactMode) {
      h.classList.add('cu-compact-mode-active');
    }

    // 5. Скрытие предметов (только если не в режиме редактирования)
    if (res.hiddenItems && !res.editMode) {
      const hiddenIds = Object.keys(res.hiddenItems).filter(id => res.hiddenItems[id]);
      if (hiddenIds.length > 0) {
        const selectors = hiddenIds.map(id => `#frontpage-course-list .coursebox[data-courseid="${id}"]`).join(',\n');
        const style = document.createElement('style');
        style.id = 'cu-hidden-items-style';
        style.textContent = `${selectors} { display: none !important; }`;
        (document.head || document.documentElement).appendChild(style);
      }
    }

    // 6. Снимаем ширму
    removeCurtain();
  });
})();
