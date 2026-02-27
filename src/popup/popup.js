/**
 * popup.js — логика интерфейса расширения
 *
 * Загружается после storage.js, поэтому window.storageAdapter уже доступен.
 */

'use strict';

// ── Кросс-браузерный API ────────────────────────────────────────────────────
const extAPI = (typeof browser !== 'undefined') ? browser : chrome;
const adapter = window.storageAdapter;

// ── Ссылки на элементы DOM ──────────────────────────────────────────────────
const editModeEnableBtn   = document.getElementById('edit-mode-enable-btn');
const editModeActiveBtns  = document.getElementById('edit-mode-active-btns');
const editModeSaveBtn     = document.getElementById('edit-mode-save-btn');
const editModeCancelBtn   = document.getElementById('edit-mode-cancel-btn');
const themeEnabledCheckbox        = document.getElementById('theme-enabled-checkbox');
const themeSelect                 = document.getElementById('theme-select');
const accentSelect                = document.getElementById('accent-select');
const themeOptionsBlock           = document.getElementById('theme-options');
const hideCourseCategoryComboCheckbox = document.getElementById('hide-course-category-combo-checkbox');
const hidePagingMoreLinkCheckbox       = document.getElementById('hide-paging-morelink-checkbox');
const featureSortAlphaCheckbox        = document.getElementById('feature-sort-alpha-checkbox');
const featureSwapOddEvenCheckbox      = document.getElementById('feature-swap-odd-even-checkbox');

// ── Отправка сообщения в content-script активной вкладки ────────────────────
async function sendToContentScript(message) {
  try {
    const tabs = await extAPI.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      await extAPI.tabs.sendMessage(tabs[0].id, message);
    }
  } catch (e) {
    // Страница может не совпадать с matches → content script не загружен
    console.warn('[kb_bmstu_lks_fix] sendMessage:', e.message || e);
  }
}

// ── Показать/скрыть блок настроек темы ─────────────────────────────────────
function setThemeOptionsVisible(visible) {
  themeOptionsBlock.style.display = visible ? '' : 'none';
}

// ── Переключить вид кнопок режима редактирования ────────────────────────────
function setEditModeButtons(active) {
  editModeEnableBtn.style.display  = active ? 'none' : '';
  editModeActiveBtns.style.display = active ? ''     : 'none';
}

// ── Загрузка настроек из хранилища ─────────────────────────────────────────
async function loadSettings() {
  const cfg = await adapter.getMultiple([
    'editMode',
    'themeEnabled',
    'theme',
    'accent',
    'hideCourseCategoryCombo',
    'hidePagingMoreLink',
    'featureSortAlpha',
    'featureSwapOddEven',
  ]);

  setEditModeButtons(cfg.editMode ?? false);
  themeEnabledCheckbox.checked            = cfg.themeEnabled            ?? false;
  themeSelect.value                       = cfg.theme                   ?? 'system';
  accentSelect.value                      = cfg.accent                  ?? 'violet';
  hideCourseCategoryComboCheckbox.checked = cfg.hideCourseCategoryCombo ?? false;
  hidePagingMoreLinkCheckbox.checked       = cfg.hidePagingMoreLink       ?? false;
  featureSortAlphaCheckbox.checked        = cfg.featureSortAlpha        ?? true;
  featureSwapOddEvenCheckbox.checked      = cfg.featureSwapOddEven      ?? true;

  setThemeOptionsVisible(themeEnabledCheckbox.checked);
}

// ── Обработчики событий ─────────────────────────────────────────────────────

// Режим редактирования — Включить
editModeEnableBtn.addEventListener('click', async () => {
  await adapter.set('editMode', true);
  setEditModeButtons(true);
  await sendToContentScript({ type: 'editModeEnable' });
});

// Режим редактирования — Сохранить
editModeSaveBtn.addEventListener('click', async () => {
  setEditModeButtons(false);
  await sendToContentScript({ type: 'editModeSave' });
});

// Режим редактирования — Отменить
editModeCancelBtn.addEventListener('click', async () => {
  setEditModeButtons(false);
  await sendToContentScript({ type: 'editModeCancel' });
});

// Включение/отключение темы
themeEnabledCheckbox.addEventListener('change', async () => {
  const enabled = themeEnabledCheckbox.checked;
  await adapter.set('themeEnabled', enabled);
  setThemeOptionsVisible(enabled);
  await sendToContentScript({ type: 'themeChanged', key: 'themeEnabled', value: enabled });
});

// Выбор цветовой схемы
themeSelect.addEventListener('change', async () => {
  const theme = themeSelect.value;
  await adapter.set('theme', theme);
  await sendToContentScript({ type: 'themeChanged', key: 'theme', value: theme });
});

// Выбор акцентного цвета
accentSelect.addEventListener('change', async () => {
  const accent = accentSelect.value;
  await adapter.set('accent', accent);
  await sendToContentScript({ type: 'themeChanged', key: 'accent', value: accent });
});

// Скрытие дерева категорий курсов
hideCourseCategoryComboCheckbox.addEventListener('change', async () => {
  const hide = hideCourseCategoryComboCheckbox.checked;
  await adapter.set('hideCourseCategoryCombo', hide);
  await sendToContentScript({ type: 'hideCourseCategoryComboChanged', value: hide });
});

// Скрытие ссылки «Все курсы»
hidePagingMoreLinkCheckbox.addEventListener('change', async () => {
  const hide = hidePagingMoreLinkCheckbox.checked;
  await adapter.set('hidePagingMoreLink', hide);
  await sendToContentScript({ type: 'hidePagingMoreLinkChanged', value: hide });
});

// Фича: сортировка по алфавиту
featureSortAlphaCheckbox.addEventListener('change', async () => {
  const value = featureSortAlphaCheckbox.checked;
  await adapter.set('featureSortAlpha', value);
  await sendToContentScript({ type: 'featuresChanged', features: { sortAlpha: value } });
});

// Фича: поменять odd/even местами
featureSwapOddEvenCheckbox.addEventListener('change', async () => {
  const value = featureSwapOddEvenCheckbox.checked;
  await adapter.set('featureSwapOddEven', value);
  await sendToContentScript({ type: 'featuresChanged', features: { swapOddEven: value } });
});

// ── Инициализация ───────────────────────────────────────────────────────────
loadSettings();
