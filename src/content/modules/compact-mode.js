/**
 * Compact Mode Module
 *
 * Управляет скрытием/показом глобальных блоков страницы.
 * Блоки скрываются через display:none — они не удаляются из DOM,
 * поэтому при отключении режима сразу появляются снова.
 *
 * Блоки для скрытия (по данным из page_example/main.html):
 *  1. «Информация для ознакомления для студентов и аспирантов» (courseid=2761)
 *     — запись в списке «Мои курсы»
 *  2. «Региональная научно-техническая конференция» (courseid=5407)
 *     — запись в списке «Мои курсы»
 *  3. Блок «Курсы» (#frontpage-category-combo) — нижняя часть главной страницы
 */

const CompactMode = (() => {
  /**
   * Применить или снять компактный режим.
   * @param {boolean} enabled
   */
  function apply(enabled) {
    // Добавляем/удаляем класс на html для применения стилей компактного режима
    if (enabled) {
      document.documentElement.classList.add('cu-compact-mode-active');
    } else {
      document.documentElement.classList.remove('cu-compact-mode-active');
    }
  }

  return { apply };
})();
