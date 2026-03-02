/**
 * assign-page.js — страница задания (mod/assign/view.php)
 *
 * Работает на: страницах вида /mod/assign/view.php?id=...
 *   (определяется по body.id, начинающемуся с 'page-mod-assign')
 *
 * Отвечает за:
 *   - Считывание дат задания из живого DOM
 *   - Обновление сохранённого семестра курса в storage:
 *     сохраняется минимальный из уже сохранённого и вычисленного,
 *     чтобы со временем накапливалась наиболее ранняя дата курса
 */
'use strict';

async function initAssignPage() {
  if (!document.body.id.startsWith('page-mod-assign')) return;

  // ── Извлечь courseId ────────────────────────────────────────────────────────

  let courseId = null;

  // Способ 1: class="... course-NNN ..." на <body>
  const classMatch = document.body.className.match(/\bcourse-(\d+)\b/);
  if (classMatch) courseId = classMatch[1];

  // Способ 2: ссылка на курс в хлебных крошках
  if (!courseId) {
    const crumb = document.querySelector('.breadcrumb a[href*="course/view.php"]');
    if (crumb) {
      try { courseId = new URL(crumb.href).searchParams.get('id'); } catch (_) {}
    }
  }

  if (!courseId) return;

  // ── Считать даты с текущей страницы задания (живой DOM) ───────────────────
  // Повторяем логику _parseAssignDates, но работаем с document напрямую.

  const dates = [];

  // 1. Блок дат активности: «Открыто с:», «Срок сдачи:» и т.п.
  const activityDates = document.querySelector('[data-region="activity-dates"]');
  if (activityDates) {
    for (const child of activityDates.children) {
      let text = '';
      for (const node of child.childNodes) {
        if (node.nodeType === 3) text += node.nodeValue;
      }
      const d = _parseRuDate(text.trim());
      if (d) dates.push(d);
    }
  }

  // 2. Строки «Последнее изменение» и «Оценено в» в таблице ответа/отзыва
  const TRACKED_HEADERS = ['Последнее изменение', 'Оценено в'];
  document.querySelectorAll('th[scope="row"]').forEach(th => {
    const label = th.textContent.trim();
    if (!TRACKED_HEADERS.some(h => label.startsWith(h))) return;
    const td = th.closest('tr')?.querySelector('td');
    if (!td) return;
    const d = _parseRuDate(td.textContent.trim());
    if (d) dates.push(d);
  });

  if (dates.length === 0) return;

  // ── Обновить storage: сохранить min(сохранённый, вычисленный) ─────────────
  const minDate = dates.reduce((a, b) => (a <= b ? a : b));
  const semInfo = _semesterFromDate(minDate);
  if (!semInfo) return;

  await updateCourseSemesterIfSmaller(courseId, semInfo);
}
