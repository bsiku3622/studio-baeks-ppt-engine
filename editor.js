// Studio Baeks PPT Engine — editor

// File:// protocol can't reach server endpoints. Show a helpful banner.
if (location.protocol === 'file:') {
  const banner = document.createElement('div');
  banner.style.cssText = 'background:#FFF8E1;border-bottom:1px solid #E5B800;padding:10px 24px;font-family:"JetBrains Mono",monospace;font-size:12px;color:#7A5A00;';
  banner.innerHTML = '⚠ <code>file://</code> 모드에서는 변환 API와 Sample 로드가 작동하지 않습니다. 실제 사용은 <code>npx vercel dev</code> 또는 <a href="https://studio-baeks-ppt-engine.vercel.app" target="_blank">배포된 사이트</a>로.';
  document.body.insertBefore(banner, document.body.firstChild);
}

const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const slideCountEl = document.getElementById('slide-count');
const convertTimeEl = document.getElementById('convert-time');
const primaryStatusEl = document.getElementById('primary-status');
const assetCountEl = document.getElementById('asset-count');
const errorEl = document.getElementById('error-msg');
const downloadHtmlBtn = document.getElementById('download-html-btn');
const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
const sampleBtn = document.getElementById('sample-btn');
const dropOverlay = document.getElementById('drop-overlay');

const swatches = document.querySelectorAll('.swatch');

// State
let primaryOverride = '';     // empty = frontmatter follows
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
    errorEl.textContent = '';
    return;
  }

  try {
    const res = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: md, primaryOverride }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      errorEl.textContent = err.error || 'Conversion failed';
      return;
    }

    const { html, slideCount, frontmatter, elapsedMs } = await res.json();
    lastHtml = html;
    lastTitle = frontmatter?.title || 'deck';

    // For preview: rewrite ./assets/X to base64 if uploaded.
    const previewHtml = injectAssets(html);
    preview.srcdoc = previewHtml;

    // Sync swatch active state to the EFFECTIVE primary (override wins,
    // else frontmatter, else default). The reset swatch (empty data-color)
    // never gets active.
    const fmPrimary = frontmatter?.primary || 'terracotta';
    const effective = primaryOverride || fmPrimary;
    swatches.forEach((sw) => {
      const c = sw.dataset.color;
      sw.classList.toggle('active', !!c && c === effective);
    });

    slideCountEl.textContent = `${slideCount} 슬라이드`;
    convertTimeEl.textContent = `변환 ${elapsedMs}ms`;
    errorEl.textContent = '';
    downloadHtmlBtn.disabled = false;
    primaryStatusEl.textContent = primaryOverride
      ? `primary: ${primaryOverride} (override)`
      : `primary: ${fmPrimary} (frontmatter)`;
  } catch (e) {
    errorEl.textContent = `네트워크 오류: ${e.message}`;
  }
}

function injectAssets(html) {
  if (assetMap.size === 0) return html;
  return html.replace(/(["'])(\.\/assets\/|\/assets\/|assets\/)([^"']+)\1/g, (m, q, _prefix, name) => {
    const dataUrl = assetMap.get(name);
    return dataUrl ? `${q}${dataUrl}${q}` : m;
  });
}

editor.addEventListener('input', scheduleConvert);

// ─ Primary swatches ──────────────────────────────

swatches.forEach((sw) => {
  sw.addEventListener('click', () => {
    primaryOverride = sw.dataset.color || '';
    convert();   // active state will sync from response's effective primary
  });
});

// ─ Image upload (base64 in browser) ─────────────

function handleFiles(files) {
  let added = 0;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const reader = new FileReader();
    reader.onload = (e) => {
      assetMap.set(file.name, e.target.result);
      added++;
      assetCountEl.textContent = `assets: ${assetMap.size}`;
      // Rerun preview without re-querying server (just rewrite asset paths).
      if (lastHtml) preview.srcdoc = injectAssets(lastHtml);
    };
    reader.readAsDataURL(file);
  }
}

uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

// Drag & drop on whole document — only show overlay for file drags
let dragCounter = 0;
function isFileDrag(e) {
  return e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
}
document.addEventListener('dragenter', (e) => {
  if (!isFileDrag(e)) return;
  e.preventDefault();
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
    const res = await fetch('/example/발표.md');
    if (!res.ok) throw new Error('Sample fetch failed');
    const md = await res.text();
    editor.value = md;

    // Pre-populate assetMap with sample asset URLs so the preview shows
    // images without re-uploading. The downloaded HTML keeps the original
    // ./assets/ paths (users place an assets/ folder next to their HTML).
    assetMap.clear();
    const assetNames = new Set();
    const re = /\.\/assets\/([^\s"')]+)/g;
    let m;
    while ((m = re.exec(md)) !== null) assetNames.add(m[1]);
    for (const name of assetNames) {
      assetMap.set(name, `${location.origin}/example/assets/${name}`);
    }
    assetCountEl.textContent = `assets: ${assetMap.size}`;

    convert();
  } catch (e) {
    errorEl.textContent = `Sample 로드 실패: ${e.message}`;
  }
});

// ─ HTML download (original paths, no base64) ────

downloadHtmlBtn.addEventListener('click', () => {
  if (!lastHtml) return;
  const blob = new Blob([lastHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(lastTitle)}.html`;
  a.click();
  URL.revokeObjectURL(url);
});

function sanitizeFilename(s) {
  return s.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || 'deck';
}

// ─ Initial: try loading saved or sample ──────────

const SAVED_KEY = 'sb-ppt-md';
const saved = localStorage.getItem(SAVED_KEY);
if (saved) {
  editor.value = saved;
  convert();
}

// Auto-save to localStorage
editor.addEventListener('input', () => {
  localStorage.setItem(SAVED_KEY, editor.value);
});

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
