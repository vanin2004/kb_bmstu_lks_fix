/**
 * autologin.js — автоматический вход через CAS
 *
 * Если включён автовход и пользователь не авторизован —
 * показывает экран загрузки и просит background.js открыть
 * скрытую вкладку CAS, которая выполняет вход и закрывается.
 * После успеха — перезагрузка текущей страницы.
 */
'use strict';

async function initAutologin() {
  const cfg = await adapter.getMultiple(['autologinEnabled', 'autologinUsername', 'autologinPassword']);

  if (!cfg.autologinEnabled || !cfg.autologinUsername || !cfg.autologinPassword) return;

  // Проверяем наличие блока "Вы не вошли в систему" в .logininfo
  const loginInfo = document.querySelector('.logininfo');
  const isGuest = loginInfo && loginInfo.textContent.includes('Вы не вошли в систему');
  if (!isGuest) return;

  // Показываем экран загрузки поверх страницы
  const overlay = _autologinCreateOverlay();
  document.body.appendChild(overlay);

  // Просим background.js открыть скрытую вкладку CAS и выполнить вход
  try {
    const response = await extAPI.runtime.sendMessage({ type: 'autologin_do_login' });

    if (response && response.success) {
      // Сессия Moodle установлена — перезагружаем текущую вкладку
      window.location.reload();
      return new Promise(() => {}); // держим оверлей до завершения перезагрузки
    } else {
      if (response?.isAuthError) {
        // Неверные учётные данные — отключаем автовход, чтобы не повторять попытки
        await adapter.set('autologinEnabled', false);
      }
      _autologinShowError(overlay, response?.error || 'Неизвестная ошибка', response?.isAuthError ?? false);
    }
  } catch (err) {
    _autologinShowError(overlay, err.message || 'Ошибка соединения');
  }
}

function _autologinCreateOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'kb-autologin-overlay';

  const isDark = document.documentElement.dataset.theme === 'dark' ||
    (document.documentElement.dataset.theme === 'system' &&
     window.matchMedia('(prefers-color-scheme: dark)').matches);

  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:99999',
    `background:${isDark ? '#1e1e2e' : '#f8f9fa'}`,
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'gap:20px',
    'font-family:inherit',
  ].join(';');

  const style = document.createElement('style');
  style.textContent = '@keyframes kb-autologin-spin{to{transform:rotate(360deg)}}';

  const spinner = document.createElement('div');
  spinner.style.cssText = [
    'width:48px',
    'height:48px',
    'border:4px solid rgba(128,128,128,.25)',
    'border-top-color:#0d6efd',
    'border-radius:50%',
    'animation:kb-autologin-spin .8s linear infinite',
  ].join(';');

  const label = document.createElement('p');
  label.style.cssText = `margin:0;font-size:1rem;color:${isDark ? '#cdd6f4' : '#212529'}`;
  label.textContent = 'Выполняется вход…';

  overlay.append(style, spinner, label);
  return overlay;
}

function _autologinShowError(overlay, message, isAuthError = false) {
  overlay.innerHTML = '';

  const isDark = document.documentElement.dataset.theme === 'dark' ||
    (document.documentElement.dataset.theme === 'system' &&
     window.matchMedia('(prefers-color-scheme: dark)').matches);

  overlay.style.gap = '12px';

  const p = document.createElement('p');
  p.style.cssText = 'margin:0;font-size:1rem;color:#dc3545;text-align:center;max-width:380px';
  p.textContent = `Ошибка автовхода: ${message}`;

  const hint = document.createElement('p');
  hint.style.cssText = `margin:0;font-size:.85rem;color:${isDark ? '#a6adc8' : '#6c757d'};text-align:center;max-width:380px`;
  hint.textContent = isAuthError
    ? 'Автовход отключён. Обновите логин и пароль в настройках расширения.'
    : 'Автовход можно снова включить в настройках расширения.';

  const btn = document.createElement('button');
  btn.textContent = 'Закрыть';
  btn.style.cssText = [
    'margin-top:4px',
    'padding:6px 20px',
    'border:1px solid rgba(128,128,128,.4)',
    'border-radius:6px',
    'background:transparent',
    `color:${isDark ? '#cdd6f4' : '#212529'}`,
    'cursor:pointer',
    'font-size:.9rem',
  ].join(';');
  btn.onclick = () => overlay.remove();

  overlay.append(p, hint, btn);
}
