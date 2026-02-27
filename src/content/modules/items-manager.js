/**
 * Items Manager Module
 *
 * Управляет видимостью карточек предметов на главной странице.
 * Работает только на главной странице (наличие #frontpage-course-list).
 *
 * Структура DOM (page_example/main.html):
 *   #frontpage-course-list
 *     .coursebox[data-courseid="XXXX"]
 *       .info
 *         h3.coursename > a.aalink   ← название
 *       .content
 */

const ItemsManager = (() => {
  const MAIN_SECTION_ID = 'frontpage-course-list';
  const COURSEBOX_SELECTOR = '#frontpage-course-list .coursebox[data-courseid]';

  // CSS-класс, добавляемый скрытым предметам в режиме редактирования
  const HIDDEN_CLASS = 'cu-hidden-item';

  // ─────────────────────────── Хелперы ───────────────────────────

  /**
   * Проверить, является ли текущая страница главной.
   * @returns {boolean}
   */
  function isMainPage() {
    return !!document.getElementById(MAIN_SECTION_ID);
  }

  /**
   * Найти ссылку с названием предмета внутри .coursebox.
   * Поддерживает разные варианты вёрстки (h3 и без h3).
   * @param {Element} box
   * @returns {Element|null}
   */
  function _getTitleLink(box) {
    return (
      box.querySelector('h3.coursename a') ||
      box.querySelector('.coursename a')
    );
  }

  // ─────────────────────────── Публичные методы ──────────────────

  /**
   * Получить список всех курсов с главной страницы.
   * @returns {Array<{id: string, title: string}>}
   */
  function getAllItems() {
    const items = [];
    document.querySelectorAll(COURSEBOX_SELECTOR).forEach((box) => {
      const id = box.dataset.courseid;
      const link = _getTitleLink(box);
      // Используем data-атрибут с оригинальным названием (если CustomizationManager уже работал)
      const title = link
        ? link.dataset.cuOriginalTitle || link.textContent.trim()
        : '';
      if (id) items.push({ id, title });
    });
    return items;
  }

  /**
   * Зарегистрировать новые предметы в объекте hiddenItems:
   * если предмет ещё не встречался — устанавливается false (видимый).
   * @param {Array<{id:string, title:string}>} items
   * @param {Object} hiddenItems  Существующий словарь { courseId: boolean }
   * @returns {Object}  Обновлённый словарь
   */
  function registerNewItems(items, hiddenItems) {
    const updated = Object.assign({}, hiddenItems);
    items.forEach(({ id }) => {
      if (!(id in updated)) {
        updated[id] = false; // по умолчанию показываем новые предметы
      }
    });
    return updated;
  }

  // ─────────────────── Обычный режим (не редактирование) ─────────

  /**
   * Скрыть/показать карточки согласно словарю hiddenItems.
   * @param {Object} hiddenItems  { courseId: true | false }
   */
  function applyVisibility(hiddenItems) {
    document.querySelectorAll(COURSEBOX_SELECTOR).forEach((box) => {
      const id = box.dataset.courseid;
      const shouldHide = hiddenItems && hiddenItems[id] === true;
      box.style.display = shouldHide ? 'none' : '';
    });
  }

  // ─────────────────── Режим редактирования ──────────────────────

  /**
   * Показать все карточки (не скрывать ни одну).
   */
  function showAll() {
    document.querySelectorAll(COURSEBOX_SELECTOR).forEach((box) => {
      box.style.display = '';
    });
  }

  /**
   * Добавить/снять CSS-класс «скрытый» для визуального отличия в режиме редактирования.
   * Сами карточки остаются видимыми (display не трогаем).
   * @param {Object} hiddenItems
   */
  function applyEditModeAppearance(hiddenItems) {
    document.querySelectorAll(COURSEBOX_SELECTOR).forEach((box) => {
      const id = box.dataset.courseid;
      const isHidden = hiddenItems && hiddenItems[id] === true;
      box.classList.toggle(HIDDEN_CLASS, isHidden);
    });
  }

  /**
   * Убрать все визуальные маркеры режима редактирования.
   */
  function removeEditModeAppearance() {
    document.querySelectorAll(COURSEBOX_SELECTOR).forEach((box) => {
      box.classList.remove(HIDDEN_CLASS);
    });
  }

  return {
    isMainPage,
    getAllItems,
    registerNewItems,
    applyVisibility,
    showAll,
    applyEditModeAppearance,
    removeEditModeAppearance,
  };
})();
