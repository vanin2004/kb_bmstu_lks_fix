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

async function initTheme() {
  const cfg = await adapter.getMultiple(['themeEnabled', 'theme', 'accent']);
  applyTheme(cfg.themeEnabled, cfg.theme, cfg.accent);
}
