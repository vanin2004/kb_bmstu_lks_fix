/**
 * nav.js — удобная навигация
 *
 * Работает на: всех страницах e-learning.bmstu.ru
 *
 * Отвечает за:
 *   - Добавление ссылок (почта, ЛКС, оценки) в ul.m_custom навбара
 *   - Замену выпадающего меню пользователя прямой ссылкой на профиль
 */
'use strict';

let _featureNav = false;
let _userMenuClickHandler = null;

const KB_NAV_IDS = ['kb-nav-mail', 'kb-nav-lks', 'kb-nav-grades'];

// ── Вспомогательные функции ───────────────────────────────────────────────────

function getProfileUrl() {
  const link = document.querySelector('.usermenu a[href*="user/profile.php"]');
  if (link) return link.getAttribute('href');
  const el = document.querySelector('[data-userid]');
  if (el) return `https://e-learning.bmstu.ru/kaluga/user/profile.php?id=${el.dataset.userid}`;
  return null;
}

// ── Ссылки в навбаре ──────────────────────────────────────────────────────────

function _makeNavLink(id, href, title, iconHtml, external) {
  const a = document.createElement('a');
  a.id        = id;
  a.href      = href;
  a.className = 'nav-link d-inline-block icon-no-margin';
  a.title     = title;
  a.setAttribute('aria-label', title);
  if (external) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  a.innerHTML = iconHtml;
  return a;
}

function injectNavLinks() {
  const notifRegion = document.getElementById('nav-notification-popover-container');
  if (!notifRegion) return;
  const navLi = notifRegion.closest('li.nav-item');
  if (!navLi) return;

  // Удаляем старый wrapper если есть
  document.getElementById('kb-nav-row')?.remove();

  const msgRegion = navLi.querySelector('[data-region="popover-region-messages"]');
  const lksLogoUrl = extAPI.runtime.getURL('site_logo/Logo_Color_No-BG.svg');

  // Создаём flex-контейнер, куда перенесём всё
  const row = document.createElement('div');
  row.id = 'kb-nav-row';
  row.className = 'kb-nav-row';

  // Наши ссылки
  const items = [
    {
      id:    'kb-nav-lks',
      href:  'https://lks.bmstu.ru/schedule/',
      title: 'ЛКС — Расписание',
      html:  `<img src="${lksLogoUrl}" class="kb-nav-lks-icon" alt="ЛКС">`,
      ext:   false,
    },
    {
      id:    'kb-nav-mail',
      href:  'https://student.bmstu.ru/?Skin=hPronto-&altLanguage=russian',
      title: 'Почта МГТУ',
      html:  '<i class="icon fa fa-envelope fa-fw" aria-hidden="true"></i>',
      ext:   false,
    },
    {
      id:    'kb-nav-grades',
      href:  'https://e-learning.bmstu.ru/kaluga/grade/report/overview/index.php',
      title: 'Мои оценки',
      html:  '<i class="icon fa fa-table fa-fw" aria-hidden="true"></i>',
      ext:   false,
    },
  ];
  for (const { id, href, title, html, ext } of items) {
    row.appendChild(_makeNavLink(id, href, title, html, ext));
  }

  // Переносим оригинальные блоки bell и message в наш row
  row.appendChild(notifRegion);
  if (msgRegion) row.appendChild(msgRegion);

  navLi.insertBefore(row, navLi.firstChild);
  navLi.classList.add('kb-nav-li');
}

function removeNavLinks() {
  const row = document.getElementById('kb-nav-row');
  if (!row) return;
  const navLi = row.closest('li.nav-item');

  // Возвращаем оригинальные блоки назад в li
  const notifRegion = document.getElementById('nav-notification-popover-container');
  const msgRegion = row.querySelector('[data-region="popover-region-messages"]');
  if (notifRegion && navLi) navLi.appendChild(notifRegion);
  if (msgRegion && navLi) navLi.appendChild(msgRegion);

  row.remove();
  navLi?.classList.remove('kb-nav-li');
}

// ── Пользовательское меню → прямая ссылка на профиль ─────────────────────────

function applyUserMenuDirect() {
  const toggle = document.querySelector('.m_user a.dropdown-toggle');
  if (!toggle || _userMenuClickHandler) return;

  const profileUrl = getProfileUrl();
  if (!profileUrl) return;

  // Используем capture-фазу, чтобы перехватить раньше Bootstrap
  _userMenuClickHandler = (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    location.href = profileUrl;
  };
  toggle.addEventListener('click', _userMenuClickHandler, true);

  // Скрываем выпадающее меню
  const dropdownMenu = document.querySelector('.m_user .dropdown-menu');
  if (dropdownMenu) dropdownMenu.dataset.kbNavHidden = '1';
  if (dropdownMenu) dropdownMenu.style.cssText += '; display: none !important;';
}

function restoreUserMenu() {
  const toggle = document.querySelector('.m_user a.dropdown-toggle');
  if (toggle && _userMenuClickHandler) {
    toggle.removeEventListener('click', _userMenuClickHandler, true);
  }
  _userMenuClickHandler = null;

  const dropdownMenu = document.querySelector('.m_user .dropdown-menu[data-kb-nav-hidden]');
  if (dropdownMenu) {
    dropdownMenu.style.removeProperty('display');
    // cssText могла содержать !important — убираем наш фрагмент
    dropdownMenu.style.cssText = dropdownMenu.style.cssText.replace(/;\s*display:\s*none\s*!important/gi, '');
    delete dropdownMenu.dataset.kbNavHidden;
  }
}

// ── Feature toggle ─────────────────────────────────────────────────────────────

function applyFeatureNav(enabled) {
  _featureNav = enabled;
  if (enabled) {
    document.body.classList.add('kb-nav-active');
    injectNavLinks();
    applyUserMenuDirect();
  } else {
    document.body.classList.remove('kb-nav-active');
    removeNavLinks();
    restoreUserMenu();
  }
}

// ── Инициализация ─────────────────────────────────────────────────────────────

async function initNavigation() {
  const cfg = await adapter.getMultiple(['featureNav']);
  _featureNav = !!(cfg.featureNav);
  if (_featureNav) {
    document.body.classList.add('kb-nav-active');
    injectNavLinks();
    applyUserMenuDirect();
  }
}
