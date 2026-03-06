/**
 * autologin.js — автоматический вход через CAS
 *
 * Два сценария:
 *   1. Страница /login/index.php — сразу редиректим на CAS без проверок.
 *   2. Любая другая страница — проверяем, не вошёл ли пользователь
 *      (блок ".logininfo" содержит "Вы не вошли в систему"), и если так —
 *      редиректим на CAS.
 */
'use strict';

async function initAutologin() {
  const cfg = await adapter.getMultiple(['autologinEnabled']);
  if (!cfg.autologinEnabled) return;

  const isLoginPage = window.location.pathname.endsWith('/login/index.php');

  if (!isLoginPage) {
    // На остальных страницах проверяем, авторизован ли пользователь
    const loginInfo = document.querySelector('.logininfo');
    const isGuest = loginInfo && loginInfo.textContent.includes('Вы не вошли в систему');
    if (!isGuest) return;
  }

  // Перенаправляем на CAS — браузер заполнит учётные данные
  // через встроенный менеджер паролей.
  // Фрагмент #kb_autologin сигнализирует autologin-cas.js об автоматическом входе.
  const serviceUrl = 'https://e-learning.bmstu.ru/kaluga/login/index.php?authCAS=CAS';
  const casUrl = 'https://proxy.bmstu.ru:8443/cas/login?service=' + encodeURIComponent(serviceUrl) + '#kb_autologin';
  window.location.href = casUrl;
}
