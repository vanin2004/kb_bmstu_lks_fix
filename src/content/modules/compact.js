/**
 * compact.js — компактный вид главной страницы
 *
 * Управляет видимостью необязательных элементов интерфейса.
 *
 * Как добавить новый скрываемый элемент:
 *   1. Добавить функцию applyXxxVisibility(hide) ниже
 *   2. Добавить её вызов в initCompactSettings()
 *   3. Добавить обработчик сообщения в messages.js ('xxxChanged')
 *   4. Добавить ключ в storage-keys.md
 *   5. Добавить чекбокс в popup.html и обработчик в popup.js
 */
'use strict';

function applyCourseCategoryComboVisibility(hide) {
  const block = document.getElementById('frontpage-category-combo');
  if (!block) return;
  block.style.display = hide ? 'none' : '';
  if (hide) {
    document.querySelector('#skipcourses + br')?.remove();
  } else {
    const anchor = document.querySelector('#skipcourses');
    if (anchor && !document.querySelector('#skipcourses + br'))
      anchor.insertAdjacentElement('afterend', document.createElement('br'));
  }
}

function applyPagingMoreLinkVisibility(hide) {
  document.querySelectorAll('.paging.paging-morelink').forEach(el => {
    el.style.display = hide ? 'none' : '';
  });
  if (hide) {
    document.querySelector('#skipmycourses + br')?.remove();
  } else {
    const anchor = document.querySelector('#skipmycourses');
    if (anchor && !document.querySelector('#skipmycourses + br'))
      anchor.insertAdjacentElement('afterend', document.createElement('br'));
  }
}

function applyEnrolIconVisibility(hide) {
  document.querySelectorAll('img[src*="enrol_bmstugroups"]').forEach(el => {
    el.style.display = hide ? 'none' : '';
  });
}

function applyMainPageHeaderVisibility(hide) {
  if (!isMainPage) return;
  const header = document.getElementById('page-header');
  if (header) header.style.display = hide ? 'none' : '';
}

function applyHeaderLogoVisibility(hide) {
  document.querySelectorAll('img.buttonlogo').forEach(el => {
    el.style.display = hide ? 'none' : '';
  });
  const drawer = document.getElementById('nav-drawer');
  if (drawer) drawer.style.display = hide ? 'none' : '';
  const drawerToggle = document.querySelector('[data-region="drawer-toggle"]');
  if (drawerToggle) drawerToggle.style.display = hide ? 'none' : '';
}

function applyFooterVisibility(hide) {
  const footer = document.getElementById('page-footer');
  if (footer) footer.style.display = hide ? 'none' : '';
}

function applyBreadcrumbVisibility(hide) {
  document.querySelectorAll('ol.breadcrumb').forEach(el => {
    el.style.display = hide ? 'none' : '';
  });
}

async function initCompactSettings() {
  const cfg = await adapter.getMultiple([
    'hideCourseCategoryCombo', 'hidePagingMoreLink', 'hideEnrolIcon', 'hideMainPageHeader',
    'hideHeaderLogo', 'hideFooter', 'hideBreadcrumb',
  ]);
  applyCourseCategoryComboVisibility(!!cfg.hideCourseCategoryCombo);
  applyPagingMoreLinkVisibility(!!cfg.hidePagingMoreLink);
  applyEnrolIconVisibility(!!cfg.hideEnrolIcon);
  applyMainPageHeaderVisibility(!!cfg.hideMainPageHeader);
  applyHeaderLogoVisibility(!!cfg.hideHeaderLogo);
  applyFooterVisibility(!!cfg.hideFooter);
  applyBreadcrumbVisibility(!!cfg.hideBreadcrumb);
}
