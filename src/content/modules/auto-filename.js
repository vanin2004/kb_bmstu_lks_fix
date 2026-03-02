/**
 * auto-filename.js — автозаполнение имени файла в диалоге загрузки
 *
 * Инъектирует поля «Название предмета» и «Название работы»
 * в форму загрузки файла (.fp-upload-form).
 *
 * Формат имени файла: ФамилияИО_Группа_Год_Работа_Предмет.расш
 *
 * Приоритет для поля «Предмет»:
 *   1. autoFilenameSubjects[courseId] — последний ввод пользователя для этого курса
 *   2. customTitles[courseId]         — пользовательское название курса
 *   3. Текст ссылки на курс из хлебных крошек (оригинальное название)
 */
'use strict';

const KB_AUTONAME_ID = 'kb-autoname-panel';

// ── Построение имени файла ────────────────────────────────────────────────────

function buildFilename(workTitle, subjectTitle, originalFilename) {
  const { lastname, firstname, middlename, group } = _studentInfo;
  const last  = lastname.trim();
  const initF = firstname.trim()  ? firstname.trim()[0].toUpperCase()  : '';
  const initM = middlename.trim() ? middlename.trim()[0].toUpperCase() : '';
  const fio   = last + (initF ? initF : '') + (initM ? initM: '');

  const grp  = group.trim().replace(/[\s\-]+/g, '_').toUpperCase();
  const year = String(new Date().getFullYear());
  const work = workTitle.trim().replace(/[\s\-]+/g, '_').toUpperCase();
  const subj = (subjectTitle || '').trim().replace(/[\s\-]+/g, '_').toUpperCase();

  const extMatch = originalFilename ? originalFilename.match(/(\.[^.]+)$/) : null;
  const ext = extMatch ? extMatch[1] : '';

  const parts = [fio, grp, year, work, subj].filter(Boolean);
  return parts.join('_') + ext;
}

// ── Инъекция панели в форму загрузки ─────────────────────────────────────────

function injectAutoFilenamePanel(uploadForm) {
  if (!_featureAutoFilename) return;
  if (uploadForm.querySelector('#' + KB_AUTONAME_ID)) return;

  const saveAsGroup = uploadForm.querySelector('.fp-saveas');
  const saveAsInput = uploadForm.querySelector('.fp-saveas input[name="title"]');
  const fileInput   = uploadForm.querySelector('input[type="file"]');
  if (!saveAsGroup) return;

  const courseId = getCurrentCourseId() || '';

  const panel = document.createElement('div');
  panel.id = KB_AUTONAME_ID;
  panel.className = 'kb-autoname-panel';

  // --- Строка «Название предмета»
  const subjectRow = document.createElement('div');
  subjectRow.className = 'kb-autoname-row';

  const subjectInput = document.createElement('input');
  subjectInput.type = 'text';
  subjectInput.className = 'kb-autoname-input';
  subjectInput.placeholder = 'Название предмета';
  subjectInput.value = (courseId && _autoFilenameSubjects[courseId]) || _currentCourseTitle;
  subjectInput.addEventListener('change', () => {
    if (courseId) {
      _autoFilenameSubjects[courseId] = subjectInput.value;
      adapter.set('autoFilenameSubjects', _autoFilenameSubjects);
    }
  });

  subjectRow.appendChild(subjectInput);

  // --- Строка «Название работы + Заполнить»
  const row = document.createElement('div');
  row.className = 'kb-autoname-row';

  const workInput = document.createElement('input');
  workInput.type = 'text';
  workInput.className = 'kb-autoname-input';
  workInput.placeholder = 'Название работы';

  // При выборе файла — подставить имя без расширения как название работы
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const filename = fileInput.files[0]?.name || '';
      if (filename && !workInput.value) {
        workInput.value = filename.replace(/\.[^.]+$/, '');
      }
    });
  }

  const fillBtn = document.createElement('button');
  fillBtn.type = 'button';
  fillBtn.className = 'kb-btn kb-autoname-fill-btn';
  fillBtn.textContent = 'Заполнить';
  fillBtn.addEventListener('click', () => {
    const originalName = fileInput ? fileInput.files[0]?.name || '' : '';
    const name = buildFilename(workInput.value, subjectInput.value, originalName);
    if (saveAsInput && name) {
      saveAsInput.value = name;
      // Оповестить Moodle об изменении значения (YUI может слушать input-событие)
      saveAsInput.dispatchEvent(new Event('input', { bubbles: true }));
      saveAsInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  row.appendChild(workInput);
  row.appendChild(fillBtn);
  panel.appendChild(subjectRow);
  panel.appendChild(row);

  saveAsGroup.insertAdjacentElement('beforebegin', panel);
}

// ── MutationObserver ──────────────────────────────────────────────────────────

let _autoFilenameObserver = null;

function startAutoFilenameObserver() {
  if (_autoFilenameObserver) return;

  document.querySelectorAll('.fp-upload-form').forEach(injectAutoFilenamePanel);

  _autoFilenameObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.classList && node.classList.contains('fp-upload-form')) {
          injectAutoFilenamePanel(node);
        } else {
          node.querySelectorAll('.fp-upload-form').forEach(injectAutoFilenamePanel);
        }
      }
    }
  });

  _autoFilenameObserver.observe(document.body, { childList: true, subtree: true });
}

function stopAutoFilenameObserver() {
  if (_autoFilenameObserver) {
    _autoFilenameObserver.disconnect();
    _autoFilenameObserver = null;
  }
  document.querySelectorAll('#' + KB_AUTONAME_ID).forEach(el => el.remove());
}

// ── Автодетект ФИО из шапки страницы ─────────────────────────────────────────

function extractStudentNameFromPage() {
  const link = document.querySelector('.logininfo a[href*="user/profile.php"]');
  if (!link) return null;
  const parts = link.textContent.trim().split(/\s+/);
  if (parts.length < 2) return null;
  return {
    lastname:   parts[0] || '',
    firstname:  parts[1] || '',
    middlename: parts[2] || '',
  };
}

// ── Получение названия группы со страницы профиля ────────────────────────────

async function fetchGroupFromProfile() {
  const useridEl = document.querySelector('[data-userid]');
  if (!useridEl) return null;
  const userId = useridEl.dataset.userid;
  try {
    const resp = await fetch(`/kaluga/user/profile.php?id=${userId}`);
    if (!resp.ok) return null;
    const html = await resp.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    for (const dt of doc.querySelectorAll('dt')) {
      if (dt.textContent.trim() === 'Учебная группа') {
        const dd = dt.closest('dl')?.querySelector('dd');
        if (dd) return dd.textContent.trim();
      }
    }
  } catch (e) {
    console.warn('[kb_bmstu_lks_fix] fetchGroupFromProfile:', e);
  }
  return null;
}

// ── Инициализация ─────────────────────────────────────────────────────────────

async function initAutoFilename() {
  const cfg = await adapter.getMultiple([
    'featureAutoFilename',
    'studentLastname', 'studentFirstname', 'studentMiddlename', 'studentGroup',
    'autoFilenameSubjects', 'autoGroupRefresh', 'studentGroupLastFetched',
  ]);
  _featureAutoFilename    = cfg.featureAutoFilename ?? false;
  _autoFilenameSubjects   = cfg.autoFilenameSubjects || {};
  _autoGroupRefresh       = cfg.autoGroupRefresh ?? false;
  _studentInfo.lastname   = cfg.studentLastname   ?? '';
  _studentInfo.firstname  = cfg.studentFirstname  ?? '';
  _studentInfo.middlename = cfg.studentMiddlename ?? '';
  _studentInfo.group      = cfg.studentGroup      ?? '';

  // Автодетект ФИО из шапки страницы, если поля ещё не заполнены
  if (!_studentInfo.lastname) {
    const detected = extractStudentNameFromPage();
    if (detected) {
      _studentInfo.lastname   = detected.lastname;
      _studentInfo.firstname  = detected.firstname;
      _studentInfo.middlename = detected.middlename;
      await adapter.saveAll({
        studentLastname:   detected.lastname,
        studentFirstname:  detected.firstname,
        studentMiddlename: detected.middlename,
      });
    }
  }

  // Автообновление группы — при первом входе за сутки
  if (_autoGroupRefresh) {
    const lastFetched  = cfg.studentGroupLastFetched ?? 0;
    const tenDaysMs    = 10 * 24 * 60 * 60 * 1000;
    if (Date.now() - lastFetched > tenDaysMs) {
      // Фоновый запрос — не блокирует инициализацию
      fetchGroupFromProfile().then(async group => {
        if (group && group !== _studentInfo.group) {
          _studentInfo.group = group;
          await adapter.saveAll({
            studentGroup:            group,
            studentGroupLastFetched: Date.now(),
          });
        } else if (group) {
          // Обновить время проверки даже если значение не изменилось
          await adapter.set('studentGroupLastFetched', Date.now());
        }
      });
    }
  }

  // Определить название предмета по пользовательскому (или оригинальному) названию курса
  const courseId = getCurrentCourseId();
  if (courseId) {
    const customTitlesMap = (await adapter.get('customTitles')) || {};
    if (customTitlesMap[courseId]) {
      _currentCourseTitle = customTitlesMap[courseId];
    } else {
      const courseLink = document.querySelector('#page-navbar .breadcrumb a[href*="course/view.php"]');
      _currentCourseTitle = courseLink ? courseLink.textContent.trim() : '';
    }
  }

  if (_featureAutoFilename) startAutoFilenameObserver();
}
