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
const hideEnrolIconCheckbox            = document.getElementById('hide-enrol-icon-checkbox');
const hideMainPageHeaderCheckbox       = document.getElementById('hide-main-page-header-checkbox');
const featureSortAlphaCheckbox        = document.getElementById('feature-sort-alpha-checkbox');
const featureSwapOddEvenCheckbox      = document.getElementById('feature-swap-odd-even-checkbox');
const featureAutoFilenameCheckbox     = document.getElementById('feature-auto-filename-checkbox');
const studentInfoOptions              = document.getElementById('student-info-options');
const studentLastnameInput            = document.getElementById('student-lastname-input');
const studentFirstnameInput           = document.getElementById('student-firstname-input');
const studentMiddlenameInput          = document.getElementById('student-middlename-input');
const studentGroupInput               = document.getElementById('student-group-input');
const autologinEnabledCheckbox        = document.getElementById('autologin-enabled-checkbox');
const autologinCredentials            = document.getElementById('autologin-credentials');
const autologinUsernameInput          = document.getElementById('autologin-username-input');
const autologinPasswordInput          = document.getElementById('autologin-password-input');

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

// ── Показать/скрыть блок данных студента ─────────────────────────────
function setStudentInfoVisible(visible) {
  studentInfoOptions.style.display = visible ? '' : 'none';
}

// ── Показать/скрыть поля логина/пароля автовхода ────────────────────────────
function setAutologinCredentialsVisible(visible) {
  autologinCredentials.style.display = visible ? '' : 'none';
}

// ── Переключить вид кнопок режима редактирования ────────────────────────────
function setEditModeButtons(active) {
  editModeEnableBtn.style.display  = active ? 'none' : '';
  editModeActiveBtns.style.display = active ? ''     : 'none';
}

// ── Применить тему к самому попапу (data-theme / data-accent на <html>) ──────
function applyPopupTheme(themeEnabled, theme, accent) {
  const html = document.documentElement;
  if (themeEnabled) {
    html.dataset.theme  = theme  || 'system';
    html.dataset.accent = accent || 'violet';
  } else {
    delete html.dataset.theme;
    delete html.dataset.accent;
  }
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
    'hideEnrolIcon',
    'hideMainPageHeader',
    'featureSortAlpha',
    'featureSwapOddEven',
    'featureAutoFilename',
    'studentLastname',
    'studentFirstname',
    'studentMiddlename',
    'studentGroup',
    'autologinEnabled',
    'autologinUsername',
    'autologinPassword',
  ]);

  setEditModeButtons(cfg.editMode ?? false);
  themeEnabledCheckbox.checked            = cfg.themeEnabled            ?? false;
  themeSelect.value                       = cfg.theme                   ?? 'system';
  accentSelect.value                      = cfg.accent                  ?? 'violet';
  hideCourseCategoryComboCheckbox.checked = cfg.hideCourseCategoryCombo ?? false;
  hidePagingMoreLinkCheckbox.checked       = cfg.hidePagingMoreLink       ?? false;
  hideEnrolIconCheckbox.checked            = cfg.hideEnrolIcon            ?? false;
  hideMainPageHeaderCheckbox.checked       = cfg.hideMainPageHeader       ?? false;
  featureSortAlphaCheckbox.checked        = cfg.featureSortAlpha        ?? true;
  featureSwapOddEvenCheckbox.checked      = cfg.featureSwapOddEven      ?? true;
  featureAutoFilenameCheckbox.checked     = cfg.featureAutoFilename     ?? false;
  studentLastnameInput.value              = cfg.studentLastname          ?? '';
  studentFirstnameInput.value             = cfg.studentFirstname         ?? '';
  studentMiddlenameInput.value            = cfg.studentMiddlename        ?? '';
  studentGroupInput.value                 = cfg.studentGroup             ?? '';
  autologinEnabledCheckbox.checked        = cfg.autologinEnabled          ?? false;
  autologinUsernameInput.value            = cfg.autologinUsername         ?? '';
  autologinPasswordInput.value            = cfg.autologinPassword         ?? '';

  setThemeOptionsVisible(themeEnabledCheckbox.checked);
  setStudentInfoVisible(featureAutoFilenameCheckbox.checked);
  setAutologinCredentialsVisible(autologinEnabledCheckbox.checked);
  applyPopupTheme(
    cfg.themeEnabled ?? false,
    cfg.theme        ?? 'system',
    cfg.accent       ?? 'violet',
  );
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
  applyPopupTheme(enabled, themeSelect.value, accentSelect.value);
  await sendToContentScript({ type: 'themeChanged', key: 'themeEnabled', value: enabled });
});

// Выбор цветовой схемы
themeSelect.addEventListener('change', async () => {
  const theme = themeSelect.value;
  await adapter.set('theme', theme);
  applyPopupTheme(themeEnabledCheckbox.checked, theme, accentSelect.value);
  await sendToContentScript({ type: 'themeChanged', key: 'theme', value: theme });
});

// Выбор акцентного цвета
accentSelect.addEventListener('change', async () => {
  const accent = accentSelect.value;
  await adapter.set('accent', accent);
  applyPopupTheme(themeEnabledCheckbox.checked, themeSelect.value, accent);
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

// Скрытие иконки записи в группу МГТУ
hideEnrolIconCheckbox.addEventListener('change', async () => {
  const hide = hideEnrolIconCheckbox.checked;
  await adapter.set('hideEnrolIcon', hide);
  await sendToContentScript({ type: 'hideEnrolIconChanged', value: hide });
});

// Скрытие шапки на главной странице
hideMainPageHeaderCheckbox.addEventListener('change', async () => {
  const hide = hideMainPageHeaderCheckbox.checked;
  await adapter.set('hideMainPageHeader', hide);
  await sendToContentScript({ type: 'hideMainPageHeaderChanged', value: hide });
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

// Фича: автозаполнение имени файла
featureAutoFilenameCheckbox.addEventListener('change', async () => {
  const value = featureAutoFilenameCheckbox.checked;
  await adapter.set('featureAutoFilename', value);
  setStudentInfoVisible(value);
  await sendToContentScript({ type: 'featureAutoFilenameChanged', value });
});

// Данные студента — сохраняем при потере фокуса / нажатии Enter
[
  ['studentLastname',   studentLastnameInput],
  ['studentFirstname',  studentFirstnameInput],
  ['studentMiddlename', studentMiddlenameInput],
  ['studentGroup',      studentGroupInput],
].forEach(([key, input]) => {
  input.addEventListener('change', async () => {
    await adapter.set(key, input.value);
    await sendToContentScript({ type: 'studentInfoChanged', key, value: input.value });
  });
});

// Автовход — включение/отключение
autologinEnabledCheckbox.addEventListener('change', async () => {
  const value = autologinEnabledCheckbox.checked;
  await adapter.set('autologinEnabled', value);
  setAutologinCredentialsVisible(value);
});

// Автовход — логин и пароль сохраняются при изменении
[
  ['autologinUsername', autologinUsernameInput],
  ['autologinPassword', autologinPasswordInput],
].forEach(([key, input]) => {
  input.addEventListener('change', async () => {
    await adapter.set(key, input.value);
  });
});

// ── Инициализация ───────────────────────────────────────────────────────────
loadSettings();
