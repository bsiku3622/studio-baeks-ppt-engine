#!/usr/bin/env bun
import * as fs from 'node:fs';
import * as path from 'node:path';
import { convertMd } from './convert.js';

const args = process.argv.slice(2);
const SRC = args[0] ?? path.resolve(import.meta.dir, '../example/발표.md');
const OUT = args[1] ?? path.resolve(import.meta.dir, '../example/발표.built.html');

const md = fs.readFileSync(SRC, 'utf8');
const DECK_STAGE_PATH = path.resolve(import.meta.dir, '../deck-stage.js');
const deckStageSrc = path.relative(path.dirname(path.resolve(OUT)), DECK_STAGE_PATH);

const { html, slideCount } = convertMd(md, {
  templatePath: path.resolve(import.meta.dir, 'template.html'),
  deckStageSrc,
});

fs.writeFileSync(OUT, html);
console.log(`Built ${slideCount} slides → ${OUT}`);
