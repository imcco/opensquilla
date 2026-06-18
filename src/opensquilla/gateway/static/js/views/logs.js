/** OpenSquilla Web UI — Log Viewer (FE-007 part 3). */

const LogsView = (() => {
  let _el = null;
  let _rpc = null;
  let _unsubs = [];
  let _intervals = [];

  // State
  const _LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'];
  // Gateway file logging defaults to DEBUG, so show DEBUG by default.
  const _DEFAULT_LEVELS = new Set(['DEBUG', 'INFO', 'WARN', 'ERROR']);
  let _activeLevels = new Set(_DEFAULT_LEVELS);
  let _allLines = [];   // All fetched log lines [{level, message, ts, raw}]
  let _cursor = 0;
  let _searchText = '';
  let _autoFollow = true;
  let _status = null;
  let _pollInFlight = false;
  let _pollErrorShown = false;

  function _ensureCss() {
    if (document.querySelector('link[data-view-css="logs"]')) return;
    const data = document.getElementById('opensquilla-data');
    const base = data?.dataset.basePath || '';
    const cssVersion = data?.dataset.version || '';
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${base}/static/css/views/logs.css${cssVersion ? '?v=' + encodeURIComponent(cssVersion) : ''}`;
    link.dataset.viewCss = 'logs';
    document.head.appendChild(link);
  }

  function render(el) {
    _el = el;
    _rpc = App.getRpc();
    _ensureCss();

    // Reset state on each render
    _allLines = [];
    _cursor = 0;
    _searchText = '';
    _autoFollow = true;
    _status = null;
    _pollInFlight = false;
    _pollErrorShown = false;
    _activeLevels = new Set(_DEFAULT_LEVELS);

    const levelChips = _LEVELS.map(l => {
      const isActive = _DEFAULT_LEVELS.has(l);
      return `<button class="lg-level-btn lg-level-btn--${l.toLowerCase()}${isActive ? ' is-active' : ''}" data-level="${l}" aria-pressed="${isActive ? 'true' : 'false'}">
        <span class="lg-level-btn__dot"></span>
        <span class="lg-level-btn__label">${l}</span>
      </button>`;
    }).join('');

    _el.innerHTML = `
      <div class="lg-stage">
        <header class="lg-stage__header">
          <div class="lg-stage__title-block">
            <span class="lg-stage__eyebrow">${I18n.t('logs.eyebrow')}</span>
            <h2 class="lg-stage__title">${I18n.t('logs.title')}</h2>
            <p class="lg-stage__subtitle">${I18n.t('logs.subtitle')}</p>
          </div>
          <div class="lg-stage__actions">
            <div class="lg-status-pills" id="logs-status-pills">
              <span class="lg-pill lg-pill--warn" title="logs.status">${I18n.t('logs.status.loading')}</span>
            </div>
            <button class="btn btn--ghost" id="logs-export" title="${I18n.t('logs.actions.export')}">
              ${icons.download()}<span>${I18n.t('logs.actions.export')}</span>
            </button>
          </div>
        </header>

        <section class="stat-row" id="stat-row"></section>

        <section class="lg-toolbar">
          <div class="lg-levels">
            <span class="lg-toolbar__label">${I18n.t('logs.levels')}</span>
            <div class="lg-levels__row" id="logs-level-chips">${levelChips}</div>
          </div>
          <div class="lg-search-wrap">
            <span class="lg-search-icon">${icons.search()}</span>
            <input class="lg-search-input" type="search" id="logs-search" aria-label="${I18n.t('logs.search.aria')}" placeholder="${I18n.t('logs.search.placeholder')}" autocomplete="off" />
          </div>
          <label class="lg-toggle">
            <input type="checkbox" id="logs-auto-follow" checked />
            <span class="lg-toggle__track"><span class="lg-toggle__thumb"></span></span>
            <span class="lg-toggle__label">${I18n.t('logs.autoFollow')}</span>
          </label>
        </section>

        <section class="lg-stream" id="logs-display-wrap">
          <div id="logs-display" class="lg-display" role="log" aria-live="polite" aria-relevant="additions text">
            <div class="lg-display__placeholder">
              <span class="lg-spinner"></span>
              ${I18n.t('logs.loading')}
            </div>
          </div>
        </section>
      </div>`;

    // Level chip toggles
    _el.querySelectorAll('.lg-level-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const level = btn.dataset.level;
        if (_activeLevels.has(level)) {
          _activeLevels.delete(level);
          btn.classList.remove('is-active');
          btn.setAttribute('aria-pressed', 'false');
        } else {
          _activeLevels.add(level);
          btn.classList.add('is-active');
          btn.setAttribute('aria-pressed', 'true');
        }
        _renderStats();
        _renderLines();
      });
    });

    _el.querySelector('#logs-search').addEventListener('input', (e) => {
      _searchText = e.target.value.toLowerCase();
      _renderLines();
    });

    _el.querySelector('#logs-auto-follow').addEventListener('change', (e) => {
      _autoFollow = e.target.checked;
      if (_autoFollow) _scrollToBottom();
    });

    _el.querySelector('#logs-export').addEventListener('click', _exportLogs);

    _loadData();

    const id = setInterval(_poll, 3000);
    _intervals.push(id);
  }

  function destroy() {
    _unsubs.forEach(fn => fn());
    _unsubs = [];
    _intervals.forEach(id => clearInterval(id));
    _intervals = [];
    _allLines = [];
    _cursor = 0;
    _pollInFlight = false;
    _pollErrorShown = false;
    _el = null;
    _rpc = null;
  }

  async function _loadData() {
    if (!_el) return;
    const rpc = _rpc;
    if (!rpc) return;
    await rpc.waitForConnection();
    if (!_el || _rpc !== rpc) return;
    _cursor = 0;
    _allLines = [];
    await _loadStatus();
    await _poll();
  }

  async function _loadStatus() {
    if (!_el) return;
    try {
      _status = await _rpc.call('logs.status', {});
    } catch {
      _status = null;
    }
    _renderStatusPills();
  }

  async function _poll() {
    if (!_el || _pollInFlight) return;
    const rpc = _rpc;
    if (!rpc) return;
    _pollInFlight = true;
    try {
      const data = await rpc.call('logs.tail', { limit: 500, cursor: _cursor, level: null });
      if (!_el || _rpc !== rpc) return;
      const lines = data.lines || data.entries || [];
      if (lines.length > 0) {
        if (data.cursor != null) {
          _cursor = data.cursor;
        } else {
          _cursor += lines.length;
        }
        lines.forEach(entry => {
          _allLines.push(_normalizeLogEntry(entry));
        });
        if (_allLines.length > 2000) _allLines = _allLines.slice(_allLines.length - 2000);
        _renderStats();
        _renderLines();
      } else if (_allLines.length === 0) {
        // Render an empty placeholder
        _renderLines();
      }
      _pollErrorShown = false;
    } catch (err) {
      if (!_pollErrorShown) {
        UI.toast(I18n.t('logs.errors.refreshFailed', { error: err?.message || I18n.t('common.unknownError') }), 'warn');
        _pollErrorShown = true;
      }
    } finally {
      _pollInFlight = false;
    }
  }

  function _normalizeLogEntry(entry) {
    if (typeof entry === 'string') {
      const line = String(entry);
      const match = String(line).match(/^(?<ts>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[,.]\d{1,6})?)\s+\[(?<bracketLevel>TRACE|DEBUG|INFO|WARNING|WARN|ERROR|CRITICAL|FATAL)\]\s*(?<message>.*)$/i);
      if (match?.groups) {
        const bracketLevel = match.groups.bracketLevel.toUpperCase();
        return {
          level: _normalizeLevel(bracketLevel),
          message: match.groups.message || line,
          ts: match.groups.ts,
          raw: line,
        };
      }
      return { level: _guessLevel(line), message: line, raw: line };
    }
    return {
      level: _normalizeLevel(entry.level || entry.lvl || 'INFO'),
      message: entry.message || entry.msg || JSON.stringify(entry),
      ts: entry.timestamp || entry.ts || null,
      raw: typeof entry.raw === 'string' ? entry.raw : JSON.stringify(entry),
    };
  }

  function _normalizeLevel(level) {
    const normalized = String(level || 'INFO').toUpperCase();
    if (normalized === 'WARNING') return 'WARN';
    if (normalized === 'CRITICAL' || normalized === 'FATAL') return 'ERROR';
    if (_LEVELS.includes(normalized)) return normalized;
    return 'INFO';
  }

  function _guessLevel(line) {
    const u = line.toUpperCase();
    const bracket = u.match(/\[(TRACE|DEBUG|INFO|WARNING|WARN|ERROR|CRITICAL|FATAL)\]/);
    if (bracket) return _normalizeLevel(bracket[1]);
    if (u.includes('CRITICAL') || u.includes('FATAL') || u.includes('ERROR')) return 'ERROR';
    if (u.includes('WARN')) return 'WARN';
    if (u.includes('INFO')) return 'INFO';
    if (u.includes('DEBUG')) return 'DEBUG';
    if (u.includes('TRACE')) return 'TRACE';
    return 'INFO';
  }

  function _renderStats() {
    const wrap = _el && _el.querySelector('#stat-row');
    if (!wrap) return;
    const total = _allLines.length;
    const errors = _allLines.filter(l => l.level === 'ERROR').length;
    const warns = _allLines.filter(l => l.level === 'WARN').length;
    const infos = _allLines.filter(l => l.level === 'INFO').length;
    const debug = _allLines.filter(l => l.level === 'DEBUG' || l.level === 'TRACE').length;
    const visible = _allLines.filter(l => _activeLevels.has(l.level) && (!_searchText || l.message.toLowerCase().includes(_searchText))).length;

    wrap.innerHTML = `
      <div class="stat stat--hero">
        <div class="stat-label">${I18n.t('logs.stats.inView')}</div>
        <div class="stat-value">${visible.toLocaleString()}</div>
        <div class="stat-hint">${I18n.t('logs.stats.loaded', { total: total.toLocaleString() })}</div>
      </div>
      <div class="stat">
        <div class="stat-label">${I18n.t('logs.stats.errors')}</div>
        <div class="stat-value">${errors}</div>
        <div class="stat-hint">${errors ? I18n.t('logs.stats.reviewNeeded') : I18n.t('logs.stats.allClear')}</div>
      </div>
      <div class="stat">
        <div class="stat-label">${I18n.t('logs.stats.warnings')}</div>
        <div class="stat-value">${warns}</div>
        <div class="stat-hint">${warns ? I18n.t('logs.stats.recentAdvisories') : I18n.t('logs.stats.none')}</div>
      </div>
      <div class="stat">
        <div class="stat-label">${I18n.t('logs.stats.infoDebug')}</div>
        <div class="stat-value mono">${infos}<span>/</span>${debug}</div>
        <div class="stat-hint">${I18n.t('logs.stats.routineOutput')}</div>
      </div>`;
  }

  function _renderStatusPills() {
    const wrap = _el && _el.querySelector('#logs-status-pills');
    if (!wrap) return;
    if (!_status) {
      wrap.innerHTML = `<span class="lg-pill lg-pill--warn" title="${I18n.t('logs.status.unavailableTitle')}">${I18n.t('logs.status.unavailable')}</span>`;
      return;
    }

    const fileLog = _status.gateway_file_log || {};
    const rawLog = _status.raw_turn_call_log || {};
    const rawDir = rawLog.directory || {};
    const diagnostics = _status.diagnostics_enabled || {};
    const fileState = fileLog.enabled ? I18n.t('logs.status.on') : I18n.t('logs.status.off');
    const rawState = rawLog.enabled ? I18n.t('logs.status.on') : I18n.t('logs.status.off');
    const rawSource = rawLog.source || 'off';
    const filePath = fileLog.path || 'debug.log';
    const rawPath = rawDir.path || '~/.opensquilla/logs';
    const diagnosticsCopy = diagnostics.detail === 'raw'
      ? I18n.t('logs.status.diagnosticsRawTitle', { source: rawSource })
      : I18n.t('logs.status.diagnosticsStandardTitle');
    const diagnosticsLabel = diagnostics.detail === 'raw'
      ? I18n.t('logs.status.diagnosticsRaw')
      : (diagnostics.effective ? I18n.t('logs.status.diagnosticsStandard') : I18n.t('logs.status.diagnosticsOff'));

    wrap.innerHTML = `
      <span class="lg-pill ${fileLog.enabled ? '' : 'lg-pill--warn'}" title="${I18n.t('logs.status.fileLogTitle', { path: _esc(filePath) })}">${I18n.t('logs.status.fileLog', { state: fileState })}</span>
      <span class="lg-pill ${rawLog.enabled ? '' : 'lg-pill--warn'}" title="${I18n.t('logs.status.rawTurnCallTitle', { source: _esc(rawSource), path: _esc(rawPath) })}">${I18n.t('logs.status.rawTurnCall', { state: rawState })}</span>
      <span class="lg-pill lg-pill--warn" title="${_esc(diagnosticsCopy)}">${I18n.t('logs.status.diagnostics', { state: diagnosticsLabel })}</span>`;
  }

  function _renderLines() {
    const display = _el && _el.querySelector('#logs-display');
    if (!display) return;

    const filtered = _allLines.filter(line => {
      if (!_activeLevels.has(line.level)) return false;
      if (_searchText && !line.message.toLowerCase().includes(_searchText)) return false;
      return true;
    });

    if (filtered.length === 0) {
      const msg = _allLines.length === 0 ? I18n.t('logs.empty.noLogs') : I18n.t('logs.empty.noMatches');
      display.innerHTML = `<div class="lg-display__placeholder">
        <span class="lg-display__placeholder-icon">${icons.logs()}</span>
        ${msg}
      </div>`;
      return;
    }

    display.innerHTML = filtered.map(line => {
      const lvl = (line.level || 'INFO').toLowerCase();
      const ts = line.ts ? `<span class="lg-line__ts">${_esc(String(line.ts).slice(0, 23))}</span>` : '<span class="lg-line__ts lg-line__ts--empty"></span>';
      const message = _highlight(line.message);
      return `<div class="lg-line lg-line--${lvl}">
        ${ts}
        <span class="lg-line__lvl lg-line__lvl--${lvl}">${_esc(line.level)}</span>
        <span class="lg-line__msg">${message}</span>
      </div>`;
    }).join('');

    if (_autoFollow) _scrollToBottom();
  }

  function _highlight(message) {
    const safe = _esc(message);
    if (!_searchText) return safe;
    const term = _searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(`(${term})`, 'gi'), '<mark class="lg-line__match">$1</mark>');
  }

  function _scrollToBottom() {
    const display = _el && _el.querySelector('#logs-display');
    if (display) display.scrollTop = display.scrollHeight;
  }

  function _exportLogs() {
    const filtered = _allLines.filter(line => {
      if (!_activeLevels.has(line.level)) return false;
      if (_searchText && !line.message.toLowerCase().includes(_searchText)) return false;
      return true;
    });
    const text = filtered.map(line => {
      const ts = line.ts ? String(line.ts).slice(0, 23) + ' ' : '';
      return `${ts}[${line.level}] ${line.message}`;
    }).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'opensquilla-logs.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  function _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { render, destroy };
})();

window.LogsView = LogsView;
