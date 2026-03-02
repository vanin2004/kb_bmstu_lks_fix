/**
 * popup.js — логика интерфейса расширения
 *
 * Загружается после storage.js, поэтому window.storageAdapter уже доступен.
 */

'use strict';

// ── Кросс-браузерный API ────────────────────────────────────────────────────
const extAPI = (typeof browser !== 'undefined') ? browser : chrome;
const adapter = window.storageAdapter;

// ── DOM refs ────────────────────────────────────────────────────────────────
const editModeEnableBtn  = document.getElementById('edit-mode-enable-btn');
const editModeActiveBtns = document.getElementById('edit-mode-active-btns');
const editModeSaveBtn    = document.getElementById('edit-mode-save-btn');
const editModeCancelBtn  = document.getElementById('edit-mode-cancel-btn');

const themeEnabledCheckbox   = document.getElementById('theme-enabled-checkbox');
const themeSelect            = document.getElementById('theme-select');
const accentSelect           = document.getElementById('accent-select');
const replaceTabIconCheckbox = document.getElementById('tab-icon-select');
const tabIconSelect          = replaceTabIconCheckbox; // alias — see usages below

const hideCourseCategoryComboCheckbox = document.getElementById('hide-course-category-combo-checkbox');
const hidePagingMoreLinkCheckbox      = document.getElementById('hide-paging-morelink-checkbox');
const hideEnrolIconCheckbox           = document.getElementById('hide-enrol-icon-checkbox');
const hideMainPageHeaderCheckbox      = document.getElementById('hide-main-page-header-checkbox');
const hideHeaderLogoCheckbox          = document.getElementById('hide-header-logo-checkbox');

const featureSortAlphaCheckbox    = document.getElementById('feature-sort-alpha-checkbox');
const featureSwapOddEvenCheckbox  = document.getElementById('feature-swap-odd-even-checkbox');
const featureAutoFilenameCheckbox = document.getElementById('feature-auto-filename-checkbox');
const autologinEnabledCheckbox    = document.getElementById('autologin-enabled-checkbox');

const studentLastnameInput   = document.getElementById('student-lastname-input');
const studentFirstnameInput  = document.getElementById('student-firstname-input');
const studentMiddlenameInput = document.getElementById('student-middlename-input');
const studentGroupInput      = document.getElementById('student-group-input');

const autologinUsernameInput        = document.getElementById('autologin-username-input');
const autologinPasswordInput        = document.getElementById('autologin-password-input');
const autologinModeCredentialsRadio = document.getElementById('autologin-mode-credentials');
const autologinModeAutofillRadio    = document.getElementById('autologin-mode-autofill');
const autologinCredentialsSection   = document.getElementById('autologin-credentials-section');
const autologinCredentialsWarning   = document.getElementById('autologin-credentials-warning');
const resetAllBtn                   = document.getElementById('reset-all-btn');

// ── Last-saved state per settings panel ─────────────────────────────────────
// Populated on loadSettings; updated on Apply; used by Cancel to revert fields.
const saved = {
  'theme-panel':        { theme: 'system', accent: 'violet', replaceTabIcon: 'original' },
  'student-info-panel': { studentLastname: '', studentFirstname: '', studentMiddlename: '', studentGroup: '' },
  'autologin-panel':    { autologinMode: 'credentials', autologinUsername: '', autologinPassword: '' },
};

// ── Utilities ────────────────────────────────────────────────────────────────
async function sendToContentScript(message) {
  try {
    const tabs = await extAPI.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) await extAPI.tabs.sendMessage(tabs[0].id, message);
  } catch (e) {
    console.warn('[kb_bmstu_lks_fix] sendMessage:', e.message || e);
  }
}

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

function setEditModeButtons(active) {
  editModeEnableBtn.style.display  = active ? 'none' : '';
  editModeActiveBtns.style.display = active ? ''     : 'none';
}

// ── Panel open / close ───────────────────────────────────────────────────────
function isPanelOpen(panelId) {
  const panel = document.getElementById(panelId);
  return !!panel && panel.style.display !== 'none';
}

function setPanelOpen(panelId, open) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  panel.style.display = open ? '' : 'none';
  const gear = document.querySelector(`.gear-btn[data-panel="${panelId}"]`);
  if (gear) gear.classList.toggle('active', open);
}

// ── Apply: save panel fields to storage then close ───────────────────────────
const applyHandlers = {
  'theme-panel': async () => {
    const theme  = themeSelect.value;
    const accent = accentSelect.value;
    const replaceTabIcon = tabIconSelect.value;
    await adapter.saveAll({ theme, accent, tabIcon: replaceTabIcon });
    saved['theme-panel'] = { theme, accent, replaceTabIcon };
    applyPopupTheme(themeEnabledCheckbox.checked, theme, accent);
    await sendToContentScript({ type: 'themeChanged', key: 'theme',  value: theme });
    await sendToContentScript({ type: 'themeChanged', key: 'accent', value: accent });
    await sendToContentScript({ type: 'replaceTabIconChanged', value: replaceTabIcon });
    setPanelOpen('theme-panel', false);
  },

  'student-info-panel': async () => {
    const data = {
      studentLastname:   studentLastnameInput.value,
      studentFirstname:  studentFirstnameInput.value,
      studentMiddlename: studentMiddlenameInput.value,
      studentGroup:      studentGroupInput.value,
    };
    await adapter.saveAll(data);
    saved['student-info-panel'] = { ...data };
    for (const [key, value] of Object.entries(data)) {
      await sendToContentScript({ type: 'studentInfoChanged', key, value });
    }
    setPanelOpen('student-info-panel', false);
  },

  'autologin-panel': async () => {
    const autologinMode = autologinModeAutofillRadio.checked ? 'autofill' : 'credentials';
    const data = {
      autologinMode,
      autologinUsername: autologinUsernameInput.value,
      autologinPassword: autologinPasswordInput.value,
    };
    await adapter.saveAll(data);
    saved['autologin-panel'] = { ...data };
    setPanelOpen('autologin-panel', false);
  },
};

// ── Cancel: revert fields to last saved state then close ─────────────────────
const cancelHandlers = {
  'theme-panel': () => {
    const { theme, accent, replaceTabIcon } = saved['theme-panel'];
    themeSelect.value  = theme;
    accentSelect.value = accent;
    tabIconSelect.value = replaceTabIcon;
    applyPopupTheme(themeEnabledCheckbox.checked, theme, accent);
    setPanelOpen('theme-panel', false);
  },

  'student-info-panel': () => {
    const s = saved['student-info-panel'];
    studentLastnameInput.value   = s.studentLastname;
    studentFirstnameInput.value  = s.studentFirstname;
    studentMiddlenameInput.value = s.studentMiddlename;
    studentGroupInput.value      = s.studentGroup;
    setPanelOpen('student-info-panel', false);
  },

  'autologin-panel': () => {
    const s = saved['autologin-panel'];
    autologinModeCredentialsRadio.checked = s.autologinMode !== 'autofill';
    autologinModeAutofillRadio.checked    = s.autologinMode === 'autofill';
    autologinUsernameInput.value = s.autologinUsername;
    autologinPasswordInput.value = s.autologinPassword;
    updateAutologinCredentialsVisibility();
    setPanelOpen('autologin-panel', false);
  },
};

// ── Gear buttons ─────────────────────────────────────────────────────────────
document.querySelectorAll('.gear-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const panelId = btn.dataset.panel;
    setPanelOpen(panelId, !isPanelOpen(panelId));
  });
});

// ── Apply / Cancel buttons ───────────────────────────────────────────────────
document.querySelectorAll('.settings-apply-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const handler = applyHandlers[btn.dataset.panel];
    if (handler) await handler();
  });
});

document.querySelectorAll('.settings-cancel-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const handler = cancelHandlers[btn.dataset.panel];
    if (handler) handler();
  });
});

// ── Edit mode ────────────────────────────────────────────────────────────────
editModeEnableBtn.addEventListener('click', async () => {
  await adapter.set('editMode', true);
  setEditModeButtons(true);
  await sendToContentScript({ type: 'editModeEnable' });
});

editModeSaveBtn.addEventListener('click', async () => {
  setEditModeButtons(false);
  await sendToContentScript({ type: 'editModeSave' });
});

editModeCancelBtn.addEventListener('click', async () => {
  setEditModeButtons(false);
  await sendToContentScript({ type: 'editModeCancel' });
});

// ── Theme toggle ─────────────────────────────────────────────────────────────
themeEnabledCheckbox.addEventListener('change', async () => {
  const enabled = themeEnabledCheckbox.checked;
  await adapter.set('themeEnabled', enabled);
  applyPopupTheme(enabled, themeSelect.value, accentSelect.value);
  await sendToContentScript({ type: 'themeChanged', key: 'themeEnabled', value: enabled });
  if (enabled && !isPanelOpen('theme-panel')) setPanelOpen('theme-panel', true);
});

// Theme selects: live-preview only (data saved on Apply)
themeSelect.addEventListener('change', () => {
  applyPopupTheme(themeEnabledCheckbox.checked, themeSelect.value, accentSelect.value);
});

accentSelect.addEventListener('change', () => {
  applyPopupTheme(themeEnabledCheckbox.checked, themeSelect.value, accentSelect.value);
});

// ── Compact view ─────────────────────────────────────────────────────────────
hideCourseCategoryComboCheckbox.addEventListener('change', async () => {
  const hide = hideCourseCategoryComboCheckbox.checked;
  await adapter.set('hideCourseCategoryCombo', hide);
  await sendToContentScript({ type: 'hideCourseCategoryComboChanged', value: hide });
});

hidePagingMoreLinkCheckbox.addEventListener('change', async () => {
  const hide = hidePagingMoreLinkCheckbox.checked;
  await adapter.set('hidePagingMoreLink', hide);
  await sendToContentScript({ type: 'hidePagingMoreLinkChanged', value: hide });
});

hideEnrolIconCheckbox.addEventListener('change', async () => {
  const hide = hideEnrolIconCheckbox.checked;
  await adapter.set('hideEnrolIcon', hide);
  await sendToContentScript({ type: 'hideEnrolIconChanged', value: hide });
});

hideMainPageHeaderCheckbox.addEventListener('change', async () => {
  const hide = hideMainPageHeaderCheckbox.checked;
  await adapter.set('hideMainPageHeader', hide);
  await sendToContentScript({ type: 'hideMainPageHeaderChanged', value: hide });
});

hideHeaderLogoCheckbox.addEventListener('change', async () => {
  const hide = hideHeaderLogoCheckbox.checked;
  await adapter.set('hideHeaderLogo', hide);
  await sendToContentScript({ type: 'hideHeaderLogoChanged', value: hide });
});

// ── Features ─────────────────────────────────────────────────────────────────
featureSortAlphaCheckbox.addEventListener('change', async () => {
  const value = featureSortAlphaCheckbox.checked;
  await adapter.set('featureSortAlpha', value);
  await sendToContentScript({ type: 'featuresChanged', features: { sortAlpha: value } });
});

featureSwapOddEvenCheckbox.addEventListener('change', async () => {
  const value = featureSwapOddEvenCheckbox.checked;
  await adapter.set('featureSwapOddEven', value);
  await sendToContentScript({ type: 'featuresChanged', features: { swapOddEven: value } });
});

featureAutoFilenameCheckbox.addEventListener('change', async () => {
  const value = featureAutoFilenameCheckbox.checked;
  await adapter.set('featureAutoFilename', value);
  await sendToContentScript({ type: 'featureAutoFilenameChanged', value });
  if (value && !isPanelOpen('student-info-panel')) setPanelOpen('student-info-panel', true);
});

autologinEnabledCheckbox.addEventListener('change', async () => {
  const value = autologinEnabledCheckbox.checked;
  await adapter.set('autologinEnabled', value);
  if (value) {
    if (!isPanelOpen('autologin-panel')) setPanelOpen('autologin-panel', true);
  } else {
    // Удаляем учётные данные из хранилища при отключении автовхода
    await adapter.remove(['autologinUsername', 'autologinPassword']);
    autologinUsernameInput.value = '';
    autologinPasswordInput.value = '';
    saved['autologin-panel'] = { ...saved['autologin-panel'], autologinUsername: '', autologinPassword: '' };
  }
});

// ── Autologin: переключение видимости блока с учётными данными ───────────────
function updateAutologinCredentialsVisibility() {
  const isCredentials = autologinModeCredentialsRadio.checked;
  autologinCredentialsSection.style.display = isCredentials ? '' : 'none';
  if (autologinCredentialsWarning)
    autologinCredentialsWarning.style.display = isCredentials ? '' : 'none';
}

autologinModeCredentialsRadio.addEventListener('change', updateAutologinCredentialsVisibility);
autologinModeAutofillRadio.addEventListener('change', updateAutologinCredentialsVisibility);

// ── Reset all settings ─────────────────────────────────────────────────────────
resetAllBtn.addEventListener('click', async () => {
  if (!confirm('Сбросить все настройки до значений по умолчанию?')) return;

  await adapter.saveAll({
    themeEnabled:            false,
    theme:                   'system',
    accent:                  'violet',
    tabIcon:                 'original',
    hideCourseCategoryCombo: false,
    hidePagingMoreLink:      false,
    hideEnrolIcon:           false,
    hideMainPageHeader:      false,
    hideHeaderLogo:          false,
    featureSortAlpha:        false,
    featureSwapOddEven:      false,
    featureAutoFilename:     false,
    autologinEnabled:        false,
    autologinMode:           'credentials',
  });
  await adapter.remove(['autologinUsername', 'autologinPassword']);

  // Обновить UI
  themeEnabledCheckbox.checked            = false;
  themeSelect.value                       = 'system';
  accentSelect.value                      = 'violet';
  tabIconSelect.value                     = 'original';
  applyPopupTheme(false, 'system', 'violet');
  saved['theme-panel']                    = { theme: 'system', accent: 'violet', replaceTabIcon: 'original' };

  hideCourseCategoryComboCheckbox.checked = false;
  hidePagingMoreLinkCheckbox.checked      = false;
  hideEnrolIconCheckbox.checked           = false;
  hideMainPageHeaderCheckbox.checked      = false;
  hideHeaderLogoCheckbox.checked          = false;

  featureSortAlphaCheckbox.checked        = false;
  featureSwapOddEvenCheckbox.checked      = false;
  featureAutoFilenameCheckbox.checked     = false;

  autologinEnabledCheckbox.checked        = false;
  autologinUsernameInput.value            = '';
  autologinPasswordInput.value            = '';
  autologinModeCredentialsRadio.checked   = true;
  autologinModeAutofillRadio.checked      = false;
  saved['autologin-panel'] = { autologinMode: 'credentials', autologinUsername: '', autologinPassword: '' };

  setPanelOpen('theme-panel', false);
  setPanelOpen('student-info-panel', false);
  setPanelOpen('autologin-panel', false);
  updateAutologinCredentialsVisibility();

  await sendToContentScript({ type: 'resetAllSettings' });
});
//  ─────────────────────────────────────────────────────────────
async function loadSettings() {
  const cfg = await adapter.getMultiple([
    'editMode',
    'themeEnabled', 'theme', 'accent', 'tabIcon',
    'hideCourseCategoryCombo', 'hidePagingMoreLink', 'hideEnrolIcon', 'hideMainPageHeader',
    'hideHeaderLogo',
    'featureSortAlpha', 'featureSwapOddEven', 'featureAutoFilename',
    'studentLastname', 'studentFirstname', 'studentMiddlename', 'studentGroup',
    'autologinEnabled', 'autologinMode', 'autologinUsername', 'autologinPassword',
  ]);

  setEditModeButtons(cfg.editMode ?? false);

  themeEnabledCheckbox.checked   = cfg.themeEnabled  ?? false;
  themeSelect.value              = cfg.theme         ?? 'system';
  accentSelect.value             = cfg.accent        ?? 'violet';
  tabIconSelect.value            = cfg.tabIcon       ?? 'original';
  saved['theme-panel'] = { theme: themeSelect.value, accent: accentSelect.value, replaceTabIcon: tabIconSelect.value };

  hideCourseCategoryComboCheckbox.checked = cfg.hideCourseCategoryCombo ?? false;
  hidePagingMoreLinkCheckbox.checked      = cfg.hidePagingMoreLink      ?? false;
  hideEnrolIconCheckbox.checked           = cfg.hideEnrolIcon           ?? false;
  hideMainPageHeaderCheckbox.checked      = cfg.hideMainPageHeader      ?? false;
  hideHeaderLogoCheckbox.checked          = cfg.hideHeaderLogo          ?? false;

  featureSortAlphaCheckbox.checked    = cfg.featureSortAlpha    ?? false;
  featureSwapOddEvenCheckbox.checked  = cfg.featureSwapOddEven  ?? false;
  featureAutoFilenameCheckbox.checked = cfg.featureAutoFilename ?? false;

  studentLastnameInput.value   = cfg.studentLastname   ?? '';
  studentFirstnameInput.value  = cfg.studentFirstname  ?? '';
  studentMiddlenameInput.value = cfg.studentMiddlename ?? '';
  studentGroupInput.value      = cfg.studentGroup      ?? '';
  saved['student-info-panel'] = {
    studentLastname:   studentLastnameInput.value,
    studentFirstname:  studentFirstnameInput.value,
    studentMiddlename: studentMiddlenameInput.value,
    studentGroup:      studentGroupInput.value,
  };

  autologinEnabledCheckbox.checked = cfg.autologinEnabled ?? false;
  const autologinMode = cfg.autologinMode ?? 'credentials';
  autologinModeCredentialsRadio.checked = autologinMode !== 'autofill';
  autologinModeAutofillRadio.checked    = autologinMode === 'autofill';
  autologinUsernameInput.value     = cfg.autologinUsername ?? '';
  autologinPasswordInput.value     = cfg.autologinPassword ?? '';
  saved['autologin-panel'] = {
    autologinMode,
    autologinUsername: autologinUsernameInput.value,
    autologinPassword: autologinPasswordInput.value,
  };
  updateAutologinCredentialsVisibility();

  applyPopupTheme(
    cfg.themeEnabled ?? false,
    cfg.theme        ?? 'system',
    cfg.accent       ?? 'violet',
  );
}

loadSettings();
