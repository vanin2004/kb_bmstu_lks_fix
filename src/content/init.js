/**
 * init.js — точка входа content-script
 *
 * ════════════════════════════════════════════════════════════════
 *  Как добавить новую фичу:
 *
 *  1. Создать src/content/modules/my-feature.js
 *     — объявить: async function initMyFeature() { ... }
 *     — объявить вспомогательные функции / apply-функции
 *
 *  2. Добавить файл в оба манифеста (manifest.json + manifest-firefox.json)
 *     в массив js[] перед "src/content/init.js"
 *
 *  3. Вызвать await initMyFeature() в функции init() ниже
 *
 *  4. Если нужны сообщения от popup → добавить case в messages.js
 *
 *  5. Если нужен UI в попапе → добавить в popup.html + popup.js
 *
 *  6. Новые storage-ключи задокументировать в storage-keys.md
 * ════════════════════════════════════════════════════════════════
 */
'use strict';

(async function init() {
  // Тема применяется на всех страницах
  await initTheme();

  // Компактные настройки на всех страницах
  await initCompactSettings();

  // Автозаполнение имени файла (работает на всех страницах с диалогом загрузки)
  await initAutoFilename();

  // Автовход через CAS (работает на всех страницах)
  await initAutologin();

  // Удобная навигация (работает на всех страницах)
  await initNavigation();

  if (isMainPage) {
    await initMainPage();
    await initGrades();
  } else if (isCoursePage || isModPage) {
    await applyCustomTitleToHeading();
    await injectCourseInfoBlock();
    initCourseHeadingLink();
    if (isCoursePage) await initCourseGrades();
    if (isModPage)    await initAssignPage();
  }

  // Снять класс скрытия контента (гарантированно, включая страховой вариант)
  document.documentElement.classList.remove('kb-content-loading');
})();
