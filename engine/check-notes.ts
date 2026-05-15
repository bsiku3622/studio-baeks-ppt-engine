import { convertMd } from './convert.js';
import * as fs from 'node:fs';
const md = fs.readFileSync(process.argv[2], 'utf8');
const { html } = convertMd(md, { templateString: '{{TITLE}}{{PRIMARY_S500}}{{PRIMARY_S600}}{{SLIDES}}{{SPEAKER_NOTES}}{{DECK_STAGE_SCRIPT_TAG}}' });
const notes = JSON.parse(html.match(/speaker-notes">(\[.+?\])\s*<\/script>/s)?.[1].replace(/<\\\//g, '</') ?? '[]');
const labels = [...html.matchAll(/data-label="([^"]+)"/g)].map(m => m[1]);
console.log(`slides=${labels.length} notes=${notes.length}`);
for (let i = 0; i < labels.length; i++) {
  const note = (notes[i] ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').slice(0, 80);
  console.log(`[${(i+1).toString().padStart(2)}] ${labels[i].slice(0, 25).padEnd(25)} → ${note || '(EMPTY)'}`);
}
