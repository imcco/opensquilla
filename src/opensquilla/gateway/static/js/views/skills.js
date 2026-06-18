/** OpenSquilla Web UI — Skills Management view. */

const SkillsView = (() => {
  let _el = null;
  let _rpc = null;
  let _unsubs = [];
  let _intervals = [];
  let _allSkills = [];
  let _proposals = [];
  let _autoEnabledSkills = [];
  let _proposalsSettings = {
    available: false,
    enabled: false,
    on_dream_complete: false,
    auto_enable: false,
    auto_enable_max_risk: 'low',
  };
  let _filterText = '';
  let _statusFilter = 'all';
  let _activeTab = 'installed';

  const _LAYER_ORDER = ['workspace', 'bundled', 'managed', 'personal', 'project', 'extra'];

  function _ensureCss() {
    if (document.querySelector('link[data-view-css="skills"]')) return;
    const data = document.getElementById('opensquilla-data');
    const base = data?.dataset.basePath || '';
    const cssVersion = data?.dataset.version || '';
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${base}/static/css/views/skills.css${cssVersion ? '?v=' + encodeURIComponent(cssVersion) : ''}`;
    link.dataset.viewCss = 'skills';
    document.head.appendChild(link);
  }

  function render(el) {
    _el = el;
    _rpc = App.getRpc();
    _ensureCss();

    _el.innerHTML = `
      <div class="sk-stage">
        <header class="sk-stage__header">
          <div class="sk-stage__title-block">
            <span class="sk-stage__eyebrow">${I18n.t('skills.eyebrow')}</span>
            <h2 class="sk-stage__title">${I18n.t('skills.title')}</h2>
            <p class="sk-stage__subtitle">${I18n.t('skills.subtitle')}</p>
          </div>
          <div class="sk-stage__actions">
            <div class="sk-search-wrap" id="sk-search-wrap">
              <span class="sk-search-icon">${icons.search()}</span>
              <input class="sk-search-input" type="search" id="skills-filter" placeholder="${_escAttr(I18n.t('skills.search.placeholder'))}" autocomplete="off" />
            </div>
            <button class="btn btn--ghost" id="skills-refresh" title="${_escAttr(I18n.t('skills.actions.refresh'))}">
              ${icons.refresh()}<span>${I18n.t('skills.actions.refresh')}</span>
            </button>
          </div>
        </header>

        <section class="sk-stats" id="sk-stats"></section>

        <div class="sk-tabs" role="group" aria-label="${_escAttr(I18n.t('skills.tabs.ariaSource'))}">
          <button class="sk-tab is-active" data-tab="installed" aria-pressed="true">${icons.skills()}<span>${I18n.t('skills.tabs.installed')}</span></button>
          <button class="sk-tab" data-tab="registry" aria-pressed="false">${icons.download()}<span>${I18n.t('skills.tabs.community')}</span></button>
        </div>

        <div id="skills-tab-installed" class="sk-panel">
          <div id="skills-installed-wrap"></div>
        </div>
        <div id="skills-tab-registry" class="sk-panel" hidden>
          <div class="sk-registry">
            <div class="sk-registry__head">
              <div class="sk-search-wrap sk-search-wrap--lg">
                <span class="sk-search-icon">${icons.search()}</span>
                <input class="sk-search-input sk-search-input--lg" type="search" id="skills-registry-search" placeholder="${_escAttr(I18n.t('skills.registry.searchPlaceholder'))}" autocomplete="off" />
              </div>
              <button class="btn btn--primary" id="skills-registry-search-btn">${I18n.t('skills.registry.searchButton')}</button>
            </div>
            <div class="sk-github-install">
              <div class="sk-search-wrap sk-search-wrap--lg">
                <span class="sk-search-icon">${icons.download()}</span>
                <input class="sk-search-input sk-search-input--lg" type="url" id="skills-github-url" placeholder="${_escAttr(I18n.t('skills.registry.githubPlaceholder'))}" autocomplete="off" />
              </div>
              <button class="btn btn--primary" id="skills-github-install">${I18n.t('skills.actions.installGithub')}</button>
            </div>
            <div id="skills-registry-results" class="sk-registry__results">
              <div class="sk-registry__hint">
                <div class="sk-registry__hint-icon">${icons.skills()}</div>
                <p>${I18n.t('skills.registry.hint.search')}</p>
                <p class="sk-dim">${I18n.t('skills.registry.hint.direct')}</p>
              </div>
            </div>
          </div>
        </div>

        <dialog id="skill-detail-dialog" class="sk-dialog">
          <div id="skill-detail-body"></div>
        </dialog>
      </div>`;

    // Dialog backdrop click → close (attach once, not per-open)
    const _dlg = _el.querySelector('#skill-detail-dialog');
    if (_dlg) {
      _dlg.addEventListener('click', (e) => {
        if (e.target === _dlg) _dlg.close();
      });
    }

    const _filterInput = _el.querySelector('#skills-filter');
    const _searchWrap = _el.querySelector('#sk-search-wrap');
    _el.querySelectorAll('.sk-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        _activeTab = btn.dataset.tab;
        _el.querySelectorAll('.sk-tab').forEach(b => {
          const active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        _el.querySelectorAll('.sk-panel').forEach(p => { p.hidden = true; });
        const panel = _el.querySelector('#skills-tab-' + btn.dataset.tab);
        if (panel) panel.hidden = false;
        if (_searchWrap) _searchWrap.style.visibility = btn.dataset.tab === 'installed' ? '' : 'hidden';
      });
    });

    _el.querySelector('#skills-refresh').addEventListener('click', _loadData);

    _filterInput.addEventListener('input', () => {
      _filterText = _filterInput.value.toLowerCase();
      _renderCards();
    });

    // Registry search
    const searchBtn = _el.querySelector('#skills-registry-search-btn');
    const searchInput = _el.querySelector('#skills-registry-search');
    const githubBtn = _el.querySelector('#skills-github-install');
    const githubInput = _el.querySelector('#skills-github-url');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => _searchRegistry(searchInput.value));
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') _searchRegistry(searchInput.value);
      });
    }
    if (githubBtn && githubInput) {
      githubBtn.addEventListener('click', () => {
        if (githubInput.value.trim()) _installSkill(githubInput.value.trim(), 'github', githubBtn);
      });
      githubInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && githubInput.value.trim()) _installSkill(githubInput.value.trim(), 'github', githubBtn);
      });
    }

    // Delegate install / uninstall / card / status-filter / deps-install clicks
    _el.addEventListener('click', (e) => {
      const installBtn = e.target.closest('[data-install]');
      if (installBtn) {
        _installSkill(installBtn.dataset.install, installBtn.dataset.source || 'clawhub', installBtn);
        return;
      }
      const uninstallBtn = e.target.closest('[data-uninstall]');
      if (uninstallBtn) {
        _uninstallSkill(uninstallBtn.dataset.uninstall, uninstallBtn);
        return;
      }
      const statusPill = e.target.closest('[data-status-filter]');
      if (statusPill) {
        const v = statusPill.dataset.statusFilter;
        if (v === 'proposals') {
          // Proposals tile: not a real filter — scroll to the section.
          const target = _el.querySelector('.sk-group--proposals');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        _statusFilter = v;
        _renderStats();
        _renderCards();
        return;
      }
      const depsBtn = e.target.closest('[data-install-deps-name]');
      if (depsBtn) {
        _installDeps(depsBtn.dataset.installDepsName, depsBtn.dataset.installDepsId, depsBtn);
        return;
      }
      const propShow = e.target.closest('[data-proposal-show]');
      if (propShow) { _showProposal(propShow.dataset.proposalShow); return; }
      const apToggle = e.target.closest('[data-ap-toggle]');
      if (apToggle) {
        // Fires on the checkbox click; the new checked state is already
        // reflected in apToggle.checked.
        _toggleAutoPropose(apToggle.dataset.apToggle, apToggle.checked, apToggle);
        return;
      }
      const propAccept = e.target.closest('[data-proposal-accept]');
      if (propAccept) { _acceptProposal(propAccept.dataset.proposalAccept); return; }
      const propReject = e.target.closest('[data-proposal-reject]');
      if (propReject) { _rejectProposal(propReject.dataset.proposalReject); return; }
      const autoDisable = e.target.closest('[data-auto-enabled-disable]');
      if (autoDisable) { _disableAutoEnabled(autoDisable.dataset.autoEnabledDisable); return; }
      const card = e.target.closest('[data-skill-card]');
      if (card) {
        const skill = _allSkills.find(s => s.name === card.dataset.skillCard);
        if (skill) _openSkillDialog(skill);
      }
    });

    _el.addEventListener('change', (e) => {
      const apRisk = e.target.closest('[data-ap-risk-select]');
      if (apRisk) {
        _setAutoEnableRisk(apRisk.value, apRisk);
      }
    });

    _loadData();
  }

  function destroy() {
    _unsubs.forEach(fn => fn());
    _unsubs = [];
    _intervals.forEach(id => clearInterval(id));
    _intervals = [];
    _allSkills = [];
    _el = null;
    _rpc = null;
  }

  async function _loadData() {
    if (!_el) return;
    await _rpc.waitForConnection();
    try {
      const data = await _rpc.call('skills.list');
      _allSkills = data.skills || [];
      await _loadProposals();
      _renderStats();
      _renderCards();
    } catch (err) {
      const wrap = _el && _el.querySelector('#skills-installed-wrap');
      if (wrap) {
        wrap.innerHTML = `<div class="sk-error">${_esc(I18n.t('skills.errors.loadFailed', { error: err.message }))}</div>`;
      }
    }
  }

  async function _loadProposals() {
    // Path 3: meta-skill-creator's pending proposal queue. Best-effort —
    // if the gateway is too old to expose the RPC method, fall through
    // with an empty list and the skills view continues to function.
    try {
      const data = await _rpc.call('exec.proposals.list');
      _proposals = (data && data.proposals) || [];
    } catch {
      _proposals = [];
    }
    try {
      const data = await _rpc.call('exec.proposals.auto_enabled.list');
      _autoEnabledSkills = (data && data.skills) || [];
    } catch {
      _autoEnabledSkills = [];
    }
    try {
      const settings = await _rpc.call('exec.proposals.settings.get');
      _proposalsSettings = settings || _proposalsSettings;
    } catch {
      _proposalsSettings = {
        available: false,
        enabled: false,
        on_dream_complete: false,
        auto_enable: false,
        auto_enable_max_risk: 'low',
      };
    }
  }

  async function _toggleAutoPropose(key, value, button) {
    if (button) button.disabled = true;
    try {
      const out = await _rpc.call('exec.proposals.settings.set', { [key]: value });
      if (out && out.status === 'error') {
        UI.toast(I18n.t('skills.feedback.settingsUpdateFailed', {
          error: out.reason || I18n.t('common.unknownError'),
        }), 'err');
        return;
      }
      _proposalsSettings = (out && out.settings) || _proposalsSettings;
      _renderStats();
      _renderCards();
    } catch (err) {
      UI.toast(I18n.t('skills.feedback.settingsUpdateFailed', { error: err.message }), 'err');
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function _setAutoEnableRisk(value, select) {
    if (select) select.disabled = true;
    try {
      const out = await _rpc.call('exec.proposals.settings.set', { auto_enable_max_risk: value });
      if (out && out.status === 'error') {
        UI.toast(I18n.t('skills.feedback.settingsUpdateFailed', {
          error: out.reason || I18n.t('common.unknownError'),
        }), 'err');
        return;
      }
      _proposalsSettings = (out && out.settings) || _proposalsSettings;
      _renderCards();
    } catch (err) {
      UI.toast(I18n.t('skills.feedback.settingsUpdateFailed', { error: err.message }), 'err');
    } finally {
      if (select) select.disabled = false;
    }
  }

  function _renderStats() {
    if (!_el) return;
    const wrap = _el.querySelector('#sk-stats');
    if (!wrap) return;

    const total = _allSkills.length;
    const ready = _allSkills.filter(s => s.status === 'ready').length;
    const needs = _allSkills.filter(s => s.status === 'needs_setup').length;
    const notDeclared = _allSkills.filter(s => s.status === 'not_declared').length;
    const layers = new Set();
    _allSkills.forEach(s => { if (s.layer) layers.add(s.layer); });

    const tile = (key, label, value, hint, mods = '', title = '') => {
      const active = _statusFilter === key;
      return `<button class="sk-stat ${mods}${active ? ' is-active' : ''}" data-status-filter="${key}" type="button"${title ? ` title="${_escAttr(title)}"` : ''}>
        <div class="sk-stat__label">${label}</div>
        <div class="sk-stat__value">${value}</div>
        <div class="sk-stat__hint">${hint}</div>
      </button>`;
    };

    const proposalsCount = _proposals.length;
    const proposalsTile = proposalsCount > 0
      ? `<button class="sk-stat sk-stat--proposals${_statusFilter === 'proposals' ? ' is-active' : ''}" data-status-filter="proposals" type="button" title="${_escAttr(I18n.t('skills.proposals.pendingTitle'))}">
          <div class="sk-stat__label">${I18n.t('skills.proposals.pending')}</div>
          <div class="sk-stat__value"><span class="sk-stat__warn">${proposalsCount}</span></div>
          <div class="sk-stat__hint">${I18n.t('skills.proposals.awaiting')}</div>
        </button>`
      : '';

    wrap.innerHTML = `
      ${tile('all', I18n.t('skills.stats.all'), total, I18n.t('skills.stats.layers', {
        count: layers.size,
        noun: I18n.t(layers.size === 1 ? 'skills.stats.layerSingular' : 'skills.stats.layerPlural'),
      }), 'sk-stat--accent')}
      ${tile('ready', I18n.t('skills.stats.ready'), `<span class="sk-stat__ok">${ready}</span>`, ready ? I18n.t('skills.stats.readyHint') : I18n.t('skills.stats.noneReady'))}
      ${tile('needs-setup', I18n.t('skills.stats.needsSetup'), `<span class="sk-stat__warn">${needs}</span>`, needs ? I18n.t('skills.stats.awaitingDeps') : I18n.t('skills.stats.allSet'))}
      ${tile('not-declared', I18n.t('skills.stats.notDeclared'), notDeclared, I18n.t('skills.stats.noManifest'))}
      ${proposalsTile}
    `;
  }

  function _renderCards() {
    if (!_el) return;
    const wrap = _el.querySelector('#skills-installed-wrap');
    if (!wrap) return;

    let skills = _allSkills;
    if (_filterText) {
      skills = skills.filter(s =>
        (s.name || '').toLowerCase().includes(_filterText) ||
        (s.description || '').toLowerCase().includes(_filterText) ||
        (s.triggers || []).some(t => t.toLowerCase().includes(_filterText))
      );
    }
    if (_statusFilter === 'ready') {
      skills = skills.filter(s => s.status === 'ready');
    } else if (_statusFilter === 'needs-setup') {
      skills = skills.filter(s => s.status === 'needs_setup');
    } else if (_statusFilter === 'not-declared') {
      skills = skills.filter(s => s.status === 'not_declared');
    }

    if (skills.length === 0) {
      const msg = _filterText
        ? I18n.t('skills.empty.filtered', { query: _filterText })
        : _statusFilter === 'ready'
          ? I18n.t('skills.empty.noneReady')
          : _statusFilter === 'needs-setup'
            ? I18n.t('skills.empty.noneNeedsSetup')
            : _statusFilter === 'not-declared'
              ? I18n.t('skills.empty.noneNotDeclared')
              : I18n.t('skills.empty.noInstalled');
      wrap.innerHTML = `<div class="state">
        <div class="state-icon">${icons.skills()}</div>
        <p class="state-text">${_esc(msg)}</p>
      </div>`;
      return;
    }

    const _rank = (s) => {
      if (s.status === 'ready') return 0;
      if (s.status === 'not_declared') return 1;
      return 2;
    };

    // Bucket: meta-skills (kind in {"meta", "meta_sop"}) get a dedicated
    // top-level group; everything else falls back to the layer-based
    // grouping. Meta-skills are conceptually different (they orchestrate
    // sub-skills) and deserve a separate visual lane.
    const metaList = [];
    const groups = {};
    skills.forEach(s => {
      const kind = s.kind || 'skill';
      if (kind === 'meta' || kind === 'meta_sop') {
        metaList.push(s);
        return;
      }
      const l = s.layer || 'extra';
      (groups[l] = groups[l] || []).push(s);
    });

    const _sortByReady = (list) => list.sort((a, b) => {
      const ra = _rank(a);
      const rb = _rank(b);
      if (ra !== rb) return ra - rb;
      return (a.name || '').localeCompare(b.name || '');
    });
    _sortByReady(metaList);
    Object.values(groups).forEach(_sortByReady);

    let html = '';

    // Auto-propose settings (always rendered when runtime is available
    // — even if there are no pending proposals — so the operator can
    // turn the feature on in the first place from a clean state).
    if (_proposalsSettings && _proposalsSettings.available) {
      html += _renderAutoProposeSettings();
    }

    // Pending proposals come below the settings. Path 3 of the
    // auto-propose feature — `meta-skill-creator` writes proposals
    // here when the cron job or dream-hook fires.
    if (_proposals.length) {
      html += `<details class="sk-group sk-group--proposals" open>
        <summary class="sk-group__head">
          <span class="sk-group__caret">▾</span>
          <span class="sk-group__label">${I18n.t('skills.proposals.pending')}</span>
          <span class="sk-group__count">${_proposals.length}</span>
          <span class="sk-group__meta">${I18n.t('skills.proposals.pendingMeta')}</span>
        </summary>
        <div class="sk-proposals-list">
          ${_proposals.map(_renderProposalRow).join('')}
        </div>
      </details>`;
    }

    if (_autoEnabledSkills.length) {
      html += `<details class="sk-group sk-group--proposals" open>
        <summary class="sk-group__head">
          <span class="sk-group__caret">▾</span>
          <span class="sk-group__label">${I18n.t('skills.proposals.autoEnabled')}</span>
          <span class="sk-group__count">${_autoEnabledSkills.length}</span>
          <span class="sk-group__meta">${I18n.t('skills.proposals.autoEnabledMeta')}</span>
        </summary>
        <div class="sk-proposals-list">
          ${_autoEnabledSkills.map(_renderAutoEnabledRow).join('')}
        </div>
      </details>`;
    }

    // Meta-skills group first (if any). Different summary styling so the
    // user instantly sees "this is the high-level orchestrators bucket".
    if (metaList.length) {
      html += `<details class="sk-group sk-group--meta" open>
        <summary class="sk-group__head">
          <span class="sk-group__caret">▾</span>
          <span class="sk-group__label">${I18n.t('skills.meta.title')}</span>
          <span class="sk-group__count">${metaList.length}</span>
          <span class="sk-group__meta">${I18n.t('skills.meta.subtitle')}</span>
        </summary>
        <div class="sk-grid">
          ${metaList.map(_renderCard).join('')}
        </div>
      </details>`;
    }

    _LAYER_ORDER.forEach(layer => {
      const list = groups[layer];
      if (!list || list.length === 0) return;
      html += `<details class="sk-group" open>
        <summary class="sk-group__head">
          <span class="sk-group__caret">▾</span>
          <span class="sk-group__label">${_esc(_layerLabel(layer))}</span>
          <span class="sk-group__count">${list.length}</span>
          <span class="sk-group__meta">${_esc(_layerHelp(layer))}</span>
        </summary>
        <div class="sk-grid">
          ${list.map(_renderCard).join('')}
        </div>
      </details>`;
    });

    wrap.innerHTML = html;
  }

  function _renderAutoProposeSettings() {
    const s = _proposalsSettings || {};
    const cronChecked = s.enabled ? 'checked' : '';
    const dreamChecked = s.on_dream_complete ? 'checked' : '';
    const autoEnableChecked = s.auto_enable ? 'checked' : '';
    const cronExpr = _esc(s.cron || '0 5 * * *');
    const statusOn = s.enabled || s.on_dream_complete || s.auto_enable;
    const maxRisk = _esc(s.auto_enable_max_risk || 'low');
    const riskOption = (value, label) => `<option value="${value}" ${maxRisk === value ? 'selected' : ''}>${label}</option>`;
    return `<details class="sk-group sk-group--ap-settings" ${statusOn ? 'open' : ''}>
      <summary class="sk-group__head">
        <span class="sk-group__caret">▾</span>
        <span class="sk-group__label">${I18n.t('skills.autoPropose.title')}</span>
        <span class="sk-group__count">${I18n.t(statusOn ? 'skills.common.on' : 'skills.common.off')}</span>
        <span class="sk-group__meta">${I18n.t('skills.autoPropose.subtitle')}</span>
      </summary>
      <div class="sk-ap-settings">
        <label class="sk-ap-toggle">
          <input type="checkbox" data-ap-toggle="enabled" ${cronChecked} />
          <span class="sk-ap-toggle__label">${I18n.t('skills.autoPropose.scheduled')}</span>
          <span class="sk-ap-toggle__hint">${I18n.t('skills.autoPropose.scheduledHint', { cron: cronExpr })}</span>
        </label>
        <label class="sk-ap-toggle">
          <input type="checkbox" data-ap-toggle="on_dream_complete" ${dreamChecked} />
          <span class="sk-ap-toggle__label">${I18n.t('skills.autoPropose.dream')}</span>
          <span class="sk-ap-toggle__hint">${I18n.t('skills.autoPropose.dreamHint')}</span>
        </label>
        <label class="sk-ap-toggle">
          <input type="checkbox" data-ap-toggle="auto_enable" ${autoEnableChecked} />
          <span class="sk-ap-toggle__label">${I18n.t('skills.autoPropose.autoEnable')}</span>
          <span class="sk-ap-toggle__hint">${I18n.t('skills.autoPropose.autoEnableHint', { risk: maxRisk })}</span>
        </label>
        <label class="sk-ap-toggle">
          <span class="sk-ap-toggle__label">${I18n.t('skills.autoPropose.riskCeiling')}</span>
          <select class="sk-ap-select" data-ap-risk-select>
            ${riskOption('low', I18n.t('skills.risk.low'))}
            ${riskOption('medium', I18n.t('skills.risk.medium'))}
            ${riskOption('high', I18n.t('skills.risk.high'))}
          </select>
          <span class="sk-ap-toggle__hint">${I18n.t('skills.autoPropose.riskHint')}</span>
        </label>
      </div>
    </details>`;
  }

  function _renderProposalRow(p) {
    const pid = _esc(p.proposal_id || '');
    const eligibleBadge = p.auto_enable_eligible
      ? `<span class="sk-prop-chip sk-prop-chip--ok">${I18n.t('skills.proposals.gatesOk')}</span>`
      : `<span class="sk-prop-chip sk-prop-chip--warn">${I18n.t('skills.proposals.gatesFail')}</span>`;
    const autoChip = (typeof p.triggered_by === 'string' && p.triggered_by.startsWith('auto_'))
      ? `<span class="sk-prop-chip sk-prop-chip--auto" title="${_escAttr(I18n.t('skills.proposals.autoGeneratedBy', { trigger: p.triggered_by }))}">${I18n.t('skills.proposals.autoTag')}</span>`
      : '';
    const autoDecision = p.auto_enable && p.auto_enable.status
      ? `<span class="sk-prop-chip sk-prop-chip--warn" title="${_esc(p.auto_enable.reason || '')}">${_esc(I18n.t('skills.proposals.autoEnableStatus', { status: p.auto_enable.status }))}</span>`
      : '';
    const profile = p.auto_enable && p.auto_enable.validation_profile
      ? `<span class="sk-prop-chip" title="${_escAttr(I18n.t('skills.proposals.validationProfileTitle'))}">${_esc(p.auto_enable.validation_profile)}</span>`
      : '';
    const chainHint = p.chain_hash
      ? `<span class="sk-prop-hash" title="${_escAttr(I18n.t('skills.proposals.chainHashTitle'))}">${_esc(String(p.chain_hash).slice(0, 8))}</span>`
      : '';
    return `<div class="sk-proposal-row" data-proposal-id="${pid}">
      <div class="sk-proposal-row__head">
        <code class="sk-proposal-row__id">${pid}</code>
        ${eligibleBadge}
        ${autoChip}
        ${autoDecision}
        ${profile}
        ${chainHint}
      </div>
      <div class="sk-proposal-row__actions">
        <button class="btn btn--ghost btn--sm" data-proposal-show="${pid}" type="button">${I18n.t('skills.actions.show')}</button>
        <button class="btn btn--primary btn--sm" data-proposal-accept="${pid}" type="button">${I18n.t('skills.actions.accept')}</button>
        <button class="btn btn--ghost btn--sm" data-proposal-reject="${pid}" type="button">${I18n.t('skills.actions.reject')}</button>
      </div>
    </div>`;
  }

  function _renderAutoEnabledRow(s) {
    const name = _esc(s.name || '');
    const risk = _esc(s.risk_level || 'unknown');
    const source = _esc(s.triggered_by || 'unknown');
    const profile = _esc(s.validation_profile || 'unknown');
    const skills = Array.isArray(s.skills) && s.skills.length
      ? `<span class="sk-prop-chip" title="${_escAttr(I18n.t('skills.proposals.referencedSkillsTitle'))}">${s.skills.slice(0, 4).map(_esc).join(', ')}</span>`
      : '';
    const pid = s.proposal_id ? `<span class="sk-prop-hash" title="${_escAttr(I18n.t('skills.proposals.proposalIdTitle'))}">${_esc(String(s.proposal_id))}</span>` : '';
    return `<div class="sk-proposal-row" data-auto-enabled="${name}">
      <div class="sk-proposal-row__head">
        <code class="sk-proposal-row__id">${name}</code>
        <span class="sk-prop-chip sk-prop-chip--ok">${I18n.t('skills.proposals.enabled')}</span>
        <span class="sk-prop-chip sk-prop-chip--auto">${source}</span>
        <span class="sk-prop-chip">${_esc(I18n.t('skills.proposals.riskChip', { risk }))}</span>
        <span class="sk-prop-chip">${profile}</span>
        ${skills}
        ${pid}
      </div>
      <div class="sk-proposal-row__actions">
        <button class="btn btn--ghost btn--sm" data-auto-enabled-disable="${name}" type="button">${I18n.t('skills.actions.disable')}</button>
      </div>
    </div>`;
  }

  function _renderAutoEnableAudit(audit) {
    if (!audit || !audit.status) {
      return `<div class="sk-audit-empty">${I18n.t('skills.audit.none')}</div>`;
    }
    const list = (items) => Array.isArray(items) && items.length
      ? items.map(v => `<code>${_esc(String(v))}</code>`).join(' ')
      : `<span class="sk-dim">${I18n.t('skills.audit.noneShort')}</span>`;
    return `<div class="sk-audit-grid">
      <div><span>${I18n.t('skills.audit.status')}</span><strong>${_esc(audit.status)}</strong></div>
      <div><span>${I18n.t('skills.audit.risk')}</span><strong>${_esc(audit.risk_level || 'unknown')} / ${_esc(audit.max_risk || 'unknown')}</strong></div>
      <div><span>${I18n.t('skills.audit.profile')}</span><strong>${_esc(audit.validation_profile || 'unknown')}</strong></div>
      <div><span>${I18n.t('skills.audit.reason')}</span><strong>${_esc(audit.reason || I18n.t('skills.audit.noneShort'))}</strong></div>
      <div class="sk-audit-grid__wide"><span>${I18n.t('skills.audit.skills')}</span><p>${list(audit.skills)}</p></div>
      <div class="sk-audit-grid__wide"><span>${I18n.t('skills.audit.tools')}</span><p>${list(audit.tools)}</p></div>
      <div class="sk-audit-grid__wide"><span>${I18n.t('skills.audit.staticSafetyReasons')}</span><p>${list(audit.reasons)}</p></div>
    </div>`;
  }

  async function _showProposal(proposalId) {
    try {
      const data = await _rpc.call('exec.proposals.show', { proposal_id: proposalId });
      if (data.status !== 'ok') {
        UI.toast(I18n.t('skills.feedback.showFailed', {
          error: data.reason || I18n.t('common.unknownError'),
        }), 'err');
        return;
      }
      const dlg = _el.querySelector('#skill-detail-dialog');
      const body = _el.querySelector('#skill-detail-body');
      if (!dlg || !body) return;
      const gatesJson = JSON.stringify(data.gates || {}, null, 2);
      const auditHtml = _renderAutoEnableAudit(data.auto_enable_audit || {});
      body.innerHTML = `<div class="sk-detail">
        <header class="sk-detail__header">
          <h3>${_esc(I18n.t('skills.proposals.detailTitle', { proposalId }))}</h3>
          <button class="btn btn--ghost btn--sm" data-dialog-close type="button">${I18n.t('skills.dialog.close')}</button>
        </header>
        <section class="sk-detail__section">
          <h4>${I18n.t('skills.audit.title')}</h4>
          ${auditHtml}
        </section>
        <section class="sk-detail__section">
          <h4>SKILL.md</h4>
          <pre class="sk-detail__pre">${_esc(data.skill_md || '')}</pre>
        </section>
        <section class="sk-detail__section">
          <h4>${I18n.t('skills.proposals.gatesTitle')}</h4>
          <pre class="sk-detail__pre">${_esc(gatesJson)}</pre>
        </section>
      </div>`;
      const closeBtn = body.querySelector('[data-dialog-close]');
      if (closeBtn) closeBtn.addEventListener('click', () => dlg.close());
      dlg.showModal();
    } catch (err) {
      UI.toast(I18n.t('skills.feedback.showFailed', { error: err.message }), 'err');
    }
  }

  async function _acceptProposal(proposalId) {
    try {
      let data = await _rpc.call('exec.proposals.accept', { proposal_id: proposalId });
      if (data.status === 'refused' && data.reason && data.reason.indexOf('gates') !== -1) {
        const ok = await UI.confirm({
          title: I18n.t('skills.confirm.forceAccept.title'),
          message: `<p>${_esc(I18n.t('skills.confirm.forceAccept.body', { proposalId }))}</p><p>${_esc(data.reason)}</p><p>${_esc(I18n.t('skills.confirm.forceAccept.question'))}</p>`,
          confirmLabel: I18n.t('skills.confirm.forceAccept.action'),
          danger: true,
        });
        if (!ok) return;
        data = await _rpc.call('exec.proposals.accept', { proposal_id: proposalId, force: true });
      }
      if (data.status !== 'ok') {
        UI.toast(I18n.t('skills.feedback.acceptFailed', {
          error: data.reason || data.status,
        }), 'err');
        return;
      }
      // Reload list + cards so the proposal disappears and the new
      // skill appears under MANAGED layer.
      await _loadData();
    } catch (err) {
      UI.toast(I18n.t('skills.feedback.acceptFailed', { error: err.message }), 'err');
    }
  }

  async function _rejectProposal(proposalId) {
    const ok = await UI.confirm({
      title: I18n.t('skills.confirm.reject.title'),
      message: `<p>${_esc(I18n.t('skills.confirm.reject.body', { proposalId }))}</p><p>${_esc(I18n.t('skills.confirm.reject.irreversible'))}</p>`,
      confirmLabel: I18n.t('skills.confirm.reject.action'),
      danger: true,
    });
    if (!ok) return;
    try {
      const data = await _rpc.call('exec.proposals.reject', { proposal_id: proposalId });
      if (data.status !== 'ok') {
        UI.toast(I18n.t('skills.feedback.rejectFailed', {
          error: data.reason || data.status,
        }), 'err');
        return;
      }
      await _loadData();
    } catch (err) {
      UI.toast(I18n.t('skills.feedback.rejectFailed', { error: err.message }), 'err');
    }
  }

  async function _disableAutoEnabled(name) {
    const ok = await UI.confirm({
      title: I18n.t('skills.confirm.disable.title'),
      message: `<p>${_esc(I18n.t('skills.confirm.disable.body', { name }))}</p>`,
      confirmLabel: I18n.t('skills.confirm.disable.action'),
      danger: true,
    });
    if (!ok) return;
    try {
      const data = await _rpc.call('exec.proposals.auto_enabled.disable', { name });
      if (data.status !== 'ok') {
        UI.toast(I18n.t('skills.feedback.disableFailed', {
          error: data.reason || data.status,
        }), 'err');
        return;
      }
      await _loadData();
    } catch (err) {
      UI.toast(I18n.t('skills.feedback.disableFailed', { error: err.message }), 'err');
    }
  }

  function _renderCard(skill) {
    const status = skill.status || (skill.eligible ? 'ready' : 'needs_setup');
    let dotCls;
    if (status === 'ready') dotCls = 'is-ready';
    else if (status === 'needs_setup') dotCls = 'is-needs';
    else dotCls = 'is-unverified';

    const dotTitle = skill.status_detail || _skillCardStatusTitle(skill.eligible ? 'ready' : 'needs_setup');
    const emoji = skill.emoji ? `<span class="sk-card__emoji">${_esc(skill.emoji)}</span>` : '';
    const desc = skill.description || '';
    // Meta-skill card adds a "uses:" chip strip showing the sub-skills its
    // composition references. Limit to 6 visible chips + "+N" overflow so
    // the card height stays bounded for large DAGs.
    const isMeta = skill.kind === 'meta' || skill.kind === 'meta_sop';
    let subSkillsHtml = '';
    if (isMeta && Array.isArray(skill.sub_skills) && skill.sub_skills.length) {
      const subs = skill.sub_skills;
      const visible = subs.slice(0, 6);
      const overflow = subs.length - visible.length;
      const chips = visible
        .map(n => `<span class="sk-card__sub-chip">${_esc(n)}</span>`)
        .join('');
      const more = overflow > 0
        ? `<span class="sk-card__sub-chip sk-card__sub-chip--more">+${overflow}</span>`
        : '';
      subSkillsHtml = `<div class="sk-card__sub-row" title="${_escAttr(I18n.t('skills.meta.subSkillsTitle'))}">
        <span class="sk-card__sub-label">${I18n.t('skills.meta.uses')}</span>
        ${chips}${more}
      </div>`;
    }
    const kindBadge = isMeta
      ? `<span class="sk-card__kind-badge" title="${_esc(skill.kind)}">${skill.kind === 'meta_sop' ? 'SOP' : 'META'}</span>`
      : '';
    return `<button type="button" class="sk-card${isMeta ? ' sk-card--meta' : ''}" data-skill-card="${_esc(skill.name)}" title="${_esc(skill.name + (desc ? ': ' + desc : ''))}">
      <div class="sk-card__head">
        <span class="sk-card__dot ${dotCls}" title="${_esc(dotTitle)}"></span>
        ${emoji}
        <span class="sk-card__name">${_esc(skill.name)}</span>
        ${kindBadge}
      </div>
      <p class="sk-card__desc" title="${_esc(desc)}">${_esc(desc)}</p>
      ${subSkillsHtml}
    </button>`;
  }

  function _renderRequirements(requirements) {
    const items = requirements && Array.isArray(requirements.items) ? requirements.items : [];
    if (!items.length) return '';
    const rows = items.map(item => {
      const missing = [];
      (item.missing_bins || []).forEach(b => missing.push(`<code>${_esc(b)}</code>`));
      (item.missing_env || []).forEach(e => missing.push(`<code>${_esc(e)}</code>`));
      const requires = [];
      (item.requires_bins || []).forEach(b => requires.push(_esc(b)));
      if ((item.requires_any_bins || []).length) {
        requires.push(I18n.t('skills.requirements.oneOf', {
          items: (item.requires_any_bins || []).map(_esc).join(' / '),
        }));
      }
      (item.requires_env || []).forEach(e => requires.push(I18n.t('skills.requirements.envItem', { name: _esc(e) })));
      const status = item.status || 'not_declared';
      const statusLabel = _requirementStatusLabel(status);
      const statusClass = status === 'ready' ? 'sk-chip--ok'
        : status === 'needs_setup' || status === 'missing_skill' ? 'sk-chip--warn'
          : 'sk-chip--unverified';
      const detail = missing.length
        ? I18n.t('skills.requirements.missingDetail', { items: missing.join(', ') })
        : requires.length ? requires.join(', ') : I18n.t('skills.requirements.noDeclared');
      return `<div class="sk-dialog__req-row">
        <span class="sk-dialog__req-name">${_esc(item.name || I18n.t('skills.common.unknown'))}</span>
        <span class="sk-chip ${statusClass}">${statusLabel}</span>
        <span class="sk-dialog__req-detail">${detail}</span>
      </div>`;
    }).join('');
    return `<div class="sk-dialog__section">
      <div class="sk-dialog__section-title">${I18n.t('skills.requirements.title')}</div>
      <div class="sk-dialog__requirements">${rows}</div>
    </div>`;
  }

  function _openSkillDialog(skill) {
    const dlg = _el.querySelector('#skill-detail-dialog');
    const body = _el.querySelector('#skill-detail-body');
    if (!dlg || !body) return;

    const statusDetail = skill.status_detail || '';
    const status = skill.status || (skill.eligible ? 'ready' : 'needs_setup');
    let statusChip;
    if (status === 'ready') {
      statusChip = `<span class="sk-chip sk-chip--ok" title="${_esc(statusDetail)}">${_esc(I18n.t('skills.status.readyBadge'))}</span>`;
    } else if (status === 'not_declared') {
      statusChip = `<span class="sk-chip sk-chip--unverified" title="${_esc(statusDetail)}">${_esc(I18n.t('skills.status.notDeclaredBadge'))}</span>`;
    } else {
      statusChip = `<span class="sk-chip sk-chip--warn" title="${_esc(statusDetail)}">${_esc(I18n.t('skills.status.needsDepsBadge'))}</span>`;
    }
    const layerChip = `<span class="sk-chip" title="${_esc(_layerHelp(skill.layer))}">${_esc(_layerLabel(skill.layer))}</span>`;

    let missingHtml = '';
    if (status === 'needs_setup') {
      const missing = [];
      (skill.missing_bins || []).forEach(b => missing.push(`<li><code>${_esc(b)}</code> <span class="sk-dim">${_esc(I18n.t('skills.requirements.binary'))}</span></li>`));
      (skill.missing_env || []).forEach(e => missing.push(`<li><code>${_esc(e)}</code> <span class="sk-dim">${_esc(I18n.t('skills.requirements.envVar'))}</span></li>`));
      if (missing.length) {
        missingHtml = `<div class="sk-dialog__section">
          <div class="sk-dialog__section-title">${I18n.t('skills.requirements.missingTitle')}</div>
          <ul class="sk-dialog__missing">${missing.join('')}</ul>
        </div>`;
      }
    }

    const requirementsHtml = _renderRequirements(skill.requirements);

    let installHtml = '';
    const hasMissingBins = (skill.missing_bins || []).length > 0;
    const installs = hasMissingBins ? (skill.install || []) : [];
    if (installs.length) {
      const rows = installs.map(i => {
        const bins = (i.bins || []).length ? `<span class="sk-dim"> (${(i.bins || []).map(_esc).join(', ')})</span>` : '';
        const label = i.label || `Install via ${i.kind}`;
        return `<div class="sk-dialog__install-row">
          <span>${_esc(label)}${bins}</span>
          <button class="btn btn--primary btn--sm" data-install-deps-name="${_esc(skill.name)}" data-install-deps-id="${_esc(i.id)}">${_esc(I18n.t('skills.actions.installVia', { kind: i.kind }))}</button>
        </div>`;
      }).join('');
      installHtml = `<div class="sk-dialog__section">
        <div class="sk-dialog__section-title">${I18n.t('skills.actions.install')}</div>
        ${rows}
      </div>`;
    }

    const homepage = skill.homepage
      ? `<a href="${_esc(skill.homepage)}" target="_blank" rel="noopener" class="sk-dialog__link">${I18n.t('skills.dialog.homepage')} ↗</a>`
      : '';

    const footer = skill.file_path
      ? `<small class="sk-dim sk-dialog__path">${_esc(skill.file_path)}</small>`
      : '';

    const removeBtn = skill.layer === 'managed'
      ? `<button class="btn btn--sm" data-uninstall="${_esc(skill.name)}">${I18n.t('skills.actions.remove')}</button>`
      : '';

    // Meta-skill composition: render the sub-skill list as a vertical
    // chip stack. Order is preserved (parser yields composition.steps in
    // declaration order, dedup'd). Each chip is the literal skill name
    // referenced by `composition.steps[].skill` (or `routes[].skill`).
    const isMeta = skill.kind === 'meta' || skill.kind === 'meta_sop';
    let compositionHtml = '';
    if (isMeta && Array.isArray(skill.sub_skills) && skill.sub_skills.length) {
      const chips = skill.sub_skills
        .map(n => `<span class="sk-chip sk-chip--sub">${_esc(n)}</span>`)
        .join(' ');
      const kindLabel = skill.kind === 'meta_sop' ? 'meta_sop' : 'meta';
      compositionHtml = `<div class="sk-dialog__section">
        <div class="sk-dialog__section-title">${_esc(I18n.t('skills.dialog.compositionTitle', { kind: kindLabel, count: skill.sub_skills.length }))}</div>
        <div class="sk-dialog__sub-list">${chips}</div>
      </div>`;
    }
    let triggersHtml = '';
    if (isMeta && Array.isArray(skill.triggers) && skill.triggers.length) {
      const triggers = skill.triggers
        .map(t => `<code class="sk-chip sk-chip--trigger">${_esc(t)}</code>`)
        .join(' ');
      triggersHtml = `<div class="sk-dialog__section">
        <div class="sk-dialog__section-title">${I18n.t('skills.dialog.triggers')}</div>
        <div class="sk-dialog__sub-list">${triggers}</div>
      </div>`;
    }

    body.innerHTML = `
      <header class="sk-dialog__head">
        <div class="sk-dialog__head-left">
          ${skill.emoji ? `<span class="sk-dialog__emoji">${_esc(skill.emoji)}</span>` : ''}
          <strong class="sk-dialog__name">${_esc(skill.name)}</strong>
          <div class="sk-dialog__chips">${layerChip} ${statusChip}</div>
        </div>
        <button type="button" class="sk-iconbtn" id="skill-dialog-close" aria-label="${_escAttr(I18n.t('skills.dialog.close'))}">${icons.x()}</button>
      </header>
      <section class="sk-dialog__body">
        <p class="sk-dialog__desc">${_esc(skill.description || '')}</p>
        ${triggersHtml}
        ${compositionHtml}
        ${requirementsHtml}
        ${missingHtml}
        ${installHtml}
        ${homepage ? `<div class="sk-dialog__section">${homepage}</div>` : ''}
      </section>
      <footer class="sk-dialog__foot">
        ${footer}
        ${removeBtn}
      </footer>`;

    const closeBtn = body.querySelector('#skill-dialog-close');
    if (closeBtn) closeBtn.addEventListener('click', () => dlg.close(), { once: true });

    if (dlg.open) dlg.close();
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }

  async function _installDeps(name, installId, btn) {
    if (!_rpc || !name || !installId) return;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = I18n.t('skills.feedback.installing');
    try {
      const res = await _rpc.call('skills.deps.install', { name, install_id: installId });
      if (res.success) {
        btn.textContent = I18n.t('skills.feedback.installed');
        UI.toast(res.message || I18n.t('skills.feedback.installed'), 'ok');
      } else {
        btn.textContent = I18n.t('skills.feedback.failed');
        btn.disabled = false;
        UI.toast(res.message || I18n.t('skills.errors.installFailed'), 'err');
      }
      const still = res.missing_still || {};
      const stillMissing = (still.bins || []).length + (still.env || []).length;
      if (stillMissing === 0) {
        setTimeout(() => {
          const dlg = _el && _el.querySelector('#skill-detail-dialog');
          if (dlg && dlg.open) dlg.close();
        }, 600);
      }
      await _loadData();
    } catch (err) {
      btn.textContent = originalText;
      btn.disabled = false;
      UI.toast(err.message, 'err');
    }
  }

  async function _searchRegistry(query) {
    if (!_el || !_rpc || !query.trim()) return;
    const wrap = _el.querySelector('#skills-registry-results');
    if (!wrap) return;
    wrap.innerHTML = `<div class="sk-registry__loading"><span class="sk-spinner"></span> ${I18n.t('skills.feedback.searching')}</div>`;

    try {
      const data = await _rpc.call('skills.search', { query: query.trim(), limit: 20 });
      const results = data.results || [];
      if (results.length === 0) {
        wrap.innerHTML = `<div class="sk-registry__hint">
          <p>${_esc(I18n.t('skills.registry.noResults', { query }))}</p>
        </div>`;
        return;
      }
      let html = `<table class="sk-registry__table"><thead><tr><th>${I18n.t('skills.registry.table.name')}</th><th>${I18n.t('skills.registry.table.description')}</th><th>${I18n.t('skills.registry.table.source')}</th><th>${I18n.t('skills.registry.table.trust')}</th><th></th></tr></thead><tbody>`;
      results.forEach(r => {
        const trustCls = r.trust_level === 'trusted' ? 'sk-chip--ok' : 'sk-chip--warn';
        const trustChip = `<span class="sk-chip ${trustCls}">${_esc(_trustLabel(r.trust_level || 'community'))}</span>`;
        const actionCell = r.installed
          ? `<button class="btn btn--sm" disabled>${I18n.t('skills.feedback.installed')}</button>`
          : `<button class="btn btn--primary btn--sm" data-install="${_esc(r.identifier || r.name)}" data-source="${_esc(r.source || 'clawhub')}">${I18n.t('skills.actions.install')}</button>`;
        html += `<tr>
          <td class="sk-registry__name">${_esc(r.name)}</td>
          <td class="sk-registry__desc">${_esc((r.description || '').slice(0, 80))}</td>
          <td class="sk-mono sk-dim">${_esc(r.source || '')}</td>
          <td>${trustChip}</td>
          <td>${actionCell}</td>
        </tr>`;
      });
      html += '</tbody></table>';
      wrap.innerHTML = html;
    } catch (err) {
      wrap.innerHTML = `<div class="sk-error">${_esc(I18n.t('skills.errors.searchFailed', { error: err.message }))}</div>`;
    }
  }

  async function _installSkill(identifier, source, btn) {
    if (!_rpc) return;
    btn.disabled = true;
    btn.textContent = I18n.t('skills.feedback.installing');
    try {
      const res = await _rpc.call('skills.install', { identifier, source });
      if (res.success) {
        btn.textContent = I18n.t('skills.feedback.installed');
        btn.classList.remove('btn--primary');
        _loadData();
      } else {
        btn.textContent = I18n.t('skills.feedback.failed');
        UI.toast(res.message || I18n.t('skills.errors.installFailed'), 'err');
      }
    } catch (err) {
      btn.textContent = I18n.t('skills.feedback.error');
      UI.toast(err.message, 'err');
    }
  }

  async function _uninstallSkill(name, btn) {
    if (!_rpc) return;
    btn.disabled = true;
    btn.textContent = I18n.t('skills.feedback.removing');
    try {
      const res = await _rpc.call('skills.uninstall', { name });
      if (res.success) { _loadData(); }
      else { btn.textContent = I18n.t('skills.feedback.failed'); UI.toast(res.message || I18n.t('skills.errors.uninstallFailed'), 'err'); }
    } catch (err) { btn.textContent = I18n.t('skills.feedback.error'); UI.toast(err.message, 'err'); }
  }

  function _esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _escAttr(s) {
    return _esc(s).replace(/'/g, '&#39;');
  }

  function _layerLabel(layer) {
    return I18n.t(`skills.layer.${layer}`) || layer || I18n.t('skills.common.unknown');
  }

  function _layerHelp(layer) {
    return I18n.t(`skills.layerHelp.${layer}`) || I18n.t('skills.layerHelp.unknown');
  }

  function _trustLabel(level) {
    if (level === 'trusted') return I18n.t('skills.trust.trusted');
    if (level === 'community') return I18n.t('skills.trust.community');
    return level || I18n.t('skills.common.unknown');
  }

  function _requirementStatusLabel(status) {
    return {
      ready: I18n.t('skills.requirements.status.ready'),
      needs_setup: I18n.t('skills.requirements.status.needsSetup'),
      missing_skill: I18n.t('skills.requirements.status.missingSkill'),
      not_declared: I18n.t('skills.requirements.status.notDeclared'),
    }[status] || status || I18n.t('skills.common.unknown');
  }

  function _skillCardStatusTitle(status) {
    return {
      ready: I18n.t('skills.status.ready'),
      needs_setup: I18n.t('skills.status.needsSetup'),
      not_declared: I18n.t('skills.status.notDeclared'),
    }[status] || I18n.t('skills.status.unknown');
  }

  return { render, destroy };
})();

window.SkillsView = SkillsView;
