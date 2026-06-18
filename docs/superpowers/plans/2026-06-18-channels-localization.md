# Channels Control UI Localization Implementation Plan

**Goal:** Fully localize the Control UI Channels page in English and Simplified Chinese while preserving the current read-only operations model, raw adapter identifiers, and diagnostic payloads.

**Architecture:** Keep the existing `ChannelsView` module and the lightweight `I18n.t()` runtime. Add a `channels.*` locale domain for page-owned shell text, stats, empty states, metadata labels, status chips, operator hints, and load errors. Leave channel names, adapter types, raw JSON config, CLI commands, and runtime timestamps untouched.

**Tech Stack:** Vanilla JavaScript, OpenSquilla Web UI `I18n`, pytest static contract tests, browser verification against the local Gateway.

## File map

- Modify: `src/opensquilla/gateway/static/js/views/channels.js`
- Modify: `src/opensquilla/gateway/static/js/locales/en.js`
- Modify: `src/opensquilla/gateway/static/js/locales/zh-CN.js`
- Modify: `tests/test_gateway/test_channels_view_static.py`
- Modify: `tests/test_gateway/test_webui_i18n_static.py`

## Plan

1. Add failing locale-parity and static view assertions for the `channels.*` domain.
2. Introduce `channels.*` locale entries in `en.js` and `zh-CN.js`.
3. Replace hardcoded shell, stats, empty-state, metadata, status, hint, and error strings in `channels.js` with `I18n.t(...)`.
4. Keep raw channel names, adapter types, config JSON, CLI commands, and relative timestamps unchanged.
5. Verify with `node --check`, focused `pytest`, and a browser pass on `/control/channels` after restarting the gateway if the cache-buster has not changed.

## Risks

- Status chips currently render raw backend states; translating them must not break operator recognition for `running`, `connected`, `restarting`, `exhausted`, `dead`, `stopped`, and `disabled`.
- Empty-state guidance contains CLI commands; only surrounding prose should be localized.
- Browser cache may hide CSS/JS changes until the gateway is restarted.

## Success signals

- `channels.js` no longer hardcodes user-visible English shell text, stats labels, empty-state copy, metadata labels, status hints, or load-failure toasts.
- `en.js` and `zh-CN.js` define matching `channels.*` keys with placeholder parity.
- Focused static tests and JS syntax checks pass.
- Browser verification shows the Channels page in Chinese and English with raw adapter names/types/config left intact.
