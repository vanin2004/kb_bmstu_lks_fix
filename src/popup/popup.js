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
const editModeCheckbox            = document.getElementById('edit-mode-checkbox');
const themeEnabledCheckbox        = document.getElementById('theme-enabled-checkbox');
const themeSelect                 = document.getElementById('theme-select');
const accentSelect                = document.getElementById('accent-select');
const themeOptionsBlock           = document.getElementById('theme-options');
const hideCourseCategoryComboCheckbox = document.getElementById('hide-course-category-combo-checkbox');

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

// ── Загрузка настроек из хранилища ─────────────────────────────────────────
async function loadSettings() {
  const cfg = await adapter.getMultiple([
    'editMode',
    'themeEnabled',
    'theme',
    'accent',
    'hideCourseCategoryCombo',
  ]);

  editModeCheckbox.checked             = cfg.editMode             ?? false;
  themeEnabledCheckbox.checked         = cfg.themeEnabled         ?? false;
  themeSelect.value                    = cfg.theme                ?? 'system';
  accentSelect.value                   = cfg.accent               ?? 'violet';
  hideCourseCategoryComboCheckbox.checked = cfg.hideCourseCategoryCombo ?? false;

  setThemeOptionsVisible(themeEnabledCheckbox.checked);
}

// ── Обработчики событий ─────────────────────────────────────────────────────

// Режим редактирования
editModeCheckbox.addEventListener('change', async () => {
  const editMode = editModeCheckbox.checked;
  await adapter.set('editMode', editMode);
  await sendToContentScript({ type: 'editModeChanged', editMode });
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

// ── Инициализация ───────────────────────────────────────────────────────────
loadSettings();
