// popup.js — логика интерфейса расширения "Компактный Универ"
// Использует StorageAdapter через content_scripts

// --- DOM элементы ---
const editModeCb      = document.getElementById('edit-mode-cb');
const compactModeCb   = document.getElementById('compact-mode-cb');
const themeSelect     = document.getElementById('theme-select');
const accentSwatches  = document.querySelectorAll('.accent-swatch');
const drawerCb        = document.getElementById('drawer-cb');
const elsCb           = document.getElementById('els-cb');
const customCssToggle = document.getElementById('custom-css-toggle');
const customCssBody   = document.getElementById('custom-css-body');
const customCssTa     = document.getElementById('custom-css-ta');
const saveCssBtn      = document.getElementById('save-css-btn');
const resetBtn        = document.getElementById('reset-btn');
const statusMsg       = document.getElementById('status-msg');

// --- Состояние ---
let state = {
  editMode:   false,
  compactMode: false,
  theme:      'system',
  accent:     'violet',
  drawer:     false,
  els:        false,
  customCSS:  '',
};

// --- Инициализация ---
async function init() {
  const data = await StorageAdapter.getMultiple([
    'editMode', 'compactMode', 'theme', 'accent', 'drawer', 'els', 'customCSS',
  ]);

  state.editMode    = !!data.editMode;
  state.compactMode = !!data.compactMode;
  state.theme       = data.theme   || 'system';
  state.accent      = data.accent  || 'violet';
  state.drawer      = !!data.drawer;
  state.els         = !!data.els;
  state.customCSS   = data.customCSS || '';

  editModeCb.checked    = state.editMode;
  compactModeCb.checked = state.compactMode;
  themeSelect.value     = state.theme;
  drawerCb.checked      = state.drawer;
  elsCb.checked         = state.els;
  customCssTa.value     = state.customCSS;

  _updateAccentUI(state.accent);
}

// --- Обновить подсветку выбранного акцента ---
function _updateAccentUI(accent) {
  accentSwatches.forEach(btn => {
    const active = btn.dataset.accent === accent;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

// --- Перезагрузить активную вкладку ---
async function reloadActivePage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) chrome.tabs.reload(tab.id);
}

// --- Показать статусное сообщение ---
function showStatus(msg) {
  statusMsg.textContent = msg;
  statusMsg.hidden = false;
  setTimeout(() => { statusMsg.hidden = true; }, 1800);
}

// --- Collapsible: раскрытие/закрытие панели кастомного CSS ---
customCssToggle.addEventListener('click', () => {
  const expanded = customCssToggle.getAttribute('aria-expanded') === 'true';
  customCssToggle.setAttribute('aria-expanded', String(!expanded));
  customCssBody.hidden = expanded;
});

// --- Акцентные кружки ---
accentSwatches.forEach(btn => {
  btn.addEventListener('click', async () => {
    state.accent = btn.dataset.accent;
    _updateAccentUI(state.accent);
    await StorageAdapter.set('accent', state.accent);
    reloadActivePage();
  });
});

// --- Тема ---
themeSelect.onchange = async () => {
  state.theme = themeSelect.value;
  await StorageAdapter.set('theme', state.theme);
  reloadActivePage();
};

// --- Боковая панель (drawer) ---
drawerCb.onchange = async () => {
  state.drawer = drawerCb.checked;
  await StorageAdapter.set('drawer', state.drawer);
  reloadActivePage();
};

// --- Короткий заголовок (els) ---
elsCb.onchange = async () => {
  state.els = elsCb.checked;
  await StorageAdapter.set('els', state.els);
  reloadActivePage();
};

// --- Сохранить кастомный CSS ---
saveCssBtn.addEventListener('click', async () => {
  state.customCSS = customCssTa.value;
  await StorageAdapter.set('customCSS', state.customCSS);
  showStatus('CSS сохранён!');
  reloadActivePage();
});

// --- Режим редактирования ---
editModeCb.onchange = async () => {
  state.editMode = editModeCb.checked;
  await StorageAdapter.set('editMode', state.editMode);
  reloadActivePage();
};

// --- Компактный режим ---
compactModeCb.onchange = async () => {
  state.compactMode = compactModeCb.checked;
  await StorageAdapter.set('compactMode', state.compactMode);
  reloadActivePage();
};

// --- Сброс настроек ---
resetBtn.onclick = async () => {
  if (!confirm('Вы уверены, что хотите сбросить все настройки (скрытые предметы, цвета, названия)?')) {
    return;
  }

  await StorageAdapter.remove([
    'editMode',
    'compactMode',
    'theme',
    'accent',
    'drawer',
    'els',
    'customCSS',
    'hiddenItems',
    'customTitles',
    'itemColors',
    'knownItems',
  ]);

  showStatus('Сброшено!');
  reloadActivePage();
  init();
};

// --- Запуск ---
document.addEventListener('DOMContentLoaded', init);
