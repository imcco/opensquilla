/** OpenSquilla Web UI — Main application entry point. */

// Feature flags. Defaults are baked in here; future surfaces can flip individual
// keys before app.js loads to override. tokenViz controls the floating token
// widget + per-turn savings chip. SavingsFX (popup) is independent of this flag.
window.OPENSQUILLA_FEATURES = Object.assign(
  { tokenViz: false },
  window.OPENSQUILLA_FEATURES || {}
);

const App = (() => {
  const WS_URL_KEY = 'opensquilla.wsUrl';
  const WS_TOKEN_KEY = 'opensquilla.wsToken';
  let rpc = null;
  let _sidebarUnsubs = [];

  function _basePath() {
    return document.getElementById('opensquilla-data')?.dataset.basePath || '/control';
  }

  function init() {
    Theme.init();
    rpc = new RpcClient();

    _buildLayout();
    if (window.ApprovalMonitor) ApprovalMonitor.start();
    _bindNav();
    _bindThemeToggle();
    _bindLocaleSelect();
    _bindLocaleChange();
    _bindSidebarToggle();
    _bindConnectionState();

    Router.register('/overview', (el) => _renderStandardView(OverviewView, el), () => OverviewView.destroy(), { titleKey: 'nav.overview' });
    Router.register('/health', (el) => _renderStandardView(HealthView, el), () => HealthView.destroy(), { titleKey: 'nav.health' });
    Router.register('/chat', (el) => ChatView.render(el), () => ChatView.destroy(), { titleKey: 'nav.chat' });
    Router.register('/sessions', (el) => _renderStandardView(SessionsView, el), () => SessionsView.destroy(), { titleKey: 'nav.sessions' });
    Router.register('/agents', (el) => _renderStandardView(AgentsView, el), () => AgentsView.destroy(), { titleKey: 'nav.agents' });
    Router.register('/cron', (el) => _renderStandardView(CronView, el), () => CronView.destroy(), { titleKey: 'nav.cron' });
    Router.register('/usage', (el) => _renderStandardView(UsageView, el), () => UsageView.destroy(), { titleKey: 'nav.usage' });
    Router.register('/config', (el) => _renderStandardView(ConfigView, el), () => ConfigView.destroy(), { titleKey: 'nav.config' });
    Router.register('/setup', (el) => _renderStandardView(SetupView, el), () => SetupView.destroy(), { titleKey: 'nav.setup' });
    Router.register('/channels', (el) => _renderStandardView(ChannelsView, el), () => ChannelsView.destroy(), { titleKey: 'nav.channels' });
    Router.register('/approvals', (el) => _renderStandardView(ApprovalsView, el), () => ApprovalsView.destroy(), { titleKey: 'nav.approvals' });
    Router.register('/skills', (el) => _renderStandardView(SkillsView, el), () => SkillsView.destroy(), { titleKey: 'nav.skills' });
    Router.register('/logs', (el) => _renderStandardView(LogsView, el), () => LogsView.destroy(), { titleKey: 'nav.logs' });

    Router.init(_basePath(), document.getElementById('content'));

    _autoConnect();
  }

  function _renderStandardView(view, el) {
    clearTopbarCenter();
    view.render(el);
  }

  function _buildLayout() {
    const app = document.getElementById('app');
    const basePath = _basePath();
    // Strip the build-suffix from the cache-buster version ("0.1.0+1779915602")
    // so the footer shows a stable semver. Whitelist to safe semver chars
    // before interpolating — defense in depth against a tampered data attr.
    // When the version attribute is absent or filtered to empty (no usable
    // characters), the brand-foot block is suppressed entirely so "v" alone
    // doesn't render as a broken-looking stub.
    const rawVersion = document.getElementById('opensquilla-data')?.dataset.version || '';
    const semver = (rawVersion.split('+')[0] || '').replace(/[^0-9A-Za-z.\-]/g, '').slice(0, 32);
    const navFootHTML = semver
      ? `<div class="nav-foot"><span class="nav-foot__dot" aria-hidden="true"></span><span class="nav-foot__ver">v${semver}</span></div>`
      : '';
    app.innerHTML = `
      <nav class="sidebar" id="sidebar-nav" aria-label="${I18n.t('topbar.primaryNav')}">
        <div class="nav-brand"><img class="brand-mark" src="${basePath}/static/img/opensquilla-mark.png" alt="" aria-hidden="true"><span class="nav-brand__div" aria-hidden="true"></span><span class="nav-brand__wm"><span class="nav-brand__pre">Open</span><span class="nav-brand__name">Squilla</span></span></div>
        <div class="nav-group-label">${I18n.t('nav.chatGroup')}</div>
        <a class="nav-item" href="#" data-path="/chat">${icons.chat()} ${I18n.t('nav.chat')}</a>
        <div class="nav-group-label">${I18n.t('nav.controlGroup')}</div>
        <a class="nav-item" href="#" data-path="/overview">${icons.home()} ${I18n.t('nav.overview')}</a>
        <a class="nav-item" href="#" data-path="/health">${icons.logs()} ${I18n.t('nav.health')}</a>
        <a class="nav-item" href="#" data-path="/channels">${icons.channels()} ${I18n.t('nav.channels')}</a>
        <a class="nav-item" href="#" data-path="/skills">${icons.skills()} ${I18n.t('nav.skills')}</a>
        <a class="nav-item" href="#" data-path="/sessions">${icons.sessions()} ${I18n.t('nav.sessions')}</a>
        <a class="nav-item" href="#" data-path="/agents">${icons.agents()} ${I18n.t('nav.agents')}</a>
        <a class="nav-item" href="#" data-path="/usage">${icons.usage()} ${I18n.t('nav.usage')}</a>
        <a class="nav-item" href="#" data-path="/cron">${icons.cron()} ${I18n.t('nav.cron')}</a>
        <div class="nav-group-label">${I18n.t('nav.settingsGroup')}</div>
        <a class="nav-item" href="#" data-path="/config">${icons.config()} ${I18n.t('nav.config')}</a>
        <a class="nav-item" href="#" data-path="/logs">${icons.logs()} ${I18n.t('nav.logs')}</a>
        <a class="nav-item" href="#" data-path="/approvals">${icons.approvals()} ${I18n.t('nav.approvals')} <span class="nav-badge hidden" id="approval-count">0</span></a>
        ${navFootHTML}
      </nav>
      <div class="main">
        <header class="topbar" aria-label="${I18n.t('topbar.globalStatus')}">
          <div class="topbar-left">
            <button class="btn btn--icon btn--ghost sidebar-toggle" id="sidebar-toggle" title="${I18n.t('topbar.toggleMenu')}" aria-label="${I18n.t('topbar.toggleMenu')}" aria-controls="sidebar-nav" aria-expanded="false">${icons.menu()}</button>
            <span class="conn-pill err" id="conn-pill" title="${I18n.t('connection.disconnected')}" role="status" aria-live="polite">${I18n.t('connection.disconnected')}</span>
          </div>
          <div class="topbar-center hidden" id="topbar-center"></div>
          <div class="topbar-right">
            <button class="approval-inline hidden" id="approval-inline" title="${I18n.t('topbar.openApprovals')}">${I18n.t('topbar.approvalRequired')}</button>
            <label class="locale-select-wrap" title="${I18n.t('topbar.language')}">
              <span class="sr-only">${I18n.t('topbar.language')}</span>
              <select class="locale-select" id="locale-select" aria-label="${I18n.t('topbar.language')}">
                ${I18n.availableLocales().map(locale => `<option value="${locale}"${locale === I18n.currentLocale() ? ' selected' : ''}>${_localeLabel(locale)}</option>`).join('')}
              </select>
            </label>
            <button class="btn btn--icon btn--ghost" id="theme-toggle" title="Toggle theme" aria-label="Toggle theme" aria-pressed="false">${icons.sun()}</button>
          </div>
        </header>
        <main class="content" id="content"></main>
      </div>`;
  }

  function _bindNav() {
    document.querySelectorAll('.nav-item[data-path]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        Router.navigate(el.dataset.path);
      });
    });
  }

  function _bindThemeToggle() {
    document.getElementById('theme-toggle')?.addEventListener('click', () => Theme.cycle());
  }

  function _bindLocaleSelect() {
    document.getElementById('locale-select')?.addEventListener('change', (e) => {
      I18n.setLocale(e.target.value);
    });
  }

  function _bindLocaleChange() {
    if (window.__opensquillaLocaleBound) return;
    window.__opensquillaLocaleBound = true;
    window.addEventListener('opensquilla:localechange', () => {
      _buildLayout();
      _bindNav();
      _bindThemeToggle();
      _bindLocaleSelect();
      _bindSidebarToggle();
      _bindConnectionState();
      Router.setContentElement(document.getElementById('content'));
      Theme.init();
      Router.refresh();
    });
  }

  function _localeLabel(locale) {
    if (locale === 'zh-CN') return '简体中文';
    if (locale === 'en') return 'English';
    return locale;
  }

  function _bindSidebarToggle() {
    _sidebarUnsubs.forEach(fn => fn());
    _sidebarUnsubs = [];

    const toggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (!toggle || !sidebar) return;
    const mobileQuery = window.matchMedia('(max-width: 768px)');

    const setSidebarOpen = (open) => {
      sidebar.classList.toggle('open', open);
      _syncSidebarAccessibility(sidebar, toggle, mobileQuery);
    };

    _syncSidebarAccessibility(sidebar, toggle, mobileQuery);
    const onMediaChange = () => _syncSidebarAccessibility(sidebar, toggle, mobileQuery);
    if (mobileQuery.addEventListener) {
      mobileQuery.addEventListener('change', onMediaChange);
      _sidebarUnsubs.push(() => mobileQuery.removeEventListener('change', onMediaChange));
    } else if (mobileQuery.addListener) {
      mobileQuery.addListener(onMediaChange);
      _sidebarUnsubs.push(() => mobileQuery.removeListener(onMediaChange));
    }

    const onToggleClick = (e) => {
      e.stopPropagation();
      setSidebarOpen(!sidebar.classList.contains('open'));
    };
    toggle.addEventListener('click', onToggleClick);
    _sidebarUnsubs.push(() => toggle.removeEventListener('click', onToggleClick));

    const onSidebarClick = (e) => {
      if (e.target.closest('.nav-item')) setSidebarOpen(false);
    };
    sidebar.addEventListener('click', onSidebarClick);
    _sidebarUnsubs.push(() => sidebar.removeEventListener('click', onSidebarClick));

    // Click outside the sidebar (and not on the toggle) closes the drawer.
    // The CSS backdrop is a pseudo-element that can't receive pointer events,
    // so we rely on a document-level handler instead.
    const onDocumentClick = (e) => {
      if (!sidebar.classList.contains('open')) return;
      if (sidebar.contains(e.target) || toggle.contains(e.target)) return;
      setSidebarOpen(false);
    };
    document.addEventListener('click', onDocumentClick);
    _sidebarUnsubs.push(() => document.removeEventListener('click', onDocumentClick));

    // Esc closes the drawer for keyboard users.
    const onDocumentKeydown = (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('open')) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener('keydown', onDocumentKeydown);
    _sidebarUnsubs.push(() => document.removeEventListener('keydown', onDocumentKeydown));
  }

  function _syncSidebarAccessibility(sidebar, toggle, mobileQuery) {
    const isOpen = sidebar.classList.contains('open');
    const isHiddenDrawer = mobileQuery.matches && !isOpen;
    toggle.setAttribute('aria-expanded', String(isOpen));
    if (isHiddenDrawer) {
      sidebar.setAttribute('aria-hidden', 'true');
      sidebar.setAttribute('inert', '');
      return;
    }
    sidebar.removeAttribute('aria-hidden');
    sidebar.removeAttribute('inert');
  }

  function _bindConnectionState() {
    const VARIANT = { connected: 'ok', connecting: 'warn', disconnected: 'err' };
    rpc.on('_state', (state) => {
      const pill = document.getElementById('conn-pill');
      if (!pill) return;
      const variant = VARIANT[state] || 'err';
      pill.className = `conn-pill ${variant}${variant === 'ok' ? ' compact' : ''}`;
      const label = I18n.t('connection.' + state);
      pill.textContent = label;
      pill.title = label;
    });
  }

  function _autoConnect() {
    if (!rpc || rpc.state !== 'disconnected') return;
    const { url, token } = loadConnectionSettings();
    rpc.connect(url, token || undefined);
  }

  function getDefaultRpcUrl() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/ws`;
  }

  function loadConnectionSettings() {
    let url = getDefaultRpcUrl();
    let token = '';
    try { url = localStorage.getItem(WS_URL_KEY) || url; } catch {}
    try { token = sessionStorage.getItem(WS_TOKEN_KEY) || ''; } catch {}
    return { url, token };
  }

  function getAuthToken() {
    return loadConnectionSettings().token || '';
  }

  function saveConnectionSettings(url, token) {
    try { localStorage.setItem(WS_URL_KEY, url || getDefaultRpcUrl()); } catch {}
    try {
      if (token) sessionStorage.setItem(WS_TOKEN_KEY, token);
      else sessionStorage.removeItem(WS_TOKEN_KEY);
    } catch {}
  }

  function getTopbarCenter() {
    return document.getElementById('topbar-center');
  }

  function clearTopbarCenter() {
    const slot = getTopbarCenter();
    if (!slot) return;
    slot.innerHTML = '';
    slot.classList.add('hidden');
  }

  function getRpc() { return rpc; }

  return {
    init,
    getRpc,
    getDefaultRpcUrl,
    loadConnectionSettings,
    getAuthToken,
    saveConnectionSettings,
    getTopbarCenter,
    clearTopbarCenter,
  };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
