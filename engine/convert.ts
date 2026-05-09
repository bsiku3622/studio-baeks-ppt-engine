import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import remarkDirective from 'remark-directive';
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

export type Frontmatter = {
  title?: string;
  subtitle?: string;
  author?: string;
  id?: string;
  date?: string;
  venue?: string;
  primary?: string;
  primaryDark?: string;
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
    .use(remarkMath);
  const tree = processor.runSync(processor.parse(md)) as Root;

  let fm: Frontmatter = {};
  const slides: string[] = [];

  for (const node of tree.children) {
    if (node.type === 'yaml') {
      const yamlStartLine = node.position?.start.line ?? 1;
      try {
        fm = (parseYaml((node as Yaml).value) ?? {}) as Frontmatter;
      } catch (e: any) {
        const yamlLine = e?.linePos?.[0]?.line ?? 1;
        throw new EngineError(`Frontmatter YAML 파싱 실패: ${e.message}`, {
          line: yamlStartLine + yamlLine,
        });
      }
      continue;
    }
    if (node.type === 'containerDirective') {
      const slide = renderSlide(node as ContainerDirective, fm);
      if (slide) slides.push(slide);
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

  // Use function replacers to avoid `$&` etc. being interpreted in the JS source.
  const html = template
    .replace(/\{\{TITLE\}\}/g, escAttr(fm.title ?? '슬라이드 데크'))
    .replace(/\{\{PRIMARY_S500\}\}/g, s500)
    .replace(/\{\{PRIMARY_S600\}\}/g, s600)
    .replace('{{SLIDES}}', () => slides.join('\n\n  '))
    .replace('{{DECK_STAGE_SCRIPT_TAG}}', () => scriptTag);

  return { html, slideCount: slides.length, frontmatter: fm };
}

// ───────────────────────── helpers ─────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s: string): string {
  return s
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
      return cls ? `<li class="${cls}">${text}</li>` : `<li>${text}</li>`;
    });
  return `<ul class="bullets">\n        ${items.join('\n        ')}\n      </ul>`;
}

function renderBlock(node: BlockContent): string {
  switch (node.type) {
    case 'paragraph':
      return `<p>${renderInline((node as Paragraph).children)}</p>`;
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

function dataLabel(label: string | undefined): string {
  return label ? ` data-label="${escAttr(label)}"` : '';
}

// ───────────────────────── slide renderers ─────────────────────────

function renderSlide(d: ContainerDirective, fm: Frontmatter): string | null {
  const label = (d.attributes ?? {}).label as string | undefined;
  switch (d.name) {
    case 'cover':      return renderCover(d, label, fm);
    case 'split':      return renderSplit(d, label);
    case 'bullets':    return renderBulletsOnly(d, label);
    case 'divider':    return renderDivider(d, label);
    case 'stats':      return renderStats(d, label);
    case 'charts':     return renderCharts(d, label);
    case 'disclaimer': return renderDisclaimer(d, label);
    case 'thanks':     return renderThanks(d, label, fm);
    default:
      throw new EngineError(
        `Unknown slide directive: ":::${d.name}". Valid: cover, split, bullets, divider, stats, charts, disclaimer, thanks.`,
        { line: d.position?.start.line },
      );
  }
}

function renderCover(d: ContainerDirective, label: string | undefined, fm: Frontmatter): string {
  const heading = findHeading(d.children);
  const para = findFirstParagraph(d.children);
  const title = heading ? renderInline(heading.children) : escHtml(fm.title ?? '');
  // Frontmatter subtitle takes precedence; fall back to first paragraph in body.
  const subtitle = fm.subtitle ? escHtml(fm.subtitle) : (para ? renderInline(para.children) : '');
  const id = escHtml(fm.id ?? '');
  const author = escHtml(fm.author ?? '');
  // Optional meta line (date / venue) below the author line.
  const metaParts: string[] = [];
  if (fm.date) metaParts.push(escHtml(fm.date));
  if (fm.venue) metaParts.push(escHtml(fm.venue));
  const metaLine = metaParts.length
    ? `\n      <div style="margin-top: 16px; font-size: 24px; color: rgba(245, 240, 235, 0.5); font-family: 'JetBrains Mono', monospace; letter-spacing: 0.05em;">${metaParts.join(' · ')}</div>`
    : '';
  return `<section${dataLabel(label ?? '01 표지')} class="cover cover-dark" style="justify-content: center;">
    <div class="center" style="gap: 40px; margin-top: 96px;">
      <h1 class="display" style="font-size: 200px; line-height: 0.95; margin: 0; font-weight: 900;">${title}</h1>
      <div class="h2 muted" style="max-width: 1400px;">${subtitle}</div>
      <div style="margin-top: 48px; font-size: 36px;"><span class="muted" style="font-family: 'JetBrains Mono', monospace;">${id}</span>&nbsp;&nbsp;${author}</div>${metaLine}
    </div>
  </section>`;
}

function renderImageBlock(img: Image, isPhoto = true): string {
  const filter = isPhoto ? 'grayscale(0.15) contrast(1.02)' : 'contrast(1.05)';
  return `<img src="${escAttr(img.url)}" alt="${escAttr(img.alt ?? '')}" style="width: 100%; height: 100%; object-fit: cover; filter: ${filter};" />`;
}

function renderSplit(d: ContainerDirective, label: string | undefined): string {
  const heading = findHeading(d.children);
  const list = findFirstList(d.children);
  const img = findFirstImage(d.children);
  const titleHtml = heading ? renderInline(heading.children) : '';
  const listHtml = list ? renderBullets(list) : '';
  const imgHtml = img ? renderImageBlock(img) : '';
  return `<section${dataLabel(label)}>
    <div class="split">
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
  const list = findFirstList(d.children);
  const titleHtml = heading ? renderInline(heading.children) : '';
  const listHtml = list ? renderBullets(list) : '';
  return `<section${dataLabel(label)}>
    <h1 class="h1" style="margin: 0 0 var(--gap-title);">${titleHtml}</h1>
    ${listHtml}
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
  return `<section class="${cls}"${dataLabel(label)}>
    <div class="sec-label">Section ${numStr}</div>
    <h2 class="h1">${title}</h2>
  </section>`;
}

function renderStats(d: ContainerDirective, label: string | undefined): string {
  const heading = findHeading(d.children);
  const list = findFirstList(d.children);
  const stats = findLeaves(d.children, 'stat');
  const titleHtml = heading ? renderInline(heading.children) : '';
  const listHtml = list ? renderBullets(list) : '';
  const statsHtml = stats.map((s) => {
    const value = renderInline(s.children as PhrasingContent[]);
    const lbl = escHtml((s.attributes ?? {}).label ?? '');
    const isPrimary = (s.attributes ?? {}).primary !== undefined;
    const valStyle = 'font-size: 72px; font-weight: 700; letter-spacing: -0.03em;';
    const valTag = isPrimary
      ? `<div class="primary" style="${valStyle}">${value}</div>`
      : `<div style="${valStyle}">${value}</div>`;
    return `<div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--rule); padding-bottom: 20px;">
          ${valTag}
          <div style="font-size: 24px; color: var(--fg-muted); font-family: 'JetBrains Mono', monospace; letter-spacing: 0.05em; text-transform: uppercase;">${lbl}</div>
        </div>`;
  }).join('\n        ');
  return `<section${dataLabel(label)}>
    <div class="split">
      <div class="text-block">
        <h1 class="h1" style="margin: 0 0 var(--gap-title);">${titleHtml}</h1>
        ${listHtml}
      </div>
      <div class="media-block" style="display: grid; grid-template-columns: 1fr; gap: 24px;">
        ${statsHtml}
      </div>
    </div>
  </section>`;
}

function renderCharts(d: ContainerDirective, label: string | undefined): string {
  const heading = findHeading(d.children);
  const list = findFirstList(d.children);
  const charts = findLeaves(d.children, 'chart');
  const titleHtml = heading ? renderInline(heading.children) : '';
  const listHtml = list ? renderBullets(list) : '';
  const chartsHtml = charts.map((c) => {
    const attrs = c.attributes ?? {};
    const src = escAttr(attrs.src ?? '');
    const caption = escHtml(attrs.caption ?? '');
    const alt = escAttr(attrs.alt ?? '');
    return `<div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 16px; color: var(--fg-muted); letter-spacing: 0.08em; text-transform: uppercase;">${caption}</div>
          <img src="${src}" alt="${alt}" style="width: 100%; height: auto; border-radius: var(--radius); filter: contrast(1.05);" />
        </div>`;
  }).join('\n        ');
  return `<section${dataLabel(label)}>
    <h1 class="h1" style="margin: 0 0 var(--gap-title);">${titleHtml}</h1>
    <div class="split" style="align-items: center; gap: 60px;">
      <div class="text-block" style="flex: 1;">
        ${listHtml}
      </div>
      <div style="flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start;">
        ${chartsHtml}
      </div>
    </div>
  </section>`;
}

function renderDisclaimer(d: ContainerDirective, label: string | undefined): string {
  const heading = findHeading(d.children);
  const list = findFirstList(d.children);
  const note = findLeaves(d.children, 'note')[0];
  const titleHtml = heading ? renderInline(heading.children) : '';
  if (list) {
    for (const li of list.children) {
      if (li.type !== 'listItem') continue;
      const para = (li as ListItem).children[0];
      if (para?.type !== 'paragraph') continue;
      const head = (para as Paragraph).children[0];
      const isMarker =
        head?.type === 'textDirective' &&
        ((head as TextDirective).name === 'muted' || (head as TextDirective).name === 'key');
      if (!isMarker) {
        (para as Paragraph).children.unshift({
          type: 'textDirective',
          name: 'muted',
          attributes: {},
          children: [],
        } as any);
      }
    }
  }
  const listHtml = list ? renderBullets(list) : '';
  const noteHtml = note
    ? `<div style="margin-top: auto; padding-top: 32px; border-top: 1px solid var(--rule); font-family: 'JetBrains Mono', monospace; font-size: 22px; color: var(--fg-subtle); letter-spacing: 0.05em;">
      * ${renderInline(note.children as PhrasingContent[])}
    </div>`
    : '';
  return `<section${dataLabel(label)}>
    <h1 class="h1" style="margin: 0 0 var(--gap-title);">${titleHtml}</h1>
    ${listHtml}
    ${noteHtml}
  </section>`;
}

function renderThanks(d: ContainerDirective, label: string | undefined, fm: Frontmatter): string {
  const heading = findHeading(d.children);
  const msg = heading ? renderInline(heading.children) : '감사합니다';
  const author = escHtml(fm.author ?? '');
  const id = escHtml(fm.id ?? '');
  return `<section class="cover-dark"${dataLabel(label ?? '감사합니다')}>
    <div style="display: flex; flex-direction: column; align-items: center; gap: 32px; text-align: center; margin-top: 60px;">
      <h1 class="display" style="font-size: 140px; font-weight: 900; line-height: 1; margin: 0;">${msg}</h1>
      <div style="font-size: 32px; margin-top: 24px;">${author} <span class="muted" style="font-family: 'JetBrains Mono', monospace; font-size: 26px; margin-left: 10px;">${id}</span></div>
    </div>
  </section>`;
}
