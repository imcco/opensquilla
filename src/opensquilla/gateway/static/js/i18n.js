/** OpenSquilla Web UI - lightweight locale runtime. */

const I18n = (() => {
  const STORAGE_KEY = 'opensquilla.locale';
  const DEFAULT_LOCALE = 'en';
  const LOCALES = window.OpenSquillaLocales || {};

  function availableLocales() {
    return Object.keys(LOCALES).sort();
  }

  function _normalize(locale) {
    if (!locale) return DEFAULT_LOCALE;
    if (LOCALES[locale]) return locale;
    const lower = String(locale).toLowerCase();
    if (lower === 'zh' || lower.startsWith('zh-cn') || lower.startsWith('zh-hans')) {
      return LOCALES['zh-CN'] ? 'zh-CN' : DEFAULT_LOCALE;
    }
    if (lower.startsWith('en')) return DEFAULT_LOCALE;
    return DEFAULT_LOCALE;
  }

  function _detect() {
    let stored = '';
    try { stored = localStorage.getItem(STORAGE_KEY) || ''; } catch {}
    if (stored) return _normalize(stored);
    try { return _normalize(navigator.language || ''); } catch {}
    return DEFAULT_LOCALE;
  }

  let _current = _detect();

  function _applyDocumentLocale() {
    document.documentElement.setAttribute('lang', _current);
  }

  function _format(template, params) {
    return String(template).replace(/\{([A-Za-z0-9_]+)\}/g, (match, name) => {
      if (!Object.prototype.hasOwnProperty.call(params, name)) return match;
      const value = params[name];
      return value == null ? '' : String(value);
    });
  }

  function t(key, params = {}) {
    const table = LOCALES[_current] || {};
    const fallback = LOCALES[DEFAULT_LOCALE] || {};
    const value = Object.prototype.hasOwnProperty.call(table, key)
      ? table[key]
      : fallback[key];
    return _format(value == null ? key : value, params);
  }

  function setLocale(locale) {
    const next = _normalize(locale);
    if (next === _current) return _current;
    _current = next;
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    _applyDocumentLocale();
    window.dispatchEvent(new CustomEvent('opensquilla:localechange', { detail: { locale: next } }));
    return _current;
  }

  function currentLocale() {
    return _current;
  }

  _applyDocumentLocale();

  window.I18n = {
    t,
    setLocale,
    currentLocale,
    availableLocales,
  };

  return window.I18n;
})();
