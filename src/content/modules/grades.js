/**
 * grades.js — подгрузка и отображение оценок
 *
 * Работает на: всех страницах e-learning.bmstu.ru
 *
 * Отвечает за:
 *   - Загрузку сводки оценок с /grade/report/overview/index.php (через fetch)
 *   - Хранение оценок в storage.local (ключ courseGrades)
 *   - Отображение значка с оценкой на карточке курса (главная страница)
 *   - Кнопку «📊 Обновить оценки» над списком курсов
 */
'use strict';

let _featureGrades    = false;
let _courseGrades     = {}; // { courseId: { grade, gradeUrl } }
let _courseItemGrades = {}; // { courseId: { cmid: { grade, gradeUrl } } }

// ── Вспомогательные функции ───────────────────────────────────────────────────

function getUserIdFromPage() {
  const el = document.querySelector('[data-userid]');
  return el ? el.dataset.userid : null;
}

function getGradeReportUrl(userId) {
  return `https://e-learning.bmstu.ru/kaluga/grade/report/overview/index.php?userid=${userId}&id=1`;
}

function getCourseGradeReportUrl(courseId, userId) {
  return `https://e-learning.bmstu.ru/kaluga/course/user.php?mode=grade&id=${courseId}&user=${userId}`;
}

function parseGradeReport(html) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(html, 'text/html');
  const rows   = doc.querySelectorAll('#overview-grade tr');
  const grades = {};

  rows.forEach(row => {
    const linkEl  = row.querySelector('td.c0 a, td[id$="_c0"] a');
    const gradeEl = row.querySelector('td.c1, td[id$="_c1"]');
    if (!linkEl || !gradeEl) return;

    const rawHref  = linkEl.getAttribute('href') || '';
    const m        = rawHref.match(/[?&]id=(\d+)/);
    if (!m) return;

    const courseId = m[1];
    const grade    = gradeEl.textContent.trim();

    // Приводим href к абсолютному URL
    let gradeUrl = rawHref;
    if (!gradeUrl.startsWith('http')) {
      gradeUrl = 'https://e-learning.bmstu.ru' + (gradeUrl.startsWith('/') ? '' : '/') + gradeUrl;
    }

    grades[courseId] = { grade, gradeUrl };
  });

  return grades;
}

function parseCourseItemGrades(html) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(html, 'text/html');
  const items  = {};

  doc.querySelectorAll('th.column-itemname a.gradeitemheader[href]').forEach(link => {
    const href = link.getAttribute('href');
    const m    = href.match(/[?&]id=(\d+)/);
    if (!m) return;
    const cmid = m[1];

    const row       = link.closest('tr');
    if (!row) return;
    const gradeCell = row.querySelector('td.column-grade');
    if (!gradeCell) return;

    const grade = gradeCell.textContent.trim();
    let gradeUrl = href;
    if (!gradeUrl.startsWith('http')) {
      gradeUrl = 'https://e-learning.bmstu.ru' + (gradeUrl.startsWith('/') ? '' : '/') + gradeUrl;
    }
    items[cmid] = { grade, gradeUrl };
  });

  return items;
}

async function fetchGrades() {
  const userId = getUserIdFromPage();
  if (!userId) return null;
  try {
    const resp = await fetch(getGradeReportUrl(userId), { credentials: 'include' });
    if (!resp.ok) return null;
    const html = await resp.text();
    return parseGradeReport(html);
  } catch (e) {
    console.warn('[kb_grades] fetch error:', e);
    return null;
  }
}

async function fetchCourseItemGrades(courseId) {
  const userId = getUserIdFromPage();
  if (!userId) return null;
  try {
    const resp = await fetch(getCourseGradeReportUrl(courseId, userId), { credentials: 'include' });
    if (!resp.ok) return null;
    const html = await resp.text();
    return parseCourseItemGrades(html);
  } catch (e) {
    console.warn('[kb_grades] course items fetch error:', e);
    return null;
  }
}

// ── Значки оценок на карточках ────────────────────────────────────────────────

function applyGradeBadge(box, courseId) {
  box.querySelector('.kb-grade-badge')?.remove();
  if (!_featureGrades) return;

  const info = _courseGrades[courseId];
  if (!info) return;

  const gradeText = info.grade && info.grade !== '-' ? info.grade : '—';

  const badge = document.createElement('a');
  badge.className = 'kb-grade-badge badge badge-secondary';
  badge.href      = info.gradeUrl;
  badge.target    = '_blank';
  badge.rel       = 'noopener noreferrer';
  badge.title     = 'Открыть отчёт об оценках по предмету';
  badge.textContent = gradeText;

  const infoDiv = box.querySelector('.info');
  if (infoDiv) {
    infoDiv.insertAdjacentElement('afterbegin', badge);
  } else {
    box.insertAdjacentElement('afterbegin', badge);
  }
}

function applyGradeBadges() {
  if (!isMainPage) return;
  document.querySelectorAll('.coursebox[data-courseid]').forEach(box => {
    if (isInCategoryCombo(box)) return;
    applyGradeBadge(box, box.dataset.courseid);
  });
}

// ── Значки оценок у заданий на странице курса ────────────────────────────────

function applyActivityGradeBadge(activity) {
  activity.querySelector('.kb-activity-grade')?.remove();
  if (!_featureGrades) return;

  const courseId = getCurrentCourseId();
  if (!courseId) return;

  const itemGrades = _courseItemGrades[courseId];
  if (!itemGrades) return;

  const cmid = activity.id.replace('module-', '');
  const info = itemGrades[cmid];
  if (!info) return;

  const gradeText = info.grade && info.grade !== '-' ? info.grade : '\u2014';

  const badge = document.createElement('a');
  badge.className = 'kb-activity-grade badge badge-secondary';
  badge.href      = info.gradeUrl;
  badge.target    = '_blank';
  badge.rel       = 'noopener noreferrer';
  badge.title     = '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043e\u0442\u0447\u0451\u0442 \u043e\u0431 \u043e\u0446\u0435\u043d\u043a\u0435 \u0437\u0430 \u0437\u0430\u0434\u0430\u043d\u0438\u0435';
  badge.textContent = gradeText;

  const instance = activity.querySelector('.activityinstance');
  if (instance) instance.insertAdjacentElement('afterbegin', badge);
}

function applyActivityGradeBadges() {
  if (!isCoursePage) return;
  document.querySelectorAll('li.activity[id^="module-"]').forEach(activity => {
    applyActivityGradeBadge(activity);
  });
}

// ── Загрузка и применение ─────────────────────────────────────────────────────

async function loadAndApplyGrades() {
  const grades = await fetchGrades();
  if (!grades) return;

  _courseGrades = grades;
  await adapter.set('courseGrades', grades);
  applyGradeBadges();
}

// ── Feature toggle ─────────────────────────────────────────────────────────────

function applyFeatureGrades(enabled) {
  _featureGrades = enabled;
  if (isMainPage) {
    applyGradeBadges();
  } else if (isCoursePage) {
    if (enabled) {
      applyActivityGradeBadges();
      // Подгружаем если ещё нет данных
      const courseId = getCurrentCourseId();
      if (courseId && !_courseItemGrades[courseId]) {
        fetchCourseItemGrades(courseId).then(items => {
          if (items) {
            _courseItemGrades[courseId] = items;
            adapter.set('courseItemGrades', _courseItemGrades);
            applyActivityGradeBadges();
          }
        });
      }
    } else {
      applyActivityGradeBadges(); // убирает значки (featureGrades=false)
    }
  }
}

// ── Инициализация ─────────────────────────────────────────────────────────────

async function initGrades() {
  if (!isMainPage) return;
  const cfg = await adapter.getMultiple(['featureGrades', 'courseGrades']);
  _featureGrades = !!(cfg.featureGrades);
  _courseGrades  = cfg.courseGrades || {};

  if (_featureGrades) {
    applyGradeBadges();
    // Обновляем оценки в фоне (без блокировки UI)
    loadAndApplyGrades();
  }
}

async function initCourseGrades() {
  if (!isCoursePage) return;
  const cfg = await adapter.getMultiple(['featureGrades', 'courseItemGrades']);
  _featureGrades    = !!(cfg.featureGrades);
  _courseItemGrades = cfg.courseItemGrades || {};

  if (!_featureGrades) return;

  const courseId = getCurrentCourseId();
  if (!courseId) return;

  // Применяем кеш сразу
  applyActivityGradeBadges();

  // Подгружаем свежие данные в фоне
  const items = await fetchCourseItemGrades(courseId);
  if (items) {
    _courseItemGrades[courseId] = items;
    await adapter.set('courseItemGrades', _courseItemGrades);
    applyActivityGradeBadges();
  }
}
