/**
 * storage.js — StorageAdapter
 *
 * Абстракция над chrome.storage.local / browser.storage.local.
 * Позволяет в будущем заменить API хранилища без изменения остального кода.
 *
 * Использование:
 *   const val  = await storageAdapter.get('key');
 *   await storageAdapter.set('key', value);
 *   const obj  = await storageAdapter.getMultiple(['key1', 'key2']);
 *   await storageAdapter.saveAll({ key1: v1, key2: v2 });
 */

(function (global) {
  'use strict';

  /**
   * Унифицированный доступ к storage.local.
   * Firefox: browser.storage.local возвращает Promise нативно.
   * Chrome:  chrome.storage.local использует колбэки; оборачиваем в Promise.
   */
  const _storage = (function () {
    // Firefox — предпочтительный API с нативными Promise
    if (typeof browser !== 'undefined' && browser.storage) {
      return {
        get:    function (keys) { return browser.storage.local.get(keys); },
        set:    function (data) { return browser.storage.local.set(data); },
        remove: function (keys) { return browser.storage.local.remove(keys); },
      };
    }

    // Chrome (MV2 / MV3) — callback-обёртка в Promise
    return {
      get: function (keys) {
        return new Promise(function (resolve, reject) {
          chrome.storage.local.get(keys, function (result) {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(result);
            }
          });
        });
      },
      set: function (data) {
        return new Promise(function (resolve, reject) {
          chrome.storage.local.set(data, function () {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      },
      remove: function (keys) {
        return new Promise(function (resolve, reject) {
          chrome.storage.local.remove(keys, function () {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      },
    };
  })();

  // ────────────────────────────────────────────────────────────────────────────

  class StorageAdapter {
    /**
     * Получить значение по ключу.
     * @param {string} key
     * @returns {Promise<any>}
     */
    async get(key) {
      const result = await _storage.get(key);
      return result[key];
    }

    /**
     * Сохранить одно значение.
     * @param {string} key
     * @param {any} value
     * @returns {Promise<void>}
     */
    async set(key, value) {
      await _storage.set({ [key]: value });
    }

    /**
     * Получить несколько значений за один запрос.
     * @param {string[]} keys
     * @returns {Promise<Object>}  объект { key: value, … }
     */
    async getMultiple(keys) {
      return _storage.get(keys);
    }

    /**
     * Сохранить несколько значений за один запрос.
     * @param {Object} data  { key: value, … }
     * @returns {Promise<void>}
     */
    async saveAll(data) {
      await _storage.set(data);
    }

    /**
     * Удалить один или несколько ключей.
     * @param {string|string[]} keys
     * @returns {Promise<void>}
     */
    async remove(keys) {
      await _storage.remove(Array.isArray(keys) ? keys : [keys]);
    }
  }

  // Экспортируем класс и готовый экземпляр в глобальную область
  global.StorageAdapter  = StorageAdapter;
  global.storageAdapter  = new StorageAdapter();

})(typeof window !== 'undefined' ? window : this);
