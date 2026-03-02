/**
 * semester.js — определение семестра курса по датам из заданий
 *
 * Работает на: всех страницах e-learning.bmstu.ru
 *
 * Отвечает за:
 *   - Загрузку страницы курса и поиск ссылок на задания (mod/assign)
 *   - Извлечение дат со страниц заданий:
 *       «Открыто с:» / «Срок сдачи:» и др. — блок [data-region="activity-dates"]
 *       «Последнее изменение»               — таблица состояния ответа
 *       «Оценено в»                         — таблица отзыва
 *   - Определение семестра по наименьшей из найденных дат
 */
'use strict';

// ── Русские названия месяцев (форма родительного падежа) ─────────────────────
const _RU_MONTHS = {
  'января':   0,  'февраля':  1,  'марта':   2,  'апреля':  3,
  'мая':      4,  'июня':     5,  'июля':    6,  'августа': 7,
  'сентября': 8,  'октября':  9,  'ноября': 10,  'декабря': 11,
};

// Парсит русскоязычную дату вида «Понедельник, 25 сентября 2023, 00:00»
// или просто «28 октября 2023, 09:59» — возвращает Date или null
function _parseRuDate(str) {
  if (!str) return null;
  const m = str.match(/(\d{1,2})\s+([а-яёА-ЯЁ]+)\s+(\d{4})/);
  if (!m) return null;
  const month = _RU_MONTHS[m[2].toLowerCase()];
  if (month === undefined) return null;
  return new Date(parseInt(m[3], 10), month, parseInt(m[1], 10));
}

// По дате определяет семестр и учебный год.
// Возвращает { semester: 'осень'|'весна', year: '20NN–20NN' } или null
function _semesterFromDate(date) {
  if (!(date instanceof Date) || isNaN(date)) return null;
  const m = date.getMonth(); // 0-based
  const y = date.getFullYear();

  if (m >= 8) {
    // сентябрь–декабрь → осенний семестр начавшегося учебного года
    return { semester: 'осень', year: `${y}–${y + 1}` };
  } else if (m === 0) {
    // январь → продолжение осеннего семестра прошлого учебного года
    return { semester: 'осень', year: `${y - 1}–${y}` };
  } else {
    // февраль–август → весенний семестр
    return { semester: 'весна', year: `${y - 1}–${y}` };
  }
}

// Разбирает HTML страницы задания, возвращает массив найденных Date
function _parseAssignDates(html) {
  const doc   = new DOMParser().parseFromString(html, 'text/html');
  const dates = [];

  // 1. Блок дат активности: «Открыто с:», «Срок сдачи:» и т.п.
  //    Перебираем только прямые потомки блока; дату извлекаем из текстовых
  //    узлов (nodeType === 3), игнорируя <strong>-заголовок.
  const activityDates = doc.querySelector('[data-region="activity-dates"]');
  if (activityDates) {
    for (const child of activityDates.children) {
      let text = '';
      for (const node of child.childNodes) {
        if (node.nodeType === 3) text += node.nodeValue;  // TEXT_NODE
      }
      const d = _parseRuDate(text.trim());
      if (d) dates.push(d);
    }
  }

  // 2. Строки таблицы состояния ответа и отзыва.
  //    Ищем <th scope="row"> с нужным заголовком (независимо от набора классов).
  const TRACKED_HEADERS = ['Последнее изменение', 'Оценено в'];
  doc.querySelectorAll('th[scope="row"]').forEach(th => {
    const label = th.textContent.trim();
    if (!TRACKED_HEADERS.some(h => label.startsWith(h))) return;
    const td = th.closest('tr')?.querySelector('td');
    if (!td) return;
    const d = _parseRuDate(td.textContent.trim());
    if (d) dates.push(d);
  });

  return dates;
}

// Ищет первые до max ссылок на задания (mod/assign) в HTML страницы курса
function _findAssignUrls(html, max = 5) {
  const doc   = new DOMParser().parseFromString(html, 'text/html');
  const links = doc.querySelectorAll('a.aalink[href*="mod/assign/view.php"]');
  const urls  = [];
  for (const a of links) {
    if (urls.length >= max) break;
    urls.push(a.getAttribute('href'));
  }
  return urls;
}

/**
 * Определяет семестр курса по датам из его заданий.
 *
 * Алгоритм:
 *   1. Загрузить страницу курса, найти ссылки на задания (a.aalink → mod/assign).
 *   2. Последовательно открывать страницы заданий до первого с датами.
 *   3. Взять минимальную из дат задания.
 *   4. По дате определить семестр («осень» / «весна») и учебный год.
 *
 * @param {string|number} courseId  ID курса
 * @returns {Promise<{ date: Date, semester: string, year: string } | null>}
 *   null — если в курсе нет заданий или ни в одном задании нет дат
 */
async function getCourseSemester(courseId) {
  if (!courseId) return null;

  // ── 1. Страница курса ─────────────────────────────────────────────────────
  let courseHtml;
  try {
    const resp = await fetch(
      `https://e-learning.bmstu.ru/kaluga/course/view.php?id=${courseId}`,
      { credentials: 'include' }
    );
    if (!resp.ok) return null;
    courseHtml = await resp.text();
  } catch (e) {
    console.warn('[kb_semester] ошибка загрузки страницы курса:', e);
    return null;
  }

  // ── 2. Найти ссылки на задания ────────────────────────────────────────────
  const assignUrls = _findAssignUrls(courseHtml);
  if (assignUrls.length === 0) return null;

  // ── 3. Перебрать задания до первого, в котором есть даты ─────────────────
  for (const url of assignUrls) {
    let assignHtml;
    try {
      const resp = await fetch(url, { credentials: 'include' });
      if (!resp.ok) continue;
      assignHtml = await resp.text();
    } catch (e) {
      console.warn('[kb_semester] ошибка загрузки задания:', e);
      continue;
    }

    const dates = _parseAssignDates(assignHtml);
    if (dates.length === 0) continue;

    // ── 4. Минимальная дата → семестр и учебный год ───────────────────────
    const minDate = dates.reduce((a, b) => (a <= b ? a : b));
    const semInfo = _semesterFromDate(minDate);
    if (!semInfo) continue;

    return { date: minDate, ...semInfo };
  }

  return null;
}

/**
 * Восстанавливает семестры для всех курсов с минимальным числом запросов.
 *
 * Алгоритм (divide & conquer):
 *   1. Отсортировать entries по числовому ID.
 *   2. Если оба граничных значения совпадают →
 *      заполнить весь диапазон без запросов.
 *   3. Иначе — выяснить семестр середины, параллельно рекурсировать
 *      на левую и правую половины.
 *
 * Сортировка по ID обязательна: DOM-порядок после алфавитной сортировки
 * карточек не совпадает с порядком ID.
 *
 * @param {Array<{ id: number|string, info: number|null }>} entries
 *   info — компактный код семестра (251, 252 …) или null
 * @returns {Promise<Map<number|string, number|null>>}
 *   Map id → компактный код семестра или null
 */
async function fillCourseSemesters(entries) {
  if (!entries || entries.length === 0) return new Map();

  // Сортируем по числовому ID
  const sorted = [...entries].sort((a, b) => Number(a.id) - Number(b.id));

  /** @type {Map<number|string, number|null>} */
  const cache = new Map();

  // ── 1. Заполнить кэш уже известными значениями ────────────────────────────
  for (const { id, info } of sorted) {
    if (info !== null && info !== undefined) {
      cache.set(id, info);
    }
  }
  // Захардкоженные ID всегда перезаписывают переданное значение
  for (const [hId, hOrd] of Object.entries(_HARDCODED_SEMESTERS)) {
    cache.set(hId, hOrd);
  }

  // ── Вспомогательные функции ───────────────────────────────────────────────

  // Получить код семестра по индексу: из кэша или через запрос
  async function resolve(idx) {
    const { id } = sorted[idx];
    if (cache.has(id)) return cache.get(id);
    const result = await getCourseSemester(id);
    const ord    = semesterToOrdinal(result); // null если result === null
    cache.set(id, ord);
    return ord;
  }

  // ── 2. Divide & conquer ───────────────────────────────────────────────────
  async function solve(l, r, semL, semR) {
    if (l > r) return;

    if (semL !== null && semL === semR) {
      for (let i = l; i <= r; i++) {
        const { id } = sorted[i];
        if (!cache.has(id)) cache.set(id, semL);
      }
      return;
    }

    const mid    = (l + r) >> 1;
    const semMid = await resolve(mid);

    await Promise.all([
      solve(l,       mid - 1, semL,   semMid),
      solve(mid + 1, r,       semMid, semR  ),
    ]);
  }

  await solve(0, sorted.length - 1, null, null);

  // ── 3. Предметы с неопределённым семестром ────────────────────────────────
  // Если у курса семестр не удалось определить (null), ищем ближайший
  // следующий курс (по возрастанию ID) с известным семестром.
  // Если найденный семестр уже завершён (его код < текущего), приписываем
  // неопределённый курс к этому семестру.
  const currentOrd = currentSemesterOrd();
  if (currentOrd !== null) {
    for (let i = 0; i < sorted.length; i++) {
      const { id } = sorted[i];
      if (cache.get(id) !== null) continue;

      for (let j = i + 1; j < sorted.length; j++) {
        const nextOrd = cache.get(sorted[j].id);
        if (nextOrd !== null && nextOrd !== undefined) {
          if (nextOrd < currentOrd) cache.set(id, nextOrd);
          break;
        }
      }
    }
  }

  return cache;
}

// ── Компактный код семестра ───────────────────────────────────────────────────
// Формат: YY * 10 + (осень=1, весна=2)
// Пример: осень 2025–2026 = 251, весна 2025–2026 = 252, осень 2026–2027 = 261
// Натуральный порядок чисел совпадает с хронологическим.
function semesterToOrdinal(semInfo) {
  if (typeof semInfo === 'number') return semInfo; // уже код
  if (!semInfo || !semInfo.year || !semInfo.semester) return null;
  const startYear = parseInt(semInfo.year.split('–')[0], 10);
  if (isNaN(startYear)) return null;
  return (startYear % 100) * 10 + (semInfo.semester === 'осень' ? 1 : 2);
}

// Преобразует компактный код обратно в строку для отображения
// 251 → 'Осень 2025–2026',  252 → 'Весна 2025–2026'
function ordinalToDisplay(ord) {
  if (!ord || typeof ord !== 'number') return null;
  const yy      = Math.floor(ord / 10);
  const isFall  = (ord % 10) === 1;
  const y1      = 2000 + yy;
  return `${isFall ? 'Осень' : 'Весна'} ${y1}\u2013${y1 + 1}`;
}

// Текущий семестр по системной дате (возвращает объект, затем конвертируем)
function currentSemesterOrd() {
  return semesterToOrdinal(_semesterFromDate(new Date()));
}

// ── Хранилище семестров ─────────────────────────────────────────────────────
// Ключ 'courseSemesters': { [courseId]: number }  (компактный код)
// Захардкоженные ID не пишутся в storage и не перезаписываются.

const _HARDCODED_SEMESTERS = {
  '2761': 221,
  '5407': 221,
};

async function getSavedCourseSemester(courseId) {
  if (_HARDCODED_SEMESTERS[courseId] !== undefined) return _HARDCODED_SEMESTERS[courseId];
  const map = (await adapter.get('courseSemesters')) || {};
  return map[courseId] ?? null;
}

async function saveCourseSemester(courseId, ord) {
  if (_HARDCODED_SEMESTERS[courseId] !== undefined) return; // не перезаписывать
  const map = (await adapter.get('courseSemesters')) || {};
  map[courseId] = ord;
  await adapter.set('courseSemesters', map);
}

/**
 * Сохраняет код семестра курса, оставляя минимальный из сохранённого и нового.
 * Принимает как числовой код, так и объект { semester, year }.
 * Возвращает итоговый код.
 */
async function updateCourseSemesterIfSmaller(courseId, semInfo) {
  const newOrd = semesterToOrdinal(semInfo);
  if (newOrd === null) return await getSavedCourseSemester(courseId);
  const saved  = await getSavedCourseSemester(courseId);
  if (saved === null || newOrd < saved) {
    await saveCourseSemester(courseId, newOrd);
    return newOrd;
  }
  return saved;
}

// ── Авто-скрытие устаревших предметов ───────────────────────────────────────

/**
 * При первом входе после смены семестра скрывает курсы, чей семестр
 * строго старее текущего.
 *
 * В storage под ключом 'autoHideLastRun' хранится числовой код семестра
 * (вида 251, 252 …), при котором проверка уже была выполнена.
 *
 * @param {{ [courseId]: boolean }} hiddenItems  — объект скрытий (мутирует)
 * @param {(hiddenItems) => Promise<void>}  onUpdate  — колбэк сохранения
 */
async function checkAndHideOldCourses(hiddenItems, onUpdate) {
  const currentOrd = currentSemesterOrd();
  if (!currentOrd) return;

  const lastRun = await adapter.get('autoHideLastRun');
  if (lastRun !== null && lastRun !== undefined && lastRun >= currentOrd) return;

  const semMap = (await adapter.get('courseSemesters')) || {};
  let changed  = false;

  // Учесть захардкоженные ID
  const allEntries = { ...semMap, ..._HARDCODED_SEMESTERS };

  for (const [courseId, ord] of Object.entries(allEntries)) {
    if (typeof ord !== 'number') continue;
    if (ord < currentOrd && !hiddenItems[courseId]) {
      hiddenItems[courseId] = true;
      changed = true;
    }
  }

  await adapter.set('autoHideLastRun', currentOrd);

  if (changed && typeof onUpdate === 'function') {
    await onUpdate(hiddenItems);
  }
}
