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

let _featureGrades = false;
let _courseGrades  = {}; // { courseId: { grade, gradeUrl } }

// ── Вспомогательные функции ───────────────────────────────────────────────────

function getUserIdFromPage() {
  const el = document.querySelector('[data-userid]');
  return el ? el.dataset.userid : null;
}

function getGradeReportUrl(userId) {
  return `https://e-learning.bmstu.ru/kaluga/grade/report/overview/index.php?userid=${userId}&id=1`;
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
  if (!isMainPage) return;
  applyGradeBadges();
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
