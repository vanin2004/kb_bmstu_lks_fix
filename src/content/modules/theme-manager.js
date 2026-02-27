/**
 * Theme Manager Module
 *
 * Управляет подключением theme-override-pure.css и установкой
 * data-атрибутов на <html> для управления внешним видом.
 *
 * Атрибуты на <html>:
 *   data-theme  = "system" | "light" | "dark"
 *   data-accent = "violet" | "blue" | "pink" | "red" | "green"
 *   data-drawer = "1"   (современный сворачиваемый drawer)
 *   data-els    = "1"   (короткий текст заголовка)
 *   data-kf     = "1"   (Калужский филиал — устанавливается всегда)
 */

/* global browser, chrome */

const ThemeManager = (() => {
  const LINK_ID = 'cu-theme-stylesheet';

  function _runtimeApi() {
    return typeof browser !== 'undefined' ? browser : chrome;
  }

  /**
   * Применить конфигурацию темы через data-атрибуты.
   * @param {Object}  cfg
   * @param {string}  [cfg.theme='system']  - 'system' | 'light' | 'dark'
   * @param {string}  [cfg.accent='violet'] - 'violet' | 'blue' | 'pink' | 'red' | 'green'
   * @param {boolean} [cfg.drawer=false]    - современный collapsible drawer
   * @param {boolean} [cfg.els=false]       - короткий текст заголовка
   */
  function apply(cfg = {}) {
    // Подключаем единственный CSS-файл темы, если ещё не подключён
    let link = document.getElementById(LINK_ID);
    if (!link) {
      link = document.createElement('link');
      link.id   = LINK_ID;
      link.rel  = 'stylesheet';
      link.type = 'text/css';
      link.href = _runtimeApi().runtime.getURL('theme-override-pure.css');
      (document.head || document.documentElement).appendChild(link);
    }

    // Устанавливаем data-атрибуты
    const h = document.documentElement;
    h.dataset.theme  = cfg.theme  || 'system';
    h.dataset.accent = cfg.accent || 'violet';
    h.dataset.kf     = '1'; // Калужский филиал

    if (cfg.drawer) h.dataset.drawer = '1';
    else            delete h.dataset.drawer;

    if (cfg.els) h.dataset.els = '1';
    else         delete h.dataset.els;
  }

  /**
   * Удалить тему (убрать CSS и очистить data-атрибуты).
   */
  function remove() {
    const el = document.getElementById(LINK_ID);
    if (el) el.remove();
    const h = document.documentElement;
    delete h.dataset.theme;
    delete h.dataset.accent;
    delete h.dataset.drawer;
    delete h.dataset.els;
    delete h.dataset.kf;
  }

  /**
   * Список доступных тем.
   * @returns {Array<{value: string, label: string}>}
   */
  function getAvailableThemes() {
    return [
      { value: 'system', label: 'Системная'  },
      { value: 'light',  label: 'Светлая'    },
      { value: 'dark',   label: 'Тёмная'     },
    ];
  }

  /**
   * Список доступных акцентных цветов.
   * @returns {Array<{value: string, label: string, color: string}>}
   */
  function getAvailableAccents() {
    return [
      { value: 'violet', label: 'Фиолетовый', color: '#694fa3' },
      { value: 'blue',   label: 'Синий',       color: '#00658b' },
      { value: 'pink',   label: 'Розовый',     color: '#95416e' },
      { value: 'red',    label: 'Красный',     color: '#9c4235' },
      { value: 'green',  label: 'Зелёный',     color: '#006c4b' },
    ];
  }

  return { apply, remove, getAvailableThemes, getAvailableAccents };
})();
