/**
 * autologin-cas.js — автозаполнение формы входа на CAS
 *
 * Запускается в скрытой фоновой вкладке, открытой background.js.
 * Вкладка невидима пользователю — скрывать страницу не нужно.
 *
 * Логика:
 *   1. Если на странице есть .alert-danger — передаём сообщение об ошибке
 *      в background.js и выходим. (При POST-отправке фрагмент URL теряется,
 *      поэтому проверка ошибки идёт до проверки хэша.)
 *   2. Если ошибки нет и URL содержит #kb_autologin — заполняем форму.
 */

(async () => {
  const params  = new URLSearchParams(window.location.search);
  const service = params.get('service') ?? '';
  if (!service.includes('e-learning.bmstu.ru')) return;

  const extAPI = (typeof browser !== 'undefined') ? browser : chrome;

  if (document.readyState === 'loading') {
    await new Promise(resolve =>
      document.addEventListener('DOMContentLoaded', resolve, { once: true })
    );
  }

  // Проверяем ошибку аутентификации в первую очередь.
  // При неверных учётных данных CAS возвращает 200 с той же страницей,
  // фрагмент URL при этом теряется — поэтому проверка до проверки хэша.
  const alertEl = document.querySelector('.alert.alert-danger');
  if (alertEl) {
    const message = alertEl.querySelector('span')?.textContent?.trim() || 'Неверный логин или пароль';
    extAPI.runtime.sendMessage({ type: 'autologin_cas_error', message }).catch(() => {});
    return;
  }

  // Заполняем форму только на первоначальной загрузке (есть фрагмент)
  if (window.location.hash !== '#kb_autologin') return;

  let cfg;
  try {
    cfg = await extAPI.storage.local.get(['autologinEnabled', 'autologinUsername', 'autologinPassword']);
  } catch {
    return;
  }

  if (!cfg.autologinEnabled || !cfg.autologinUsername || !cfg.autologinPassword) return;

  const usernameField = document.querySelector('input[name="username"]');
  const passwordField = document.querySelector('input[name="password"]');
  if (!usernameField || !passwordField) return;

  usernameField.value = cfg.autologinUsername;
  passwordField.value = cfg.autologinPassword;

  const form = usernameField.closest('form');
  if (!form) return;

  // form.submit может быть перекрыт <input name="submit"> внутри формы CAS.
  HTMLFormElement.prototype.submit.call(form);
})();
