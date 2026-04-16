// Build three reusable PPTX templates derived from AgentVouch:
//   coral-terminal.pptx  (hybrid: light content + dark code, sandwich structure)
//   coral-paper.pptx     (all-light)
//   coral-midnight.pptx  (all-dark)
//
// Every template has the same set of ~8 layouts, so swapping between them is trivial.

const pptxgen = require('pptxgenjs');

// ---------- shared palette ----------
const CORAL   = 'F28A61';
const EMBER   = 'FD522F';
const INK     = '030712';
const SLATE   = '1F2937';
const FOG     = '374151';
const ASH     = '6B7280';
const SMOKE   = 'D1D5DB';
const MOON    = 'D1D5DB';
const PAPER   = 'F3F4F6';
const PAPER_L = 'FAFAFA';
const CREAM   = 'FFF5EE';
const AMBER   = 'F59E0B';

// ---------- shared type ----------
const FONT_DISPLAY = 'Arial Black';
const FONT_BODY    = 'Calibri';
const FONT_MONO    = 'Consolas'; // Inconsolata preferred; Consolas as safe fallback everywhere

// 16:9, 13.333 x 7.5 inches
const W = 13.333;
const H = 7.5;

// ---------- theme definitions ----------
const THEMES = {
  'coral-terminal': {
    name: 'Coral Terminal',
    tagline: 'Hybrid / sandwich structure',
    bgDefault: PAPER,          // content slides
    bgTitle:   CORAL,          // title + closing
    bgCode:    INK,            // code / terminal slides
    textDefault: INK,
    textMuted:   ASH,
    textOnTitle: INK,          // title slide text on coral
    textOnCode:  MOON,
    cardFill:    'FFFFFF',
    cardBorder:  SMOKE,
    eyebrowColor: CORAL,       // mono eyebrow chip color
    accent: CORAL,
    accentStrong: EMBER,
    codeText: CORAL,           // code prompt in coral, text in MOON
    sandwich: true,
  },
  'coral-paper': {
    name: 'Coral Paper',
    tagline: 'Fully light',
    bgDefault: PAPER_L,
    bgTitle:   PAPER_L,
    bgCode:    CREAM,          // code blocks on cream, not dark
    textDefault: SLATE,
    textMuted:   ASH,
    textOnTitle: SLATE,
    textOnCode:  SLATE,
    cardFill:    'FFFFFF',
    cardBorder:  SMOKE,
    eyebrowColor: CORAL,
    accent: CORAL,
    accentStrong: EMBER,
    codeText: EMBER,
    sandwich: false,
  },
  'coral-midnight': {
    name: 'Coral Midnight',
    tagline: 'Fully dark',
    bgDefault: INK,
    bgTitle:   INK,
    bgCode:    SLATE,          // code cards are the LIGHTER surface in dark mode
    textDefault: MOON,
    textMuted:   ASH,
    textOnTitle: MOON,
    textOnCode:  MOON,
    cardFill:    SLATE,
    cardBorder:  FOG,
    eyebrowColor: CORAL,
    accent: CORAL,
    accentStrong: EMBER,
    codeText: CORAL,
    sandwich: false,
  },
};

// ---------- helpers ----------
function addFooter(slide, t, { pageLabel, onDark }) {
  const color = onDark ? ASH : ASH;
  slide.addText('AgentVouch template', {
    x: 0.5, y: H - 0.35, w: 4, h: 0.25,
    fontFace: FONT_MONO, fontSize: 9, color, charSpacing: 2,
  });
  slide.addText(pageLabel, {
    x: W - 1.5, y: H - 0.35, w: 1, h: 0.25,
    fontFace: FONT_MONO, fontSize: 9, color, align: 'right',
  });
}

function addEyebrowTitle(slide, t, { eyebrow, title, onDark = false }) {
  const titleColor = onDark ? t.textDefault : t.textDefault;
  // coral thin rule top-left
  slide.addShape('rect', {
    x: 0.5, y: 0.55, w: 0.5, h: 0.04, fill: { color: t.accent }, line: { color: t.accent },
  });
  slide.addText(eyebrow, {
    x: 0.5, y: 0.65, w: 8, h: 0.3,
    fontFace: FONT_MONO, fontSize: 10, bold: true,
    color: t.eyebrowColor, charSpacing: 4,
  });
  slide.addText(title, {
    x: 0.5, y: 0.95, w: 12.3, h: 0.9,
    fontFace: FONT_DISPLAY, fontSize: 36, bold: true,
    color: titleColor,
  });
}

function addIconCircle(slide, t, { x, y, glyph, onDark = false }) {
  // coral circle with glyph inside
  slide.addShape('ellipse', {
    x, y, w: 0.7, h: 0.7, fill: { color: t.accent }, line: { color: t.accent },
  });
  slide.addText(glyph, {
    x, y: y + 0.03, w: 0.7, h: 0.65,
    fontFace: FONT_MONO, fontSize: 22, bold: true,
    color: onDark ? INK : INK, align: 'center', valign: 'middle',
  });
}

// ---------- slide builders ----------
function slideTitle(pptx, t) {
  const s = pptx.addSlide();
  s.background = { color: t.bgTitle };

  // the hybrid title is coral; midnight/paper keep their normal background
  const onCoral = t.bgTitle === CORAL;

  // eyebrow rule
  s.addShape('rect', {
    x: 0.8, y: 1.3, w: 0.6, h: 0.05,
    fill: { color: onCoral ? INK : t.accent }, line: { type: 'none' },
  });
  s.addText('TEMPLATE  ·  AGENTVOUCH FAMILY', {
    x: 0.8, y: 1.4, w: 10, h: 0.35,
    fontFace: FONT_MONO, fontSize: 12, bold: true, charSpacing: 6,
    color: onCoral ? INK : t.accent,
  });

  // big title
  s.addText(t.name, {
    x: 0.8, y: 2.0, w: 12, h: 1.8,
    fontFace: FONT_DISPLAY, fontSize: 72, bold: true,
    color: onCoral ? INK : t.textDefault,
  });
  s.addText(t.tagline, {
    x: 0.8, y: 3.7, w: 12, h: 0.6,
    fontFace: FONT_BODY, fontSize: 22,
    color: onCoral ? INK : t.textDefault,
  });

  // tag strip
  s.addText('Coral  ·  Monospace  ·  Icon-in-circle  ·  Sandwich contrast', {
    x: 0.8, y: 4.6, w: 12, h: 0.35,
    fontFace: FONT_MONO, fontSize: 12, charSpacing: 2,
    color: onCoral ? INK : t.textMuted,
  });

  // bottom rule + URL slot
  s.addShape('rect', {
    x: 0.8, y: 6.2, w: W - 1.6, h: 0.02,
    fill: { color: onCoral ? INK : t.accent }, line: { type: 'none' },
  });
  s.addText('agentvouch.xyz', {
    x: 0.8, y: 6.3, w: 6, h: 0.35,
    fontFace: FONT_MONO, fontSize: 14, bold: true,
    color: onCoral ? INK : t.accent,
  });
  s.addText('Coral Terminal / Paper / Midnight · swap any time', {
    x: W - 7, y: 6.3, w: 6.2, h: 0.35,
    fontFace: FONT_MONO, fontSize: 11,
    color: onCoral ? INK : t.textMuted, align: 'right',
  });
  return s;
}

function slideSectionDivider(pptx, t) {
  const s = pptx.addSlide();
  // section dividers in hybrid are coral; otherwise default
  const bg = t.sandwich ? CORAL : t.bgDefault;
  const onCoral = bg === CORAL;
  s.background = { color: bg };

  s.addText('SECTION  ·  02', {
    x: 0.8, y: 2.6, w: 6, h: 0.35,
    fontFace: FONT_MONO, fontSize: 12, bold: true, charSpacing: 6,
    color: onCoral ? INK : t.accent,
  });
  s.addText('The Problem', {
    x: 0.8, y: 3.0, w: 12, h: 1.5,
    fontFace: FONT_DISPLAY, fontSize: 64, bold: true,
    color: onCoral ? INK : t.textDefault,
  });
  s.addText('Reputation without consequence is noise.', {
    x: 0.8, y: 4.5, w: 12, h: 0.6,
    fontFace: FONT_BODY, fontSize: 22, italic: true,
    color: onCoral ? INK : t.textMuted,
  });

  addFooter(s, t, { pageLabel: '2 / 7', onDark: !onCoral && bg === INK });
  return s;
}

function slideThreeUp(pptx, t) {
  const s = pptx.addSlide();
  s.background = { color: t.bgDefault };
  const onDark = t.bgDefault === INK;

  addEyebrowTitle(s, t, { eyebrow: 'THE SOLUTION  ·  REUSABLE MOTIFS', title: 'Three Mechanisms', onDark });

  const cardW = 3.9, cardH = 3.4;
  const startX = 0.6, y = 2.4, gap = 0.3;
  const items = [
    { glyph: '$', title: 'Stake-Based\nVouching', body: 'Agents and users stake SOL to vouch for skill authors.' },
    { glyph: '!', title: 'Malicious\nSlashing',    body: 'Lose the dispute, lose your stake. Skin in the game.' },
    { glyph: '/', title: 'Trust\nGraph',            body: 'Pairwise on-chain vouch relationships — queryable provenance.' },
  ];

  items.forEach((it, i) => {
    const x = startX + i * (cardW + gap);
    s.addShape('roundRect', {
      x, y, w: cardW, h: cardH, rectRadius: 0.12,
      fill: { color: t.cardFill }, line: { color: t.cardBorder, width: 1 },
    });
    addIconCircle(s, t, { x: x + 0.4, y: y + 0.45, glyph: it.glyph, onDark });
    s.addText(it.title, {
      x: x + 0.35, y: y + 1.35, w: cardW - 0.7, h: 1.0,
      fontFace: FONT_DISPLAY, fontSize: 20, bold: true,
      color: t.textDefault,
    });
    s.addText(it.body, {
      x: x + 0.35, y: y + 2.35, w: cardW - 0.7, h: 0.9,
      fontFace: FONT_BODY, fontSize: 13,
      color: t.textMuted, paraSpaceAfter: 6,
    });
  });

  // bottom mono caption (like the original's build-on-Solana strip)
  s.addText('Built on Solana  ·  Anchor smart contract  ·  10 instructions  ·  6 account types', {
    x: 0.6, y: 6.15, w: W - 1.2, h: 0.3,
    fontFace: FONT_MONO, fontSize: 11,
    color: t.textMuted, align: 'center', charSpacing: 2,
  });

  addFooter(s, t, { pageLabel: '3 / 7', onDark });
  return s;
}

function slideTwoColumn(pptx, t) {
  const s = pptx.addSlide();
  s.background = { color: t.bgDefault };
  const onDark = t.bgDefault === INK;

  addEyebrowTitle(s, t, { eyebrow: 'THE PROBLEM  ·  WHY IT MATTERS', title: "Why It's Worse Than You Think", onDark });

  // LEFT: narrative
  const leftX = 0.6;
  s.addText('Instruction Injection', {
    x: leftX, y: 2.3, w: 5.8, h: 0.5,
    fontFace: FONT_DISPLAY, fontSize: 22, bold: true,
    color: t.accent,
  });
  s.addText(
    'AI skills are natural language. A malicious SKILL.md looks like helpful documentation:',
    {
      x: leftX, y: 2.85, w: 5.8, h: 0.7,
      fontFace: FONT_BODY, fontSize: 14,
      color: t.textDefault,
    }
  );

  // RIGHT: headline + bullet cascade (icon rows)
  const rightX = 6.8, rightW = 6.0;
  s.addText('Self-Replicating Agents', {
    x: rightX, y: 2.3, w: rightW, h: 0.5,
    fontFace: FONT_DISPLAY, fontSize: 22, bold: true,
    color: t.accent,
  });
  const bullets = [
    'Poisoned skill installed',
    'Agent compromised',
    'Agent spawns children',
    'Children inherit poison',
    'Grandchildren inherit poison',
    'No human in the loop',
  ];
  bullets.forEach((b, i) => {
    const y = 2.85 + i * 0.42;
    s.addShape('ellipse', {
      x: rightX, y: y + 0.06, w: 0.18, h: 0.18,
      fill: { color: t.accent }, line: { type: 'none' },
    });
    s.addText(b, {
      x: rightX + 0.3, y, w: rightW - 0.3, h: 0.35,
      fontFace: FONT_MONO, fontSize: 13,
      color: t.textDefault,
    });
  });

  addFooter(s, t, { pageLabel: '4 / 7', onDark });
  return s;
}

function slideCodeBlock(pptx, t) {
  const s = pptx.addSlide();
  // sandwich: use dark code bg; otherwise use theme's code bg
  const bg = t.sandwich ? INK : t.bgCode;
  const onDark = bg === INK;
  s.background = { color: bg };

  // title on dark/cream
  const titleColor = onDark ? MOON : t.textDefault;
  s.addShape('rect', {
    x: 0.5, y: 0.55, w: 0.5, h: 0.04, fill: { color: t.accent }, line: { color: t.accent },
  });
  s.addText('APPENDIX  ·  TECHNICAL ARCHITECTURE', {
    x: 0.5, y: 0.65, w: 10, h: 0.3,
    fontFace: FONT_MONO, fontSize: 10, bold: true,
    color: t.accent, charSpacing: 4,
  });
  s.addText('Instructions', {
    x: 0.5, y: 0.95, w: 12, h: 0.9,
    fontFace: FONT_DISPLAY, fontSize: 36, bold: true,
    color: titleColor,
  });

  // code panel
  const codeX = 0.6, codeY = 2.1, codeW = W - 1.2, codeH = 4.6;
  const panelFill = onDark ? SLATE : t.bgCode;
  const panelBorder = onDark ? FOG : SMOKE;
  s.addShape('roundRect', {
    x: codeX, y: codeY, w: codeW, h: codeH, rectRadius: 0.1,
    fill: { color: panelFill }, line: { color: panelBorder, width: 1 },
  });

  // pseudo-terminal traffic lights
  const dotY = codeY + 0.25;
  ['FD522F', 'F59E0B', '93C47D'].forEach((c, i) => {
    s.addShape('ellipse', {
      x: codeX + 0.25 + i * 0.28, y: dotY, w: 0.18, h: 0.18,
      fill: { color: c }, line: { type: 'none' },
    });
  });
  s.addText('anchor/program/lib.rs', {
    x: codeX + 1.2, y: codeY + 0.18, w: 6, h: 0.3,
    fontFace: FONT_MONO, fontSize: 10,
    color: onDark ? ASH : ASH,
  });

  const codeLines = [
    ['>', 'initialize_config'],
    [' ', 'register_agent'],
    [' ', 'vouch'],
    [' ', 'revoke_vouch'],
    [' ', 'open_author_dispute'],
    [' ', 'resolve_author_dispute'],
    [' ', 'create_skill_listing'],
    [' ', 'deposit_author_bond'],
    [' ', 'withdraw_author_bond'],
    [' ', 'purchase_skill'],
    [' ', 'claim_voucher_revenue'],
  ];
  codeLines.forEach((ln, i) => {
    const y = codeY + 0.7 + i * 0.32;
    s.addText(ln[0], {
      x: codeX + 0.4, y, w: 0.4, h: 0.3,
      fontFace: FONT_MONO, fontSize: 14, bold: true,
      color: t.accent,
    });
    s.addText(ln[1], {
      x: codeX + 0.8, y, w: codeW - 1, h: 0.3,
      fontFace: FONT_MONO, fontSize: 14,
      color: onDark ? MOON : t.textDefault,
    });
  });

  addFooter(s, t, { pageLabel: '5 / 7', onDark });
  return s;
}

function slideStatCallout(pptx, t) {
  const s = pptx.addSlide();
  s.background = { color: t.bgDefault };
  const onDark = t.bgDefault === INK;

  addEyebrowTitle(s, t, { eyebrow: 'AGENT SECURITY  ·  2026', title: 'The Numbers', onDark });

  // left: big number
  s.addText('1 in 286', {
    x: 0.6, y: 2.3, w: 6.5, h: 1.8,
    fontFace: FONT_DISPLAY, fontSize: 84, bold: true,
    color: t.accent,
  });
  s.addText('agent skills on ClawHub is a credential stealer.', {
    x: 0.6, y: 4.1, w: 6.5, h: 0.7,
    fontFace: FONT_BODY, fontSize: 18,
    color: t.textDefault,
  });
  s.addText('Discovered by researcher Rufio, Jan 2026', {
    x: 0.6, y: 4.85, w: 6.5, h: 0.35,
    fontFace: FONT_MONO, fontSize: 11,
    color: t.textMuted, charSpacing: 2,
  });

  // right: comparison card
  const cardX = 7.6, cardY = 2.3, cardW = 5.2, cardH = 3.6;
  s.addShape('roundRect', {
    x: cardX, y: cardY, w: cardW, h: cardH, rectRadius: 0.15,
    fill: { color: t.cardFill }, line: { color: t.cardBorder, width: 1 },
  });
  s.addText('109K', {
    x: cardX + 0.4, y: cardY + 0.3, w: cardW - 0.8, h: 1.3,
    fontFace: FONT_DISPLAY, fontSize: 68, bold: true,
    color: t.accent,
  });
  s.addText('comments on the disclosure post', {
    x: cardX + 0.4, y: cardY + 1.55, w: cardW - 0.8, h: 0.4,
    fontFace: FONT_BODY, fontSize: 14,
    color: t.textDefault,
  });
  s.addShape('line', {
    x: cardX + 0.4, y: cardY + 2.15, w: cardW - 0.8, h: 0,
    line: { color: t.cardBorder, width: 1 },
  });
  s.addText('4,500', {
    x: cardX + 0.4, y: cardY + 2.3, w: cardW - 0.8, h: 0.8,
    fontFace: FONT_DISPLAY, fontSize: 44, bold: true,
    color: t.textDefault,
  });
  s.addText('upvotes — unprecedented for agent security', {
    x: cardX + 0.4, y: cardY + 3.0, w: cardW - 0.8, h: 0.4,
    fontFace: FONT_BODY, fontSize: 12,
    color: t.textMuted,
  });

  addFooter(s, t, { pageLabel: '6 / 7', onDark });
  return s;
}

function slideClosing(pptx, t) {
  const s = pptx.addSlide();
  // sandwich: closing is coral again
  const bg = t.sandwich ? CORAL : t.bgDefault;
  const onCoral = bg === CORAL;
  s.background = { color: bg };

  s.addShape('rect', {
    x: 0.8, y: 1.5, w: 0.6, h: 0.05, fill: { color: onCoral ? INK : t.accent }, line: { type: 'none' },
  });
  s.addText('CONCLUSION', {
    x: 0.8, y: 1.6, w: 10, h: 0.35,
    fontFace: FONT_MONO, fontSize: 12, bold: true, charSpacing: 6,
    color: onCoral ? INK : t.accent,
  });
  s.addText("Trust infrastructure isn't optional.", {
    x: 0.8, y: 2.2, w: 12, h: 1.4,
    fontFace: FONT_DISPLAY, fontSize: 48, bold: true,
    color: onCoral ? INK : t.textDefault,
  });
  s.addText("It's an immune system for the agent economy.", {
    x: 0.8, y: 3.6, w: 12, h: 0.7,
    fontFace: FONT_BODY, fontSize: 22, italic: true,
    color: onCoral ? INK : t.textDefault,
  });

  // Two dark panels, reused from original closing (invert in midnight)
  const panelFill = onCoral ? INK : (t.sandwich ? INK : t.cardFill);
  const panelText = onCoral ? MOON : (t.sandwich ? MOON : t.textDefault);
  const panelBorder = onCoral ? INK : t.cardBorder;

  [
    { x: 0.8, title: 'agentvouch.xyz', body: 'github.com/dirtybits/agent-reputation-oracle\n@agentvouch on X/twitter' },
    { x: 6.9, title: 'Built by Andy (dirtybits) + Sparky (OpenClaw)', body: 'An agent-native product. Built by agents, for agents, for people.' },
  ].forEach((p) => {
    s.addShape('roundRect', {
      x: p.x, y: 4.9, w: 5.6, h: 1.6, rectRadius: 0.12,
      fill: { color: panelFill }, line: { color: panelBorder, width: 1 },
    });
    s.addText(p.title, {
      x: p.x + 0.3, y: 5.0, w: 5.2, h: 0.5,
      fontFace: FONT_MONO, fontSize: 15, bold: true,
      color: t.accent,
    });
    s.addText(p.body, {
      x: p.x + 0.3, y: 5.5, w: 5.2, h: 1.0,
      fontFace: FONT_MONO, fontSize: 11,
      color: panelText, paraSpaceAfter: 4,
    });
  });

  return s;
}

// ---------- render each theme ----------
(async () => {
  for (const [slug, t] of Object.entries(THEMES)) {
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_WIDE';         // 13.333 x 7.5
    pptx.title = `${t.name} – AgentVouch template`;
    pptx.company = 'AgentVouch';
    pptx.defineSlideMaster({
      title: 'MASTER',
      background: { color: t.bgDefault },
      objects: [],
    });

    slideTitle(pptx, t);
    slideSectionDivider(pptx, t);
    slideThreeUp(pptx, t);
    slideTwoColumn(pptx, t);
    slideCodeBlock(pptx, t);
    slideStatCallout(pptx, t);
    slideClosing(pptx, t);

    const out = `/sessions/zealous-tender-feynman/mnt/outputs/${slug}.pptx`;
    await pptx.writeFile({ fileName: out });
    console.log('wrote', out);
  }
})();
