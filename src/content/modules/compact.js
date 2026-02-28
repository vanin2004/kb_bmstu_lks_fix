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
}

function applyPagingMoreLinkVisibility(hide) {
  document.querySelectorAll('.paging.paging-morelink').forEach(el => {
    el.style.display = hide ? 'none' : '';
  });
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

async function initCompactSettings() {
  const cfg = await adapter.getMultiple([
    'hideCourseCategoryCombo', 'hidePagingMoreLink', 'hideEnrolIcon', 'hideMainPageHeader',
  ]);
  applyCourseCategoryComboVisibility(!!cfg.hideCourseCategoryCombo);
  applyPagingMoreLinkVisibility(!!cfg.hidePagingMoreLink);
  applyEnrolIconVisibility(!!cfg.hideEnrolIcon);
  applyMainPageHeaderVisibility(!!cfg.hideMainPageHeader);
}
