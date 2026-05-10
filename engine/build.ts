#!/usr/bin/env bun
import * as fs from 'node:fs';
import * as path from 'node:path';
import { convertMd } from './convert.js';

const args = process.argv.slice(2);
const SRC = args[0] ?? path.resolve(import.meta.dir, '../example/sample.md');
const OUT = args[1] ?? path.resolve(import.meta.dir, '../example/sample.built.html');

const md = fs.readFileSync(SRC, 'utf8');
const deckStageScript = fs.readFileSync(
  path.resolve(import.meta.dir, '../deck-stage.js'),
  'utf8',
);

const { html, slideCount } = convertMd(md, {
  templatePath: path.resolve(import.meta.dir, 'template.html'),
  deckStageScript,
});

fs.writeFileSync(OUT, html);
console.log(`Built ${slideCount} slides → ${OUT} (self-contained)`);
