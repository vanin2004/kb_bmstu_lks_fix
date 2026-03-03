/**
 * autologin-cas.js — автозаполнение формы входа на CAS
 *
 * Запускается при открытии страницы CAS в результате перенаправления
 * из autologin.js. Ждёт автозаполнения браузером и отправляет форму.
 *
 * Логика:
 *   1. Если на странице есть .alert-danger — выходим (ошибка аутентификации).
 *   2. Если URL содержит #kb_autologin — ждём автозаполнения браузером
 *      и отправляем форму.
 */

/**
 * Ждёт, пока браузер применит автозаполнение к полю.
 * Возвращает true если поле заполнено, false если истёк таймаут.
 */
function waitForAutofill(field, timeoutMs = 3000) {
  if (field.value) return Promise.resolve(true);

  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;

    const done = (result) => {
      clearInterval(poll);
      field.removeEventListener('input',  onEvent);
      field.removeEventListener('change', onEvent);
      resolve(result);
    };

    // Некоторые браузеры стреляют 'input' / 'change' при автозаполнении
    const onEvent = () => { if (field.value) done(true); };
    field.addEventListener('input',  onEvent);
    field.addEventListener('change', onEvent);

    // Polling на случай если событие не пришло
    const poll = setInterval(() => {
      if (field.value)        { done(true);  return; }
      if (Date.now() > deadline) { done(false); }
    }, 50);
  });
}

/**
 * Ждёт пока CAS JS сам снимет disabled с кнопки отправки.
 * Возвращает true если кнопка активирована, false если истёк таймаут.
 */
function waitForButtonEnabled(btn, timeoutMs = 2000) {
  if (!btn.disabled) return Promise.resolve(true);
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const poll = setInterval(() => {
      if (!btn.disabled)         { clearInterval(poll); resolve(true);  return; }
      if (Date.now() > deadline) { clearInterval(poll); resolve(false); }
    }, 30);
  });
}

/**
 * Отправляет форму CAS:
 *   1. Диспатчим input на полях — CAS JS увидит заполненные поля и снимет disabled.
 *   2. Ждём пока CAS JS сам включит кнопку.
 *   3. Если не включил — снимаем disabled принудительно.
 *   4. Нажимаем кнопку нативным .click().
 */
async function submitCasForm(form) {
  const btn           = form.querySelector('input[type="submit"][name="submit"], button[type="submit"]');
  const usernameField = form.querySelector('input[name="username"]');
  const passwordField = form.querySelector('input[name="password"]');

  // Триггерим CAS JS чтобы он увидел значения и снял disabled
  if (usernameField) usernameField.dispatchEvent(new Event('input', { bubbles: true }));
  if (passwordField) passwordField.dispatchEvent(new Event('input', { bubbles: true }));

  if (btn) {
    await waitForButtonEnabled(btn, 2000);
    btn.removeAttribute('disabled'); // принудительно если CAS JS не среагировал
    btn.click();
    return;
  }

  // Fallback: кнопки нет
  try { form.requestSubmit(); } catch { HTMLFormElement.prototype.submit.call(form); }
}

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
  // Если есть ошибка аутентификации — выходим
  if (document.querySelector('.alert.alert-danger')) return;

  // Заполняем форму только на первоначальной загрузке (есть фрагмент)
  if (window.location.hash !== '#kb_autologin') return;

  let cfg;
  try {
    cfg = await extAPI.storage.local.get(['autologinEnabled']);
  } catch {
    return;
  }

  if (!cfg.autologinEnabled) return;

  // Ждём автозаполнения браузером и отправляем форму
  const passwordField = document.querySelector('input[name="password"]');
  if (!passwordField) return;
  const filled = await waitForAutofill(passwordField, 3000);
  if (!filled) return; // браузер не заполнил — не отправляем пустую форму
  const form = passwordField.closest('form');
  if (!form) return;
  await submitCasForm(form);
})();
