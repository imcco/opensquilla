from pathlib import Path

CHANNELS_JS = Path("src/opensquilla/gateway/static/js/views/channels.js")
CHANNELS_CSS = Path("src/opensquilla/gateway/static/css/views/channels.css")


def test_channels_shell_stats_and_empty_state_use_i18n() -> None:
    source = CHANNELS_JS.read_text(encoding="utf-8")

    required = [
        "I18n.t('channels.eyebrow')",
        "I18n.t('channels.title')",
        "I18n.t('channels.subtitle')",
        "I18n.t('channels.actions.refresh')",
        "I18n.t('channels.list.title')",
        "I18n.t('channels.list.titleCount'",
        "I18n.t('channels.stats.total')",
        "I18n.t('channels.stats.connected')",
        "I18n.t('channels.stats.inactive')",
        "I18n.t('channels.stats.restartAttempts')",
        "I18n.t('channels.empty.noneTitle')",
        "I18n.t('channels.empty.noneBody')",
        "I18n.t('channels.empty.guidedSetup')",
    ]

    for snippet in required:
        assert snippet in source


def test_channels_card_labels_status_hints_and_errors_use_i18n() -> None:
    source = CHANNELS_JS.read_text(encoding="utf-8")

    required = [
        "I18n.t('channels.meta.connected')",
        "I18n.t('channels.meta.restartAttempts')",
        "I18n.t('channels.config.title')",
        "I18n.t('channels.status.connected')",
        "I18n.t('channels.status.dead')",
        "I18n.t('channels.status.unknown')",
        "I18n.t('channels.hints.disabled'",
        "I18n.t('channels.hints.dead'",
        "I18n.t('channels.hints.running')",
        "I18n.t('channels.hints.restarting')",
        "I18n.t('channels.hints.exhausted'",
        "I18n.t('channels.hints.inactive')",
        "I18n.t('channels.errors.loadFailed'",
    ]

    for snippet in required:
        assert snippet in source


def test_channels_config_summary_keeps_touch_friendly_hit_area() -> None:
    css = CHANNELS_CSS.read_text(encoding="utf-8")
    rule = css[
        css.index(".ch-card__config summary {") : css.index(
            "}", css.index(".ch-card__config summary {")
        )
    ]

    assert "min-height: 38px" in rule


def test_channels_header_eyebrow_uses_shared_clean_label_style() -> None:
    css = CHANNELS_CSS.read_text(encoding="utf-8")
    rule = css[
        css.index(".ch-stage__eyebrow {") : css.index(
            "}", css.index(".ch-stage__eyebrow {")
        )
    ]

    assert ".ch-stage__eyebrow::before" not in css
    assert "font-size: 11px" in rule
    assert "font-weight: 700" in rule
    assert "letter-spacing: 0.16em" in rule
    assert "color: var(--text-dim)" in rule
    assert "color: var(--accent)" not in rule


def test_channels_card_metadata_wraps_long_runtime_values() -> None:
    css = CHANNELS_CSS.read_text(encoding="utf-8")
    meta_rule = css[
        css.index(".ch-card__meta {") : css.index(
            "}", css.index(".ch-card__meta {")
        )
    ]
    rule = css[
        css.index(".ch-card__meta dd {") : css.index(
            "}", css.index(".ch-card__meta dd {")
        )
    ]

    assert "repeat(auto-fit, minmax(140px, 1fr))" in meta_rule
    assert "max-width: 100%" in rule
    assert "min-width: 0" in rule
    assert "white-space: normal" in rule
    assert "overflow-wrap: anywhere" in rule
    assert "text-overflow: clip" in rule


def test_channels_mobile_header_bracket_stays_compact() -> None:
    css = CHANNELS_CSS.read_text(encoding="utf-8")
    mobile_css = css[css.index("@media (max-width: 720px)") :]

    assert ".ch-stage__title-block::before" in mobile_css
    assert "bottom: auto" in mobile_css
    assert "height: 16px" in mobile_css


def test_channels_mobile_card_header_keeps_names_readable() -> None:
    css = CHANNELS_CSS.read_text(encoding="utf-8")
    mobile_css = css[css.index("@media (max-width: 720px)") :]
    head_rule = mobile_css[
        mobile_css.index(".ch-card__head {") : mobile_css.index(
            "}", mobile_css.index(".ch-card__head {")
        )
    ]
    name_rule = mobile_css[
        mobile_css.index(".ch-card__name {") : mobile_css.index(
            "}", mobile_css.index(".ch-card__name {")
        )
    ]
    chip_rule = mobile_css[
        mobile_css.index(".ch-card__head .chip {") : mobile_css.index(
            "}", mobile_css.index(".ch-card__head .chip {")
        )
    ]

    assert "flex-wrap: wrap" in head_rule
    assert "align-items: flex-start" in head_rule
    assert "flex: 1 1 180px" in name_rule
    assert "max-width: 100%" in name_rule
    assert "white-space: normal" in name_rule
    assert "overflow-wrap: anywhere" in name_rule
    assert "text-overflow: clip" in name_rule
    assert "max-width: 100%" in chip_rule
    assert "white-space: normal" in chip_rule
    assert "overflow-wrap: anywhere" in chip_rule
