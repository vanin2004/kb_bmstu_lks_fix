/**
 * Customization Manager Module
 *
 * Отвечает за:
 *  • Применение пользовательских названий на главной странице и странице курса
 *  • Цветные маркеры на карточках курсов
 *  • Добавление/удаление элементов управления в режиме редактирования
 */

const CustomizationManager = (() => {
  // ─── Константы ─────────────────────────────────────────────────
  const COURSEBOX_SELECTOR = '#frontpage-course-list .coursebox[data-courseid]';
  const MARKER_CLASS        = 'cu-color-marker';
  const CONTROLS_CLASS      = 'cu-edit-controls';
  const DEFAULT_COLOR       = '#4a90d9';

  // ─── Утилиты ───────────────────────────────────────────────────

  /** Получить ссылку с названием предмета внутри карточки. */
  function _getTitleLink(box) {
    return (
      box.querySelector('h3.coursename a') ||
      box.querySelector('.coursename a')
    );
  }

  /** Запомнить оригинальное название в data-атрибуте (один раз). */
  function _cacheOriginalTitle(link) {
    if (!link) return;
    if (!link.dataset.cuOriginalTitle) {
      link.dataset.cuOriginalTitle = link.textContent.trim();
    }
  }

  // ─── Названия ──────────────────────────────────────────────────

  /**
   * Применить пользовательские названия к карточкам на главной странице
   * и к заголовку/хлебным крошкам на странице курса.
   * @param {Object} customTitles  { courseId: string|null }
   */
  function applyTitles(customTitles) {
    if (!customTitles) return;

    // Главная страница — список «Мои курсы»
    document.querySelectorAll(COURSEBOX_SELECTOR).forEach((box) => {
      const id = box.dataset.courseid;
      const link = _getTitleLink(box);
      if (!link) return;

      _cacheOriginalTitle(link);
      const custom = customTitles[id];
      link.textContent = custom || link.dataset.cuOriginalTitle;
    });

    // Страница курса — заголовок h1 и хлебные крошки
    _applyTitlesOnCoursePage(customTitles);
  }

  /**
   * Заменить название на странице самого курса (только чтение, без поля ввода).
   * @param {Object} customTitles
   */
  function _applyTitlesOnCoursePage(customTitles) {
    const match = window.location.pathname.match(/\/course\/view\.php/);
    if (!match) return;

    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('id');
    if (!courseId) return;

    const custom = customTitles[courseId];
    if (!custom) return;

    // Заголовок h1 в шапке страницы
    document.querySelectorAll('#page-header h1, .page-header-headings h1').forEach((h) => {
      if (!h.dataset.cuOriginalTitle) h.dataset.cuOriginalTitle = h.textContent.trim();
      h.textContent = custom;
    });

    // Хлебные крошки — последний элемент
    const lastCrumb = document.querySelector('.breadcrumb-item:last-child .breadcrumb-item-text, .breadcrumb-item:last-child span:not(.sr-only)');
    if (lastCrumb) {
      if (!lastCrumb.dataset.cuOriginalTitle) lastCrumb.dataset.cuOriginalTitle = lastCrumb.textContent.trim();
      lastCrumb.textContent = custom;
    }
  }

  // ─── Цветные маркеры ───────────────────────────────────────────

  /**
   * Применить цвет-акцент к карточкам курсов.
   * Добавляет цветную полоску (.cu-color-marker) в начало каждой карточки,
   * не перекрашивая всю карточку целиком.
   * @param {Object} itemColors  { courseId: "#hex" }
   */
  function applyColors(itemColors) {
    if (!itemColors) return;

    document.querySelectorAll(COURSEBOX_SELECTOR).forEach((box) => {
      const id = box.dataset.courseid;
      const color = itemColors[id];

      let marker = box.querySelector(`.${MARKER_CLASS}`);

      if (color) {
        if (!marker) {
          marker = document.createElement('div');
          marker.className = MARKER_CLASS;
          box.insertBefore(marker, box.firstChild);
        }
        marker.style.backgroundColor = color;
        marker.style.display = '';
      } else if (marker) {
        marker.style.display = 'none';
      }
    });
  }

  // ─── Элементы управления редактирования ────────────────────────

  /**
   * Добавить блок редактирования на каждую карточку курса.
   * Включает: чекбокс «Скрыть», редактируемое название, выбор цвета.
   *
   * @param {Object}   customTitles   { courseId: string|null }
   * @param {Object}   itemColors     { courseId: "#hex" }
   * @param {Object}   hiddenItems    { courseId: boolean }
   * @param {Object}   callbacks
   *   @param {Function} callbacks.onHideToggle   (id, isHidden) => void
   *   @param {Function} callbacks.onTitleChange  (id, title|null) => void
   *   @param {Function} callbacks.onColorChange  (id, "#hex") => void
   */
  function addEditControls(customTitles, itemColors, hiddenItems, callbacks) {
    document.querySelectorAll(COURSEBOX_SELECTOR).forEach((box) => {
      // Не добавлять повторно
      if (box.querySelector(`.${CONTROLS_CLASS}`)) return;

      const id = box.dataset.courseid;
      const link = _getTitleLink(box);
      _cacheOriginalTitle(link);

      const originalTitle = link ? link.dataset.cuOriginalTitle : '';
      const currentTitle  = (customTitles && customTitles[id]) || originalTitle;
      const currentColor  = (itemColors && itemColors[id]) || DEFAULT_COLOR;
      const isHidden      = !!(hiddenItems && hiddenItems[id]);

      // ── Создать маркер цвета, если не существует ──
      let marker = box.querySelector(`.${MARKER_CLASS}`);
      if (!marker) {
        marker = document.createElement('div');
        marker.className = MARKER_CLASS;
        box.insertBefore(marker, box.firstChild);
      }
      marker.style.backgroundColor = currentColor;
      marker.style.display = '';
      marker.classList.add('cu-marker-editable');
      marker.title = 'Нажмите для изменения цвета';

      // ── Блок элементов управления ──
      const controls = document.createElement('div');
      controls.className = CONTROLS_CLASS;
      controls.innerHTML = `
        <div class="cu-ctrl-row cu-ctrl-top">
          <label class="cu-hide-label" title="Скрыть предмет в обычном режиме">
            <input type="checkbox" class="cu-hide-cb" ${isHidden ? 'checked' : ''}>
            <span>Скрыть</span>
          </label>
          <span class="cu-original-name">${originalTitle}</span>
        </div>
        <div class="cu-ctrl-row cu-ctrl-bottom">
          <input type="color" class="cu-color-input" value="${currentColor}" title="Цвет маркера">
          <input type="text"
                 class="cu-title-input"
                 value="${currentTitle}"
                 placeholder="Отображаемое название..."
                 title="Отображаемое название (пусто = оригинал)">
        </div>
      `;

      box.appendChild(controls);

      // ── Цвет: маркер открывает color-picker ──
      const colorInput = controls.querySelector('.cu-color-input');

      marker.addEventListener('click', () => colorInput.click());

      colorInput.addEventListener('input', (e) => {
        const col = e.target.value;
        marker.style.backgroundColor = col;
        if (callbacks.onColorChange) callbacks.onColorChange(id, col);
      });

      // ── Чекбокс «Скрыть» ──
      const hideCb = controls.querySelector('.cu-hide-cb');
      hideCb.addEventListener('change', (e) => {
        box.classList.toggle('cu-hidden-item', e.target.checked);
        if (callbacks.onHideToggle) callbacks.onHideToggle(id, e.target.checked);
      });

      // ── Поле названия ──
      const titleInput = controls.querySelector('.cu-title-input');
      titleInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (link) link.textContent = val || originalTitle;
        if (callbacks.onTitleChange) callbacks.onTitleChange(id, val || null);
      });
    });
  }

  /**
   * Удалить все блоки редактирования с карточек.
   */
  function removeEditControls() {
    document.querySelectorAll(`.${CONTROLS_CLASS}`).forEach((el) => el.remove());
    document.querySelectorAll(`.${MARKER_CLASS}.cu-marker-editable`).forEach((m) => {
      m.classList.remove('cu-marker-editable');
      m.title = '';
    });
  }

  return {
    applyTitles,
    applyColors,
    addEditControls,
    removeEditControls,
  };
})();
