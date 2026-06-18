# Chat Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fully localize the Control UI Chat page in English and Simplified Chinese without changing chat behavior or diagnostic payloads.

**Architecture:** Keep the existing `I18n.t()` runtime and the monolithic `ChatView` module. Add a `chat.*` locale domain, translate each user-facing string at its current render site, and use named interpolation for dynamic values. Protect the work with static localization contracts plus browser checks of the locale-change rerender path.

**Tech Stack:** Vanilla JavaScript, browser DOM APIs, Python pytest static-contract tests, existing OpenSquilla Gateway and Control UI.

---

## File Map

- Modify `src/opensquilla/gateway/static/js/views/chat.js`: replace frontend-owned visible English with `I18n.t()` calls while preserving behavior and raw diagnostic details.
- Modify `src/opensquilla/gateway/static/js/locales/en.js`: define the canonical English `chat.*` messages.
- Modify `src/opensquilla/gateway/static/js/locales/zh-CN.js`: define natural Simplified Chinese translations with matching parameters.
- Modify `tests/test_gateway/test_webui_i18n_static.py`: enforce locale parity and required Chat key coverage.
- Modify `tests/test_gateway/test_chat_view_static.py`: enforce Chat render-site localization and guard important behavior while strings change.

### Task 1: Add Chat Localization Contracts

**Files:**
- Modify: `tests/test_gateway/test_webui_i18n_static.py`
- Modify: `tests/test_gateway/test_chat_view_static.py`

- [ ] **Step 1: Write the failing locale-domain parity test**

Add a small key extractor and a Chat-domain contract:

```python
import re


def _locale_entries(source: str, prefix: str) -> dict[str, str]:
    return dict(re.findall(rf"'({re.escape(prefix)}[^']+)':\s*'((?:\\'|[^'])*)'", source))


def _locale_keys(source: str, prefix: str) -> set[str]:
    return set(_locale_entries(source, prefix))


def test_chat_locale_files_define_matching_complete_domain() -> None:
    en = _read(LOCALE_EN)
    zh = _read(LOCALE_ZH_CN)
    required = {
        "chat.empty.noMessages",
        "chat.composer.placeholder",
        "chat.actions.send",
        "chat.actions.stop",
        "chat.actions.newSession",
        "chat.actions.copyMessage",
        "chat.sessions.loading",
        "chat.sessions.noMatches",
        "chat.status.idle",
        "chat.permissions.prompts",
        "chat.errors.copyFailed",
        "chat.errors.subscriptionFailed",
    }
    en_entries = _locale_entries(en, "chat.")
    zh_entries = _locale_entries(zh, "chat.")
    assert required <= set(en_entries)
    assert set(en_entries) == set(zh_entries)
    for key, en_value in en_entries.items():
        assert set(re.findall(r"\{([A-Za-z0-9_]+)\}", en_value)) == set(
            re.findall(r"\{([A-Za-z0-9_]+)\}", zh_entries[key])
        ), key
```

- [ ] **Step 2: Write the failing Chat render-site test**

Add focused assertions to `test_chat_view_static.py`:

```python
def test_chat_user_facing_shell_uses_i18n() -> None:
    source = CHAT_JS.read_text(encoding="utf-8")
    required_calls = [
        "I18n.t('chat.empty.noMessages')",
        "I18n.t('chat.composer.placeholder')",
        "I18n.t('chat.actions.send')",
        "I18n.t('chat.actions.stop')",
        "I18n.t('chat.actions.newSession')",
        "I18n.t('chat.actions.copyMessage')",
        "I18n.t('chat.sessions.loading')",
        "I18n.t('chat.status.idle')",
    ]
    for call in required_calls:
        assert call in source
```

- [ ] **Step 3: Run the tests and verify red**

Run:

```sh
uv run pytest \
  tests/test_gateway/test_webui_i18n_static.py::test_chat_locale_files_define_matching_complete_domain \
  tests/test_gateway/test_chat_view_static.py::test_chat_user_facing_shell_uses_i18n -q
```

Expected: both tests fail because the `chat.*` domain and render calls do not exist.

- [ ] **Step 4: Commit the failing contract tests**

```sh
git add tests/test_gateway/test_webui_i18n_static.py tests/test_gateway/test_chat_view_static.py
git commit -m "test(webui): define chat localization contract"
```

### Task 2: Localize the Chat Shell and Session Controls

**Files:**
- Modify: `src/opensquilla/gateway/static/js/views/chat.js:661-932`
- Modify: `src/opensquilla/gateway/static/js/views/chat.js:1180-1315`
- Modify: `src/opensquilla/gateway/static/js/views/chat.js:1528-2035`
- Modify: `src/opensquilla/gateway/static/js/locales/en.js`
- Modify: `src/opensquilla/gateway/static/js/locales/zh-CN.js`

- [ ] **Step 1: Add the shell and session locale entries**

Define matching entries in both locale files. The English values remain canonical; the Chinese file uses these corresponding values:

```javascript
'chat.empty.noMessages': '暂无消息。',
'chat.aria.conversation': '聊天对话',
'chat.aria.switchSession': '切换聊天会话',
'chat.actions.copyMessage': '复制消息',
'chat.actions.regenerate': '重新生成',
'chat.actions.editMessage': '编辑消息',
'chat.actions.copySessionKey': '复制会话密钥',
'chat.sessions.current': '当前',
'chat.sessions.loading': '正在加载...',
'chat.sessions.noMatches': '没有匹配的会话。',
'chat.sessions.none': '未找到会话。',
'chat.sessions.unavailable': '无法获取会话列表，请在上方输入会话密钥。',
'chat.sessions.switchToTyped': '切换到输入的会话',
'chat.status.idle': '空闲',
'chat.status.running': '运行中',
'chat.status.waiting': '等待中',
'chat.status.synthesizing': '正在整理',
'chat.status.completed': '已完成',
'chat.status.failed': '失败',
'chat.status.cancelled': '已取消',
```

Use the same keys with English values in `en.js`. Preserve status values sent to RPC methods; translate only `_runStatusLabel()` output.

- [ ] **Step 2: Replace static shell strings at their render sites**

Use escaped localized attributes and text rather than concatenated translated fragments:

```javascript
function _emptyStateHTML() {
  return `<div class="chat-empty">${_esc(I18n.t('chat.empty.noMessages'))}</div>`;
}

const copyMessage = _escAttr(I18n.t('chat.actions.copyMessage'));
row.innerHTML =
  `<button type="button" class="msg-action" data-action="copy" title="${copyMessage}" aria-label="${copyMessage}">`
  + _iconCopySmall() + '</button>';
```

Apply the same pattern to the session chip, conversation region, message action buttons, loading/empty states, copy title, current-session tag, and run-status labels.

- [ ] **Step 3: Run the focused tests and syntax check**

```sh
node --check src/opensquilla/gateway/static/js/views/chat.js
node --check src/opensquilla/gateway/static/js/locales/en.js
node --check src/opensquilla/gateway/static/js/locales/zh-CN.js
uv run pytest \
  tests/test_gateway/test_webui_i18n_static.py::test_chat_locale_files_define_matching_complete_domain \
  tests/test_gateway/test_chat_view_static.py::test_chat_user_facing_shell_uses_i18n -q
```

Expected: syntax checks pass; the two tests pass after all required keys and calls exist.

- [ ] **Step 4: Commit the shell and session slice**

```sh
git add src/opensquilla/gateway/static/js/views/chat.js \
  src/opensquilla/gateway/static/js/locales/en.js \
  src/opensquilla/gateway/static/js/locales/zh-CN.js
git commit -m "feat(webui): localize chat shell and sessions"
```

### Task 3: Localize Composer, Permissions, Attachments, and User Feedback

**Files:**
- Modify: `tests/test_gateway/test_chat_view_static.py`
- Modify: `src/opensquilla/gateway/static/js/views/chat.js:1214-1450`
- Modify: `src/opensquilla/gateway/static/js/views/chat.js:2067-2770`
- Modify: `src/opensquilla/gateway/static/js/views/chat.js:6800-7600`
- Modify: `src/opensquilla/gateway/static/js/locales/en.js`
- Modify: `src/opensquilla/gateway/static/js/locales/zh-CN.js`

- [ ] **Step 1: Extend the failing render-site contract**

```python
def test_chat_composer_feedback_and_errors_use_i18n() -> None:
    source = CHAT_JS.read_text(encoding="utf-8")
    required_calls = [
        "I18n.t('chat.composer.placeholder')",
        "I18n.t('chat.actions.attachFiles'",
        "I18n.t('chat.actions.newSession')",
        "I18n.t('chat.actions.exportMarkdown')",
        "I18n.t('chat.actions.send')",
        "I18n.t('chat.actions.stop')",
        "I18n.t('chat.permissions.prompts')",
        "I18n.t('chat.feedback.newSession'",
        "I18n.t('chat.errors.copyFailed'",
        "I18n.t('chat.errors.subscriptionFailed'",
    ]
    for call in required_calls:
        assert call in source
```

- [ ] **Step 2: Run the new test and verify red**

```sh
uv run pytest tests/test_gateway/test_chat_view_static.py::test_chat_composer_feedback_and_errors_use_i18n -q
```

Expected: FAIL on the first missing `I18n.t()` call.

- [ ] **Step 3: Add composer and feedback keys and replace visible strings**

Cover toolbar labels, desktop/mobile placeholders, send/stop/new/export/voice actions, permission-mode labels and descriptions, attachment validation and queue states, slash-command UI, confirms, toasts, and frontend error context. Use named parameters for values:

```javascript
textarea.placeholder = I18n.t(
  window.innerWidth <= 480 ? 'chat.composer.placeholderShort' : 'chat.composer.placeholder'
);

UI.toast(I18n.t('chat.feedback.newSession', { key }), 'info');

UI.toast(I18n.t('chat.errors.subscriptionFailed', {
  error: err?.message || I18n.t('common.unknownError'),
}), 'err', 6000);
```

Do not translate `ATTACHMENT_ALLOWED_LABEL`, MIME values, slash command names, permission-mode values, or raw `err.message`. Translate the surrounding sentence only.

- [ ] **Step 4: Run focused tests and syntax checks**

```sh
node --check src/opensquilla/gateway/static/js/views/chat.js
uv run pytest \
  tests/test_gateway/test_chat_view_static.py::test_chat_composer_feedback_and_errors_use_i18n \
  tests/test_gateway/test_webui_i18n_static.py::test_chat_locale_files_define_matching_complete_domain -q
```

Expected: all checks pass.

- [ ] **Step 5: Commit the interaction slice**

```sh
git add tests/test_gateway/test_chat_view_static.py \
  src/opensquilla/gateway/static/js/views/chat.js \
  src/opensquilla/gateway/static/js/locales/en.js \
  src/opensquilla/gateway/static/js/locales/zh-CN.js
git commit -m "feat(webui): localize chat controls and feedback"
```

### Task 4: Localize Streaming, Compaction, Router, and Tool States

**Files:**
- Modify: `tests/test_gateway/test_chat_view_static.py`
- Modify: `src/opensquilla/gateway/static/js/views/chat.js:2834-5250`
- Modify: `src/opensquilla/gateway/static/js/views/chat.js:5250-6800`
- Modify: `src/opensquilla/gateway/static/js/locales/en.js`
- Modify: `src/opensquilla/gateway/static/js/locales/zh-CN.js`

- [ ] **Step 1: Add a failing dynamic-state contract**

```python
def test_chat_dynamic_states_use_i18n_without_translating_protocol_values() -> None:
    source = CHAT_JS.read_text(encoding="utf-8")
    for call in [
        "I18n.t('chat.streaming.thinking')",
        "I18n.t('chat.compaction.noHistory')",
        "I18n.t('chat.compaction.noSummary')",
        "I18n.t('chat.router.savings')",
        "I18n.t('chat.tools.running')",
    ]:
        assert call in source
    assert "run_status: 'idle'" in source
    assert "event.startsWith('session.event.')" in source
```

- [ ] **Step 2: Run the test and verify red**

```sh
uv run pytest tests/test_gateway/test_chat_view_static.py::test_chat_dynamic_states_use_i18n_without_translating_protocol_values -q
```

Expected: FAIL because dynamic state labels are still hardcoded.

- [ ] **Step 3: Localize frontend-owned dynamic labels**

Replace thinking/activity verbs, stream waiting text, compaction status and refusal reasons, router effect labels, savings explanations, tool execution labels, history loading controls, and recoverable warning text. Keep event names, status codes, provider/model names, tool names, token abbreviations, cost values, raw server messages, and user/assistant content unchanged.

For random activity labels, localize after selection rather than storing translated values in state:

```javascript
const SQUILLA_VERB_KEYS = [
  'chat.streaming.watching',
  'chat.streaming.tracking',
  'chat.streaming.thinking',
  'chat.streaming.drafting',
  'chat.streaming.polishing',
];

label.textContent = I18n.t(SQUILLA_VERB_KEYS[index]);
```

- [ ] **Step 4: Run the complete Chat static suite**

```sh
node --check src/opensquilla/gateway/static/js/views/chat.js
node --check src/opensquilla/gateway/static/js/locales/en.js
node --check src/opensquilla/gateway/static/js/locales/zh-CN.js
uv run pytest \
  tests/test_gateway/test_chat_view_static.py \
  tests/test_gateway/test_chat_static_assets.py \
  tests/test_gateway/test_webui_i18n_static.py -q
```

Expected: all tests pass.

- [ ] **Step 5: Commit the dynamic-state slice**

```sh
git add tests/test_gateway/test_chat_view_static.py \
  src/opensquilla/gateway/static/js/views/chat.js \
  src/opensquilla/gateway/static/js/locales/en.js \
  src/opensquilla/gateway/static/js/locales/zh-CN.js
git commit -m "feat(webui): localize chat runtime states"
```

### Task 5: Browser Verification and Final Audit

**Files:**
- Modify if a discovered regression requires it: the four implementation files above
- Test: `tests/test_gateway/test_chat_view_static.py`

- [ ] **Step 1: Audit remaining likely visible English**

```sh
rg -n "title=\"[A-Z]|aria-label=\"[A-Z]|placeholder=\"[A-Z]|\.textContent = ['\"][A-Z]|UI\.toast\(['\"][A-Z]" \
  src/opensquilla/gateway/static/js/views/chat.js
```

Expected: remaining matches are comments, protocol identifiers, user/server content, or explicit technical exceptions. Convert every frontend-owned visible match to `I18n.t()` and document any intentional exception in the static test.

- [ ] **Step 2: Restart the Gateway to refresh the static cache version**

```sh
make restart
make status
```

Expected: Gateway is healthy at `http://127.0.0.1:18791/control/` and the page asset version changes.

- [ ] **Step 3: Verify Chat in both locales**

Open `/control/chat` and verify English, then switch to Simplified Chinese without reloading. Confirm that `#chat-thread`, `#chat-composer`, and `#chat-textarea` remain present and functional; session switching, copy, attachment picker, new-session action, send/stop controls, empty state, and toolbar labels use the selected locale.

Repeat at desktop and mobile widths. Confirm Chinese text is not clipped or overlapping and the composer height does not jump unexpectedly.

- [ ] **Step 4: Run final automated verification**

```sh
node --check src/opensquilla/gateway/static/js/views/chat.js
node --check src/opensquilla/gateway/static/js/locales/en.js
node --check src/opensquilla/gateway/static/js/locales/zh-CN.js
uv run pytest \
  tests/test_gateway/test_chat_view_static.py \
  tests/test_gateway/test_chat_static_assets.py \
  tests/test_gateway/test_webui_i18n_static.py -q
git diff --check
```

Expected: all syntax checks and tests pass; `git diff --check` prints no errors.

- [ ] **Step 5: Commit browser-discovered fixes if any**

```sh
git add tests/test_gateway/test_chat_view_static.py \
  src/opensquilla/gateway/static/js/views/chat.js \
  src/opensquilla/gateway/static/js/locales/en.js \
  src/opensquilla/gateway/static/js/locales/zh-CN.js
git commit -m "fix(webui): polish localized chat experience"
```

Skip this commit when browser verification requires no code changes.
