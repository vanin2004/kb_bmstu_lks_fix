/**
 * messages.js — обработчик сообщений от popup
 *
 * Каждый case соответствует одному типу сообщения от popup.js.
 *
 * Как добавить новое сообщение:
 *   1. Добавить case ниже
 *   2. Добавить sendToContentScript({ type: '...' }) в popup.js
 */
'use strict';

extAPI.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'editModeEnable':
      if (isMainPage) enableEditMode();
      sendResponse && sendResponse({ ok: true });
      break;

    case 'editModeSave':
      if (isMainPage) disableEditMode();
      sendResponse && sendResponse({ ok: true });
      break;

    case 'editModeCancel':
      if (isMainPage) cancelEditMode();
      sendResponse && sendResponse({ ok: true });
      break;

    case 'themeChanged':
      (async () => {
        const cfg = await adapter.getMultiple(['themeEnabled', 'theme', 'accent']);
        applyTheme(cfg.themeEnabled, cfg.theme, cfg.accent);
      })();
      sendResponse && sendResponse({ ok: true });
      break;

    case 'hideCourseCategoryComboChanged':
      applyCourseCategoryComboVisibility(message.value);
      sendResponse && sendResponse({ ok: true });
      break;

    case 'hidePagingMoreLinkChanged':
      applyPagingMoreLinkVisibility(message.value);
      sendResponse && sendResponse({ ok: true });
      break;

    case 'hideEnrolIconChanged':
      applyEnrolIconVisibility(message.value);
      sendResponse && sendResponse({ ok: true });
      break;

    case 'hideMainPageHeaderChanged':
      applyMainPageHeaderVisibility(message.value);
      sendResponse && sendResponse({ ok: true });
      break;

    case 'hideHeaderLogoChanged':
      applyHeaderLogoVisibility(message.value);
      sendResponse && sendResponse({ ok: true });
      break;

    case 'replaceTabIconChanged':
      applyFaviconReplacement(message.value);
      sendResponse && sendResponse({ ok: true });
      break;

    case 'featuresChanged':
      if (message.features.sortAlpha   !== undefined) _features.sortAlpha   = message.features.sortAlpha;
      if (message.features.swapOddEven !== undefined) _features.swapOddEven = message.features.swapOddEven;
      if (isMainPage) {
        processAllCourseBoxes(_editState.hiddenItems, _editState.customTitles, _editState.itemColors);
      }
      sendResponse && sendResponse({ ok: true });
      break;

    case 'featureAutoFilenameChanged':
      _featureAutoFilename = message.value;
      if (_featureAutoFilename) {
        startAutoFilenameObserver();
      } else {
        stopAutoFilenameObserver();
      }
      sendResponse && sendResponse({ ok: true });
      break;

    case 'featureGradesChanged':
      applyFeatureGrades(message.value);
      sendResponse && sendResponse({ ok: true });
      break;

    case 'resetAllSettings':
      applyTheme(false, 'system', 'violet');
      applyFaviconReplacement('original');
      applyCourseCategoryComboVisibility(false);
      applyPagingMoreLinkVisibility(false);
      applyEnrolIconVisibility(false);
      applyMainPageHeaderVisibility(false);
      applyHeaderLogoVisibility(false);
      _features.sortAlpha   = false;
      _features.swapOddEven = false;
      if (isMainPage) {
        processAllCourseBoxes(_editState.hiddenItems, _editState.customTitles, _editState.itemColors);
      }
      stopAutoFilenameObserver();
      _featureAutoFilename = false;
      applyFeatureGrades(false);
      sendResponse && sendResponse({ ok: true });
      break;

    case 'studentInfoChanged': {
      const keyMap = {
        studentLastname:   'lastname',
        studentFirstname:  'firstname',
        studentMiddlename: 'middlename',
        studentGroup:      'group',
      };
      const field = keyMap[message.key];
      if (field) _studentInfo[field] = message.value;
      sendResponse && sendResponse({ ok: true });
      break;
    }
  }

  // Возвращаем true для асинхронных обработчиков (Firefox требует)
  return true;
});
