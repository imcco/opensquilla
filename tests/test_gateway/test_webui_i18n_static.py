from __future__ import annotations

from pathlib import Path

ROOT = Path("src/opensquilla/gateway")
INDEX_HTML = ROOT / "templates/index.html"
APP_JS = ROOT / "static/js/app.js"
ROUTER_JS = ROOT / "static/js/router.js"
THEME_JS = ROOT / "static/js/theme.js"
I18N_JS = ROOT / "static/js/i18n.js"
LOCALE_EN = ROOT / "static/js/locales/en.js"
LOCALE_ZH_CN = ROOT / "static/js/locales/zh-CN.js"
BASE_CSS = ROOT / "static/css/base.css"
COMPONENTS_CSS = ROOT / "static/css/components.css"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_i18n_assets_load_before_views_and_app() -> None:
    index = _read(INDEX_HTML)

    en_idx = index.index("static/js/locales/en.js")
    zh_idx = index.index("static/js/locales/zh-CN.js")
    i18n_idx = index.index("static/js/i18n.js")
    overview_idx = index.index("static/js/views/overview.js")
    app_idx = index.rindex("static/js/app.js")

    assert en_idx < zh_idx < i18n_idx < overview_idx < app_idx


def test_i18n_runtime_exposes_minimal_public_api() -> None:
    source = _read(I18N_JS)

    assert "const STORAGE_KEY = 'opensquilla.locale'" in source
    assert "function t(key, params = {})" in source
    assert "function setLocale(locale)" in source
    assert "function currentLocale()" in source
    assert "function availableLocales()" in source
    assert "window.I18n = {" in source
    assert "opensquilla:localechange" in source
    assert "navigator.language" in source
    assert "document.documentElement.setAttribute('lang'" in source


def test_locale_files_define_matching_core_keys() -> None:
    en = _read(LOCALE_EN)
    zh = _read(LOCALE_ZH_CN)
    required_keys = [
        "nav.chat",
        "nav.overview",
        "nav.health",
        "nav.config",
        "topbar.toggleMenu",
        "topbar.language",
        "connection.disconnected",
        "theme.toggle",
        "route.notFound",
        "overview.actions.openChat",
        "health.title",
        "logs.title",
        "config.title",
        "setup.title",
    ]

    for key in required_keys:
        assert f"'{key}':" in en
        assert f"'{key}':" in zh


def test_logs_locale_files_cover_status_stats_and_empty_states() -> None:
    en = _read(LOCALE_EN)
    zh = _read(LOCALE_ZH_CN)
    required_keys = [
        "logs.status.unavailable",
        "logs.status.fileLog",
        "logs.status.fileLogTitle",
        "logs.status.rawTurnCall",
        "logs.status.rawTurnCallTitle",
        "logs.status.diagnostics",
        "logs.status.diagnosticsRawTitle",
        "logs.status.diagnosticsStandardTitle",
        "logs.stats.inView",
        "logs.stats.loaded",
        "logs.stats.errors",
        "logs.stats.reviewNeeded",
        "logs.stats.allClear",
        "logs.stats.warnings",
        "logs.stats.recentAdvisories",
        "logs.stats.none",
        "logs.stats.infoDebug",
        "logs.stats.routineOutput",
        "logs.empty.noLogs",
        "logs.empty.noMatches",
        "logs.errors.refreshFailed",
    ]

    for key in required_keys:
        assert f"'{key}':" in en
        assert f"'{key}':" in zh


def test_app_shell_uses_i18n_for_nav_titles_and_language_picker() -> None:
    source = _read(APP_JS)

    assert "titleKey: 'nav.overview'" in source
    assert "titleKey: 'nav.chat'" in source
    assert "I18n.t('nav.chat')" in source
    assert "I18n.t('topbar.language')" in source
    assert "id=\"locale-select\"" in source
    assert "window.addEventListener('opensquilla:localechange'" in source
    assert "Router.setContentElement(document.getElementById('content'))" in source
    assert "Router.refresh()" in source


def test_router_translates_document_title_and_not_found() -> None:
    source = _read(ROUTER_JS)

    assert "function _routeTitle(route)" in source
    assert "function setContentElement(contentEl)" in source
    assert "I18n.t(route.meta.titleKey)" in source
    assert "I18n.t('route.notFound')" in source
    assert "I18n.t('app.name')" in source


def test_theme_toggle_uses_i18n_labels() -> None:
    source = _read(THEME_JS)

    assert "I18n.t('theme.current'" in source
    assert "I18n.t('theme.toggle')" in source


def test_codex_style_tokens_reduce_heavy_accent_and_card_depth() -> None:
    base = _read(BASE_CSS)
    components = _read(COMPONENTS_CSS)

    assert "Aesthetic: Codex-inspired operator workspace" in base
    assert "--accent: #10A37F;" in base
    assert "--bg: #0D0F12;" in base
    assert "--radius-lg: 10px;" in base
    assert "box-shadow: none;" in components.split(".card {", 1)[1].split("}", 1)[0]
    assert ".locale-select" in components
