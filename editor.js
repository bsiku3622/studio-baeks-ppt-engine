// Studio Baeks PPT Engine — editor

// File:// protocol can't reach server endpoints. Show a helpful banner.
if (location.protocol === 'file:') {
  const banner = document.createElement('div');
  banner.style.cssText = 'background:#FFF8E1;border-bottom:1px solid #E5B800;padding:10px 24px;font-family:"JetBrains Mono",monospace;font-size:12px;color:#7A5A00;';
  banner.innerHTML = '⚠ <code>file://</code> 모드에서는 변환 API와 Sample 로드가 작동하지 않습니다. 실제 사용은 <code>npx vercel dev</code> 또는 <a href="https://studio-baeks-ppt-engine.vercel.app" target="_blank">배포된 사이트</a>로.';
  document.body.insertBefore(banner, document.body.firstChild);
}

const editor = document.getElementById('editor');
const highlightEl = document.getElementById('editor-highlight');
const preview = document.getElementById('preview');
const slideCountEl = document.getElementById('slide-count');
const convertTimeEl = document.getElementById('convert-time');
const primaryStatusEl = document.getElementById('primary-status');
const assetCountEl = document.getElementById('asset-count');
const errorEl = document.getElementById('error-msg');
const downloadHtmlBtn = document.getElementById('download-html-btn');
const downloadPptxBtn = document.getElementById('download-pptx-btn');
const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
const sampleBtn = document.getElementById('sample-btn');
const dropOverlay = document.getElementById('drop-overlay');

const swatches = document.querySelectorAll('.swatch');

const notesInput = document.getElementById('notes-input');
const notesSlideEl = document.getElementById('notes-slide');
const pptViewBtn = document.getElementById('ppt-view-btn');
const presenterBtn = document.getElementById('presenter-btn');

let pptViewWin = null;
let presenterWin = null;

function openDeckWindow(injectPresenterFlag, name, dimensions) {
  if (!lastHtml) return null;
  let html = injectAssets(lastHtml);
  if (injectPresenterFlag) {
    html = html.replace(/<head>/i, '<head><script>window.__sb_presenter = true;</script>');
  }
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, name, dimensions);
  if (!win) return null;
  const cleanup = setInterval(() => {
    if (!win || win.closed) {
      URL.revokeObjectURL(url);
      clearInterval(cleanup);
    }
  }, 1000);
  return win;
}

pptViewBtn.addEventListener('click', () => {
  if (pptViewWin && !pptViewWin.closed) {
    try { pptViewWin.focus(); } catch (e) {}
    return;
  }
  pptViewWin = openDeckWindow(false, 'sb-ppt-view', 'width=1280,height=720,menubar=no,toolbar=no,location=no');
  if (!pptViewWin) {
    showError('PPT 뷰 윈도우가 차단되었습니다. 브라우저 팝업 허용 후 다시 시도하세요.');
  }
});

presenterBtn.addEventListener('click', () => {
  if (presenterWin && !presenterWin.closed) {
    try { presenterWin.focus(); } catch (e) {}
    return;
  }
  presenterWin = openDeckWindow(true, 'sb-presenter', 'width=1100,height=720,menubar=no,toolbar=no,location=no');
  if (!presenterWin) {
    showError('발표자 윈도우가 차단되었습니다. 브라우저 팝업 허용 후 다시 시도하세요.');
  }
});

// Broker: keep iframe / PPT view / presenter view in lockstep. Any one window
// navigating drives the others. The presenter window speaks `slideIndexChanged`
// (its `_onPresenterMessage`); regular deck-stage instances speak `goTo`.
function forwardSlideTo(targetWin, index, isPresenter) {
  if (!targetWin || targetWin.closed) return;
  try {
    const msg = isPresenter
      ? { slideIndexChanged: index, reason: 'sync' }
      : { type: 'goTo', index };
    targetWin.postMessage(msg, '*');
  } catch (e) {}
}

function fanOutNav(sourceWin, index) {
  if (sourceWin !== preview.contentWindow) forwardSlideTo(preview.contentWindow, index, false);
  if (sourceWin !== pptViewWin) forwardSlideTo(pptViewWin, index, false);
  if (sourceWin !== presenterWin) forwardSlideTo(presenterWin, index, true);
}

// State
const assetMap = new Map();   // filename → dataURL
let lastHtml = '';            // last rendered HTML (with original ./assets/ paths)
let lastTitle = 'deck';

// ─ MD ↔ HTML pipeline ─────────────────────────────

let convertTimer = null;
function scheduleConvert() {
  clearTimeout(convertTimer);
  convertTimer = setTimeout(convert, 400);
}

async function convert() {
  const md = editor.value;
  if (!md.trim()) {
    preview.srcdoc = '';
    slideCountEl.textContent = '— 슬라이드';
    convertTimeEl.textContent = '변환 대기';
    downloadHtmlBtn.disabled = true;
    downloadPptxBtn.disabled = true;
    errorEl.textContent = '';
    return;
  }

  try {
    const res = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: md }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      showError(err.error || 'Conversion failed', err.line);
      return;
    }

    const { html, slideCount, frontmatter, elapsedMs } = await res.json();
    lastHtml = html;
    lastTitle = frontmatter?.title || 'deck';

    // For preview: rewrite ./assets/X to base64 if uploaded.
    const previewHtml = injectAssets(html);
    preview.srcdoc = previewHtml;

    // Sync swatch active state to the frontmatter primary.
    // The reset swatch (empty data-color) never gets active.
    const fmPrimary = frontmatter?.primary || 'terracotta';
    swatches.forEach((sw) => {
      const c = sw.dataset.color;
      sw.classList.toggle('active', !!c && c === fmPrimary);
    });

    slideCountEl.textContent = `${slideCount} 슬라이드`;
    convertTimeEl.textContent = `변환 ${elapsedMs}ms`;
    pptViewBtn.disabled = false;
    presenterBtn.disabled = false;
    refreshNotesBox();
    errorEl.textContent = '';
    downloadHtmlBtn.disabled = false;
    downloadPptxBtn.disabled = false;
    primaryStatusEl.textContent = `primary: ${fmPrimary}`;
  } catch (e) {
    showError(`네트워크 오류: ${e.message}`);
  }
}

function showError(message, line) {
  errorEl.textContent = '';
  errorEl.appendChild(document.createTextNode(message));
  if (typeof line === 'number') {
    const link = document.createElement('a');
    link.href = '#';
    link.textContent = ` [line ${line}]`;
    link.className = 'error-jump';
    link.onclick = (e) => { e.preventDefault(); jumpToLine(line); };
    errorEl.appendChild(link);
  }
}

function jumpToLine(lineNumber) {
  const lines = editor.value.split('\n');
  if (lineNumber < 1 || lineNumber > lines.length) return;
  let pos = 0;
  for (let i = 0; i < lineNumber - 1; i++) pos += lines[i].length + 1;
  const lineEnd = pos + lines[lineNumber - 1].length;
  editor.focus();
  editor.setSelectionRange(pos, lineEnd);
  // Approximate scroll: line-height 1.6 × 13px ≈ 21px per line.
  editor.scrollTop = (lineNumber - 3) * 21;
}

function injectAssets(html) {
  if (assetMap.size === 0) return html;
  return html.replace(/(["'])(\.\/assets\/|\/assets\/|assets\/)([^"']+)\1/g, (m, q, _prefix, name) => {
    const dataUrl = assetMap.get(name);
    return dataUrl ? `${q}${dataUrl}${q}` : m;
  });
}

editor.addEventListener('input', () => {
  updateHighlight();
  scheduleConvert();
  updateUploadBtnState();
});
editor.addEventListener('scroll', () => {
  highlightEl.style.transform = `translate(${-editor.scrollLeft}px, ${-editor.scrollTop}px)`;
});

// ─ Syntax highlight (regex-based, line-aware) ───────────────────

function escHtmlBasic(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightMd(src) {
  const lines = src.split('\n');
  let inFm = false;
  let fmFenceCount = 0;
  return lines.map((line, i) => {
    // Frontmatter fence
    if (line === '---') {
      if (i === 0 && fmFenceCount === 0) {
        inFm = true; fmFenceCount = 1;
        return `<span class="hl-fence">---</span>`;
      }
      if (inFm && fmFenceCount === 1) {
        inFm = false; fmFenceCount = 2;
        return `<span class="hl-fence">---</span>`;
      }
      // Block separator inside slide content
      return `<span class="hl-block-sep">---</span>`;
    }
    if (inFm) return highlightFmLine(line);
    return highlightContentLine(line);
  }).join('\n');
}

function highlightFmLine(line) {
  const m = line.match(/^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*)(\s*:\s*)(.*)$/);
  if (!m) return escHtmlBasic(line);
  const [, indent, key, sep, value] = m;
  return `${escHtmlBasic(indent)}<span class="hl-fm-key">${escHtmlBasic(key)}</span>${escHtmlBasic(sep)}<span class="hl-fm-value">${escHtmlBasic(value)}</span>`;
}

function highlightContentLine(line) {
  // Container directive open (e.g. :::split{label="..." align=center})
  let m = line.match(/^(:::)([a-z][a-z0-9-]*)(\{[^}]*\})?(\s*)$/);
  if (m) {
    const [, colons, name, attrs, trail] = m;
    return `<span class="hl-dir">${colons}${escHtmlBasic(name)}</span>${attrs ? `<span class="hl-attrs">${escHtmlBasic(attrs)}</span>` : ''}${escHtmlBasic(trail)}`;
  }
  // Container directive close
  if (/^:::\s*$/.test(line)) return `<span class="hl-dir">:::</span>`;

  // Leaf directive: ::stat[..]{..}, ::chart{..}, ::note[..]
  m = line.match(/^(::)([a-z][a-z0-9-]*)(\[[^\]]*\])?(\{[^}]*\})?(.*)$/);
  if (m) {
    const [, colons, name, content, attrs, rest] = m;
    return `<span class="hl-leaf">${colons}${escHtmlBasic(name)}</span>${content ? `<span class="hl-leaf-content">${escHtmlBasic(content)}</span>` : ''}${attrs ? `<span class="hl-attrs">${escHtmlBasic(attrs)}</span>` : ''}${escHtmlBasic(rest)}`;
  }

  // Heading
  m = line.match(/^(#{1,6})(\s+)(.+)$/);
  if (m) {
    const [, hashes, sp, content] = m;
    return `<span class="hl-heading">${hashes}${sp}${highlightInline(content)}</span>`;
  }

  // Bullet
  m = line.match(/^(\s*)(-)(\s+)(.*)$/);
  if (m) {
    const [, indent, dash, sp, rest] = m;
    return `${escHtmlBasic(indent)}<span class="hl-bullet">${dash}</span>${sp}${highlightBulletContent(rest)}`;
  }

  return highlightInline(line);
}

function highlightBulletContent(text) {
  // :muted / :key as first token
  const m = text.match(/^:(muted|key)\b(.*)$/);
  if (m) {
    return `<span class="hl-marker">:${m[1]}</span>${highlightInline(m[2])}`;
  }
  return highlightInline(text);
}

function highlightInline(text) {
  // Tokenize to avoid double-replacing inside already-tagged HTML.
  // Order matters: greedy first.
  const tokens = [];
  const patterns = [
    { re: /\$\$[\s\S]+?\$\$/g,                 cls: 'hl-math' },
    { re: /(?<!\\)\$[^$\n]+?\$/g,              cls: 'hl-math' },
    { re: /:primary\[[^\]]*\]/g,               cls: 'hl-primary-call' },
    { re: /(?<!:):[a-z][a-z0-9-]*\[[^\]]*\]/g, cls: 'hl-primary-call' }, // other inline directives
    { re: /!\[[^\]]*\]\([^)]+\)/g,             cls: 'hl-img' },
    { re: /\*\*[^*\n]+\*\*/g,                  cls: 'hl-bold' },
    { re: /(?<!\*)\*[^*\n]+\*(?!\*)/g,         cls: 'hl-italic' },
    { re: /`[^`\n]+`/g,                        cls: 'hl-code' },
  ];
  // Collect non-overlapping matches
  for (const p of patterns) {
    let m;
    while ((m = p.re.exec(text)) !== null) {
      tokens.push({ start: m.index, end: m.index + m[0].length, text: m[0], cls: p.cls });
    }
  }
  tokens.sort((a, b) => a.start - b.start);
  // Filter overlapping (keep first)
  const filtered = [];
  let cursor = 0;
  for (const t of tokens) {
    if (t.start < cursor) continue;
    filtered.push(t);
    cursor = t.end;
  }
  // Build HTML
  let out = '';
  let pos = 0;
  for (const t of filtered) {
    out += escHtmlBasic(text.slice(pos, t.start));
    if (t.cls === 'hl-img') {
      const m = t.text.match(/^(!\[)([^\]]*)(\]\()([^)]+)(\))$/);
      if (m) {
        out += `<span class="hl-img-bracket">${escHtmlBasic(m[1])}</span>`;
        out += `<span class="hl-img-alt">${escHtmlBasic(m[2])}</span>`;
        out += `<span class="hl-img-bracket">${escHtmlBasic(m[3])}</span>`;
        out += `<span class="hl-img-src">${escHtmlBasic(m[4])}</span>`;
        out += `<span class="hl-img-bracket">${escHtmlBasic(m[5])}</span>`;
      } else {
        out += escHtmlBasic(t.text);
      }
    } else {
      out += `<span class="${t.cls}">${escHtmlBasic(t.text)}</span>`;
    }
    pos = t.end;
  }
  out += escHtmlBasic(text.slice(pos));
  return out;
}

function updateHighlight() {
  // Trailing space so the last empty line renders with full height in <pre>.
  highlightEl.innerHTML = highlightMd(editor.value) + '\n ';
}

// ─ Primary swatches ──────────────────────────────

// Swatch click → update frontmatter `primary:` in MD body.
// Empty data-color (reset swatch) → remove the primary line entirely.
swatches.forEach((sw) => {
  sw.addEventListener('click', () => {
    const color = sw.dataset.color || '';
    setFrontmatterPrimary(color || null);
    localStorage.setItem(SAVED_KEY, editor.value);
    convert();
  });
});

function setFrontmatterPrimary(name) {
  let md = editor.value;
  const hasFrontmatter = /^---\r?\n/.test(md);

  if (!hasFrontmatter) {
    // No preamble yet — inject one if we're setting a value.
    if (name) {
      md = `---\nprimary: ${name}\n---\n\n${md}`;
      editor.value = md;
      updateHighlight();
    }
    return;
  }

  const lines = md.split('\n');
  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---' || lines[i] === '---\r') { endIdx = i; break; }
  }
  if (endIdx < 0) return;

  let primaryIdx = -1;
  for (let i = 1; i < endIdx; i++) {
    if (/^\s*primary\s*:/.test(lines[i])) { primaryIdx = i; break; }
  }

  if (name) {
    if (primaryIdx >= 0) {
      // Preserve key + alignment; replace value.
      lines[primaryIdx] = lines[primaryIdx].replace(
        /^(\s*primary\s*:\s*).*$/,
        `$1${name}`,
      );
    } else {
      lines.splice(endIdx, 0, `primary: ${name}`);
    }
  } else {
    // Remove the primary line.
    if (primaryIdx >= 0) lines.splice(primaryIdx, 1);
  }

  editor.value = lines.join('\n');
  updateHighlight();
}

// ─ Speaker notes (MD-bound input below preview) ──
// Source of truth = the MD textarea. The box reflects the *current* slide's
// :::speaker-note block; edits in the box splice the MD; edits in the MD
// refresh the box. Slide changes in the iframe drive `currentSlideIndex`.

let currentSlideIndex = 0;
let notesFlushTimer = null;
let pendingNoteSlide = -1;
let pendingNoteContent = '';
let notesWriteInProgress = false;

// Names of all top-level slide directives. Anything else (e.g. speaker-note)
// is treated as a nested sub-directive. Mirrors `renderSlide` in engine/convert.ts.
const SLIDE_DIRECTIVES = new Set([
  'cover', 'split', 'bullets', 'divider', 'stats', 'charts',
  'disclaimer', 'thanks', 'image', 'stack', 'chart', 'plot',
]);

// Lenient to match the engine's remark-directive parser: encountering a new
// slide directive while one is open auto-closes the previous (closeLine = line
// just before the new opener). At EOF, any open slide is also auto-closed.
// This handles the common authoring mistake where a slide ends with a
// `:::speaker-note ... :::` block and the author forgets to add the slide's
// own closing `:::` after the note.
function findTopLevelSlides(md) {
  const lines = md.split('\n');
  const out = [];
  let current = null;
  let nestedDepth = 0;
  for (let i = 0; i < lines.length; i++) {
    const openM = lines[i].match(/^:::([a-z][a-z0-9-]*)(?:\{[^}]*\})?\s*$/);
    if (openM) {
      const name = openM[1];
      if (SLIDE_DIRECTIVES.has(name)) {
        if (current) out.push({ ...current, closeLine: i - 1, autoClosed: true });
        current = { openLine: i, name };
        nestedDepth = 0;
      } else if (current) {
        nestedDepth++;
      }
      continue;
    }
    if (/^:::\s*$/.test(lines[i])) {
      if (nestedDepth > 0) nestedDepth--;
      else if (current) {
        out.push({ ...current, closeLine: i, autoClosed: false });
        current = null;
      }
    }
  }
  if (current) out.push({ ...current, closeLine: lines.length - 1, autoClosed: true });
  return out;
}

function findSpeakerNoteRange(lines, slide) {
  for (let i = slide.openLine + 1; i < slide.closeLine; i++) {
    if (!/^:::speaker-note(?:\{[^}]*\})?\s*$/.test(lines[i])) continue;
    let depth = 1;
    for (let j = i + 1; j < slide.closeLine; j++) {
      if (/^:::[a-z][a-z0-9-]*(?:\{[^}]*\})?\s*$/.test(lines[j])) depth++;
      else if (/^:::\s*$/.test(lines[j])) {
        depth--;
        if (depth === 0) return { openLine: i, closeLine: j };
      }
    }
  }
  return null;
}

function getNoteContent(md, slideIndex) {
  const slides = findTopLevelSlides(md);
  if (slideIndex < 0 || slideIndex >= slides.length) return null;
  const lines = md.split('\n');
  const note = findSpeakerNoteRange(lines, slides[slideIndex]);
  if (!note) return '';
  return lines.slice(note.openLine + 1, note.closeLine).join('\n');
}

function setNoteContent(md, slideIndex, newContent) {
  const slides = findTopLevelSlides(md);
  if (slideIndex < 0 || slideIndex >= slides.length) return md;
  const slide = slides[slideIndex];
  const lines = md.split('\n');
  const existing = findSpeakerNoteRange(lines, slide);
  const body = newContent.replace(/\s+$/, '');
  if (existing) {
    if (body === '') {
      let removeFrom = existing.openLine;
      const removeTo = existing.closeLine;
      if (removeFrom > slide.openLine + 1 && lines[removeFrom - 1] === '') removeFrom -= 1;
      lines.splice(removeFrom, removeTo - removeFrom + 1);
      return lines.join('\n');
    }
    const replacement = [':::speaker-note', ...body.split('\n'), ':::'];
    lines.splice(existing.openLine, existing.closeLine - existing.openLine + 1, ...replacement);
    return lines.join('\n');
  }
  if (body === '') return md;
  const insertAt = slide.closeLine;
  const insert = [];
  const prev = lines[insertAt - 1];
  if (prev !== undefined && prev.trim() !== '') insert.push('');
  insert.push(':::speaker-note', ...body.split('\n'), ':::');
  lines.splice(insertAt, 0, ...insert);
  return lines.join('\n');
}

function refreshNotesBox() {
  const slides = findTopLevelSlides(editor.value);
  if (slides.length === 0) {
    notesInput.disabled = true;
    notesInput.value = '';
    notesSlideEl.textContent = '슬라이드 —';
    return;
  }
  const idx = Math.min(Math.max(0, currentSlideIndex), slides.length - 1);
  currentSlideIndex = idx;
  notesInput.disabled = false;
  notesSlideEl.textContent = `슬라이드 ${idx + 1}`;
  if (document.activeElement === notesInput) return;
  const content = getNoteContent(editor.value, idx) ?? '';
  if (notesInput.value !== content) notesInput.value = content;
}

function flushPendingNote() {
  if (notesFlushTimer) { clearTimeout(notesFlushTimer); notesFlushTimer = null; }
  if (pendingNoteSlide < 0) return;
  const newMd = setNoteContent(editor.value, pendingNoteSlide, pendingNoteContent);
  pendingNoteSlide = -1;
  pendingNoteContent = '';
  if (newMd === editor.value) return;
  notesWriteInProgress = true;
  editor.value = newMd;
  updateHighlight();
  localStorage.setItem(SAVED_KEY, editor.value);
  notesWriteInProgress = false;
  scheduleConvert();
  updateUploadBtnState();
}

notesInput.addEventListener('input', () => {
  pendingNoteSlide = currentSlideIndex;
  pendingNoteContent = notesInput.value;
  clearTimeout(notesFlushTimer);
  notesFlushTimer = setTimeout(flushPendingNote, 250);
});
notesInput.addEventListener('blur', flushPendingNote);

editor.addEventListener('input', () => {
  if (notesWriteInProgress) return;
  refreshNotesBox();
});

window.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || typeof d !== 'object') return;

  // A peer (presenter popup, or any future client) explicitly asked to navigate.
  if (d.type === 'goTo' && typeof d.index === 'number') {
    fanOutNav(e.source, d.index);
    return;
  }

  if (typeof d.slideIndexChanged !== 'number') return;
  if (d.reason === 'init') return;  // each window boots at 0; restored separately
  if (d.reason === 'sync') return;  // our own broker echo — never re-broadcast

  // Identify the source.
  const fromIframe = e.source === preview.contentWindow;
  const fromPpt = pptViewWin && e.source === pptViewWin;
  if (!fromIframe && !fromPpt) return;

  fanOutNav(e.source, d.slideIndexChanged);

  // Editor's notes box only follows the iframe's current slide.
  if (fromIframe && d.slideIndexChanged !== currentSlideIndex) {
    flushPendingNote();
    currentSlideIndex = d.slideIndexChanged;
    const slides = findTopLevelSlides(editor.value);
    if (slides.length > 0) {
      const idx = Math.min(Math.max(0, currentSlideIndex), slides.length - 1);
      notesInput.disabled = false;
      notesSlideEl.textContent = `슬라이드 ${idx + 1}`;
      if (document.activeElement !== notesInput) {
        notesInput.value = getNoteContent(editor.value, idx) ?? '';
      }
    }
  }
});

preview.addEventListener('load', () => {
  try {
    preview.contentWindow.postMessage({ type: 'goTo', index: currentSlideIndex }, '*');
  } catch (err) {}
});

// ─ Image upload (base64 in browser) ─────────────

function handleFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const reader = new FileReader();
    reader.onload = (e) => {
      assetMap.set(file.name, e.target.result);
      assetCountEl.textContent = `assets: ${assetMap.size}`;
      if (lastHtml) preview.srcdoc = injectAssets(lastHtml);
      if (!modal.hidden) renderModal();
      updateUploadBtnState();
    };
    reader.readAsDataURL(file);
  }
}

// Highlight 이미지 관리 button in terracotta when the MD references images
// the user hasn't uploaded yet — a hint to open the modal and fill them in.
function updateUploadBtnState() {
  const refs = scanMdReferences(editor.value);
  let missing = 0;
  for (const name of refs.keys()) {
    if (!assetMap.has(name)) missing++;
  }
  uploadBtn.classList.toggle('has-missing', missing > 0);
}

// "이미지 관리" button → open modal (replaces direct file picker)
uploadBtn.addEventListener('click', () => openModal());
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

// Drag & drop on whole document — only show overlay for file drags
let dragCounter = 0;
function isFileDrag(e) {
  return e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
}
document.addEventListener('dragenter', (e) => {
  if (!isFileDrag(e)) return;
  e.preventDefault();
  if (!modal.hidden) return;   // modal handles its own drag UI
  dragCounter++;
  dropOverlay.classList.add('active');
});
document.addEventListener('dragover', (e) => {
  if (isFileDrag(e)) e.preventDefault();
});
document.addEventListener('dragleave', (e) => {
  if (!isFileDrag(e)) return;
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    dropOverlay.classList.remove('active');
  }
});
document.addEventListener('drop', (e) => {
  if (!isFileDrag(e)) return;
  e.preventDefault();
  dragCounter = 0;
  dropOverlay.classList.remove('active');
  handleFiles(e.dataTransfer.files);
});

// ─ Sample loader ──────────────────────────────────

sampleBtn.addEventListener('click', async () => {
  if (editor.value.trim() && !confirm('현재 작성 내용을 덮어쓰시겠습니까?')) return;
  try {
    const res = await fetch('/example/sample.md');
    if (!res.ok) throw new Error('Sample fetch failed');
    const md = await res.text();
    editor.value = md;
    updateHighlight();

    // Add sample asset URLs without overwriting user uploads (theirs win).
    const assetNames = new Set();
    const re = /\.\/assets\/([^\s"')]+)/g;
    let m;
    while ((m = re.exec(md)) !== null) assetNames.add(m[1]);
    for (const name of assetNames) {
      if (!assetMap.has(name)) {
        assetMap.set(name, `${location.origin}/example/assets/${name}`);
      }
    }
    assetCountEl.textContent = `assets: ${assetMap.size}`;

    convert();
    updateUploadBtnState();
  } catch (e) {
    showError(`Sample 로드 실패: ${e.message}`);
  }
});

// ─ HTML download (original paths, no base64) ────

async function inlineUrlAssets() {
  // Convert any URL-based asset (e.g. sample assets from /example/assets/)
  // into base64 dataURLs so the downloaded HTML is fully self-contained.
  // User-uploaded images are already dataURLs (from FileReader.readAsDataURL).
  const tasks = [];
  for (const [name, val] of assetMap) {
    if (typeof val !== 'string' || val.startsWith('data:')) continue;
    tasks.push((async () => {
      try {
        const res = await fetch(val);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        assetMap.set(name, dataUrl);
      } catch (e) {
        console.warn(`[download] asset "${name}" 임베드 실패:`, e);
      }
    })());
  }
  await Promise.all(tasks);
}

downloadHtmlBtn.addEventListener('click', async () => {
  if (!lastHtml) return;
  const origText = downloadHtmlBtn.textContent;
  downloadHtmlBtn.disabled = true;
  downloadHtmlBtn.textContent = '이미지 임베드 중…';
  try {
    await inlineUrlAssets();
    const html = injectAssets(lastHtml);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeFilename(lastTitle)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  } finally {
    downloadHtmlBtn.disabled = false;
    downloadHtmlBtn.textContent = origText;
  }
});

function sanitizeFilename(s) {
  return s.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || 'deck';
}

// ─ Initial: try loading saved or sample ──────────

const SAVED_KEY = 'sb-ppt-md';
const saved = localStorage.getItem(SAVED_KEY);
if (saved) {
  editor.value = saved;
  updateHighlight();
  convert();
} else {
  updateHighlight();
}
refreshNotesBox();
updateUploadBtnState();

// Auto-save to localStorage
editor.addEventListener('input', () => {
  localStorage.setItem(SAVED_KEY, editor.value);
});

// ─ Asset management modal ────────────────────────

const modal = document.getElementById('asset-modal');
const modalGrid = document.getElementById('modal-grid');
const modalSummary = document.getElementById('modal-summary');
const modalCloseBtn = modal.querySelector('.modal-close');
const modalBackdrop = modal.querySelector('.modal-backdrop');
const modalUploadBtn = document.getElementById('modal-upload-btn');
const modalFileInput = document.getElementById('modal-file-input');

function openModal() {
  modal.hidden = false;
  renderModal();
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = '';
}

modalCloseBtn.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modal.hidden) closeModal();
});

modalUploadBtn.addEventListener('click', () => modalFileInput.click());
modalFileInput.addEventListener('change', (e) => {
  handleFiles(e.target.files);
  modalFileInput.value = '';
});

// Modal-internal drop zone (in addition to the document-wide drop)
modal.addEventListener('dragenter', (e) => {
  if (isFileDrag(e)) modalGrid.classList.add('drag-over');
});
modal.addEventListener('dragleave', (e) => {
  if (e.target === modal || e.target === modalBackdrop) {
    modalGrid.classList.remove('drag-over');
  }
});

function scanMdReferences(md) {
  const refs = new Map();
  const re = /\.\/assets\/([^\s"')\]]+)/g;
  let m;
  while ((m = re.exec(md)) !== null) {
    const name = m[1];
    refs.set(name, (refs.get(name) || 0) + 1);
  }
  return refs;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderModal() {
  const refs = scanMdReferences(editor.value);
  const referenced = [];
  const unused = [];
  const missing = [];

  for (const [name, value] of assetMap) {
    const count = refs.get(name) || 0;
    if (count > 0) referenced.push({ name, value, count });
    else unused.push({ name, value, count: 0 });
  }
  for (const [name, count] of refs) {
    if (!assetMap.has(name)) missing.push({ name, count });
  }
  // Stable order: by name
  referenced.sort((a, b) => a.name.localeCompare(b.name));
  unused.sort((a, b) => a.name.localeCompare(b.name));
  missing.sort((a, b) => a.name.localeCompare(b.name));

  let html = '';
  if (referenced.length === 0 && unused.length === 0 && missing.length === 0) {
    html = '<div class="modal-empty">업로드된 이미지가 없습니다.<br/>+ 업로드 버튼을 누르거나 파일을 모달에 드래그하세요.</div>';
  } else {
    if (referenced.length > 0) {
      html += `<h3 class="modal-section-h">✓ MD에서 참조 (${referenced.length})</h3>`;
      html += `<div class="asset-grid">${referenced.map(renderCard).join('')}</div>`;
    }
    if (unused.length > 0) {
      html += `<h3 class="modal-section-h">◦ 업로드만 됨 / unused (${unused.length})</h3>`;
      html += `<div class="asset-grid">${unused.map((c) => renderCard(c, true)).join('')}</div>`;
    }
    if (missing.length > 0) {
      html += `<h3 class="modal-section-h warn">⚠ MD가 참조하는데 없는 파일 (${missing.length})</h3>`;
      html += `<div class="asset-grid">${missing.map(renderMissingCard).join('')}</div>`;
    }
  }
  modalGrid.innerHTML = html;
  modalGrid.classList.remove('drag-over');
  modalSummary.textContent = `총 ${assetMap.size}장 · 참조 ${referenced.length}, unused ${unused.length}, missing ${missing.length}`;
}

function renderCard({ name, value, count }, isUnused = false) {
  const safeName = escHtml(name);
  const info = isUnused ? '미사용' : `${count}곳에서 사용`;
  return `
    <div class="asset-card${isUnused ? ' unused' : ''}" data-name="${safeName}">
      <div class="asset-thumb"><img src="${escHtml(value)}" alt=""></div>
      <div class="asset-name" title="${safeName}">${safeName}</div>
      <div class="asset-info">${info}</div>
      <div class="asset-actions">
        <button class="btn-mini" data-action="insert">삽입</button>
        <button class="btn-mini danger" data-action="delete">삭제</button>
      </div>
    </div>`;
}

function renderMissingCard({ name, count }) {
  const safeName = escHtml(name);
  return `
    <div class="asset-card missing" data-name="${safeName}">
      <div class="asset-thumb">?</div>
      <div class="asset-name" title="${safeName}">${safeName}</div>
      <div class="asset-info">${count}곳에서 참조</div>
      <div class="asset-actions">
        <button class="btn-mini" data-action="upload-for">업로드</button>
      </div>
    </div>`;
}

modalGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const card = btn.closest('.asset-card');
  if (!card) return;
  const name = card.dataset.name;

  if (action === 'insert') {
    insertAtCursor(`![${name.replace(/\.[^.]+$/, '')}](./assets/${name})`);
    closeModal();
  } else if (action === 'delete') {
    if (!confirm(`${name} 삭제? (MD 본문은 안 건드립니다)`)) return;
    assetMap.delete(name);
    assetCountEl.textContent = `assets: ${assetMap.size}`;
    if (lastHtml) preview.srcdoc = injectAssets(lastHtml);
    renderModal();
    updateUploadBtnState();
  } else if (action === 'upload-for') {
    // Trigger file picker; user picks any file, we rename to the missing name.
    const tempInput = document.createElement('input');
    tempInput.type = 'file';
    tempInput.accept = 'image/*';
    tempInput.onchange = (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (le) => {
        assetMap.set(name, le.target.result);
        assetCountEl.textContent = `assets: ${assetMap.size}`;
        if (lastHtml) preview.srcdoc = injectAssets(lastHtml);
        renderModal();
        updateUploadBtnState();
      };
      reader.readAsDataURL(file);
    };
    tempInput.click();
  }
});

function insertAtCursor(text) {
  const start = editor.selectionStart ?? editor.value.length;
  const end = editor.selectionEnd ?? editor.value.length;
  const before = editor.value.slice(0, start);
  const after = editor.value.slice(end);
  // Ensure surrounding newlines so the image renders inside its slide cleanly.
  const prefix = before.endsWith('\n') || before.length === 0 ? '' : '\n';
  const suffix = after.startsWith('\n') ? '' : '\n';
  const insertion = prefix + text + suffix;
  editor.value = before + insertion + after;
  const newPos = start + insertion.length;
  editor.selectionStart = editor.selectionEnd = newPos;
  editor.focus();
  updateHighlight();
  localStorage.setItem(SAVED_KEY, editor.value);
  convert();
  updateUploadBtnState();
}

// ─ AI Prompt copy (Skills.md body without frontmatter) ────

const copyPromptBtn = document.getElementById('copy-prompt-btn');

function stripFrontmatter(md) {
  if (md.startsWith('---\n')) {
    const end = md.indexOf('\n---\n', 4);
    if (end >= 0) return md.slice(end + 5).trimStart();
  }
  return md;
}

copyPromptBtn?.addEventListener('click', async () => {
  const original = copyPromptBtn.textContent;
  try {
    const res = await fetch('./docs/Skills.md');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const md = await res.text();
    const prompt = stripFrontmatter(md);
    await navigator.clipboard.writeText(prompt);
    copyPromptBtn.textContent = '✓ 복사됨';
    copyPromptBtn.classList.add('copied');
    setTimeout(() => {
      copyPromptBtn.textContent = original;
      copyPromptBtn.classList.remove('copied');
    }, 2000);
  } catch (e) {
    copyPromptBtn.textContent = '복사 실패';
    setTimeout(() => { copyPromptBtn.textContent = original; }, 2000);
  }
});

// ─ PPTX export ────────────────────────────────────
// Image-per-slide PPTX: render lastHtml in a hidden offscreen iframe with
// `noscale` + a forced-visible CSS override so every <section> sits at its
// authored 1920×1080 in document flow. modern-screenshot captures each
// section to PNG; pptxgenjs assembles them as a 16:9 deck with speaker
// notes injected into the PPTX notes pane.

// html2canvas-pro is the actively maintained fork that supports modern CSS color
// functions (oklch/oklab/lch/lab) — the original html2canvas@1.4.1 throws on
// "oklch", which the engine's primary palette relies on.
const HTML2CANVAS_CDN = 'https://cdn.jsdelivr.net/npm/html2canvas-pro@2.0.2/dist/html2canvas-pro.min.js';

const pptxModal = document.getElementById('pptx-modal');
const pptxStartBtn = document.getElementById('pptx-start-btn');
const pptxCancelBtn = document.getElementById('pptx-cancel-btn');
const pptxCloseBtn = pptxModal.querySelector('.modal-close');
const pptxBackdrop = pptxModal.querySelector('.modal-backdrop');
const pptxProgress = document.getElementById('pptx-progress');
const pptxProgressText = document.getElementById('pptx-progress-text');
const pptxProgressFill = document.getElementById('pptx-progress-fill');
const pptxErrorBox = document.getElementById('pptx-error');

let pptxExportRunning = false;
let pptxCancelled = false;

function openPptxModal() {
  pptxErrorBox.hidden = true;
  pptxErrorBox.textContent = '';
  pptxProgress.hidden = true;
  pptxProgressFill.style.width = '0%';
  pptxProgressText.textContent = '준비 중…';
  pptxStartBtn.disabled = false;
  pptxStartBtn.textContent = '내보내기 시작';
  pptxCancelBtn.textContent = '취소';
  pptxModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closePptxModal() {
  if (pptxExportRunning) return;  // can't close mid-export
  pptxModal.hidden = true;
  document.body.style.overflow = '';
}

function setPptxProgress(label, ratio) {
  pptxProgress.hidden = false;
  pptxProgressText.textContent = label;
  pptxProgressFill.style.width = `${Math.round(ratio * 100)}%`;
}

function showPptxError(msg) {
  pptxErrorBox.hidden = false;
  pptxErrorBox.textContent = msg;
}

downloadPptxBtn.addEventListener('click', () => {
  if (!lastHtml) return;
  openPptxModal();
});

pptxCloseBtn.addEventListener('click', closePptxModal);
pptxBackdrop.addEventListener('click', closePptxModal);
pptxCancelBtn.addEventListener('click', () => {
  if (pptxExportRunning) {
    pptxCancelled = true;
    pptxCancelBtn.textContent = '취소 중…';
  } else {
    closePptxModal();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !pptxModal.hidden) closePptxModal();
});

pptxStartBtn.addEventListener('click', async () => {
  if (pptxExportRunning) return;
  const scaleInput = pptxModal.querySelector('input[name="pptx-scale"]:checked');
  const scale = scaleInput ? parseInt(scaleInput.value, 10) : 1;
  pptxExportRunning = true;
  pptxCancelled = false;
  pptxStartBtn.disabled = true;
  pptxStartBtn.textContent = '내보내는 중…';
  pptxErrorBox.hidden = true;
  try {
    await runPptxExport(scale);
    setPptxProgress('완료', 1);
    pptxExportRunning = false;
    setTimeout(() => closePptxModal(), 600);
  } catch (e) {
    pptxExportRunning = false;
    if (pptxCancelled) {
      setPptxProgress('취소됨', 0);
      pptxStartBtn.disabled = false;
      pptxStartBtn.textContent = '내보내기 시작';
      pptxCancelBtn.textContent = '취소';
    } else {
      console.error('[pptx] export failed', e);
      showPptxError(`내보내기 실패: ${e.message || e}`);
      pptxStartBtn.disabled = false;
      pptxStartBtn.textContent = '다시 시도';
      pptxCancelBtn.textContent = '취소';
    }
  }
});

// Strip HTML tags + decode common entities for the PPTX notes pane (plain text).
function htmlNoteToText(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Convert <br>/<p>/<li> to line breaks for readable plain text.
  doc.querySelectorAll('br').forEach((n) => n.replaceWith('\n'));
  doc.querySelectorAll('p, li, div').forEach((n) => n.append('\n'));
  return (doc.body.textContent || '')
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function checkCancelled() {
  if (pptxCancelled) throw new Error('사용자 취소');
}

// Build a self-contained HTML doc to render offscreen for capture.
// - All asset URLs inlined to dataURLs (existing inlineUrlAssets pipeline)
// - `noscale` attribute on <deck-stage> (deck-stage uses this branch for PPTX exporter)
// - CSS override to force every section visible & in document flow at design size
// - modern-screenshot loaded; helper script exposes window.__sbPptxApi
function buildOffscreenHtml(html) {
  const css = `
    <style id="sb-pptx-override">
      html, body { background: #000 !important; margin: 0; padding: 0; }
      /* Force all slides visible at authored size, stacked in document flow.
         Mirrors the @media print rules so each section is a discrete canvas. */
      deck-stage {
        display: block !important;
        position: static !important;
        inset: auto !important;
        background: #000 !important;
        overflow: visible !important;
      }
      deck-stage > section {
        position: relative !important;
        inset: auto !important;
        width: 1920px !important;
        height: 1080px !important;
        opacity: 1 !important;
        visibility: visible !important;
        display: block !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
      }
      /* Suppress every animation/transition so a captured frame is the final
         resting state (no half-faded text, no in-flight transforms). */
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }

      /* Watermark mirror — flattenSections() replaces <deck-stage> with
         <div id="sb-pptx-wrap">, which breaks the template's
         \`deck-stage > section:last-of-type::after\` selector. Re-state the
         same rules against the post-flatten parent so the watermark survives
         on the final slide. Keep these in sync with engine/template.html. */
      #sb-pptx-wrap > section:last-of-type::after {
        content: 'POWERED BY STUDIO BAEKS PPT ENGINE';
        position: absolute;
        bottom: 116px;
        left: 50%;
        transform: translateX(-50%);
        font-family: 'JetBrains Mono', ui-monospace, "SF Mono", Menlo, monospace;
        font-size: 16px;
        font-weight: 400;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.32);
        pointer-events: none;
        user-select: none;
        white-space: nowrap;
        z-index: 5;
      }
      #sb-pptx-wrap > section:last-of-type:not(.cover-dark):not([data-deck-darkbg])::after {
        color: rgba(26, 26, 26, 0.3);
      }
    </style>
  `;
  const helper = `
    <script>
      (function () {
        const READY_KEY = '__sbPptxReady';
        const API_KEY = '__sbPptxApi';
        window[READY_KEY] = false;

        function waitForImages() {
          const imgs = Array.from(document.images);
          return Promise.all(imgs.map((img) => {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            if (img.complete) return Promise.resolve();  // broken; resolve anyway
            return new Promise((resolve) => {
              const done = () => resolve();
              img.addEventListener('load', done, { once: true });
              img.addEventListener('error', done, { once: true });
            });
          }));
        }

        function loadScript(src) {
          return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('load failed: ' + src));
            document.head.appendChild(s);
          });
        }

        // Move every <section> out of <deck-stage> and into <body> as a direct
        // child. deck-stage's shadow DOM + ::slotted absolute-positioning was
        // confusing html2canvas's layout pass (flex space-between collapsed).
        // Sections kept their classes/styles; the engine's template CSS targets
        // \`section { ... }\` so styling still applies normally.
        function flattenSections() {
          const stage = document.querySelector('deck-stage');
          if (!stage) return [];
          const sections = Array.from(stage.querySelectorAll(':scope > section'));
          const wrap = document.createElement('div');
          wrap.id = 'sb-pptx-wrap';
          wrap.style.cssText = 'background:#000;';
          for (const s of sections) {
            // NOTE: don't touch \`display\`/\`flex-direction\` here — the engine
            // template's \`section { display:flex; flex-direction:column }\`
            // must keep applying so \`.cover { justify-content:space-between }\`
            // distributes top/center/bottom correctly.
            s.style.position = 'relative';
            s.style.inset = 'auto';
            s.style.width = '1920px';
            s.style.height = '1080px';
            s.style.opacity = '1';
            s.style.visibility = 'visible';
            s.style.margin = '0 0 16px 0';
            wrap.appendChild(s);
          }
          stage.replaceWith(wrap);
          return sections;
        }

        async function init() {
          await loadScript(${JSON.stringify(HTML2CANVAS_CDN)});
          if (document.readyState !== 'complete') {
            await new Promise((r) => window.addEventListener('load', r, { once: true }));
          }
          if (document.fonts && document.fonts.ready) {
            try { await document.fonts.ready; } catch (e) {}
          }
          await waitForImages();
          // One extra rAF pair so any post-load layout settles before capture.
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

          const sectionRefs = flattenSections();
          // Another rAF after DOM reshuffle so flex layout settles.
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

          window[API_KEY] = {
            sections: () => sectionRefs,
            capture: async (index, scale) => {
              const target = sectionRefs[index];
              if (!target) throw new Error('no section at index ' + index);
              const canvas = await window.html2canvas(target, {
                width: 1920,
                height: 1080,
                windowWidth: 1920,
                windowHeight: 1080,
                scale,
                useCORS: true,
                allowTaint: true,
                backgroundColor: null,
                logging: false,
              });
              return canvas.toDataURL('image/png');
            },
            notes: () => {
              const tag = document.getElementById('speaker-notes');
              if (!tag) return [];
              try { return JSON.parse(tag.textContent || '[]'); } catch (e) { return []; }
            },
          };
          window[READY_KEY] = true;
        }

        init().catch((err) => {
          window[API_KEY] = { error: err && err.message || String(err) };
          window[READY_KEY] = true;
        });
      })();
    </script>
  `;
  // Inject override + helper just before </head>. Also add `noscale` attribute
  // to the deck-stage tag. The deck-stage script reads this on connectedCallback.
  let modified = html.replace('</head>', `${css}\n${helper}\n</head>`);
  modified = modified.replace(/<deck-stage\b([^>]*)>/, (_m, attrs) => {
    if (/\bnoscale\b/.test(attrs)) return `<deck-stage${attrs}>`;
    return `<deck-stage${attrs} noscale>`;
  });
  return modified;
}

async function runPptxExport(scale) {
  if (typeof PptxGenJS !== 'function' && typeof window.PptxGenJS !== 'function') {
    throw new Error('pptxgenjs 로드 실패 (네트워크 확인)');
  }

  setPptxProgress('이미지 자산 임베드 중…', 0.02);
  await inlineUrlAssets();
  checkCancelled();

  const baseHtml = injectAssets(lastHtml);
  const offscreenHtml = buildOffscreenHtml(baseHtml);

  setPptxProgress('오프스크린 렌더 준비 중…', 0.06);

  // Hidden iframe — visible but off-screen so layout actually runs at full size.
  // (display:none would skip layout & image decode in some engines.)
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = [
    'position:fixed',
    'left:-100000px',
    'top:0',
    'width:1920px',
    'height:1080px',
    'border:0',
    'pointer-events:none',
    'opacity:0',
  ].join(';');
  const blob = new Blob([offscreenHtml], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  iframe.src = blobUrl;
  document.body.appendChild(iframe);

  const cleanup = () => {
    try { document.body.removeChild(iframe); } catch (e) {}
    URL.revokeObjectURL(blobUrl);
  };

  try {
    // Wait for iframe load.
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('iframe 로드 타임아웃 (30s)')), 30000);
      iframe.addEventListener('load', () => { clearTimeout(timer); resolve(); }, { once: true });
      iframe.addEventListener('error', () => { clearTimeout(timer); reject(new Error('iframe 로드 오류')); }, { once: true });
    });
    checkCancelled();

    // Poll for helper readiness (fonts/images/modern-screenshot all loaded).
    const winRef = iframe.contentWindow;
    const startedAt = Date.now();
    while (!winRef.__sbPptxReady) {
      if (Date.now() - startedAt > 30000) throw new Error('렌더 준비 타임아웃 (30s)');
      checkCancelled();
      await new Promise((r) => setTimeout(r, 100));
    }
    const api = winRef.__sbPptxApi;
    if (!api || api.error) throw new Error(api?.error || 'capture API 준비 실패');

    setPptxProgress('슬라이드 분석 중…', 0.1);
    const sections = api.sections();
    const notes = api.notes();
    if (sections.length === 0) throw new Error('캡처할 슬라이드가 없습니다');

    // Capture each section to PNG.
    const captures = [];
    for (let i = 0; i < sections.length; i++) {
      checkCancelled();
      setPptxProgress(
        `슬라이드 캡처 ${i + 1} / ${sections.length}`,
        0.1 + 0.8 * (i / sections.length),
      );
      const png = await api.capture(i, scale);
      captures.push(png);
      if (i < 2) {
        // Diagnostic: decode the dataURL into an Image to get its actual pixel size.
        const probe = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => resolve({ w: -1, h: -1 });
          img.src = png;
        });
        const rect = sections[i].getBoundingClientRect();
        console.log(`[pptx debug] slide ${i + 1} — section rect: ${rect.width}×${rect.height}, captured PNG: ${probe.w}×${probe.h}`);
      }
    }

    setPptxProgress('PPTX 생성 중…', 0.92);
    const PptxCtor = window.PptxGenJS || PptxGenJS;
    const pptx = new PptxCtor();
    pptx.layout = 'LAYOUT_WIDE';  // 13.333 × 7.5 inch, 16:9
    pptx.title = lastTitle || 'deck';
    const slideW = pptx.presLayout.width;
    const slideH = pptx.presLayout.height;

    for (let i = 0; i < captures.length; i++) {
      const slide = pptx.addSlide();
      slide.background = { color: '000000' };
      slide.addImage({
        data: captures[i],
        x: 0, y: 0, w: slideW, h: slideH,
      });
      const noteText = htmlNoteToText(notes[i] || '');
      if (noteText) slide.addNotes(noteText);
    }

    setPptxProgress('파일 다운로드…', 0.98);
    await pptx.writeFile({ fileName: `${sanitizeFilename(lastTitle)}.pptx` });
  } finally {
    cleanup();
  }
}
