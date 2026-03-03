/**
 * theme.js — тема оформления
 *
 * Управляет data-theme / data-accent на <html>.
 * CSS-переменные темы объявлены в theme-override.css.
 */
'use strict';

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

function applyFaviconReplacement(logo) {
  const _extAPI = (typeof browser !== 'undefined') ? browser : chrome;
  const link = document.querySelector('link[rel="shortcut icon"], link[rel="icon"]');
  if (!link) return;
  if (!logo || logo === 'original') {
    if (link.dataset.kbOriginalHref) {
      link.href = link.dataset.kbOriginalHref;
      delete link.dataset.kbOriginalHref;
    }
  } else {
    if (!link.dataset.kbOriginalHref) link.dataset.kbOriginalHref = link.href;
    const url = logo === 'extension'
      ? _extAPI.runtime.getURL('icons/icon48.png')
      : _extAPI.runtime.getURL('site_logo/' + logo);
    link.href = url;
  }
}

// Миграция старых имён логотипов (With-BG → No-BG)
const _LOGO_MIGRATION = {
  'Logo_Color_With-BG.svg': 'Logo_Color_No-BG.svg',
  'Logo_Blue_With-BG.svg':  'Logo_Blue_No-BG.svg',
  'Logo_Black_With-BG.svg': 'Logo_Black_No-BG.svg',
  'Logo_Red_With-BG.svg':   'Logo_Red_No-BG.svg',
};

async function initTheme() {
  const cfg = await adapter.getMultiple(['themeEnabled', 'theme', 'accent', 'tabIcon']);

  // Мигрируем устаревшее значение если нужно
  let tabIcon = cfg.tabIcon || 'original';
  if (_LOGO_MIGRATION[tabIcon]) {
    tabIcon = _LOGO_MIGRATION[tabIcon];
    await adapter.set('tabIcon', tabIcon);
  }

  applyTheme(cfg.themeEnabled, cfg.theme, cfg.accent);
  applyFaviconReplacement(tabIcon);
}
