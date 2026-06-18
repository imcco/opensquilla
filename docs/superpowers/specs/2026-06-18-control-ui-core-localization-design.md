# Control UI Core Localization Design

## Goal

Complete Simplified Chinese localization for the highest-frequency Control UI journey:
Chat, Sessions, Skills, and Channels. Each completed page must provide a coherent Chinese
experience rather than a partial translation of headings and primary buttons.

The translation style is Chinese-first. Product names, model names, Skill IDs, configuration
keys, protocol fields, and other diagnostic identifiers remain in English when translating them
would reduce precision.

## Scope

The work proceeds in four independently verifiable batches:

1. Chat: conversation controls, composer, session controls, tool and attachment states, dialogs,
   notifications, errors, tooltips, and accessibility labels.
2. Sessions: search, tables, details, copy/open/delete actions, dialogs, empty states, errors,
   tooltips, and accessibility labels.
3. Skills: source filters, search, details, enable/disable actions, proposal workflows, dialogs,
   empty states, errors, tooltips, and accessibility labels.
4. Channels: configured-channel list, status, configuration actions, empty states, errors,
   tooltips, and accessibility labels.

Out of scope for these batches:

- Agents, Usage, Cron, and Approvals localization.
- Refactoring or splitting the large `chat.js` module.
- Introducing a third-party localization library.
- Translating API payload fields, model identifiers, Skill IDs, configuration keys, or raw
  diagnostic details.

## Localization Architecture

The existing lightweight `I18n.t()` runtime remains the single localization interface. Locale
keys are grouped by page domain: `chat.*`, `sessions.*`, `skills.*`, and `channels.*`. Generic
actions shared across pages use `common.*`, but a string is shared only when its meaning is the
same in every context.

Dynamic messages use named interpolation parameters. For example, a confirmation concerning a
session key passes the key as data rather than assembling translated fragments. English and
Simplified Chinese locale files must define matching keys and matching interpolation parameters.

Locale changes continue to use the existing `opensquilla:localechange` event and route rerender
behavior. No page may retain references to DOM nodes replaced during a locale rerender. Chat
receives explicit browser verification because its long-lived state and event handlers make it
the highest-risk page.

## Translation Rules

- Translate all user-facing headings, labels, buttons, placeholders, status text, empty states,
  confirmations, notifications, tooltips, accessibility labels, and frontend-generated errors.
- Prefer concise, natural Chinese suitable for an operator console; do not translate word by
  word when that produces awkward UI text.
- Keep OpenSquilla, provider names, model names, Skill IDs, session keys, configuration keys,
  RPC method names, filenames, paths, and protocol values unchanged.
- Preserve the raw detail from API and runtime errors. Add localized context around the detail
  when needed, but never replace diagnostic information with a generic Chinese message.
- Avoid unnecessary bilingual parentheses. Add an English term only when the Chinese term alone
  is genuinely ambiguous for the target user.
- Do not localize user content, assistant content, logs, Skill content, or server-supplied names.

## Delivery Strategy

Each page is implemented and reviewed as a vertical slice. A page batch updates the view, both
locale files, focused static tests, and browser verification together. Each page should be a
separate commit so regressions can be isolated or reverted without discarding later work.

Chat is first because it is the primary product workflow and carries the highest implementation
risk. Sessions follows because it is directly connected to chat navigation. Skills and Channels
follow in descending order of routine user interaction.

## Error Handling

Missing locale keys retain the runtime's current English fallback and final key fallback. Tests
must prevent intentional page keys from silently relying on fallback. Dynamic error rendering
must escape untrusted detail using the page's existing escaping helpers.

Localization must not alter RPC payloads, state transitions, permissions, or action semantics.
If a UI action fails, its localized context and original diagnostic detail should both remain
available to the user.

## Verification

Every page batch must pass all of the following checks:

1. English and Simplified Chinese locale files contain the same keys and interpolation names for
   the page domain.
2. A focused static test confirms that expected visible strings use `I18n.t()` and guards the
   page's important dialogs, errors, tooltips, and accessibility labels.
3. Modified JavaScript files pass `node --check`.
4. Focused gateway localization tests pass with `pytest`.
5. Browser verification covers the page in both locales, including locale switching without a
   full reload, the primary interaction path, an empty or loading state where practical, and no
   obvious clipped or overlapping Chinese text at desktop and mobile widths.

For Chat, browser verification additionally confirms that the thread, composer, session switcher,
and textarea remain attached and functional after each locale switch.

## Completion Criteria

The first localization phase is complete when Chat, Sessions, Skills, and Channels satisfy the
verification rules independently, contain no known user-facing hardcoded English owned by the
frontend, and preserve the original behavior and diagnostic value in both locales.

Any intentionally retained English text must fall under the technical-identifier rules above or
be documented in the corresponding test as an explicit exception.
