# Sessions Control UI Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fully localize the Control UI Sessions page in English and Simplified Chinese without changing session management behavior or diagnostic value.

**Architecture:** Keep the existing `SessionsView` module and lightweight `I18n.t()` runtime. Add a `sessions.*` locale domain, translate frontend-owned visible strings at each render and feedback site, and preserve raw identifiers such as session keys, agent IDs, RPC codes, and backend error details. Protect the work with static locale parity tests, focused Sessions view assertions, and browser verification of locale switching plus primary actions.

**Tech Stack:** Vanilla JavaScript, OpenSquilla Web UI `I18n`, pytest static contract tests, browser verification against local Gateway.

---

## File map

- Modify: `src/opensquilla/gateway/static/js/views/sessions.js`
- Modify: `src/opensquilla/gateway/static/js/locales/en.js`
- Modify: `src/opensquilla/gateway/static/js/locales/zh-CN.js`
- Modify: `tests/test_gateway/test_webui_i18n_static.py`
- Modify: `tests/test_gateway/test_sessions_view_static.py`

### Task 1: Define the Sessions localization contract

**Files:**
- Modify: `tests/test_gateway/test_webui_i18n_static.py`
- Modify: `tests/test_gateway/test_sessions_view_static.py`

- [ ] **Step 1: Write the failing locale-domain test**

```python
def test_sessions_locale_files_define_matching_complete_domain() -> None:
    en_entries = _locale_entries(_read(LOCALE_EN), "sessions.")
    zh_entries = _locale_entries(_read(LOCALE_ZH_CN), "sessions.")
    required = {
        "sessions.title",
        "sessions.search.placeholder",
        "sessions.stats.total",
        "sessions.table.key",
        "sessions.actions.new",
        "sessions.actions.copyKey",
        "sessions.empty.noneTitle",
        "sessions.feedback.copySuccess",
        "sessions.modal.deleteOne.title",
        "sessions.modal.newSession.title",
        "sessions.run.running",
        "sessions.agent.orphaned",
    }

    assert required <= set(en_entries)
    assert set(en_entries) == set(zh_entries)
    for key, en_value in en_entries.items():
        assert set(re.findall(r"\{([A-Za-z0-9_]+)\}", en_value)) == set(
            re.findall(r"\{([A-Za-z0-9_]+)\}", zh_entries[key])
        ), key
```

- [ ] **Step 2: Write the failing Sessions view static assertions**

```python
def test_sessions_user_facing_shell_and_feedback_use_i18n() -> None:
    source = SESSIONS_JS.read_text(encoding="utf-8")

    required = [
        "I18n.t('sessions.eyebrow')",
        "I18n.t('sessions.title')",
        "I18n.t('sessions.subtitle')",
        "I18n.t('sessions.search.placeholder')",
        "I18n.t('sessions.actions.refresh')",
        "I18n.t('sessions.actions.new')",
        "I18n.t('sessions.table.all')",
        "I18n.t('sessions.empty.noneTitle')",
        "I18n.t('sessions.feedback.copySuccess')",
        "I18n.t('sessions.modal.deleteOne.title')",
        "I18n.t('sessions.modal.newSession.title')",
    ]

    for snippet in required:
        assert snippet in source
```
```

- [ ] **Step 3: Run tests to verify they fail**

Run:
```bash
UV_CACHE_DIR=.uv-cache uv run pytest \
  tests/test_gateway/test_webui_i18n_static.py::test_sessions_locale_files_define_matching_complete_domain \
  tests/test_gateway/test_sessions_view_static.py::test_sessions_user_facing_shell_and_feedback_use_i18n -q
```

Expected: both tests fail because the `sessions.*` locale domain and render-site calls do not exist yet.

### Task 2: Localize the Sessions shell, stats, table, empty states, and row actions

**Files:**
- Modify: `src/opensquilla/gateway/static/js/views/sessions.js`
- Modify: `src/opensquilla/gateway/static/js/locales/en.js`
- Modify: `src/opensquilla/gateway/static/js/locales/zh-CN.js`

- [ ] **Step 1: Add the canonical locale keys**

```javascript
'sessions.eyebrow': 'Control - Sessions',
'sessions.title': 'Sessions',
'sessions.subtitle': 'Session history, current task activity, and agent runs. Open one to chat or clean up old state.',
'sessions.search.placeholder': 'Search session keys...',
'sessions.actions.refresh': 'Refresh',
'sessions.actions.new': 'New session',
'sessions.bulk.selected': '{count} selected',
'sessions.bulk.clear': 'Clear',
'sessions.bulk.delete': 'Delete selected',
'sessions.table.all': 'All sessions',
'sessions.table.matching': 'Matching sessions',
'sessions.table.ofTotal': '{count} of {total}',
'sessions.table.show': 'Show',
'sessions.table.key': 'Session key',
'sessions.table.status': 'Status',
'sessions.table.messages': 'Msgs',
'sessions.table.modified': 'Modified',
'sessions.actions.openChat': 'Open chat',
'sessions.actions.copyKey': 'Copy session key',
'sessions.actions.delete': 'Delete',
'sessions.feedback.copySuccess': 'Copied session key',
'sessions.errors.copyFailed': 'Copy failed',
'sessions.empty.filteredTitle': 'No matches',
'sessions.empty.filteredBody': 'No sessions match your search. Try a different query or clear it to see everything.',
'sessions.empty.noneTitle': 'No sessions yet.',
'sessions.empty.noneBody': 'Sessions appear here after you chat with an agent or run a cron task. Start one and return any time.',
'sessions.empty.start': 'Start a new session',
'sessions.pagination.total': '{count} total',
'sessions.pagination.prev': 'Previous page',
'sessions.pagination.next': 'Next page',
```

- [ ] **Step 2: Replace shell and table literals with `I18n.t()`**

```javascript
<span class="sess-stage__eyebrow">${I18n.t('sessions.eyebrow')}</span>
<h2 class="sess-stage__title">${I18n.t('sessions.title')}</h2>
<p class="sess-stage__subtitle">${I18n.t('sessions.subtitle')}</p>
<input ... placeholder="${_esc(I18n.t('sessions.search.placeholder'))}" />
...
titleEl.innerHTML = _searchVal
  ? `${_esc(I18n.t('sessions.table.matching'))} <span class="sess-list__count">${_esc(I18n.t('sessions.table.ofTotal', { count: _filtered.length, total }))}</span>`
  : `${_esc(I18n.t('sessions.table.all'))} <span class="sess-list__count">${total}</span>`;
```

- [ ] **Step 3: Keep action semantics while localizing feedback and labels**

```javascript
UI.toast(I18n.t('sessions.feedback.copySuccess'), 'ok');
UI.toast(I18n.t('sessions.errors.copyFailed'), 'warn');
<button class="sess-iconbtn" ... title="${_escAttr(I18n.t('sessions.actions.openChat'))}" ...>
```

- [ ] **Step 4: Run syntax and focused tests**

Run:
```bash
node --check src/opensquilla/gateway/static/js/views/sessions.js
node --check src/opensquilla/gateway/static/js/locales/en.js
node --check src/opensquilla/gateway/static/js/locales/zh-CN.js
UV_CACHE_DIR=.uv-cache uv run pytest \
  tests/test_gateway/test_webui_i18n_static.py::test_sessions_locale_files_define_matching_complete_domain \
  tests/test_gateway/test_sessions_view_static.py::test_sessions_user_facing_shell_and_feedback_use_i18n -q
```

Expected: syntax is clean and the new locale-domain and shell assertions pass.

### Task 3: Localize stats, dialogs, new-session modal, run-state badges, and orphan-agent messaging

**Files:**
- Modify: `src/opensquilla/gateway/static/js/views/sessions.js`
- Modify: `src/opensquilla/gateway/static/js/locales/en.js`
- Modify: `src/opensquilla/gateway/static/js/locales/zh-CN.js`
- Modify: `tests/test_gateway/test_sessions_view_static.py`

- [ ] **Step 1: Extend static tests for dialogs and status mapping**

```python
def test_sessions_dialogs_and_runtime_labels_use_i18n() -> None:
    source = SESSIONS_JS.read_text(encoding="utf-8")

    required = [
        "I18n.t('sessions.stats.total')",
        "I18n.t('sessions.stats.executing')",
        "I18n.t('sessions.stats.messages')",
        "I18n.t('sessions.modal.deleteMany.title')",
        "I18n.t('sessions.modal.deleteOne.confirm')",
        "I18n.t('sessions.modal.newSession.submit')",
        "I18n.t('sessions.run.queued')",
        "I18n.t('sessions.run.running')",
        "I18n.t('sessions.agent.orphaned')",
        "I18n.t('sessions.errors.loadFailed'",
    ]

    for snippet in required:
        assert snippet in source
```

- [ ] **Step 2: Verify the new test fails for the expected reason**

Run:
```bash
UV_CACHE_DIR=.uv-cache uv run pytest \
  tests/test_gateway/test_sessions_view_static.py::test_sessions_dialogs_and_runtime_labels_use_i18n -q
```

Expected: FAIL because stats, dialogs, and runtime labels still contain hardcoded English.

- [ ] **Step 3: Localize the remaining runtime strings without translating identifiers**

```javascript
'sessions.stats.total': 'Total sessions',
'sessions.stats.totalHint': '{open} open - {done} completed - {failed} failed/timed out - {aborted} aborted',
'sessions.stats.executing': 'Executing',
'sessions.stats.executingActive': 'tasks queued/running',
'sessions.stats.executingIdle': 'none executing',
'sessions.modal.deleteMany.title': 'Delete sessions',
'sessions.modal.deleteOne.title': 'Delete session',
'sessions.modal.warning': 'The transcript will not be flushed to disk; use /reset first if you want a backup.',
'sessions.modal.newSession.title': 'Start a new chat',
'sessions.modal.newSession.agent': 'Agent',
'sessions.modal.newSession.hint': 'Pick an agent or type a new ID to create it.',
'sessions.modal.newSession.submit': 'Start chat',
'sessions.modal.newSession.creating': 'Creating...',
'sessions.modal.newSession.starting': 'Starting...',
'sessions.run.queued': 'Task queued',
'sessions.run.running': 'Task running',
'sessions.run.interrupted': 'Interrupted',
'sessions.run.failed': 'Last task failed',
'sessions.run.timeout': 'Last task timed out',
'sessions.run.cancelled': 'Last task cancelled',
'sessions.agent.orphaned': 'Orphaned',
'sessions.agent.orphanedTitle': "Agent '{agentId}' is no longer registered",
```

- [ ] **Step 4: Run broader focused verification**

Run:
```bash
node --check src/opensquilla/gateway/static/js/views/sessions.js
UV_CACHE_DIR=.uv-cache uv run pytest \
  tests/test_gateway/test_sessions_view_static.py \
  tests/test_gateway/test_webui_i18n_static.py -q
git diff --check
```

Expected: all Sessions static and locale tests pass with no whitespace or merge-marker issues.

### Task 4: Browser verification and atomic commit

**Files:**
- Modify: `src/opensquilla/gateway/static/js/views/sessions.js`
- Modify: `src/opensquilla/gateway/static/js/locales/en.js`
- Modify: `src/opensquilla/gateway/static/js/locales/zh-CN.js`
- Modify: `tests/test_gateway/test_webui_i18n_static.py`
- Modify: `tests/test_gateway/test_sessions_view_static.py`

- [ ] **Step 1: Verify desktop and mobile behavior in the running Gateway**

Run:
```bash
make status
```

If the version does not change after JS edits, restart Gateway:

```bash
make restart
```

Open `/control/sessions` and confirm:
- English shows translated shell, stats, table headers, tooltips, dialogs, and empty state.
- Switching to Simplified Chinese rerenders the page without a full reload.
- Search, copy session key, open chat, delete dialog, and new-session modal still work.
- Mobile width keeps search, buttons, and Chinese labels readable without overlap.

- [ ] **Step 2: Commit the vertical slice**

```bash
git add src/opensquilla/gateway/static/js/views/sessions.js \
  src/opensquilla/gateway/static/js/locales/en.js \
  src/opensquilla/gateway/static/js/locales/zh-CN.js \
  tests/test_gateway/test_webui_i18n_static.py \
  tests/test_gateway/test_sessions_view_static.py \
  docs/superpowers/plans/2026-06-18-sessions-localization.md
git commit -m "feat(webui): localize sessions control view"
```

## Self-review

- Spec coverage: this plan maps the approved Sessions batch to shell strings, stats, table actions, dialogs, empty states, run badges, orphan-agent messaging, tests, and browser verification.
- Placeholder scan: all tasks specify concrete files, sample assertions, commands, and expected signals.
- Type consistency: locale domain stays `sessions.*`, runtime identifiers remain untranslated, and verification uses the same `I18n.t()` contract across tests and implementation.
