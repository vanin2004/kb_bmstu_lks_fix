/**
 * main-page.js — главная страница (список предметов)
 *
 * Работает на: body#page-site-index
 *
 * Отвечает за:
 *   - применение цветов, названий, видимости карточек
 *   - режим редактирования (панели, bulk-toolbar)
 *   - сортировку карточек
 */
'use strict';

// ── Применить стили к одной карточке ─────────────────────────────────────────

function applyColorStrip(box, color) {
  box.style.setProperty('--kb-course-color', color || '');
  if (color) {
    box.classList.add('kb-has-color');
  } else {
    box.classList.remove('kb-has-color');
  }
}

function applyTitle(box, courseId, customTitles) {
  const link = box.querySelector('.coursename a');
  if (!link) return;

  if (!link.dataset.kbOriginal) {
    link.dataset.kbOriginal = link.textContent.trim();
  }
  const custom = customTitles[courseId] ?? null;
  link.textContent = custom || link.dataset.kbOriginal;
}

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

function applyImageVisibility(box, courseId, hiddenImages) {
  const img = box.querySelector('.courseimage');
  if (!img) return;
  img.style.display = hiddenImages[courseId] ? 'none' : '';
}

// ── Панель редактирования одной карточки ─────────────────────────────────────

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

function removeEditPanels() {
  document.querySelectorAll('.kb-edit-panel').forEach(el => el.remove());
  document.querySelectorAll('.kb-bulk-toolbar').forEach(el => el.remove());
}

// ── Панель массовых операций ──────────────────────────────────────────────────

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

// ── Сортировка карточек ───────────────────────────────────────────────────────

function sortCourseBoxes(customTitles) {
  const parents = new Set();
  document.querySelectorAll('.coursebox[data-courseid]').forEach(box => {
    if (box.parentElement) parents.add(box.parentElement);
  });

  parents.forEach(parent => {
    const boxes = Array.from(parent.querySelectorAll(':scope > .coursebox[data-courseid]'));
    if (boxes.length < 2) return;

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
      boxes.sort((a, b) => {
        const aHidden = a.classList.contains('kb-hidden-item') ? 1 : 0;
        const bHidden = b.classList.contains('kb-hidden-item') ? 1 : 0;
        if (aHidden !== bHidden) return aHidden - bHidden;
        return getName(a).localeCompare(getName(b), 'ru');
      });
    } else {
      boxes.sort((a, b) => {
        const aHidden = a.classList.contains('kb-hidden-item') ? 1 : 0;
        const bHidden = b.classList.contains('kb-hidden-item') ? 1 : 0;
        if (aHidden !== bHidden) return aHidden - bHidden;
        return Number(a.dataset.kbOriginalIndex) - Number(b.dataset.kbOriginalIndex);
      });
    }

    boxes.forEach(box => parent.appendChild(box));

    const oddEven = _features.swapOddEven ? ['even', 'odd'] : ['odd', 'even'];
    const visibleBoxes = boxes.filter(box => !box.classList.contains('kb-hidden-item'));
    boxes.forEach(box => box.classList.remove('odd', 'even', 'first', 'last'));
    visibleBoxes.forEach((box, i) => {
      box.classList.add(oddEven[i % 2]);
      if (i === 0)                      box.classList.add('first');
      if (i === visibleBoxes.length - 1) box.classList.add('last');
    });

    parent.querySelectorAll(':scope > .paging.paging-morelink').forEach(el => {
      parent.appendChild(el);
    });
  });
}

// ── Обработка всех карточек ───────────────────────────────────────────────────

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

// ── Преподаватели ─────────────────────────────────────────────────────────────

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

// ── Режим редактирования ──────────────────────────────────────────────────────

async function enableEditMode() {
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

async function disableEditMode() {
  _editMode = false;
  document.body.classList.remove('kb-edit-mode');
  removeEditPanels();

  await adapter.saveAll({
    editMode:     false,
    hiddenItems:  _editState.hiddenItems,
    customTitles: _editState.customTitles,
    itemColors:   _editState.itemColors,
    hiddenImages: _editState.hiddenImages,
  });

  processAllCourseBoxes(_editState.hiddenItems, _editState.customTitles, _editState.itemColors, _editState.hiddenImages);
}

async function cancelEditMode() {
  _editMode = false;
  document.body.classList.remove('kb-edit-mode');
  removeEditPanels();

  await adapter.set('editMode', false);

  const cfg = await adapter.getMultiple(['hiddenItems', 'customTitles', 'itemColors', 'hiddenImages']);
  _editState.hiddenItems  = cfg.hiddenItems  || {};
  _editState.customTitles = cfg.customTitles || {};
  _editState.itemColors   = cfg.itemColors   || {};
  _editState.hiddenImages = cfg.hiddenImages || {};

  processAllCourseBoxes(_editState.hiddenItems, _editState.customTitles, _editState.itemColors, _editState.hiddenImages);
}

// ── Инициализация ─────────────────────────────────────────────────────────────

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
