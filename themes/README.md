# AgentVouch Theme Family

Three reusable themes extracted from `AgentVouch_walkthrough.pptx`. They share the same coral accent, monospace typography, and icon-in-circle motif — the only axis that varies is surface brightness.

Think of it as one pair of shoes in three finishes: matte black, polished cream, and the scuffed everyday hybrid. Same last, same laces, different room.

| Theme | Surface | Use when |
|-------|---------|----------|
| `coral-terminal` | Hybrid (sandwich: coral title + light content + dark code + coral close) | Hackathon pitches, technical walkthroughs — the canonical AgentVouch look. |
| `coral-paper` | Fully light | Product one-pagers, investor updates, printable PDFs. |
| `coral-midnight` | Fully dark | Keynote talks, darkened rooms, OLED screens. |

## Shared palette

- Coral `#F28A61` — signature accent
- Ember `#FD522F` — stronger coral for alerts/slashing
- Ink `#030712` — dark surfaces & code
- Slate `#1F2937` — card fill on dark
- Fog `#374151` — borders on dark
- Ash `#6B7280` — muted body
- Smoke `#D1D5DB` — borders on light; body on dark
- Paper `#F3F4F6` / `#FAFAFA` — light surfaces
- Cream `#FFF5EE` — tinted code panel for the light variant
- Amber `#F59E0B` — tertiary accent

## Shared typography

- Display: **Arial Black**
- Body: **Calibri**
- Monospace (signature motif): **Inconsolata** (fallback: Consolas). Used for eyebrows, code, footer, stat labels, and terminal chips.

## Files

- `coral-*.pptx` — ready-to-use 7-slide template decks (title / divider / 3-up / two-column / code / stat / closing)
- `coral-*.md` — portable theme specs (same format as Anthropic's `theme-factory` skill; also installed there)
- `build_templates.js` — the pptxgenjs generator. Re-run with `node build_templates.js` after `npm install pptxgenjs`.

## Regenerate

```bash
cd themes && npm install pptxgenjs && node build_templates.js
```

The three `.pptx` files are overwritten in place.

## How "reusable" works here

1. Copy any of the three `.pptx` files.
2. Open in PowerPoint or Keynote.
3. Duplicate slides and replace content — the palette, fonts, motif inventory, and footer treatment are all preset.
4. To switch surfaces mid-deck (e.g. a dark stat slide inside the Paper deck), copy the corresponding slide from the sibling template.

The `.md` specs are the portable version — drop them into any theme-factory–aware workflow to restyle *other* decks in the AgentVouch family without starting from one of these PPTX shells.
