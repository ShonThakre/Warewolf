#!/usr/bin/env node
// Usage: pnpm art:check [--strict]
// Exits 1 when a file present is wrong, or, with --strict, when required art is missing.

import { fileURLToPath } from 'node:url';
import { checkArt, formatReport, readManifest } from './check.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const strict = process.argv.includes('--strict');

const result = await checkArt(root, await readManifest(root));
const { text, passed } = formatReport(result, { strict });
console.log(text);
process.exitCode = passed ? 0 : 1;
