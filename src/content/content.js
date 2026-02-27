/**
 * content.js — основной content-script расширения kb_bmstu_lks_fix
 *
 * Работает на: *://e-learning.bmstu.ru/kaluga/*
 * Загружается ПОСЛЕ storage.js, поэтому window.storageAdapter доступен.
 *
 * Страницы:
 *   body#page-site-index          — главная (список предметов)
 *   body#page-course-view-topics  — страница предмета
 *   body#page-mod-*               — страница модуля / задания
 */

'use strict';

// ── Кросс-браузерный API ────────────────────────────────────────────────────
const extAPI = (typeof browser !== 'undefined') ? browser : chrome;
const adapter = window.storageAdapter;

// ── Тип страницы ────────────────────────────────────────────────────────────
const bodyId = document.body.id || '';
const isMainPage   = bodyId === 'page-site-index';
const isCoursePage = bodyId.startsWith('page-course-view');
const isModPage    = bodyId.startsWith('page-mod-');

// ── Состояние, работающее в памяти ─────────────────────────────────────────
// Изменения хранятся ТОЛЬКО здесь до выключения режима редактирования
let _editState = {
  hiddenItems:    {},   // { id: bool }
  customTitles:   {},   // { id: string|null }
  itemColors:     {},   // { id: '#rrggbb' }
  hiddenImages:   {},   // { id: bool }
};

let _editMode = false;

// Флаги включённых фич (по умолчанию включены)
let _features = {
  sortAlpha:    true,
  swapOddEven:  true,
};

// ── Утилиты ─────────────────────────────────────────────────────────────────
function applyTheme(themeEnabled, theme, accent) {
  // CSS загружен через content_scripts — достаточно управлять data-атрибутами
  const html = document.documentElement;
  if (themeEnabled) {
    html.dataset.theme  = theme  || 'system';
    html.dataset.accent = accent || 'violet';
  } else {
    delete html.dataset.theme;
    delete html.dataset.accent;
  }
  // Синхронизировать кеш, чтобы theme-early.js при следующей загрузке сработал мгновенно
  try {
    sessionStorage.setItem('kb_theme_cfg', JSON.stringify({ themeEnabled, theme, accent }));
  } catch (_) {}
}

function applyCourseCategoryComboVisibility(hide) {
  const block = document.getElementById('frontpage-category-combo');
  if (!block) return;
  block.style.display = hide ? 'none' : '';
}

function applyPagingMoreLinkVisibility(hide) {
  document.querySelectorAll('.paging.paging-morelink').forEach(el => {
    el.style.display = hide ? 'none' : '';
  });
}

function applyEnrolIconVisibility(hide) {
  document.querySelectorAll('img[src*="enrol_bmstugroups"]').forEach(el => {
    el.style.display = hide ? 'none' : '';
  });
}

// ── Идентификатор предмета ───────────────────────────────────────────────────
function getCourseIdFromUrl(url) {
  const m = (url || location.href).match(/[?&]id=(\d+)/);
  return m ? m[1] : null;
}

function getCourseIdFromBreadcrumb() {
  const links = document.querySelectorAll('#page-navbar .breadcrumb a[href]');
  for (const a of links) {
    if (a.href.includes('course/view.php')) {
      return getCourseIdFromUrl(a.href);
    }
  }
  return null;
}

function getCurrentCourseId() {
  if (isCoursePage) return getCourseIdFromUrl(location.href);
  if (isModPage)    return getCourseIdFromBreadcrumb();
  return null;
}

// ── Тема оформления на детальных страницах ───────────────────────────────────
async function initTheme() {
  const cfg = await adapter.getMultiple(['themeEnabled', 'theme', 'accent']);
  applyTheme(cfg.themeEnabled, cfg.theme, cfg.accent);
}

// ── Заменить h1 кастомным названием на странице предмета / модуля ────────────
async function applyCustomTitleToHeading() {
  const courseId = getCurrentCourseId();
  if (!courseId) return;

  const customTitles = (await adapter.get('customTitles')) || {};
  const customTitle  = customTitles[courseId] || null;

  // Обновить кеш content FOUC до early return, чтобы правильно отражать текущее состояние
  try {
    const existing = JSON.parse(sessionStorage.getItem('kb_content_cfg') || '{}');
    existing.hideCourse = !!customTitle;
    sessionStorage.setItem('kb_content_cfg', JSON.stringify(existing));
  } catch (_) {}

  if (!customTitle) return;

  const h1 = document.querySelector('#page-header .page-header-headings h1');
  if (!h1) return;

  if (!h1.dataset.kbOriginal) {
    h1.dataset.kbOriginal = h1.textContent.trim();
  }
  h1.textContent = customTitle;
}

// ── Блок кастомной информации на страницах предмета / модулей ────────────────
async function injectCourseInfoBlock() {
  const courseId = getCurrentCourseId();
  if (!courseId) return;

  const cfg = await adapter.getMultiple(['customTitles', 'itemColors', 'courseTeachers']);
  const customTitles   = cfg.customTitles   || {};
  const itemColors     = cfg.itemColors     || {};
  const courseTeachers = cfg.courseTeachers || {};

  const customTitle = customTitles[courseId]   || null;
  const color       = itemColors[courseId]     || null;
  const teachers    = courseTeachers[courseId] || [];

  // Не вставляем, если нечего показывать
  if (!customTitle && !color && teachers.length === 0) return;

  const cardBody = document.querySelector('#page-header .card-body');
  if (!cardBody) return;

  // Предотвращаем дублирование
  if (document.getElementById('kb-course-info-block')) return;

  const block = document.createElement('div');
  block.id = 'kb-course-info-block';
  block.className = 'kb-course-info-block';

  // Цвет курса через CSS-переменную → используется для border-left
  if (color) {
    block.style.setProperty('--kb-course-color', color);
  }

  if (customTitle) {
    const title = document.createElement('div');
    title.className = 'kb-course-custom-title';
    title.textContent = customTitle;
    block.appendChild(title);
  }

  if (teachers.length > 0) {
    const teacherEl = document.createElement('div');
    teacherEl.className = 'kb-course-teachers';
    teacherEl.textContent = teachers.join(', ');
    block.appendChild(teacherEl);
  }

  cardBody.appendChild(block);
}

// ── Главная страница: работа с карточками предметов ──────────────────────────

// Применить цветную полосу к .coursebox
function applyColorStrip(box, color) {
  box.style.setProperty('--kb-course-color', color || '');
  if (color) {
    box.classList.add('kb-has-color');
  } else {
    box.classList.remove('kb-has-color');
  }
}

// Обновить отображаемое название
function applyTitle(box, courseId, customTitles) {
  const link = box.querySelector('.coursename a');
  if (!link) return;

  if (!link.dataset.kbOriginal) {
    link.dataset.kbOriginal = link.textContent.trim();
  }
  const custom = customTitles[courseId] ?? null;
  link.textContent = custom || link.dataset.kbOriginal;
}

// Скрыть/показать карточку в обычном режиме
function applyVisibility(box, courseId, hiddenItems) {
  if (hiddenItems[courseId]) {
    box.classList.add('kb-hidden-item');
    // В режиме редактирования скрытые предметы показываем (с классом-маркером),
    // в обычном режиме — прячем через display:none
    box.style.display = _editMode ? '' : 'none';
  } else {
    box.classList.remove('kb-hidden-item');
    box.style.display = '';
  }
}

// Скрыть/показать картинку карточки
function applyImageVisibility(box, courseId, hiddenImages) {
  const img = box.querySelector('.courseimage');
  if (!img) return;
  img.style.display = hiddenImages[courseId] ? 'none' : '';
}

// Создать панель редактирования для одной карточки
function createEditPanel(box, courseId) {
  if (box.querySelector('.kb-edit-panel')) return;

  const panel = document.createElement('div');
  panel.className = 'kb-edit-panel';

  // --- Чекбокс "Скрыть"
  const hideLabel = document.createElement('label');
  hideLabel.className = 'kb-hide-label';

  const hideChk = document.createElement('input');
  hideChk.type = 'checkbox';
  hideChk.className = 'kb-hide-checkbox';
  hideChk.checked = !!_editState.hiddenItems[courseId];
  hideChk.addEventListener('change', () => {
    _editState.hiddenItems[courseId] = hideChk.checked;
    applyVisibility(box, courseId, _editState.hiddenItems);
  });

  const hideText = document.createElement('span');
  hideText.textContent = 'Скрыть предмет';

  hideLabel.appendChild(hideChk);
  hideLabel.appendChild(hideText);

  // --- Оригинальное название
  const origLink = box.querySelector('.coursename a');
  const origText = origLink ? origLink.dataset.kbOriginal || origLink.textContent.trim() : '';

  const origNameEl = document.createElement('div');
  origNameEl.className = 'kb-original-name';
  origNameEl.textContent = origText;

  // --- Редактируемое поле названия
  const titleRow = document.createElement('div');
  titleRow.className = 'kb-title-row';

  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'kb-title-input';
  titleInput.value = _editState.customTitles[courseId] || origText;
  titleInput.placeholder = origText;
  titleInput.addEventListener('input', () => {
    const val = titleInput.value.trim();
    _editState.customTitles[courseId] = val || null;
    if (origLink) origLink.textContent = val || origText;
  });

  const resetTitleBtn = document.createElement('button');
  resetTitleBtn.type = 'button';
  resetTitleBtn.className = 'kb-reset-title-btn';
  resetTitleBtn.textContent = 'по умолч.';
  resetTitleBtn.title = 'Сбросить к исходному названию';
  resetTitleBtn.addEventListener('click', () => {
    titleInput.value = origText;
    _editState.customTitles[courseId] = null;
    if (origLink) origLink.textContent = origText;
  });

  titleRow.appendChild(titleInput);
  titleRow.appendChild(resetTitleBtn);

  // --- Палитра акцентных цветов
  const ACCENT_PALETTE = [
    { label: 'Фиолетовый', hex: '#694fa3' },
    { label: 'Синий',      hex: '#00658b' },
    { label: 'Розовый',    hex: '#95416e' },
    { label: 'Красный',    hex: '#9c4235' },
    { label: 'Зелёный',    hex: '#006c4b' },
  ];

  const colorWrapper = document.createElement('div');
  colorWrapper.className = 'kb-color-wrapper';

  const colorLabel = document.createElement('span');
  colorLabel.className = 'kb-color-label';
  colorLabel.textContent = 'Цвет:';
  colorWrapper.appendChild(colorLabel);

  ACCENT_PALETTE.forEach(({ label, hex }) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'kb-color-swatch';
    swatch.style.background = hex;
    swatch.title = label;
    if (_editState.itemColors[courseId] === hex) {
      swatch.classList.add('kb-color-swatch--active');
    }
    swatch.addEventListener('click', () => {
      colorWrapper.querySelectorAll('.kb-color-swatch').forEach(s =>
        s.classList.remove('kb-color-swatch--active')
      );
      swatch.classList.add('kb-color-swatch--active');
      _editState.itemColors[courseId] = hex;
      applyColorStrip(box, hex);
    });
    colorWrapper.appendChild(swatch);
  });

  const clearColorBtn = document.createElement('button');
  clearColorBtn.type = 'button';
  clearColorBtn.className = 'kb-clear-color-btn';
  clearColorBtn.textContent = '✕';
  clearColorBtn.title = 'Сбросить цвет';

  clearColorBtn.addEventListener('click', () => {
    colorWrapper.querySelectorAll('.kb-color-swatch').forEach(s =>
      s.classList.remove('kb-color-swatch--active')
    );
    delete _editState.itemColors[courseId];
    applyColorStrip(box, null);
  });

  colorWrapper.appendChild(clearColorBtn);

  // --- Сборка панели
  panel.appendChild(hideLabel);
  panel.appendChild(origNameEl);
  panel.appendChild(titleRow);
  panel.appendChild(colorWrapper);

  // --- Кнопка скрытия картинки (только если она есть)
  const courseImage = box.querySelector('.courseimage img');
  if (courseImage) {
    const hideImgBtn = document.createElement('button');
    hideImgBtn.type = 'button';
    hideImgBtn.className = 'kb-hide-image-btn';
    hideImgBtn.textContent = _editState.hiddenImages[courseId] ? '🖼️ Показать картинку' : '🚫 Скрыть картинку';
    hideImgBtn.addEventListener('click', () => {
      const nowHidden = !_editState.hiddenImages[courseId];
      _editState.hiddenImages[courseId] = nowHidden || undefined;
      if (!nowHidden) delete _editState.hiddenImages[courseId];
      applyImageVisibility(box, courseId, _editState.hiddenImages);
      hideImgBtn.textContent = _editState.hiddenImages[courseId] ? '🖼️ Показать картинку' : '🚫 Скрыть картинку';
    });
    panel.appendChild(hideImgBtn);
  }

  box.appendChild(panel);
}

// Удалить все панели редактирования
function removeEditPanels() {
  document.querySelectorAll('.kb-edit-panel').forEach(el => el.remove());
  document.querySelectorAll('.kb-bulk-toolbar').forEach(el => el.remove());
}

// Создать панель массовых операций
function createBulkToolbar() {
  if (document.querySelector('.kb-bulk-toolbar')) return;

  const courseList = document.querySelector('#frontpage-course-list, .courses');
  if (!courseList) return;

  const toolbar = document.createElement('div');
  toolbar.className = 'kb-bulk-toolbar';

  const selectAllBtn = document.createElement('button');
  selectAllBtn.className = 'kb-btn';
  selectAllBtn.textContent = 'Выбрать все';
  selectAllBtn.addEventListener('click', () => {
    const boxes = document.querySelectorAll('.coursebox[data-courseid]');
    boxes.forEach(box => {
      const id  = box.dataset.courseid;
      _editState.hiddenItems[id] = true;
      const chk = box.querySelector('.kb-hide-checkbox');
      if (chk) chk.checked = true;
      applyVisibility(box, id, _editState.hiddenItems);
    });
  });

  const invertBtn = document.createElement('button');
  invertBtn.className = 'kb-btn';
  invertBtn.textContent = 'Инвертировать';
  invertBtn.addEventListener('click', () => {
    const boxes = document.querySelectorAll('.coursebox[data-courseid]');
    boxes.forEach(box => {
      const id  = box.dataset.courseid;
      _editState.hiddenItems[id] = !_editState.hiddenItems[id];
      const chk = box.querySelector('.kb-hide-checkbox');
      if (chk) chk.checked = !!_editState.hiddenItems[id];
      applyVisibility(box, id, _editState.hiddenItems);
    });
  });

  const saveBtn = document.createElement('button');
  saveBtn.className = 'kb-btn kb-btn--success';
  saveBtn.textContent = '💾 Сохранить';
  saveBtn.addEventListener('click', async () => {
    await disableEditMode();
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'kb-btn kb-btn--muted';
  cancelBtn.textContent = '✕ Отменить';
  cancelBtn.addEventListener('click', async () => {
    await cancelEditMode();
  });

  toolbar.appendChild(selectAllBtn);
  toolbar.appendChild(invertBtn);
  toolbar.appendChild(saveBtn);
  toolbar.appendChild(cancelBtn);
  courseList.insertAdjacentElement('beforebegin', toolbar);
}

// Сортировать .coursebox внутри каждого родительского контейнера по отображаемому названию
function sortCourseBoxes(customTitles) {
  // Собираем уникальные родительские контейнеры с карточками
  const parents = new Set();
  document.querySelectorAll('.coursebox[data-courseid]').forEach(box => {
    if (box.parentElement) parents.add(box.parentElement);
  });

  parents.forEach(parent => {
    const boxes = Array.from(parent.querySelectorAll(':scope > .coursebox[data-courseid]'));
    if (boxes.length < 2) return;

    // Запомнить исходный порядок при первом вызове
    boxes.forEach((box, i) => {
      if (box.dataset.kbOriginalIndex === undefined) {
        box.dataset.kbOriginalIndex = i;
      }
    });

    const getName = (box) => {
      const id = box.dataset.courseid;
      return (customTitles[id] || box.querySelector('.coursename a')?.dataset?.kbOriginal
        || box.querySelector('.coursename a')?.textContent || '').trim().toLowerCase();
    };

    if (_features.sortAlpha) {
      // Сортировка: сначала видимые, затем скрытые; внутри каждой группы — по алфавиту
      boxes.sort((a, b) => {
        const aHidden = a.classList.contains('kb-hidden-item') ? 1 : 0;
        const bHidden = b.classList.contains('kb-hidden-item') ? 1 : 0;
        if (aHidden !== bHidden) return aHidden - bHidden;
        return getName(a).localeCompare(getName(b), 'ru');
      });
    } else {
      // Восстановить исходный порядок, но всё равно видимые перед скрытыми
      boxes.sort((a, b) => {
        const aHidden = a.classList.contains('kb-hidden-item') ? 1 : 0;
        const bHidden = b.classList.contains('kb-hidden-item') ? 1 : 0;
        if (aHidden !== bHidden) return aHidden - bHidden;
        return Number(a.dataset.kbOriginalIndex) - Number(b.dataset.kbOriginalIndex);
      });
    }

    // Переставить узлы в нужном порядке (без удаления из DOM)
    boxes.forEach(box => parent.appendChild(box));

    // Переназначить классы odd/even/first/last только для видимых элементов
    const oddEven = _features.swapOddEven ? ['even', 'odd'] : ['odd', 'even'];
    const visibleBoxes = boxes.filter(box => !box.classList.contains('kb-hidden-item'));
    boxes.forEach(box => box.classList.remove('odd', 'even', 'first', 'last'));
    visibleBoxes.forEach((box, i) => {
      box.classList.add(oddEven[i % 2]);
      if (i === 0)                      box.classList.add('first');
      if (i === visibleBoxes.length - 1) box.classList.add('last');
    });

    // Блок «Все курсы» всегда должен быть последним дочерним элементом
    parent.querySelectorAll(':scope > .paging.paging-morelink').forEach(el => {
      parent.appendChild(el);
    });
  });
}

// Обработать все карточки на главной странице
function processAllCourseBoxes(hiddenItems, customTitles, itemColors, hiddenImages) {
  const boxes = document.querySelectorAll('.coursebox[data-courseid]');
  boxes.forEach(box => {
    const id = box.dataset.courseid;
    if (!id) return;

    applyTitle(box, id, customTitles);
    applyColorStrip(box, itemColors[id] || null);
    applyVisibility(box, id, hiddenItems);
    applyImageVisibility(box, id, hiddenImages || {});

    if (_editMode) {
      createEditPanel(box, id);
    }
  });

  sortCourseBoxes(customTitles);
}

// ── Извлечь имена преподавателей из DOM и сохранить в storage ────────────────
function extractAndSaveTeachers() {
  const teachers = {};
  document.querySelectorAll('.coursebox[data-courseid]').forEach(box => {
    const id = box.dataset.courseid;
    if (!id) return;
    const links = box.querySelectorAll('.teachers li a');
    if (links.length > 0) {
      teachers[id] = Array.from(links).map(a => a.textContent.trim()).filter(Boolean);
    }
  });
  if (Object.keys(teachers).length > 0) {
    adapter.set('courseTeachers', teachers);
  }
}

// ── Включить режим редактирования ────────────────────────────────────────────
async function enableEditMode() {
  // Загрузить текущие данные в рабочую копию
  const cfg = await adapter.getMultiple(['hiddenItems', 'customTitles', 'itemColors', 'hiddenImages']);
  _editState.hiddenItems  = Object.assign({}, cfg.hiddenItems  || {});
  _editState.customTitles = Object.assign({}, cfg.customTitles || {});
  _editState.itemColors   = Object.assign({}, cfg.itemColors   || {});
  _editState.hiddenImages = Object.assign({}, cfg.hiddenImages || {});

  _editMode = true;
  document.body.classList.add('kb-edit-mode');

  processAllCourseBoxes(_editState.hiddenItems, _editState.customTitles, _editState.itemColors, _editState.hiddenImages);
  createBulkToolbar();
}

// ── Выключить режим редактирования — СОХРАНИТЬ данные ─────────────────────
async function disableEditMode() {
  _editMode = false;
  document.body.classList.remove('kb-edit-mode');
  removeEditPanels();

  // Сохранить данные и сбросить флаг режима
  await adapter.saveAll({
    editMode:     false,
    hiddenItems:  _editState.hiddenItems,
    customTitles: _editState.customTitles,
    itemColors:   _editState.itemColors,
    hiddenImages: _editState.hiddenImages,
  });

  // Применить сохранённое состояние
  processAllCourseBoxes(_editState.hiddenItems, _editState.customTitles, _editState.itemColors, _editState.hiddenImages);
}

// ── Выключить режим редактирования — ОТМЕНИТЬ изменения ─────────────────────
async function cancelEditMode() {
  _editMode = false;
  document.body.classList.remove('kb-edit-mode');
  removeEditPanels();

  // Сбросить флаг режима без сохранения данных
  await adapter.set('editMode', false);

  // Перезагрузить сохранённое состояние из storage
  const cfg = await adapter.getMultiple(['hiddenItems', 'customTitles', 'itemColors', 'hiddenImages']);
  _editState.hiddenItems  = cfg.hiddenItems  || {};
  _editState.customTitles = cfg.customTitles || {};
  _editState.itemColors   = cfg.itemColors   || {};
  _editState.hiddenImages = cfg.hiddenImages || {};

  processAllCourseBoxes(_editState.hiddenItems, _editState.customTitles, _editState.itemColors, _editState.hiddenImages);
}

// ── Инициализация главной страницы ───────────────────────────────────────────
async function initMainPage() {
  const cfg = await adapter.getMultiple([
    'editMode', 'hiddenItems', 'customTitles', 'itemColors', 'hiddenImages',
    'featureSortAlpha', 'featureSwapOddEven',
  ]);

  _editState.hiddenItems  = cfg.hiddenItems  || {};
  _editState.customTitles = cfg.customTitles || {};
  _editState.itemColors   = cfg.itemColors   || {};
  _editState.hiddenImages = cfg.hiddenImages || {};
  _editMode               = cfg.editMode     ?? false;

  _features.sortAlpha   = cfg.featureSortAlpha   ?? true;
  _features.swapOddEven = cfg.featureSwapOddEven ?? true;

  if (_editMode) {
    document.body.classList.add('kb-edit-mode');
    createBulkToolbar();
  }

  processAllCourseBoxes(_editState.hiddenItems, _editState.customTitles, _editState.itemColors, _editState.hiddenImages);
  extractAndSaveTeachers();

  // Обновить кеш content FOUC: прятать список при следующей загрузке, если есть изменения
  const _hasMainChanges = _features.sortAlpha ||
    Object.values(_editState.hiddenItems).some(Boolean) ||
    Object.values(_editState.customTitles).some(Boolean) ||
    Object.keys(_editState.itemColors).length > 0 ||
    Object.values(_editState.hiddenImages).some(Boolean);
  try {
    const existing = JSON.parse(sessionStorage.getItem('kb_content_cfg') || '{}');
    existing.hideMain = _hasMainChanges;
    sessionStorage.setItem('kb_content_cfg', JSON.stringify(existing));
  } catch (_) {}
}

// ── Обработчик компактного вида ───────────────────────────────────────────────
async function initCompactSettings() {
  const cfg = await adapter.getMultiple(['hideCourseCategoryCombo', 'hidePagingMoreLink', 'hideEnrolIcon']);
  applyCourseCategoryComboVisibility(!!cfg.hideCourseCategoryCombo);
  applyPagingMoreLinkVisibility(!!cfg.hidePagingMoreLink);
  applyEnrolIconVisibility(!!cfg.hideEnrolIcon);
}

// ── Слушатель сообщений от popup ─────────────────────────────────────────────
extAPI.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'editModeEnable':
      if (isMainPage) enableEditMode();
      sendResponse && sendResponse({ ok: true });
      break;

    case 'editModeSave':
      if (isMainPage) disableEditMode();
      sendResponse && sendResponse({ ok: true });
      break;

    case 'editModeCancel':
      if (isMainPage) cancelEditMode();
      sendResponse && sendResponse({ ok: true });
      break;

    case 'themeChanged':
      (async () => {
        const cfg = await adapter.getMultiple(['themeEnabled', 'theme', 'accent']);
        applyTheme(cfg.themeEnabled, cfg.theme, cfg.accent);
      })();
      sendResponse && sendResponse({ ok: true });
      break;

    case 'hideCourseCategoryComboChanged':
      applyCourseCategoryComboVisibility(message.value);
      sendResponse && sendResponse({ ok: true });
      break;

    case 'hidePagingMoreLinkChanged':
      applyPagingMoreLinkVisibility(message.value);
      sendResponse && sendResponse({ ok: true });
      break;

    case 'hideEnrolIconChanged':
      applyEnrolIconVisibility(message.value);
      sendResponse && sendResponse({ ok: true });
      break;

    case 'featuresChanged':
      if (message.features.sortAlpha   !== undefined) _features.sortAlpha   = message.features.sortAlpha;
      if (message.features.swapOddEven !== undefined) _features.swapOddEven = message.features.swapOddEven;
      if (isMainPage) {
        processAllCourseBoxes(_editState.hiddenItems, _editState.customTitles, _editState.itemColors);
      }
      sendResponse && sendResponse({ ok: true });
      break;
  }

  // Возвращаем true для асинхронных обработчиков (Firefox требует)
  return true;
});

// ── Точка входа ──────────────────────────────────────────────────────────────
(async function init() {
  // Тема применяется на всех страницах
  await initTheme();

  // Компактные настройки на всех страницах
  await initCompactSettings();

  if (isMainPage) {
    await initMainPage();
  } else if (isCoursePage || isModPage) {
    await applyCustomTitleToHeading();
    await injectCourseInfoBlock();
  }

  // Снять класс скрытия контента (гарантированно, включая страховой вариант)
  document.documentElement.classList.remove('kb-content-loading');
})();
