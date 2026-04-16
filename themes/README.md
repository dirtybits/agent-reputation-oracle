# AgentVouch Theme Family

Three reusable themes extracted from `pitch/AgentVouch_walkthrough.pptx`. They share the same coral accent, Inconsolata mono motif, and the 12 named layouts Google Slides gave the canonical deck — the only axis that varies is surface brightness and the default background.

Think of it as one pair of shoes in three finishes: polished cream, scuffed everyday hybrid, and matte black. Same last, same laces, different room.

| Theme | Surface | Use when |
|-------|---------|----------|
| `coral-terminal` | Hybrid (light default, dark code/stat blocks) | Hackathon pitches, technical walkthroughs — the canonical AgentVouch look. |
| `coral-paper` | Fully light | Product one-pagers, investor updates, printable PDFs. |
| `coral-midnight` | Fully dark (clrMap flipped: `bg1→dk1`) | Keynote talks, darkened rooms, OLED screens. |

## Shared palette

- Coral `#F28A61` — signature accent (maps to `accent1`)
- Ember `#FD522F` — stronger coral for alerts/slashing (`accent2`)
- Amber `#F59E0B` — tertiary accent (`accent3`)
- Ash `#6B7280` — muted body (`accent4`)
- Cream `#FFF5EE` — tinted code panel for the light variant (`accent5` on Paper)
- Fog `#374151` — borders on dark (`accent6` on Paper / `accent5` on Midnight)
- Ink `#030712` — dark surfaces (`dk1` on Terminal/Midnight)
- Slate `#1F2937` — card fill on dark (`dk1` on Paper / `dk2` elsewhere)
- Smoke `#D1D5DB` — borders on light; body on dark (`lt2`)
- Paper `#F3F4F6` / `#FAFAFA` — light surfaces (`lt1`)

## Shared typography

- Display / major: **Arial Black**
- Body / minor: **Calibri**
- Monospace (signature motif): **Inconsolata** (fallback: Consolas). OOXML font schemes only carry major/minor, so mono stays on a per-shape basis — the Inconsolata font data is already embedded in each theme PPTX (inherited from the walkthrough scaffold).

## Files

- `coral-*.pptx` — **importable Google Slides themes**. Each file is a stripped-down scaffold (1 blank preview slide + 12 named layouts + 2 masters) with the theme's color scheme and fontScheme applied. Upload to Drive, then use `Slide → Change theme → Import theme` in Google Slides to apply to any deck.
- `coral-*.md` — portable theme specs (same format as Anthropic's `theme-factory` skill; also installed there) for restyling other artifacts.
- `build_theme_decks.py` — the Python generator. Reads the canonical walkthrough as a scaffold and produces the three `.pptx` files by rewriting `ppt/theme/theme*.xml` (clrScheme + fontScheme) and `ppt/slideMasters/slideMaster*.xml` (background + clrMap).
- `recolor_to_paper.py` — the content-deck recolor script. Produces `pitch/AgentVouch_walkthrough.paper.pptx` from the canonical hybrid by context-aware sRGB substitution across all slide XML. Different tool for a different job: this one recolors existing *content slides*; `build_theme_decks.py` produces *theme scaffolds*.

## Regenerate

```bash
python3 themes/build_theme_decks.py     # rebuild the three importable theme decks
python3 themes/recolor_to_paper.py      # rebuild pitch/AgentVouch_walkthrough.paper.pptx
```

Both scripts depend only on the Python standard library. The `.pptx` files are overwritten in place.

## Usage — Google Slides import

1. Upload the theme PPTX you want (e.g. `coral-paper.pptx`) to Google Drive.
2. In your target deck, `Slide → Change theme → Import theme → pick it`.
3. The 12 layouts (`TITLE`, `TITLE_AND_BODY`, `TITLE_AND_TWO_COLUMNS`, `SECTION_HEADER`, `MAIN_POINT`, `BIG_NUMBER`, `BLANK`, …) come in with the coral palette and typography. Apply a layout to any slide via `Slide → Apply layout`.

The `.md` specs are the portable version — drop them into any theme-factory-aware workflow to restyle *other* decks in the AgentVouch family without starting from one of these PPTX shells.
