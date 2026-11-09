import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Package boundary: the domain package must stay pure so the resolver,
 * validator, and simulator can run without a database, a socket, or a
 * framework. Only relative imports are allowed in src/.
 */
const srcDir = fileURLToPath(new URL('../src', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

const importPattern =
  /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;

function specifiers(code: string): string[] {
  const found: string[] = [];
  for (const match of code.matchAll(importPattern)) {
    const spec = match[1] ?? match[2] ?? match[3];
    if (spec) found.push(spec);
  }
  return found;
}

describe('domain package boundary', () => {
  const files = sourceFiles(srcDir);

  it('has source files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [relative(srcDir, f), f]))('%s imports only relative modules', (_name, file) => {
    const external = specifiers(readFileSync(file, 'utf8')).filter((spec) => !spec.startsWith('./') && !spec.startsWith('../'));
    expect(external).toEqual([]);
  });

  it('detects a forbidden import', () => {
    expect(specifiers("import { Injectable } from '@nestjs/common';\nimport { a } from './a.js';")).toEqual([
      '@nestjs/common',
      './a.js',
    ]);
    expect(specifiers("const pg = await import('pg');")).toEqual(['pg']);
  });
});
