import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { convertMd } from '../engine/convert.js';

// Cache template + deck-stage.js once per cold start.
const TEMPLATE = fs.readFileSync(
  path.resolve(process.cwd(), 'engine/template.html'),
  'utf8',
);
const DECK_STAGE_SCRIPT = fs.readFileSync(
  path.resolve(process.cwd(), 'deck-stage.js'),
  'utf8',
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { markdown } = body ?? {};

    if (typeof markdown !== 'string') {
      res.status(400).json({ error: 'markdown field required (string)' });
      return;
    }

    const t0 = Date.now();
    const result = convertMd(markdown, {
      templateString: TEMPLATE,
      deckStageScript: DECK_STAGE_SCRIPT,
    });
    const elapsedMs = Date.now() - t0;

    res.json({ ...result, elapsedMs });
  } catch (e: any) {
    res.status(400).json({
      error: e?.message ?? String(e),
      line: e?.line,
      column: e?.column,
    });
  }
}
