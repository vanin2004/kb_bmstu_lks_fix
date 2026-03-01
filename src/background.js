/**
 * background.js — Background Service Worker
 *
 * Авторизация через CAS выполняется в скрытой фоновой вкладке браузера.
 *
 * Подход:
 *   1. chrome.tabs.create({active: false}) — открываем CAS в скрытой вкладке.
 *   2. autologin-cas.js в этой вкладке заполняет форму и отправляет её.
 *   3. Браузер проходит цепочку CAS → Moodle обычной навигацией —
 *      все куки (TGT, сессия Moodle) устанавливаются корректно.
 *   4. Когда вкладка приходит на e-learning.bmstu.ru — вход завершён.
 *      Закрываем вкладку, сообщаем об успехе исходному content script.
 *   5. Content script перезагружает оригинальную вкладку — пользователь авторизован.
 *
 * Пользователь видит только оверлей «Выполняется вход…» на e-learning.
 * Вкладка CAS скрыта и никогда не становится активной.
 */

'use strict';

const _SERVICE_URL   = 'https://e-learning.bmstu.ru/kaluga/login/index.php?authCAS=CAS';
const _CAS_LOGIN_URL = 'https://proxy.bmstu.ru:8443/cas/login?service=' + encodeURIComponent(_SERVICE_URL) + '#kb_autologin';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'autologin_do_login') return;

  doLogin()
    .then(() => sendResponse({ success: true }))
    .catch((err) => sendResponse({ success: false, error: err.message, isAuthError: !!err.isAuthError }));

  return true; // держим канал открытым для async-ответа
});

function doLogin() {
  return new Promise((resolve, reject) => {
    let loginTabId  = null;

    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(onTabUpdated);
      chrome.tabs.onRemoved.removeListener(onTabRemoved);
      chrome.runtime.onMessage.removeListener(onCasError);
      if (loginTabId !== null) {
        chrome.tabs.remove(loginTabId).catch(() => {});
        loginTabId = null;
      }
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Превышено время ожидания входа'));
    }, 30_000);

    const onTabRemoved = (tabId) => {
      if (tabId !== loginTabId) return;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onTabUpdated);
      chrome.tabs.onRemoved.removeListener(onTabRemoved);
      chrome.runtime.onMessage.removeListener(onCasError);
      loginTabId = null;
      reject(new Error('Вкладка входа была закрыта'));
    };

    // Сообщение от autologin-cas.js: CAS ответил страницей с ошибкой аутентификации
    const onCasError = (msg, sender) => {
      if (msg.type !== 'autologin_cas_error') return;
      if (sender.tab?.id !== loginTabId) return;
      clearTimeout(timer);
      cleanup();
      const authErr = new Error(msg.message || 'Неверный логин или пароль');
      authErr.isAuthError = true;
      reject(authErr);
    };

    const onTabUpdated = (tabId, changeInfo, tab) => {
      if (tabId !== loginTabId) return;
      if (changeInfo.status !== 'complete') return;

      const url = tab.url ?? '';

      if (url.startsWith('https://e-learning.bmstu.ru/kaluga/')) {
        // Вкладка дошла до e-learning — вход выполнен, все куки установлены
        clearTimeout(timer);
        cleanup();
        resolve();
      }
    };

    chrome.tabs.onUpdated.addListener(onTabUpdated);
    chrome.tabs.onRemoved.addListener(onTabRemoved);
    chrome.runtime.onMessage.addListener(onCasError);

    chrome.tabs.create({ url: _CAS_LOGIN_URL, active: false })
      .then(tab => { loginTabId = tab.id; })
      .catch(err => {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onTabUpdated);
        chrome.tabs.onRemoved.removeListener(onTabRemoved);
        chrome.runtime.onMessage.removeListener(onCasError);
        reject(err);
      });
  });
}
