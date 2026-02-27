/**
 * Main Content Script — точка входа
 *
 * Оркеструет все модули расширения:
 *  • StorageAdapter      — чтение/запись настроек
 *  • ThemeManager        — темы оформления
 *  • CompactMode         — скрытие ненужных блоков
 *  • ItemsManager        — управление видимостью предметов
 *  • CustomizationManager — кастомные названия и цвета
 *
 * Слушает сообщения от popup через chrome.runtime.onMessage.
 */

/* global StorageAdapter, ThemeManager, CompactMode, ItemsManager, CustomizationManager */
/* global browser, chrome */

(async () => {
  'use strict';

  // ── Получить API сообщений (кроссбраузерно) ─────────────────────
  const _msgApi = typeof browser !== 'undefined' ? browser : chrome;

  // ── Ключи хранилища ──────────────────────────────────────────────
  const STORAGE_KEYS = [
    'editMode',
    'compactMode',
    'theme',
    'accent',
    'drawer',
    'els',
    'hiddenItems',
    'customTitles',
    'itemColors',
    'knownItems',
  ];

  // ── Загрузить все настройки ──────────────────────────────────────
  let cfg;
  try {
    cfg = await StorageAdapter.getMultiple(STORAGE_KEYS);
  } catch (e) {
    console.error('[CU] Ошибка загрузки настроек:', e);
    cfg = {};
  }

  const editMode     = !!cfg.editMode;
  const compactMode  = !!cfg.compactMode;
  const theme        = cfg.theme  || 'system';
  const accent       = cfg.accent || 'violet';
  const drawer       = !!cfg.drawer;
  const els          = !!cfg.els;
  let   hiddenItems  = cfg.hiddenItems   || {};
  let   customTitles = cfg.customTitles  || {};
  let   itemColors   = cfg.itemColors    || {};

  // ── Применить тему ───────────────────────────────────────────────
  ThemeManager.apply({ theme, accent, drawer, els });

  // ── Применить компактный режим ───────────────────────────────────
  CompactMode.apply(compactMode);

  // ── Логика главной страницы ──────────────────────────────────────
  if (ItemsManager.isMainPage()) {
    const items = ItemsManager.getAllItems();

    // Зарегистрировать новые предметы (по умолчанию видимы)
    const updatedHidden = ItemsManager.registerNewItems(items, hiddenItems);
    const hasNewItems   = Object.keys(updatedHidden).length !== Object.keys(hiddenItems).length;

    if (hasNewItems) {
      hiddenItems = updatedHidden;
      // Сохраняем обновлённый список асинхронно (не ждём)
      StorageAdapter.set('hiddenItems', hiddenItems).catch(console.error);
    }

    // Сохранить список известных предметов для popup
    const knownItems = items.map(({ id, title }) => ({ id, title }));
    StorageAdapter.set('knownItems', knownItems).catch(console.error);

    if (editMode) {
      // ── Режим редактирования ──────────────────────────────────────
      //  • Показать все карточки
      //  • Выделить скрытые визуально
      //  • Применить цвета и названия
      //  • Добавить элементы управления на каждую карточку

      ItemsManager.showAll();
      ItemsManager.applyEditModeAppearance(hiddenItems);
      CustomizationManager.applyColors(itemColors);
      CustomizationManager.applyTitles(customTitles);

      CustomizationManager.addEditControls(
        customTitles,
        itemColors,
        hiddenItems,
        {
          onHideToggle: (id, isHidden) => {
            hiddenItems[id] = isHidden;
            StorageAdapter.set('hiddenItems', hiddenItems).catch(console.error);
          },
          onTitleChange: (id, title) => {
            if (title === null) delete customTitles[id];
            else customTitles[id] = title;
            StorageAdapter.set('customTitles', customTitles).catch(console.error);
          },
          onColorChange: (id, color) => {
            itemColors[id] = color;
            StorageAdapter.set('itemColors', itemColors).catch(console.error);
          },
        }
      );

      // Добавляем панель управления на страницу
      const courseList = document.getElementById('frontpage-course-list');
      if (courseList && !document.getElementById('cu-edit-panel')) {
        const panel = document.createElement('div');
        panel.id = 'cu-edit-panel';
        panel.className = 'cu-edit-panel';
        panel.innerHTML = `
          <div class="cu-edit-panel-title">Режим настройки "Компактный Универ"</div>
          <div class="cu-edit-panel-buttons">
            <button id="cu-btn-select-all" class="cu-btn">Скрыть все</button>
            <button id="cu-btn-invert" class="cu-btn">Инвертировать</button>
            <button id="cu-btn-exit" class="cu-btn cu-btn-primary">Выйти из режима</button>
          </div>
        `;
        courseList.insertBefore(panel, courseList.firstChild);

        document.getElementById('cu-btn-select-all').addEventListener('click', () => {
          items.forEach(item => hiddenItems[item.id] = true);
          StorageAdapter.set('hiddenItems', hiddenItems).then(() => window.location.reload());
        });

        document.getElementById('cu-btn-invert').addEventListener('click', () => {
          items.forEach(item => hiddenItems[item.id] = !hiddenItems[item.id]);
          StorageAdapter.set('hiddenItems', hiddenItems).then(() => window.location.reload());
        });

        document.getElementById('cu-btn-exit').addEventListener('click', () => {
          StorageAdapter.set('editMode', false).then(() => window.location.reload());
        });
      }

    } else {
      // ── Обычный режим ─────────────────────────────────────────────
      //  • Скрыть помеченные предметы
      //  • Применить цвета и названия

      ItemsManager.applyVisibility(hiddenItems);
      CustomizationManager.applyColors(itemColors);
      CustomizationManager.applyTitles(customTitles);
    }

  } else {
    // ── Не главная страница (напр., страница курса) ───────────────
    //  • Только применить кастомные названия (без полей редактирования)
    CustomizationManager.applyTitles(customTitles);
  }

  // ── Слушатель сообщений от popup ────────────────────────────────
  _msgApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.action) return;

    switch (message.action) {
      case 'reloadPage':
        // Popup просит обновить страницу после сохранения
        sendResponse({ success: true });
        window.location.reload();
        break;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }

    // Вернуть true для поддержки асинхронного sendResponse в Chrome
    return true;
  });

})();
