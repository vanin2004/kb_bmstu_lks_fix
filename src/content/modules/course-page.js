/**
 * course-page.js — страницы предмета и модулей
 *
 * Работает на:
 *   page-course-view-* — страница предмета
 *   page-mod-*         — страница модуля / задания
 */
'use strict';

// ── Заменить h1 кастомным названием ──────────────────────────────────────────
async function applyCustomTitleToHeading() {
  const courseId = getCurrentCourseId();
  if (!courseId) return;

  const customTitles = (await adapter.get('customTitles')) || {};
  const customTitle  = customTitles[courseId] || null;

  // Обновить кеш content FOUC до early return, чтобы правильно отражать текущее состояние
  try {
    const existing = JSON.parse(sessionStorage.getItem('kb_content_cfg') || '{}');
    existing.hideCourse = !!customTitle;
    sessionStorage.setItem('kb_content_cfg', JSON.stringify(existing));
  } catch (_) {}

  if (!customTitle) return;

  const h1 = document.querySelector('#page-header .page-header-headings h1');
  if (!h1) return;

  if (!h1.dataset.kbOriginal) {
    h1.dataset.kbOriginal = h1.textContent.trim();
  }
  h1.textContent = customTitle;
}

// ── Блок информации о курсе (название, цвет, преподаватели) ──────────────────
async function injectCourseInfoBlock() {
  const courseId = getCurrentCourseId();
  if (!courseId) return;

  const cfg = await adapter.getMultiple(['customTitles', 'itemColors', 'courseTeachers', 'featureGrades', 'courseGrades']);
  const customTitles   = cfg.customTitles   || {};
  const itemColors     = cfg.itemColors     || {};
  const courseTeachers = cfg.courseTeachers || {};
  const courseGrades   = (cfg.featureGrades && cfg.courseGrades) ? cfg.courseGrades : {};

  const customTitle = customTitles[courseId]   || null;
  const color       = itemColors[courseId]     || null;
  const teachers    = courseTeachers[courseId] || [];
  const gradeInfo   = courseGrades[courseId]   || null;

  // Не вставляем, если нечего показывать
  if (!customTitle && !color && teachers.length === 0 && !gradeInfo) return;

  const cardBody = document.querySelector('#page-header .card-body');
  if (!cardBody) return;

  // Предотвращаем дублирование
  if (document.getElementById('kb-course-info-block')) return;

  const block = document.createElement('div');
  block.id = 'kb-course-info-block';
  block.className = 'kb-course-info-block';

  if (color) {
    block.style.setProperty('--kb-course-color', color);
  }

  if (customTitle) {
    const h1 = document.querySelector('#page-header .page-header-headings h1');
    const origTitle = h1?.dataset.kbOriginal || null;
    const title = document.createElement('div');
    title.className = 'kb-course-custom-title';
    title.textContent = origTitle || customTitle;
    block.appendChild(title);
  }

  if (teachers.length > 0) {
    const teacherEl = document.createElement('div');
    teacherEl.className = 'kb-course-teachers';
    teacherEl.textContent = teachers.join(', ');
    block.appendChild(teacherEl);
  }

  if (gradeInfo) {
    const gradeText = formatGrade(gradeInfo.grade);
    const gradeEl = document.createElement('a');
    gradeEl.className = 'badge badge-secondary kb-course-grade';
    gradeEl.href      = gradeInfo.gradeUrl;
    gradeEl.title     = 'Отчёт об оценках по предмету';
    gradeEl.textContent = `Оценка: ${gradeText}`;
    block.appendChild(gradeEl);
  }

  cardBody.appendChild(block);
}

// ── Сделать заголовок страницы курса/модуля кликабельным (→ страница курса) ──
function initCourseHeadingLink() {
  const courseHomeLink = document.querySelector('a[data-key="coursehome"]');
  if (!courseHomeLink) return;

  const href = courseHomeLink.href;
  if (!href) return;

  const h1 = document.querySelector('#page-header .page-header-headings h1');
  if (!h1) return;

  // Не добавлять дважды
  if (h1.classList.contains('kb-heading-link')) return;

  h1.classList.add('kb-heading-link');
  h1.setAttribute('role', 'link');
  h1.setAttribute('tabindex', '0');
  h1.title = courseHomeLink.textContent.trim();

  h1.addEventListener('click', () => { location.href = href; });
  h1.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      location.href = href;
    }
  });
}
