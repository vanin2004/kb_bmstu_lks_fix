/**
 * utils.js — общие утилиты
 */
'use strict';

// ── Идентификатор текущего курса ─────────────────────────────────────────────
function getCourseIdFromUrl(url) {
  const m = (url || location.href).match(/[?&]id=(\d+)/);
  return m ? m[1] : null;
}

function getCourseIdFromBreadcrumb() {
  const links = document.querySelectorAll('#page-navbar .breadcrumb a[href]');
  for (const a of links) {
    if (a.href.includes('course/view.php')) {
      return getCourseIdFromUrl(a.href);
    }
  }
  return null;
}

function getCurrentCourseId() {
  if (isCoursePage) return getCourseIdFromUrl(location.href);
  if (isModPage)    return getCourseIdFromBreadcrumb();
  return null;
}
