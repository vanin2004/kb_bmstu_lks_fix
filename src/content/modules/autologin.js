/**
 * autologin.js — автоматический вход через CAS
 *
 * Если включён автовход и пользователь не авторизован —
 * перенаправляет на страницу CAS, где браузер автоматически
 * заполнит сохранённые учётные данные.
 */
'use strict';

async function initAutologin() {
  const cfg = await adapter.getMultiple(['autologinEnabled']);

  if (!cfg.autologinEnabled) return;

  // Проверяем наличие блока "Вы не вошли в систему" в .logininfo
  const loginInfo = document.querySelector('.logininfo');
  const isGuest = loginInfo && loginInfo.textContent.includes('Вы не вошли в систему');
  if (!isGuest) return;

  // Перенаправляем на CAS — браузер заполнит учётные данные
  // через встроенный менеджер паролей
  const _SERVICE_URL = 'https://e-learning.bmstu.ru/kaluga/login/index.php?authCAS=CAS';
  const casUrl = 'https://proxy.bmstu.ru:8443/cas/login?service=' + encodeURIComponent(_SERVICE_URL) + '#kb_autologin';
  window.location.href = casUrl;
}
