/**
 * Cross-artifact parity checks.
 *
 * A few values exist in two places on purpose (a document shell the worker
 * renders and the static site ships; a Content-Security-Policy the Pages
 * `_headers` file and the SSR document routes both apply). These tests fail
 * when one side drifts, which is the only thing keeping the duplicates honest.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(process.cwd());
const read = (relative: string) => readFileSync(path.join(ROOT, relative), 'utf8');

describe('the article shell exists exactly once', () => {
  it('the worker template is byte-identical to the static fallback', () => {
    const workerShell = read('apps/api/src/lib/article-shell.html');
    const staticShell = read('apps/web/public/article.html');
    expect(workerShell).toBe(staticShell);
  });

  it('keeps the three swap points the SSR renderer replaces', () => {
    const shell = read('apps/api/src/lib/article-shell.html');
    expect(shell).toMatch(/<head>[\s\S]*?<\/head>/);
    expect(shell).toMatch(/<article class="article-page"[\s\S]*?<\/article>/);
    expect(shell).toMatch(/<section\s+class="related-section"[\s\S]*?<\/section>/);
    expect(shell).toContain('id="articleRoot"');
    expect(shell).toContain('id="relatedSection"');
  });
});

describe('the shared chrome stays in step across page templates', () => {
  /** Slice one chrome region, from `open` through the closing `through`. */
  function region(html: string, open: string, through: string): string {
    const start = html.indexOf(open);
    const end = html.indexOf(through, start + open.length);
    expect(start, `chrome region ${open} missing`).toBeGreaterThan(-1);
    expect(end, `chrome region ${open} never closes with ${through}`).toBeGreaterThan(-1);
    return html.slice(start, end + through.length);
  }

  /** Whitespace/formatting noise and the homepage's self-highlight are the
   *  only legitimate differences between the shared chrome blocks. */
  function norm(html: string): string {
    return html
      .replace(/ ?class="highlighted"/g, '')
      .replace(/ ?class="is-active"/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s+>/g, '>')
      .replace(/<\s+/g, '<')
      .trim();
  }

  it('the long-form article template carries the homepage navbar, sidebar and footer', () => {
    const home = read('apps/web/public/index.html');
    // article.html is byte-identical to the worker shell (asserted above), so
    // this pins the /articles/<slug>/ render to the homepage chrome too.
    const article = read('apps/web/public/article.html');
    for (const [open, through] of [
      ['<header class="site-header">', '</header>'],
      ['<div class="sidebar"', '</ul>'],
      ['<div class="sidebar-social">', '</div>'],
      ['<footer class="site-footer">', '</footer>'],
    ] as const) {
      expect(norm(region(article, open, through)), `${open} drifted from the homepage`).toBe(
        norm(region(home, open, through)),
      );
    }
  });

  it('every sidebar shows the Tech. Sholynk wordmark instead of a heading', () => {
    for (const page of readdirSync(path.join(ROOT, 'apps/web/public'))) {
      if (!page.endsWith('.html')) continue;
      const html = read(`apps/web/public/${page}`);
      if (!html.includes('id="sidebar"')) continue;
      expect(html, `${page} sidebar`).toContain('class="sidebar-brand-logo"');
      expect(html, `${page} sidebar`).not.toContain('Explore Sholynk');
    }
  });
});

describe('the page Content-Security-Policy exists exactly once', () => {
  function workerPolicy(): string {
    // PAGE_CSP is a concatenation of string literals; collect everything
    // between the declaration and the terminating semicolon.
    const source = read('apps/api/src/routes/public/seo.ts');
    const start = source.indexOf('export const PAGE_CSP =');
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf('\n\n', start));
    const literals = [...body.matchAll(/"([^"]*)"/g)].map((match) => match[1]);
    return literals.join('').trim();
  }

  function headersPolicy(): string {
    const headers = read('apps/web/public/_headers');
    const line = headers
      .split('\n')
      .find((candidate) => candidate.trim().startsWith('Content-Security-Policy:'));
    expect(line, '_headers must carry a Content-Security-Policy').toBeDefined();
    return line!.slice(line!.indexOf(':') + 1).trim();
  }

  it('the worker SSR policy matches the static _headers policy', () => {
    expect(workerPolicy()).toBe(headersPolicy());
  });

  it('allows exactly the CDN hosts the site has always used', () => {
    const policy = headersPolicy();
    expect(policy).toContain("script-src 'self' https://cdn.jsdelivr.net");
    expect(policy).toContain('https://cdnjs.cloudflare.com');
    expect(policy).toContain('https://fonts.googleapis.com');
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });
});

describe('no inline scripts survive in the deployment', () => {
  it('every <script> either has a src or is an inert ld+json data block', () => {
    const publicDir = path.join(ROOT, 'apps/web/public');
    const htmlFiles: string[] = [];
    const walk = (directory: string) => {
      for (const entry of readdirSync(directory)) {
        const absolute = path.join(directory, entry);
        if (statSync(absolute).isDirectory()) walk(absolute);
        else if (entry.endsWith('.html')) htmlFiles.push(absolute);
      }
    };
    walk(publicDir);
    expect(htmlFiles.length).toBeGreaterThan(8);

    for (const file of htmlFiles) {
      const html = readFileSync(file, 'utf8');
      for (const match of html.matchAll(/<script([^>]*)>/gi)) {
        const attributes = match[1]!;
        const isExternal = /\bsrc\s*=/.test(attributes);
        const isInertData = /type\s*=\s*"application\/ld\+json"/.test(attributes);
        expect(
          isExternal || isInertData,
          `${path.relative(publicDir, file)} contains an inline <script> (${attributes.trim() || 'no attributes'}) — the CSP forbids it`,
        ).toBe(true);
      }
    }
  });
});
