import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as path from 'node:path';
import { convertMd } from '../engine/convert.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { markdown, primaryOverride } = body ?? {};

    if (typeof markdown !== 'string') {
      res.status(400).json({ error: 'markdown field required (string)' });
      return;
    }

    const t0 = Date.now();
    const result = convertMd(markdown, {
      templatePath: path.resolve(process.cwd(), 'engine/template.html'),
      deckStageSrc: '/deck-stage.js',
      primaryOverride: primaryOverride && primaryOverride.length > 0 ? primaryOverride : undefined,
    });
    const elapsedMs = Date.now() - t0;

    res.json({ ...result, elapsedMs });
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? String(e) });
  }
}
