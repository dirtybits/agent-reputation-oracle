"""
Build Google Slides-importable theme PPTX files from the canonical walkthrough.

Takes ``pitch/AgentVouch_walkthrough.pptx`` as a scaffold and produces three
theme decks by rewriting ``ppt/theme/theme1.xml`` (color scheme + fontScheme),
optionally flipping the slide master's ``clrMap`` for dark variants, and
replacing the content slides with a single preview slide.

Outputs (written to ``themes/``):
    coral-terminal.pptx    # light default + coral accent, mono typography
    coral-paper.pptx       # all light
    coral-midnight.pptx    # all dark (clrMap flipped so bg is dk1)

These are the files you upload to Drive and use via ``Slide > Change theme
> Import theme`` in Google Slides. All 12 named layouts from the scaffold
(TITLE, BLANK, TITLE_AND_BODY, TITLE_AND_TWO_COLUMNS, SECTION_HEADER,
BIG_NUMBER, MAIN_POINT, CAPTION_ONLY, ONE_COLUMN_TEXT, TITLE_ONLY,
SECTION_TITLE_AND_DESCRIPTION, DEFAULT) come along and become selectable
via ``Slide > Apply layout`` after import.

Run from anywhere:

    python3 themes/build_theme_decks.py

No dependencies beyond the stdlib.
"""

from __future__ import annotations

import shutil
import sys
import tempfile
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

# ---------- paths ----------
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
SCAFFOLD = REPO_ROOT / "pitch" / "AgentVouch_walkthrough.pptx"
OUT_DIR = SCRIPT_DIR

# ---------- shared palette ----------
# Keep in sync with themes/coral-*.md specs.
CORAL = "F28A61"
EMBER = "FD522F"
AMBER = "F59E0B"
INK = "030712"
SLATE = "1F2937"
FOG = "374151"
ASH = "6B7280"
SMOKE = "D1D5DB"
PAPER_HI = "F3F4F6"
PAPER_LO = "FAFAFA"
CREAM = "FFF5EE"

FONT_DISPLAY = "Arial Black"   # major (titles)
FONT_BODY = "Calibri"          # minor (body)
# Inconsolata is the signature mono; font schemes only carry major/minor,
# so mono stays on a per-shape basis in the walkthrough itself. It's still
# loaded from the scaffold's existing shape definitions.

# ---------- variant configs ----------
# clr_scheme keys follow the 12 OOXML slots in order.
VARIANTS = {
    "coral-terminal": {
        "name": "Coral Terminal",
        "clr_scheme_name": "Coral Terminal",
        "clr_scheme": {
            "dk1": INK,       "lt1": PAPER_HI,
            "dk2": SLATE,     "lt2": SMOKE,
            "accent1": CORAL, "accent2": EMBER,
            "accent3": AMBER, "accent4": ASH,
            "accent5": CREAM, "accent6": FOG,
            "hlink": CORAL,   "folHlink": EMBER,
        },
        # Hybrid: master bg stays light (paper), but dk1/dk2 are available
        # for dark code/stat slides. Same clrMap as Paper.
        "clr_map_dark": False,
        "master_bg": PAPER_LO,
    },
    "coral-paper": {
        "name": "Coral Paper",
        "clr_scheme_name": "Coral Paper",
        "clr_scheme": {
            "dk1": SLATE,     "lt1": PAPER_LO,
            "dk2": ASH,       "lt2": SMOKE,
            "accent1": CORAL, "accent2": EMBER,
            "accent3": AMBER, "accent4": ASH,
            "accent5": CREAM, "accent6": FOG,
            "hlink": CORAL,   "folHlink": EMBER,
        },
        "clr_map_dark": False,
        "master_bg": PAPER_LO,
    },
    "coral-midnight": {
        "name": "Coral Midnight",
        "clr_scheme_name": "Coral Midnight",
        "clr_scheme": {
            "dk1": INK,       "lt1": PAPER_HI,
            "dk2": SLATE,     "lt2": SMOKE,
            "accent1": CORAL, "accent2": EMBER,
            "accent3": AMBER, "accent4": ASH,
            "accent5": FOG,   "accent6": CREAM,
            "hlink": CORAL,   "folHlink": EMBER,
        },
        # Flip the clrMap so bg1 = dk1 (ink) and tx1 = lt1 (paper).
        "clr_map_dark": True,
        "master_bg": INK,
    },
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
R = "{%s}" % NS["r"]


def write_xml(path: Path, root: ET.Element) -> None:
    """Write an XML element back with a PPTX-compatible declaration."""
    xml_bytes = ET.tostring(root, encoding="UTF-8", xml_declaration=False)
    with open(path, "wb") as fh:
        fh.write(b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n')
        fh.write(xml_bytes)


# ---------- theme rewriter ----------
def rewrite_theme(theme_path: Path, variant: dict) -> None:
    """Replace clrScheme colors and fontScheme fonts inside theme1.xml."""
    tree = ET.parse(theme_path)
    root = tree.getroot()

    # clrScheme: rename and swap colors
    scheme = root.find(f".//{A}clrScheme")
    if scheme is None:
        raise RuntimeError(f"no clrScheme in {theme_path}")
    scheme.set("name", variant["clr_scheme_name"])
    wanted = variant["clr_scheme"]
    for child in list(scheme):
        tag = child.tag.replace(A, "")
        if tag not in wanted:
            continue
        # Each slot wraps an <a:srgbClr val="..."/> or <a:sysClr .../>.
        # Replace all descendants with a single <a:srgbClr>.
        for sub in list(child):
            child.remove(sub)
        new = ET.SubElement(child, f"{A}srgbClr")
        new.set("val", wanted[tag])

    # fontScheme: rename and swap major/minor latin fonts
    fs = root.find(f".//{A}fontScheme")
    if fs is not None:
        fs.set("name", variant["clr_scheme_name"])
        for which, font in [("majorFont", FONT_DISPLAY), ("minorFont", FONT_BODY)]:
            node = fs.find(f"{A}{which}")
            if node is None:
                continue
            latin = node.find(f"{A}latin")
            if latin is not None:
                latin.set("typeface", font)
            # Prune extra <a:font> tags for other scripts so the theme
            # doesn't carry Google's original Noto/etc. fallbacks.
            for font_tag in list(node):
                if font_tag.tag == f"{A}font":
                    node.remove(font_tag)

    write_xml(theme_path, root)


# ---------- slide master rewriter ----------
def rewrite_master(master_path: Path, variant: dict) -> None:
    """Set an explicit background and (optionally) flip the clrMap to dark."""
    tree = ET.parse(master_path)
    root = tree.getroot()

    # Set background on <p:cSld>. If one exists, replace it; else insert.
    csld = root.find(f"{P}cSld")
    if csld is None:
        raise RuntimeError(f"no cSld in {master_path}")
    # Remove existing bg
    for existing in list(csld.findall(f"{P}bg")):
        csld.remove(existing)
    # Build: <p:bg><p:bgPr><a:solidFill><a:srgbClr val="..."/></a:solidFill>
    #           <a:effectLst/></p:bgPr></p:bg>
    bg = ET.Element(f"{P}bg")
    bgpr = ET.SubElement(bg, f"{P}bgPr")
    fill = ET.SubElement(bgpr, f"{A}solidFill")
    clr = ET.SubElement(fill, f"{A}srgbClr")
    clr.set("val", variant["master_bg"])
    ET.SubElement(bgpr, f"{A}effectLst")
    # Insert bg as the first child of cSld (order matters in OOXML)
    csld.insert(0, bg)

    # clrMap: flip bg1<->tx1 (and bg2<->tx2) for dark variants
    if variant["clr_map_dark"]:
        clrmap = root.find(f"{P}clrMap")
        if clrmap is not None:
            flipped = {
                "bg1": "dk1", "tx1": "lt1",
                "bg2": "dk2", "tx2": "lt2",
            }
            for k, v in flipped.items():
                clrmap.set(k, v)

    write_xml(master_path, root)


# ---------- slide stripper ----------
def strip_content_slides(work: Path, variant: dict) -> None:
    """
    Remove the scaffold's 17 content slides, leaving a single blank preview
    slide that references slideLayout12.xml (BLANK). Keeps the PPTX valid
    (needs at least one slide) and gives Import Theme a clean preview.
    """
    slides_dir = work / "ppt" / "slides"
    rels_dir = slides_dir / "_rels"
    notes_dir = work / "ppt" / "notesSlides"
    notes_rels_dir = notes_dir / "_rels"

    # Remove all slide XMLs and their rels
    for f in sorted(slides_dir.glob("slide*.xml")):
        f.unlink()
    if rels_dir.is_dir():
        for f in sorted(rels_dir.glob("slide*.xml.rels")):
            f.unlink()

    # Remove all notesSlide XMLs and their rels — each notesSlide is tied to a
    # specific slide, so stripping slides without stripping notes leaves
    # dangling cross-references.
    if notes_dir.is_dir():
        for f in sorted(notes_dir.glob("notesSlide*.xml")):
            f.unlink()
    if notes_rels_dir.is_dir():
        for f in sorted(notes_rels_dir.glob("notesSlide*.xml.rels")):
            f.unlink()

    # Write a minimal slide1.xml that uses BLANK layout
    slide1 = work / "ppt" / "slides" / "slide1.xml"
    slide1.write_text(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
        ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
        ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
        '<p:cSld><p:spTree>'
        '<p:nvGrpSpPr><p:cNvPr id="1" name="Shapes"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
        '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>'
        '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
        '</p:spTree></p:cSld>'
        '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>'
        '</p:sld>\n',
        encoding="utf-8",
    )

    # Slide1 needs a rel to the BLANK layout (slideLayout12.xml in the
    # scaffold). Write a single rel file.
    rels_dir.mkdir(parents=True, exist_ok=True)
    (rels_dir / "slide1.xml.rels").write_text(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1"'
        ' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout"'
        ' Target="../slideLayouts/slideLayout12.xml"/>'
        '</Relationships>\n',
        encoding="utf-8",
    )

    # ppt/presentation.xml: rewrite <p:sldIdLst> to reference only slide1.
    pres_xml = work / "ppt" / "presentation.xml"
    tree = ET.parse(pres_xml)
    root = tree.getroot()
    sld_id_lst = root.find(f"{P}sldIdLst")
    if sld_id_lst is not None:
        # Preserve the first sldId but update rId
        for sid in list(sld_id_lst):
            sld_id_lst.remove(sid)
        sid = ET.SubElement(sld_id_lst, f"{P}sldId")
        sid.set("id", "256")
        sid.set(f"{R}id", "rId_slide1")
    write_xml(pres_xml, root)

    # ppt/_rels/presentation.xml.rels: keep non-slide rels, drop old slide
    # rels, add one for slide1.
    rels_path = work / "ppt" / "_rels" / "presentation.xml.rels"
    tree = ET.parse(rels_path)
    root = tree.getroot()
    pkg = "{http://schemas.openxmlformats.org/package/2006/relationships}"
    slide_type = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"
    for rel in list(root):
        if rel.attrib.get("Type") == slide_type:
            root.remove(rel)
    new_rel = ET.SubElement(root, f"{pkg}Relationship")
    new_rel.set("Id", "rId_slide1")
    new_rel.set("Type", slide_type)
    new_rel.set("Target", "slides/slide1.xml")
    # Write relationships with the package namespace as default
    ET.register_namespace("", "http://schemas.openxmlformats.org/package/2006/relationships")
    write_xml(rels_path, root)

    # [Content_Types].xml: drop Override entries for slides and notesSlides
    # we deleted.
    ct = work / "[Content_Types].xml"
    tree = ET.parse(ct)
    root = tree.getroot()
    ct_ns = "{http://schemas.openxmlformats.org/package/2006/content-types}"
    for child in list(root):
        if child.tag == f"{ct_ns}Override":
            pn = child.attrib.get("PartName", "")
            if pn.startswith("/ppt/slides/slide") and pn != "/ppt/slides/slide1.xml":
                root.remove(child)
            elif pn.startswith("/ppt/notesSlides/"):
                root.remove(child)
    # Ensure slide1 has an override (scaffold should already have it; no-op
    # if so, adds if not)
    slide1_override = "/ppt/slides/slide1.xml"
    found = any(
        c.tag == f"{ct_ns}Override" and c.attrib.get("PartName") == slide1_override
        for c in root
    )
    if not found:
        ov = ET.SubElement(root, f"{ct_ns}Override")
        ov.set("PartName", slide1_override)
        ov.set("ContentType",
               "application/vnd.openxmlformats-officedocument.presentationml.slide+xml")
    ET.register_namespace("", "http://schemas.openxmlformats.org/package/2006/content-types")
    write_xml(ct, root)


# ---------- pack ----------
def pack(work: Path, dest: Path) -> None:
    if dest.exists():
        dest.unlink()
    with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as zout:
        for path in sorted(work.rglob("*")):
            if path.is_file():
                zout.write(path, path.relative_to(work).as_posix())


# ---------- main ----------
def main() -> None:
    if not SCAFFOLD.exists():
        sys.exit(f"scaffold not found: {SCAFFOLD}")

    for slug, variant in VARIANTS.items():
        with tempfile.TemporaryDirectory(prefix=f"av-{slug}-") as tmp:
            work = Path(tmp)
            with zipfile.ZipFile(SCAFFOLD, "r") as zin:
                zin.extractall(work)

            # Rewrite theme + master
            rewrite_theme(work / "ppt" / "theme" / "theme1.xml", variant)
            rewrite_theme(work / "ppt" / "theme" / "theme2.xml", variant) \
                if (work / "ppt" / "theme" / "theme2.xml").exists() else None
            for master in sorted((work / "ppt" / "slideMasters").glob("slideMaster*.xml")):
                rewrite_master(master, variant)

            # Strip content slides, leave one blank preview
            strip_content_slides(work, variant)

            # Re-register XML namespaces we may have overridden during strip
            for prefix, uri in NS.items():
                ET.register_namespace(prefix, uri)

            out = OUT_DIR / f"{slug}.pptx"
            pack(work, out)
            size_kb = out.stat().st_size // 1024
            print(f"wrote {out.relative_to(REPO_ROOT)}  ({size_kb} KB)")


if __name__ == "__main__":
    main()
