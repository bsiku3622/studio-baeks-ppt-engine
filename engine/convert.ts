import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { parse as parseYaml } from 'yaml';
import katex from 'katex';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolvePrimary, validatePrimary } from './palette.js';
import type {
  Root, Heading, List, ListItem, Paragraph, Image,
  PhrasingContent, BlockContent, Yaml,
} from 'mdast';
import type {
  ContainerDirective, LeafDirective, TextDirective,
} from 'mdast-util-directive';

// ───────────────────────── public types ─────────────────────────

export class EngineError extends Error {
  line?: number;
  column?: number;
  constructor(message: string, opts: { line?: number; column?: number } = {}) {
    super(message);
    this.name = 'EngineError';
    this.line = opts.line;
    this.column = opts.column;
  }
}

export type Chrome = {
  topLeft?: string;
  topRight?: string;
  bottomLeft?: string;
  bottomRight?: string;
};

export type Frontmatter = {
  title?: string;
  subtitle?: string;
  author?: string;
  id?: string;
  date?: string;
  venue?: string;
  primary?: string;
  primaryDark?: string;
  chrome?: Chrome;
  [key: string]: string | Chrome | undefined;
};

export type ConvertOptions = {
  /** Absolute path to template.html. Defaults to sibling file in this module's dir. */
  templatePath?: string;
  /** Alternative to templatePath — pass the template string directly. */
  templateString?: string;
  /** Inline deck-stage.js source — produces self-contained HTML (preferred). */
  deckStageScript?: string;
  /** External src URL for <script src="...">. Used only if deckStageScript is not given. */
  deckStageSrc?: string;
};

export type ConvertResult = {
  html: string;
  slideCount: number;
  frontmatter: Frontmatter;
};

// ───────────────────────── public API ─────────────────────────

export function convertMd(md: string, opts: ConvertOptions = {}): ConvertResult {
  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkDirective)
    .use(remarkGfm)
    .use(remarkMath);
  const tree = processor.runSync(processor.parse(md)) as Root;

  let fm: Frontmatter = {};
  const slides: string[] = [];
  const notes: string[] = [];

  const totalSlides = tree.children.filter(
    (c: any) => c.type === 'containerDirective' && c.name !== 'speaker-note'
  ).length;
  let slideIdx = 0;
  let currentSection = '';

  for (const node of tree.children) {
    if (node.type === 'yaml') {
      const yamlStartLine = node.position?.start.line ?? 1;
      let raw: any;
      try {
        raw = parseYaml((node as Yaml).value) ?? {};
      } catch (e: any) {
        const yamlLine = e?.linePos?.[0]?.line ?? 1;
        throw new EngineError(`Frontmatter YAML 파싱 실패: ${e.message}`, {
          line: yamlStartLine + yamlLine,
        });
      }
      // Validate & coerce: most fields should be string-ish.
      // `chrome` is allowed to be a flat object of slot→template strings.
      // Other object/array values → clear error.
      const mdLines = md.split('\n');
      const CHROME_SLOTS = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
      for (const k of Object.keys(raw)) {
        const v = raw[k];
        if (v == null) { delete raw[k]; continue; }
        if (typeof v === 'string') continue;
        if (typeof v === 'number' || typeof v === 'boolean') {
          raw[k] = String(v);
          continue;
        }
        if (k === 'chrome' && typeof v === 'object' && !Array.isArray(v)) {
          const chrome: any = {};
          for (const slot of Object.keys(v)) {
            if (!CHROME_SLOTS.includes(slot)) {
              const idx = mdLines.findIndex((l) => new RegExp(`^\\s+${slot}\\s*:`).test(l));
              throw new EngineError(
                `chrome.${slot}: 알 수 없는 슬롯. ${CHROME_SLOTS.join(' / ')} 중 선택.`,
                { line: idx >= 0 ? idx + 1 : undefined },
              );
            }
            const sv = v[slot];
            if (sv == null) continue;
            if (typeof sv === 'string' || typeof sv === 'number' || typeof sv === 'boolean') {
              chrome[slot] = String(sv);
            } else {
              const idx = mdLines.findIndex((l) => new RegExp(`^\\s+${slot}\\s*:`).test(l));
              throw new EngineError(
                `chrome.${slot}의 값은 문자열이어야 합니다.`,
                { line: idx >= 0 ? idx + 1 : undefined },
              );
            }
          }
          raw[k] = chrome;
          continue;
        }
        // Object / array — invalid for our schema.
        const idx = mdLines.findIndex((l) => new RegExp(`^\\s*${k}\\s*:`).test(l));
        throw new EngineError(
          `Frontmatter 필드 "${k}"의 값이 문자열이 아닙니다. {}/[] 같은 YAML 객체·배열은 지원하지 않음.`,
          { line: idx >= 0 ? idx + 1 : undefined },
        );
      }
      fm = raw as Frontmatter;
      continue;
    }
    if (node.type === 'containerDirective') {
      const dir = node as ContainerDirective;
      // remark-directive doesn't reliably nest two same-fence containers
      // (`:::single` + `:::stats` + `:::speaker-note`) — :::speaker-note can
      // pop out to the top level. Attach it to the previously rendered slide.
      if (dir.name === 'speaker-note') {
        if (notes.length > 0) {
          const extra = (dir.children ?? [])
            .map((c: any) => renderNotesBlock(c as BlockContent))
            .join('\n');
          notes[notes.length - 1] = notes[notes.length - 1]
            ? notes[notes.length - 1] + '\n' + extra
            : extra;
        }
        continue;
      }
      const noteHtml = extractSpeakerNote(dir);
      slideIdx += 1;
      if (dir.name === 'divider') {
        currentSection = extractDirectiveTitleText(dir);
      }
      // Explicit section override via attribute. Useful for intro slides
      // before the first :::divider, or to label a sub-section without a
      // full divider slide. Propagates like divider until next override.
      const sectionAttr = (dir.attributes ?? {}).section;
      if (typeof sectionAttr === 'string' && sectionAttr.length > 0) {
        currentSection = sectionAttr;
      }
      const slide = renderSlide(dir, fm);
      if (slide) {
        const chromeHtml = buildChromeHtml(
          dir.name,
          (dir.attributes ?? {}).chrome,
          { fm, n: slideIdx, total: totalSlides, section: currentSection },
        );
        slides.push(injectChrome(slide, chromeHtml));
        notes.push(noteHtml);
      }
    }
  }

  // Validate frontmatter primary — single source of truth.
  const primaryCheck = validatePrimary(fm.primary);
  if (!primaryCheck.valid) {
    const mdLines = md.split('\n');
    const idx = mdLines.findIndex((l) => /^\s*primary\s*:/.test(l));
    throw new EngineError(primaryCheck.reason!, {
      line: idx >= 0 ? idx + 1 : undefined,
    });
  }

  const { s500, s600 } = resolvePrimary(fm.primary, fm.primaryDark);

  const template =
    opts.templateString ??
    fs.readFileSync(opts.templatePath ?? path.resolve(import.meta.dir, 'template.html'), 'utf8');

  // Build script tag: inline preferred, src fallback.
  // Escape `</` to `<\/` so any `</script>` literal inside the JS source
  // doesn't terminate the surrounding inline <script> tag prematurely.
  const scriptTag = opts.deckStageScript
    ? `<script>${opts.deckStageScript.replace(/<\//g, '<\\/')}\n</script>`
    : `<script src="${opts.deckStageSrc ?? 'deck-stage.js'}"></script>`;

  const notesJson = JSON.stringify(notes).replace(/<\//g, '<\\/');
  const notesTag = notes.some((n) => n.length > 0)
    ? `<script type="application/json" id="speaker-notes">${notesJson}</script>`
    : '';

  // Use function replacers to avoid `$&` etc. being interpreted in the JS source.
  const html = template
    .replace(/\{\{TITLE\}\}/g, escAttr(fm.title ?? '슬라이드 데크'))
    .replace(/\{\{PRIMARY_S500\}\}/g, s500)
    .replace(/\{\{PRIMARY_S600\}\}/g, s600)
    .replace('{{SLIDES}}', () => slides.join('\n\n  '))
    .replace('{{SPEAKER_NOTES}}', () => notesTag)
    .replace('{{DECK_STAGE_SCRIPT_TAG}}', () => scriptTag);

  return { html, slideCount: slides.length, frontmatter: fm };
}

// ───────────────────────── helpers ─────────────────────────

function escHtml(s: unknown): string {
  const str = typeof s === 'string' ? s : (s == null ? '' : String(s));
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s: unknown): string {
  const str = typeof s === 'string' ? s : (s == null ? '' : String(s));
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderInline(nodes: PhrasingContent[]): string {
  return nodes.map(renderInlineNode).join('');
}

function renderInlineNode(n: PhrasingContent): string {
  switch (n.type) {
    case 'text':
      return escHtml((n as any).value);
    case 'strong':
      return `<strong>${renderInline((n as any).children)}</strong>`;
    case 'emphasis':
      return `<em>${renderInline((n as any).children)}</em>`;
    case 'inlineCode':
      return `<code>${escHtml((n as any).value)}</code>`;
    case 'break':
      return '<br/>';
    case 'link':
      return `<a href="${escAttr((n as any).url)}">${renderInline((n as any).children)}</a>`;
    case 'image':
      return `<img src="${escAttr((n as any).url)}" alt="${escAttr((n as any).alt ?? '')}" />`;
    case 'inlineMath':
      return katex.renderToString((n as any).value, { throwOnError: false, output: 'html' });
    case 'textDirective':
      return renderTextDirective(n as TextDirective);
    default:
      return '';
  }
}

function renderTextDirective(d: TextDirective): string {
  switch (d.name) {
    case 'primary':
      return `<span class="primary" style="font-weight: 700;">${renderInline(d.children as PhrasingContent[])}</span>`;
    case 'muted':
    case 'key':
      // Bullet markers — empty inline (handled at li level).
      return '';
    default:
      return renderInline(d.children as PhrasingContent[]);
  }
}

function consumeBulletMarker(li: ListItem): string | null {
  const first = li.children[0];
  if (first?.type !== 'paragraph') return null;
  const para = first as Paragraph;
  const head = para.children[0];
  if (head?.type !== 'textDirective') return null;
  const name = (head as TextDirective).name;
  if (name !== 'muted' && name !== 'key') return null;
  para.children.shift();
  const next = para.children[0];
  if (next?.type === 'text' && /^\s/.test(next.value)) {
    next.value = next.value.replace(/^\s+/, '');
  }
  return name === 'muted' ? 'muted-item' : 'key-item';
}

function renderBullets(list: List): string {
  const items = list.children
    .filter((c): c is ListItem => c.type === 'listItem')
    .map((li) => {
      const cls = consumeBulletMarker(li);
      const text = (li.children.length === 1 && li.children[0].type === 'paragraph')
        ? renderInline((li.children[0] as Paragraph).children)
        : li.children.map((c) => renderBlock(c as BlockContent)).join('');
      // Wrap content in a single block so the parent <li> grid sees exactly
      // two children (::before marker + .li-content). Without this, every
      // inline child of <li> becomes its own grid item and inline text after
      // a <span> gets placed into row 2 (the 16px marker column), causing
      // char-by-char wrap.
      const wrapped = `<div class="li-content">${text}</div>`;
      return cls ? `<li class="${cls}">${wrapped}</li>` : `<li>${wrapped}</li>`;
    });
  return `<ul class="bullets">\n        ${items.join('\n        ')}\n      </ul>`;
}

function renderBlock(node: BlockContent): string {
  switch (node.type) {
    case 'paragraph':
      return `<p>${renderInline((node as Paragraph).children)}</p>`;
    case 'table':
      return renderTable(node as any);
    case 'list':
      return renderBullets(node as List);
    case 'heading': {
      const h = node as Heading;
      return `<h${h.depth}>${renderInline(h.children)}</h${h.depth}>`;
    }
    case 'math':
      return katex.renderToString((node as any).value, {
        throwOnError: false,
        displayMode: true,
        output: 'html',
      });
    default:
      return '';
  }
}

function findHeading(children: any[]): Heading | undefined {
  return children.find((c) => c.type === 'heading' && c.depth === 1) as Heading | undefined;
}
function findFirstHeading(children: any[]): Heading | undefined {
  return children.find((c) => c.type === 'heading') as Heading | undefined;
}
function findFirstParagraph(children: any[]): Paragraph | undefined {
  return children.find((c) => c.type === 'paragraph') as Paragraph | undefined;
}
function findFirstList(children: any[]): List | undefined {
  return children.find((c) => c.type === 'list') as List | undefined;
}
function findFirstImage(children: any[]): Image | undefined {
  for (const c of children) {
    if (c.type === 'paragraph') {
      const img = (c as Paragraph).children.find((x) => x.type === 'image');
      if (img) return img as Image;
    }
    if (c.type === 'image') return c as Image;
  }
  return undefined;
}
function findLeaves(children: any[], name: string): LeafDirective[] {
  return children.filter(
    (c) => c.type === 'leafDirective' && (c as LeafDirective).name === name
  ) as LeafDirective[];
}

function extractSpeakerNote(d: ContainerDirective): string {
  const collected: ContainerDirective[] = [];
  d.children = (d.children ?? []).filter((c: any) => {
    if (c.type === 'containerDirective' && (c as ContainerDirective).name === 'speaker-note') {
      collected.push(c as ContainerDirective);
      return false;
    }
    return true;
  }) as any;
  if (collected.length === 0) return '';
  return collected
    .map((nc) => (nc.children ?? []).map((c: any) => renderNotesBlock(c as BlockContent)).join('\n'))
    .join('\n');
}

// Plain markdown → HTML for the presenter notes panel. Mirrors `renderBlock`
// but emits semantic <ul><li> instead of the slide-body `<ul class="bullets">`
// grid markup, so the notes panel's own CSS (small body text) applies cleanly
// instead of inheriting the 1920×1080 slide-body bullet styling.
function renderNotesBlock(node: BlockContent): string {
  switch (node.type) {
    case 'paragraph':
      return `<p>${renderInline((node as Paragraph).children)}</p>`;
    case 'list':
      return renderNotesList(node as List);
    case 'heading': {
      const h = node as Heading;
      return `<h${h.depth}>${renderInline(h.children)}</h${h.depth}>`;
    }
    case 'table':
      return renderTable(node as any);
    case 'math':
      return katex.renderToString((node as any).value, {
        throwOnError: false,
        displayMode: true,
        output: 'html',
      });
    default:
      return '';
  }
}

function renderNotesList(list: List): string {
  const items = list.children
    .filter((c): c is ListItem => c.type === 'listItem')
    .map((li) => {
      // Strip leading :muted / :key marker (slide-body only; meaningless in notes).
      const first = li.children[0];
      if (first?.type === 'paragraph') {
        const head = (first as Paragraph).children[0];
        if (head?.type === 'textDirective') {
          const name = (head as TextDirective).name;
          if (name === 'muted' || name === 'key') {
            (first as Paragraph).children.shift();
            const next = (first as Paragraph).children[0];
            if (next?.type === 'text' && /^\s/.test((next as any).value)) {
              (next as any).value = (next as any).value.replace(/^\s+/, '');
            }
          }
        }
      }
      const body = (li.children.length === 1 && li.children[0].type === 'paragraph')
        ? renderInline((li.children[0] as Paragraph).children)
        : li.children.map((c) => renderNotesBlock(c as BlockContent)).join('');
      return `<li>${body}</li>`;
    });
  return `<ul>${items.join('')}</ul>`;
}

function dataLabel(label: string | undefined): string {
  return label ? ` data-label="${escAttr(label)}"` : '';
}

// ───────────────────────── chrome (corner metadata) ─────────────────────────

type ChromeCtx = { fm: Frontmatter; n: number; total: number; section: string };

function substituteChromeTokens(template: string, ctx: ChromeCtx): string {
  return template.replace(/\{([^}]+)\}/g, (_, key) => {
    if (key === 'n') return String(ctx.n);
    if (key === 'total') return String(ctx.total);
    if (key === 'section') return ctx.section;
    const v = (ctx.fm as any)[key];
    return typeof v === 'string' ? v : '';
  });
}

const CHROME_HIDDEN_LAYOUTS = new Set(['cover', 'divider']);

function buildChromeHtml(
  layoutName: string,
  perSlideAttr: unknown,
  ctx: ChromeCtx,
): string {
  let show: boolean;
  if (perSlideAttr === 'true' || perSlideAttr === true) show = true;
  else if (perSlideAttr === 'false' || perSlideAttr === false) show = false;
  else show = !CHROME_HIDDEN_LAYOUTS.has(layoutName);

  if (!show) return '';

  const chrome = ctx.fm.chrome ?? {};
  const slots: Array<['tl' | 'tr' | 'bl' | 'br', string | undefined]> = [
    ['tl', chrome.topLeft],
    ['tr', chrome.topRight],
    ['bl', chrome.bottomLeft],
    ['br', chrome.bottomRight],
  ];
  const corners: string[] = [];
  for (const [pos, tpl] of slots) {
    if (!tpl) continue;
    const text = substituteChromeTokens(tpl, ctx);
    if (text.trim().length === 0) continue;
    corners.push(`<div class="corner ${pos}">${escHtml(text)}</div>`);
  }
  if (corners.length === 0) return '';
  return `<div class="slide-chrome" aria-hidden="true">${corners.join('')}</div>`;
}

function injectChrome(slideHtml: string, chromeHtml: string): string {
  if (!chromeHtml) return slideHtml;
  return slideHtml.replace(/^(<section[^>]*>)/, `$1\n    ${chromeHtml}`);
}

function extractDirectiveTitleText(d: ContainerDirective): string {
  const heading = findFirstHeading(d.children);
  const nodes = heading ? heading.children : findFirstParagraph(d.children)?.children;
  if (!nodes) return '';
  const walk = (arr: any[]): string =>
    arr
      .map((c: any) => {
        if (c.type === 'text') return c.value as string;
        if (Array.isArray(c.children)) return walk(c.children);
        return '';
      })
      .join('');
  return walk(nodes).trim();
}

/** Build `data-align` / `data-valign` attribute string from a directive's attrs. */
function alignAttrs(attrs: Record<string, any>): string {
  const parts: string[] = [];
  const align = attrs.align;
  const valign = attrs.valign;
  if (align && ['left', 'center', 'right'].includes(align)) {
    parts.push(`data-align="${align}"`);
  }
  if (valign && ['top', 'center', 'bottom'].includes(valign)) {
    parts.push(`data-valign="${valign}"`);
  }
  return parts.length ? ' ' + parts.join(' ') : '';
}

/** Split a node's children into block groups separated by thematic breaks (---). */
function splitByThematicBreak(children: any[]): any[][] {
  const groups: any[][] = [[]];
  for (const c of children) {
    if (c.type === 'thematicBreak') {
      groups.push([]);
    } else {
      groups[groups.length - 1].push(c);
    }
  }
  return groups.filter((g) => g.length > 0);
}

/** Detect if children contain any thematic break (= v2 composition mode). */
function hasThematicBreak(children: any[]): boolean {
  return children.some((c) => c.type === 'thematicBreak');
}

/** Detect if a block group is "media-only" (image-only) vs text. */
function isMediaOnly(children: any[]): boolean {
  if (children.length === 0) return false;
  return children.every((c) => {
    if (c.type === 'image') return true;
    if (c.type === 'paragraph') {
      return (c.children ?? []).every((x: any) => x.type === 'image');
    }
    return false;
  });
}

/** Render a generic block node (heading / list / paragraph / image-paragraph). */
function renderGenericBlock(
  node: any,
  imgVariant: 'split' | 'single' = 'split',
): string {
  switch (node.type) {
    case 'heading': {
      const h = node as Heading;
      if (h.depth === 1) {
        return `<h1 class="h1" style="margin: 0 0 var(--gap-title);">${renderInline(h.children)}</h1>`;
      }
      return `<h${h.depth}>${renderInline(h.children)}</h${h.depth}>`;
    }
    case 'list':
      return renderBullets(node as List);
    case 'table':
      return renderTable(node);
    case 'paragraph': {
      const p = node as Paragraph;
      // Image-only paragraph
      if (p.children.length === 1 && p.children[0].type === 'image') {
        return renderImageBlock(p.children[0] as Image, true, imgVariant);
      }
      return `<p class="body" style="font-size: var(--type-body); margin: 0 0 16px;">${renderInline(p.children)}</p>`;
    }
    case 'image':
      return renderImageBlock(node as Image, true, imgVariant);
    case 'math':
      return renderBlock(node);
    case 'code': {
      const lang = (node as any).lang ?? '';
      const value = (node as any).value ?? '';
      const cls = lang ? ` class="language-${escAttr(lang)}"` : '';
      return `<pre class="code-block"><code${cls}>${escHtml(value)}</code></pre>`;
    }
    case 'leafDirective':
      return renderLeafElement(node as LeafDirective);
    case 'containerDirective':
      return renderContainerElement(node as ContainerDirective);
    default:
      return '';
  }
}

function renderContainerElement(d: ContainerDirective): string {
  if (d.name === 'stats') return renderStatsGroup(d);
  if (d.name === 'chart') return renderChartEmbed(d);
  if (d.name === 'plot')  return renderPlotEmbed(d);
  return '';
}

function renderPlotEmbed(d: ContainerDirective): string {
  const attrs = d.attributes ?? {};
  const caption = String(attrs.caption ?? '');
  let xMin: number, xMax: number;
  try {
    [xMin, xMax] = parseRange((attrs.x as string) ?? '[-5, 5]');
  } catch (e: any) {
    throw new EngineError(`plot x-range error: ${e.message}`, { line: d.position?.start.line });
  }
  let yMinOverride: number | undefined, yMaxOverride: number | undefined;
  if (attrs.y) {
    try {
      [yMinOverride, yMaxOverride] = parseRange(attrs.y as string);
    } catch (e: any) {
      throw new EngineError(`plot y-range error: ${e.message}`, { line: d.position?.start.line });
    }
  }
  const textNodes = (d.children ?? []).filter(
    (c: any) => c.type !== 'heading' && c.type !== 'table',
  );
  const body = textNodes.map(mdastTextOf).join('\n');
  const exprs = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => l.replace(/^y\s*=\s*/i, '').trim());
  const tableNode = (d.children ?? []).find((c: any) => c.type === 'table');
  let scatter: ScatterSeries[] = [];
  if (tableNode) {
    try {
      scatter = parseScatterTable(tableNode);
    } catch (e: any) {
      throw new EngineError(`plot scatter table error: ${e.message}`, { line: d.position?.start.line });
    }
  }
  if (exprs.length === 0 && scatter.length === 0) {
    throw new EngineError(
      `:::plot needs at least one function expression OR a scatter table.`,
      { line: d.position?.start.line },
    );
  }
  let fns: Array<(x: number) => number>;
  try {
    fns = exprs.map(compileExpr);
  } catch (e: any) {
    throw new EngineError(`plot expression error: ${e.message}`, { line: d.position?.start.line });
  }
  if (!attrs.x && fns.length === 0 && scatter.length > 0) {
    const xs = scatter.flatMap((s) => s.points.map((p) => p[0]));
    if (xs.length > 0) {
      const xmin = Math.min(...xs), xmax = Math.max(...xs);
      const pad = (xmax - xmin) * 0.1 || 1;
      xMin = xmin - pad;
      xMax = xmax + pad;
    }
  }
  const svg = renderPlotSvg(fns, exprs, scatter, xMin, xMax, yMinOverride, yMaxOverride);
  const capHtml = caption
    ? `<div class="chart-caption">${escHtml(caption)}</div>`
    : '';
  return `<div class="chart-embed">
      <div class="plot-stage">${svg}</div>
      ${capHtml}
    </div>`;
}

function renderChartEmbed(d: ContainerDirective): string {
  const attrs = d.attributes ?? {};
  const type = String(attrs.type ?? 'bar').toLowerCase();
  if (!['bar', 'line', 'pie'].includes(type)) {
    throw new EngineError(
      `:::chart type "${type}" not supported. Use bar | line | pie.`,
      { line: d.position?.start.line },
    );
  }
  const caption = String(attrs.caption ?? '');
  const tableNode = (d.children ?? []).find((c: any) => c.type === 'table');
  if (!tableNode) {
    throw new EngineError(
      `:::chart needs a markdown table inside (header row + data rows).`,
      { line: d.position?.start.line },
    );
  }
  let data: ChartData;
  try {
    data = parseChartTable(tableNode);
  } catch (e: any) {
    throw new EngineError(`chart data error: ${e.message}`, { line: d.position?.start.line });
  }
  const svg =
    type === 'pie'  ? renderPieSvg(data) :
    type === 'line' ? renderLineSvg(data) :
                      renderBarSvg(data);
  const capHtml = caption
    ? `<div class="chart-caption">${escHtml(caption)}</div>`
    : '';
  return `<div class="chart-embed">
      <div class="chart-stage">${svg}</div>
      ${capHtml}
    </div>`;
}

function renderStatsGroup(d: ContainerDirective): string {
  const attrs = d.attributes ?? {};
  const isColumn = attrs.column !== undefined;
  const cls = isColumn ? 'stats-group' : 'stats-group row';
  const inner = (d.children ?? [])
    .map((c) => renderGenericBlock(c))
    .filter((s) => s.trim().length > 0)
    .join('\n      ');
  return `<div class="${cls}">${inner}</div>`;
}

// ───────────────────────── block-level element directives ─────────────────────────

function renderLeafElement(d: LeafDirective): string {
  switch (d.name) {
    case 'video':   return renderVideoElement(d);
    case 'callout': return renderCalloutElement(d);
    case 'note':    return renderNoteElement(d);
    case 'stat':    return renderStatElement(d);
    default:        return '';
  }
}

function renderVideoElement(d: LeafDirective): string {
  const attrs = d.attributes ?? {};
  const src = String(attrs.src ?? '');
  if (!src) {
    throw new EngineError(`::video requires src attribute.`, { line: d.position?.start.line });
  }
  const caption = String(attrs.caption ?? '');
  const autoplay = attrs.autoplay !== undefined;
  const ytMatch = src.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]+)/);
  let mediaHtml: string;
  if (ytMatch) {
    const id = ytMatch[1];
    const params = autoplay ? 'rel=0&autoplay=1&mute=1' : 'rel=0';
    mediaHtml = `<iframe src="https://www.youtube.com/embed/${id}?${params}" frameborder="0" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>`;
  } else {
    const ap = autoplay ? ' autoplay muted' : '';
    mediaHtml = `<video src="${escAttr(src)}" controls${ap}></video>`;
  }
  const capHtml = caption
    ? `<div class="video-caption">${escHtml(caption)}</div>`
    : '';
  return `<div class="video-block">${mediaHtml}${capHtml}</div>`;
}

function renderCalloutElement(d: LeafDirective): string {
  const attrs = d.attributes ?? {};
  const detail = String(attrs.detail ?? '');
  const msg = renderInline(d.children as PhrasingContent[]);
  const detailHtml = detail ? `<div class="callout-detail">${escHtml(detail)}</div>` : '';
  return `<div class="callout-block">
      <div class="callout-main">${msg}</div>
      ${detailHtml}
    </div>`;
}

function renderNoteElement(d: LeafDirective): string {
  const text = renderInline(d.children as PhrasingContent[]);
  return `<div class="note-block">* ${text}</div>`;
}

function renderStatElement(d: LeafDirective): string {
  const attrs = d.attributes ?? {};
  const lbl = String(attrs.label ?? '');
  const isPrimary = attrs.primary !== undefined;
  const isReverse = attrs.reverse !== undefined;
  const value = renderInline(d.children as PhrasingContent[]);
  const numCls = isPrimary ? 'stat-num primary' : 'stat-num';
  const blockCls = isReverse ? 'stat-block reverse' : 'stat-block';
  return `<div class="${blockCls}">
      <div class="stat-lbl">${escHtml(lbl)}</div>
      <div class="${numCls}">${value}</div>
    </div>`;
}

// ───────────────────────── tables ─────────────────────────

function renderTable(node: any): string {
  const rows = (node.children ?? []) as any[];
  if (rows.length === 0) return '';
  const align = (node.align ?? []) as Array<string | null>;
  const headerRow = rows[0];
  const bodyRows = rows.slice(1);
  const cellAlign = (i: number) => align[i] ? ` style="text-align: ${align[i]}"` : '';
  const headerHtml = (headerRow.children as any[])
    .map((c, i) => `<th${cellAlign(i)}>${renderInline(c.children)}</th>`)
    .join('');
  const bodyHtml = bodyRows
    .map((r) => {
      const cells = (r.children as any[])
        .map((c, i) => `<td${cellAlign(i)}>${renderInline(c.children)}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('\n        ');
  return `<table class="md-table"><thead><tr>${headerHtml}</tr></thead><tbody>\n        ${bodyHtml}\n      </tbody></table>`;
}

// ───────────────────────── chart / plot helpers ─────────────────────────

const CHART_PALETTE = [
  'oklch(0.56 0.165 30)',   // terracotta
  'oklch(0.56 0.115 200)',  // teal
  'oklch(0.56 0.140 75)',   // mustard
  'oklch(0.56 0.110 130)',  // sage
  'oklch(0.56 0.115 340)',  // mauve
  'oklch(0.56 0.080 235)',  // sky
  'oklch(0.56 0.155 18)',   // rust
  'oklch(0.56 0.010 75)',   // stone
];

function mdastTextOf(node: any): string {
  if (!node) return '';
  if (node.type === 'text') return node.value ?? '';
  if (node.type === 'break') return '\n';
  if (node.type === 'inlineCode') return node.value ?? '';
  if (Array.isArray(node.children)) return node.children.map(mdastTextOf).join('');
  return '';
}

function directiveBodyText(d: ContainerDirective): string {
  // Multiple paragraphs separated by blank lines → join with '\n\n'.
  // Soft breaks within a paragraph → '\n'.
  return (d.children ?? [])
    .map((c) => mdastTextOf(c))
    .join('\n')
    .trim();
}

function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return '';
  if (Math.abs(v) < 1e-9) return '0';
  if (Number.isInteger(v)) return String(v);
  // Avoid floating-point ugliness
  const s = v.toFixed(3);
  return s.replace(/\.?0+$/, '');
}

function niceStep(roughStep: number): number {
  if (roughStep <= 0) return 1;
  const exp = Math.floor(Math.log10(roughStep));
  const mantissa = roughStep / Math.pow(10, exp);
  let nice;
  if (mantissa < 1.5) nice = 1;
  else if (mantissa < 3) nice = 2;
  else if (mantissa < 7) nice = 5;
  else nice = 10;
  return nice * Math.pow(10, exp);
}

function niceTicks(min: number, max: number, count: number): number[] {
  if (max <= min) return [min];
  const step = niceStep((max - min) / count);
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) {
    ticks.push(Number(v.toFixed(10)));
  }
  return ticks;
}

// ───────────── chart: parse table → series + render SVG ───────

type ChartData = { labels: string[]; series: { name: string; values: number[] }[] };

function parseChartTable(table: any): ChartData {
  const rows = (table.children ?? []) as any[];
  if (rows.length < 2) {
    throw new Error('chart table needs at least header row + 1 data row');
  }
  const headerCells = (rows[0].children ?? []) as any[];
  const seriesNames = headerCells.slice(1).map((c) => mdastTextOf(c).trim());
  const labels: string[] = [];
  const series = seriesNames.map((name) => ({ name, values: [] as number[] }));
  for (const row of rows.slice(1)) {
    const cells = (row.children ?? []) as any[];
    labels.push(mdastTextOf(cells[0]).trim());
    cells.slice(1).forEach((c, i) => {
      if (i >= series.length) return;
      const txt = mdastTextOf(c).trim();
      const num = parseFloat(txt.replace(/,/g, '').replace(/[^\d.\-eE+]/g, ''));
      series[i].values.push(Number.isFinite(num) ? num : 0);
    });
  }
  return { labels, series };
}

function renderBarSvg({ labels, series }: ChartData): string {
  const W = 1400, H = 600;
  const padL = 100, padR = 40, padT = 60, padB = 80;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const allVals = series.flatMap((s) => s.values);
  const maxVal = Math.max(...allVals, 0);
  const minVal = Math.min(...allVals, 0);
  const range = maxVal - minVal || 1;
  const yScale = (v: number) => padT + innerH - ((v - minVal) / range) * innerH;
  const groupW = innerW / Math.max(labels.length, 1);
  const barW = groupW / (series.length + 1);
  const ticks = niceTicks(minVal, maxVal, 5);
  const grid = ticks.map((t) =>
    `<line x1="${padL}" y1="${yScale(t)}" x2="${W - padR}" y2="${yScale(t)}" stroke="#E5E1DA" stroke-width="1" />` +
    `<text x="${padL - 10}" y="${yScale(t)}" text-anchor="end" dominant-baseline="middle" fill="#8A8580" font-size="18" font-family="JetBrains Mono, monospace">${formatNumber(t)}</text>`
  ).join('');
  const xLabels = labels.map((l, i) =>
    `<text x="${padL + (i + 0.5) * groupW}" y="${H - padB + 28}" text-anchor="middle" fill="#8A8580" font-size="20" font-family="JetBrains Mono, monospace">${escHtml(l)}</text>`
  ).join('');
  const bars = series.flatMap((s, si) =>
    s.values.map((v, vi) => {
      const x = padL + vi * groupW + (si + 0.5) * barW + barW * 0.25;
      const y = yScale(Math.max(v, 0));
      const h = Math.abs(yScale(v) - yScale(0));
      return `<rect x="${x}" y="${y}" width="${barW * 0.7}" height="${h}" fill="${CHART_PALETTE[si % CHART_PALETTE.length]}" />`;
    })
  ).join('');
  const legend = series.length > 1
    ? series.map((s, i) =>
        `<g transform="translate(${padL + i * 240}, 24)">` +
        `<rect width="18" height="18" fill="${CHART_PALETTE[i % CHART_PALETTE.length]}" />` +
        `<text x="26" y="14" fill="#1A1A1A" font-size="20" font-family="Pretendard, sans-serif">${escHtml(s.name)}</text>` +
        `</g>`
      ).join('')
    : '';
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: auto; max-height: 70vh;">${legend}${grid}${xLabels}${bars}<line x1="${padL}" y1="${yScale(0)}" x2="${W - padR}" y2="${yScale(0)}" stroke="#1A1A1A" stroke-width="1.5" /></svg>`;
}

function renderLineSvg({ labels, series }: ChartData): string {
  const W = 1400, H = 600;
  const padL = 100, padR = 40, padT = 60, padB = 80;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const allVals = series.flatMap((s) => s.values);
  const maxVal = Math.max(...allVals, 0);
  const minVal = Math.min(...allVals, 0);
  const range = maxVal - minVal || 1;
  const yScale = (v: number) => padT + innerH - ((v - minVal) / range) * innerH;
  const xScale = (i: number) => padL + (i / Math.max(labels.length - 1, 1)) * innerW;
  const ticks = niceTicks(minVal, maxVal, 5);
  const grid = ticks.map((t) =>
    `<line x1="${padL}" y1="${yScale(t)}" x2="${W - padR}" y2="${yScale(t)}" stroke="#E5E1DA" stroke-width="1" />` +
    `<text x="${padL - 10}" y="${yScale(t)}" text-anchor="end" dominant-baseline="middle" fill="#8A8580" font-size="18" font-family="JetBrains Mono, monospace">${formatNumber(t)}</text>`
  ).join('');
  const xLabels = labels.map((l, i) =>
    `<text x="${xScale(i)}" y="${H - padB + 28}" text-anchor="middle" fill="#8A8580" font-size="20" font-family="JetBrains Mono, monospace">${escHtml(l)}</text>`
  ).join('');
  const lines = series.map((s, si) => {
    const color = CHART_PALETTE[si % CHART_PALETTE.length];
    const points = s.values.map((v, i) => `${xScale(i)},${yScale(v)}`).join(' ');
    const dots = s.values.map((v, i) =>
      `<circle cx="${xScale(i)}" cy="${yScale(v)}" r="5" fill="${color}" />`
    ).join('');
    return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />${dots}`;
  }).join('');
  const legend = series.length > 1
    ? series.map((s, i) =>
        `<g transform="translate(${padL + i * 240}, 24)">` +
        `<line x1="0" y1="9" x2="22" y2="9" stroke="${CHART_PALETTE[i % CHART_PALETTE.length]}" stroke-width="3" />` +
        `<text x="30" y="14" fill="#1A1A1A" font-size="20" font-family="Pretendard, sans-serif">${escHtml(s.name)}</text>` +
        `</g>`
      ).join('')
    : '';
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: auto; max-height: 70vh;">${legend}${grid}${xLabels}${lines}<line x1="${padL}" y1="${yScale(0)}" x2="${W - padR}" y2="${yScale(0)}" stroke="#1A1A1A" stroke-width="1.5" /></svg>`;
}

function renderPieSvg({ labels, series }: ChartData): string {
  const W = 1400, H = 600;
  const cx = W / 2, cy = H / 2;
  const r = 220;
  const values = series[0]?.values ?? labels.map(() => 1);
  const total = values.reduce((a, b) => a + b, 0) || 1;
  let angle = -Math.PI / 2;
  const slices = values.map((v, i) => {
    const sliceAngle = (v / total) * 2 * Math.PI;
    const startA = angle;
    angle += sliceAngle;
    const endA = angle;
    const x1 = cx + r * Math.cos(startA);
    const y1 = cy + r * Math.sin(startA);
    const x2 = cx + r * Math.cos(endA);
    const y2 = cy + r * Math.sin(endA);
    const largeArc = sliceAngle > Math.PI ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    const midA = (startA + endA) / 2;
    const lx = cx + (r + 30) * Math.cos(midA);
    const ly = cy + (r + 30) * Math.sin(midA);
    const anchor = Math.cos(midA) > 0 ? 'start' : 'end';
    const pct = ((v / total) * 100).toFixed(1) + '%';
    return `<path d="${path}" fill="${CHART_PALETTE[i % CHART_PALETTE.length]}" stroke="#FAF9F7" stroke-width="2" />` +
           `<text x="${lx}" y="${ly}" text-anchor="${anchor}" dominant-baseline="middle" fill="#1A1A1A" font-size="22" font-family="Pretendard, sans-serif">${escHtml(labels[i])} ${pct}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: auto; max-height: 70vh;">${slices}</svg>`;
}

// ───────────── plot: expression parser + SVG ───────────

type Token =
  | { type: 'num'; value: number }
  | { type: 'op'; value: string }
  | { type: 'fn'; value: string }
  | { type: 'var'; value: 'x' }
  | { type: 'paren'; value: '(' | ')' };

const FN_NAMES = new Set(['sin','cos','tan','exp','log','ln','sqrt','abs','asin','acos','atan']);

function tokenizeExpr(s: string): Token[] {
  const tokens: Token[] = [];
  const src = s.replace(/π/g, 'pi').replace(/−/g, '-').replace(/\s+/g, '');
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/[\d.]/.test(c)) {
      let j = i;
      while (j < src.length && /[\d.]/.test(src[j])) j++;
      tokens.push({ type: 'num', value: parseFloat(src.slice(i, j)) });
      i = j;
    } else if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z]/.test(src[j])) j++;
      const name = src.slice(i, j);
      if (name === 'pi') tokens.push({ type: 'num', value: Math.PI });
      else if (name === 'e') tokens.push({ type: 'num', value: Math.E });
      else if (name === 'x') tokens.push({ type: 'var', value: 'x' });
      else if (FN_NAMES.has(name)) tokens.push({ type: 'fn', value: name });
      else throw new Error(`unknown identifier "${name}"`);
      i = j;
    } else if ('+-*/^'.includes(c)) {
      tokens.push({ type: 'op', value: c });
      i++;
    } else if (c === '(' || c === ')') {
      tokens.push({ type: 'paren', value: c as '(' | ')' });
      i++;
    } else {
      throw new Error(`unexpected character "${c}"`);
    }
  }
  return tokens;
}

function preprocessUnary(tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (const t of tokens) {
    const prev = out[out.length - 1];
    if (
      t.type === 'op' && t.value === '-' &&
      (!prev || prev.type === 'op' || (prev.type === 'paren' && prev.value === '('))
    ) {
      out.push({ type: 'num', value: 0 });
    }
    out.push(t);
  }
  return out;
}

function toRPN(tokens: Token[]): Token[] {
  const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };
  const RIGHT: Record<string, boolean> = { '^': true };
  const out: Token[] = [];
  const stack: Token[] = [];
  for (const t of tokens) {
    if (t.type === 'num' || t.type === 'var') out.push(t);
    else if (t.type === 'fn') stack.push(t);
    else if (t.type === 'op') {
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.type === 'fn') { out.push(stack.pop()!); continue; }
        if (top.type !== 'op') break;
        const tp = PREC[t.value], topP = PREC[top.value];
        if (topP > tp || (topP === tp && !RIGHT[t.value])) out.push(stack.pop()!);
        else break;
      }
      stack.push(t);
    } else if (t.type === 'paren' && t.value === '(') {
      stack.push(t);
    } else {
      while (stack.length && !(stack[stack.length - 1].type === 'paren' && (stack[stack.length - 1] as any).value === '(')) {
        out.push(stack.pop()!);
      }
      if (!stack.length) throw new Error('mismatched parentheses');
      stack.pop();
      if (stack.length && stack[stack.length - 1].type === 'fn') out.push(stack.pop()!);
    }
  }
  while (stack.length) {
    const t = stack.pop()!;
    if (t.type === 'paren') throw new Error('mismatched parentheses');
    out.push(t);
  }
  return out;
}

function compileExpr(expr: string): (x: number) => number {
  const rpn = toRPN(preprocessUnary(tokenizeExpr(expr)));
  return (x: number) => {
    const stack: number[] = [];
    for (const t of rpn) {
      if (t.type === 'num') stack.push(t.value);
      else if (t.type === 'var') stack.push(x);
      else if (t.type === 'op') {
        const b = stack.pop()!, a = stack.pop()!;
        switch (t.value) {
          case '+': stack.push(a + b); break;
          case '-': stack.push(a - b); break;
          case '*': stack.push(a * b); break;
          case '/': stack.push(a / b); break;
          case '^': stack.push(Math.pow(a, b)); break;
        }
      } else if (t.type === 'fn') {
        const v = stack.pop()!;
        const fnName = t.value === 'ln' ? 'log' : t.value;
        stack.push((Math as any)[fnName](v));
      }
    }
    return stack[0];
  };
}

function parseRange(s: string): [number, number] {
  const cleaned = s.replace(/[\[\]]/g, '').split(',').map((p) => p.trim());
  if (cleaned.length !== 2) throw new Error(`invalid range "${s}" — use [min, max]`);
  const parseBound = (b: string) => {
    const tokens = tokenizeExpr(b.replace(/^\s*-\s*/, '-').trim() || '0');
    return compileExpr(b.trim())(0);
  };
  return [parseBound(cleaned[0]), parseBound(cleaned[1])];
}

/** Parse a single numeric value, supporting expressions like "pi/2", "-pi", "e^2". */
function parseScalar(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return NaN;
  try {
    return compileExpr(trimmed)(0);
  } catch {
    return parseFloat(trimmed);
  }
}

type ScatterSeries = { name: string; points: Array<[number, number]> };

function parseScatterTable(table: any): ScatterSeries[] {
  const rows = (table.children ?? []) as any[];
  if (rows.length < 2) return [];
  const headers = (rows[0].children ?? []) as any[];
  const seriesNames = headers.slice(1).map((c) => mdastTextOf(c).trim());
  const series: ScatterSeries[] = seriesNames.map((name) => ({ name, points: [] }));
  for (const row of rows.slice(1)) {
    const cells = (row.children ?? []) as any[];
    const x = parseScalar(mdastTextOf(cells[0]));
    cells.slice(1).forEach((c, i) => {
      if (i >= series.length) return;
      const y = parseScalar(mdastTextOf(c));
      if (Number.isFinite(x) && Number.isFinite(y)) {
        series[i].points.push([x, y]);
      }
    });
  }
  return series;
}

function renderPlotSvg(
  fns: Array<(x: number) => number>,
  exprs: string[],
  scatter: ScatterSeries[],
  xMin: number, xMax: number,
  yMinOverride?: number, yMaxOverride?: number,
): string {
  const W = 1400, H = 600;
  const padL = 80, padR = 40, padT = 40, padB = 70;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const samples = 400;
  const allCurves: Array<Array<[number, number]>> = fns.map((fn) => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= samples; i++) {
      const x = xMin + (i / samples) * (xMax - xMin);
      const y = fn(x);
      pts.push([x, y]);
    }
    return pts;
  });
  let yMin = yMinOverride, yMax = yMaxOverride;
  if (yMin === undefined || yMax === undefined) {
    const curveYs = allCurves.flatMap((c) => c.map((p) => p[1])).filter((v) => Number.isFinite(v));
    const scatterYs = scatter.flatMap((s) => s.points.map((p) => p[1]));
    const finite = [...curveYs, ...scatterYs].filter((v) => Number.isFinite(v));
    if (finite.length) {
      const ymin = Math.min(...finite), ymax = Math.max(...finite);
      const pad = (ymax - ymin) * 0.1 || 1;
      yMin = yMin ?? ymin - pad;
      yMax = yMax ?? ymax + pad;
    } else {
      yMin = -1; yMax = 1;
    }
  }
  const xScale = (x: number) => padL + ((x - xMin) / (xMax - xMin)) * innerW;
  const yScale = (y: number) => padT + innerH - ((y - yMin!) / (yMax! - yMin!)) * innerH;
  const xTicks = niceTicks(xMin, xMax, 8);
  const yTicks = niceTicks(yMin!, yMax!, 6);
  const grid = [
    ...xTicks.map((t) => `<line x1="${xScale(t)}" y1="${padT}" x2="${xScale(t)}" y2="${H - padB}" stroke="#E5E1DA" stroke-width="1" />`),
    ...yTicks.map((t) => `<line x1="${padL}" y1="${yScale(t)}" x2="${W - padR}" y2="${yScale(t)}" stroke="#E5E1DA" stroke-width="1" />`),
  ].join('');
  let axes = '';
  if (xMin <= 0 && xMax >= 0) axes += `<line x1="${xScale(0)}" y1="${padT}" x2="${xScale(0)}" y2="${H - padB}" stroke="#1A1A1A" stroke-width="1.5" />`;
  if (yMin! <= 0 && yMax! >= 0) axes += `<line x1="${padL}" y1="${yScale(0)}" x2="${W - padR}" y2="${yScale(0)}" stroke="#1A1A1A" stroke-width="1.5" />`;
  const xLabels = xTicks.map((t) => `<text x="${xScale(t)}" y="${H - padB + 22}" text-anchor="middle" fill="#8A8580" font-size="16" font-family="JetBrains Mono, monospace">${formatNumber(t)}</text>`).join('');
  const yLabels = yTicks.map((t) => `<text x="${padL - 8}" y="${yScale(t)}" text-anchor="end" dominant-baseline="middle" fill="#8A8580" font-size="16" font-family="JetBrains Mono, monospace">${formatNumber(t)}</text>`).join('');
  const curves = allCurves.map((points, i) => {
    if (!points.length) return '';
    const color = CHART_PALETTE[i % CHART_PALETTE.length];
    // Break path on non-finite Y values
    let path = '';
    let started = false;
    for (const [x, y] of points) {
      if (!Number.isFinite(y) || y < yMin! - (yMax! - yMin!) || y > yMax! + (yMax! - yMin!)) {
        started = false; continue;
      }
      path += (started ? 'L' : 'M') + ` ${xScale(x).toFixed(2)} ${yScale(y).toFixed(2)} `;
      started = true;
    }
    return `<path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" />`;
  }).join('');
  // Scatter points — colors continue after function curves to keep legend distinct
  const scatterDots = scatter.map((s, i) => {
    const color = CHART_PALETTE[(fns.length + i) % CHART_PALETTE.length];
    return s.points
      .filter(([x, y]) => x >= xMin && x <= xMax && y >= yMin! && y <= yMax!)
      .map(([x, y]) =>
        `<circle cx="${xScale(x).toFixed(2)}" cy="${yScale(y).toFixed(2)}" r="6" fill="${color}" stroke="#FAF9F7" stroke-width="1.5" />`,
      ).join('');
  }).join('');
  // Combined legend (functions then scatter)
  const legendItems: string[] = [];
  exprs.forEach((e, i) => {
    legendItems.push(
      `<g transform="translate(${W - padR - 280}, ${padT + 12 + legendItems.length * 28})">` +
      `<line x1="0" y1="9" x2="22" y2="9" stroke="${CHART_PALETTE[i % CHART_PALETTE.length]}" stroke-width="2.5" />` +
      `<text x="30" y="14" fill="#1A1A1A" font-size="18" font-family="JetBrains Mono, monospace">y = ${escHtml(e)}</text>` +
      `</g>`,
    );
  });
  scatter.forEach((s, i) => {
    legendItems.push(
      `<g transform="translate(${W - padR - 280}, ${padT + 12 + legendItems.length * 28})">` +
      `<circle cx="11" cy="9" r="6" fill="${CHART_PALETTE[(fns.length + i) % CHART_PALETTE.length]}" />` +
      `<text x="30" y="14" fill="#1A1A1A" font-size="18" font-family="JetBrains Mono, monospace">${escHtml(s.name || `series ${i + 1}`)}</text>` +
      `</g>`,
    );
  });
  const legend = legendItems.join('');
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: auto; max-height: 70vh;">${grid}${axes}${xLabels}${yLabels}${curves}${scatterDots}${legend}</svg>`;
}

// ───────────────────────── slide renderers ─────────────────────────

function renderSlide(d: ContainerDirective, fm: Frontmatter): string | null {
  const label = (d.attributes ?? {}).label as string | undefined;
  switch (d.name) {
    case 'cover':      return renderCover(d, label, fm);
    case 'split':      return renderSplit(d, label);
    case 'single':     return renderBulletsOnly(d, label);
    case 'bullets':    return renderBulletsOnly(d, label); // alias (deprecated)
    case 'divider':    return renderDivider(d, label);
    case 'index':      return renderIndex(d, label);
    default:
      throw new EngineError(
        `Unknown slide layout: ":::${d.name}". Valid layouts: cover, split, single, divider, index.`,
        { line: d.position?.start.line },
      );
  }
}



function renderCover(d: ContainerDirective, label: string | undefined, fm: Frontmatter): string {
  const variant = (d.attributes ?? {}).variant;
  if (variant === 'close') return renderCoverClose(d, label, fm);

  // Heading depth controls title size. # = display (gigantic),
  // ## = medium, ### = standard, etc. — let users dial down for long titles.
  const heading = findFirstHeading(d.children);
  const depth = (heading?.depth ?? 1) as 1 | 2 | 3 | 4 | 5 | 6;
  const COVER_SIZE: Record<number, number> = { 1: 200, 2: 140, 3: 96, 4: 72, 5: 56, 6: 44 };
  const titleSize = COVER_SIZE[depth] ?? 200;
  const titleLine = depth <= 2 ? 0.95 : 1.05;

  const para = findFirstParagraph(d.children);
  const title = heading ? renderInline(heading.children) : escHtml(fm.title ?? '');
  const subtitle = fm.subtitle ? escHtml(fm.subtitle) : (para ? renderInline(para.children) : '');
  const id = escHtml(fm.id ?? '');
  const author = escHtml(fm.author ?? '');
  const metaParts: string[] = [];
  if (fm.date) metaParts.push(escHtml(fm.date));
  if (fm.venue) metaParts.push(escHtml(fm.venue));
  const metaLine = metaParts.length
    ? `\n      <div style="margin-top: 16px; font-size: 24px; color: rgba(245, 240, 235, 0.5); font-family: 'JetBrains Mono', monospace; letter-spacing: 0.05em;">${metaParts.join(' · ')}</div>`
    : '';
  return `<section${dataLabel(label ?? '01 표지')} class="cover cover-dark" style="justify-content: center;">
    <div class="center" style="gap: 40px; margin-top: 96px; align-items: center;">
      <h${depth} class="display" style="font-size: ${titleSize}px; line-height: ${titleLine}; margin: 0; font-weight: 900; max-width: 1680px;">${title}</h${depth}>
      <div class="h2 muted" style="max-width: 1400px;">${subtitle}</div>
      <div style="margin-top: 48px; font-size: 36px; font-weight: 700;"><span class="muted" style="font-family: 'JetBrains Mono', monospace; font-weight: 500;">${id}</span>&nbsp;&nbsp;${author}</div>${metaLine}
    </div>
  </section>`;
}

function renderCoverClose(d: ContainerDirective, label: string | undefined, fm: Frontmatter): string {
  const heading = findFirstHeading(d.children);
  const msg = heading ? renderInline(heading.children) : '감사합니다';
  const author = escHtml(fm.author ?? '');
  const id = escHtml(fm.id ?? '');
  return `<section class="cover-dark"${dataLabel(label ?? '닫는 표지')}>
    <div style="display: flex; flex-direction: column; align-items: center; gap: 32px; text-align: center; margin-top: 60px;">
      <h1 class="display" style="font-size: 140px; font-weight: 900; line-height: 1; margin: 0;">${msg}</h1>
      <div style="font-size: 32px; font-weight: 700; margin-top: 24px;">${author} <span class="muted" style="font-family: 'JetBrains Mono', monospace; font-size: 26px; font-weight: 500; margin-left: 10px;">${id}</span></div>
    </div>
  </section>`;
}

function renderImageBlock(
  img: Image,
  isPhoto = true,
  variant: 'split' | 'single' = 'split',
): string {
  const filter = isPhoto ? 'grayscale(0.15) contrast(1.02)' : 'contrast(1.05)';
  // 캔버스 1920×1080, section 패딩 좌우 120 / 상하 100.
  // 항상 컨테이너 폭(width:100%)에 묶어 컬럼/콘텐츠 밖으로 넘치지 않게 하고,
  // 그 위에 절대 상한(max-width/height)을 캡으로 얹는다.
  //  - split:  (1920-240)/2 × (1080-200)*3/4 → 840 × 660
  //  - single: 콘텐츠 폭 (1920-240) × (제목 h1 공간 제외한 높이) → 1680 × 640
  const limit = variant === 'single'
    ? 'max-width: 1680px; max-height: 640px;'
    : 'max-width: 840px; max-height: 660px;';
  return `<img src="${escAttr(img.url)}" alt="${escAttr(img.alt ?? '')}" style="display: block; width: 100%; height: auto; ${limit} object-fit: contain; margin: 0 auto; filter: ${filter};" />`;
}

function renderSplit(d: ContainerDirective, label: string | undefined): string {
  const attrs = d.attributes ?? {};
  const sectionAttrs = alignAttrs(attrs);
  const valign = attrs.valign as string | undefined;
  const splitValign = valign && ['top', 'center', 'bottom'].includes(valign)
    ? ` data-valign="${valign}"` : '';

  // v2 mode: two blocks separated by `---`
  if (hasThematicBreak(d.children)) {
    const groups = splitByThematicBreak(d.children);
    if (groups.length < 2) {
      throw new EngineError(
        `:::split with --- requires at least 2 content blocks (got ${groups.length}).`,
        { line: d.position?.start.line },
      );
    }
    const renderColumn = (children: any[]) => {
      const isMedia = isMediaOnly(children);
      const html = children.map((c) => renderGenericBlock(c, 'split')).join('\n        ');
      const cls = isMedia ? 'media-block' : 'text-block';
      const style = isMedia ? ' style="min-height: 500px;"' : '';
      return `<div class="${cls}"${style}>\n        ${html}\n      </div>`;
    };
    const left = renderColumn(groups[0]);
    const right = renderColumn(groups[1]);
    return `<section${dataLabel(label)}${sectionAttrs}>
    <div class="split"${splitValign}>
      ${left}
      ${right}
    </div>
  </section>`;
  }

  // Legacy mode: H1 + UL → text-block, image → media-block
  const heading = findHeading(d.children);
  const list = findFirstList(d.children);
  const img = findFirstImage(d.children);
  const titleHtml = heading ? renderInline(heading.children) : '';
  const listHtml = list ? renderBullets(list) : '';
  const imgHtml = img ? renderImageBlock(img) : '';
  return `<section${dataLabel(label)}${sectionAttrs}>
    <div class="split"${splitValign}>
      <div class="text-block">
        <h1 class="h1" style="margin: 0 0 var(--gap-title);">${titleHtml}</h1>
        ${listHtml}
      </div>
      <div class="media-block" style="min-height: 500px;">
        ${imgHtml}
      </div>
    </div>
  </section>`;
}



function renderBulletsOnly(d: ContainerDirective, label: string | undefined): string {
  const heading = findHeading(d.children);
  const titleHtml = heading ? renderInline(heading.children) : '';
  // Render every non-heading block in source order — bullets, tables,
  // paragraphs, etc. The heading is hoisted to the slide H1 above.
  const bodyHtml = (d.children ?? [])
    .filter((c: any) => !(c.type === 'heading' && (c as Heading).depth === 1))
    .map((c) => renderGenericBlock(c, 'single'))
    .filter((s) => s.trim().length > 0)
    .join('\n    ');
  return `<section${dataLabel(label)}${alignAttrs(d.attributes ?? {})}>
    <h1 class="h1" style="margin: 0 0 var(--gap-title);">${titleHtml}</h1>
    ${bodyHtml}
  </section>`;
}

function renderIndex(d: ContainerDirective, label: string | undefined): string {
  const heading = findHeading(d.children);
  const titleHtml = heading ? renderInline(heading.children) : '';
  const bodyHtml = (d.children ?? [])
    .filter((c: any) => !(c.type === 'heading' && (c as Heading).depth === 1))
    .map((c) => renderGenericBlock(c))
    .filter((s) => s.trim().length > 0)
    .join('\n    ');
  return `<section class="index"${dataLabel(label)}${alignAttrs(d.attributes ?? {})}>
    <h1 class="h1" style="margin: 0 0 var(--gap-title);">${titleHtml}</h1>
    ${bodyHtml}
  </section>`;
}

function renderDivider(d: ContainerDirective, label: string | undefined): string {
  const attrs = d.attributes ?? {};
  const n = attrs.n ?? '01';
  const isPrimary = attrs.primary !== undefined;
  const heading = findHeading(d.children);
  const para = findFirstParagraph(d.children);
  let title = '';
  if (heading) title = renderInline(heading.children);
  else if (para) title = renderInline(para.children);
  const numStr = String(n).padStart(2, '0');
  const cls = isPrimary ? 'section-divider primary' : 'section-divider';
  return `<section class="${cls}"${dataLabel(label)}${alignAttrs(attrs)}>
    <div class="sec-label">Section ${numStr}</div>
    <h2 class="h1">${title}</h2>
  </section>`;
}




