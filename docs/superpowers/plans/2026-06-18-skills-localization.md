# Skills Control UI Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fully localize the Control UI Skills page in English and Simplified Chinese without changing skill-management behavior, technical identifiers, or diagnostic payloads.

**Architecture:** Keep the existing `SkillsView` module and the lightweight `I18n.t()` runtime. Add a `skills.*` locale domain for page-owned UI strings, leaving skill names, trigger tokens, layer identifiers, file paths, risk values, and raw error details untouched. Cover the work with static locale-parity tests, focused Skills view assertions, and browser verification for tab switching, dialogs, and install/search surfaces.

**Tech Stack:** Vanilla JavaScript, OpenSquilla Web UI `I18n`, pytest static contract tests, browser verification against the local Gateway.

---

## File map

- Modify: `src/opensquilla/gateway/static/js/views/skills.js`
- Modify: `src/opensquilla/gateway/static/js/locales/en.js`
- Modify: `src/opensquilla/gateway/static/js/locales/zh-CN.js`
- Modify: `tests/test_gateway/test_webui_i18n_static.py`
- Modify: `tests/test_gateway/test_skills_view_static.py`

### Task 1: Define the Skills localization contract

**Files:**
- Modify: `tests/test_gateway/test_webui_i18n_static.py`
- Modify: `tests/test_gateway/test_skills_view_static.py`

- [ ] **Step 1: Write the failing locale-domain test**

```python
def test_skills_locale_files_define_matching_complete_domain() -> None:
    en_entries = _locale_entries(_read(LOCALE_EN), "skills.")
    zh_entries = _locale_entries(_read(LOCALE_ZH_CN), "skills.")
    required = {
        "skills.title",
        "skills.search.placeholder",
        "skills.tabs.installed",
        "skills.registry.searchButton",
        "skills.stats.all",
        "skills.empty.noInstalled",
        "skills.dialog.close",
        "skills.feedback.settingsUpdateFailed",
        "skills.actions.installGithub",
        "skills.proposals.pending",
        "skills.requirements.title",
        "skills.errors.loadFailed",
    }

    assert required <= set(en_entries)
    assert set(en_entries) == set(zh_entries)
    for key, en_value in en_entries.items():
        assert set(re.findall(r"\{([A-Za-z0-9_]+)\}", en_value)) == set(
            re.findall(r"\{([A-Za-z0-9_]+)\}", zh_entries[key])
        ), key
```

- [ ] **Step 2: Write the failing Skills view static assertions**

```python
def test_skills_shell_and_registry_controls_use_i18n() -> None:
    source = SKILLS_JS.read_text(encoding="utf-8")

    required = [
        "I18n.t('skills.eyebrow')",
        "I18n.t('skills.title')",
        "I18n.t('skills.subtitle')",
        "I18n.t('skills.search.placeholder')",
        "I18n.t('skills.actions.refresh')",
        "I18n.t('skills.tabs.installed')",
        "I18n.t('skills.tabs.community')",
        "I18n.t('skills.registry.searchPlaceholder')",
        "I18n.t('skills.actions.installGithub')",
        "I18n.t('skills.registry.hint.search')",
    ]

    for snippet in required:
        assert snippet in source
```

- [ ] **Step 3: Write the failing dialog and feedback assertions**

```python
def test_skills_dialogs_proposals_and_feedback_use_i18n() -> None:
    source = SKILLS_JS.read_text(encoding="utf-8")

    required = [
        "I18n.t('skills.stats.all')",
        "I18n.t('skills.proposals.pending')",
        "I18n.t('skills.autoPropose.title')",
        "I18n.t('skills.requirements.title')",
        "I18n.t('skills.dialog.close')",
        "I18n.t('skills.feedback.settingsUpdateFailed'",
        "I18n.t('skills.feedback.acceptFailed'",
        "I18n.t('skills.confirm.forceAccept.title')",
        "I18n.t('skills.actions.installVia'",
        "I18n.t('skills.errors.searchFailed'",
    ]

    for snippet in required:
        assert snippet in source
```

- [ ] **Step 4: Run tests to verify they fail**

Run:
```bash
UV_CACHE_DIR=.uv-cache uv run pytest \
  tests/test_gateway/test_webui_i18n_static.py::test_skills_locale_files_define_matching_complete_domain \
  tests/test_gateway/test_skills_view_static.py::test_skills_shell_and_registry_controls_use_i18n \
  tests/test_gateway/test_skills_view_static.py::test_skills_dialogs_proposals_and_feedback_use_i18n -q
```

Expected: all three tests fail because the `skills.*` locale domain and render-site calls do not exist yet.

### Task 2: Localize the Skills shell, tabs, registry controls, stats, and empty states

**Files:**
- Modify: `src/opensquilla/gateway/static/js/views/skills.js`
- Modify: `src/opensquilla/gateway/static/js/locales/en.js`
- Modify: `src/opensquilla/gateway/static/js/locales/zh-CN.js`

- [ ] **Step 1: Add the canonical locale keys for the outer shell**

```javascript
'skills.eyebrow': 'Control - Skills',
'skills.title': 'Skills',
'skills.subtitle': 'Composable agent capabilities: bundled OpenSquilla skills plus local managed, personal, project, and workspace packs.',
'skills.search.placeholder': 'Filter skills...',
'skills.actions.refresh': 'Refresh',
'skills.tabs.installed': 'Installed',
'skills.tabs.community': 'Community',
'skills.tabs.ariaSource': 'Skill source',
'skills.registry.searchPlaceholder': 'Search community skills...',
'skills.registry.searchButton': 'Search',
'skills.registry.githubPlaceholder': 'https://github.com/owner/repo/tree/main/path/to/skill',
'skills.actions.installGithub': 'Install GitHub URL',
'skills.registry.hint.search': 'Search ClawHub skills to browse and install.',
'skills.registry.hint.direct': 'Paste a GitHub skill URL above for direct install.',
```

- [ ] **Step 2: Replace shell and registry literals with `I18n.t()`**

```javascript
<span class="sk-stage__eyebrow">${I18n.t('skills.eyebrow')}</span>
<h2 class="sk-stage__title">${I18n.t('skills.title')}</h2>
<p class="sk-stage__subtitle">${I18n.t('skills.subtitle')}</p>
...
<div class="sk-tabs" role="group" aria-label="${_escAttr(I18n.t('skills.tabs.ariaSource'))}">
...
<button class="btn btn--primary" id="skills-github-install">${I18n.t('skills.actions.installGithub')}</button>
```

- [ ] **Step 3: Localize stats and empty states while preserving filters**

```javascript
${tile('all', I18n.t('skills.stats.all'), total, I18n.t('skills.stats.layers', { count: layers.size }), 'sk-stat--accent')}
...
const msg = _filterText
  ? I18n.t('skills.empty.filtered', { query: _filterText })
  : _statusFilter === 'ready'
    ? I18n.t('skills.empty.noneReady')
    : _statusFilter === 'needs-setup'
      ? I18n.t('skills.empty.noneNeedsSetup')
      : _statusFilter === 'not-declared'
        ? I18n.t('skills.empty.noneNotDeclared')
        : I18n.t('skills.empty.noInstalled');
```

- [ ] **Step 4: Run syntax and focused tests**

Run:
```bash
node --check src/opensquilla/gateway/static/js/views/skills.js
node --check src/opensquilla/gateway/static/js/locales/en.js
node --check src/opensquilla/gateway/static/js/locales/zh-CN.js
UV_CACHE_DIR=.uv-cache uv run pytest \
  tests/test_gateway/test_webui_i18n_static.py::test_skills_locale_files_define_matching_complete_domain \
  tests/test_gateway/test_skills_view_static.py::test_skills_shell_and_registry_controls_use_i18n -q
```

Expected: shell-level assertions pass while dialog/feedback assertions remain red until Task 3.

### Task 3: Localize proposals, dialogs, confirmations, install actions, and runtime feedback

**Files:**
- Modify: `src/opensquilla/gateway/static/js/views/skills.js`
- Modify: `src/opensquilla/gateway/static/js/locales/en.js`
- Modify: `src/opensquilla/gateway/static/js/locales/zh-CN.js`
- Modify: `tests/test_gateway/test_skills_view_static.py`

- [ ] **Step 1: Add locale keys for details, proposals, and feedback**

```javascript
'skills.proposals.pending': 'Pending Proposals',
'skills.proposals.awaiting': 'awaiting review',
'skills.proposals.autoEnabled': 'Auto-Enabled Meta-Skills',
'skills.autoPropose.title': 'Auto-Propose Settings',
'skills.requirements.title': 'Requirements',
'skills.dialog.close': 'Close',
'skills.dialog.homepage': 'Homepage',
'skills.actions.installVia': 'Install via {kind}',
'skills.actions.remove': 'Remove',
'skills.feedback.settingsUpdateFailed': 'Settings update failed: {error}',
'skills.feedback.acceptFailed': 'Accept failed: {error}',
'skills.feedback.rejectFailed': 'Reject failed: {error}',
'skills.feedback.disableFailed': 'Disable failed: {error}',
'skills.feedback.searching': 'Searching ClawHub...',
'skills.feedback.installing': 'Installing...',
'skills.feedback.removing': 'Removing...',
'skills.confirm.forceAccept.title': 'Force accept proposal?',
'skills.confirm.reject.title': 'Reject proposal?',
'skills.confirm.disable.title': 'Disable auto-enabled skill?',
'skills.errors.searchFailed': 'Search failed: {error}',
'skills.errors.installFailed': 'Install failed',
```

- [ ] **Step 2: Replace remaining hardcoded frontend strings with `I18n.t()`**

```javascript
UI.toast(I18n.t('skills.feedback.settingsUpdateFailed', {
  error: out.reason || I18n.t('common.unknownError'),
}), 'err');
...
title: I18n.t('skills.confirm.reject.title'),
message: `<p>${_esc(I18n.t('skills.confirm.reject.body', { proposalId }))}</p>`,
confirmLabel: I18n.t('skills.confirm.reject.action'),
```

- [ ] **Step 3: Keep raw diagnostics and identifiers intact**

```javascript
const gatesJson = JSON.stringify(data.gates || {}, null, 2);
...
<code class="sk-proposal-row__id">${pid}</code>
...
UI.toast(I18n.t('skills.feedback.acceptFailed', {
  error: data.reason || data.status,
}), 'err');
```

- [ ] **Step 4: Run broader focused verification**

Run:
```bash
node --check src/opensquilla/gateway/static/js/views/skills.js
UV_CACHE_DIR=.uv-cache uv run pytest \
  tests/test_gateway/test_skills_view_static.py \
  tests/test_gateway/test_webui_i18n_static.py -q
git diff --check
```

Expected: all Skills static and locale tests pass with no formatting issues.

### Task 4: Browser verification and atomic commit

**Files:**
- Modify: `src/opensquilla/gateway/static/js/views/skills.js`
- Modify: `src/opensquilla/gateway/static/js/locales/en.js`
- Modify: `src/opensquilla/gateway/static/js/locales/zh-CN.js`
- Modify: `tests/test_gateway/test_webui_i18n_static.py`
- Modify: `tests/test_gateway/test_skills_view_static.py`

- [ ] **Step 1: Verify desktop and mobile behavior in the running Gateway**

Run:
```bash
make status
```

If static assets are stale, restart the Gateway and confirm the new `startedAt`/version is active before browser checks.

Open `/control/skills` and confirm:
- English and Simplified Chinese both render the shell, stats, tabs, registry search/install controls, and hints correctly.
- Locale switching rerenders without a full reload.
- Installed/community tab switching still works.
- A skill detail dialog opens and shows translated chrome while preserving raw names, triggers, paths, and JSON gates.
- Mobile width keeps tabs, search, and primary buttons readable without overlap.

- [ ] **Step 2: Commit the vertical slice**

```bash
git add src/opensquilla/gateway/static/js/views/skills.js \
  src/opensquilla/gateway/static/js/locales/en.js \
  src/opensquilla/gateway/static/js/locales/zh-CN.js \
  tests/test_gateway/test_webui_i18n_static.py \
  tests/test_gateway/test_skills_view_static.py \
  docs/superpowers/plans/2026-06-18-skills-localization.md
git commit -m "feat(webui): localize skills control view"
```

## Self-review

- Spec coverage: this plan covers the approved Skills batch across the shell, filters, tabs, registry surface, stats, empty states, proposals, dialogs, confirmations, and runtime feedback.
- Placeholder scan: all tasks include concrete files, assertions, commands, and expected results.
- Type consistency: the locale domain remains `skills.*`, technical identifiers stay raw, and tests verify the same `I18n.t()` integration used by the implementation.
