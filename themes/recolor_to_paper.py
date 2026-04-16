"""
Recolor pitch/AgentVouch_walkthrough.pptx -> pitch/AgentVouch_walkthrough.paper.pptx
using the Coral Paper palette.

Strategy: context-aware XML rewrite.
  - SURFACE fills (shape fill, background, line): map dark -> light, dark-cards -> cream.
  - TEXT colors (inside <a:rPr>): flip light-on-dark body text to dark-on-light.
  - Coral, Ember, Amber, and pure black left untouched.
  - Fonts untouched (keeps Inconsolata/Arial Black for Google Slides).

Run from anywhere:
    python3 themes/recolor_to_paper.py

No dependencies beyond the stdlib.
"""

import shutil
import sys
import tempfile
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

# ---------- paths (resolved relative to repo root = parent of this file's dir) ----------
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
SRC = REPO_ROOT / "pitch" / "AgentVouch_walkthrough.pptx"
DST = REPO_ROOT / "pitch" / "AgentVouch_walkthrough.paper.pptx"

# ---------- color maps ----------
def norm(h: str) -> str:
    return h.upper().lstrip("#")

# Surface map: used for shape fills, lines, backgrounds
SURFACE_MAP = {
    "030712": "FAFAFA",   # Ink -> Paper
    "0F1729": "FAFAFA",   # near-ink variant -> Paper
    "1F2937": "FFF5EE",   # Slate (dark card) -> Cream
    "374151": "D1D5DB",   # Fog (dark border) -> Smoke
    "45658F": "FFF5EE",   # Dusty blue (Voucher Pool / FAQ cards) -> Cream
    "073763": "FAFAFA",   # Deep blue -> Paper
    "4A86E8": "F28A61",   # Stray Google blue -> Coral (very rare)
    # keep: F28A61 coral, FD522F ember, F59E0B amber, EF4444 red
    # keep: F3F4F6 paper, FAFAFA paperL, D1D5DB smoke, 6B7280 ash, 000000 black
}

# Text map: used ONLY inside <a:rPr> run properties
TEXT_MAP = {
    "D1D5DB": "1F2937",   # Moon body (light-on-dark) -> Slate (dark-on-light)
    "FFFFFF": "1F2937",   # pure white text -> slate
    "F3F4F6": "1F2937",   # paper-tone text (was on dark) -> slate
}

# Background-level fills (on <p:bg>) force to paper
BG_MAP = {
    "030712": "FAFAFA",
    "0F1729": "FAFAFA",
    "1F2937": "FAFAFA",
}

# ---------- XML helpers ----------
NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
for prefix, uri in NS.items():
    ET.register_namespace(prefix, uri)

A = "{%s}" % NS["a"]
P = "{%s}" % NS["p"]


def iter_with_parents(root):
    stack = [(None, root)]
    while stack:
        parent, el = stack.pop()
        yield parent, el
        for child in el:
            stack.append((el, child))


def build_parent_index(root):
    idx = {}
    for parent, el in iter_with_parents(root):
        idx[id(el)] = parent
    return idx


def ancestor_has_tag(elem, parent_idx, tags):
    cur = elem
    while cur is not None:
        if cur.tag in tags:
            return True
        cur = parent_idx.get(id(cur))
    return False


def rewrite_srgb_in_tree(root):
    parent_idx = build_parent_index(root)
    text_tags = {f"{A}rPr", f"{A}defRPr", f"{A}endParaRPr"}
    bg_tags = {f"{P}bg"}
    changes = 0
    for _parent, el in iter_with_parents(root):
        if el.tag != f"{A}srgbClr":
            continue
        val = el.attrib.get("val", "")
        if not val:
            continue
        val_n = norm(val)
        if ancestor_has_tag(el, parent_idx, bg_tags):
            new_val = BG_MAP.get(val_n)
        elif ancestor_has_tag(el, parent_idx, text_tags):
            new_val = TEXT_MAP.get(val_n)
        else:
            new_val = SURFACE_MAP.get(val_n)
        if new_val and new_val != val_n:
            el.set("val", new_val)
            changes += 1
    return changes


# ---------- main ----------
def main():
    if not SRC.exists():
        sys.exit(f"source not found: {SRC}")

    with tempfile.TemporaryDirectory(prefix="agentvouch-paper-") as tmp:
        work = Path(tmp)
        with zipfile.ZipFile(SRC, "r") as zin:
            zin.extractall(work)

        targets = []
        for sub in (
            "ppt/slides",
            "ppt/slideLayouts",
            "ppt/slideMasters",
            "ppt/notesSlides",
            "ppt/notesMasters",
            "ppt/theme",
        ):
            d = work / sub
            if d.is_dir():
                targets.extend(d.glob("*.xml"))

        total_changes = 0
        for f in targets:
            try:
                tree = ET.parse(f)
            except ET.ParseError:
                continue
            root = tree.getroot()
            n = rewrite_srgb_in_tree(root)
            if n:
                xml_bytes = ET.tostring(root, encoding="UTF-8", xml_declaration=False)
                with open(f, "wb") as fh:
                    fh.write(b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n')
                    fh.write(xml_bytes)
                total_changes += n
        print(f"recolored {total_changes} srgbClr elements across {len(targets)} xml files")

        # repack
        if DST.exists():
            DST.unlink()
        with zipfile.ZipFile(DST, "w", zipfile.ZIP_DEFLATED) as zout:
            for path in work.rglob("*"):
                if path.is_file():
                    zout.write(path, path.relative_to(work).as_posix())
        print(f"wrote {DST.relative_to(REPO_ROOT)}  ({DST.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
