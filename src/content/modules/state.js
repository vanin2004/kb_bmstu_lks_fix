/**
 * state.js — глобальное состояние и API-адаптеры
 *
 * Загружается первым. Объявляет все глобальные переменные и константы,
 * доступные во всех остальных модулях.
 */
'use strict';

// ── Кросс-браузерный API ────────────────────────────────────────────────────
const extAPI = (typeof browser !== 'undefined') ? browser : chrome;
const adapter = window.storageAdapter;

// ── Тип страницы ────────────────────────────────────────────────────────────
const bodyId = document.body.id || '';
const isMainPage   = bodyId === 'page-site-index';
const isCoursePage = bodyId.startsWith('page-course-view');
const isModPage    = bodyId.startsWith('page-mod-');

// ── Состояние редактирования ─────────────────────────────────────────────────
// Изменения хранятся ТОЛЬКО здесь до выключения режима редактирования
let _editState = {
  hiddenItems:    {},   // { id: bool }
  customTitles:   {},   // { id: string|null }
  itemColors:     {},   // { id: '#rrggbb' }
  hiddenImages:   {},   // { id: bool }
};

let _editMode = false;

// ── Флаги включённых фич (по умолчанию включены) ─────────────────────────────
let _features = {
  sortAlpha:    true,
  swapOddEven:  true,
};

// ── Данные студента для автоименования файла ──────────────────────────────────
let _studentInfo = {
  lastname:   '',
  firstname:  '',
  middlename: '',
  group:      '',
};

let _featureAutoFilename = false;
let _currentCourseTitle = '';
let _autoFilenameSubjects = {}; // { courseId: последний ввод пользователя }
