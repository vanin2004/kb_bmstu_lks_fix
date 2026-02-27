/**
 * Storage Adapter Module
 *
 * Абстрагирует работу с хранилищем браузера.
 * Поддерживает chrome.storage.local (Chrome/Edge/Yandex)
 * и browser.storage.local (Firefox).
 *
 * Для замены на кастомное API достаточно переписать только этот файл.
 */

/* global chrome, browser */

const StorageAdapter = (() => {
  /**
   * Получить нативный объект хранилища для текущего браузера.
   * @returns {chrome.storage.LocalStorageArea}
   */
  function _getApi() {
    if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
      return browser.storage.local;
    }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
    throw new Error('[CU] Storage API недоступен в этом браузере.');
  }

  /**
   * Получить последнюю ошибку из runtime (кроссбраузерно).
   * @returns {Error|null}
   */
  function _lastError() {
    try {
      if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.lastError) {
        return browser.runtime.lastError;
      }
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
        return chrome.runtime.lastError;
      }
    } catch (_) { /* ignore */ }
    return null;
  }

  /**
   * Получить значение по ключу.
   * @param {string} key
   * @returns {Promise<any>}
   */
  async function get(key) {
    const api = _getApi();
    return new Promise((resolve, reject) => {
      api.get(key, (result) => {
        const err = _lastError();
        if (err) return reject(err);
        resolve(result[key]);
      });
    });
  }

  /**
   * Сохранить значение по ключу.
   * @param {string} key
   * @param {any} value
   * @returns {Promise<void>}
   */
  async function set(key, value) {
    const api = _getApi();
    return new Promise((resolve, reject) => {
      api.set({ [key]: value }, () => {
        const err = _lastError();
        if (err) return reject(err);
        resolve();
      });
    });
  }

  /**
   * Получить несколько значений по массиву ключей.
   * @param {string[]} keys
   * @returns {Promise<Object>}
   */
  async function getMultiple(keys) {
    const api = _getApi();
    return new Promise((resolve, reject) => {
      api.get(keys, (result) => {
        const err = _lastError();
        if (err) return reject(err);
        resolve(result);
      });
    });
  }

  /**
   * Сохранить несколько пар ключ-значение за один вызов.
   * @param {Object} data  Объект { key: value, ... }
   * @returns {Promise<void>}
   */
  async function saveAll(data) {
    const api = _getApi();
    return new Promise((resolve, reject) => {
      api.set(data, () => {
        const err = _lastError();
        if (err) return reject(err);
        resolve();
      });
    });
  }

  /**
   * Удалить один или несколько ключей.
   * @param {string|string[]} keys
   * @returns {Promise<void>}
   */
  async function remove(keys) {
    const api = _getApi();
    return new Promise((resolve, reject) => {
      api.remove(keys, () => {
        const err = _lastError();
        if (err) return reject(err);
        resolve();
      });
    });
  }

  return { get, set, getMultiple, saveAll, remove };
})();
