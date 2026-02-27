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
};

let _editMode = false;

// ── Утилиты ─────────────────────────────────────────────────────────────────
function getThemeStyleUrl() {
  return extAPI.runtime.getURL('src/styles/theme-override.css');
}

function getThemeLinkEl() {
  return document.getElementById('kb-theme-override-link');
}

function applyTheme(themeEnabled, theme, accent) {
  const html = document.documentElement;

  if (!themeEnabled) {
    const link = getThemeLinkEl();
    if (link) link.remove();
    delete html.dataset.theme;
    delete html.dataset.accent;
    return;
  }

  if (!getThemeLinkEl()) {
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.type = 'text/css';
    link.id   = 'kb-theme-override-link';
    link.href = getThemeStyleUrl();
    document.head.appendChild(link);
  }

  html.dataset.theme  = theme  || 'system';
  html.dataset.accent = accent || 'violet';
}

function applyCourseCategoryComboVisibility(hide) {
  const block = document.getElementById('frontpage-category-combo');
  if (!block) return;
  block.style.display = hide ? 'none' : '';
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

// ── Блок кастомной информации на страницах предмета / модулей ────────────────
async function injectCourseInfoBlock() {
  const courseId = getCurrentCourseId();
  if (!courseId) return;

  const cfg = await adapter.getMultiple(['customTitles', 'itemColors']);
  const customTitles = cfg.customTitles || {};
  const itemColors   = cfg.itemColors   || {};

  const customTitle = customTitles[courseId] || null;
  const color       = itemColors[courseId]   || null;

  // Не вставляем, если нет ни кастомного названия, ни цвета
  if (!customTitle && !color) return;

  const cardBody = document.querySelector('#page-header .card-body');
  if (!cardBody) return;

  // Предотвращаем дублирование
  if (document.getElementById('kb-course-info-block')) return;

  const block = document.createElement('div');
  block.id = 'kb-course-info-block';
  block.className = 'kb-course-info-block';

  if (color) {
    const marker = document.createElement('span');
    marker.className = 'kb-course-color-marker';
    marker.style.background = color;
    block.appendChild(marker);
  }

  if (customTitle) {
    const title = document.createElement('span');
    title.className = 'kb-course-custom-title';
    title.textContent = customTitle;
    block.appendChild(title);
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
    if (!_editMode) {
      box.style.display = 'none';
    }
  } else {
    box.classList.remove('kb-hidden-item');
    box.style.display = '';
  }
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

  // --- Кнопка выбора цвета
  const colorWrapper = document.createElement('div');
  colorWrapper.className = 'kb-color-wrapper';

  const colorBtn = document.createElement('input');
  colorBtn.type = 'color';
  colorBtn.className = 'kb-color-btn';
  colorBtn.value = _editState.itemColors[courseId] || '#5c6bc0';

  const clearColorBtn = document.createElement('button');
  clearColorBtn.className = 'kb-clear-color-btn';
  clearColorBtn.textContent = '✕';
  clearColorBtn.title = 'Сбросить цвет';

  colorBtn.addEventListener('input', () => {
    const color = colorBtn.value;
    _editState.itemColors[courseId] = color;
    applyColorStrip(box, color);
  });

  clearColorBtn.addEventListener('click', () => {
    delete _editState.itemColors[courseId];
    applyColorStrip(box, null);
  });

  colorWrapper.appendChild(colorBtn);
  colorWrapper.appendChild(clearColorBtn);

  // --- Сборка панели
  panel.appendChild(hideLabel);
  panel.appendChild(origNameEl);
  panel.appendChild(titleInput);
  panel.appendChild(colorWrapper);

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

// Обработать все карточки на главной странице
function processAllCourseBoxes(hiddenItems, customTitles, itemColors) {
  const boxes = document.querySelectorAll('.coursebox[data-courseid]');
  boxes.forEach(box => {
    const id = box.dataset.courseid;
    if (!id) return;

    applyTitle(box, id, customTitles);
    applyColorStrip(box, itemColors[id] || null);
    applyVisibility(box, id, hiddenItems);

    if (_editMode) {
      createEditPanel(box, id);
    }
  });
}

// ── Включить режим редактирования ────────────────────────────────────────────
async function enableEditMode() {
  // Загрузить текущие данные в рабочую копию
  const cfg = await adapter.getMultiple(['hiddenItems', 'customTitles', 'itemColors']);
  _editState.hiddenItems  = Object.assign({}, cfg.hiddenItems  || {});
  _editState.customTitles = Object.assign({}, cfg.customTitles || {});
  _editState.itemColors   = Object.assign({}, cfg.itemColors   || {});

  _editMode = true;
  document.body.classList.add('kb-edit-mode');

  processAllCourseBoxes(_editState.hiddenItems, _editState.customTitles, _editState.itemColors);
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
  });

  // Применить сохранённое состояние
  processAllCourseBoxes(_editState.hiddenItems, _editState.customTitles, _editState.itemColors);
}

// ── Выключить режим редактирования — ОТМЕНИТЬ изменения ─────────────────────
async function cancelEditMode() {
  _editMode = false;
  document.body.classList.remove('kb-edit-mode');
  removeEditPanels();

  // Сбросить флаг режима без сохранения данных
  await adapter.set('editMode', false);

  // Перезагрузить сохранённое состояние из storage
  const cfg = await adapter.getMultiple(['hiddenItems', 'customTitles', 'itemColors']);
  _editState.hiddenItems  = cfg.hiddenItems  || {};
  _editState.customTitles = cfg.customTitles || {};
  _editState.itemColors   = cfg.itemColors   || {};

  processAllCourseBoxes(_editState.hiddenItems, _editState.customTitles, _editState.itemColors);
}

// ── Инициализация главной страницы ───────────────────────────────────────────
async function initMainPage() {
  const cfg = await adapter.getMultiple([
    'editMode', 'hiddenItems', 'customTitles', 'itemColors',
  ]);

  _editState.hiddenItems  = cfg.hiddenItems  || {};
  _editState.customTitles = cfg.customTitles || {};
  _editState.itemColors   = cfg.itemColors   || {};
  _editMode               = cfg.editMode     ?? false;

  if (_editMode) {
    document.body.classList.add('kb-edit-mode');
    createBulkToolbar();
  }

  processAllCourseBoxes(_editState.hiddenItems, _editState.customTitles, _editState.itemColors);

  if (_editMode) {
    // Панели редактирования добавлены внутри processAllCourseBoxes
  }
}

// ── Обработчик компактного вида ───────────────────────────────────────────────
async function initCompactSettings() {
  const hide = await adapter.get('hideCourseCategoryCombo');
  applyCourseCategoryComboVisibility(!!hide);
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
    await injectCourseInfoBlock();
  }
})();
