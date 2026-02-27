/**
 * theme-early.js — ранний загрузчик темы оформления
 *
 * Запускается на document_start, до рендера страницы.
 * Цель: вставить <link> с темой и выставить data-атрибуты на <html>
 * как можно раньше, чтобы избежать вспышки нестилизованного контента (FOUC).
 *
 * НЕ зависит от storage.js — обращается к chrome.storage напрямую.
 */

'use strict';

(function () {
  const api = (typeof browser !== 'undefined') ? browser : chrome;
  const CACHE_KEY = 'kb_theme_cfg';

  function applyThemeCfg(cfg, suppressTransitions) {
    if (!cfg) return;
    const html = document.documentElement;

    // Отключить transitions на время смены темы, чтобы не было анимированного мелькания
    if (suppressTransitions) html.classList.add('kb-theme-loading');

    if (cfg.themeEnabled) {
      html.dataset.theme  = cfg.theme  || 'system';
      html.dataset.accent = cfg.accent || 'violet';
    } else {
      delete html.dataset.theme;
      delete html.dataset.accent;
    }

    if (suppressTransitions) {
      // Снять класс после двух кадров — браузер уже применил стили без transitions
      requestAnimationFrame(() => requestAnimationFrame(() => {
        html.classList.remove('kb-theme-loading');
      }));
    }
  }

  // ── Шаг 1: мгновенное применение из sessionStorage-кеша ────────────────
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) applyThemeCfg(JSON.parse(cached), true);
  } catch (_) {}

  // ── Шаг 2: актуальные данные из chrome.storage + обновление кеша ───────
  api.storage.local.get(['themeEnabled', 'theme', 'accent'], (cfg) => {
    if (!cfg) return;
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(cfg)); } catch (_) {}
    applyThemeCfg(cfg, true);
  });
})();
